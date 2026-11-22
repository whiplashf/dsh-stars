# dsh-stars v0.2 设计：补齐全套操作

> 状态：设计已定稿（2026-11-22），实现前文档。v0.1.1 之前的所有行为见 `docs/HANDOFF.md`。
> 本文只写 v0.2 新增/改变的部分；既有语义没有变化的地方不重复。

## 0. 已定的决策

| # | 决策 | 结论 |
|---|---|---|
| D1 | 删分类的语义 | 删除前选择「移入另一个分类 / 变未归类」，默认变未归类；空分类直接删 |
| D2 | 取消 star 的形态 | 单行 + 批量都要；执行前二次确认；本地立即移出并记变更 |
| D3 | 排序 | 四维（最近 star / 最近更新 / star 数 / 名字）、点表头切换、localStorage 记忆、默认最近 star 倒序 |
| D4 | 本轮补的场景 | 同步预览、搜索增强（语言 + 快捷筛选）、批量选择；规则编辑 UI 单独立项；备注/导出/定时刷新不做 |
| D5 | 孤儿成员 | 在所属分类下显示灰色孤儿行，可移出 |
| D6 | 删分类的通道 | 一次性后台 job（清归属 → 删 list），不进 pending |
| D7 | 取消 star 的通道 | job（4 并发 + 进度条），记 `unstarred` 变更，与 `gone` 区分 |
| D8 | 同步预览 | 单按钮、永远先弹预览层，确认按钮写「写回 N 个仓库」 |
| D9 | 选区边界 | 切分类/改搜索/改筛选即清空；全选 = 当前筛选结果，显示数字 |
| D10 | 快捷筛选 | 有新版本（release 30 天内）/ 30 天内更新 / 未归类 / 已归档 / 语言 |
| D11 | 孤儿清理 | 立即执行、不确认、toast 提示 |

## 1. 领域模型

术语与既有词汇的关系（新增词见 `GLOSSARY.md`）：

- **分类（list）** 是 GitHub 上的 `UserList`，是分类真源；本地只有缓存。
- **暂存（pending）** 是「仓库归属」的待写回意图，只覆盖仓库级变更。
- **作业（job）** 是「已经在跟 GitHub 对话」的一次批量执行，有进度、有失败记录。v0.1 只有 `sync` 一种 job。
- **结构操作** 指改分类本身（删除分类）或改仓库存在性（取消 star）的操作，它们**不进 pending**，直接作为 job 执行（见 ADR-0001）。
- **孤儿成员** 是「挂在某个分类里、但已经不在 star 列表里」的仓库。GitHub 允许这种状态。

关键推论（实测得出）：

1. 取消 star 会让仓库从所有分类里自动消失（服务端行为），所以不需要级联清归属。
2. 反过来，未 star 的仓库可以被放进分类，所以「分类成员 ⊆ star」不成立，必须显式处理孤儿。

## 2. 数据模型变化

`state.json` 增量（都带默认值，旧文件可直接读）：

```js
{
  // 新增：最近由本面板取消 star 的仓库，用于把 gone 和 unstarred 分开
  unstarredAt: { "owner/repo": "2026-11-22T09:00:00.000Z" },  // 默认 {}

  // 既有字段不变；repos[].lists / pending / firstSeenAt / stale 语义不变
}
```

- `unstarredAt` 只在取消 star 时写入，`applyFetch` 里消费：仓库从 star 列表消失时，若 `unstarredAt[name]` 存在且晚于 `snapshotAt - 7d`，记 `kind: 'unstarred'`，否则记 `kind: 'gone'`；消费后删除该条（一次性语义）。
- 过期条目（> 7 天）在刷新时顺手清掉，避免无限增长。

## 3. 功能设计

### 3.1 删除分类（D1 / D6）

入口：左侧分类行 hover 出现的「⋯」菜单 →「删除分类」；或该分类处于选中态时，工具栏右侧的「删除分类」。

