# 交接：dsh-stars

> 给接手这个仓库的人或 agent。读完这份 + `README.md` + `docs/DETAIL.md` 就能继续干活，不需要翻聊天记录。

## 一句话现状

DSH 插件 `dsh-stars` 已开源（`github.com/whiplashf/dsh-stars`，MIT），线上版本 **v0.2.0**（2026-11-22 发布，`release.yml` 自动打包，资产 `dsh-stars.tgz` 215376 字节；真机装过 `+ dsh-stars 0.2.0`）。

v0.2 加了：四维排序、chip/语言筛选、Shift 多选、同步前预览（`plan` + `expectCount` 409）、取消 star、删除分类（成员搬完才删）、孤儿成员清理。设计见 `docs/DESIGN-v0.2.md`，术语见 `GLOSSARY.md`。

v0.3（**代码就绪，未发版**）加了两件用户点名要的：点一行的任意位置就能勾选；「✦ AI 整理」用宿主里配好的模型给分类方案（有分类时先问「基于当前分类 / 完全重新整理」，方案只写暂存，仍要过预览再同步）。

发布状态（2026-11-22）：

- GitHub：public 仓库 + `v0.1.0` / `v0.1.1` / `v0.2.0` 三个 Release；当前 latest = `v0.2.0`，资产是唯一不带版本号的 `dsh-stars.tgz`（215376 字节）；topics 有 `dsh-plugin`。
- 市场条目（fork `whiplashf/awesome-dsh-plugin` 分支 `add-dsh-stars`，最新 commit `c45a17a`）里的 tarball 用 `https://github.com/whiplashf/dsh-stars/releases/latest/download/dsh-stars.tgz`——市场按这个形状推导版本，所以条目不用随版本改。
- 发版通道（**不用 npm**）：`.github/workflows/release.yml` 在推 `v*` tag 时 `npm pack` → 改名 `dsh-stars.tgz` → 建/更新 Release 并 `--clobber` 上传。资产名必须保持无版本号，因为市场用 `releases/latest/download/<asset>` 推导新版本；换名字市场和用户都拿不到更新。
- npm：**还没发**（本机 `~/.npmrc` 的 npmjs token 已失效，`npm whoami --registry https://registry.npmjs.org` 返回 401）。发的时候：`npm publish --registry https://registry.npmjs.org`，前提是先 `npm login`。账号 2FA 是 security key 形态，本机登录时卡在「Use security key」（用户没有手边设备、也没有恢复码），走的恢复路径是 npm 官网 2FA 页 →「Use a recovery code or request a reset」→「Try recovering your account」→ 邮箱收 OTP → 提交 Reset my two-factor authentication 工单（人工处理，见 https://docs.npmjs.com/recovering-your-2fa-enabled-account）。注意：用恢复码登录会触发 72 小时发布冻结。首版必须手工发（Trusted Publishing 只对已存在的包生效），之后由 `.github/workflows/publish.yml` 接管（push tag → OIDC，无需 token）。
- 插件市场条目：已在 fork `whiplashf/awesome-dsh-plugin` 的分支 `add-dsh-stars` 提交 `data/plugins/whiplashf__dsh-stars.yml`（commit `22b9857`），**PR 还没开**——收录要求仓库创建满 1 天，2026-11-23 之后才符合。开 PR：`gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin --base main --head whiplashf:add-dsh-stars`。
- 数据侧：114 star / 8 lists / pending 0 / 未归类 27（关键词命中不了的，需要手工归）。
- 发版命令（已验证）：`npm version patch --no-git-tag-version` → `git commit -am "chore: X"` → `git push` → `git tag -a vX.Y.Z -m "dsh-stars X.Y.Z"` → `git push origin vX.Y.Z`。真机装包要写绝对路径：`~/.npm-global/bin/dsh plugin --profile <name> add ...tgz`（`dsh` 不在非交互 shell 的 PATH 里）。

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
| 排序 | 最近 star / 最近更新 / star 数 / 名字，点表头切换，`localStorage['dsh-stars.sort']` 记忆 |
| 筛选与多选 | 4 个 chip（有新版本 / 30 天内更新 / 未归类 / 已归档）+ 语言 + 搜索；Shift 区间选择，全选=当前筛选结果 |
| 同步预览 | 「同步到 GitHub (n)」先弹预览（写回多少、从哪到哪），确认后带 `expectCount` 写回；期间队列变了返回 409 |
| 取消 star | 行内或批量，二次确认；后台作业 + 进度条，本地记 `unstarred` 变更 |
| 删除分类 | 先选「变未归类 / 移入另一个分类」，逐条搬完才 `deleteUserList`，失败停在「分类还在」 |
| 孤儿清理 | 分类里但已不在 star 里的仓库，底部折叠区逐个「移出」 |
| 行点击勾选 | 点一行的任意位置即勾选/取消（避开按钮、链接、输入框、正在选文字），Shift 仍可选区间 |
| AI 整理 | 右上「✦ AI 整理」；有分类先问 reuse/rebuild；模型出方案 → 结果对话框（含未归类数、模型署名）→ 应用到暂存；reuse 模式新建分类需 ≥2 个仓库，最多 12 类，超 60 个仓库分批 |

