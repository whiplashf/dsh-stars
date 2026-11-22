# 交接：dsh-stars

> 给接手这个仓库的人或 agent。读完这份 + `README.md` + `docs/DETAIL.md` 就能继续干活，不需要翻聊天记录。

## 一句话现状

DSH 插件 `dsh-stars` 的 v1 已经完成并真实验证过（读、分类、暂存、写回 GitHub Lists、变更 diff 全链路跑通）。**当前本地有 86 条归类暂存待写回**，其余都是可用状态。

## 仓库与安装

| 项 | 值 |
| --- | --- |
| 代码 | `/home/massiwei/code/private/dsh-stars` |
| 分支 | `main`，最新提交 `68584ad`（feat: 一键采纳全部建议 + 变更去噪） |
| remote | **还没有**，纯本地仓库（按约定先私有、后发布） |
| 安装方式 | profile `~/.dsh/profiles/web/package.json` 里 `"dsh-stars": "link:/home/massiwei/code/private/dsh-stars"`，`node_modules/dsh-stars` 是软链 |
| 工作区 | DSH 左栏「工作区」第一个 `dsh-stars`（id `838c4a89-cb41-40af-b7a8-787c00b300de`，path 同上） |
| 状态文件 | `~/.dsh/data/dsh-stars/state.json` |

改代码后的生效方式：

- **宿主**（`index.js`、`src/*`）：`plugin_manager set_plugin target:"include:dsh-stars" enabled:false` 再 `enabled:true`。entryId 是 `include:dsh-stars`，**不是** `dsh-stars`。
- **客户端**（`client.js`）：刷新页面即可（boot 时重新拉 `dsh-stars/client.js`）。
- 装/卸插件本身用 `plugin_manager` 的 `install_bundle` / `remove_bundle`，不要手改 profile 的 package.json。

## 现在能做什么（都实测过）

| 能力 | 说明 |
| --- | --- |
| 看类型 | 顶部类型分布条：AI Agent 与技能 42 / 音乐与音频 22 / 学习与教程 11 / LLM 与深度学习 7 / 量化交易 2 / 前端与工具 2；点 chip 过滤 |
| 分类查看 | 左栏全部 114 / 未归类 / 每条 Lists / 变更；搜索、只看归档、只看一年未更新、只看待同步 |
| 批量归类 | 「采纳全部建议 (n)」一次暂存未归类仓库（缺 Lists 自动创建）；也可勾选后从工具栏选列表 |
| 写回 GitHub | 顶部「同步到 GitHub (n)」用 GraphQL `updateUserListsForItem` 替换语义写回 |
| 变更追踪 | 新收藏/新版本/新提交/归档/Star 涨跌/取消收藏，未读数 + 标记已读 |
| 新建列表 | 左栏「+ 新建列表」，直接在 GitHub 建 |

## 架构

```
index.js        宿主：注册 POST /api/dsh-stars（ctx.connection.fetch），串起抓取/暂存/同步
src/github.js   spawn gh CLI；GraphQL 读 Lists+star、写 Lists；错误分类 unauthenticated/scope/…
src/store.js    状态文件、快照 diff、pending 暂存、planSync/markSynced
src/classify.js 关键词规则（六类），只产出建议
client.js       浏览器半边：左栏图标 + 整页面板，单文件 lazy factory
scripts/        验证脚本（smoke.mjs 只读；roundtrip.py 真实往返）
```

action 全集：`state` / `refresh` / `stage` / `acceptSuggestions` / `sync` / `createList` / `markViewed`。

## 关键决策与理由

1. **GitHub Lists 是分类真源**，本地只缓存。理由：网页/手机端看到的分类一致，不用再维护第二套分类数据；代价是写回必须走 token scope。
2. **两段式（暂存 → 同步）**。理由：批量改 86 条不至于发 86 次请求、断网不留半成品、失败可重试；也避免「建议」被当成事实直接写进用户 GitHub。
3. **客户端 → 宿主用 `ctx.connection.fetch.register`**（`/api/dsh-stars`，owner-only + Host/Origin 栅栏）。
   - 否掉 `ctx.webServer.register`（synapse 那种）：它绕开 `/api` 信任栅栏，局域网可直连写 GitHub。
   - 否掉 `ctx.commands`：只回文本，还往 session log 写事件，面板拿不到结构化数据。
   - 否掉官方 Typert remote：要代码生成产物，手写插件挂不上。
