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
import { MAX_REPOS_PER_CALL, askModel, buildPrompt, extractJson, normalizePlan, pickModel } from './src/organize.js'

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
  const organizeProvider = typeof config.organizeProvider === 'string' && config.organizeProvider ? config.organizeProvider : null
  const organizeModel = typeof config.organizeModel === 'string' && config.organizeModel ? config.organizeModel : null

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
      running.running = false
      running.current = null
      running.finishedAt = new Date().toISOString()
      try {
        await store.save()
      } catch {
        // 收尾落盘失败不影响已经写回 GitHub 的结果。
      }
    }
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
    const snapshot = jobSnapshot()
    return {
      ...result,
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
    await store.load()
    // 同步进行中不重抓：抓回来的 Lists 归属还是旧的，会把面板状态抖回去。
    if (jobRunning()) return view()
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

  async function startSync({ dryRun = false, expectCount } = {}) {
    await store.load()
    const status = await probeAuth()
    // 缺 user scope 时写回必然 403，提前说清楚比跑到一半失败好。
    if (status.state === 'missing-user-scope') {
      throw new GitHubError('scope', 'gh token 缺少 user scope，先运行 gh auth refresh -h github.com -s user；只读和暂存不受影响')
    }
    if (jobRunning()) {
      if (job.kind === 'sync') return jobSnapshot()
      throw new GitHubError('busy', '有别的作业在跑，等它结束再同步')
    }
    const plans = store.planSync()
    // 预览层打开后用户可能又改了暂存：按旧条数写回等于写到用户没看过的状态。
    if (Number.isInteger(expectCount) && expectCount !== plans.length) {
      await store.save()
      throw new GitHubError('conflict', `预览时是 ${expectCount} 条，现在变成 ${plans.length} 条，请重新看一遍预览再写回`)
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
        await github.setItemLists(plan.itemId, plan.to)
        store.markSynced(plan.nameWithOwner, plan.to)
      },
      finish: async (running) => {
        if (running.applied > 0) store.pushOp('sync', {}, `写回 GitHub：${running.applied} 个仓库的分类`)
      },
    })
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
        if (jobRunning()) throw new GitHubError('busy', '有作业正在跟 GitHub 通信，等进度跑完再改归类')
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
        await store.load()
        if (jobRunning()) throw new GitHubError('busy', '有作业正在跟 GitHub 通信，等进度跑完再改归类')
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
        if (staged > 0 || created > 0) {
          store.pushOp('assign', {}, `采纳关键词建议：${staged} 个仓库进暂存${created > 0 ? `，新建 ${created} 个分类` : ''}`)
        }
        await store.save()
        return { created, staged, kept, ...view() }
      }
      case 'watch': {
        await store.load()
        const names = [...new Set((payload.fullNames ?? []).filter((name) => typeof name === 'string'))]
        if (names.length === 0) throw new GitHubError('invalid', '没有要跟踪的仓库')
        const watch = Boolean(payload.watch)
        store.setWatched(names, watch)
        await store.save()
        return view()
      }
      case 'plan': {
        // 只读：给预览层用。planSync 会顺手清掉「其实是 noop」的暂存，所以照样落盘。
        await store.load()
        const plans = store.planSync()
        await store.save()
        return { plan: plans, summary: summarizePlan(plans) }
      }
      case 'sync': {
        // 立刻返回 job（running=true），写回在后台继续；面板用 progress 轮询。
        const started = await startSync({
          dryRun: Boolean(payload.dryRun),
          expectCount: Number.isInteger(payload.expectCount) ? payload.expectCount : undefined,
        })
        return { ...view(), job: started, syncJob: started }
      }
      case 'unstar': {
        await store.load()
        if (jobRunning()) throw new GitHubError('busy', '有作业正在跟 GitHub 通信，等进度跑完再取消 star')
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
            await github.removeStar(target.itemId)
            // 远端成功后本地立刻生效：用户点完就该看到它消失，而不是等下次刷新。
            store.dropRepo(target.nameWithOwner)
            store.markUnstarred(target.nameWithOwner)
            store.pushOp('unstarred', target, `已取消 star：${target.nameWithOwner}`)
          },
        })
        return { ...view(), job: jobSnapshot() }
      }
      case 'deleteList': {
        await store.load()
        if (jobRunning()) throw new GitHubError('busy', '有作业正在跟 GitHub 通信，等进度跑完再删分类')
        const listId = String(payload.listId ?? '')
        const mode = payload.mode === 'move' ? 'move' : 'unsorted'
        const targetListId = mode === 'move' ? String(payload.targetListId ?? '') : ''
        const cached = store.state.lists.find((item) => item.id === listId)
        if (!cached) throw new GitHubError('invalid', '分类不存在，刷新一次再试')
        if (mode === 'move' && (!targetListId || targetListId === listId)) {
          throw new GitHubError('invalid', '要移入的目标分类不对')
        }
        // 成员的真相在 GitHub：本地快照可能落后（在网页上往分类里加过仓库），
        // 所以删分类前先取一次远端成员，别按旧列表「空分类」直接删掉、把成员变成孤儿。
        const remote = await github.fetchListMembers(listId)
        const list = remote ?? cached
        const members = remote ? remote.repos : cached.repos ?? []
        const remoteIds = remote?.itemIds ?? {}
        const targets = members.map((name) => {
          const repo = store.state.repos[name]
          const itemId = remoteIds[name] ?? cached.itemIds?.[name] ?? repo?.id
          if (!itemId) throw new GitHubError('invalid', `${name} 缺少 node id，刷新一次再试`)
          const current = new Set([
            ...(repo?.lists ?? []),
            ...store.state.lists.filter((item) => (item.repos ?? []).includes(name)).map((item) => item.id),
          ])
          current.delete(listId)
          if (mode === 'move') current.add(targetListId)
          return { nameWithOwner: name, itemId, next: [...current] }
        })
        startJob('deleteList', targets, {
          label: (target) => target.nameWithOwner,
          describe: (target) => ({ nameWithOwner: target.nameWithOwner }),
          run: async (target) => {
            await github.setItemLists(target.itemId, target.next)
            store.applyListRemoval(target.nameWithOwner, listId, mode === 'move' ? targetListId : null)
          },
          // 成员全部搬走后才删分类：顺序颠倒会留下悬空 id（v0.1 踩过）。
          finish: async (running) => {
            if (running.failed.length > 0) {
              running.meta = { ...running.meta, deleted: false, listId, listName: list.name }
              return
            }
            await github.deleteList(listId)
            store.removeList(listId)
            store.pushOp('deleteList', {}, `删除分类「${list.name}」${mode === 'move' ? `，成员移入「${store.state.lists.find((item) => item.id === targetListId)?.name ?? targetListId}」` : '，成员变未归类'}`)
            running.meta = { ...running.meta, deleted: true, listId, listName: list.name }
          },
        }, { listId, listName: list.name, mode, targetListId: targetListId || null })
        return { ...view(), job: jobSnapshot() }
      }
      case 'removeOrphan': {
        await store.load()
        if (jobRunning()) throw new GitHubError('busy', '有作业正在跟 GitHub 通信，等进度跑完再改')
        const listId = String(payload.listId ?? '')
        const fullName = String(payload.fullName ?? '')
        const list = store.state.lists.find((item) => item.id === listId)
        if (!list) throw new GitHubError('invalid', '分类不存在，刷新一次再试')
        const itemId = list.itemIds?.[fullName] ?? store.state.repos[fullName]?.id
        if (!itemId) throw new GitHubError('invalid', `${fullName} 缺少 node id，刷新一次再试`)
        const current = store.state.lists
          .filter((item) => (item.repos ?? []).includes(fullName))
          .map((item) => item.id)
          .filter((id) => id !== listId)
        await github.setItemLists(itemId, current)
        store.applyListRemoval(fullName, listId)
        await store.save()
        return view()
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
        const running = jobSnapshot()
        // 跑完就把完整视图带回去，面板可以一次性换成作业结束后的状态。
        if (running?.running) return { job: running, syncJob: running }
        return { job: running, syncJob: running, ...view() }
      }
      case 'organize': {
        // 只出方案，不写任何东西：用户看一眼再去「应用到暂存」。
        await store.load()
        if (jobRunning()) throw new GitHubError('busy', '有作业正在跟 GitHub 通信，等进度跑完再整理')
        const mode = payload.mode === 'rebuild' ? 'rebuild' : 'reuse'
        const scope = payload.scope === 'all' ? 'all' : 'unsorted'
        const repoList = Object.values(store.state.repos)
        const candidates = (scope === 'all' ? repoList : repoList.filter((repo) =>
          (repo.lists ?? []).length === 0 && !(repo.pending?.add ?? []).length))
          .map((repo) => ({
            nameWithOwner: repo.nameWithOwner,
            description: repo.description ?? '',
            topics: repo.topics ?? [],
            language: repo.language ?? '',
            stars: repo.stars ?? 0,
          }))
        if (candidates.length === 0) {
          return { mode, scope, provider: null, model: null, groups: [], unsorted: [], dropped: 0, total: 0, note: '没有需要整理的仓库' }
        }
        const llm = ctx.get('llm')
        const route = await pickModel(llm, { provider: organizeProvider ?? undefined, model: organizeModel ?? undefined })
        if (!route) {
          throw new GitHubError('model', '没有可用的模型路由：先在 DSH 里配置一个 LLM 提供商，或关掉「AI 整理」改用关键词建议')
        }
        const lists = store.state.lists.map((list) => ({ name: list.name, count: list.repos?.length ?? 0 }))
        const batches = Math.ceil(candidates.length / MAX_REPOS_PER_CALL)
        const merged = { groups: [], unsorted: [] }
        for (let batch = 0; batch < batches; batch += 1) {
          const slice = candidates.slice(batch * MAX_REPOS_PER_CALL, (batch + 1) * MAX_REPOS_PER_CALL)
          const prompt = buildPrompt({ repos: slice, lists, mode, batch: batch + 1, batches })
          const { text } = await askModel({ llm, provider: route.provider, model: route.model, prompt })
          const plan = normalizePlan(extractJson(text), { repos: slice, lists: store.state.lists, mode })
          merged.groups.push(...plan.groups)
          merged.unsorted.push(...plan.unsorted)
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
          dropped: 0,
          total: candidates.length,
        }
      }
      case 'organizeApply': {
        // 把方案落成暂存：新建缺的分类，其余只改 pending；写回 GitHub 仍要用户点同步。
        await store.load()
        if (jobRunning()) throw new GitHubError('busy', '有作业正在跟 GitHub 通信，等进度跑完再改归类')
        const mode = payload.mode === 'rebuild' ? 'rebuild' : 'reuse'
        const groups = Array.isArray(payload.groups) ? payload.groups : []
        let created = 0
        let touched = 0
        for (const group of groups) {
          const name = String(group?.name ?? '').trim()
          const names = (Array.isArray(group?.repos) ? group.repos : []).map(String)
          if (!name || names.length === 0) continue
          let list = store.state.lists.find((item) => item.name.toLowerCase() === name.toLowerCase())
          if (!list) {
            // 分类描述统一打上来源标记，GitHub Lists 页里一眼能看出是插件建的。
            const made = await github.createList(name, 'dsh-stars 自动创建')
            store.setList(made)
            created += 1
            list = made
          }
          const others = mode === 'rebuild'
            ? store.state.lists.filter((item) => item.id !== list.id).map((item) => item.id)
            : []
          touched += store.stage(names, { add: [list.id], remove: others })
        }
        if (mode === 'rebuild' && Array.isArray(payload.unsorted)) {
          const clear = store.state.lists.map((item) => item.id)
          touched += store.stage(payload.unsorted.map(String), { add: [], remove: clear })
        }
        await store.save()
        store.pushOp('organize', {}, `AI 整理：${touched} 个仓库进暂存${created > 0 ? `，新建 ${created} 个分类` : ''}`)
        await store.save()
        return { touched, created, ...view() }
      }
      case 'createList': {
        await store.load()
        const name = String(payload.name ?? '').trim()
        if (!name) throw new GitHubError('invalid', '列表名不能为空')
        const note = String(payload.description ?? '').trim() || 'dsh-stars 自动创建'
        const created = await github.createList(name, note, Boolean(payload.isPrivate))
        store.setList(created)
        store.pushOp('createList', {}, `新建分类「${name}」`)
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
      // 409 用于「预览之后暂存又变了」，前端据此让用户重新看一遍预览。
      const status = detail.code === 'unauthenticated' ? 401 : detail.code === 'conflict' ? 409 : 400
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