流程：

1. 空分类（`count === 0`）→ 直接确认弹层「删除分类 X？」→ job。
2. 非空分类 → 弹层显示「X 里有 N 个仓库」，二选一：
   - **变未归类**（默认）
   - **移入另一个分类**（下拉，列出除自己外的分类）
3. 确认后启动 job：

```
POST { action: 'deleteList', listId, mode: 'unsorted' | 'move', targetListId? }
```

作业步骤（复用 `runSync` 的并发 worker 与进度结构）：

- 对 `list.repos` 里每个仓库：
  - `mode === 'unsorted'` → `updateUserListsForItem(itemId, lists - listId)`
  - `mode === 'move'` → `updateUserListsForItem(itemId, [...lists - listId, targetListId])`
  - 每条成功后 `store.applyListRemoval(name, listId, targetListId?)` 并 `save()`
- 全部成功后 `github.deleteUserList(listId)` → `store.removeList(listId)` → `save()`
- 任一失败：保留 list（不删），job 记 failed，界面提示「还有 N 个仓库没搬完，分类未删除」

进度条沿用现有组件，meta 文案：「正在处理 3/12 · 目标：未归类」。

### 3.2 取消 star（D2 / D7）

入口：行内「⋯」菜单 →「取消 star」；批量：选中若干后工具栏出现「取消 star（N）」。

确认弹层：列出前 5 个 `owner/repo`，其余显示「…等 N 个」，按钮文案「取消 star」+ 红色。

```
POST { action: 'unstar', fullNames: [...] }
```

作业：4 并发 `github.removeStar(itemId)`；成功者：

- `store.dropRepo(name)`（从 `repos`/`order` 移除，丢弃 pending）
- `store.markUnstarred(name)`（写 `unstarredAt`）
- `store.pushChange({ kind: 'unstarred', ... })` 直接插一条变更记录（不等下次刷新，用户立刻能看到自己做了什么）
- 每批 `save()`

失败者：保留在列表里，job.failed 记录，界面提示。

> 注意：`itemId` 必须来自本地 state 的 `repos[name].id`（GraphQL node id）。没有 id 的仓库（理论上不会出现）直接跳过并记失败。

### 3.3 排序（D3）

纯客户端。`client.js` 内 `sortKey`/`sortDir` 两个 state，持久化到 `localStorage['dsh-stars.sort']`（形如 `"pushedAt:desc"`，非法值回退默认）。

| 表头 | key | 取值 |
|---|---|---|
| 仓库 | `name` | `nameWithOwner`（localeCompare） |
| Star | `stars` | `stargazerCount` |
| 更新 | `pushedAt` | 时间戳；`null` 排最后 |

- 默认 `starredAt:desc`（= 当前行为）：`starredAt` 已经存在每个 repo 上（`src/github.js` 的 `fetchStarred` 从 edge 取），不需要新增字段；`state.order` 就是 starredAt 倒序，排序只覆盖渲染。
- 首次点击某列表头：先 desc；再点切换 asc；箭头 ▲▼ 指示。
- 「最近 star」列没有表头，放在工具栏右侧的下拉「排序：最近 star / 最近更新 / star 数 / 名字」作为等价入口（表头和下拉双向同步）。
- 排序只影响渲染顺序，不改 `state.order`、不影响同步。

### 3.4 同步预览（D8）

`planSync()` 的结果已经是 `[{ nameWithOwner, itemId, from, to }]`，直接复用。

点「同步到 GitHub」→ 请求 `{ action: 'plan' }`（新增只读 action，返回 plan 与摘要）→ 弹预览层：

```
将写回 12 个仓库
AI Agent 与技能 ← 8 个        音乐与音频 ← 3 个        移出分类 1 个
▸ owner/repo   AI Agent 与技能 + 音乐与音频
▸ owner/repo2  未归类 → skills
…
[取消]  [写回 12 个仓库]
```

