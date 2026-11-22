/**
 * 本地状态：star 快照 + 分类缓存 + 变更日志。
 * 文件是唯一真源，GitHub Lists 只是分类结果的同步目标。
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const MAX_CHANGES = 400
/** star 数变化小于该绝对值时不登记为变更。 */
export const STAR_DELTA_MIN = 10
/** 取消 star 的墓碑保留时长：超过这个时间的「仓库消失」不再算手动取消。 */
export const UNSTARRED_TTL_MS = 7 * 86_400_000

export function blankState() {
  return {
    version: 1,
    viewer: null,
    lists: [],
    repos: {},
    order: [],
    snapshotAt: null,
    baselineAt: null,
    lastViewedAt: null,
    changes: [],
    // 本面板取消 star 时会先记一笔，下次抓取才能把 unstarred 和「在别处取消的」区分开。
    unstarredAt: {},
  }
}

function emptyPending() {
  return { add: [], remove: [] }
}

function normalizePending(pending) {
  return {
    add: Array.isArray(pending?.add) ? [...new Set(pending.add.filter((id) => typeof id === 'string'))] : [],
    remove: Array.isArray(pending?.remove) ? [...new Set(pending.remove.filter((id) => typeof id === 'string'))] : [],
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
  #loaded = false
  #writing = Promise.resolve()

  constructor(file) {
    this.#file = file
  }

  get file() { return this.#file }
  get state() { return this.#state }

  async load() {
    if (this.#loaded) return this.#state
    this.#loaded = true
    try {
      const raw = await readFile(this.#file, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        this.#state = {
          ...blankState(),
          ...parsed,
          repos: parsed.repos && typeof parsed.repos === 'object' ? parsed.repos : {},
          lists: Array.isArray(parsed.lists) ? parsed.lists : [],
          changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        }
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    for (const repo of Object.values(this.#state.repos)) {
      repo.pending = normalizePending(repo.pending)
      if (!Array.isArray(repo.lists)) repo.lists = []
    }
    if (!this.#state.unstarredAt || typeof this.#state.unstarredAt !== 'object') this.#state.unstarredAt = {}
    for (const list of this.#state.lists) {
      if (!Array.isArray(list.repos)) list.repos = []
      if (!list.itemIds || typeof list.itemIds !== 'object') list.itemIds = {}
      list.count = list.repos.length
    }
    // 旧版本把每次 +1 star 都记成变更；读盘时清掉这些噪声，只留阈值以上的涨跌。
    const seen = new Set()
    this.#state.changes = this.#state.changes.filter((change) => {
      if (change?.kind === 'stars' && Math.abs(Number(change.delta) || 0) < STAR_DELTA_MIN) return false
      const key = `${change?.kind}:${change?.nameWithOwner}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return this.#state
  }

  /** 串行化写入，避免并发 save 互相覆盖；先写临时文件再改名。 */
  async save() {
    const run = async () => {
      await mkdir(path.dirname(this.#file), { recursive: true })
      const tmp = `${this.#file}.${process.pid}.tmp`
      await writeFile(tmp, `${JSON.stringify(this.#state, null, 2)}\n`, 'utf8')
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
    const prev = this.#state.repos
    // 用落盘的 baselineAt 判断「是否曾经建立过基线」：只看 repos 是否为空的话，
    // 某次抓回 0 个仓库后再抓，会把全新仓库误当成首次基线，漏掉 new 变更。
    const hadBaseline = Boolean(this.#state.baselineAt) || Object.keys(prev).length > 0
    const now = Date.now()
    const staleBefore = now - staleDays * 86_400_000
    const lists = fetched.lists ?? []
    // lists(first: 30) 有上限：抓回来正好 30 个时可能漏掉一部分归属，这种情况才回退到旧值。
    const listCapHit = lists.length >= 30
    const listMembership = new Map()
    for (const list of lists) {
      for (const name of list.repos ?? []) {
        if (!listMembership.has(name)) listMembership.set(name, [])
        listMembership.get(name).push(list.id)
      }
    }

    const next = {}
    const order = []
    const changes = []

    for (const repo of fetched.repos ?? []) {
      const name = repo.nameWithOwner
      if (!name) continue
      const old = prev[name]
      // 不在任何 list 的仓库必须归零：否则删掉 GitHub 上的 list 后，本地会一直留着已删的 id。
      const listing = listMembership.get(name) ?? (listCapHit ? old?.lists ?? [] : [])
      const merged = {
        ...repo,
        lists: [...new Set(listing)],
        pending: normalizePending(old?.pending),
        firstSeenAt: old?.firstSeenAt ?? new Date().toISOString(),
        stale: Boolean(repo.pushedAt && Date.parse(repo.pushedAt) < staleBefore),
      }
      next[name] = merged
      order.push(name)

      if (!old) {
        if (hadBaseline) changes.push(changeEntry('new', merged, `新收藏：${name}`))
        continue
      }
      const oldTag = old.latestRelease?.tagName ?? null
      const newTag = merged.latestRelease?.tagName ?? null
      if (newTag && newTag !== oldTag) {
        changes.push(changeEntry('release', merged, oldTag ? `新版本 ${newTag}（原 ${oldTag}）` : `首次发布 ${newTag}`, { tag: newTag }))
      } else if (merged.pushedAt && old.pushedAt && merged.pushedAt !== old.pushedAt && Date.parse(merged.pushedAt) > Date.parse(old.pushedAt)) {
        changes.push(changeEntry('commits', merged, `有新提交（${merged.pushedAt.slice(0, 10)}）`))
      }
      if (merged.archived && !old.archived) changes.push(changeEntry('archived', merged, '仓库已归档'))
      // star 数每天都会小幅波动，只有涨跌超过阈值才值得提示，避免淹没真正的代码变更。
      const delta = (merged.stars ?? 0) - (old.stars ?? 0)
      const starThreshold = Math.max(STAR_DELTA_MIN, Math.round((old.stars ?? 0) * 0.1))
      if (Math.abs(delta) >= starThreshold) {
        changes.push(changeEntry('stars', merged, `star ${delta > 0 ? '+' : ''}${delta}`, { delta }))
      }
    }

    for (const name of Object.keys(prev)) {
      if (next[name]) continue
      // 本面板取消 star 的仓库会留下墓碑：分得清「我删的」和「在别处取消的」，
      // 否则用户点完取消 star 再刷新，会看到一条莫名其妙的「已取消 star」变更。
      const tomb = this.#state.unstarredAt?.[name]
      const mine = tomb && now - Date.parse(tomb) < UNSTARRED_TTL_MS
      changes.push(changeEntry(
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
    this.#state.lists = (fetched.lists ?? []).map((list) => ({
      ...list,
      repos: [...(list.repos ?? [])],
      // item 的 node id 只有 GitHub 知道；孤儿成员（已不在 star 里）移出分类时要用它。
      itemIds: { ...(list.itemIds ?? {}) },
      count: (list.repos ?? []).length,
    }))
    this.#state.viewer = fetched.viewer ?? this.#state.viewer
    this.#state.snapshotAt = new Date().toISOString()
    this.#state.baselineAt ??= this.#state.snapshotAt
    // 同一个仓库的同一种变更只留最新一条：反复刷新时不会堆出一串重复的「有新提交」。
    const fresh = new Set(changes.map((change) => `${change.kind}:${change.nameWithOwner}`))
    this.#state.changes = [
      ...changes,
      ...this.#state.changes.filter((change) => !fresh.has(`${change.kind}:${change.nameWithOwner}`)),
    ].slice(0, MAX_CHANGES)
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
      repo.pending = hasPending(pending) ? pending : emptyPending()
      if (sameMembers(desiredLists(repo), repo.lists)) repo.pending = emptyPending()
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
    repo.lists = [...new Set(listIds)]
    repo.pending = emptyPending()
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

  markViewed() {
    this.#state.lastViewedAt = new Date().toISOString()
  }

  /** 直接在变更流里插一条（取消 star 这类「用户自己刚做的」不能等下次抓取才显示）。 */
  pushChange(kind, repo, text, extra = {}) {
    const entry = changeEntry(kind, repo, text, extra)
    const key = `${kind}:${repo?.nameWithOwner ?? ''}`
    this.#state.changes = [
      entry,
      ...this.#state.changes.filter((change) => `${change.kind}:${change.nameWithOwner}` !== key),
    ].slice(0, MAX_CHANGES)
    return entry
  }

  /** 取消 star 成功后：仓库从本地快照里彻底消失（连同它的暂存与分类归属）。 */
  dropRepo(nameWithOwner) {
    const repo = this.#state.repos[nameWithOwner]
    if (!repo) return null
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
  applyListRemoval(nameWithOwner, listId, targetListId = null) {
    for (const list of this.#state.lists) {
      if (list.id === listId) {
        list.repos = (list.repos ?? []).filter((name) => name !== nameWithOwner)
        if (list.itemIds) delete list.itemIds[nameWithOwner]
        list.count = list.repos.length
      } else if (targetListId && list.id === targetListId) {
        const repos = list.repos ?? []
        if (!repos.includes(nameWithOwner)) list.repos = [...repos, nameWithOwner]
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
    const orphans = this.#state.lists.map((list) => ({
      id: list.id,
      names: (list.repos ?? []).filter((name) => !this.#state.repos[name]),
    }))
    const lists = this.#state.lists.map((list) => ({
      ...list,
      repos: undefined,
      itemIds: undefined,
      count: list.repos?.length ?? list.count ?? 0,
    }))
    const repos = (this.#state.order ?? Object.keys(this.#state.repos)).map((name) => this.#state.repos[name]).filter(Boolean)
    const lastViewedAt = this.#state.lastViewedAt
    const unread = lastViewedAt
      ? this.#state.changes.filter((change) => change.at > lastViewedAt)
      : this.#state.changes
    return {
      viewer: this.#state.viewer,
      lists,
      orphans,
      repos: repos.map((repo) => ({ ...repo, desired: desiredLists(repo) })),
      changes: this.#state.changes,
      unreadCount: unread.length,
      snapshotAt: this.#state.snapshotAt,
      lastViewedAt,
    }
  }
}
