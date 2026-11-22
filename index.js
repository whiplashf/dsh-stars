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

  /** 同一时间只允许一次抓取；面板反复刷新时复用同一个 Promise。 */
  let inFlight = null
  let lastError = null

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
    }
  }

  async function readState({ force = false } = {}) {
    await store.load()
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

  async function sync({ dryRun = false } = {}) {
    await store.load()
    const plans = store.planSync()
    if (dryRun || plans.length === 0) {
      await store.save()
      return { applied: 0, failed: [], plans }
    }
    let applied = 0
    const failed = []
    for (const plan of plans) {
      try {
        await github.setItemLists(plan.itemId, plan.to)
        store.markSynced(plan.nameWithOwner, plan.to)
        applied += 1
      } catch (error) {
        failed.push({ nameWithOwner: plan.nameWithOwner, ...describe(error) })
      }
    }
    await store.save()
    return { applied, failed, plans }
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
        const touched = store.stage(payload.fullNames, { add: payload.add, remove: payload.remove })
        await store.save()
        return { touched, ...view() }
      }
      case 'sync': {
        const result = await sync({ dryRun: Boolean(payload.dryRun) })
        return { ...result, ...view() }
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