## 架构

```
index.js        宿主：注册 POST /api/dsh-stars（ctx.connection.fetch），串起抓取/暂存/同步
src/github.js   spawn gh CLI；GraphQL 读 Lists+star、写 Lists；错误分类 unauthenticated/scope/…
src/store.js    状态文件、快照 diff、pending 暂存、planSync/markSynced
src/classify.js 关键词规则（六类），只产出建议
client.js       浏览器半边：左栏图标 + 整页面板，单文件 lazy factory
scripts/        验证脚本（smoke.mjs 只读；roundtrip.py 真实往返）
```

action 全集：`state` / `refresh` / `stage` / `acceptSuggestions` / `plan` / `sync` / `progress` / `createList` / `unstar` / `deleteList` / `removeOrphan` / `markViewed` / `checkAuth`。
`plan` 只读（返回 `plan` + `summary`）；`sync`/`unstar`/`deleteList` 都只启动后台 job 立刻返回，`progress` 轮询；跑完那次返回完整 view。同一时刻只允许一个作业。

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

8. **结构操作不进暂存**（取消 star / 删分类 / 移出孤儿直接执行）。理由见 `docs/adr/0001-structural-ops-bypass-pending.md`：`stage()` 只接受已知 list id，删 list 后暂存立即失效；取消 star 是仓库消失不是归属变化；`updateUserListsForItem` 替换语义天然幂等。
9. **同步先预览 + `expectCount`**。理由：写回是不可见的批量操作，先让人看见「写多少、写到哪」；条数对不上就 409，避免「看着 3 条、写了 30 条」。
10. **删分类前重新取远端成员**，不信本地快照。理由：本地可能落后（刚在网页往分类加过仓库），当「空分类」直接删会把成员变成孤儿。代价是多一次 `fetchLists`。
11. **排序只能在客户端做**：`viewer.starredRepositories` 的 `orderBy` 只接受 `STARRED_AT`（`StarOrderField` 只有一个值），按 star 数/推送时间排必须自己算。

## 验证记录（可复现）

