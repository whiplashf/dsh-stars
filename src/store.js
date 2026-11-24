/**
 * 本地状态：star 快照 + 分类缓存 + 变更日志。
 * GitHub Lists 提供归属，快照、跟踪与暂存按 GitHub 账号保存。
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const MAX_CHANGES = 400
/** 用户自己的操作记录（左栏「操作记录」）。 */
export const OPS_KINDS = new Set(['new', 'unstarred', 'gone', 'assign', 'remove', 'sync', 'createList', 'deleteList', 'organize'])
/** 远端仓库的更新（只对用户跟踪的仓库记录，未读数也只看这里）。 */
export const UPDATE_KINDS = new Set(['release', 'commits', 'archived', 'stars'])
/** star 数变化小于该绝对值时不登记为变更。 */
export const STAR_DELTA_MIN = 10
/** 取消 star 的墓碑保留时长：超过这个时间的「仓库消失」不再算手动取消。 */
export const UNSTARRED_TTL_MS = 7 * 86_400_000

export function blankState() {
  return {
    // v2：把「变更」拆成 ops（用户操作）与 updates（跟踪仓库的远端更新）。
    version: 2,
    viewer: null,
    savedViews: [],
    lists: [],
    repos: {},
    order: [],
    snapshotAt: null,
    baselineAt: null,
    // 操作记录：用户主动做过的事（收藏/取消收藏/归类/同步/建删分类/AI 整理）。
    ops: [],
    // 远端更新：只记录被跟踪的仓库（release/commits/archived/star 涨跌）。
    updates: [],
    // 跟踪的仓库：默认空 = 不跟踪，任何远端变化都不进未读。
    watched: {},
    updatesViewedAt: null,
    // 本面板取消 star 时会先记一笔，下次抓取才能把 unstarred 和「在别处取消的」区分开。
    unstarredAt: {},
  }
}

function emptyPending() {
  return { add: [], remove: [] }
}

function normalizePending(pending, knownIds) {
  const ids = (values) => Array.isArray(values)
    ? [...new Set(values.filter((id) => typeof id === 'string' && (!knownIds || knownIds.has(id))))]
    : []
  return {
    add: ids(pending?.add),
    remove: ids(pending?.remove),
  }
}

function hasPending(pending) {
  return Boolean(pending && (pending.add.length > 0 || pending.remove.length > 0))
}

/** 期望归属 = (已归属 − 待移出) ∪ 待加入，用于同步与"是否真的变了"的判断。 */
export function desiredLists(repo) {
  const pending = normalizePending(repo?.pending)
  const current = Array.isArray(repo?.lists) ? repo.lists : []
  const next = new Set(current.filter((id) => !pending.remove.includes(id)))
  for (const id of pending.add) next.add(id)
  return [...next]
}

function sameMembers(a, b) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((item) => set.has(item))
}

function membershipDelta(from, to) {
  return { add: to.filter((id) => !from.includes(id)), remove: from.filter((id) => !to.includes(id)) }
}

