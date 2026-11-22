# 交接：dsh-stars

> 给接手这个仓库的人或 agent。读完这份 + `README.md` + `docs/DETAIL.md` 就能继续干活，不需要翻聊天记录。

## 一句话现状

DSH 插件 `dsh-stars` v0.1.0 已完成、真实验证、**已开源**（`github.com/whiplashf/dsh-stars`，MIT），并按插件市场要求补齐了单测 / CI / 图标 / 首次运行检查卡。

发布状态（2026-11-22）：

- GitHub：public 仓库 + `v0.1.0` / `v0.1.1` 两个 Release；当前 latest = `v0.1.1`，资产只有一个不带版本号的 `dsh-stars.tgz`（v0.1.0 上还留着历史资产 `dsh-stars-0.1.0.tgz`）；topics 有 `dsh-plugin`。
- 市场条目（fork `whiplashf/awesome-dsh-plugin` 分支 `add-dsh-stars`，最新 commit `c45a17a`）里的 tarball 用 `https://github.com/whiplashf/dsh-stars/releases/latest/download/dsh-stars.tgz`——市场按这个形状推导版本，所以条目不用随版本改。
- 发版通道（**不用 npm**）：`.github/workflows/release.yml` 在推 `v*` tag 时 `npm pack` → 改名 `dsh-stars.tgz` → 建/更新 Release 并 `--clobber` 上传。资产名必须保持无版本号，因为市场用 `releases/latest/download/<asset>` 推导新版本；换名字市场和用户都拿不到更新。
- npm：**还没发**（本机 `~/.npmrc` 的 npmjs token 已失效，`npm whoami --registry https://registry.npmjs.org` 返回 401）。发的时候：`npm publish --registry https://registry.npmjs.org`，前提是先 `npm login`。账号 2FA 是 security key 形态，本机登录时卡在「Use security key」（用户没有手边设备、也没有恢复码），走的恢复路径是 npm 官网 2FA 页 →「Use a recovery code or request a reset」→「Try recovering your account」→ 邮箱收 OTP → 提交 Reset my two-factor authentication 工单（人工处理，见 https://docs.npmjs.com/recovering-your-2fa-enabled-account）。注意：用恢复码登录会触发 72 小时发布冻结。首版必须手工发（Trusted Publishing 只对已存在的包生效），之后由 `.github/workflows/publish.yml` 接管（push tag → OIDC，无需 token）。
- 插件市场条目：已在 fork `whiplashf/awesome-dsh-plugin` 的分支 `add-dsh-stars` 提交 `data/plugins/whiplashf__dsh-stars.yml`（commit `22b9857`），**PR 还没开**——收录要求仓库创建满 1 天，2026-11-23 之后才符合。开 PR：`gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin --base main --head whiplashf:add-dsh-stars`。
- 数据侧：114 star / 8 lists / pending 0 / 未归类 27（关键词命中不了的，需要手工归）。

## 仓库与安装

| 项 | 值 |
| --- | --- |
| 代码 | `/home/massiwei/code/private/dsh-stars` |
| 分支 | `main`，最新提交见 `git log` |
| remote | `origin` = `git@github.com:whiplashf/dsh-stars.git`（public，MIT） |
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
| 写回 GitHub | 顶部「同步到 GitHub (n)」用 GraphQL `updateUserListsForItem` 替换语义写回；4 并发，后台跑 |
| 同步进度 | 同步中顶部进度条：百分比 + done/total + 已写回/失败 + 当前仓库；每写回一条落盘，刷新页面后接着显示 |
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

action 全集：`state` / `refresh` / `stage` / `acceptSuggestions` / `sync` / `progress` / `createList` / `markViewed`。
`sync` 只启动后台 job 立刻返回，`progress` 轮询；跑完那次返回完整 view。

## 关键决策与理由

1. **GitHub Lists 是分类真源**，本地只缓存。理由：网页/手机端看到的分类一致，不用再维护第二套分类数据；代价是写回必须走 token scope。
2. **两段式（暂存 → 同步）**。理由：批量改 86 条不至于发 86 次请求、断网不留半成品、失败可重试；也避免「建议」被当成事实直接写进用户 GitHub。
3. **客户端 → 宿主用 `ctx.connection.fetch.register`**（`/api/dsh-stars`，owner-only + Host/Origin 栅栏）。
   - 否掉 `ctx.webServer.register`（synapse 那种）：它绕开 `/api` 信任栅栏，局域网可直连写 GitHub。
   - 否掉 `ctx.commands`：只回文本，还往 session log 写事件，面板拿不到结构化数据。
   - 否掉官方 Typert remote：要代码生成产物，手写插件挂不上。
4. **变更只在仓库级**（release tag / pushedAt / archived / star），不做逐 commit diff。理由：114 个仓库逐个 diff 要 clone 或额外的 compare API，成本远超收益。
5. **星标变化去噪**：只有涨跌 ≥ 10 个或 ≥ 10% 才登记；同一仓库同类变更只留最新一条（读盘时也会清理旧噪声）。否则每天几十条「+1 star」会淹没真正的提交。
6. **同步改成后台 job + 轮询**，而不是一个阻塞到结束的请求。理由：86 条串行要 1 分钟，HTTP 请求一直挂着既看不到进度、又怕网关/页面刷新把请求掐断；现在 `sync` 立刻返回 job，`progress` 每 350ms 拉一次，且每条写回后 `store.save()`，断了只重跑剩下的。
7. **写回并发 4**（`config.syncConcurrency`，上限 8）。理由：`gh` 起一次进程 + 一次 GraphQL mutation 约 0.5–1s，串行 86 条约 1 分钟；4 并发实测 8 条 2.2s，远低于 GitHub 二级限流阈值。