- 只读冒烟：`node scripts/smoke.mjs` → 114 repos / 87 suggestions / 113 unsorted / 二次抓取 changes=0。
- 真实往返（当时队列干净时跑过，全绿）：建临时列表 → stage add → `applied 1`，GitHub `items.totalCount=1` → stage remove → `applied 1`，`totalCount=0` → `deleteUserList` 成功 → 列表与归属复原。脚本 `scripts/roundtrip.py`（**队列非空时不要跑**，见下面坑）。
- 面板：Playwright 驱动实测搜索、chip 过滤（43 行）、勾选暂存（横幅 + `待同步` chip + 按钮计数）、采纳全部（86 条）、变更页（4 条）、无 pageerror。截图 `docs/preview.png`。
- 归属归零修复（2026-11-22）：从 GitHub 删掉一个 list 后，本地 `repo.lists` 一直残留已删 id（`applyFetch` 里 `listMembership.get(name) ?? old?.lists` 的回退把「不属于任何 list」也回退成旧值），表现为「未归类 7 / 各 list 计数合计 87 对不上 114」。改成只有抓回 30 个 lists（`lists(first: 30)` 上限）时才回退；实测修复后未归类回到 27、悬空 id 0。
- 进度条（2026-11-22）：临时列表暂存 8 条 → 点同步，Playwright 连拍实测进度条依次 `0/8 → 2/8 → 4/8 → 5/8 → 7/8`（fill 2%→88%）、结束后横幅「已同步 8 个仓库」、无 pageerror；随后 stage remove + 同步 + `deleteUserList` 复原，GitHub `items.totalCount` 归零，本地 114 star / pending 0 / 27 未归类。
- 抓到并修掉的真 bug：`updateUserListsForItem` 的返回值曾写 `lists { totalCount }`，而 `totalCount` 只存在于 `items` 上，导致整条 mutation 无效（`applied 0`）。
- v0.2 单测：`npm test` 18/18（新增墓碑、itemIds、dropRepo、removeList、applyListRemoval、孤儿、baselineAt 等）。
- v0.2 真机 E2E（`/tmp/e2e-v02*.mjs`，探针仓库 `octocat/Hello-World`、`octocat/Spoon-Knife`，临时列表全部删净）：
  - 取消 star：`addStar` → refresh → 进临时列表 → `unstar` → job `failed 0`，GitHub 上 star 已取消、临时列表成员归零、本地仓库消失、变更 `kind=unstarred`；
  - 删分类（变未归类）：2 个仓库进临时分类 → `deleteList` → `meta.deleted=true`，GitHub 列表消失、本地列表移除、仓库回未归类且仍在 star 里；
  - 删分类（移入另一分类）：源分类 2 条 → 目标分类收到 2 条、源分类消失、本地归属指向目标；
  - 孤儿：把未 star 的仓库塞进临时分类 → `view().orphans` 报到、计数含孤儿 → `removeOrphan` 后 GitHub 成员归零、本地孤儿消失；
  - 运行中发现的 bug：删分类的 targets 从本地 `list.repos` 算，本地没刷新过就是空的 → 「移入」变成「全移出」。已改成动手前 `github.fetchLists()` 取远端成员。
- v0.3 AI 整理（2026-11-22）：`{action:'organize', mode:'reuse', scope:'unsorted'}` 实测 11–19s（路由 `deepseek-official` / `deepseek-flash`，26 个仓库），给出 6–11 个分组、含 1–3 个新建分类；UI 全链路（点「✦ AI 整理」→ 模式对话框 → `AI 正在整理…` → `AI 建议分成 N 个分类` → 应用到暂存 → 横幅「已把 25 个仓库放进暂存」+ 同步按钮 `(25)`）用 Playwright 跑通，之后已把暂存清掉、3 个新建列表删掉（`state` 回到 7 lists / pending 0）；行点击实测 `已选 1 个` → 再点清空。`npm test` 26/26。
- v0.2 面板（Playwright，`/tmp/ui-v02*.mjs`）：点「Star」表头 → 首行 `★ 459463`，再点 → `★ 1`；chip「未归类」→ 27 行；全选 → 「已选 114 个」+ 「取消 star（」按钮；预览对话框 `将写回 3 个仓库` + `tmp-v02-ui ← 3 个` + 三行 `未归类 → tmp-v02-ui`；删除分类对话框 `变未归类 / 移入另一个分类`，move 模式未选目标时确认按钮 disabled；无 pageerror。

## 当前数据状态（接手先看）

- `state.json`（2026-11-22 19:2x AI 整理收尾复核）：**113 个 star、7 个 Lists、pending 0、26 个未归类、无孤儿、无悬空 list id**（比 18:30 少 1 个 star / 1 个分类，是用户自己在 GitHub 上取消了一个 star 并删了一个列表；AI 测试产生的暂存与 3 个新建列表已全部清掉）。
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

13. `deleteUserList` 的 input 字段是 `listId`（不是 `userListId`）；`RemoveStarInput` 只有 `starrableId`。脚本里用 `gh api graphql --input -`（JSON）而不是 `-f`，`-f` 会把变量字符串化。
14. 作业是单飞的：同步/取消 star/删分类同时只允许一个，第二个会返回 `busy`；测试脚本必须等 `progress` 里 `running:false` 再断言。
15. E2E 里直接从 GraphQL 改成员后，本地快照不会自动更新——要么先 `refresh`，要么依赖宿主在删分类前自己取远端成员。
16. 取消 star 的探针会在变更记录里留下 `new` + `unstarred` 噪声（变更没有删除接口），测试时用一次性探针仓库，别用用户真在意的仓库。