4. **变更只在仓库级**（release tag / pushedAt / archived / star），不做逐 commit diff。理由：114 个仓库逐个 diff 要 clone 或额外的 compare API，成本远超收益。
5. **星标变化去噪**：只有涨跌 ≥ 10 个或 ≥ 10% 才登记；同一仓库同类变更只留最新一条（读盘时也会清理旧噪声）。否则每天几十条「+1 star」会淹没真正的提交。

## 验证记录（可复现）

- 只读冒烟：`node scripts/smoke.mjs` → 114 repos / 87 suggestions / 113 unsorted / 二次抓取 changes=0。
- 真实往返（当时队列干净时跑过，全绿）：建临时列表 → stage add → `applied 1`，GitHub `items.totalCount=1` → stage remove → `applied 1`，`totalCount=0` → `deleteUserList` 成功 → 列表与归属复原。脚本 `scripts/roundtrip.py`（**队列非空时不要跑**，见下面坑）。
- 面板：Playwright 驱动实测搜索、chip 过滤（43 行）、勾选暂存（横幅 + `待同步` chip + 按钮计数）、采纳全部（86 条）、变更页（4 条）、无 pageerror。截图 `docs/preview.png`。
- 抓到并修掉的真 bug：`updateUserListsForItem` 的返回值曾写 `lists { totalCount }`，而 `totalCount` 只存在于 `items` 上，导致整条 mutation 无效（`applied 0`）。

## 当前数据状态（接手先看）

- `state.json`：114 个 star、8 个 Lists、**86 个仓库 pending.add**、27 个仍未归类（关键词规则命中不了，需要人工）、4 条变更。
- 6 个新分类 Lists 已建在 GitHub 上但都是空的（0 项），同步后才会填充。
- 点一次「同步到 GitHub (86)」会发出 86 次 mutation，约 1 分钟。**这是用户唯一还没做的动作。**
- 原有 `skills`(1) 与 `📘 QT`(0) 未被改动；测试仓库归属已还原。

## 已知坑（踩过的）

1. `state` 返回的是缓存，10 分钟内不重新抓；外部删了列表后本地还显示旧项，先点「刷新」。
2. `createList` 只往本地列表数组里按 id 追加，不剔除已被别处删除的列表。
3. `stage(..., { remove: [所有列表 id] })` 会把该仓库的 desired 清空；若它本来就在某个列表里，同步时会真的被移出。测试后若状态被弄脏，用 `stage(add: [原列表 id])` 还原（desired 变回原值后 pending 自动清空）。
4. `scripts/roundtrip.py` 会触发整队列同步（`sync` 不分批），**pending 非空时不要跑**。
5. 手签 v2 cookie 会 401。正确做法：`GET $DSH_BASE/?token=$DSH_WEB_STATIC_TOKEN`（token 在 `~/.dsh/web-token.env`），拿 303 返回的 `set-cookie`。
6. gh token 需要 `user` scope 才能建/改 Lists：`gh auth refresh -h github.com -s user`（非交互必须带 `-h`）。
7. `gh api graphql` 传数组变量必须 `--input -` 给 JSON，`-f` 会字符串化。
8. 不要在 dsh-web 的 cgroup 里 restart dsh-web（会自杀）；用 `systemd-run --user --scope` 或让用户点「Restart dsh」。

## 下一步候选（按价值排）

1. **把 86 条同步上线**，再把 27 个未归类手工归掉——数据价值最大的一步。
2. 右栏仓库详情：release notes、最近提交列表（要额外的 compare/commits API，按需加载）。
3. 定时抓取：复用 `dsh-schedule` 每天跑一次 `refresh`，有变更时通知。
4. 规则可编辑 UI（现在只能改 `config.suggestRules` 整表替换）。
5. 发布：建 remote、`gh repo edit --visibility public`、发 npm、投 awesome-dsh-plugin（这些按发版规则要先拿到用户明确确认）。

## 相关命令

```bash
npm run check                            # node --check 五个文件
node scripts/smoke.mjs                   # 只读冒烟（真实 gh，临时状态文件）
~/code/home/bin/code-check               # repos.tsv 与磁盘/gh 可见性一致性
```