- 只展示摘要 + 前 50 条明细（超出折叠为「还有 N 条」）。
- 确认后走现有 `sync` action；`plan` 为空时不弹层，直接给「没有需要写回的变更」。
- 预览层打开期间，宿主侧若有并发 stage，写回结果可能与预览不一致——**以预览那一刻的 plan 为准**：`sync` action 增加可选 `expectCount`，不一致时返回 409 让用户重看预览（简单、避免写错）。

### 3.5 搜索增强与快捷筛选（D10）

工具栏：搜索框 + 五个可点亮 chip + 语言下拉。

- chip：`有新版本`（`latestRelease.publishedAt` 在 30 天内）、`30 天内更新`（`pushedAt`）、`未归类`（`desired.length === 0`）、`已归档`（`archived`）
- 语言下拉：从当前 `repos` 出现的 `language` 去重排序生成，含「全部语言」
- 与搜索词、左侧分类是 AND 关系；chip 之间也是 AND
- 现有 `only` 单选（archived/stale/pending）被 chip 取代，`suggestFilter` 保留

### 3.6 批量选择（D9）

- `selected: Set<nameWithOwner>` 已存在；补齐「全选/取消全选」按钮，文案带数字：`全选 32` / `取消全选`
- `toggleAll` 只针对当前 `shown`
- 切换分类、改搜索词、改任一 chip/语言 → `setSelected(new Set())`（用 `useEffect` 监听四个依赖）
- Shift 点选：记录 `lastToggledIndex`，Shift 点击时对 `[min, max]` 区间全选（按当前渲染顺序，不是全量顺序）
- 工具栏在选区非空时显示：`已选 3` +「移入分类」下拉 +「取消 star」+「清除选择」

### 3.7 孤儿成员（D5 / D11）

`view()` 里每个 list 已带 `repos`（成员 `nameWithOwner` 数组），与 `repos`（star 集合）比对即可得到孤儿：

```js
orphans: lists.map(list => ({
  id: list.id,
  names: list.repos.filter(name => !state.repos[name]),
}))
```

- 选中某个分类时，若有孤儿，在表格底部渲染折叠区「N 个已不在 star 里的成员」，展开显示灰色行（名字不可点开 GitHub？——可点，链接仍然有效），每行一个「移出」按钮。
- 「移出」→ `{ action: 'removeOrphan', listId, fullName }`：远端 `updateUserListsForItem(itemId, lists - listId)`；本地从 `list.repos` 移除、`count -= 1`。itemId 从哪来？孤儿不在 `repos` 里没有 id —— **所以 `fetchLists` 的 items 查询要加 `id`**（已确认 `items{nodes{... on Repository{id nameWithOwner}}}` 合法，见探针结论 4）。
- 不确认、直接执行、toast「已从 X 移出」。

## 3.8 需要新增/修改的宿主能力

| 位置 | 变化 |
|---|---|
| `src/github.js` | 新增 `removeStar(itemId)`（mutation `removeStar(input:{starrableId})`）、`deleteList(listId)`（mutation `deleteUserList(input:{userListId})`）；`fetchLists()` 的 items 查询补 `id`（现在只有 `nameWithOwner`，孤儿成员移出需要 itemId） |
| `src/store.js` | `state.lists[].itemIds: { [nameWithOwner]: id }`（与 `repos` 名字数组并行，避免把已有的 `repos` 改成对象、减少测试改动）；`view()` 直接计算 `orphans`；新方法 `dropRepo` / `markUnstarred` / `pushChange` / `removeList` / `applyListRemoval` / `removeListMember` |
| `index.js` | job 结构泛化（`kind` 字段），`startJob(kind, tasks)`；新增 action `plan` / `unstar` / `deleteList` / `removeOrphan` |

## 4. 宿主 API 变化（action 表）

