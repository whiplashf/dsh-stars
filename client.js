/**
 * dsh-stars 浏览器半边：左栏入口 + 整页面板。
 *
 * 页面只和宿主 `POST /api/dsh-stars` 通信（Owner Peer + DSH 认证栅栏），
 * 不接触 GitHub token；所有归类先在本地暂存，确认后才写回 GitHub Lists。
 */
window.__ModuleLoader__.load({
  id: 'dsh-stars',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-stars'
    const PANEL_ID = 'stars'
    const RPC_PATH = '/api/dsh-stars'

    const zh = {
      panel: 'Star 管理',
      title: 'Star 管理',
      subtitle: '把 star 归进 GitHub Lists，并跟踪自上次查看后的变化',
      refresh: '刷新',
      markRead: '标记已读',
      sync: '同步到 GitHub',
      syncing: '同步中…',
      syncProgress: '同步进度',
      unstarProgress: '取消 star 进度',
      deleteListProgress: '删除分类进度',
      organize: 'AI 整理',
      markReadHint: '把「更新」里的未读标成已读；只影响面板，不动 GitHub',
      organizeHint: '让模型按 star 的描述和 topics 建议分类（写回前还要你确认）',
      organizeModeTitle: '怎么整理？',
      organizeModeBody: (n) => `你已经有 ${n} 个分类。基于当前分类整理只会动未归类的仓库；完全重新整理会按 AI 的判断把所有 star 重新排一遍（写回前还要你确认）。`,
      organizeReuse: '基于当前分类整理',
      organizeRebuild: '完全重新整理',
      organizeRunning: 'AI 正在整理…',
      organizeRunningHint: (n) => `正在分析 ${n} 个仓库，通常 10–30 秒，别关面板`,
      organizeResultTitle: (n) => `AI 建议分成 ${n} 个分类`,
      organizeNew: '新建',
      organizeRepos: (n) => `${n} 个仓库`,
      organizeUnsorted: (n) => `保持未归类：${n} 个`,
      organizeApply: '应用到暂存',
      organizeApplied: (n) => `已把 ${n} 个仓库放进暂存，检查无误后点「同步到 GitHub」`,
      organizeEmpty: 'AI 没有给出可用的分类，可以换一种整理方式或手工归类',
      organizeBy: (provider, model) => `由 ${provider} · ${model} 生成`,
      syncDone: '同步完成',
      progressMeta: (done, total, applied, failed) => `${done}/${total} 已处理 · 写回 ${applied}${failed > 0 ? ` · 失败 ${failed}` : ''}`,
      progressCurrent: (name) => `正在写 ${name}`,
      synced: (n) => `已同步 ${n} 个仓库`,
      syncFailed: (n) => `${n} 个仓库同步失败`,
      nothingToSync: '没有待同步的改动',
      all: '全部',
      unsorted: '未归类',
      suggestHint: '建议分类',
      updates: '更新',
      updatesSummary: (total, unread) => unread > 0 ? `共 ${total} 条更新 · ${unread} 条未读` : `共 ${total} 条更新`,
      updatesHint: '只统计你跟踪的仓库：行右侧点 ☆ 跟踪后，它的新版本、新提交、归档、star 涨跌会出现在这里',
      refreshing: '正在刷新…',
      loadingFirst: '正在从 GitHub 读取星标与分类…',
      loadingHint: '第一次打开会慢一些（约 5–10 秒）；之后打开直接用本地快照，秒开。',
      emptyUpdates: '还没有可看的更新。在列表里点行右侧的 ☆ 跟踪某个仓库，之后它的远端变化才会以未读提醒出现在这里。',
      ops: '操作记录',
      opsSummary: (total) => `共 ${total} 条操作记录：收藏、取消收藏、归类、同步、建删分类、AI 整理`,
      opsHint: '只记录你在本插件里做过的事，不含远端仓库的更新；这里没有未读概念',
      emptyOps: '还没有操作记录',
      watch: '跟踪',
      tracked: '跟踪中',
      watchHint: '跟踪这个仓库的远端更新（新版本、新提交、归档、star 涨跌）',
      unwatchHint: '不再跟踪这个仓库的远端更新',
      trackedChip: (n) => `跟踪 ${n} 个`,
      lists: '列表',
      search: '搜索仓库名、描述或 topic',
      only: '筛选',
      onlyAll: '全部',
      onlyArchived: '已归档',
      onlyStale: '超一年未更新',
      onlyPending: '待同步',
      sortBy: '排序',
      sortStarred: '最近 star',
      sortPushed: '最近更新',
      sortStars: 'Star 数',
      sortName: '名字',
      chipNewRelease: '有新版本',
      chipRecent: '30 天内更新',
      chipUnsorted: '未归类',
      chipArchived: '已归档',
      languageAll: '全部语言',
      selectAllPage: (n) => `全选本页 ${n}`,
      clearPage: '取消本页选择',
      pageInfo: (page, total) => `第 ${page} / ${total} 页`,
      prevPage: '上一页',
      nextPage: '下一页',
      perPage: '每页',
      perPageHint: '每页显示多少个仓库',
      clearSelection: '清除选择',
      deleteList: '删除分类',
      unstar: '取消 star',
      remove: '移出',
      deleteTitle: (name) => `删除分类「${name}」`,
      deleteEmptyHint: '这个分类是空的，删除后不可恢复。',
      deleteBusyHint: (n) => `里面有 ${n} 个仓库，先选择它们的去向：`,
      deleteToUnsorted: '只移出这个分类，保留其他归属',
      deleteToMove: '移入另一个分类',
      deleteTarget: '目标分类',
      deleteConfirm: '删除分类',
      unstarTitle: (n) => `取消 star（${n} 个仓库）`,
      unstarHint: '取消后这些仓库会从你的 star 列表和所有分类里消失，本地记录也会移除。',
      unstarRest: (n) => `…等 ${n} 个`,
      unstarConfirm: '取消 star',
      writeBack: (n) => `写回 ${n} 个仓库`,
      planTitle: (n) => `将写回 ${n} 个仓库`,
      planRemoved: (n) => `移出分类 ${n} 个`,
      planMore: (n) => `还有 ${n} 条未展开`,
      planEmpty: '没有需要写回的变更',
      name: '仓库',
      type: '类型',
      stars: 'Star',
      updated: '更新',
      loading: '加载中…',
      empty: '这里还没有仓库',
      emptySearch: '没有匹配的仓库',
      emptyChanges: '自上次查看后没有变化',
      selectAll: '全选',
      selected: (n) => `已选 ${n} 个`,
      selectedOffPage: (n) => ` · 其他页 ${n} 个`,
      addTo: '归入列表…',
      removeFrom: '移出当前列表',
      createList: '新建列表',
      listName: '列表名',
      cancel: '取消',
      create: '创建',
      acceptSuggestion: (name) => `建议：${name}`,
      useSuggestion: '采纳建议',
      acceptAll: (n) => `采纳全部建议 (${n})`,
      accepted: (n, c) => (c > 0 ? `已暂存 ${n} 个仓库的分类建议，新建了 ${c} 个列表，点「同步到 GitHub」写回` : `已暂存 ${n} 个仓库的分类建议，点「同步到 GitHub」写回`),
      archived: '已归档',
      stale: '一年未更新',
      pendingChip: '待同步',
      snapshotAt: '快照',
      never: '尚未同步',
      lastViewed: '上次查看',
      unread: (n) => `${n} 条未读`,
      noViewer: '无法读取 GitHub 账号',
      firstSeen: '收藏于',
      openOnGithub: '在 GitHub 打开列表',
      kinds: {
        new: '新收藏',
        release: '新版本',
        commits: '新提交',
        archived: '归档',
        stars: 'Star 变化',
        gone: '取消收藏',
        unstarred: '取消 star',
      },
      errorPrefix: '操作失败',
      // 首次运行的 gh 检查卡
      authTitle: '先把 gh 连上',
      authNoGh: '这台机器上找不到 gh 命令，装好 GitHub CLI 再回来点「重新检查」。',
      authNotLoggedIn: 'gh 还没登录。在终端里跑下面这行，登录完回来点「重新检查」。',
      authScope: 'gh 已登录，但 token 缺少 user scope。只读浏览和暂存都能用，写回 GitHub 之前要补上这个权限。',
      authUnknown: '读不到 gh 的登录状态，可以照常浏览；写回可能失败。',
      authCommand: '终端命令',
      copy: '复制',
      copied: '已复制',
      recheck: '重新检查',
      syncBlocked: '补上 user scope 后才能同步',
      readOnlyOk: '只读可用',
      authLogin: (who) => `已登录为 ${who}`,
    }

    // 英文表只作为缺键回退：面板本身不做语言切换（这个市场里中文 UI 是常态）。
    const en = {
      panel: 'Star manager',
      title: 'Star manager',
      subtitle: 'File stars into GitHub Lists and track what changed since last visit',
      refresh: 'Refresh',
      markRead: 'Mark seen',
      sync: 'Sync to GitHub',
      syncing: 'Syncing…',
      syncProgress: 'Sync progress',
      syncDone: 'Sync finished',
      progressMeta: (done, total, applied, failed) => `${done}/${total} processed · ${applied} written${failed > 0 ? ` · ${failed} failed` : ''}`,
      organize: 'AI organize',
      markReadHint: 'Mark the updates feed as read; local only, GitHub untouched',
      organizeHint: 'Let the model suggest lists from descriptions and topics',
      organizeModeTitle: 'How should it organize?',
      organizeModeBody: (n) => `You already have ${n} lists. Use them reclassifies only unsorted repos; rebuild rewrites every star.`,
      organizeReuse: 'Use my lists',
      organizeRebuild: 'Rebuild from scratch',
      organizeRunning: 'AI is organizing…',
      organizeRunningHint: (n) => `Analyzing ${n} repositories, usually 10-30s`,
      organizeResultTitle: (n) => `AI suggests ${n} lists`,
      organizeNew: 'new',
      organizeRepos: (n) => `${n} repos`,
      organizeUnsorted: (n) => `Keep unsorted: ${n}`,
      organizeApply: 'Stage these',
      organizeApplied: (n) => `Staged ${n} repositories — review, then sync to GitHub`,
      organizeEmpty: 'The model returned no usable groups',
      organizeBy: (provider, model) => `by ${provider} · ${model}`,
      progressCurrent: (name) => `Writing ${name}`,
      synced: (n) => `Synced ${n} repositories`,
      syncFailed: (n) => `${n} repositories failed`,
      nothingToSync: 'Nothing to sync',
      all: 'All',
      unsorted: 'Unsorted',
      suggestHint: 'By suggestion',
      updates: 'Updates',
      updatesSummary: (total, unread) => unread > 0 ? `${total} updates · ${unread} unread` : `${total} updates`,
      updatesHint: 'Only repos you track: hit ☆ on a row to follow its releases, commits, archive state and star moves.',
      refreshing: 'Refreshing…',
      loadingFirst: 'Reading your stars and lists from GitHub…',
      loadingHint: 'The first open takes a few seconds; later opens use the local snapshot and render instantly.',
      emptyUpdates: 'Nothing to show yet. Hit ☆ on a row to track a repository.',
      ops: 'Activity',
      opsSummary: (total) => `${total} entries: starring, unstarring, sorting, syncing, list changes, AI organize`,
      opsHint: 'Only what you did in this panel; remote repo updates never land here',
      emptyOps: 'No activity yet',
      watch: 'Track',
      tracked: 'Tracking',
      watchHint: 'Track this repo: releases, commits, archive state, star moves',
      unwatchHint: 'Stop tracking this repo',
      trackedChip: (n) => `Tracking ${n}`,
      lists: 'Lists',
      search: 'Search name, description or topic',
      only: 'Filter',
      onlyAll: 'All',
      onlyArchived: 'Archived',
      onlyStale: 'Stale over a year',
      onlyPending: 'Pending',
      name: 'Repository',
      type: 'Type',
      stars: 'Stars',
      updated: 'Updated',
      loading: 'Loading…',
      empty: 'No repositories here',
      emptySearch: 'No matching repositories',
      emptyChanges: 'Nothing changed since your last visit',
      selectAll: 'Select all',
      selected: (n) => `${n} selected`,
      selectedOffPage: (n) => ` · ${n} on other pages`,
      selectAllPage: (n) => `Select this page (${n})`,
      clearPage: 'Clear page selection',
      pageInfo: (page, total) => `Page ${page} / ${total}`,
      prevPage: 'Previous',
      nextPage: 'Next',
      perPage: 'Per page',
      perPageHint: 'How many repositories to show per page',
      addTo: 'Add to list…',
      removeFrom: 'Remove from list',
      createList: 'New list',
      listName: 'List name',
      cancel: 'Cancel',
      create: 'Create',
      acceptSuggestion: (name) => `Suggested: ${name}`,
      useSuggestion: 'Apply suggestion',
      archived: 'Archived',
      stale: 'No push for a year',
      pendingChip: 'Pending',
      snapshotAt: 'Snapshot',
      never: 'Never refreshed',
      lastViewed: 'Last seen',
      unread: (n) => `${n} unread`,
      noViewer: 'GitHub account unavailable',
      firstSeen: 'Starred',
      openOnGithub: 'Open lists on GitHub',
      kinds: {
        new: 'New star',
        release: 'Release',
        commits: 'Commits',
        archived: 'Archived',
        stars: 'Star count',
        gone: 'Unstarred',
        unstarred: 'Unstarred',
        assign: 'Sorted',
        remove: 'Removed',
        sync: 'Synced',
        createList: 'New list',
        deleteList: 'List deleted',
        organize: 'AI organize',
      },
      errorPrefix: 'Failed',
    }

    const CSS = `
.stars-root{container:stars-panel / inline-size;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}
.stars-head{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.stars-headtext{display:flex;flex-direction:column;gap:2px;min-width:0}
.stars-title{font-size:15px;font-weight:600;letter-spacing:.01em}
.stars-meta{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center}
.stars-grow{flex:1}
.stars-btn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;white-space:nowrap}
.stars-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.stars-btn:disabled{opacity:.5;cursor:default}
.stars-btn[data-kind=danger]{background:var(--dsw-alias-state-error-primary);border-color:transparent;color:var(--dsw-alias-bg-layer-1)}
/* 主按钮：用 label-primary 当底色、layer-1 当字色，亮/暗两套主题都能读（brand-primary 是前景色，暗色主题下接近白色，当底色会把白字吃掉）。 */
.stars-btn[data-kind=primary]{background:var(--dsw-alias-label-primary);border-color:transparent;color:var(--dsw-alias-bg-layer-1);font-weight:600}
.stars-btn[data-kind=ai]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1);font-weight:600}
.stars-btn[data-kind=primary]:hover:not(:disabled){filter:brightness(1.12);color:var(--dsw-alias-bg-layer-1)}
.stars-body{display:flex;flex:1;min-height:0}
.stars-rail{width:200px;flex:none;border-right:1px solid var(--dsw-alias-border-l1);padding:10px 8px;overflow:auto}
.stars-railgroup{margin:10px 0 4px;padding:0 10px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-caption)}
.stars-railitem{border:0;background:transparent;font:inherit;text-align:left;width:100%;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:var(--dsw-radius-sm);cursor:pointer;color:var(--dsw-alias-label-secondary);user-select:none}
.stars-railitem:hover{background:var(--dsw-alias-interactive-bg-hover)}
.stars-railitem[data-active=true]{background:var(--dsw-alias-card-fill-hover);color:var(--dsw-alias-label-primary);font-weight:600}
.stars-railcount{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.stars-main{flex:1;min-width:0;display:flex;flex-direction:column}
.stars-toolbar{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap}
.stars-input{height:28px;min-width:220px;flex:1;max-width:340px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;outline:none}
.stars-input:focus{border-color:var(--dsw-alias-brand-primary)}
.stars-select{height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px}
.stars-selinfo{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.stars-scroll{flex:1;overflow:auto;min-height:0}
.stars-table{width:100%;border-collapse:collapse}
.stars-table th{position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-base);text-align:left;font-weight:500;font-size:11px;letter-spacing:.04em;color:var(--dsw-alias-label-caption);padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}
.stars-table td{padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top}
.stars-row { cursor: pointer; }
.stars-row:hover td{background:var(--dsw-alias-card-fill)}
.stars-repo{display:flex;flex-direction:column;gap:3px;min-width:0}
.stars-repolink{color:var(--dsw-alias-label-primary);font-weight:600;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stars-repolink:hover{color:var(--dsw-alias-brand-primary);text-decoration:underline}
.stars-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:52ch}
.stars-topics{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}
.stars-topic{font-size:11px;padding:1px 6px;border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
.stars-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap;max-width:22ch;overflow:hidden;text-overflow:ellipsis}
.stars-chip[data-tone=warn]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary)}
.stars-chip[data-tone=error]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);color:var(--dsw-alias-state-error-primary)}
.stars-chip[data-tone=brand]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}
.stars-chips{display:flex;flex-wrap:wrap;gap:4px}
.stars-num{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.stars-dim{color:var(--dsw-alias-label-tertiary);font-size:12px;white-space:nowrap}
.stars-loading{display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 16px}
.stars-loadingdot{width:10px;height:10px;border-radius:50%;background:var(--dsw-alias-link);animation:stars-pulse 1.1s ease-in-out infinite}
.stars-loadingtext{font-size:13px;color:var(--dsw-alias-label-primary)}
.stars-loadinghint{font-size:12px;color:var(--dsw-alias-label-tertiary)}
@keyframes stars-pulse{0%,100%{opacity:.25;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
.stars-empty{display:flex;align-items:center;justify-content:center;height:200px;color:var(--dsw-alias-label-tertiary);font-size:13px}
.stars-banner{margin:12px 16px 0;padding:8px 12px;border-radius:var(--dsw-radius-sm);font-size:12px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary);display:flex;gap:8px;align-items:center}
.stars-banner[data-tone=ok]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);color:var(--dsw-alias-state-success-primary)}
.stars-suggest{margin-top:4px}
.stars-suggestbtn{border:1px dashed color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent);background:transparent;color:var(--dsw-alias-brand-primary);font-size:11px;padding:2px 8px;border-radius:999px;cursor:pointer}
.stars-suggestbtn:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.stars-changes{padding:14px 20px;display:flex;flex-direction:column;gap:6px;overflow:auto}
.stars-change{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-card-fill)}
.stars-changedate{font-size:11px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;min-width:62px}
.stars-dialogbox::backdrop{background:rgba(0,0,0,.38)}
.stars-chipbtn{font-size:11px;padding:2px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap}
.stars-chipbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.stars-chipbtn[data-active=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.stars-sortth{cursor:pointer;user-select:none;white-space:nowrap}
.stars-sortth:hover{color:var(--dsw-alias-label-primary)}
.stars-sortmark{margin-left:4px;font-size:9px;color:var(--dsw-alias-brand-primary)}
.stars-rowmeta{display:flex;align-items:center;gap:8px;justify-content:space-between}
.stars-rowact{font-size:11px;padding:1px 6px;border-radius:var(--dsw-radius-sm);border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.stars-rowact:hover{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-border-l1)}
.stars-plansummary{display:flex;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6}
.stars-planlist{max-height:240px;overflow:auto;display:flex;flex-direction:column;gap:4px;font-size:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);padding:8px;background:var(--dsw-alias-bg-layer-1)}
.stars-planrow{display:flex;gap:8px;justify-content:space-between;align-items:baseline;flex-wrap:wrap}
.stars-planrow>.stars-repolist{flex-basis:100%;color:var(--dsw-alias-label-secondary);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stars-radio{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.stars-orphans{border-top:1px solid var(--dsw-alias-border-l1);padding:6px 16px;flex:none}
.stars-orphantoggle{font-size:11px;color:var(--dsw-alias-label-tertiary);background:transparent;border:0;cursor:pointer;padding:0}
.stars-orphantoggle:hover{color:var(--dsw-alias-label-primary)}
.stars-orphanrow{display:flex;align-items:center;justify-content:space-between;font-size:12px;padding:3px 0;opacity:.75}
.stars-dialogbox{box-sizing:border-box;margin:auto;max-width:calc(100vw - 24px);max-height:85dvh;color:var(--dsw-alias-label-primary);overflow:auto;width:420px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);padding:16px;display:flex;flex-direction:column;gap:10px}
.stars-dialogbox[data-wide=true]{width:580px}
.stars-reviewlist{list-style:none;margin:0;padding:0;max-height:48dvh;overflow:auto;border-block:1px solid var(--dsw-alias-border-l1)}
.stars-reviewitem{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 12px;padding:9px 2px;align-items:center}
.stars-reviewitem+.stars-reviewitem{border-top:1px solid var(--dsw-alias-border-l1)}
.stars-reviewname{font-weight:600;overflow-wrap:anywhere}
.stars-reviewpath{grid-column:1;font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.stars-reviewpath[data-clear=true]{color:var(--dsw-alias-state-warn-primary)}
.stars-reviewitem button{grid-column:2;grid-row:1 / span 2}
.stars-reviewmore{align-self:flex-start}
.stars-dialogbox :focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:2px}
.stars-dialogtitle{font-size:14px;font-weight:600}
.stars-dialogactions{display:flex;justify-content:flex-end;gap:8px}
.stars-cb{width:14px;height:14px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.stars-dist{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:8px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.stars-distlabel{font-size:11px;color:var(--dsw-alias-label-caption);letter-spacing:.04em}
.stars-distchip{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:2px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer}
.stars-distchip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.stars-distchip[data-active=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.stars-distcount{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}
.stars-pager{display:flex;align-items:center;gap:10px;padding:8px 16px;border-top:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap}
.stars-pagesize{height:24px;font-size:12px;padding:0 4px}
.stars-pagebtn{height:24px;font-size:12px}
.stars-selinfo{display:inline-flex;align-items:center;gap:6px}
.stars-foot{padding:6px 16px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-caption);display:flex;gap:12px;flex:none;flex-wrap:wrap}
.stars-auth{margin:12px 16px 0;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-left:3px solid var(--dsw-alias-state-warn-primary);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:8px;font-size:12px}
.stars-authtitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.stars-authbody{color:var(--dsw-alias-label-secondary);line-height:1.6}
.stars-authcmd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.stars-authcmd code{font-family:var(--dsw-font-family-mono,ui-monospace,monospace);font-size:12px;padding:5px 8px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);user-select:all}
.stars-authrow{display:flex;align-items:center;gap:8px}
.stars-progress{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}
.stars-progresslabel{font-weight:600;white-space:nowrap}
.stars-progresstrack{position:relative;height:6px;flex:1;min-width:120px;max-width:520px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.stars-progressfill{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width .25s ease}
.stars-progressfill[data-done=true]{background:var(--dsw-alias-state-success-primary)}
.stars-progressmeta{font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}
.stars-progresscurrent{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;margin-left:auto}
.stars-progresspct{font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;min-width:34px;text-align:right}
/* 分类色板：固定色值，亮/暗主题都能看清；同一个分类名永远拿同一个颜色。 */
.stars-root{--stars-c1:#5b8def;--stars-c2:#2f9e6a;--stars-c3:#d1932f;--stars-c4:#a76bd6;--stars-c5:#cf5c74;--stars-c6:#3aa0b5}
.stars-dot{width:7px;height:7px;border-radius:50%;background:var(--stars-c,var(--dsw-alias-label-caption));flex:none;display:inline-block}
.stars-headicon{color:var(--dsw-alias-state-warn-primary);flex:none}
.stars-title{font-size:16px}
.stars-metasep{color:var(--dsw-alias-label-caption);margin:0 6px}
.stars-unreadchip{border:0;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;cursor:pointer;background:color-mix(in srgb,var(--dsw-alias-link) 14%,transparent);color:var(--dsw-alias-link);margin-left:6px}
.stars-unreadchip:hover{background:color-mix(in srgb,var(--dsw-alias-link) 22%,transparent)}
.stars-railicon{width:14px;flex:none;text-align:center;font-size:11px;color:var(--dsw-alias-label-caption)}
.stars-railitem[data-active=true] .stars-railicon{color:var(--dsw-alias-link)}
.stars-railcount[data-tone=unread]{background:var(--dsw-alias-link);color:var(--dsw-alias-bg-layer-1);border-radius:999px;padding:0 6px;font-weight:600}
.stars-repolink{color:var(--dsw-alias-link)}
/* 链接只包住文字本身：flex 列布局下默认会被拉满整行，导致点仓库名右边的空白也跳走。 */
.stars-repo>.stars-repolink{align-self:flex-start;max-width:100%}
.stars-repolink:hover{color:var(--dsw-alias-link);text-decoration:underline}
.stars-row[data-selected=true] td{background:color-mix(in srgb,var(--dsw-alias-link) 7%,transparent)}
.stars-num{color:var(--dsw-alias-label-secondary)}
.stars-stars{color:var(--dsw-alias-state-warn-primary);font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.stars-chip[data-color]{background:color-mix(in srgb,var(--stars-c) 15%,transparent);color:var(--dsw-alias-label-secondary)}

.stars-chip[data-tone=brand]{background:color-mix(in srgb,var(--dsw-alias-link) 14%,transparent);color:var(--dsw-alias-link)}
.stars-upd{text-align:right;white-space:nowrap;width:130px;position:relative}
.stars-hoveracts{position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;gap:6px;opacity:0;pointer-events:none;background:var(--dsw-alias-bg-layer-1);box-shadow:0 0 0 6px var(--dsw-alias-bg-layer-1);border-radius:8px}
.stars-row:hover .stars-hoveracts,.stars-row:focus-within .stars-hoveracts{opacity:1;pointer-events:auto}
.stars-sortth.stars-upd{text-align:right}
.stars-change[data-kind=new] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}
.stars-change[data-kind=release] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-link) 14%,transparent);color:var(--dsw-alias-link)}
.stars-change[data-kind=commits] .stars-chip{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.stars-change[data-kind=stars] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary)}
.stars-change[data-kind=archived] .stars-chip,.stars-change[data-kind=gone] .stars-chip,.stars-change[data-kind=unstarred] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);color:var(--dsw-alias-state-error-primary)}
.stars-change:hover{background:var(--dsw-alias-card-fill-hover)}
.stars-changesum{margin:0 0 6px;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.stars-emptyhint{display:flex;flex-direction:column;align-items:center;gap:6px;height:220px;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center;padding:0 24px;line-height:1.7}
.stars-progressfill{background:var(--dsw-alias-link)}
.stars-track[data-on=true]{color:var(--dsw-alias-link)}
.stars-track[data-on=true]:hover{color:var(--dsw-alias-link)}
.stars-change[data-kind=assign] .stars-chip,.stars-change[data-kind=sync] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-link) 14%,transparent);color:var(--dsw-alias-link)}
.stars-change[data-kind=remove] .stars-chip,.stars-change[data-kind=deleteList] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary)}
.stars-change[data-kind=organize] .stars-chip,.stars-change[data-kind=createList] .stars-chip{background:color-mix(in srgb,var(--stars-c4) 18%,transparent);color:var(--stars-c4)}
.stars-pagechecklabel{display:none}
.stars-sortbutton{font:inherit;color:inherit;border:0;background:transparent;padding:0;cursor:pointer}
.stars-repotitle{display:flex;align-items:baseline;gap:8px;max-width:100%}
.stars-railitemlabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stars-detailbtn{flex:none;padding:0 3px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer}
.stars-detailbtn:hover,.stars-detailbtn:focus-visible{color:var(--dsw-alias-link);text-decoration:underline}
.stars-dialogbox[data-drawer=true]{inset:0 0 0 auto;margin:0;width:min(450px,100vw);max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;border-width:0 0 0 1px;padding:24px;gap:20px}
.stars-detailhead{display:flex;align-items:flex-start;gap:12px;justify-content:space-between}
.stars-detailhead>div{min-width:0}
.stars-detailhead h2{font-size:19px;line-height:1.35;overflow-wrap:anywhere;margin:0 0 4px}
.stars-detailhead .stars-btn{flex:none}
.stars-detailsection{display:grid;gap:6px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:14px;overflow-wrap:anywhere}
.stars-detailsection h3{font-size:13px;margin:0}
.stars-detailsection p,.stars-detailbody{margin:0;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
.stars-detailfacts{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:5px 16px;margin:0}
.stars-detailfacts dt{color:var(--dsw-alias-label-tertiary)}
.stars-detailfacts dd{margin:0;overflow-wrap:anywhere}
.stars-notes{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;font:inherit;color:var(--dsw-alias-label-secondary)}
.stars-detailsection .stars-btn,.stars-detailsection a{justify-self:start}
.stars-viewform{display:grid;gap:12px}
.stars-viewform label{display:grid;gap:5px}
.stars-viewform .stars-input{box-sizing:border-box;width:100%;min-width:0;max-width:none}
.stars-viewform .stars-dialogactions{flex-wrap:wrap}
.stars-viewform .stars-deleteview{margin-right:auto}
.stars-reviewremote{grid-column:1/-1;color:var(--dsw-alias-link);font-size:11px;overflow-wrap:anywhere}
@container stars-panel (max-width: 700px) {
  .stars-head{flex-wrap:wrap;gap:6px 8px;padding:10px 12px}
  .stars-headtext{flex:1 1 calc(100% - 38px)}
  .stars-grow{display:none}
  .stars-body{flex-direction:column}
  .stars-main{min-height:0}
  .stars-rail{display:flex;align-items:center;gap:3px;width:auto;padding:5px 10px;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1);overflow-x:auto}
  .stars-railitem{flex:none;width:auto;white-space:nowrap;padding:5px 8px}
  .stars-railgroup{flex:none;margin:0;padding:0 6px}
  .stars-toolbar,.stars-dist,.stars-pager,.stars-foot{padding-inline:12px}
  .stars-dist{flex-wrap:nowrap;overflow-x:auto}
  .stars-dist>*{flex:none}
  .stars-change{flex-wrap:wrap}
}
@container stars-panel (max-width: 560px) {
  .stars-toolbar{gap:5px;padding-block:7px}
  .stars-toolbar .stars-input{box-sizing:border-box;max-width:none;min-width:0;flex-basis:100%}
  .stars-table,.stars-table tbody,.stars-table thead,.stars-table thead tr{display:block}
  .stars-table thead{position:sticky;top:0;z-index:1}
  .stars-table th{display:none}
  .stars-table th:first-child{display:block;width:auto!important;padding:5px 12px}
  .stars-pagechecklabel{display:inline;margin-left:6px}
  .stars-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:start;gap:4px 6px;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
  .stars-row td{padding:0;border:0;min-width:0}
  .stars-row[data-selected=true]{background:color-mix(in srgb,var(--dsw-alias-link) 7%,transparent)}
  .stars-row[data-selected=true] td{background:transparent}
  .stars-row td:first-child{grid-column:1;grid-row:1 / span 3}
  .stars-row td:nth-child(2),.stars-row td:nth-child(3){grid-column:2 / -1}
  .stars-row td:nth-child(4){grid-column:2;align-self:center}
  .stars-row .stars-upd{width:auto;display:flex;align-items:center;gap:6px}
  .stars-hoveracts{position:static;transform:none;opacity:1;pointer-events:auto;background:transparent;box-shadow:none}
  .stars-rowact{min-height:28px}
  .stars-detailbtn{min-height:28px}
  .stars-dialogbox[data-drawer=true]{padding:16px;gap:14px}
}

`

    // 面板挂在侧栏里，用户点进来之前先跟宿主热一次：/api 路由、插件实例、本地快照
    // 都在这一下里就绪，点开时直接拿这次的结果渲染首屏（省掉 1–2 秒冷启动）。
    let warmState = null
    let warmInFlight = null
    let warmAt = 0
    function warmUp() {
      if (!warmInFlight) {
        warmInFlight = rpc({ action: 'state' })
          .then((value) => {
            if (Array.isArray(value?.repos)) {
              warmState = value
              warmAt = Date.now()
            }
          })
          .catch(() => {})
      }
      return warmInFlight
    }

    function ensureCss() {
      const tag = 'style[data-plugin-css="dsh-stars"]'
      if (typeof document === 'undefined' || document.querySelector(tag)) return
      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-stars'
      style.dataset.pluginCss = 'dsh-stars'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    async function rpc(payload, signal) {
      const response = await fetch(RPC_PATH, {
        method: 'POST',
        credentials: 'include',
        signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok || !body?.ok) {
        const error = new Error(body?.message ?? `HTTP ${response.status}`)
        error.code = body?.code ?? 'http'
        error.reason = body?.reason
        throw error
      }
      return body.value
    }

    function formatDate(value) {
      if (!value) return '—'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return '—'
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    function relative(value) {
      if (!value) return '—'
      const ms = Date.now() - Date.parse(value)
      if (!Number.isFinite(ms)) return '—'
      const days = Math.floor(ms / 86_400_000)
      if (days <= 0) return '今天'
      if (days < 30) return `${days} 天前`
      if (days < 365) return `${Math.floor(days / 30)} 个月前`
      return `${Math.floor(days / 365)} 年前`
    }

    /** 排序偏好记在 localStorage：刷新页面后保持用户选的那一列。 */
    const SORT_KEY = 'dsh-stars.sort'
    const SORT_FIELDS = new Set(['starred', 'pushedAt', 'stars', 'name'])
    const DEFAULT_SORT = { key: 'starred', dir: 'desc' }
    const chipLabels = { newRelease: zh.chipNewRelease, recent: zh.chipRecent, unsorted: zh.chipUnsorted, archived: zh.chipArchived }
    const sortLabels = {
      'starred:desc': zh.sortStarred, 'pushedAt:desc': zh.sortPushed, 'stars:desc': zh.sortStars, 'name:asc': zh.sortName,
      'starred:asc': '最早 star', 'pushedAt:asc': '最早更新', 'stars:asc': 'Star 数从少到多', 'name:desc': '名字从 Z 到 A',
    }

    const PAGE_KEY = 'dsh-stars.pageSize'
    const PAGE_SIZES = [30, 50, 100, 200]
    const DEFAULT_PAGE_SIZE = 30

    function readPageSize() {
      try {
        const value = Number(window.localStorage?.getItem(PAGE_KEY))
        return PAGE_SIZES.includes(value) ? value : DEFAULT_PAGE_SIZE
      } catch {
        return DEFAULT_PAGE_SIZE
      }
    }

    function writePageSize(value) {
      try {
        window.localStorage?.setItem(PAGE_KEY, String(value))
      } catch {
        // 读不到 localStorage 就只在内存里生效
      }
    }

    function readSort() {
      try {
        const [key, dir] = String(window.localStorage.getItem(SORT_KEY) ?? '').split(':')
        if (SORT_FIELDS.has(key) && (dir === 'asc' || dir === 'desc')) return { key, dir }
      } catch {
        // 隐私模式 / 存储被禁：退回默认排序，不影响功能。
      }
      return DEFAULT_SORT
    }

    function writeSort(sort) {
      try {
        window.localStorage.setItem(SORT_KEY, `${sort.key}:${sort.dir}`)
      } catch {
        // 同上，写不进去也不影响本次会话。
      }
    }

    /** 名字 → 一个稳定颜色，同一个分类/语言每次都用同一种，扫视时能靠颜色分辨。 */
    const PALETTE = ['var(--stars-c1)', 'var(--stars-c2)', 'var(--stars-c3)', 'var(--stars-c4)', 'var(--stars-c5)', 'var(--stars-c6)']

    function colorOf(name) {
      const text = String(name ?? '')
      let hash = 0
      for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 100003
      return PALETTE[hash % PALETTE.length]
    }

    function sortValue(repo, key) {
      if (key === 'name') return repo.nameWithOwner ?? ''
      if (key === 'stars') return repo.stars ?? 0
      if (key === 'pushedAt') return repo.pushedAt ? Date.parse(repo.pushedAt) : null
      return repo.starredAt ? Date.parse(repo.starredAt) : null
    }

    function sortRepos(list, sort) {
      const dir = sort.dir === 'asc' ? 1 : -1
      return [...list].sort((a, b) => {
        const left = sortValue(a, sort.key)
        const right = sortValue(b, sort.key)
        // 没有值的行（比如从未推送过的仓库）永远排在最后，不受升降序影响。
        if (left === null && right === null) return 0
        if (left === null) return 1
        if (right === null) return -1
        if (sort.key === 'name') return String(left).localeCompare(String(right)) * dir
        return (left - right) * dir
      })
    }

    function failedTone(job) {
      return job && (job.failed?.length ?? 0) > 0 ? 'error' : 'ok'
    }

    /** 作业结束的提示语：按 kind 说人话，失败时把第一条原因带上。 */
    function jobNotice(job) {
      if (!job) return '没有待办'
      const failed = job.failed?.length ?? 0
      if (job.kind === 'unstar') return failed > 0 ? `${failed} 个仓库没能取消 star：${job.failed[0]?.message ?? ''}` : `已取消 star ${job.applied} 个`
      if (job.kind === 'deleteList') {
        if (job.meta?.deleted) return `已删除分类「${job.meta.listName}」`
        if (job.error) return `分类已保留。${job.error.message}`
        return `还有 ${failed} 个仓库没搬完，分类未删除`
      }
      if (failed > 0) return `${failed} 个仓库同步失败：${job.failed[0]?.message ?? ''}`
      return job.applied > 0 ? `已同步 ${job.applied} 个仓库` : '没有待同步的改动'
    }

    function StarIcon({ size = 16 }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
        'aria-hidden': 'true',
      }, h('path', { d: 'M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z' }))
    }

    function Dialog({ children, label, wide, drawer, onClose }) {
      const ref = React.useRef(null)
      React.useLayoutEffect(() => {
        const dialog = ref.current
        const opener = document.activeElement
        dialog.showModal()
        return () => {
          dialog.close()
          if (opener?.isConnected && !dialog.contains(opener)) opener.focus({ preventScroll: true })
        }
      }, [])
      return h('dialog', {
        ref, className: 'stars-dialogbox', 'data-wide': wide, 'data-drawer': drawer, 'aria-label': label,
        onCancel: (event) => { event.preventDefault(); onClose() },
        onClick: (event) => {
          if (event.target !== ref.current) return
          const box = ref.current.getBoundingClientRect()
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
        },
      }, children)
    }

    function ViewEditor({ view, summary, busy, error, onSave, onDelete, onClose }) {
      const [name, setName] = React.useState(view?.name ?? '')
      const [copy, setCopy] = React.useState(false)
      const [deleting, setDeleting] = React.useState(false)
      const editing = Boolean(view && !copy)
      if (deleting) return h(React.Fragment, null,
        h('div', { className: 'stars-dialogtitle' }, `删除视图「${view.name}」？`),
        h('div', { className: 'stars-plansummary' }, '收藏的仓库和 GitHub 列表会保留。'),
        error && h('div', { role: 'alert' }, error),
        h('div', { className: 'stars-dialogactions' },
          h('button', { className: 'stars-btn', onClick: () => setDeleting(false) }, '返回'),
          h('button', { className: 'stars-btn', 'data-kind': 'danger', disabled: busy, onClick: onDelete }, '确认删除视图')))
      return h('form', { className: 'stars-viewform', onSubmit: (event) => {
        event.preventDefault()
        if (!busy && name.trim()) onSave(name.trim(), editing)
      } },
        h('div', { className: 'stars-dialogtitle' }, editing ? '编辑视图' : '保存当前视图'),
        h('label', null, '视图名称', h('input', { className: 'stars-input', autoFocus: true, maxLength: 60,
          required: true, value: name, onChange: (event) => setName(event.target.value) })),
        h('div', { className: 'stars-plansummary' }, summary),
        error && h('div', { role: 'alert' }, error),
        h('div', { className: 'stars-dialogactions' },
          editing && h('button', { type: 'button', className: 'stars-btn stars-deleteview', disabled: busy, onClick: () => setDeleting(true) }, '删除视图'),
          editing && h('button', { type: 'button', className: 'stars-btn', disabled: busy, onClick: () => { setCopy(true); setName('') } }, '另存为'),
          h('button', { type: 'button', className: 'stars-btn', onClick: onClose }, '取消'),
          h('button', { className: 'stars-btn', 'data-kind': 'primary', disabled: !name.trim() || busy }, editing ? '更新视图' : '保存视图')))
    }

    function ReleaseNotes({ repo, viewer }) {
      const [attempt, setAttempt] = React.useState(0)
      const [notes, setNotes] = React.useState(null)
      const [error, setError] = React.useState(null)
      const tag = repo.latestRelease.tagName
      React.useEffect(() => {
        if (!attempt) return
        const controller = new AbortController()
        rpc({ action: 'releaseNotes', viewer, fullName: repo.nameWithOwner, tag }, controller.signal)
          .then((value) => { if (!controller.signal.aborted) setNotes(value) })
          .catch((cause) => { if (!controller.signal.aborted) setError(cause.message) })
        return () => controller.abort()
      }, [attempt, viewer, repo.nameWithOwner, tag])
      const loading = attempt > 0 && !error && !notes
      return h('section', { className: 'stars-detailsection' },
        h('h3', null, '最新版本'),
        h('a', { className: 'stars-repolink', href: notes?.url ?? `${repo.url}/releases/tag/${encodeURIComponent(tag)}`, target: '_blank', rel: 'noreferrer' }, tag),
        repo.latestRelease.publishedAt && h('span', { className: 'stars-dim' }, formatDate(repo.latestRelease.publishedAt)),
        notes ? h(React.Fragment, null,
          notes.name && notes.name !== tag && h('strong', null, notes.name),
          h('p', { className: 'stars-notes' }, notes.description || '这个版本没有填写发布说明。'),
          notes.truncated && h('a', { className: 'stars-repolink', href: notes.url, target: '_blank', rel: 'noreferrer' }, '在 GitHub 阅读完整说明'))
          : h(React.Fragment, null, error && h('p', { role: 'alert' }, error),
            h('button', { className: 'stars-btn', disabled: loading,
              onClick: () => { setError(null); setAttempt((n) => n + 1) } }, loading ? '正在读取发布说明…' : error ? '重试发布说明' : '查看发布说明')))
    }

    function RepoDetail({ repo, viewer, lists, suggestion, onClose }) {
      const labels = (ids) => ids.map((id) => lists.find((list) => list.id === id)?.name ?? id).join('、')
      const from = repo.lists ?? []
      const to = repo.desired ?? from
      const added = to.filter((id) => !from.includes(id))
      const removed = from.filter((id) => !to.includes(id))
      const facts = [['收藏于', formatDate(repo.starredAt)], ['最近推送', formatDate(repo.pushedAt)],
        ['Star 数', (repo.stars ?? 0).toLocaleString()], ['主要语言', repo.language ?? '—']]
      return h(Dialog, { label: '仓库详情', drawer: true, onClose },
        h('div', { className: 'stars-detailhead' },
          h('div', null, h('h2', null, repo.nameWithOwner),
            h('a', { className: 'stars-repolink', href: repo.url, target: '_blank', rel: 'noreferrer' }, '在 GitHub 打开仓库')),
          h('button', { className: 'stars-btn', onClick: onClose }, '关闭')),
        repo.description && h('p', { className: 'stars-detailbody' }, repo.description),
        h('dl', { className: 'stars-detailfacts' }, facts.map(([key, value]) => h(React.Fragment, { key }, h('dt', null, key), h('dd', null, value)))),
        repo.topics?.length > 0 && h('div', { className: 'stars-topics' }, repo.topics.map((topic) => h('span', { className: 'stars-topic', key: topic }, topic))),
        h('section', { className: 'stars-detailsection' },
          h('h3', null, '分类归属'), h('p', null, `当前分类 · ${labels(from) || '未归类'}`),
          added.length > 0 && h('p', null, `待加入 · ${labels(added)}`),
          removed.length > 0 && h('p', null, `待移出 · ${labels(removed)}`),
          suggestion && h('p', null, `命中关键词「${suggestion.keyword}」，建议归入「${suggestion.list}」。`)),
        repo.latestRelease?.tagName ? h(ReleaseNotes, { key: repo.latestRelease.tagName, repo, viewer })
          : h('section', { className: 'stars-detailsection' }, h('h3', null, '最新版本'), h('p', null, '暂无已发布的版本。')))
    }

    function SyncPreview({ preview, lists, disabled, canWrite, checkingRemote, onDiscard, onConfirm, onClose }) {
      const [limit, setLimit] = React.useState(50)
      const names = new Map(lists.map((list) => [list.id, list.name]))
      const labels = (ids) => ids.map((id) => names.get(id) ?? id).join('、') || '未归类'
      const clearCount = preview.plan.filter((entry) => entry.to.length === 0).length
      const message = checkingRemote ? '正在核对 GitHub 上的分类和收藏状态…' : preview.message
      return h(React.Fragment, null,
        h('div', { className: 'stars-dialogtitle' }, zh.planTitle(preview.plan.length)),
        h('div', { className: 'stars-plansummary' },
          h('span', null, `GitHub · @${preview.viewer}`),
          ...preview.summary.added.map(({ name, count }) => h('span', { className: 'stars-chip', key: name }, `加入 ${name} · ${count}`)),
          clearCount > 0 && h('span', { className: 'stars-chip', 'data-tone': 'warn' }, `${clearCount} 个将移出全部分类`)),
        message && h('div', { role: 'status' }, message),
        h('ul', { className: 'stars-reviewlist', 'aria-label': '待写回的仓库' },
          preview.plan.slice(0, limit).map((entry) => h('li', { key: entry.nameWithOwner, className: 'stars-reviewitem' },
            h('span', { className: 'stars-reviewname' }, entry.nameWithOwner),
            h('span', { className: 'stars-reviewpath', 'data-clear': entry.to.length === 0 }, `${labels(entry.from)} → ${labels(entry.to)}`),
            preview.remoteChanges?.[entry.nameWithOwner] && h('span', { className: 'stars-reviewremote' }, preview.remoteChanges[entry.nameWithOwner]),
            h('button', { className: 'stars-btn', disabled, 'aria-label': `撤销 ${entry.nameWithOwner} 的暂存`, onClick: () => onDiscard(entry.nameWithOwner) }, '撤销暂存')))),
        limit < preview.plan.length && h('button', { className: 'stars-btn stars-reviewmore', onClick: () => setLimit(limit + 50) },
          `再显示 ${Math.min(50, preview.plan.length - limit)} 条`),
        h('div', { className: 'stars-dialogactions' },
          h('button', { className: 'stars-btn', onClick: onClose }, '关闭'),
          h('button', { className: 'stars-btn', 'data-kind': 'primary', disabled: disabled || !canWrite,
            title: canWrite ? undefined : zh.syncBlocked, onClick: onConfirm }, zh.writeBack(preview.plan.length))))

    }

    function StarsPage() {
      const [data, setData] = React.useState(() => Date.now() - warmAt < 30_000 ? warmState : null)
      const [tab, setTab] = React.useState('all')
      const [query, setQuery] = React.useState('')
      const [chips, setChips] = React.useState(() => new Set())
      const [lang, setLang] = React.useState('all')
      const [sort, setSort] = React.useState(() => readSort())
      const [pageSize, setPageSize] = React.useState(() => readPageSize())
      const [page, setPage] = React.useState(0)
      const [suggestFilter, setSuggestFilter] = React.useState(null)
      const [selected, setSelected] = React.useState(() => new Set())
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [creating, setCreating] = React.useState(false)
      const [newListName, setNewListName] = React.useState('')
      const [job, setJob] = React.useState(null)
      const [copied, setCopied] = React.useState(false)
      const [preview, setPreview] = React.useState(null)
      const [checkingRemote, setCheckingRemote] = React.useState(false)
      const [confirm, setConfirm] = React.useState(null)
      const [orphansOpen, setOrphansOpen] = React.useState(false)
      const [ai, setAi] = React.useState(null)
      const [activeViewId, setActiveViewId] = React.useState(null)
      const [viewEditor, setViewEditor] = React.useState(null)
      const [detail, setDetail] = React.useState(null)
      const viewerRef = React.useRef(null)
      viewerRef.current = data?.viewer
      const aiRequest = React.useRef(0)
      const pollingRef = React.useRef(false)
      const lastToggled = React.useRef(null)
      const previousViewer = React.useRef(data?.viewer)
      React.useEffect(() => {
        if (previousViewer.current && previousViewer.current !== data?.viewer) {
          aiRequest.current += 1
          setAi(null)
          setConfirm(null)
          setPreview(null)
          setCreating(false)
          setTab('all')
          setQuery('')
          setChips(new Set())
          setLang('all')
          setSort(readSort())
          setSuggestFilter(null)
          setActiveViewId(null)
          setViewEditor(null)
          setDetail(null)
          setJob(null)
        }
        previousViewer.current = data?.viewer
        if (data?.viewer) warmState = null
      }, [data?.viewer])
      const t = React.useMemo(() => (key, ...args) => {
        const value = zh[key] ?? en[key]
        return typeof value === 'function' ? value(...args) : value ?? key
      }, [])

      const run = React.useCallback(async (payload) => {
        setBusy(true)
        setError(null)
        setNotice(null)
        try {
          const read = ['state', 'refresh', 'checkAuth'].includes(payload.action)
          const value = await rpc(read ? payload : { viewer: viewerRef.current, ...payload })
          if (value && Array.isArray(value.repos)) setData(value)
          return value
        } catch (cause) {
          setError(cause.message)
          throw cause
        } finally {
          setBusy(false)
        }
      }, [])

      /**
       * 同步是后台任务：启动请求立刻返回，这里按 350ms 轮询进度。
       * 跑完那一次响应会带回完整视图，顺便把面板数据换掉。
       */
      const followSync = React.useCallback(async () => {
        if (pollingRef.current) return
        pollingRef.current = true
        try {
          for (;;) {
            await new Promise((resolve) => setTimeout(resolve, 350))
            const value = await rpc({ action: 'progress' })
            const running = value?.job ?? value?.syncJob
            if (running) setJob(running)
            if (!running?.running) {
              if (Array.isArray(value?.repos)) setData(value)
              setNotice({ tone: failedTone(running), text: jobNotice(running) })
              break
            }
          }
        } catch (cause) {
          setError(cause.message)
        } finally {
          pollingRef.current = false
        }
      }, [t])

      // 后台刷新期间轻量轮询（不走 run：不想把整块 UI 置成 busy），刷新完自动停。
      React.useEffect(() => {
        if (!data?.refreshing) return undefined
        const timer = setInterval(() => {
          rpc({ action: 'state' })
            .then((value) => { if (value && Array.isArray(value.repos)) setData(value) })
            .catch(() => {})
        }, 900)
        return () => clearInterval(timer)
      }, [data?.refreshing])

      React.useEffect(() => {
        run({ action: 'state' })
          .then((value) => {
            if (!value?.syncJob) return
            setJob(value.syncJob)
            // 刷新页面时如果后台还在同步，接着显示进度条。
            if (value.syncJob.running) followSync()
          })
          .catch(() => {})
      }, [run, followSync])

      const lists = data?.lists ?? []
      const repos = data?.repos ?? []
      const suggestions = data?.suggestions ?? {}
      const currentList = lists.find((list) => list.id === tab) ?? null
      const savedViews = data?.savedViews ?? []
      const activeView = savedViews.find((view) => view.id === activeViewId)
      const filters = { tab, query: query.trim(), lang, chips: [...chips].sort(), sort, suggestFilter }
      const matchesSaved = activeView && JSON.stringify(filters) === JSON.stringify(activeView.filters)
      const scopeName = tab === 'all' ? '全部仓库' : tab === 'unsorted' ? zh.unsorted : currentList?.name
      const missingList = !scopeName && tab !== 'updates' && tab !== 'ops'
      const summary = [scopeName ?? '原列表不可用', query.trim() && `搜索「${query.trim()}」`, lang !== 'all' && lang,
        ...filters.chips.map((key) => chipLabels[key]), suggestFilter && `建议归入「${suggestFilter}」`,
        `排序 · ${sortLabels[`${sort.key}:${sort.dir}`]}`].filter(Boolean).join(' / ')
      const detailRepo = detail && detail.viewer === data?.viewer && repos.find((repo) => repo.nameWithOwner === detail.name)
      const orphanNames = (data?.orphans ?? []).find((entry) => entry.id === tab)?.names ?? []

      const inTab = React.useMemo(() => {
        if (tab === 'all') return repos
        if (tab === 'unsorted') return repos.filter((repo) => (repo.desired ?? []).length === 0)
        if (tab === 'updates' || tab === 'ops') return []
        return repos.filter((repo) => (repo.desired ?? []).includes(tab))
      }, [repos, tab])

      const languages = React.useMemo(() => {
        const found = new Set()
        for (const repo of repos) if (repo.language) found.add(repo.language)
        return [...found].sort((a, b) => a.localeCompare(b))
      }, [repos])

      const shown = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        const now = Date.now()
        const filtered = inTab.filter((repo) => {
          if (suggestFilter && suggestions[repo.nameWithOwner]?.list !== suggestFilter) return false
          if (lang !== 'all' && repo.language !== lang) return false
          if (chips.has('newRelease')) {
            const at = repo.latestRelease?.publishedAt
            if (!at || now - Date.parse(at) > 30 * 86_400_000) return false
          }
          if (chips.has('recent') && !(repo.pushedAt && now - Date.parse(repo.pushedAt) <= 30 * 86_400_000)) return false
          if (chips.has('unsorted') && (repo.desired ?? []).length > 0) return false
          if (chips.has('archived') && !repo.archived) return false
          if (!needle) return true
          return [repo.nameWithOwner, repo.description, ...(repo.topics ?? [])]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(needle))
        })
        return sortRepos(filtered, sort)
      }, [chips, inTab, lang, query, sort, suggestFilter, suggestions])

      // 分页：只在客户端切，数据仍是一次抓齐的整份快照（服务端分页会把筛选和计数拆成两次请求）。
      const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
      const safePage = Math.min(page, pageCount - 1)
      const pageStart = safePage * pageSize
      const pageRows = shown.slice(pageStart, pageStart + pageSize)
      // 选中集可以跨页（翻页不清空），所以工具条要说明「有一部分不在当前页」。
      const selectedOffPage = Math.max(0, selected.size - pageRows.filter((repo) => selected.has(repo.nameWithOwner)).length)

      const unread = data?.updatesUnread ?? 0
      const updates = data?.updates ?? []
      const ops = data?.ops ?? []
      const watchedCount = (data?.watched ?? []).length
      const pendingCount = repos.filter((repo) => repo.pending?.add?.length || repo.pending?.remove?.length).length
      const unsortedCount = repos.filter((repo) => (repo.desired ?? []).length === 0).length

      const acceptCount = React.useMemo(
        () => repos.filter((repo) => (repo.desired ?? []).length === 0 && suggestions[repo.nameWithOwner]?.list).length,
        [repos, suggestions],
      )

      const distribution = React.useMemo(() => {
        const counts = new Map()
        for (const repo of repos) {
          if ((repo.desired ?? []).length > 0) continue
          const list = suggestions[repo.nameWithOwner]?.list
          if (!list) continue
          counts.set(list, (counts.get(list) ?? 0) + 1)
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1])
      }, [repos, suggestions])

      // 选区只对「当前看到的这批」有意义：换分类、改搜索、改筛选就清空，避免误操作到看不见的行。
      React.useEffect(() => {
        setSelected(new Set())
        lastToggled.current = null
      }, [tab, query, chips, lang, suggestFilter, data?.viewer])

      // 换分类、改搜索、改筛选、改排序、改每页条数都回到第一页，否则会停在一个空页上。
      React.useEffect(() => {
        setPage(0)
      }, [tab, query, chips, lang, sort, suggestFilter, pageSize])

      const toggle = (name, index, event) => {
        const shift = Boolean(event?.shiftKey) && lastToggled.current !== null
        setSelected((prev) => {
          const next = new Set(prev)
          if (shift) {
            const from = Math.min(lastToggled.current, index)
            const to = Math.max(lastToggled.current, index)
            for (let i = from; i <= to; i += 1) next.add(shown[i].nameWithOwner)
            return next
          }
          if (next.has(name)) next.delete(name)
          else next.add(name)
          return next
        })
        lastToggled.current = index
      }

      const allPageSelected = pageRows.length > 0 && pageRows.every((repo) => selected.has(repo.nameWithOwner))
      const toggleAll = () => {
        const names = pageRows.map((repo) => repo.nameWithOwner)
        setSelected((prev) => {
          const next = new Set(prev)
          for (const name of names) {
            if (allPageSelected) next.delete(name)
            else next.add(name)
          }
          return next
        })
      }

      const stage = async (fullNames, { add = [], remove = [] }) => {
        if (!fullNames.length) return
        await run({ action: 'stage', fullNames, add, remove })
        setSelected(new Set())
        setNotice({ tone: 'ok', text: `已暂存，记得点「${t('sync')}」写回 GitHub` })
      }

      const openSavedView = (view) => {
        const f = view.filters
        setActiveViewId(view.id)
        setTab(f.tab)
        setQuery(f.query)
        setChips(new Set(f.chips))
        setLang(f.lang)
        setSort(f.sort)
        setSuggestFilter(f.suggestFilter)
        setSelected(new Set())
        setPage(0)
      }

      const openTab = (key) => {
        if (activeView) {
          setQuery('')
          setChips(new Set())
          setLang('all')
          setSort(readSort())
        }
        setActiveViewId(null)
        setTab(key)
        setSelected(new Set())
        setSuggestFilter(null)
      }

      const changeSort = (next) => {
        setSort(next)
        if (!activeView) writeSort(next)
      }

      const changeView = async (action, name, editing) => {
        const { view, viewer } = viewEditor
        try {
          const value = await run({ action, viewer, name, filters,
            id: editing ? view.id : undefined, revision: editing ? view.revision : undefined })
          if (viewer !== viewerRef.current) return
          setActiveViewId(value.savedViewId ?? null)
          setViewEditor(null)
          setNotice({ tone: 'ok', text: action === 'saveView' ? `已保存视图「${name}」` : `已删除视图「${view.name}」` })
        } catch (cause) {
          if (cause.code === 'conflict') {
            setViewEditor(null)
            await run({ action: 'state' })
            setNotice({ tone: 'error', text: cause.message })
          }
        }
      }

      const acceptSuggestion = async (repo) => {
        const suggestion = suggestions[repo.nameWithOwner]
        if (!suggestion?.list) return
        let list = lists.find((item) => item.name === suggestion.list)
        if (!list) {
          const value = await run({ action: 'createList', name: suggestion.list, description: 'dsh-stars 自动创建' })
          list = value.lists.find((item) => item.name === suggestion.list)
        }
        if (!list) return
        await stage([repo.nameWithOwner], { add: [list.id] })
      }

      const acceptAll = async () => {
        const value = await run({ action: 'acceptSuggestions' })
        setSelected(new Set())
        setNotice({ tone: 'ok', text: t('accepted', value.staged ?? 0, value.created ?? 0) })
      }

      const startAndFollow = async (value) => {
        if (value?.job) setJob(value.job)
        if (value?.job?.running) await followSync()
        else if (value?.job) setNotice({ tone: failedTone(value.job), text: jobNotice(value.job) })
      }

      // 同步永远先看预览：写回是不可见的批量操作，先让用户看见「要写多少、写到哪」。
      const openPreview = async () => {
        const value = await run({ action: 'plan' })
        if (!value?.plan?.length) {
          setNotice({ tone: 'ok', text: t('nothingToSync') })
          return
        }
        setPreview(value)
      }

      const renewPreview = async (cause) => {
        if (cause.code !== 'conflict') throw cause
        setPreview(null)
        const state = await run({ action: 'state' })
        if (state.viewer === preview.viewer) {
          const next = await run({ action: 'plan', viewer: preview.viewer })
          if (next.plan.length) {
            const changes = {}
            if (cause.reason === 'remote-lists') {
              const before = new Map(preview.plan.map((row) => [row.itemId, row.from]))
              const label = (id) => state.lists.find((list) => list.id === id)?.name ?? lists.find((list) => list.id === id)?.name ?? id
              for (const row of next.plan) {
                const original = before.get(row.itemId)
                if (!original) continue
                const added = row.from.filter((id) => !original.includes(id)).map(label)
                const removed = original.filter((id) => !row.from.includes(id)).map(label)
                changes[row.nameWithOwner] = [added.length && `GitHub 已加入「${added.join('、')}」`,
                  removed.length && `GitHub 已移出「${removed.join('、')}」`].filter(Boolean).join('，')
              }
            }
            setPreview({ ...next, message: cause.message, remoteChanges: changes })
            return
          }
        }
        setNotice({ tone: cause.reason === 'remote-lists' ? 'ok' : 'error', text: cause.message })
      }

      const confirmSync = async () => {
        setCheckingRemote(true)
        try {
          const value = await run({ action: 'sync', viewer: preview.viewer, planVersion: preview.planVersion, expectCount: preview.plan.length })
          setPreview(null)
          await startAndFollow(value)
        } catch (cause) {
          await renewPreview(cause)
        } finally {
          setCheckingRemote(false)
        }
      }

      const discardPending = async (fullName) => {
        try {
          const value = await run({ action: 'discardPending', viewer: preview.viewer, planVersion: preview.planVersion, fullName })
          setPreview(value.preview.plan.length ? value.preview : null)
          setNotice({ tone: 'ok', text: `已撤销 ${fullName} 的暂存` })
        } catch (cause) {
          await renewPreview(cause)
        }
      }

      const askUnstar = (names) => {
        if (!names.length) return
        setConfirm({ type: 'unstar', names, viewer: data.viewer })
      }

      const doUnstar = async () => {
        const names = confirm?.names ?? []
        setConfirm(null)
        const value = await run({ action: 'unstar', fullNames: names, viewer: confirm.viewer })
        setSelected(new Set())
        await startAndFollow(value)
      }

      const askDeleteList = (list) => setConfirm({ type: 'deleteList', list, viewer: data.viewer, mode: 'unsorted', targetListId: '' })

      const doDeleteList = async () => {
        const dialog = confirm
        setConfirm(null)
        const value = await run({
          action: 'deleteList',
          listId: dialog.list.id,
          viewer: dialog.viewer,
          mode: dialog.mode,
          targetListId: dialog.mode === 'move' ? dialog.targetListId : undefined,
        })
        if (tab === dialog.list.id) setTab('all')
        await startAndFollow(value)
      }

      const runAi = async (mode, scope, previous) => {
        const request = ++aiRequest.current
        const fullNames = previous?.failedBatches.flatMap((batch) => batch.repos)
        const viewer = previous?.viewer ?? viewerRef.current
        setAi({ phase: 'running', mode, count: fullNames?.length ?? (scope === 'all' ? repos.length : unsortedCount) })
        try {
          const next = await run({ action: 'organize', mode, scope, fullNames, viewer })
          if (request !== aiRequest.current || viewerRef.current !== viewer) return
          if (previous) {
            const groups = new Map()
            for (const group of [...previous.groups, ...next.groups]) {
              const key = group.name.toLowerCase()
              if (groups.has(key)) groups.get(key).repos.push(...group.repos)
              else groups.set(key, { ...group, repos: [...group.repos] })
            }
            next.groups = [...groups.values()]
            next.unsorted = [...previous.unsorted, ...next.unsorted]
            next.unchanged = [...(previous.unchanged ?? []), ...(next.unchanged ?? [])]
            next.total = previous.total
          }
          setAi({ phase: 'result', mode, result: next })
        } catch (cause) {
          if (request === aiRequest.current) setAi(previous ? { phase: 'result', mode, result: previous } : null)
          throw cause
        }
      }

      const openAi = () => {
        if (lists.length > 0) setConfirm({ type: 'organize' })
        else runAi('reuse', 'all').catch(() => {})
      }

      const applyAi = async () => {
        const result = ai?.result
        if (!result) return
        const value = await run({
          action: 'organizeApply',
          viewer: result.viewer,
          mode: ai.mode,
          groups: result.groups,
          unsorted: result.unsorted,
        })
        setData(value)
        setAi(null)
        setNotice({ tone: 'ok', text: t('organizeApplied', value.touched ?? 0) })
      }

      const toggleWatch = async (names, watch) => {
        const value = await run({ action: 'watch', fullNames: names, watch })
        setData(value)
        setNotice({
          tone: 'ok',
          text: watch ? `已跟踪 ${names.length} 个仓库，之后它们的远端更新会提醒你` : `已取消跟踪 ${names.length} 个仓库`,
        })
      }

      const removeOrphan = async (listId, fullName) => {
        await run({ action: 'removeOrphan', listId, fullName })
        setNotice({ tone: 'ok', text: `已从分类移出 ${fullName}` })
      }

      const createList = async () => {
        const name = newListName.trim()
        if (!name) return
        await run({ action: 'createList', name })
        setCreating(false)
        setNewListName('')
        setNotice({ tone: 'ok', text: `已创建列表「${name}」` })
      }

      if (!data) {
        return h('div', { className: 'stars-root' },
          error
            ? h('div', { className: 'stars-empty' }, `${t('errorPrefix')}：${error}`)
            : h('div', { className: 'stars-empty stars-loading' },
              h('div', { className: 'stars-loadingdot' }),
              h('div', { className: 'stars-loadingtext' }, t('loadingFirst')),
              h('div', { className: 'stars-loadinghint' }, t('loadingHint'))))
      }

      const syncing = Boolean(job?.running)
      const percent = job && job.total > 0 ? Math.round((job.done / job.total) * 100) : 0

      const authState = data.auth?.state ?? 'unknown'
      const authBlocked = authState === 'no-gh' || authState === 'not-logged-in'
      const scopeMissing = authState === 'missing-user-scope'
      const authCommand = data.auth?.command ?? ''

      const gotoUpdates = () => openTab('updates')

      const head = h('div', { className: 'stars-head' },
        h('span', { className: 'stars-headicon' }, h(StarIcon, { size: 18 })),
        h('div', { className: 'stars-headtext' },
          h('div', { className: 'stars-title' }, t('title')),
          h('div', { className: 'stars-meta' },
            data.viewer && h('span', null, `@${data.viewer} · `),
            h('span', null, data.refreshing ? t('refreshing') : data.snapshotAt ? `${t('snapshotAt')} ${relative(data.snapshotAt)}` : t('never')),
            h('span', { className: 'stars-metasep' }, '·'),
            h('span', null, `${data.repos.length} 个 star`),
            watchedCount > 0
              ? h('span', { className: 'stars-metasep' }, '·')
              : null,
            watchedCount > 0 ? h('span', null, t('trackedChip', watchedCount)) : null,
            unread > 0
              ? h('button', {
                className: 'stars-unreadchip',
                title: t('updatesHint'),
                onClick: gotoUpdates,
              }, t('unread', unread))
              : null)),
        h('div', { className: 'stars-grow' }),
        h('button', {
          className: 'stars-btn',
          'data-kind': 'ai',
          disabled: busy || syncing || repos.length === 0,
          title: t('organizeHint'),
          onClick: openAi,
        }, `✦ ${t('organize')}`),
        h('button', { className: 'stars-btn', disabled: busy || syncing, onClick: () => run({ action: 'refresh' }).catch(() => {}) }, busy || syncing ? '…' : t('refresh')),
        h('button', {
          className: 'stars-btn',
          disabled: busy || syncing || pendingCount === 0,
          title: '查看待写回的分类改动',
          onClick: () => openPreview().catch(() => {}),
        }, syncing
          ? `${t('syncing')} ${job.done}/${job.total}`
          : pendingCount > 0 ? `${t('sync')} (${pendingCount})` : t('sync')),
        h('button', {
          className: 'stars-btn',
          disabled: unread === 0 || syncing,
          title: t('markReadHint'),
          onClick: () => run({ action: 'markViewed' }).catch(() => {}),
        }, t('markRead')))

      const authCard = authState === 'no-gh' || authState === 'not-logged-in' || scopeMissing
        ? h('div', { className: 'stars-auth', role: 'status' },
          h('div', { className: 'stars-authtitle' }, t('authTitle')),
          h('div', { className: 'stars-authbody' },
            authState === 'no-gh' ? t('authNoGh') : authState === 'not-logged-in' ? t('authNotLoggedIn') : t('authScope')),
          authCommand
            ? h('div', { className: 'stars-authcmd' },
              h('span', { className: 'stars-authbody' }, `${t('authCommand')}：`),
              h('code', null, authCommand),
              h('button', {
                className: 'stars-btn',
                style: { height: 22 },
                onClick: () => {
                  navigator.clipboard?.writeText(authCommand).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }).catch(() => {})
                },
              }, copied ? t('copied') : t('copy')))
            : null,
          h('div', { className: 'stars-authrow' },
            h('button', { className: 'stars-btn', style: { height: 22 }, disabled: busy, onClick: () => run({ action: 'checkAuth' }).catch(() => {}) }, t('recheck')),
            scopeMissing ? h('span', { className: 'stars-authbody' }, t('readOnlyOk')) : null,
            data.auth?.login ? h('span', { className: 'stars-authbody', style: { marginLeft: 'auto' } }, t('authLogin', data.auth.login)) : null))
        : null

      const progressStrip = syncing
        ? h('div', { className: 'stars-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent },
          h('span', { className: 'stars-progresslabel' }, job.kind === 'unstar' ? t('unstarProgress') : job.kind === 'deleteList' ? t('deleteListProgress') : t('syncProgress')),
          h('div', { className: 'stars-progresstrack' },
            h('div', { className: 'stars-progressfill', 'data-done': String(job.done >= job.total), style: { width: `${Math.max(percent, 2)}%` } })),
          h('span', { className: 'stars-progresspct' }, `${percent}%`),
          h('span', { className: 'stars-progressmeta' }, t('progressMeta', job.done, job.total, job.applied, job.failed?.length ?? 0)),
          job.current ? h('span', { className: 'stars-progresscurrent', title: job.current }, t('progressCurrent', job.current)) : null)
        : null

      const railItem = (key, label, count, options = {}) => h('button', {
        type: 'button', 'aria-current': !matchesSaved && tab === key ? 'page' : undefined,
        key,
        className: 'stars-railitem',
        'data-active': String(!matchesSaved && tab === key),
        title: options.title,
        onClick: () => openTab(key),
      },
      options.icon
        ? h('span', { className: 'stars-railicon' }, options.icon)
        : options.color
          ? h('span', { className: 'stars-dot', style: { '--stars-c': options.color } })
          : null,
      h('span', { className: 'stars-railitemlabel' }, label),
      count === null || count === undefined
        ? null
        : h('span', { className: 'stars-railcount', 'data-tone': options.tone }, count))

      const rail = h('div', { className: 'stars-rail' },
        railItem('all', t('all'), repos.length, { icon: '★' }),
        railItem('unsorted', t('unsorted'), unsortedCount, { icon: '◇' }),
        // 「更新」的徽标是未读数（只算跟踪的仓库）；「操作记录」没有未读，显示总条数。
        railItem('updates', t('updates'), unread > 0 ? unread : null, { icon: '⚑', tone: 'unread', title: t('updatesHint') }),
        railItem('ops', t('ops'), ops.length, { icon: '≡', title: t('opsSummary', ops.length) }),
        savedViews.length > 0 && h('div', { className: 'stars-railgroup' }, '已保存的视图'),
        ...savedViews.map((view) => h('button', { key: view.id, type: 'button', className: 'stars-railitem', title: view.name,
          'aria-current': matchesSaved && view.id === activeViewId ? 'page' : undefined,
          'data-active': String(Boolean(matchesSaved && view.id === activeViewId)),
          onClick: () => openSavedView(view) }, h('span', { className: 'stars-railicon', 'aria-hidden': true }, '▤'),
          h('span', { className: 'stars-railitemlabel' }, view.name))),
        h('div', { className: 'stars-railgroup' }, t('lists')),
        ...lists.map((list) => railItem(list.id, list.name, list.count ?? 0, { color: colorOf(list.name) })),
        h('button', {
          type: 'button', className: 'stars-railitem',
          onClick: () => { setCreating(true); setNewListName('') },
        }, h('span', { style: { color: 'var(--dsw-alias-brand-primary)' } }, `+ ${t('createList')}`)))

      const chipButton = (key, label) => h('button', {
        key,
        className: 'stars-chipbtn',
        'aria-pressed': chips.has(key),
        'data-active': String(chips.has(key)),
        onClick: () => setChips((prev) => {
          const next = new Set(prev)
          if (next.has(key)) next.delete(key)
          else next.add(key)
          return next
        }),
      }, label)

      const sortSelect = h('select', {
        className: 'stars-select',
        title: t('sortBy'),
        value: `${sort.key}:${sort.dir}`,
        onChange: (event) => {
          const [key, dir] = event.target.value.split(':')
          changeSort({ key, dir })
        },
      },
      ...Object.entries(sortLabels).map(([value, label]) => h('option', { key: value, value }, label)))

      const toolbar = tab === 'updates' || tab === 'ops' ? null : h('div', { className: 'stars-toolbar' },
        h('input', {
          className: 'stars-input',
          placeholder: t('search'),
          'aria-label': t('search'),
          value: query,
          onChange: (event) => setQuery(event.target.value),
        }),
        chipButton('newRelease', t('chipNewRelease')),
        chipButton('recent', t('chipRecent')),
        chipButton('unsorted', t('chipUnsorted')),
        chipButton('archived', t('chipArchived')),
        h('select', { className: 'stars-select', 'aria-label': '语言筛选', value: lang, onChange: (event) => setLang(event.target.value) },
          h('option', { value: 'all' }, t('languageAll')),
          lang !== 'all' && !languages.includes(lang) && h('option', { value: lang }, lang),
          ...languages.map((name) => h('option', { key: name, value: name }, name))),
        sortSelect,
        h('button', { className: 'stars-btn', disabled: !data.viewer || busy,
          onClick: () => { setError(null); setViewEditor({ viewer: data.viewer, view: activeView }) } },
        activeView ? matchesSaved ? '编辑视图' : '更新视图' : '保存视图'),
        activeView && h('span', { className: 'stars-selinfo', role: 'status' }, `匹配 ${shown.length} 个仓库`),
        suggestFilter && !distribution.some(([name]) => name === suggestFilter) && h('button', {
          className: 'stars-chipbtn', onClick: () => setSuggestFilter(null) }, `清除建议筛选「${suggestFilter}」`),
        selected.size > 0
          ? h(React.Fragment, null,
            h('span', { className: 'stars-selinfo' },
              t('selected', selected.size),
              selectedOffPage > 0 ? t('selectedOffPage', selectedOffPage) : null),
            h('select', {
              className: 'stars-select',
              value: '',
              onChange: (event) => {
                const id = event.target.value
                event.target.value = ''
                if (id) stage([...selected], { add: [id] }).catch(() => {})
              },
            },
            h('option', { value: '' }, t('addTo')),
            ...lists.map((list) => h('option', { key: list.id, value: list.id }, list.name))),
            currentList
              ? h('button', { className: 'stars-btn', onClick: () => stage([...selected], { remove: [tab] }).catch(() => {}) }, t('removeFrom'))
              : null,
            h('button', {
              className: 'stars-btn',
              disabled: busy || syncing,
              onClick: () => {
                const names = [...selected]
                const watch = names.some((name) => !repos.find((repo) => repo.nameWithOwner === name)?.watched)
                toggleWatch(names, watch).catch(() => {})
              },
            }, selected.size > 0 && [...selected].every((name) => repos.find((repo) => repo.nameWithOwner === name)?.watched)
              ? `${t('tracked')}（${selected.size}）`
              : `${t('watch')}（${selected.size}）`),
            h('button', { className: 'stars-btn', disabled: busy || syncing, onClick: () => askUnstar([...selected]) }, `取消 star（${selected.size}）`),
            h('button', { className: 'stars-btn', onClick: () => setSelected(new Set()) }, t('clearSelection')))
          : null,
        currentList
          ? h('button', { className: 'stars-btn', style: { marginLeft: 'auto' }, disabled: busy || syncing, onClick: () => askDeleteList(currentList) }, t('deleteList'))
          : null)

      const distStrip = (tab === 'all' || tab === 'unsorted') && distribution.length > 0
        ? h('div', { className: 'stars-dist' },
          h('span', { className: 'stars-distlabel' }, `${t('suggestHint')} · ${t('unsorted')} ${unsortedCount}`),
          ...distribution.map(([name, count]) => h('button', {
            key: name,
            className: 'stars-distchip',
            'data-active': String(suggestFilter === name),
            onClick: () => setSuggestFilter((prev) => (prev === name ? null : name)),
          }, name, h('span', { className: 'stars-distcount' }, String(count)))),
          acceptCount > 0
            ? h('button', {
              className: 'stars-btn',
              style: { marginLeft: 'auto', height: 22 },
              disabled: busy,
              onClick: () => acceptAll().catch(() => {}),
            }, t('acceptAll', acceptCount))
            : null)
        : null

      const feed = (entries, summary, hint, empty) => h('div', { className: 'stars-changes' },
        h('div', { className: 'stars-changesum' },
          h('div', null, summary),
          h('div', null, hint)),
        entries.length === 0
          ? h('div', { className: 'stars-emptyhint' }, h('div', null, empty))
          : entries.map((entry) => h('div', { className: 'stars-change', key: entry.id, 'data-kind': entry.kind },
            h('span', { className: 'stars-changedate' }, formatDate(entry.at)),
            h('span', { className: 'stars-chip' }, t('kinds')[entry.kind] ?? entry.kind),
            entry.url
              ? h('a', { className: 'stars-repolink', href: entry.url, target: '_blank', rel: 'noreferrer', style: { fontSize: 12 } }, entry.nameWithOwner)
              : h('span', { className: 'stars-dim' }, entry.nameWithOwner ?? ''),
            h('span', { className: 'stars-dim' }, entry.text))))

      const updatesView = feed(updates, t('updatesSummary', updates.length, unread), t('updatesHint'), t('emptyUpdates'))
      const opsView = feed(ops, t('opsSummary', ops.length), t('opsHint'), t('emptyOps'))

      const row = (repo, index) => {
        const suggested = suggestions[repo.nameWithOwner]
        const pending = Boolean(repo.pending?.add?.length || repo.pending?.remove?.length)
        const chips = (repo.desired ?? []).map((id) => lists.find((list) => list.id === id)?.name).filter(Boolean)
        return h('tr', {
          className: 'stars-row',
          key: repo.nameWithOwner,
          'data-selected': String(selected.has(repo.nameWithOwner)),
          // 整行可点：点到勾选框、链接、按钮时交回给它们自己处理，
          // 正在拖选文字时也不抢点击。
          onClick: (event) => {
            if (event.target.closest('button, a, input, select, textarea, label')) return
            const picking = typeof window !== 'undefined' && window.getSelection?.()?.toString()
            if (picking) return
            toggle(repo.nameWithOwner, index, event)
          },
        },
          h('td', { style: { width: 28 } },
            h('input', { className: 'stars-cb', type: 'checkbox', 'aria-label': `选择 ${repo.nameWithOwner}`, checked: selected.has(repo.nameWithOwner), onChange: (event) => toggle(repo.nameWithOwner, index, event) })),
          h('td', null,
            h('div', { className: 'stars-repo' },
              h('div', { className: 'stars-repotitle' },
                h('a', { className: 'stars-repolink', href: repo.url, target: '_blank', rel: 'noreferrer' }, repo.nameWithOwner),
                h('button', { className: 'stars-detailbtn', 'aria-label': `查看 ${repo.nameWithOwner} 的详情`,
                  onClick: () => setDetail({ viewer: data.viewer, name: repo.nameWithOwner }) }, '详情')),
              repo.description ? h('div', { className: 'stars-desc' }, repo.description) : null,
              (repo.topics ?? []).length
                ? h('div', { className: 'stars-topics' }, ...repo.topics.slice(0, 6).map((topic) => h('span', { className: 'stars-topic', key: topic }, topic)))
                : null,
              suggested && (repo.desired ?? []).length === 0
                ? h('div', { className: 'stars-suggest' },
                  h('button', {
                    className: 'stars-suggestbtn',
                    title: t('useSuggestion'),
                    onClick: () => acceptSuggestion(repo).catch(() => {}),
                  }, `+ ${suggested.list}`))
                : null)),
          h('td', { style: { minWidth: 140 } },
            h('div', { className: 'stars-chips' },
              ...chips.map((name) => h('span', {
                className: 'stars-chip',
                key: name,
                'data-color': 'true',
                style: { '--stars-c': colorOf(name) },
              }, name)),
              pending ? h('span', { className: 'stars-chip', 'data-tone': 'brand', key: '__pending' }, t('pendingChip')) : null,
              repo.archived ? h('span', { className: 'stars-chip', 'data-tone': 'warn', key: '__arch' }, t('archived')) : null,
              repo.stale ? h('span', { className: 'stars-chip', 'data-tone': 'warn', key: '__stale' }, t('stale')) : null,
              chips.length === 0 && !pending && !repo.archived && !repo.stale
                ? h('span', { className: 'stars-dim' }, t('unsorted'))
                : null)),
          h('td', null, h('span', { className: 'stars-stars', title: `${repo.stars ?? 0} stars` }, `★ ${repo.stars ?? 0}`)),
          h('td', { className: 'stars-upd' },
            h('span', { className: 'stars-dim', title: formatDate(repo.pushedAt) }, relative(repo.pushedAt)),
            h('div', { className: 'stars-hoveracts' },
              h('button', {
                className: 'stars-rowact stars-track',
                'data-on': String(Boolean(repo.watched)),
                disabled: busy || syncing,
                title: repo.watched ? t('unwatchHint') : t('watchHint'),
                onClick: () => toggleWatch([repo.nameWithOwner], !repo.watched).catch(() => {}),
              }, repo.watched ? `★ ${t('tracked')}` : `☆ ${t('watch')}`),
              h('button', {
                className: 'stars-rowact',
                disabled: busy || syncing,
                onClick: () => askUnstar([repo.nameWithOwner]),
              }, '取消 star'))))
      }

      const sortTh = (key, label, extraClass) => h('th', {
        className: `stars-sortth${extraClass ? ` ${extraClass}` : ''}`,
        'aria-sort': sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined,
      }, h('button', { type: 'button', className: 'stars-sortbutton',
        onClick: () => {
          const next = sort.key === key
            ? { key, dir: sort.dir === 'desc' ? 'asc' : 'desc' }
            : { key: key === 'name' ? 'name' : key, dir: key === 'name' ? 'asc' : 'desc' }
          changeSort(next)
        },
      }, h('span', null, label), sort.key === key ? h('span', { className: 'stars-sortmark' }, sort.dir === 'desc' ? '▼' : '▲') : null))

      const table = h('div', { className: 'stars-scroll' },
        shown.length === 0
          ? missingList
            ? h('div', { className: 'stars-emptyhint' }, '这个视图引用的列表已不可用。',
              h('button', { className: 'stars-btn', onClick: () => setTab('all') }, '改用全部仓库'))
            : h('div', { className: 'stars-empty' }, query || chips.size || lang !== 'all' || suggestFilter ? t('emptySearch') : t('empty'))
          : h('table', { className: 'stars-table' },
            h('thead', null, h('tr', null,
              h('th', { style: { width: 28 } }, h('label', null, h('input', {
                className: 'stars-cb',
                type: 'checkbox',
                title: allPageSelected ? t('clearPage') : t('selectAllPage', pageRows.length),
                checked: allPageSelected,
                onChange: toggleAll,
              }), h('span', { className: 'stars-pagechecklabel' }, '选择本页'))),
              sortTh('name', t('name')),
              h('th', null, t('type')),
              sortTh('stars', t('stars')),
              sortTh('pushedAt', t('updated'), 'stars-upd'))),
            h('tbody', null, ...pageRows.map((repo, index) => row(repo, pageStart + index)))))

      const pager = tab === 'updates' || tab === 'ops' || shown.length === 0 ? null : h('div', { className: 'stars-pager' },
        h('label', { className: 'stars-selinfo', title: t('perPageHint') },
          t('perPage'),
          h('select', {
            className: 'stars-select stars-pagesize',
            value: pageSize,
            onChange: (event) => {
              const next = Number(event.target.value)
              setPageSize(next)
              writePageSize(next)
            },
          }, ...PAGE_SIZES.map((size) => h('option', { key: size, value: size }, String(size))))),
        h('button', { className: 'stars-btn stars-pagebtn', disabled: safePage <= 0, onClick: () => setPage(safePage - 1) }, `‹ ${t('prevPage')}`),
        h('span', { className: 'stars-selinfo' }, t('pageInfo', safePage + 1, pageCount)),
        h('button', { className: 'stars-btn stars-pagebtn', disabled: safePage >= pageCount - 1, onClick: () => setPage(safePage + 1) }, `${t('nextPage')} ›`))

      const foot = h('div', { className: 'stars-foot' },
        h('span', null, `${repos.length} 个 star · ${lists.length} 个列表 · ${unsortedCount} 个未归类`),
        data.updatesViewedAt ? h('span', null, `${t('lastViewed')} ${relative(data.updatesViewedAt)}`) : null,
        data.viewer ? h('a', { className: 'stars-repolink', style: { fontSize: 11, marginLeft: 'auto' }, href: `https://github.com/stars/${data.viewer}/lists`, target: '_blank', rel: 'noreferrer' }, t('openOnGithub')) : null,
        data.error ? h('span', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, `${data.error.code}: ${data.error.message}`) : null)

      const closeDialog = () => { aiRequest.current += 1; setCreating(false); setPreview(null); setConfirm(null); setAi(null) }

      const aiGroups = ai?.phase === 'result' ? (ai.result?.groups ?? []) : []
      const aiCount = aiGroups.reduce((sum, group) => sum + group.repos.length, 0)
        + (ai?.mode === 'rebuild' ? ai.result?.unsorted?.length ?? 0 : 0)
      const failedBatches = ai?.result?.failedBatches ?? []

      const dialogBody = ai?.phase === 'running'
        ? h(React.Fragment, null,
          h('div', { className: 'stars-dialogtitle' }, t('organizeRunning')),
          h('div', { className: 'stars-plansummary' }, t('organizeRunningHint', ai.count)),
          h('div', { className: 'stars-dialogactions' },
            h('button', { className: 'stars-btn', onClick: closeDialog }, t('cancel'))))
        : ai?.phase === 'result'
          ? h(React.Fragment, null,
            h('div', { className: 'stars-dialogtitle' }, t('organizeResultTitle', aiGroups.length)),
            aiGroups.length === 0
              ? h('div', { className: 'stars-plansummary' }, t('organizeEmpty'))
              : h('div', { className: 'stars-planlist' },
                ...aiGroups.map((group) => h('div', { className: 'stars-planrow', key: group.name },
                  h('span', { style: { fontWeight: 600 } }, group.name),
                  group.isNew ? h('span', { className: 'stars-chip', 'data-tone': 'brand', style: { fontSize: 10, padding: '0 6px' } }, t('organizeNew')) : null,
                  h('span', { className: 'stars-dim', style: { marginLeft: 'auto' } }, t('organizeRepos', group.repos.length)),
                  h('span', { className: 'stars-repolist' }, group.repos.slice(0, 4).join('、'))))),
            (ai.result?.unsorted ?? []).length > 0
              ? h('div', { className: 'stars-plansummary' }, ai.mode === 'rebuild' ? `将移到未归类 · ${ai.result.unsorted.length} 个` : t('organizeUnsorted', ai.result.unsorted.length))
              : null,
            ai.result?.unchanged?.length > 0 && h('div', { className: 'stars-plansummary' }, `${ai.result.unchanged.length} 个仓库保留原分类`),
            failedBatches.length > 0 && h('div', { role: 'status', className: 'stars-plansummary' },
              h('span', null, `${failedBatches.reduce((n, batch) => n + batch.repos.length, 0)} 个仓库整理失败，保留原分类。${failedBatches[0].message}`),
              h('button', { className: 'stars-btn', disabled: busy, onClick: () => runAi(ai.mode, ai.result.scope, ai.result).catch(() => {}) }, '重试失败仓库')),
            ai.result?.model
              ? h('div', { className: 'stars-dim', style: { fontSize: 11 } }, t('organizeBy', ai.result.provider, ai.result.model))
              : null,
            h('div', { className: 'stars-dialogactions' },
              h('button', { className: 'stars-btn', onClick: closeDialog }, t('cancel')),
              h('button', {
                className: 'stars-btn',
                'data-kind': 'primary',
                disabled: busy || aiCount === 0,
                onClick: () => applyAi().catch(() => {}),
              }, t('organizeApply'))))
          : confirm?.type === 'organize'
            ? h(React.Fragment, null,
              h('div', { className: 'stars-dialogtitle' }, t('organizeModeTitle')),
              h('div', { className: 'stars-plansummary' }, t('organizeModeBody', lists.length)),
              h('div', { className: 'stars-dialogactions' },
                h('button', { className: 'stars-btn', onClick: closeDialog }, t('cancel')),
                h('button', { className: 'stars-btn', onClick: () => { setConfirm(null); runAi('reuse', 'unsorted').catch(() => {}) } }, t('organizeReuse')),
                h('button', { className: 'stars-btn', 'data-kind': 'primary', onClick: () => { setConfirm(null); runAi('rebuild', 'all').catch(() => {}) } }, t('organizeRebuild'))))
            : creating
        ? h(React.Fragment, null,
          h('div', { className: 'stars-dialogtitle' }, t('createList')),
          h('input', {
            className: 'stars-input',
            autoFocus: true,
            placeholder: t('listName'),
            value: newListName,
            onChange: (event) => setNewListName(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') createList().catch(() => {}) },
          }),
          h('div', { className: 'stars-dialogactions' },
            h('button', { className: 'stars-btn', onClick: closeDialog }, t('cancel')),
            h('button', { className: 'stars-btn', 'data-kind': 'primary', disabled: !newListName.trim() || busy, onClick: () => createList().catch(() => {}) }, t('create'))))
        : preview
          ? h(SyncPreview, {
            preview, lists, checkingRemote, disabled: busy || syncing || checkingRemote, canWrite: !authBlocked && !scopeMissing,
            onDiscard: (name) => discardPending(name).catch(() => {}),
            onConfirm: () => confirmSync().catch(() => {}), onClose: closeDialog,
          })
          : confirm?.type === 'unstar'
            ? h(React.Fragment, null,
              h('div', { className: 'stars-dialogtitle' }, t('unstarTitle', confirm.names.length)),
              h('div', { className: 'stars-plansummary' }, t('unstarHint')),
              h('div', { className: 'stars-planlist' },
                ...confirm.names.slice(0, 5).map((name) => h('div', { className: 'stars-planrow', key: name }, h('span', { className: 'stars-repolink' }, name))),
                confirm.names.length > 5 ? h('div', { className: 'stars-dim' }, t('unstarRest', confirm.names.length - 5)) : null),
              h('div', { className: 'stars-dialogactions' },
                h('button', { className: 'stars-btn', onClick: closeDialog }, t('cancel')),
                h('button', { className: 'stars-btn', 'data-kind': 'danger', disabled: busy, onClick: () => doUnstar().catch(() => {}) }, t('unstarConfirm'))))
            : confirm?.type === 'deleteList'
              ? h(React.Fragment, null,
                h('div', { className: 'stars-dialogtitle' }, t('deleteTitle', confirm.list.name)),
                confirm.list.count > 0
                  ? h(React.Fragment, null,
                    h('div', { className: 'stars-plansummary' }, t('deleteBusyHint', confirm.list.count)),
                    h('label', { className: 'stars-radio' },
                      h('input', { type: 'radio', checked: confirm.mode === 'unsorted', onChange: () => setConfirm({ ...confirm, mode: 'unsorted' }) }),
                      t('deleteToUnsorted')),
                    h('label', { className: 'stars-radio' },
                      h('input', { type: 'radio', checked: confirm.mode === 'move', onChange: () => setConfirm({ ...confirm, mode: 'move' }) }),
                      t('deleteToMove')),
                    confirm.mode === 'move'
                      ? h('select', {
                        className: 'stars-select',
                        value: confirm.targetListId,
                        onChange: (event) => setConfirm({ ...confirm, targetListId: event.target.value }),
                      },
                      h('option', { value: '' }, t('deleteTarget')),
                      ...lists.filter((list) => list.id !== confirm.list.id).map((list) => h('option', { key: list.id, value: list.id }, list.name)))
                      : null)
                  : h('div', { className: 'stars-plansummary' }, t('deleteEmptyHint')),
                h('div', { className: 'stars-dialogactions' },
                  h('button', { className: 'stars-btn', onClick: closeDialog }, t('cancel')),
                  h('button', {
                    className: 'stars-btn',
                    'data-kind': 'danger',
                    disabled: busy || (confirm.mode === 'move' && !confirm.targetListId),
                    onClick: () => doDeleteList().catch(() => {}),
                  }, t('deleteConfirm'))))
              : null

      const dialog = dialogBody
        ? h(Dialog, { label: preview ? '同步预览' : (ai || confirm?.type === 'organize') ? 'AI 整理' : creating ? '新建分类' : '确认操作',
          wide: Boolean(preview), onClose: closeDialog }, dialogBody,
          error && h('div', { role: 'alert', className: 'stars-plansummary' }, error))
        : null

      return h('div', { className: 'stars-root' },
        head,
        authCard,
        progressStrip,
        (notice || error) ? h('div', { className: 'stars-banner', 'data-tone': error ? 'error' : notice?.tone },
          h('span', null, error ? `${t('errorPrefix')}：${error}` : notice?.text),
          h('button', { className: 'stars-btn', style: { marginLeft: 'auto', height: 22 }, onClick: () => { setNotice(null); setError(null) } }, '×')) : null,
        h('div', { className: 'stars-body' },
          rail,
          h('div', { className: 'stars-main' },
            toolbar,
            distStrip,
            tab === 'updates' ? updatesView : tab === 'ops' ? opsView : table,
            pager,
            currentList && orphanNames.length > 0
              ? h('div', { className: 'stars-orphans' },
                h('button', { className: 'stars-orphantoggle', onClick: () => setOrphansOpen((prev) => !prev) },
                  `${orphansOpen ? '▾' : '▸'} ${orphanNames.length} 个已不在 star 里的成员`),
                orphansOpen
                  ? h('div', null, ...orphanNames.map((name) => h('div', { className: 'stars-orphanrow', key: name },
                    h('span', { className: 'stars-dim' }, name),
                    h('button', { className: 'stars-btn', style: { height: 22 }, disabled: busy || syncing, onClick: () => removeOrphan(currentList.id, name).catch(() => {}) }, '移出'))))
                  : null)
              : null)),
        foot,
        detailRepo && h(RepoDetail, { key: detailRepo.id, repo: detailRepo, viewer: data.viewer, lists,
          suggestion: suggestions[detailRepo.nameWithOwner], onClose: () => setDetail(null) }),
        viewEditor?.viewer && viewEditor.viewer === data.viewer && h(Dialog, { label: '保存视图', onClose: () => setViewEditor(null) },
          h(ViewEditor, { view: viewEditor.view, summary, busy, error, onClose: () => setViewEditor(null),
            onSave: (name, editing) => changeView('saveView', name, editing).catch(() => {}),
            onDelete: () => changeView('deleteView', null, true).catch(() => {}) })),
        dialog)
    }

    function SidebarIcon({ size, active }) {
      return h('span', { style: { display: 'inline-flex', color: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor' } }, h(StarIcon, { size: size ?? 16 }))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ensureCss()
        // 进入 app 就先热一次，不要等用户点开面板才开始。
        void warmUp()
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-stars: dictionaries')
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, StarsPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 40,
          locale: NS,
          label: () => 'Star 管理',
        }, SidebarIcon))
      },
    }
  },
})
