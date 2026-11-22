/**
 * dsh-stars 宿主半边。
 *
 * 只做一件事：给浏览器面板提供一对经过 DSH 认证的 JSON 接口 `/api/dsh-stars`。
 * 走 `ctx.connection.fetch`（Owner Peer + Host/Origin 栅栏），不额外开端口，
 * 也不把 GitHub token 交给浏览器。
 */
import os from 'node:os'
import path from 'node:path'
import { GitHub, GitHubError } from './src/github.js'
import { Store } from './src/store.js'
import { DEFAULT_RULES, suggestAll } from './src/classify.js'

const ROUTE = '/api/dsh-stars'
const DEFAULT_MIN_REFRESH_MS = 10 * 60 * 1000
/** 同步写回 GitHub 的并发数：86 条串行要 1 分钟，4 并发够快又不会触发二级限流。 */
const DEFAULT_SYNC_CONCURRENCY = 4

export const name = 'dsh-stars'
export const inject = ['connection']

function expandHome(value) {
  if (typeof value !== 'string' || value === '') return null
  return value.startsWith('~') ? path.join(os.homedir(), value.slice(1)) : path.resolve(value)
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function describe(error) {
  if (error instanceof GitHubError) return { code: error.code, message: error.message }
  return { code: 'internal', message: error?.message ?? String(error) }
}

export function apply(ctx, config = {}) {
  const stateFile = expandHome(config.stateFile)
    ?? path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'data', 'dsh-stars', 'state.json')
  const store = new Store(stateFile)
  const github = new GitHub({ ghPath: config.ghPath, timeoutMs: config.timeoutMs })
  const minRefreshMs = Number.isFinite(config.minRefreshMs) ? config.minRefreshMs : DEFAULT_MIN_REFRESH_MS
  const staleDays = Number.isFinite(config.staleDays) ? config.staleDays : 365
  const rules = config.suggestRules ?? DEFAULT_RULES
  const syncConcurrency = Math.max(1, Math.min(8, Number.isFinite(config.syncConcurrency) ? config.syncConcurrency : DEFAULT_SYNC_CONCURRENCY))

  /** 同一时间只允许一次抓取；面板反复刷新时复用同一个 Promise。 */
  let inFlight = null
  let lastError = null
  /**
   * gh 的登录状态。陌生人第一次打开面板时最常见的卡点不是 bug 而是没登录/缺 user scope，
   * 所以把它当成一等状态暴露给面板，而不是等抓取失败再报一句看不懂的错。
   */
  let auth = null
  let authAt = 0
  const AUTH_TTL_MS = 30_000

  async function probeAuth(force = false) {
    if (!force && auth && Date.now() - authAt < AUTH_TTL_MS) return auth
    auth = await github.probeAuth()
    authAt = Date.now()
    return auth
  }
  /**
   * 同步任务的实时进度。sync 不再是一次阻塞到结束的请求：
   * 启动后立刻返回，面板轮询 `progress`，所以 86 条写回中途也能看到 done/total。
   */
  let syncJob = null

  function jobSnapshot() {
    if (!syncJob) return null
    return { ...syncJob, failed: syncJob.failed.map((failure) => ({ ...failure })) }
  }

  function refresh() {
    if (!inFlight) {
      inFlight = (async () => {
        try {
          const fetched = await github.fetchAll()
          store.applyFetch(fetched, { staleDays })
          await store.save()
          lastError = null
        } catch (error) {
          lastError = describe(error)
          throw error
        } finally {
          inFlight = null
        }
      })()
    }
    return inFlight
  }

  function view() {
    const result = store.view()
    return {
      ...result,
      suggestions: suggestAll(result.repos, rules),
      error: lastError,
      staleDays,
      auth,
      syncJob: jobSnapshot(),
    }
  }

  async function readState({ force = false } = {}) {
    await store.load()
    // 同步进行中不重抓：抓回来的 Lists 归属还是旧的，会把面板状态抖回去。
    if (syncJob?.running) return view()
    const status = await probeAuth()
    // 连不上 gh 的两种状态没必要再发一次注定失败的抓取，直接把引导带回去。
    if (status.state === 'no-gh' || status.state === 'not-logged-in') {
      if (!lastError) lastError = { code: 'unauthenticated', message: status.state === 'no-gh' ? '找不到 gh 命令' : 'gh 还没有登录' }
      return view()
    }
    const snapshotAt = store.state.snapshotAt
    const stale = !snapshotAt || Date.now() - Date.parse(snapshotAt) > Math.max(0, minRefreshMs)
    if (force || stale) {
      try {
        await refresh()
      } catch {
        // 抓取失败时继续用旧快照，错误通过 view().error 暴露给面板。
      }
    }
    return view()
  }

  /** 后台跑同步任务；每写回一条就落盘一次，断掉也不会丢已完成的进度。 */
  async function runSync(job, plans) {
    let cursor = 0
    const take = () => (cursor < plans.length ? plans[cursor++] : null)
    const worker = async () => {
      for (let plan = take(); plan; plan = take()) {
        job.current = plan.nameWithOwner
        try {
          await github.setItemLists(plan.itemId, plan.to)
          store.markSynced(plan.nameWithOwner, plan.to)
          job.applied += 1
          await store.save()
        } catch (error) {
          job.failed.push({ nameWithOwner: plan.nameWithOwner, ...describe(error) })
        }
        job.done += 1
      }
    }
    try {
      const workers = Math.min(syncConcurrency, plans.length)
      await Promise.all(Array.from({ length: workers }, () => worker()))
    } catch (error) {
      job.error = describe(error)
    } finally {
      job.running = false
      job.current = null
      job.finishedAt = new Date().toISOString()
      try {
        await store.save()
      } catch {
        // 收尾落盘失败不影响已经写回 GitHub 的结果。
      }
    }
  }

  async function startSync({ dryRun = false } = {}) {
    await store.load()
    const status = await probeAuth()
    // 缺 user scope 时写回必然 403，提前说清楚比跑到一半失败好。
    if (status.state === 'missing-user-scope') {
      throw new GitHubError('scope', 'gh token 缺少 user scope，先运行 gh auth refresh -h github.com -s user；只读和暂存不受影响')
    }
    if (syncJob?.running) return jobSnapshot()
    const plans = store.planSync()
    if (dryRun || plans.length === 0) {
      await store.save()
      syncJob = {
        running: false,
        total: 0,
        done: 0,
        applied: 0,
        failed: [],
        current: null,
        startedAt: null,
        finishedAt: new Date().toISOString(),
      }
      return jobSnapshot()
    }
    syncJob = {
      running: true,
      total: plans.length,
      done: 0,
      applied: 0,
      failed: [],
      current: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    }
    const job = syncJob
    void runSync(job, plans)
    return jobSnapshot()
  }

  async function dispatch(payload) {
    const action = typeof payload?.action === 'string' ? payload.action : ''
    switch (action) {
      case 'state':
        return readState({ force: Boolean(payload.force) })
      case 'refresh':
        return readState({ force: true })
      case 'stage': {
        await store.load()
        if (syncJob?.running) throw new GitHubError('busy', '正在同步到 GitHub，等进度跑完再改归类')
        const touched = store.stage(payload.fullNames, { add: payload.add, remove: payload.remove })
        await store.save()
        return { touched, ...view() }
      }
      case 'acceptSuggestions': {
        // 只做暂存：把每条建议落到对应列表的 pending.add 上，写回 GitHub 仍要用户点一次「同步」。
        await store.load()
        if (syncJob?.running) throw new GitHubError('busy', '正在同步到 GitHub，等进度跑完再改归类')
        const suggestions = suggestAll(store.view().repos, rules)
        const byName = new Map(store.state.lists.map((list) => [list.name, list.id]))
        const groups = new Map()
        let created = 0
        let kept = 0
        for (const [fullName, suggestion] of Object.entries(suggestions)) {
          const repo = store.state.repos[fullName]
          if (!repo) continue
          // 已经归过类（或已在待同步队列里）的仓库不强行塞第二个分类。
          if ((repo.lists ?? []).length > 0 || (repo.pending?.add ?? []).length > 0) {
            kept += 1
            continue
          }
          let listId = byName.get(suggestion.list)
          if (!listId) {
            const list = await github.createList(suggestion.list, 'dsh-stars 自动创建')
            store.setList(list)
            byName.set(list.name, list.id)
            listId = list.id
            created += 1
          }
          if (!groups.has(listId)) groups.set(listId, [])
          groups.get(listId).push(fullName)
        }
        let staged = 0
        for (const [listId, names] of groups) {
          staged += store.stage(names, { add: [listId], remove: [] })
        }
        await store.save()
        return { created, staged, kept, ...view() }
      }
      case 'sync': {
        // 立刻返回 job（running=true），写回在后台继续；面板用 progress 轮询。
        const job = await startSync({ dryRun: Boolean(payload.dryRun) })
        return { ...view(), syncJob: job }
      }
      case 'checkAuth': {
        await store.load()
        const status = await probeAuth(true)
        if (status.state === 'ok') lastError = null
        // 刚在终端里登录完就点「重新检查」时，顺便把数据抓回来。
        if (status.state === 'ok') {
          try {
            await refresh()
          } catch {
            // 抓取失败照旧走 view().error。
          }
        }
        return view()
      }
      case 'progress': {
        await store.load()
        const job = jobSnapshot()
        // 跑完就把完整视图带回去，面板可以一次性换成同步后的状态。
        if (job?.running) return { syncJob: job }
        return { syncJob: job, ...view() }
      }
      case 'createList': {
        await store.load()
        const name = String(payload.name ?? '').trim()
        if (!name) throw new GitHubError('invalid', '列表名不能为空')
        const created = await github.createList(name, String(payload.description ?? ''), Boolean(payload.isPrivate))
        store.setList(created)
        await store.save()
        return view()
      }
      case 'markViewed': {
        await store.load()
        store.markViewed()
        await store.save()
        return view()
      }
      default:
        throw new GitHubError('invalid', `未知操作：${action || '(空)'}`)
    }
  }

  async function handle(request) {
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method not allowed' })
    let payload
    try {
      payload = await request.json()
    } catch {
      return json(400, { ok: false, error: '请求体不是合法 JSON' })
    }
    try {
      const value = await dispatch(payload)
      return json(200, { ok: true, value })
    } catch (error) {
      const detail = describe(error)
      const status = detail.code === 'unauthenticated' ? 401 : 400
      ctx.logger?.warn?.(`dsh-stars: ${detail.code} ${detail.message}`)
      return json(status, { ok: false, ...detail })
    }
  }

  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: handle,
  }), 'dsh-stars: rpc route')

  ctx.logger?.info?.(`dsh-stars: ready, state=${stateFile}`)
}