| action | 入参 | 返回 | 说明 |
|---|---|---|---|
| `plan` | — | `{ plan, summary }` | 新增，只读，供预览层用 |
| `sync` | `{ expectCount? }` | view + `syncJob` | 增 `expectCount` 不一致返回 409 |
| `unstar` | `{ fullNames }` | view + `job` | 新增，job 类型 `unstar` |
| `deleteList` | `{ listId, mode, targetListId? }` | view + `job` | 新增，job 类型 `deleteList` |
| `removeOrphan` | `{ listId, fullName }` | view | 新增，单条即时 |
| 其余 | — | — | 不变 |

`syncJob` 重命名为通用的 `job`，字段：`{ kind, running, total, done, failed[], startedAt, finishedAt, meta }`。为避免前端旧代码崩，`view()` 里同时保留 `syncJob`（同值），下个版本删。

并发互斥：同一时刻只允许一个 job 运行（`sync` / `unstar` / `deleteList` 共用 `job`）；已有 job 在跑时，其它写操作返回 `busy` 错误（`GitHubError('busy', ...)`），前端禁用按钮并显示当前 job 进度。

## 5. 失败、幂等与限流

- 所有 mutation 都是幂等的（设置归属为全量替换 / star 状态设置），失败可直接重试。
- 每条成功后立即落盘，进程崩了也不会重复写已完成的仓库。
- `deleteList` 的两阶段顺序不可颠倒：**先清成员，再删 list**。删完 list 后剩余成员的归属会变成悬空 id（v0.1 踩过）。
- 批量 100 个 unstar ≈ 100 次 mutation，4 并发下约 25 轮；GitHub 的 GraphQL 限流是点数制，单次 mutation 约 1 点，114 个 star 全删也远低于 5000/小时。

## 6. 测试计划

纯函数（`node:test`，扩 `tests/store.test.js`）：

- `dropRepo` / `markUnstarred` / 消费逻辑：`unstarredAt` 存在 → `unstarred`，不存在或过期 → `gone`
- `removeList` / `applyListRemoval`：成员归属被正确重算，targetListId 的情况
- `orphans`：list.repos 与 repos 的差集；空分类返回空数组
- 排序：`null` 的 `pushedAt` 排最后、稳定排序
- `expectCount` 不匹配时的分支

集成（真机 API，`scripts/roundtrip.py` 扩一段）：

- 建临时分类 → 暂存 3 个仓库 → 预览 → 写回 → 删除分类（mode=unsorted）→ 核对成员归属归零、分类消失
- 对 `octocat/Hello-World` 之类探针仓库：star → 加入分类 → unstar → 核对 list 成员数归零、变更记录是 `unstarred`

UI（Playwright）：

- 排序切换后首行变化、刷新后记忆生效
- 同步预览层出现、取消不写回、确认后进度条跑完
- 全选/Shift 区间/切换分类清空选区
- 孤儿行显示与移出

## 7. 里程碑

| 阶段 | 内容 | 可交付 |
|---|---|---|
| M1 | 数据模型（`unstarredAt`、job 泛化、`plan`/`sync expectCount`）+ 单测 | 后端就绪，无 UI 变化 |
| M2 | 排序 + 快捷筛选 + 批量选择 | 「看得更清楚」，零风险 |
| M3 | 同步预览 + 取消 star + 删分类 + 孤儿 | 本轮主要功能 |
| M4 | 文档（README/DETAIL/HANDOFF）、发版 0.2.0 | 市场可见 |

每个里程碑独立提交、独立验证，出问题可单独回退。

## 8. 明确不做（本版）

- **规则编辑 UI**（D4）：它会把「分类真源在 GitHub」变成「规则在本地」，要先想清楚规则文件的存法与迁移，单独立项。
- 单仓备注/标签：引入第二套真源（本地备注 vs GitHub 分类），容易产生「备注说 A、分类是 B」的困惑。
- 导出 CSV/Markdown、定时自动刷新、list 重命名/排序/颜色：等真实需求。