17. **性能：先看往返次数，再看并发。** gh 每次调用 ≈ 0.7s（起进程 0.04s + GitHub 往返）；`fetchLists` 曾经是「1 次列表查询 + 每个列表 1 次成员查询」的串行 1+N（8 个列表 ≈ 8s）。改成一次请求取回所有列表前 100 个成员后是 2.9s；删分类前核查只需要一个列表的成员，单独用 `fetchListMembers(listId)` 是 0.9s。2026-11-22 实测（13 成员列表）：删分类端到端 9.7s → 1.6s（接口返回）+ 4.3s（成员写回，6 并发）+ 0.8s（删列表）。
19. **AI 整理的模型接口别 import**：插件装在 `link:` 目录，`import '@deepseek-ai/dsh-llm'` 解析不到 DSH 的 node_modules。用 `ctx.get('llm')` → `listProviders()` / `listModels(provider)` / `prepareCall({provider, model, maxTokens})` → `stream({...config, system, messages})`，自己按 `text-delta` 累积文本（参考 `@deepseek-ai/dsh-experimental-translator`）。cordis 的 `inject` 只收字符串数组，用 `ctx.get` 拿不到就当没有。
20. 模型输出不能信：`extractJson` 要容忍代码块/尾逗号，`normalizePlan` 必须丢掉不存在的仓库名并限制分组数；同一批 star 两次跑结果会不一样（11 类 vs 9 类），所以它只写暂存。
21. 「采纳全部建议」只在**有规则命中的未归类仓库**时才出现——27 个未归类里大多命中不了关键词，所以分布条经常是空的，这是正常的；AI 整理按钮因此放在顶部而不是分布条里。
22. 剩下的最贵路径是 `fetchStarred`：100 个仓库带 topics + latestRelease 的一页在 GitHub 侧就要 5.9s（去掉 topics 4.0s、只取最小字段 2.7s），114 star 两页 ≈ 7.5s，`refresh` 因此还在 9s 左右。要再快只能拆查询或按需取 topics。

23. **新建分类要带描述**：`github.createList(name, description)` 的第二个参数不传就留空，GitHub Lists 页里只看得到名字。插件建分类统一写 `dsh-stars 自动创建`（`acceptSuggestions`、`organizeApply`、面板 `createList` 三处都传）；已经建空的历史列表用 `updateUserList(input:{listId, description})` 补。注意 `updateUserList` 的 `name` 不传会保持原名，`description: ""` 可以清空。

24. **主题色不能想当然**：`--dsw-alias-brand-primary` 是**前景色**（亮 `#0f1115`、暗 `#f9fafb`），拿它当按钮底色在暗色主题下就是白底白字；主按钮要用 `background: label-primary + color: bg-layer-1`。可用的：`--dsw-alias-link`（亮 `#4176e6` / 暗 `#7aaaff`，做链接和强调）、`state-success/warn/error-primary`、`label-primary/secondary/tertiary/caption`、`bg-layer-1/2`、`interactive-bg-hover`、`card-fill(-hover)`。不存在但曾被我写错的：`--dsw-alias-state-warning-primary`（应为 `state-warn-primary`）、`--dsw-alias-fg-secondary`（应为 `label-secondary`）。改主题相关样式后必须用 Playwright `colorScheme: 'light' | 'dark'` 两套各截一次图。

## 下一步候选（按价值排）

1. **把剩下 27 个未归类手工归掉**（86 条已同步上线）——数据价值最大的一步。可以顺手把 27 条里反复出现的词补进 `classify.js` 规则。
2. 右栏仓库详情：release notes、最近提交列表（要额外的 compare/commits API，按需加载）。
3. 定时抓取：复用 `dsh-schedule` 每天跑一次 `refresh`，有变更时通知。
4. 规则可编辑 UI（现在只能改 `config.suggestRules` 整表替换）。
5. 发版 v0.3.0：代码就绪（行点击 + AI 整理），等用户确认后 `npm version 0.3.0 --no-git-tag-version` → commit → `git tag -a v0.3.0 && git push origin v0.3.0`，`release.yml` 自动打包挂资产（不需要 npm）。版本号要 ≥0.3 是因为加了新 action（`organize` / `organizeApply`）与新配置键。
6. AI 整理还能再省：把「已有分类 + 未归类」的仓库做成 embedding 聚类先粗排，再让模型只微调（当前每次 10–20s 且结果有抖动）。

## 相关命令

```bash
npm run check                            # node --check 五个文件
node scripts/smoke.mjs                   # 只读冒烟（真实 gh，临时状态文件）
~/code/home/bin/code-check               # repos.tsv 与磁盘/gh 可见性一致性
```
