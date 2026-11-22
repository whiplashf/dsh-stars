# dsh-stars

DSH 里的 GitHub Star 管理器：把 star 归进 GitHub Lists，并在面板里看到「自上次查看后有什么变了」。

## 它解决什么

GitHub 自带的 stars 页面只能一页页翻，分类要么靠 Lists（没有批量归类），要么靠记忆；官方也不告诉你哪些收藏的仓库发了新版本、哪些归档了。

这个插件做三件事：

1. **看类型**：按关键词把 star 分成六类（AI Agent 与技能、LLM 与深度学习、前端与工具、学习与教程、音乐与音频、量化交易），并给每个未归类的仓库一条归类建议。建议只是建议，不会自动写。
2. **分类查看**：左侧按「全部 / 未归类 / 每个 Lists / 变更」切换；四维排序（最近 star / 最近更新 / star 数 / 名字，点表头即切）、chip 筛选（有新版本 / 30 天内更新 / 未归类 / 已归档）+ 语言筛选 + 搜索、多选与 Shift 区间（点一行的任意位置就能勾选）；类型分布条上的「采纳全部建议」一次把建议批量暂存，再点一次同步写回。
3. **AI 整理**：点右上角「✦ AI 整理」，让宿主里配好的模型按描述和 topics 给出一套分类方案。已经有分类时会先问你：**基于当前分类整理**（只动未归类的，新建分类至少要有 2 个仓库）还是**完全重新整理**（按模型的判断重排所有 star）。模型只出方案，面板把方案写进暂存，仍然要你看预览再同步。
4. **结构操作**：取消 star（单行或批量，二次确认）、删除分类（先选「变未归类」或「移入另一个分类」，成员搬完才真正删）、清理孤儿成员（在分类里但已经不在 star 里的仓库）。这些都不走暂存，直接作为后台作业执行并显示进度。

5. **跟踪变更**：每次抓取和上一次快照比对，产出新收藏、新版本、新提交、归档、Star 涨跌、取消收藏六种变更，并记「未读数」；Star 涨跌只有超过 10 个或 10% 才登记，避免 +1 噪声。

分类结果的**真源是 GitHub Lists**：面板里的归类先暂存在本地，点「同步到 GitHub」先弹预览（写回多少条、每条从哪到哪），确认后才用 GraphQL `updateUserListsForItem` 写回，所以在 GitHub 网页和手机上也看得到同样的分组。

![面板](docs/preview.png)

同步时顶部有进度条（百分比、已处理/总数、写回与失败数、当前仓库），写回在宿主后台按 `syncConcurrency` 并发跑，每写一条落盘：

![同步进度](docs/progress.png)

AI 整理给出的方案（模型只出建议，还要你点「应用到暂存」再同步）：

![AI 整理](docs/ai-organize.png)

## 安装

在 DSH 的插件市场里搜 `dsh-stars` 直接点击安装（市场从 GitHub Release 上的预构建包装，不需要构建）。等价的命令行：

```bash
dsh plugin --profile web add https://github.com/whiplashf/dsh-stars/releases/latest/download/dsh-stars.tgz
```

`latest/download` 指向最新的 Release，所以这个地址不用随版本变化。

本地开发时直接装目录（profile 里写入 `link:` 依赖，改客户端代码刷新即可）：

```bash
dsh plugin --profile web add link:/path/to/dsh-stars
```

装完刷新页面，左侧栏出现「Star 管理」入口。

### 第一次使用

面板所有数据都通过 `gh` CLI 拿，所以需要：

