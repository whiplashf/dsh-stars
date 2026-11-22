# dsh-stars

DSH 里的 GitHub Star 管理器：把 star 归进 GitHub Lists，并在面板里看到「自上次查看后有什么变了」。

## 它解决什么

GitHub 自带的 stars 页面只能一页页翻，分类要么靠 Lists（没有批量归类），要么靠记忆；官方也不告诉你哪些收藏的仓库发了新版本、哪些归档了。

这个插件做三件事：

1. **看类型**：把 114 个 star 按主题分成六类，并给每个仓库一条归类建议（只建议，不自动写）。
2. **分类查看**：左侧按「全部 / 未归类 / 每个 Lists / 变更」切换，支持搜索、只看归档、只看一年未更新、只看待同步。
3. **跟踪变更**：每次抓取和上一次快照比对，产出新收藏、新版本、新提交、归档、Star 涨跌、取消收藏六种变更，并记「未读数」。

分类结果的**真源是 GitHub Lists**：面板里的归类先暂存在本地，点「同步到 GitHub」才用 GraphQL `updateUserListsForItem` 写回，所以在 GitHub 网页和手机上也看得到同样的分组。

## 安装

插件放在本仓库，安装到 DSH profile：

用 `plugin_manager` 的 `install_bundle` 指向本目录即可（profile 里会写入 `link:` 依赖）。本地目录是软链形式，装完刷新页面就生效，不需要重启 `dsh-web`；左侧栏出现「Star 管理」入口。

写回 GitHub Lists 需要 gh token 带 `user` scope：`gh auth refresh -s user`。只读功能（浏览、建议、变更 diff）不需要。

## 结构

```
index.js          宿主半边：注册 POST /api/dsh-stars，串起抓取/暂存/同步
src/github.js     调 gh CLI 读 Lists/star、写 Lists（GraphQL，不碰 token）
src/store.js      本地快照 + 变更 diff + 待同步暂存 + 同步计划
src/classify.js   归类规则（关键词命中 topics/描述/仓库名）
client.js         浏览器半边：左栏图标 + 整页面板
```

## 数据与接口

- 状态文件：`$DSH_HOME/data/dsh-stars/state.json`（默认 `~/.dsh/data/dsh-stars/state.json`），可用 `config.stateFile` 覆盖。
- 面板只和 `POST /api/dsh-stars` 通信，走 `ctx.connection.fetch`（Owner Peer + Host/Origin 栅栏），浏览器拿不到 GitHub token。
- action：`state` / `refresh` / `stage` / `sync` / `createList` / `markViewed`。
- 依赖 `gh` CLI 已登录（`gh auth status`）；除 `PATH`/`HOME`/`LANG`/`TZ`/`GH_*` 外的环境变量不传给子进程，含 `TOKEN`/`SECRET`/`PASSWORD` 的一律剔除。

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `stateFile` | `$DSH_HOME/data/dsh-stars/state.json` | 状态文件路径 |
| `minRefreshMs` | `600000` | 打开面板时快照超过这个时长才重新抓取 |
| `staleDays` | `365` | 超过多少天没有 push 标为「一年未更新」 |
| `suggestRules` | 内置六类 | 整表替换归类规则，每项 `{ name, keywords }` |

## 已知边界

- 首次抓取只建基线，不会把 100 多个仓库都报成「新收藏」。
- 同步是**替换**语义：写回时用「已归属 − 待移出 ∪ 待加入」的完整列表覆盖，手工在网页上同时改同一个仓库可能被覆盖。
- 变更追踪的粒度是仓库级（release tag、pushedAt、archived、star 数），不是逐 commit 或逐文件。
- 建议归类是关键词规则，不是模型；误判就在面板里改，规则可通过 `suggestRules` 调。