## 验证记录（可复现）

- 只读冒烟：`node scripts/smoke.mjs` → 114 repos / 87 suggestions / 113 unsorted / 二次抓取 changes=0。
- 真实往返（当时队列干净时跑过，全绿）：建临时列表 → stage add → `applied 1`，GitHub `items.totalCount=1` → stage remove → `applied 1`，`totalCount=0` → `deleteUserList` 成功 → 列表与归属复原。脚本 `scripts/roundtrip.py`（**队列非空时不要跑**，见下面坑）。
- 面板：Playwright 驱动实测搜索、chip 过滤（43 行）、勾选暂存（横幅 + `待同步` chip + 按钮计数）、采纳全部（86 条）、变更页（4 条）、无 pageerror。截图 `docs/preview.png`。
- 归属归零修复（2026-11-22）：从 GitHub 删掉一个 list 后，本地 `repo.lists` 一直残留已删 id（`applyFetch` 里 `listMembership.get(name) ?? old?.lists` 的回退把「不属于任何 list」也回退成旧值），表现为「未归类 7 / 各 list 计数合计 87 对不上 114」。改成只有抓回 30 个 lists（`lists(first: 30)` 上限）时才回退；实测修复后未归类回到 27、悬空 id 0。
- 进度条（2026-11-22）：临时列表暂存 8 条 → 点同步，Playwright 连拍实测进度条依次 `0/8 → 2/8 → 4/8 → 5/8 → 7/8`（fill 2%→88%）、结束后横幅「已同步 8 个仓库」、无 pageerror；随后 stage remove + 同步 + `deleteUserList` 复原，GitHub `items.totalCount` 归零，本地 114 star / pending 0 / 27 未归类。
- 抓到并修掉的真 bug：`updateUserListsForItem` 的返回值曾写 `lists { totalCount }`，而 `totalCount` 只存在于 `items` 上，导致整条 mutation 无效（`applied 0`）。

## 当前数据状态（接手先看）

- `state.json`（2026-11-22 15:57 复核）：114 个 star、8 个 Lists、**pending 0**、27 个仍未归类（关键词规则命中不了，需要人工）、6 条变更。
- 六个分类 Lists 已填充：AI Agent 与技能 42 / 音乐与音频 22 / 学习与教程 11 / LLM 与深度学习 7 / 前端与工具 2 / 量化交易 2，合计 86。
- 原有 `skills`(1) 与 `📘 QT`(0) 未被改动；测试列表（`tmp-progress-test`、`tmp-progress-ui`）已删除、归属已还原。

## 已知坑（踩过的）

1. `state` 返回的是缓存，10 分钟内不重新抓；外部删了列表后本地还显示旧项，先点「刷新」。
2. `createList` 只往本地列表数组里按 id 追加，不剔除已被别处删除的列表。
3. `stage(..., { remove: [所有列表 id] })` 会把该仓库的 desired 清空；若它本来就在某个列表里，同步时会真的被移出。测试后若状态被弄脏，用 `stage(add: [原列表 id])` 还原（desired 变回原值后 pending 自动清空）。
4. `scripts/roundtrip.py` 会触发整队列同步（`sync` 不分批），**pending 非空时不要跑**。
5. 手签 v2 cookie 会 401。正确做法：`GET $DSH_BASE/?token=$DSH_WEB_STATIC_TOKEN`（token 在 `~/.dsh/web-token.env`），拿 303 返回的 `set-cookie`。
6. gh token 需要 `user` scope 才能建/改 Lists：`gh auth refresh -h github.com -s user`（非交互必须带 `-h`）。
7. `gh api graphql` 传数组变量必须 `--input -` 给 JSON，`-f` 会字符串化。
8. 不要在 dsh-web 的 cgroup 里 restart dsh-web（会自杀）；用 `systemd-run --user --scope` 或让用户点「Restart dsh」。
9. 同步进行中宿主会拒绝 `stage`/`acceptSuggestions` 并跳过 `refresh`（返回 busy 错误）；想测同步就等 `progress` 返回 `running:false`。
10. 用 Node `fetch` 打 `https://192.168.31.212:3080` 要加 `NODE_TLS_REJECT_UNAUTHORIZED=0`（自签证书），否则只报 `fetch failed`。
11. 同步完成后 Lists 的 `count` 还是旧快照值，要等下一次 `refresh` 才对；状态栏数字短暂不一致是正常的。
12. GitHub `deleteUserList` **不会**清掉 item 上的归属：删完后仓库仍带着那个 list id（`viewer.lists` 里已经没有它）。要彻底清干净得对每个 item 调 `updateUserListsForItem(listIds: [])`；本地这边靠 `applyFetch` 的归零逻辑兜底。

## 下一步候选（按价值排）

1. **把剩下 27 个未归类手工归掉**（86 条已同步上线）——数据价值最大的一步。可以顺手把 27 条里反复出现的词补进 `classify.js` 规则。
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