1. 装好 [GitHub CLI](https://cli.github.com/)（`gh --version` 能跑）。
2. `gh auth login` 登录。
3. 写回 Lists 需要 token 带 `user` scope：

   ```bash
   gh auth refresh -h github.com -s user
   ```

没登录或缺 scope 时，面板顶部会显示一张检查卡，写明缺什么、给出可直接复制的命令，点「重新检查」重新探测。缺 `user` scope 时**浏览、建议、暂存都能用**，只是「同步到 GitHub」按钮不可点。

刷新数据靠 `gh` 的 API 调用，star 很多时首次抓取需要几十秒（GitHub 的 Lists 归属要按列表分页拉）。

## 数据与接口

- 状态文件：`$DSH_HOME/data/dsh-stars/state.json`（默认 `~/.dsh/data/dsh-stars/state.json`），可用 `config.stateFile` 覆盖。删掉它不会动 GitHub 上的任何数据，只会丢掉本地快照与待同步队列。
- 面板只和 `POST /api/dsh-stars` 通信，走 `ctx.connection.fetch`（Owner Peer + Host/Origin 栅栏），浏览器拿不到 GitHub token。
- action：`state` / `refresh` / `stage` / `acceptSuggestions` / `plan` / `sync` / `progress` / `createList` / `unstar` / `deleteList` / `removeOrphan` / `organize` / `organizeApply` / `markViewed` / `checkAuth`。
- `plan` 只读，返回待写回的 `plan` 和 `summary`（按分类汇总的条数）。
- `sync` 只是**启动**后台任务并立刻返回 job（`kind/running/total/done/applied/failed/current/meta`），面板每 350ms 用 `progress` 轮询；跑完那次响应才带回完整视图。每写回一条就落盘，断掉不丢已完成的进度。
- `sync` 可带 `expectCount`：和预览时的条数不一致就返回 409，避免「看着 3 条、实际写了 30 条」。
- `unstar` / `deleteList` 同样是后台作业（`job.kind` 分别是 `unstar` / `deleteList`）；`removeOrphan` 是单条即时操作。
- `organize` 只调模型出方案（`{ mode: 'reuse'|'rebuild', scope: 'unsorted'|'all' }` → 分组 + 未归类），不碰 GitHub；`organizeApply` 把方案按名字映射成 Lists（缺的会新建）写进暂存，之后仍走「同步到 GitHub」。
- 依赖 `gh` CLI 已登录；除 `PATH`/`HOME`/`LANG`/`TZ`/`GH_*` 外的环境变量不传给子进程，含 `TOKEN`/`SECRET`/`PASSWORD` 的一律剔除。

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `stateFile` | `$DSH_HOME/data/dsh-stars/state.json` | 状态文件路径 |
| `minRefreshMs` | `600000` | 打开面板时快照超过这个时长才重新抓取 |
| `staleDays` | `365` | 超过多少天没有 push 标为「一年未更新」 |
| `suggestRules` | 内置六类 | 整表替换归类规则，每项 `{ name, keywords }`；关键词命中 topics、描述或仓库名 |
| `syncConcurrency` | `4` | 同步写回的并发数（1–8） |
| `organizeProvider` / `organizeModel` | 不填 | 「AI 整理」用哪个模型；不填就用宿主里第一个可用的提供商与模型 |

## 已知边界

- 首次抓取只建基线，不会把几百个仓库都报成「新收藏」。
- 同步是**替换**语义：写回时用「已归属 − 待移出 ∪ 待加入」的完整列表覆盖，手工在网页上同时改同一个仓库可能被覆盖。
- 取消 star 会同时把仓库移出所有 Lists（GitHub 的行为），本地记录里会留下一条 `unstarred` 变更；如果别的设备取消的 star，则记作 `gone`。
- 删分类前会重新取一次远端成员（本地快照可能落后），成员搬完才删；中途失败就停在「分类还在、部分成员已搬走」的状态，重试即可继续。
- 变更追踪的粒度是仓库级（release tag、pushedAt、archived、star 数），不是逐 commit 或逐文件。
- 建议归类是关键词规则，不是模型；误判就在面板里改，规则可通过 `suggestRules` 调。没命中任何关键词的仓库会留在「未归类」，这时用「AI 整理」或手工处理。
- 「AI 整理」的结论取决于宿主里配的模型，同一批 star 两次跑可能给出不同分组；它只写暂存，写回 GitHub 前仍要过预览确认。基于当前分类整理时，只有 1 个仓库的新主题会留在未归类。
- GitHub 的 `lists(first: 30)` 有 30 个上限；正好 30 个时归属信息可能不全，代码会回退用上一次的归属。

## 结构

```
index.js          宿主半边：注册 POST /api/dsh-stars，串起抓取/暂存/同步
src/github.js     调 gh CLI 读 Lists/star、写 Lists（GraphQL，不碰 token）
src/store.js      本地快照 + 变更 diff + 待同步暂存 + 同步计划
src/classify.js   归类规则（关键词命中 topics/描述/仓库名）
src/organize.js   AI 整理：拼 prompt、解析模型 JSON、按现有分类收敛
client.js         浏览器半边：左栏图标 + 整页面板
tests/            node:test 单测（store 的纯逻辑与边界、organize 的解析与收敛）
scripts/          验证脚本：smoke.mjs（只读冒烟）、roundtrip.py（真实写回往返）
docs/             截图、设计细节（DETAIL.md）、v0.2 设计（DESIGN-v0.2.md）、ADR、交接笔记（HANDOFF.md）
```

## 开发

```bash
npm run check   # 语法检查
npm test        # node:test 单测
```

- 只验证过 DSH `0.2.2-rc.3`（`package.json` 的 `engines.dsh` 钉了这个范围）。
- 改宿主代码（`index.js`、`src/`）后，用 `plugin_manager` 把 `include:dsh-stars` 关一次再开一次即可热重载，不要重启 `dsh-web`。
- 改 `client.js` 后刷新页面即可。

## 许可

MIT
