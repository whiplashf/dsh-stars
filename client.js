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
      syncDone: '同步完成',
      progressMeta: (done, total, applied, failed) => `${done}/${total} 已处理 · 写回 ${applied}${failed > 0 ? ` · 失败 ${failed}` : ''}`,
      progressCurrent: (name) => `正在写 ${name}`,
      synced: (n) => `已同步 ${n} 个仓库`,
      syncFailed: (n) => `${n} 个仓库同步失败`,
      nothingToSync: '没有待同步的改动',
      all: '全部',
      unsorted: '未归类',
      suggestHint: '建议分类',
      changes: '变更',
      lists: '列表',
      search: '搜索仓库名、描述或 topic',
      only: '筛选',
      onlyAll: '全部',
      onlyArchived: '已归档',
      onlyStale: '超一年未更新',
      onlyPending: '待同步',
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
      unread: (n) => `${n} 条未读变更`,
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
      progressCurrent: (name) => `Writing ${name}`,
      synced: (n) => `Synced ${n} repositories`,
      syncFailed: (n) => `${n} repositories failed`,
      nothingToSync: 'Nothing to sync',
      all: 'All',
      unsorted: 'Unsorted',
      suggestHint: 'By suggestion',
      changes: 'Changes',
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
      unread: (n) => `${n} unread changes`,
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
      },
      errorPrefix: 'Failed',
    }

    const CSS = `
.stars-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}
.stars-head{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.stars-headtext{display:flex;flex-direction:column;gap:2px;min-width:0}
.stars-title{font-size:15px;font-weight:600;letter-spacing:.01em}
.stars-meta{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stars-grow{flex:1}
.stars-btn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;white-space:nowrap}
.stars-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.stars-btn:disabled{opacity:.5;cursor:default}
.stars-btn[data-kind=primary]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.stars-btn[data-kind=primary]:hover:not(:disabled){filter:brightness(1.08);color:#fff}
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
.stars-dialogbox{width:340px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);padding:16px;display:flex;flex-direction:column;gap:10px}
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
.stars-auth{margin:12px 16px 0;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-left:3px solid var(--dsw-alias-state-warning-primary);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:8px;font-size:12px}
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
      const [only, setOnly] = React.useState('all')
      const [suggestFilter, setSuggestFilter] = React.useState(null)
      const [selected, setSelected] = React.useState(() => new Set())
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [creating, setCreating] = React.useState(false)
      const [newListName, setNewListName] = React.useState('')
      const [job, setJob] = React.useState(null)
      const [copied, setCopied] = React.useState(false)
      const pollingRef = React.useRef(false)
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
            if (value?.syncJob) setJob(value.syncJob)
            if (!value?.syncJob?.running) {
              if (Array.isArray(value?.repos)) setData(value)
              const failed = value?.syncJob?.failed?.length ?? 0
              const applied = value?.syncJob?.applied ?? 0
              if (failed > 0) {
                setNotice({ tone: 'error', text: `${t('syncFailed', failed)}：${value.syncJob.failed[0]?.message ?? ''}` })
              } else {
                setNotice({ tone: 'ok', text: applied > 0 ? t('synced', applied) : t('nothingToSync') })
              }
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

      const inTab = React.useMemo(() => {
        if (tab === 'all') return repos
        if (tab === 'unsorted') return repos.filter((repo) => (repo.desired ?? []).length === 0)
        if (tab === 'changes') return []
        return repos.filter((repo) => (repo.desired ?? []).includes(tab))
      }, [repos, tab])

      const shown = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        return inTab.filter((repo) => {
          if (suggestFilter && suggestions[repo.nameWithOwner]?.list !== suggestFilter) return false
          if (only === 'archived' && !repo.archived) return false
          if (only === 'stale' && !repo.stale) return false
          if (only === 'pending' && !(repo.pending?.add?.length || repo.pending?.remove?.length)) return false
          if (!needle) return true
          return [repo.nameWithOwner, repo.description, ...(repo.topics ?? [])]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(needle))
        })
      }, [inTab, only, query, suggestFilter, suggestions])

      const unread = data?.unreadCount ?? 0
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

      const toggle = (name) => {
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(name)) next.delete(name)
          else next.add(name)
          return next
        })
      }

      const toggleAll = () => {
        setSelected((prev) => (prev.size === shown.length ? new Set() : new Set(shown.map((repo) => repo.nameWithOwner))))
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

      const doSync = async () => {
        const value = await run({ action: 'sync' })
        if (value?.syncJob) setJob(value.syncJob)
        if (value?.syncJob?.running) {
          await followSync()
        } else if (value?.syncJob) {
          setNotice({ tone: 'ok', text: t('nothingToSync') })
        }
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

      const head = h('div', { className: 'stars-head' },
        h(StarIcon, { size: 18 }),
        h('div', { className: 'stars-headtext' },
          h('div', { className: 'stars-title' }, t('title')),
          h('div', { className: 'stars-meta' },
            data.snapshotAt ? `${t('snapshotAt')} ${relative(data.snapshotAt)} · ${data.repos.length} 个 star` : t('never'),
            unread > 0 ? ` · ${t('unread', unread)}` : '')),
        h('div', { className: 'stars-grow' }),
        h('button', { className: 'stars-btn', disabled: busy || syncing, onClick: () => run({ action: 'refresh' }).catch(() => {}) }, busy || syncing ? '…' : t('refresh')),
        h('button', {
          className: 'stars-btn',
          disabled: busy || syncing || pendingCount === 0 || authBlocked || scopeMissing,
          title: authBlocked || scopeMissing ? t('syncBlocked') : undefined,
          onClick: () => doSync().catch(() => {}),
        }, syncing
          ? `${t('syncing')} ${job.done}/${job.total}`
          : pendingCount > 0 ? `${t('sync')} (${pendingCount})` : t('sync')),
        h('button', { className: 'stars-btn', disabled: unread === 0 || syncing, onClick: () => run({ action: 'markViewed' }).catch(() => {}) }, t('markRead')))

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
          h('span', { className: 'stars-progresslabel' }, t('syncProgress')),
          h('div', { className: 'stars-progresstrack' },
            h('div', { className: 'stars-progressfill', 'data-done': String(job.done >= job.total), style: { width: `${Math.max(percent, 2)}%` } })),
          h('span', { className: 'stars-progresspct' }, `${percent}%`),
          h('span', { className: 'stars-progressmeta' }, t('progressMeta', job.done, job.total, job.applied, job.failed?.length ?? 0)),
          job.current ? h('span', { className: 'stars-progresscurrent', title: job.current }, t('progressCurrent', job.current)) : null)
        : null

      const railItem = (key, label, count, tone) => h('div', {
        key,
        className: 'stars-railitem',
        'data-active': String(tab === key),
        onClick: () => { setTab(key); setSelected(new Set()) },
      }, h('span', null, label), h('span', { className: 'stars-railcount' }, count))

      const rail = h('div', { className: 'stars-rail' },
        railItem('all', t('all'), repos.length),
        railItem('unsorted', t('unsorted'), unsortedCount),
        railItem('changes', t('changes'), data.changes?.length ?? 0),
        h('div', { className: 'stars-railgroup' }, t('lists')),
        ...lists.map((list) => railItem(list.id, list.name, list.count ?? 0)),
        h('div', {
          className: 'stars-railitem',
          onClick: () => { setCreating(true); setNewListName('') },
        }, h('span', { style: { color: 'var(--dsw-alias-brand-primary)' } }, `+ ${t('createList')}`)))

      const toolbar = tab === 'changes' ? null : h('div', { className: 'stars-toolbar' },
        h('input', {
          className: 'stars-input',
          placeholder: t('search'),
          value: query,
          onChange: (event) => setQuery(event.target.value),
        }),
        h('select', { className: 'stars-select', value: only, onChange: (event) => setOnly(event.target.value) },
          h('option', { value: 'all' }, t('onlyAll')),
          h('option', { value: 'pending' }, t('onlyPending')),
          h('option', { value: 'stale' }, t('onlyStale')),
          h('option', { value: 'archived' }, t('onlyArchived'))),
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
              : null)
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

      const changeView = h('div', { className: 'stars-changes' },
        (data.changes ?? []).length === 0
          ? h('div', { className: 'stars-empty' }, t('emptyChanges'))
          : data.changes.map((change) => h('div', { className: 'stars-change', key: change.id },
            h('span', { className: 'stars-changedate' }, formatDate(change.at)),
            h('span', { className: 'stars-chip', 'data-tone': change.kind === 'archived' || change.kind === 'gone' ? 'error' : 'brand' }, t('kinds')[change.kind] ?? change.kind),
            change.url
              ? h('a', { className: 'stars-repolink', href: change.url, target: '_blank', rel: 'noreferrer', style: { fontSize: 12 } }, change.nameWithOwner)
              : h('span', { className: 'stars-dim' }, change.nameWithOwner ?? ''),
            h('span', { className: 'stars-dim' }, change.text))))

      const row = (repo) => {
        const suggested = suggestions[repo.nameWithOwner]
        const pending = Boolean(repo.pending?.add?.length || repo.pending?.remove?.length)
        const chips = (repo.desired ?? []).map((id) => lists.find((list) => list.id === id)?.name).filter(Boolean)
        return h('tr', { className: 'stars-row', key: repo.nameWithOwner },
          h('td', { style: { width: 28 } },
            h('input', { className: 'stars-cb', type: 'checkbox', checked: selected.has(repo.nameWithOwner), onChange: () => toggle(repo.nameWithOwner) })),
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
              ...chips.map((name) => h('span', { className: 'stars-chip', key: name }, name)),
              pending ? h('span', { className: 'stars-chip', 'data-tone': 'brand', key: '__pending' }, t('pendingChip')) : null,
              repo.archived ? h('span', { className: 'stars-chip', 'data-tone': 'warn', key: '__arch' }, t('archived')) : null,
              repo.stale ? h('span', { className: 'stars-chip', 'data-tone': 'warn', key: '__stale' }, t('stale')) : null,
              chips.length === 0 && !pending && !repo.archived && !repo.stale
                ? h('span', { className: 'stars-dim' }, t('unsorted'))
                : null)),
          h('td', null, h('span', { className: 'stars-num' }, `★ ${repo.stars ?? 0}`)),
          h('td', null, h('span', { className: 'stars-dim', title: formatDate(repo.pushedAt) }, relative(repo.pushedAt))))
      }

      const table = h('div', { className: 'stars-scroll' },
        shown.length === 0
          ? h('div', { className: 'stars-empty' }, query ? t('emptySearch') : t('empty'))
          : h('table', { className: 'stars-table' },
            h('thead', null, h('tr', null,
              h('th', { style: { width: 28 } }, h('input', {
                className: 'stars-cb',
                type: 'checkbox',
                title: t('selectAll'),
                checked: shown.length > 0 && selected.size === shown.length,
                onChange: toggleAll,
              })),
              h('th', null, t('name')),
              h('th', null, t('type')),
              h('th', null, t('stars')),
              h('th', null, t('updated')))),
            h('tbody', null, ...shown.map(row))))

      const foot = h('div', { className: 'stars-foot' },
        h('span', null, `${repos.length} 个 star · ${lists.length} 个列表 · ${unsortedCount} 个未归类`),
        data.lastViewedAt ? h('span', null, `${t('lastViewed')} ${relative(data.lastViewedAt)}`) : null,
        data.viewer ? h('a', { className: 'stars-repolink', style: { fontSize: 11, marginLeft: 'auto' }, href: `https://github.com/stars/${data.viewer}/lists`, target: '_blank', rel: 'noreferrer' }, t('openOnGithub')) : null,
        data.error ? h('span', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, `${data.error.code}: ${data.error.message}`) : null)

      return h('div', { className: 'stars-root' },
        head,
        authCard,
        progressStrip,
        (notice || error) ? h('div', { className: 'stars-banner', 'data-tone': notice?.tone ?? 'error' },
          h('span', null, notice?.text ?? `${t('errorPrefix')}：${error}`),
          h('button', { className: 'stars-btn', style: { marginLeft: 'auto', height: 22 }, onClick: () => { setNotice(null); setError(null) } }, '×')) : null,
        h('div', { className: 'stars-body' },
          rail,
          h('div', { className: 'stars-main' }, toolbar, distStrip, tab === 'changes' ? changeView : table)),
        foot,
        creating ? h('div', { className: 'stars-dialog', onClick: () => setCreating(false) },
          h('div', { className: 'stars-dialogbox', onClick: (event) => event.stopPropagation() },
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
              h('button', { className: 'stars-btn', onClick: () => setCreating(false) }, t('cancel')),
              h('button', { className: 'stars-btn', 'data-kind': 'primary', disabled: !newListName.trim() || busy, onClick: () => createList().catch(() => {}) }, t('create')))))
          : null)
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
