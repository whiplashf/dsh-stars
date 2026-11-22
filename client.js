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
      selectAllShown: (n) => `全选 ${n}`,
      clearSelection: '清除选择',
      deleteList: '删除分类',
      unstar: '取消 star',
      remove: '移出',
      deleteTitle: (name) => `删除分类「${name}」`,
      deleteEmptyHint: '这个分类是空的，删除后不可恢复。',
      deleteBusyHint: (n) => `里面有 ${n} 个仓库，先选择它们的去向：`,
      deleteToUnsorted: '变未归类',
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
.stars-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}
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
.stars-railitem{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:var(--dsw-radius-sm);cursor:pointer;color:var(--dsw-alias-label-secondary);user-select:none}
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
.stars-empty{display:flex;align-items:center;justify-content:center;height:200px;color:var(--dsw-alias-label-tertiary);font-size:13px}
.stars-banner{margin:12px 16px 0;padding:8px 12px;border-radius:var(--dsw-radius-sm);font-size:12px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary);display:flex;gap:8px;align-items:center}
.stars-banner[data-tone=ok]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);color:var(--dsw-alias-state-success-primary)}
.stars-suggest{margin-top:4px}
.stars-suggestbtn{border:1px dashed color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent);background:transparent;color:var(--dsw-alias-brand-primary);font-size:11px;padding:2px 8px;border-radius:999px;cursor:pointer}
.stars-suggestbtn:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.stars-changes{padding:14px 20px;display:flex;flex-direction:column;gap:6px;overflow:auto}
.stars-change{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-card-fill)}
.stars-changedate{font-size:11px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;min-width:62px}
.stars-dialog{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.32);z-index:50}
.stars-chipbtn{font-size:11px;padding:2px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap}
.stars-chipbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.stars-chipbtn[data-active=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.stars-sortth{cursor:pointer;user-select:none;white-space:nowrap}
.stars-sortth:hover{color:var(--dsw-alias-label-primary)}
.stars-sortmark{margin-left:4px;font-size:9px;color:var(--dsw-alias-brand-primary)}
.stars-rowmeta{display:flex;align-items:center;gap:8px;justify-content:space-between}
.stars-rowact{font-size:11px;padding:1px 6px;border-radius:var(--dsw-radius-sm);border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;opacity:0;transition:opacity .12s ease}
.stars-tr:hover .stars-rowact,.stars-row:hover .stars-rowact{opacity:1}
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
.stars-dialogbox{max-height:80vh;overflow:auto;width:420px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);padding:16px;display:flex;flex-direction:column;gap:10px}
.stars-dialogtitle{font-size:14px;font-weight:600}
.stars-dialogactions{display:flex;justify-content:flex-end;gap:8px}
.stars-cb{width:14px;height:14px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.stars-dist{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:8px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.stars-distlabel{font-size:11px;color:var(--dsw-alias-label-caption);letter-spacing:.04em}
.stars-distchip{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:2px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer}
.stars-distchip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.stars-distchip[data-active=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.stars-distcount{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}
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
.stars-repolink:hover{color:var(--dsw-alias-link);text-decoration:underline}
.stars-row[data-selected=true] td{background:color-mix(in srgb,var(--dsw-alias-link) 7%,transparent)}
.stars-num{color:var(--dsw-alias-label-secondary)}
.stars-stars{color:var(--dsw-alias-state-warn-primary);font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.stars-chip[data-color]{background:color-mix(in srgb,var(--stars-c) 15%,transparent);color:var(--dsw-alias-label-secondary)}
.stars-chip[data-color] .stars-dot{background:var(--stars-c)}
.stars-chip[data-tone=brand]{background:color-mix(in srgb,var(--dsw-alias-link) 14%,transparent);color:var(--dsw-alias-link)}
.stars-lang{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.stars-langdot{width:8px;height:8px;border-radius:50%;background:var(--stars-c6);display:inline-block}
.stars-change[data-kind=new] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}
.stars-change[data-kind=release] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-link) 14%,transparent);color:var(--dsw-alias-link)}
.stars-change[data-kind=commits] .stars-chip{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.stars-change[data-kind=stars] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary)}
.stars-change[data-kind=archived] .stars-chip,.stars-change[data-kind=gone] .stars-chip,.stars-change[data-kind=unstarred] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);color:var(--dsw-alias-state-error-primary)}
.stars-change:hover{background:var(--dsw-alias-card-fill-hover)}
.stars-changesum{margin:0 0 6px;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.stars-emptyhint{display:flex;flex-direction:column;align-items:center;gap:6px;height:220px;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center;padding:0 24px;line-height:1.7}
.stars-progressfill{background:var(--dsw-alias-link)}
.stars-track{opacity:0}
.stars-track[data-on=true]{opacity:1;color:var(--dsw-alias-link)}
.stars-track[data-on=true]:hover{color:var(--dsw-alias-link)}
.stars-change[data-kind=assign] .stars-chip,.stars-change[data-kind=sync] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-link) 14%,transparent);color:var(--dsw-alias-link)}
.stars-change[data-kind=remove] .stars-chip,.stars-change[data-kind=deleteList] .stars-chip{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary)}
.stars-change[data-kind=organize] .stars-chip,.stars-change[data-kind=createList] .stars-chip{background:color-mix(in srgb,var(--stars-c4) 18%,transparent);color:var(--stars-c4)}
`

    function ensureCss() {
      const tag = 'style[data-plugin-css="dsh-stars"]'
      if (typeof document === 'undefined' || document.querySelector(tag)) return
      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-stars'
      style.dataset.pluginCss = 'dsh-stars'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    async function rpc(payload) {
      const response = await fetch(RPC_PATH, {
        method: 'POST',
        credentials: 'include',
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

    function StarsPage() {
      const [data, setData] = React.useState(null)
      const [tab, setTab] = React.useState('all')
      const [query, setQuery] = React.useState('')
      const [chips, setChips] = React.useState(() => new Set())
      const [lang, setLang] = React.useState('all')
      const [sort, setSort] = React.useState(() => readSort())
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
      const [confirm, setConfirm] = React.useState(null)
      const [orphansOpen, setOrphansOpen] = React.useState(false)
      const [ai, setAi] = React.useState(null)
      const pollingRef = React.useRef(false)
      const lastToggled = React.useRef(null)
      const t = React.useMemo(() => (key, ...args) => {
        const value = zh[key] ?? en[key]
        return typeof value === 'function' ? value(...args) : value ?? key
      }, [])

      const run = React.useCallback(async (payload) => {
        setBusy(true)
        setError(null)
        try {
          const value = await rpc(payload)
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
      }, [tab, query, chips, lang])

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

      const allShownSelected = shown.length > 0 && shown.every((repo) => selected.has(repo.nameWithOwner))
      const toggleAll = () => {
        setSelected(allShownSelected ? new Set() : new Set(shown.map((repo) => repo.nameWithOwner)))
      }

      const stage = async (fullNames, { add = [], remove = [] }) => {
        if (!fullNames.length) return
        await run({ action: 'stage', fullNames, add, remove })
        setSelected(new Set())
        setNotice({ tone: 'ok', text: `已暂存，记得点「${t('sync')}」写回 GitHub` })
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

      const confirmSync = async () => {
        const expected = preview?.plan?.length ?? 0
        setPreview(null)
        try {
          await startAndFollow(await run({ action: 'sync', expectCount: expected }))
        } catch (cause) {
          if (cause?.code === 'conflict') setNotice({ tone: 'error', text: cause.message })
          else throw cause
        }
      }

      const askUnstar = (names) => {
        if (!names.length) return
        setConfirm({ type: 'unstar', names })
      }

      const doUnstar = async () => {
        const names = confirm?.names ?? []
        setConfirm(null)
        const value = await run({ action: 'unstar', fullNames: names })
        setSelected(new Set())
        await startAndFollow(value)
      }

      const askDeleteList = (list) => setConfirm({ type: 'deleteList', list, mode: 'unsorted', targetListId: '' })

      const doDeleteList = async () => {
        const dialog = confirm
        setConfirm(null)
        const value = await run({
          action: 'deleteList',
          listId: dialog.list.id,
          mode: dialog.mode,
          targetListId: dialog.mode === 'move' ? dialog.targetListId : undefined,
        })
        if (tab === dialog.list.id) setTab('all')
        await startAndFollow(value)
      }

      const runAi = async (mode, scope) => {
        setAi({ phase: 'running', mode })
        try {
          const result = await run({ action: 'organize', mode, scope })
          setAi({ phase: 'result', mode, result })
        } catch (cause) {
          setAi(null)
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
          h('div', { className: 'stars-empty' }, error ? `${t('errorPrefix')}：${error}` : t('loading')))
      }

      const syncing = Boolean(job?.running)
      const percent = job && job.total > 0 ? Math.round((job.done / job.total) * 100) : 0

      const authState = data.auth?.state ?? 'unknown'
      const authBlocked = authState === 'no-gh' || authState === 'not-logged-in'
      const scopeMissing = authState === 'missing-user-scope'
      const authCommand = data.auth?.command ?? ''

      const gotoUpdates = () => { setTab('updates'); setSelected(new Set()) }

      const head = h('div', { className: 'stars-head' },
        h('span', { className: 'stars-headicon' }, h(StarIcon, { size: 18 })),
        h('div', { className: 'stars-headtext' },
          h('div', { className: 'stars-title' }, t('title')),
          h('div', { className: 'stars-meta' },
            h('span', null, data.snapshotAt ? `${t('snapshotAt')} ${relative(data.snapshotAt)}` : t('never')),
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
          disabled: busy || syncing || pendingCount === 0 || authBlocked || scopeMissing,
          title: authBlocked || scopeMissing ? t('syncBlocked') : undefined,
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

      const railItem = (key, label, count, options = {}) => h('div', {
        key,
        className: 'stars-railitem',
        'data-active': String(tab === key),
        title: options.title,
        onClick: () => { setTab(key); setSelected(new Set()) },
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
        h('div', { className: 'stars-railgroup' }, t('lists')),
        ...lists.map((list) => railItem(list.id, list.name, list.count ?? 0, { color: colorOf(list.name) })),
        h('div', {
          className: 'stars-railitem',
          onClick: () => { setCreating(true); setNewListName('') },
        }, h('span', { style: { color: 'var(--dsw-alias-brand-primary)' } }, `+ ${t('createList')}`)))

      const chipButton = (key, label) => h('button', {
        key,
        className: 'stars-chipbtn',
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
          const next = { key, dir }
          setSort(next)
          writeSort(next)
        },
      },
      h('option', { value: 'starred:desc' }, t('sortStarred')),
      h('option', { value: 'pushedAt:desc' }, t('sortPushed')),
      h('option', { value: 'stars:desc' }, t('sortStars')),
      h('option', { value: 'name:asc' }, t('sortName')))

      const toolbar = tab === 'updates' || tab === 'ops' ? null : h('div', { className: 'stars-toolbar' },
        h('input', {
          className: 'stars-input',
          placeholder: t('search'),
          value: query,
          onChange: (event) => setQuery(event.target.value),
        }),
        chipButton('newRelease', t('chipNewRelease')),
        chipButton('recent', t('chipRecent')),
        chipButton('unsorted', t('chipUnsorted')),
        chipButton('archived', t('chipArchived')),
        h('select', { className: 'stars-select', value: lang, onChange: (event) => setLang(event.target.value) },
          h('option', { value: 'all' }, t('languageAll')),
          ...languages.map((name) => h('option', { key: name, value: name }, name))),
        sortSelect,
        selected.size > 0
          ? h(React.Fragment, null,
            h('span', { className: 'stars-selinfo' }, t('selected', selected.size)),
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
            tab !== 'all' && tab !== 'unsorted'
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
            h('input', { className: 'stars-cb', type: 'checkbox', checked: selected.has(repo.nameWithOwner), onChange: (event) => toggle(repo.nameWithOwner, index, event) })),
          h('td', null,
            h('div', { className: 'stars-repo' },
              h('a', { className: 'stars-repolink', href: repo.url, target: '_blank', rel: 'noreferrer' }, repo.nameWithOwner),
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
              }, h('span', { className: 'stars-dot' }), name)),
              pending ? h('span', { className: 'stars-chip', 'data-tone': 'brand', key: '__pending' }, t('pendingChip')) : null,
              repo.archived ? h('span', { className: 'stars-chip', 'data-tone': 'warn', key: '__arch' }, t('archived')) : null,
              repo.stale ? h('span', { className: 'stars-chip', 'data-tone': 'warn', key: '__stale' }, t('stale')) : null,
              chips.length === 0 && !pending && !repo.archived && !repo.stale
                ? h('span', { className: 'stars-dim' }, t('unsorted'))
                : null)),
          h('td', null, h('span', { className: 'stars-stars', title: `${repo.stars ?? 0} stars` }, `★ ${repo.stars ?? 0}`)),
          h('td', null,
            h('div', { className: 'stars-rowmeta' },
              repo.language
                ? h('span', { className: 'stars-lang' },
                  h('span', { className: 'stars-langdot', style: { '--stars-c6': colorOf(repo.language) } }),
                  repo.language)
                : null,
              h('span', { className: 'stars-dim', title: formatDate(repo.pushedAt) }, relative(repo.pushedAt)),
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

      const sortTh = (key, label) => h('th', {
        className: 'stars-sortth',
        onClick: () => {
          const next = sort.key === key
            ? { key, dir: sort.dir === 'desc' ? 'asc' : 'desc' }
            : { key: key === 'name' ? 'name' : key, dir: key === 'name' ? 'asc' : 'desc' }
          setSort(next)
          writeSort(next)
        },
      }, h('span', null, label), sort.key === key ? h('span', { className: 'stars-sortmark' }, sort.dir === 'desc' ? '▼' : '▲') : null)

      const table = h('div', { className: 'stars-scroll' },
        shown.length === 0
          ? h('div', { className: 'stars-empty' }, query ? t('emptySearch') : t('empty'))
          : h('table', { className: 'stars-table' },
            h('thead', null, h('tr', null,
              h('th', { style: { width: 28 } }, h('input', {
                className: 'stars-cb',
                type: 'checkbox',
                title: allShownSelected ? t('clearSelection') : t('selectAllShown', shown.length),
                checked: allShownSelected,
                onChange: toggleAll,
              })),
              sortTh('name', t('name')),
              h('th', null, t('type')),
              sortTh('stars', t('stars')),
              sortTh('pushedAt', t('updated')),
              h('th', { style: { width: 92 } }, ''))),
            h('tbody', null, ...shown.map((repo, index) => row(repo, index)))))

      const foot = h('div', { className: 'stars-foot' },
        h('span', null, `${repos.length} 个 star · ${lists.length} 个列表 · ${unsortedCount} 个未归类`),
        data.lastViewedAt ? h('span', null, `${t('lastViewed')} ${relative(data.lastViewedAt)}`) : null,
        data.viewer ? h('a', { className: 'stars-repolink', style: { fontSize: 11, marginLeft: 'auto' }, href: `https://github.com/stars/${data.viewer}/lists`, target: '_blank', rel: 'noreferrer' }, t('openOnGithub')) : null,
        data.error ? h('span', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, `${data.error.code}: ${data.error.message}`) : null)

        const closeDialog = () => { setCreating(false); setPreview(null); setConfirm(null); setAi(null) }

      const aiGroups = ai?.phase === 'result' ? (ai.result?.groups ?? []) : []
      const aiCount = aiGroups.reduce((sum, group) => sum + group.repos.length, 0)

      const dialogBody = ai?.phase === 'running'
        ? h(React.Fragment, null,
          h('div', { className: 'stars-dialogtitle' }, t('organizeRunning')),
          h('div', { className: 'stars-plansummary' }, t('organizeRunningHint', ai.result?.total ?? (unsortedCount || repos.length))),
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
              ? h('div', { className: 'stars-plansummary' }, t('organizeUnsorted', ai.result.unsorted.length))
              : null,
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
          ? h(React.Fragment, null,
            h('div', { className: 'stars-dialogtitle' }, t('planTitle', preview.plan.length)),
            h('div', { className: 'stars-plansummary' },
              ...(preview.summary?.added ?? []).map((entry) => h('span', { className: 'stars-chip', key: entry.name }, `${entry.name} ← ${entry.count} 个`)),
              preview.summary?.removed > 0 ? h('span', { className: 'stars-chip', 'data-tone': 'warn' }, t('planRemoved', preview.summary.removed)) : null),
            h('div', { className: 'stars-planlist' },
              ...preview.plan.slice(0, 50).map((entry) => h('div', { className: 'stars-planrow', key: entry.nameWithOwner },
                h('span', { className: 'stars-repolink' }, entry.nameWithOwner),
                h('span', { className: 'stars-dim' }, `${(entry.from ?? []).map((id) => lists.find((list) => list.id === id)?.name ?? id).join('、') || '未归类'} → ${(entry.to ?? []).map((id) => lists.find((list) => list.id === id)?.name ?? id).join('、') || '未归类'}`))),
              preview.plan.length > 50 ? h('div', { className: 'stars-dim' }, t('planMore', preview.plan.length - 50)) : null),
            h('div', { className: 'stars-dialogactions' },
              h('button', { className: 'stars-btn', onClick: closeDialog }, t('cancel')),
              h('button', { className: 'stars-btn', 'data-kind': 'primary', disabled: busy, onClick: () => confirmSync().catch(() => {}) }, t('writeBack', preview.plan.length))))
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
        ? h('div', { className: 'stars-dialog', onClick: closeDialog },
          h('div', { className: 'stars-dialogbox', onClick: (event) => event.stopPropagation() }, dialogBody))
        : null

      return h('div', { className: 'stars-root' },
        head,
        authCard,
        progressStrip,
        (notice || error) ? h('div', { className: 'stars-banner', 'data-tone': notice?.tone ?? 'error' },
          h('span', null, notice?.text ?? `${t('errorPrefix')}：${error}`),
          h('button', { className: 'stars-btn', style: { marginLeft: 'auto', height: 22 }, onClick: () => { setNotice(null); setError(null) } }, '×')) : null,
        h('div', { className: 'stars-body' },
          rail,
          h('div', { className: 'stars-main' },
            toolbar,
            distStrip,
            tab === 'updates' ? updatesView : tab === 'ops' ? opsView : table,
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
        dialog)
    }

    function SidebarIcon({ size, active }) {
      return h('span', { style: { display: 'inline-flex', color: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor' } }, h(StarIcon, { size: size ?? 16 }))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ensureCss()
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
