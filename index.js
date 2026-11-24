/**
 * dsh-stars 宿主半边。
 *
 * 只做一件事：给浏览器面板提供一对经过 DSH 认证的 JSON 接口 `/api/dsh-stars`。
 * 走 `ctx.connection.fetch`（Owner Peer + Host/Origin 栅栏），不额外开端口，
 * 也不把 GitHub token 交给浏览器。
 */
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { GitHub, GitHubError } from './src/github.js'
import { Store, desiredLists } from './src/store.js'
import { deleteView, saveView } from './src/saved-views.js'
import { DEFAULT_RULES, suggestAll } from './src/classify.js'
import { MAX_REPOS_PER_CALL, askModel, buildPrompt, extractJson, normalizePlan, pickModel } from './src/organize.js'

const ROUTE = '/api/dsh-stars'
const REMOTE_WRITES = new Set(['sync', 'unstar', 'deleteList', 'removeOrphan', 'createList', 'acceptSuggestions', 'organizeApply'])

function sameViewer(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()
}
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
  if (error instanceof GitHubError) return { code: error.code, message: error.message, reason: error.details?.reason }
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
  const organizeProvider = typeof config.organizeProvider === 'string' && config.organizeProvider ? config.organizeProvider : null
  const organizeModel = typeof config.organizeModel === 'string' && config.organizeModel ? config.organizeModel : null

  /** 同一时间只允许一次抓取；面板反复刷新时复用同一个 Promise。 */
  let inFlight = null
  let lastError = null
  let preparingWrite = false
  let writeRevision = 0
  let retryRefreshAt = 0
  let needsRefresh = false
  /**
   * gh 的登录状态。陌生人第一次打开面板时最常见的卡点不是 bug 而是没登录/缺 user scope，
   * 所以把它当成一等状态暴露给面板，而不是等抓取失败再报一句看不懂的错。
   */
  let auth = null
  let authAt = 0
  let authPending = null
  const AUTH_TTL_MS = 30_000

  async function probeAuth(force = false) {
    if (!force && auth && Date.now() - authAt < AUTH_TTL_MS) return auth
    if (!force && authPending) return authPending
    const request = github.probeAuth()
    authPending = request
    try {
      const status = await request
      if (authPending === request) {
        auth = status
        authAt = Date.now()
      }
      return status
    } finally {
      if (authPending === request) authPending = null
    }
  }
  /**
   * 作业（job）：一次「已经在跟 GitHub 对话」的批量执行，带进度与失败清单。
   * v0.1 只有 sync，v0.2 起 unstar / deleteList 共用同一结构，同一时刻只允许一个在跑。
   */
  let job = null

  function jobSnapshot() {
    if (!job) return null
    return {
      ...job,
      failed: job.failed.map((failure) => ({ ...failure })),
      meta: job.meta ? { ...job.meta } : undefined,
    }
  }

  function jobRunning() {
    return Boolean(job?.running)
  }

  function startJob(kind, items, handler, meta = {}) {
    const created = {
      kind,
      running: true,
      total: items.length,
      done: 0,
      applied: 0,
      failed: [],
      current: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      meta,
    }
    job = created
    void runJob(created, items, handler)
    return created
  }

  /** 后台跑作业：固定并发、逐条落盘，断掉也不会丢已完成的进度。 */
  async function runJob(running, items, handler) {
    let cursor = 0
    const take = () => (cursor < items.length ? items[cursor++] : null)
    const worker = async () => {
      for (let item = take(); item; item = take()) {
        running.current = handler.label?.(item) ?? null
        try {
          await handler.run(item)
          running.applied += 1
          await store.save()
        } catch (error) {
          running.failed.push({ ...(handler.describe?.(item) ?? { nameWithOwner: String(item) }), ...describe(error) })
        }
        running.done += 1
      }
    }
    try {
      const workers = Math.max(1, Math.min(syncConcurrency, items.length))
      await Promise.all(Array.from({ length: workers }, () => worker()))
    } catch (error) {
      running.error = describe(error)
    } finally {
      // 收尾动作（例如「成员搬完才删分类」）也算作业的一部分，失败要记进 failed 而不是静默。
      if (typeof handler.finish === 'function') {
        try {
          await handler.finish(running)
        } catch (error) {
          running.error = describe(error)
          running.failed.push({ nameWithOwner: null, ...describe(error) })
        }
      }
      running.current = null
      running.finishedAt = new Date().toISOString()
      try {
        await store.save()
      } catch {
        // 每条成功的写入已单独落盘。
      }
      running.running = false
    }
  }

  function refresh(client) {
    const viewer = store.state.viewer
    if (inFlight && inFlight.viewer === viewer && inFlight.revision === writeRevision) return inFlight.promise
    const request = { viewer, revision: writeRevision }
    inFlight = request
    needsRefresh = false
    request.promise = (async () => {
      try {
        const fetched = await client.fetchAll()
        if (inFlight !== request) return
        if (request.revision !== writeRevision) {
          needsRefresh = true
          return
        }
        if (viewer && !sameViewer(viewer, fetched.viewer)) {
          throw new GitHubError('conflict', '抓取期间 GitHub 账号已变化，请重新刷新')
        }
        store.applyFetch(fetched, { staleDays })
        await store.save()
        lastError = null
        retryRefreshAt = 0
      } catch (error) {
        if (inFlight === request && request.revision === writeRevision) {
          lastError = describe(error)
          retryRefreshAt = Date.now() + 30_000
        }
        throw error
      } finally {
        if (inFlight === request) inFlight = null
      }
    })()
    return request.promise
  }

  function view() {
    const result = store.view()
    const snapshot = jobSnapshot()
    return {
      ...result,
      // 后台正在抓取时前端显示「正在刷新…」，不用傻等。
      refreshing: Boolean(inFlight),
      suggestions: suggestAll(result.repos, rules),
      error: lastError,
      staleDays,
      auth,
      job: snapshot,
      // 兼容 v0.1 的字段名：面板旧代码还在读 syncJob，下个版本删。
      syncJob: snapshot,
    }
  }

  async function readState({ force = false } = {}) {
    if (jobRunning() || preparingWrite) return view()
    const status = await probeAuth(force)
    if (jobRunning() || preparingWrite || status !== auth) return view()
    if (status.state === 'no-gh' || status.state === 'not-logged-in') {
      lastError = { code: 'unauthenticated', message: status.state === 'no-gh' ? '找不到 gh 命令' : 'gh 还没有登录' }
      return view()
    }
    const login = status.login
    if (login && store.selectViewer(login)) {
      inFlight = null
      job = null
      needsRefresh = false
      retryRefreshAt = 0
      lastError = null
    }
    const snapshotAt = store.state.snapshotAt
    const stale = needsRefresh || !snapshotAt || Date.now() - Date.parse(snapshotAt) > Math.max(0, minRefreshMs)
    if (force || !snapshotAt) {
      try {
        await refresh(login ? github.forAccount(login) : github)
      } catch {
        // 保留缓存，通过 view().error 告知刷新失败。
      }
    } else if (stale && Date.now() >= retryRefreshAt) {
      void refresh(login ? github.forAccount(login) : github).catch(() => {})
    }
    return view()
  }

  function summarizePlan(plans) {
    const byId = new Map(store.state.lists.map((list) => [list.id, list.name]))
    const added = new Map()
    let removed = 0
    for (const plan of plans) {
      const to = new Set(plan.to)
      const from = new Set(plan.from)
      for (const id of plan.to) {
        if (from.has(id)) continue
        const name = byId.get(id) ?? id
        added.set(name, (added.get(name) ?? 0) + 1)
      }
      removed += plan.from.filter((id) => !to.has(id)).length
    }
    return {
      total: plans.length,
      added: [...added].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      removed,
    }
  }

  function planVersion(plans) {
    const labels = new Map(store.state.lists.map((list) => [list.id, list.name]))
    const memberships = (ids) => [...ids].sort().map((id) => [id, labels.get(id)])
    const rows = plans.map(({ itemId, nameWithOwner, from, to }) => [
      itemId, nameWithOwner, memberships(from), memberships(to),
    ]).sort((a, b) => a[1].localeCompare(b[1]))
    return createHash('sha256').update(JSON.stringify([store.state.viewer, rows])).digest('hex')
  }

  function previewPlan() {
    const plan = store.planSync()
    return { plan, summary: summarizePlan(plan), planVersion: planVersion(plan), viewer: store.state.viewer }
  }

  function checkPlan(version, plans) {
    if (typeof version !== 'string') {
      throw new GitHubError('conflict', '请重新打开同步预览，并使用本次预览的 planVersion')
    }
    if (version !== planVersion(plans)) {
      throw new GitHubError('conflict', '暂存内容已变化，请重新核对同步预览')
    }
  }

  async function readCatalog(client) {
    const catalog = await client.fetchLists()
    if (!sameViewer(catalog.viewer, store.state.viewer) || !catalog.listsComplete) {
      throw new GitHubError('unavailable', '无法核对当前账号的完整分类，暂存已保留')
    }
    return catalog
  }

  async function startSync(client, { dryRun = false, expectCount, planVersion: expectedVersion } = {}) {
    if (auth?.state === 'missing-user-scope') {
      throw new GitHubError('scope', 'gh token 缺少 user scope，先运行 gh auth refresh -h github.com -s user')
    }
    let plans = store.planSync()
    if (!dryRun && (expectedVersion !== undefined || expectCount !== undefined)) checkPlan(expectedVersion, plans)
    if (Number.isInteger(expectCount) && expectCount !== plans.length) {
      await store.save()
      throw new GitHubError('conflict', `预览时是 ${expectCount} 条，现在变成 ${plans.length} 条，请重新看一遍预览再写回`)
    }
    if (!dryRun && plans.length) {
      const version = planVersion(plans)
      const [catalog, starred] = await Promise.all([
        readCatalog(client), client.fetchStarredItems(plans.map((plan) => plan.itemId)),
      ])
      if (plans.some((plan) => starred.get(plan.itemId) !== plan.nameWithOwner)) {
        await refresh(client)
        throw new GitHubError('conflict', '仓库的名称或收藏状态已变化，请核对刷新后的暂存')
      }
      store.applyLists(catalog)
      plans = store.planSync()
      if (version !== planVersion(plans)) {
        await store.save()
        const message = plans.length ? 'GitHub 上的分类已变化，请核对合并后的归属' : '已核对 GitHub 的最新分类，当前没有需要写回的改动'
        throw new GitHubError('conflict', message, { reason: 'remote-lists' })
      }
    }
    if (dryRun || plans.length === 0) {
      await store.save()
      job = {
        kind: 'sync',
        running: false,
        total: 0,
        done: 0,
        applied: 0,
        failed: [],
        current: null,
        startedAt: null,
        finishedAt: new Date().toISOString(),
        meta: {},
      }
      return jobSnapshot()
    }
    startJob('sync', plans, {
      label: (plan) => plan.nameWithOwner,
      describe: (plan) => ({ nameWithOwner: plan.nameWithOwner }),
      run: async (plan) => {
        await client.setItemLists(plan.itemId, plan.to)
        store.markSynced(plan.nameWithOwner, plan.to)
      },
      finish: async (running) => {
        if (running.applied > 0) store.pushOp('sync', {}, `写回 GitHub：${running.applied} 个仓库的分类`)
      },
    }, { planVersion: planVersion(plans) })
    return jobSnapshot()
  }

  async function dispatch(payload) {
    const action = typeof payload?.action === 'string' ? payload.action : ''
    await store.load()
    if (payload?.viewer != null && !sameViewer(payload.viewer, store.state.viewer)) {
      throw new GitHubError('conflict', '面板所属的 GitHub 账号已变化，请刷新后再操作')
    }
    if (!REMOTE_WRITES.has(action)) {
      if ((preparingWrite || jobRunning()) && ['stage', 'discardPending', 'organize'].includes(action)) {
        throw new GitHubError('busy', '有作业正在执行，请等进度结束后再改归类')
      }
      return handleAction(action, payload)
    }
    if (preparingWrite || jobRunning()) {
      if (action === 'sync' && jobRunning() && job.kind === 'sync'
        && (!payload.planVersion || payload.planVersion === job.meta.planVersion)) return view()
      throw new GitHubError('busy', '有作业正在执行，请等进度结束后再操作')
    }
    // 先占用写入位置，再等待认证和远端成员预检。
    preparingWrite = true
    writeRevision += 1
    try {
      const status = await probeAuth(true)
      if (!status.login || !['ok', 'missing-user-scope'].includes(status.state)) {
        throw new GitHubError('unauthenticated', '请先重新检查 gh 登录状态')
      }
      if (!sameViewer(store.state.viewer, status.login)) {
        throw new GitHubError('conflict', 'gh 登录账号已变化，请刷新面板后再操作。原账号的暂存已保留')
      }
      return await handleAction(action, payload, github.forAccount(status.login))
    } finally {
      preparingWrite = false
    }
  }

  async function handleAction(action, payload, client) {
    switch (action) {
      case 'state':
        return readState({ force: Boolean(payload.force) })
      case 'refresh':
        return readState({ force: true })
      case 'saveView':
      case 'deleteView': {
        if (!sameViewer(payload.viewer, store.state.viewer)) throw new GitHubError('conflict', '请刷新并确认视图所属的账号')
        const id = action === 'saveView' ? saveView(store.state, payload) : deleteView(store.state, payload)
        await store.save()
        if (!sameViewer(payload.viewer, store.state.viewer)) throw new GitHubError('conflict', '面板所属账号已变化，请刷新视图')
        return { ...view(), savedViewId: id }
      }
      case 'releaseNotes': {
        const viewer = store.state.viewer
        if (!sameViewer(payload.viewer, viewer)) throw new GitHubError('conflict', '请重新打开当前账号的仓库详情')
        const repo = store.state.repos[payload.fullName]
        if (!repo?.id || !payload.tag || payload.tag !== repo.latestRelease?.tagName) {
          throw new GitHubError('conflict', '仓库或版本已变化，请刷新仓库详情')
        }
        const status = await probeAuth(true)
        if (!['ok', 'missing-user-scope'].includes(status.state) || !sameViewer(status.login, viewer)) {
          throw new GitHubError('conflict', '请检查当前 GitHub 账号并刷新面板')
        }
        const release = await github.forAccount(viewer).fetchRelease(repo.id, payload.tag)
        if (!sameViewer(store.state.viewer, viewer)) throw new GitHubError('conflict', '面板所属账号已变化')
        return release
      }
      case 'stage': {
        const touched = store.stage(payload.fullNames, { add: payload.add, remove: payload.remove })
        if (touched > 0) {
          const listName = (id) => store.state.lists.find((list) => list.id === id)?.name
          const added = (payload.add ?? []).map(listName).filter(Boolean)
          const removed = (payload.remove ?? []).map(listName).filter(Boolean)
          const text = added.length > 0
            ? `归入「${added.join('、')}」：${touched} 个仓库`
            : removed.length > 0 ? `从「${removed.join('、')}」移出：${touched} 个仓库` : null
          if (text) store.pushOp(added.length > 0 ? 'assign' : 'remove', {}, text)
        }
        await store.save()
        return { touched, ...view() }
      }
      case 'acceptSuggestions': {
        // 只做暂存：把每条建议落到对应列表的 pending.add 上，写回 GitHub 仍要用户点一次「同步」。
        const suggestions = suggestAll(store.view().repos, rules)
        const byName = new Map(store.state.lists.map((list) => [list.name, list.id]))
        const groups = new Map()
        let created = 0
        let kept = 0
        for (const [fullName, suggestion] of Object.entries(suggestions)) {
          const repo = store.state.repos[fullName]
          if (!repo) continue
          // 已经归过类（或已在待同步队列里）的仓库不强行塞第二个分类。
          if (desiredLists(repo).length > 0) {
            kept += 1
            continue
          }
          let listId = byName.get(suggestion.list)
          if (!listId) {
            const list = await client.createList(suggestion.list, 'dsh-stars 自动创建')
            store.setList(list)
            await store.save()
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
        if (staged > 0 || created > 0) {
          store.pushOp('assign', {}, `采纳关键词建议：${staged} 个仓库进暂存${created > 0 ? `，新建 ${created} 个分类` : ''}`)
        }
        await store.save()
        return { created, staged, kept, ...view() }
      }
      case 'watch': {
        const names = [...new Set((payload.fullNames ?? []).filter((name) => typeof name === 'string'))]
        if (names.length === 0) throw new GitHubError('invalid', '没有要跟踪的仓库')
        const watch = Boolean(payload.watch)
        store.setWatched(names, watch)
        await store.save()
        return view()
      }
      case 'plan':
        return previewPlan()
      case 'discardPending': {
        checkPlan(payload.planVersion, store.planSync())
        store.discardPending(String(payload.fullName ?? ''))
        await store.save()
        return { ...view(), preview: previewPlan() }
      }
      case 'sync': {
        const started = await startSync(client, payload)
        return { ...view(), job: started, syncJob: started }
      }
      case 'unstar': {
        const names = [...new Set((payload.fullNames ?? []).filter((name) => typeof name === 'string'))]
        const targets = []
        for (const name of names) {
          const repo = store.state.repos[name]
          if (!repo) continue
          if (!repo.id) throw new GitHubError('invalid', `${name} 缺少 node id，刷新一次再试`)
          targets.push({ nameWithOwner: name, itemId: repo.id, url: repo.url })
        }
        if (targets.length === 0) throw new GitHubError('invalid', '没有可取消 star 的仓库')
        startJob('unstar', targets, {
          label: (target) => target.nameWithOwner,
          describe: (target) => ({ nameWithOwner: target.nameWithOwner }),
          run: async (target) => {
            await client.removeStar(target.itemId)
            // 远端成功后本地立刻生效：用户点完就该看到它消失，而不是等下次刷新。
            store.dropRepo(target.nameWithOwner)
            store.markUnstarred(target.nameWithOwner)
            store.pushOp('unstarred', target, `已取消 star：${target.nameWithOwner}`)
          },
        })
        return { ...view(), job: jobSnapshot() }
      }
      case 'deleteList': {
        const listId = String(payload.listId ?? '')
        const mode = payload.mode === 'move' ? 'move' : 'unsorted'
        const targetListId = mode === 'move' ? String(payload.targetListId ?? '') : ''
        const cached = store.state.lists.find((item) => item.id === listId)
        if (!cached) throw new GitHubError('invalid', '分类不存在，刷新一次再试')
        if (mode === 'move' && (targetListId === listId || !store.state.lists.some((item) => item.id === targetListId))) {
          throw new GitHubError('invalid', '要移入的目标分类不对')
        }
        // 成员的真相在 GitHub：本地快照可能落后（在网页上往分类里加过仓库），
        // 所以删分类前先取一次远端成员，别按旧列表「空分类」直接删掉、把成员变成孤儿。
        const catalog = await readCatalog(client)
        store.applyLists(catalog)
        await store.save()
        const remote = store.state.lists.find((entry) => entry.id === listId)
        if (!remote) throw new GitHubError('conflict', '分类已变化，请刷新后重试')
        if (mode === 'move' && !store.state.lists.some((entry) => entry.id === targetListId)) {
          throw new GitHubError('conflict', '目标分类已删除，请重新选择')
        }
        const list = remote
        const targets = list.repos.map((name) => {
          const itemId = list.itemIds[name]
          if (!itemId) throw new GitHubError('invalid', `${name} 缺少 node id，刷新一次再试`)
          const current = new Set(store.state.lists.filter((item) => item.repos.includes(name)).map((item) => item.id))
          current.delete(listId)
          if (mode === 'move') current.add(targetListId)
          return { nameWithOwner: name, itemId, next: [...current] }
        })
        startJob('deleteList', targets, {
          label: (target) => target.nameWithOwner,
          describe: (target) => ({ nameWithOwner: target.nameWithOwner }),
          run: async (target) => {
            await client.setItemLists(target.itemId, target.next)
            store.applyListRemoval(target.nameWithOwner, listId, mode === 'move' ? targetListId : null, target.itemId)
          },
          // 成员全部搬走后才删分类：顺序颠倒会留下悬空 id（v0.1 踩过）。
          finish: async (running) => {
            if (running.failed.length > 0) {
              running.meta = { ...running.meta, deleted: false, listId, listName: list.name }
              return
            }
            const remaining = await client.fetchListMembers(listId)
            if (remaining?.repos.length) throw new GitHubError('conflict', '分类又有了成员，请刷新后重新确认删除')
            if (remaining) await client.deleteList(listId)
            store.removeList(listId)
            store.pushOp('deleteList', {}, `删除分类「${list.name}」${mode === 'move' ? `，成员移入「${store.state.lists.find((item) => item.id === targetListId)?.name ?? targetListId}」` : '，保留成员的其他归属'}`)
            running.meta = { ...running.meta, deleted: true, listId, listName: list.name }
          },
        }, { listId, listName: list.name, mode, targetListId: targetListId || null })
        return { ...view(), job: jobSnapshot() }
      }
      case 'removeOrphan': {
        const listId = String(payload.listId ?? '')
        const fullName = String(payload.fullName ?? '')
        const cached = store.state.lists.find((entry) => entry.id === listId)
        const expected = cached?.itemIds?.[fullName]
        if (store.state.repos[fullName] || !cached?.repos.includes(fullName)) {
          throw new GitHubError('conflict', '这个仓库已不在当前孤儿成员中，请刷新分类')
        }
        const catalog = await readCatalog(client)
        store.applyLists(catalog)
        await store.save()
        const list = store.state.lists.find((item) => item.id === listId)
        if (!list?.repos.includes(fullName)) return view()
        const itemId = list.itemIds?.[fullName]
        if (!itemId) throw new GitHubError('invalid', `${fullName} 缺少 node id，刷新一次再试`)
        if (expected && itemId !== expected) throw new GitHubError('conflict', '同名仓库已经更换，请刷新分类')
        if ((await client.fetchStarredItems([itemId])).has(itemId)) {
          await refresh(client)
          throw new GitHubError('conflict', '这个仓库已经重新收藏，请核对它的分类')
        }
        const current = store.state.lists
          .filter((item) => (item.repos ?? []).includes(fullName))
          .map((item) => item.id)
          .filter((id) => id !== listId)
        await client.setItemLists(itemId, current)
        store.applyListRemoval(fullName, listId)
        await store.save()
        return view()
      }
      case 'checkAuth':
        return readState({ force: true })
      case 'progress': {
        const running = jobSnapshot()
        // 跑完就把完整视图带回去，面板可以一次性换成作业结束后的状态。
        if (running?.running) return { job: running, syncJob: running }
        return { job: running, syncJob: running, ...view() }
      }
      case 'organize': {
        // 只出方案，不写任何东西：用户看一眼再去「应用到暂存」。
        const mode = payload.mode === 'rebuild' ? 'rebuild' : 'reuse'
        const scope = payload.scope === 'all' ? 'all' : 'unsorted'
        const viewer = store.state.viewer
        const requested = Array.isArray(payload.fullNames) ? new Set(payload.fullNames) : null
        const repoList = Object.values(store.state.repos).filter((repo) => !requested || requested.has(repo.nameWithOwner))
        const candidates = (scope === 'all' ? repoList : repoList.filter((repo) =>
          desiredLists(repo).length === 0))
          .map((repo) => ({
            nameWithOwner: repo.nameWithOwner,
            description: repo.description ?? '',
            topics: repo.topics ?? [],
            language: repo.language ?? '',
            stars: repo.stars ?? 0,
          }))
        if (candidates.length === 0) {
          return { viewer, mode, scope, provider: null, model: null, groups: [], unsorted: [], unchanged: [], failedBatches: [], dropped: 0, total: 0, note: '没有需要整理的仓库' }
        }
        const lists = store.state.lists.map((list) => ({ name: list.name, count: list.repos?.length ?? 0 }))
        const llm = ctx.get('llm')
        const route = await pickModel(llm, { provider: organizeProvider ?? undefined, model: organizeModel ?? undefined })
        if (!route) {
          throw new GitHubError('model', '没有可用的模型路由：先在 DSH 里配置一个 LLM 提供商，或关掉「AI 整理」改用关键词建议')
        }
        const batches = Math.ceil(candidates.length / MAX_REPOS_PER_CALL)
        const merged = { groups: [], unsorted: [], unchanged: [], failedBatches: [], dropped: 0 }
        for (let batch = 0; batch < batches; batch += 1) {
          const slice = candidates.slice(batch * MAX_REPOS_PER_CALL, (batch + 1) * MAX_REPOS_PER_CALL)
          if (!sameViewer(viewer, store.state.viewer)) throw new GitHubError('conflict', '整理期间账号已变化，请重新开始')
          const prompt = buildPrompt({ repos: slice, lists, mode, batch: batch + 1, batches })
          try {
            const { text } = await askModel({ llm, provider: route.provider, model: route.model, prompt })
            const plan = normalizePlan(extractJson(text), { repos: slice, lists, mode })
            merged.groups.push(...plan.groups)
            merged.unsorted.push(...plan.unsorted)
            merged.unchanged.push(...plan.unchanged)
            merged.dropped += plan.dropped
          } catch (error) {
            merged.failedBatches.push({ repos: slice.map((repo) => repo.nameWithOwner), message: describe(error).message })
          }
          if (!sameViewer(viewer, store.state.viewer)) throw new GitHubError('conflict', '整理期间账号已变化，请重新开始')
        }
        // 跨批合并同名分类（模型分批时可能各起一个名字）。
        const byName = new Map()
        for (const group of merged.groups) {
          const hit = byName.get(group.name)
          if (hit) hit.repos.push(...group.repos)
          else byName.set(group.name, { name: group.name, repos: [...group.repos] })
        }
        const known = new Map(store.state.lists.map((list) => [list.name.toLowerCase(), list]))
        const groups = [...byName.values()].map((group) => {
          const existing = known.get(group.name.toLowerCase()) ?? null
          return {
            name: group.name,
            listId: existing?.id ?? null,
            isNew: !existing,
            repos: group.repos,
          }
        })
        return {
          mode,
          scope,
          provider: route.provider,
          model: route.model,
          groups,
          unsorted: merged.unsorted,
          unchanged: merged.unchanged,
          failedBatches: merged.failedBatches,
          dropped: merged.dropped,
          viewer,
          total: candidates.length,
        }
      }
      case 'organizeApply': {
        // 把方案落成暂存：新建缺的分类，其余只改 pending；写回 GitHub 仍要用户点同步。
        const mode = payload.mode === 'rebuild' ? 'rebuild' : 'reuse'
        const groups = Array.isArray(payload.groups) ? payload.groups : []
        let created = 0
        let touched = 0
        const assignments = []
        for (const group of groups) {
          const name = String(group?.name ?? '').trim()
          const names = (Array.isArray(group?.repos) ? group.repos : []).filter((fullName) => {
            const repo = store.state.repos[fullName]
            return repo && (mode === 'rebuild' || desiredLists(repo).length === 0)
          })
          if (!name || names.length === 0) continue
          let list = store.state.lists.find((item) => item.name.toLowerCase() === name.toLowerCase())
          if (!list) {
            // 分类描述统一打上来源标记，GitHub Lists 页里一眼能看出是插件建的。
            const made = await client.createList(name, 'dsh-stars 自动创建')
            store.setList(made)
            await store.save()
            created += 1
            list = made
          }
          assignments.push({ listId: list.id, names })
        }
        for (const { listId, names } of assignments) {
          const others = mode === 'rebuild'
            ? store.state.lists.filter((item) => item.id !== listId).map((item) => item.id)
            : []
          touched += store.stage(names, { add: [listId], remove: others })
        }
        if (mode === 'rebuild' && Array.isArray(payload.unsorted)) {
          const clear = store.state.lists.map((item) => item.id)
          touched += store.stage(payload.unsorted.map(String), { add: [], remove: clear })
        }
        store.pushOp('organize', {}, `AI 整理：${touched} 个仓库进暂存${created > 0 ? `，新建 ${created} 个分类` : ''}`)
        await store.save()
        return { touched, created, ...view() }
      }
      case 'createList': {
        const name = String(payload.name ?? '').trim()
        if (!name) throw new GitHubError('invalid', '列表名不能为空')
        const note = String(payload.description ?? '').trim() || 'dsh-stars 自动创建'
        const created = await client.createList(name, note, Boolean(payload.isPrivate))
        store.setList(created)
        store.pushOp('createList', {}, `新建分类「${name}」`)
        await store.save()
        return { ...view(), createdListId: created.id }
      }
      case 'markViewed': {
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
      // 409 用于「预览之后暂存又变了」，前端据此让用户重新看一遍预览。
      const status = detail.code === 'unauthenticated' ? 401 : ['conflict', 'busy'].includes(detail.code) ? 409 : 400
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