function changeEntry(kind, repo, text, extra = {}) {
  return {
    id: `${Date.now().toString(36)}-${kind}-${repo.nameWithOwner ?? 'unknown'}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    kind,
    nameWithOwner: repo.nameWithOwner ?? null,
    url: repo.url ?? null,
    text,
    ...extra,
  }
}

export class Store {
  #file
  #state = blankState()
  #loading = null
  #accounts = new Map()
  #writing = Promise.resolve()

  constructor(file) {
    this.#file = file
  }

  get file() { return this.#file }
  get state() { return this.#state }

  async load() {
    if (!this.#loading) {
      this.#loading = this.#read().catch((error) => {
        this.#loading = null
        throw error
      })
    }
    await this.#loading
    return this.#state
  }

  async #read() {
    let parsed
    try {
      parsed = JSON.parse(await readFile(this.#file, 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }
    const { accounts = {}, ...active } = parsed ?? {}
    this.#accounts = new Map(Object.entries(accounts))
    this.#restore(active)
    if (Number(active.version ?? 1) < 2) await this.save()
  }

  #restore(parsed) {
    this.#state = {
      ...blankState(), ...parsed, version: 2,
      repos: parsed.repos && typeof parsed.repos === 'object' ? parsed.repos : {},
      lists: Array.isArray(parsed.lists) ? parsed.lists : [],
      savedViews: Array.isArray(parsed.savedViews) ? parsed.savedViews : [],
    }
    const legacy = Array.isArray(parsed.changes) ? parsed.changes : []
    this.#state.ops = Array.isArray(parsed.ops) ? parsed.ops : legacy.filter((entry) => OPS_KINDS.has(entry?.kind))
    this.#state.updates = Array.isArray(parsed.updates) ? parsed.updates : legacy.filter((entry) => UPDATE_KINDS.has(entry?.kind))
    if (!this.#state.watched || typeof this.#state.watched !== 'object') this.#state.watched = {}
    if (Number(parsed.version ?? 1) < 2) {
      this.#state.watched = {}
      this.#state.updatesViewedAt = new Date().toISOString()
    }
    delete this.#state.changes
    delete this.#state.lastViewedAt
    const complete = parsed.listsComplete ?? this.#state.lists.length < 30
    const known = this.#state.snapshotAt && complete ? new Set(this.#state.lists.map((list) => list.id)) : null
    for (const repo of Object.values(this.#state.repos)) {
      repo.pending = normalizePending(repo.pending, known)
      if (!Array.isArray(repo.lists)) repo.lists = []
    }
    if (!this.#state.unstarredAt || typeof this.#state.unstarredAt !== 'object') this.#state.unstarredAt = {}
    for (const list of this.#state.lists) {
      if (!Array.isArray(list.repos)) list.repos = []
      if (!list.itemIds || typeof list.itemIds !== 'object') list.itemIds = {}
      list.count = list.repos.length
    }
    // 旧版本把每次 +1 star 都记成变更；读盘时清掉这些噪声，只留阈值以上的涨跌。
    const clean = (list) => {
      const seen = new Set()
      return list.filter((change) => {
        if (change?.kind === 'stars' && Math.abs(Number(change.delta) || 0) < STAR_DELTA_MIN) return false
        const key = `${change?.kind}:${change?.nameWithOwner}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    this.#state.updates = clean(this.#state.updates ?? [])
  }

  selectViewer(login) {
    if (!login || this.#state.viewer?.toLowerCase() === login.toLowerCase()) return false
    if (this.#state.viewer || this.#state.snapshotAt) this.#accounts.set(this.#state.viewer?.toLowerCase() ?? '', this.#state)
    const key = login.toLowerCase()
    this.#restore(this.#accounts.get(key) ?? { ...blankState(), viewer: login })
    this.#accounts.delete(key)
    return true
  }

  /** 串行化写入，避免并发 save 互相覆盖；先写临时文件再改名。 */
  async save() {
    const run = async () => {
      await mkdir(path.dirname(this.#file), { recursive: true })
      const tmp = `${this.#file}.${process.pid}.tmp`
      const data = { ...this.#state, accounts: Object.fromEntries(this.#accounts) }
      await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
      await rename(tmp, this.#file)
    }
    this.#writing = this.#writing.then(run, run)
    return this.#writing
  }

  /**
   * 用一次抓取结果更新快照，返回本次新产生的变更。
   * 第一次抓取只建基线，不制造 100 多条"新收藏"噪声。
   */
  applyFetch(fetched, { staleDays = 365 } = {}) {
    this.selectViewer(fetched.viewer)
    const prev = this.#state.repos
    const byId = new Map(Object.values(prev).filter((repo) => repo.id).map((repo) => [repo.id, repo]))
    const matched = new Map()
    const previousMemberships = {}
    const watched = {}
    // 用落盘的 baselineAt 判断「是否曾经建立过基线」：只看 repos 是否为空的话，
    // 某次抓回 0 个仓库后再抓，会把全新仓库误当成首次基线，漏掉 new 变更。
    const hadBaseline = Boolean(this.#state.baselineAt) || Object.keys(prev).length > 0
    const now = Date.now()
    const staleBefore = now - staleDays * 86_400_000
    const next = {}
    const order = []
    const ops = []
    const updates = []

    for (const repo of fetched.repos ?? []) {
      const name = repo.nameWithOwner
      if (!name) continue
      // GitHub 允许仓库转移、改名以及旧名称被另一仓库重新占用。
      const named = prev[name]
      const old = byId.get(repo.id) ?? (!repo.id || !named?.id ? named : null)
      if (old) {
        previousMemberships[name] = old
        matched.set(old.nameWithOwner, repo)
        if (this.#state.watched[old.nameWithOwner]) watched[name] = this.#state.watched[old.nameWithOwner]
      }
      const merged = {
        ...repo,
        firstSeenAt: old?.firstSeenAt ?? new Date().toISOString(),
        stale: Boolean(repo.pushedAt && Date.parse(repo.pushedAt) < staleBefore),
      }
      next[name] = merged
      order.push(name)

      if (!old) {
        if (hadBaseline) ops.push(changeEntry('new', merged, `新收藏：${name}`))
        continue
      }
      // 远端更新只记跟踪的仓库；没跟踪的仓库就算发了新版本也不打扰。
      if (!watched[name]) continue
      const oldTag = old.latestRelease?.tagName ?? null
      const newTag = merged.latestRelease?.tagName ?? null
      if (newTag && newTag !== oldTag) {
        updates.push(changeEntry('release', merged, oldTag ? `新版本 ${newTag}（原 ${oldTag}）` : `首次发布 ${newTag}`, { tag: newTag }))
      } else if (merged.pushedAt && old.pushedAt && merged.pushedAt !== old.pushedAt && Date.parse(merged.pushedAt) > Date.parse(old.pushedAt)) {
        updates.push(changeEntry('commits', merged, `有新提交（${merged.pushedAt.slice(0, 10)}）`))
      }
      if (merged.archived && !old.archived) updates.push(changeEntry('archived', merged, '仓库已归档'))
      // star 数每天都会小幅波动，只有涨跌超过阈值才值得提示，避免淹没真正的代码变更。
      const delta = (merged.stars ?? 0) - (old.stars ?? 0)
      const starThreshold = Math.max(STAR_DELTA_MIN, Math.round((old.stars ?? 0) * 0.1))
      if (Math.abs(delta) >= starThreshold) {
        updates.push(changeEntry('stars', merged, `star ${delta > 0 ? '+' : ''}${delta}`, { delta }))
      }
    }

    for (const name of Object.keys(prev)) {
      if (matched.has(name)) continue
      // 本面板取消 star 的仓库会留下墓碑：分得清「我删的」和「在别处取消的」，
      // 否则用户点完取消 star 再刷新，会看到一条莫名其妙的「已取消 star」变更。
      const tomb = this.#state.unstarredAt?.[name]
      const mine = tomb && now - Date.parse(tomb) < UNSTARRED_TTL_MS
      ops.push(changeEntry(
        mine ? 'unstarred' : 'gone',
        { nameWithOwner: name, url: prev[name]?.url },
        mine ? `已取消 star：${name}` : `已不在星标里：${name}（可能在其他设备取消）`,
      ))
      if (tomb) delete this.#state.unstarredAt[name]
    }
    // 过期的墓碑顺手清掉，避免无限增长。
    for (const [name, at] of Object.entries(this.#state.unstarredAt ?? {})) {
      if (!Number.isFinite(Date.parse(at)) || now - Date.parse(at) >= UNSTARRED_TTL_MS) delete this.#state.unstarredAt[name]
    }

    this.#state.repos = next
    this.#state.order = order
    this.#state.watched = watched
    const listChanges = this.applyLists(fetched, previousMemberships)
    this.#state.viewer = fetched.viewer ?? this.#state.viewer
    this.#state.snapshotAt = new Date().toISOString()
    this.#state.baselineAt ??= this.#state.snapshotAt
    // 同一个仓库的同一种记录只留最新一条：反复刷新时不会堆出一串重复的「有新提交」。
    const merge = (incoming, existing) => {
      const fresh = new Set(incoming.map((entry) => `${entry.kind}:${entry.nameWithOwner}`))
      return [...incoming, ...existing.filter((entry) => !fresh.has(`${entry.kind}:${entry.nameWithOwner}`))].slice(0, MAX_CHANGES)
    }
    this.#state.ops = merge(ops, this.#state.ops ?? [])
    const history = (this.#state.updates ?? []).flatMap((entry) => {
      const repo = matched.get(entry.nameWithOwner)
      if (!repo) return []
      return repo.nameWithOwner === entry.nameWithOwner ? [entry] : [{ ...entry, nameWithOwner: repo.nameWithOwner, url: repo.url }]
    })
    this.#state.updates = merge(updates, history)
    return { ops: [...ops, ...listChanges], updates }
  }

  /** 以当前远端归属为底，只重放相对旧快照实际增删的分类。同步预检和普通刷新共用。 */
  applyLists({ lists = [], listsComplete = lists.length < 30 }, previous = this.#state.repos) {
    const known = new Set(lists.map((list) => list.id))
    const byRepo = new Map()
    for (const list of lists) {
      for (const name of list.repos ?? []) {
        if (!byRepo.has(name)) byRepo.set(name, [])
        byRepo.get(name).push(list.id)
      }
    }
    const changes = []
    for (const [name, repo] of Object.entries(this.#state.repos)) {
      const old = previous[name]
      const base = old?.lists ?? []
      const delta = membershipDelta(base, desiredLists(old))
      const remote = byRepo.get(name) ?? []
      if (!listsComplete) remote.push(...base.filter((id) => !known.has(id)))
      else {
        const missing = [...delta.add, ...delta.remove].filter((id) => !known.has(id))
        if (missing.length) {
          const labels = missing.map((id) => this.#state.lists.find((list) => list.id === id)?.name ?? id)
          changes.push(changeEntry('remove', repo, `分类已删除，已撤销相关暂存：${labels.join('、')}`))
        }
      }
      repo.lists = remote
      repo.pending = {
        add: delta.add.filter((id) => !remote.includes(id) && (!listsComplete || known.has(id))),
        remove: delta.remove.filter((id) => remote.includes(id)),
      }
    }
    this.#state.listsComplete = listsComplete
    this.#state.lists = lists.map((list) => ({
      ...list, repos: [...(list.repos ?? [])], itemIds: { ...(list.itemIds ?? {}) }, count: list.repos?.length ?? 0,
    }))
    this.#state.ops = [...changes, ...this.#state.ops].slice(0, MAX_CHANGES)
    return changes
  }

  /** 在本地暂存一次归类；只改 pending，不碰 GitHub。 */
  stage(fullNames, { add = [], remove = [] } = {}) {
    const known = new Set(this.#state.lists.map((list) => list.id))
    const addIds = add.filter((id) => known.has(id))
    const removeIds = remove.filter((id) => known.has(id))
    let touched = 0
    for (const name of fullNames ?? []) {
      const repo = this.#state.repos[name]
      if (!repo) continue
      const pending = normalizePending(repo.pending)
      pending.add = [...new Set([...pending.add.filter((id) => !removeIds.includes(id)), ...addIds])]
      pending.remove = [...new Set([...pending.remove.filter((id) => !addIds.includes(id)), ...removeIds])]
      repo.pending = membershipDelta(repo.lists, desiredLists({ lists: repo.lists, pending }))
      touched += 1
    }
    return touched
  }

  /** 生成同步计划；noop 表示本地改动其实没有改变归属。 */
  planSync() {
    const plans = []
    for (const repo of Object.values(this.#state.repos)) {
      if (!hasPending(repo.pending)) continue
      const desired = desiredLists(repo)
      if (sameMembers(desired, repo.lists)) {
        repo.pending = emptyPending()
        continue
      }
      plans.push({ nameWithOwner: repo.nameWithOwner, itemId: repo.id, from: [...repo.lists], to: desired })
    }
    return plans
  }

  markSynced(nameWithOwner, listIds) {
    const repo = this.#state.repos[nameWithOwner]
    if (!repo) return
    const memberships = new Set(listIds)
    for (const list of this.#state.lists) {
      if (memberships.has(list.id)) {
        if (!list.repos.includes(nameWithOwner)) list.repos.push(nameWithOwner)
        list.itemIds ??= {}
        list.itemIds[nameWithOwner] = repo.id
      } else if (list.repos.includes(nameWithOwner)) {
        list.repos = list.repos.filter((name) => name !== nameWithOwner)
        if (list.itemIds) delete list.itemIds[nameWithOwner]
      }
      list.count = list.repos.length
    }
    repo.lists = [...memberships]
    repo.pending = emptyPending()
  }

  discardPending(name) {
    const repo = this.#state.repos[name]
    if (repo) repo.pending = emptyPending()
  }

  markSyncedAll() {
    for (const repo of Object.values(this.#state.repos)) {
      repo.pending = emptyPending()
    }
  }

  setList(list) {
    const existing = this.#state.lists.find((item) => item.id === list.id)
    if (existing) {
      Object.assign(existing, { name: list.name, description: list.description, isPrivate: list.isPrivate })
      return existing
    }
    const created = {
      id: list.id,
      name: list.name,
      description: list.description ?? '',
      isPrivate: Boolean(list.isPrivate),
      count: 0,
      repos: [],
    }
    this.#state.lists.push(created)
    return created
  }

  /** 只清「远端更新」的未读；操作记录没有未读概念。 */
  markViewed() {
    this.#state.updatesViewedAt = new Date().toISOString()
  }

  /** 直接在操作记录里插一条（取消 star、归类、同步这类「用户刚做的」不能等下次抓取才显示）。 */
  pushOp(kind, repo, text, extra = {}) {
    const entry = changeEntry(kind, repo, text, extra)
    this.#state.ops = [entry, ...(this.#state.ops ?? [])].slice(0, MAX_CHANGES)
    return entry
  }

  /** 跟踪 / 取消跟踪：只有跟踪的仓库，远端更新才会进未读。 */
  setWatched(names, watched) {
    if (!this.#state.watched || typeof this.#state.watched !== 'object') this.#state.watched = {}
    for (const name of names ?? []) {
      if (watched) this.#state.watched[name] = new Date().toISOString()
      else delete this.#state.watched[name]
    }
    return Object.keys(this.#state.watched)
  }

  /** 取消 star 成功后：仓库从本地快照里彻底消失（连同它的暂存与分类归属）。 */
  dropRepo(nameWithOwner) {
    const repo = this.#state.repos[nameWithOwner]
    if (!repo) return null
    delete this.#state.watched[nameWithOwner]
    delete this.#state.repos[nameWithOwner]
    this.#state.order = this.#state.order.filter((name) => name !== nameWithOwner)
    for (const list of this.#state.lists) {
      list.repos = (list.repos ?? []).filter((name) => name !== nameWithOwner)
      if (list.itemIds) delete list.itemIds[nameWithOwner]
      list.count = list.repos.length
    }
    return repo
  }

  /** 记一笔取消 star 的墓碑，供下次 applyFetch 区分 unstarred / gone。 */
  markUnstarred(nameWithOwner) {
    if (!this.#state.unstarredAt || typeof this.#state.unstarredAt !== 'object') this.#state.unstarredAt = {}
    this.#state.unstarredAt[nameWithOwner] = new Date().toISOString()
  }

  /** 删除分类（GitHub 侧已删成功后才调用）。 */
  removeList(listId) {
    const before = this.#state.lists.length
    this.#state.lists = this.#state.lists.filter((list) => list.id !== listId)
    // 分类没了，任何指向它的暂存都不再有意义。
    for (const repo of Object.values(this.#state.repos)) {
      const pending = normalizePending(repo.pending)
      pending.add = pending.add.filter((id) => id !== listId)
      pending.remove = pending.remove.filter((id) => id !== listId)
      repo.pending = hasPending(pending) ? pending : emptyPending()
      repo.lists = (repo.lists ?? []).filter((id) => id !== listId)
    }
    return before !== this.#state.lists.length
  }

  /** 把某个仓库从分类里移出（可选同时并入另一个分类）。 */
  applyListRemoval(nameWithOwner, listId, targetListId = null, itemId = null) {
    itemId ??= this.#state.lists.find((list) => list.id === listId)?.itemIds?.[nameWithOwner]
    for (const list of this.#state.lists) {
      if (list.id === listId) {
        list.repos = (list.repos ?? []).filter((name) => name !== nameWithOwner)
        if (list.itemIds) delete list.itemIds[nameWithOwner]
        list.count = list.repos.length
      } else if (targetListId && list.id === targetListId) {
        const repos = list.repos ?? []
        if (!repos.includes(nameWithOwner)) list.repos = [...repos, nameWithOwner]
        if (itemId) {
          list.itemIds ??= {}
          list.itemIds[nameWithOwner] = itemId
        }
        list.count = list.repos.length
      }
    }
    const repo = this.#state.repos[nameWithOwner]
    if (repo) {
      const pending = normalizePending(repo.pending)
      pending.add = pending.add.filter((id) => id !== listId)
      pending.remove = pending.remove.filter((id) => id !== listId)
      repo.pending = hasPending(pending) ? pending : emptyPending()
      repo.lists = (repo.lists ?? []).filter((id) => id !== listId)
      if (targetListId && !repo.lists.includes(targetListId)) repo.lists.push(targetListId)
    }
  }

  /** 拼给客户端的视图：仓库数组 + 统计 + 未读变更。 */
  view() {
    // 孤儿成员 = 挂在分类里、但已经不在 star 列表里（GitHub 允许这种状态）。
    const orphans = this.#state.lists
      .map((list) => ({ id: list.id, names: (list.repos ?? []).filter((name) => !this.#state.repos[name]) }))
      .filter((entry) => entry.names.length > 0)
    const lists = this.#state.lists.map((list) => ({
      ...list,
      repos: undefined,
      itemIds: undefined,
      count: list.repos?.length ?? list.count ?? 0,
    }))
    const repos = (this.#state.order ?? Object.keys(this.#state.repos)).map((name) => this.#state.repos[name]).filter(Boolean)
    const viewedAt = this.#state.updatesViewedAt
    const updates = (this.#state.updates ?? []).filter((entry) => this.#state.watched?.[entry.nameWithOwner])
    const unread = viewedAt ? updates.filter((update) => update.at > viewedAt) : updates
    const watched = Object.keys(this.#state.watched ?? {})
    return {
      viewer: this.#state.viewer,
      savedViews: this.#state.savedViews,
      lists,
      orphans,
      repos: repos.map((repo) => ({ ...repo, desired: desiredLists(repo), watched: Boolean(this.#state.watched?.[repo.nameWithOwner]) })),
      watched,
      // 操作记录（用户自己做的事）与远端更新（只含跟踪仓库）分开，未读只算后者。
      ops: this.#state.ops ?? [],
      updates,
      updatesUnread: unread.length,
      snapshotAt: this.#state.snapshotAt,
      updatesViewedAt: viewedAt,
    }
  }
}
