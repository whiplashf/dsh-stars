/**
 * GitHub 访问层：所有网络请求都通过 `gh` 子进程完成，不直接持有 token。
 * 子进程环境被裁剪（只保留 PATH/HOME/语言/GH_*），避免 DSH 的密钥变量泄漏进去。
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DEFAULT_TIMEOUT_MS = 40_000
const MAX_BUFFER = 32 * 1024 * 1024
const LIST_FIELDS = `
  id name description isPrivate
  items(first: 100) {
    totalCount pageInfo { hasNextPage endCursor }
    nodes { ... on Repository { id nameWithOwner } }
  }
`
const ACCOUNT_RUNNER = fileURLToPath(new URL('./gh-account.js', import.meta.url))

export class GitHubError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'GitHubError'
    this.code = code
    this.details = details
  }
}

function ghEnv() {
  const env = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    if (/TOKEN|SECRET|PASSWORD|PASSWD|COOKIE|CREDENTIAL/i.test(key)) continue
    if (!/^(PATH|HOME|USER|LOGNAME|SHELL|LANG|LANGUAGE|LC_[A-Z_]+|TZ|TERM|GH_[A-Z_]+)$/.test(key)) continue
    env[key] = value
  }
  env.GH_PROMPT_DISABLED = '1'
  env.GH_PAGER = 'cat'
  env.GH_NO_UPDATE_NOTIFIER = '1'
  env.NO_COLOR = '1'
  if (!env.PATH) env.PATH = '/usr/local/bin:/usr/bin:/bin'
  return env
}

function classify(stderr) {
  const text = String(stderr || '')
  if (/requires one of the following scopes|has not been granted the required scopes/i.test(text)) return 'scope'
  if (/not logged|no oauth|authentication|gh auth login|HTTP 401/i.test(text)) return 'unauthenticated'
  if (/HTTP 404|Could not resolve to a node/i.test(text)) return 'not-found'
  if (/HTTP 403|rate limit|secondary rate/i.test(text)) return 'rate-limited'
  return 'unavailable'
}

function withHint(code, message) {
  if (code === 'scope') return `${message}（gh token 缺少 user scope，先运行 gh auth refresh -s user）`
  return message
}

function shortMessage(stderr, fallback) {
  const text = String(stderr || '').trim()
  if (!text) return fallback
  return text.split('\n').filter(Boolean).slice(-1)[0].slice(0, 300)
}

/**
 * 把 `gh auth status --json hosts` 的输出整理成面板能直接渲染的状态。
 * 纯函数，方便单测；不碰网络、不碰文件。
 */
export function parseAuthStatus(stdout) {
  let parsed
  try {
    parsed = JSON.parse(String(stdout || ''))
  } catch {
    return { state: 'unknown', detail: '无法解析 gh auth status 的输出' }
  }
  const raw = parsed?.hosts?.['github.com']
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : []
  const entry = entries.find((each) => each?.active) ?? entries[0] ?? null
  if (!entry || (entry.state && entry.state !== 'success')) {
    return { state: 'not-logged-in', command: 'gh auth login', login: entry?.login ?? null }
  }
  const scopes = String(entry.scopes ?? '').split(/[,\s]+/).filter(Boolean)
  const login = entry.login ?? null
  // 写回 Lists 需要 user scope；没有它只读功能仍然可用。
  if (!scopes.includes('user')) {
    return { state: 'missing-user-scope', login, scopes, command: 'gh auth refresh -h github.com -s user' }
  }
  return { state: 'ok', login, scopes }
}

export class GitHub {
  #ghPath
  #timeoutMs
  #account
  #active = 0
  // gh 每次调用都起一个子进程、GitHub 单次往返 ~0.7s，3 并发是瓶颈；
  // 6 并发仍远低于 GitHub 的次级限流阈值（写操作按条串行提交）。
  #maxConcurrent = 6

  constructor({ ghPath = 'gh', timeoutMs = DEFAULT_TIMEOUT_MS, account = null } = {}) {
    this.#ghPath = ghPath || 'gh'
    this.#timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS
    this.#account = account
  }

  forAccount(login) {
    if (!login) throw new GitHubError('unauthenticated', '请先检查 GitHub 登录账号')
    return new GitHub({ ghPath: this.#ghPath, timeoutMs: this.#timeoutMs, account: login })
  }

  /** 执行一次 gh 子进程，成功时返回 stdout 文本。 */
  #run(args, input) {
    return new Promise((resolve, reject) => {
      let child
      try {
        const options = { env: ghEnv(), stdio: ['pipe', 'pipe', 'pipe'] }
        child = this.#account
          ? spawn(process.execPath, [ACCOUNT_RUNNER, this.#ghPath, this.#account, String(this.#timeoutMs), ...args], options)
          : spawn(this.#ghPath, args, options)
      } catch (error) {
        reject(new GitHubError('unavailable', `无法启动 gh：${error?.message ?? error}`))
        return
      }
      let stdout = ''
      let stderr = ''
      let settled = false
      let size = 0
      const finish = (fn, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn(value)
      }
      const timer = setTimeout(() => {
        child.kill(this.#account ? 'SIGTERM' : 'SIGKILL')
        finish(reject, new GitHubError('timeout', `gh 超时（${this.#timeoutMs}ms）`))
      }, this.#timeoutMs)
      child.on('error', (error) => {
        finish(reject, new GitHubError(
          error?.code === 'ENOENT' ? 'unavailable' : 'unavailable',
          error?.code === 'ENOENT' ? `找不到 gh 命令（${this.#ghPath}）` : `gh 启动失败：${error?.message ?? error}`,
        ))
      })
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_BUFFER) {
          child.kill(this.#account ? 'SIGTERM' : 'SIGKILL')
          finish(reject, new GitHubError('too-large', 'gh 输出超过 32MB'))
          return
        }
        stdout += chunk
      })
      child.stderr.on('data', (chunk) => { stderr += chunk })
      child.on('close', (exitCode) => {
        if (exitCode === 0) finish(resolve, stdout)
        else {
          const code = classify(stderr)
          finish(reject, new GitHubError(code, withHint(code, shortMessage(stderr, `gh 退出码 ${exitCode}`))))
        }
      })
      child.stdin.on('error', (error) => {
        if (error.code !== 'EPIPE') finish(reject, error)
      })
      if (input !== undefined) child.stdin.end(input)
      else child.stdin.end()
    })
  }

  /** 通过 stdin 传 JSON，避免 `-f` 只能传字符串的限制（数组/布尔都需要）。 */
  async #graphql(query, variables) {
    const body = JSON.stringify({ query, variables: variables ?? {} })
    const out = await this.#run(['api', 'graphql', '--hostname', 'github.com', '--input', '-'], body)
    let parsed
    try {
      parsed = JSON.parse(out)
    } catch {
      throw new GitHubError('unavailable', 'gh 返回了非 JSON 输出')
    }
    if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
      const first = parsed.errors[0]
      const code = classify(first?.message)
      throw new GitHubError(code, withHint(code, first?.message ?? 'GraphQL 错误'), { errors: parsed.errors })
    }
    return parsed?.data ?? {}
  }

  async #limit(fn) {
    while (this.#active >= this.#maxConcurrent) await new Promise((resolve) => setTimeout(resolve, 60))
    this.#active += 1
    try {
      return await fn()
    } finally {
      this.#active -= 1
    }
  }

  async #readList(node) {
    const repos = []
    const itemIds = {}
    const seen = new Set()
    const cursors = new Set()
    let items = node.items
    const total = items?.totalCount
    for (;;) {
      if (!Array.isArray(items?.nodes) || typeof items.pageInfo?.hasNextPage !== 'boolean') {
        throw new GitHubError('unavailable', '分类成员读取不完整，请重试')
      }
      for (const item of items.nodes) {
        if (!item?.id || !item.nameWithOwner || seen.has(item.id) || Object.hasOwn(itemIds, item.nameWithOwner)) {
          throw new GitHubError('unavailable', '读取期间分类成员已变化，请重试')
        }
        seen.add(item.id)
        repos.push(item.nameWithOwner)
        itemIds[item.nameWithOwner] = item.id
      }
      if (!items.pageInfo.hasNextPage) break
      const cursor = items.pageInfo.endCursor
      if (!cursor || cursors.has(cursor)) throw new GitHubError('unavailable', '分类成员分页不完整，请重试')
      cursors.add(cursor)
      const page = await this.#limit(() => this.#graphql(`
        query ($id: ID!, $cursor: String!) {
          node(id: $id) { ... on UserList { items(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { ... on Repository { id nameWithOwner } }
          } } }
        }
      `, { id: node.id, cursor }))
      items = page?.node?.items
    }
    if (repos.length !== total) throw new GitHubError('unavailable', '读取期间分类成员数量已变化，请重试')
    return { id: node.id, name: node.name, description: node.description ?? '', isPrivate: Boolean(node.isPrivate),
      count: total, repos, itemIds }
  }

  /** 分页读取分类目录和所有成员，只有完整快照才能用于替换归属。 */
  async fetchLists() {
    const lists = []
    const ids = new Set()
    const cursors = new Set()
    let cursor = null
    let viewer
    let total
    for (;;) {
      const data = await this.#graphql(`
        query ($cursor: String) {
          viewer { login lists(first: 30, after: $cursor) {
            totalCount pageInfo { hasNextPage endCursor } nodes { ${LIST_FIELDS} }
          } }
        }
      `, { cursor })
      const page = data.viewer?.lists
      viewer ??= data.viewer?.login
      total ??= page?.totalCount
      if (!viewer || viewer !== data.viewer?.login || !Array.isArray(page?.nodes) ||
          typeof page.pageInfo?.hasNextPage !== 'boolean' || page.totalCount !== total) {
        throw new GitHubError('unavailable', '分类目录读取不完整，请重试')
      }
      for (const node of page.nodes) {
        if (!node?.id || ids.has(node.id)) throw new GitHubError('unavailable', '读取期间分类目录已变化，请重试')
        ids.add(node.id)
      }
      lists.push(...await Promise.all(page.nodes.map((node) => this.#readList(node))))
      if (!page.pageInfo.hasNextPage) break
      cursor = page.pageInfo.endCursor
      if (!cursor || cursors.has(cursor)) throw new GitHubError('unavailable', '分类目录分页不完整，请重试')
      cursors.add(cursor)
    }
    if (lists.length !== total) throw new GitHubError('unavailable', '读取期间分类数量已变化，请重试')
    return { viewer, lists, listsComplete: true }
  }

  async fetchListMembers(listId) {
    const data = await this.#graphql(`
      query ($id: ID!) { node(id: $id) { ... on UserList { ${LIST_FIELDS} } } }
    `, { id: listId })
    return data.node?.id ? this.#readList(data.node) : null
  }

  /** 只核对本次待写的仓库；大账号无须为一次同步重抓全部 star。 */
  async fetchStarredItems(ids) {
    const names = new Map()
    const batches = []
    for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100))
    await Promise.all(batches.map(async (batch) => {
      const data = await this.#limit(() => this.#graphql(`
        query ($ids: [ID!]!) {
          nodes(ids: $ids) { ... on Repository { id nameWithOwner viewerHasStarred } }
        }
      `, { ids: batch }))
      if (!Array.isArray(data.nodes) || data.nodes.length !== batch.length) {
        throw new GitHubError('unavailable', '无法核对仓库的收藏状态，请重试')
      }
      for (const node of data.nodes) if (node?.viewerHasStarred) names.set(node.id, node.nameWithOwner)
    }))
    return names
  }

  async fetchRelease(itemId, tag) {
    const data = await this.#graphql(`
      query ($id: ID!, $tag: String!) {
        node(id: $id) { ... on Repository {
          release(tagName: $tag) { name tagName publishedAt description url }
        } }
      }
    `, { id: itemId, tag })
    const release = data.node?.release
    if (!release || release.tagName !== tag) throw new GitHubError('not-found', '这个版本已不可见，请刷新仓库信息')
    const description = release.description ?? ''
    return { name: release.name, tagName: tag, url: release.url, publishedAt: release.publishedAt,
      description: description.slice(0, 16000), truncated: description.length > 16000 }
  }

  /** 全部 star 仓库，按收藏时间倒序，最多 100 页（10000 个）。 */
  async fetchStarred() {
    const repos = []
    let viewer = null
    let cursor = null
    let total = 0
    // 以前硬上限 10 页（1000 个 star），几千 star 的账号会被悄悄截断。
    // 现在按 hasNextPage 一直翻，只留一个防呆上限（100 页 = 10000 个）。
    for (let page = 0; page < 100; page += 1) {
      const data = await this.#limit(() => this.#graphql(`
        query ($cursor: String) {
          viewer {
            login
            starredRepositories(first: 100, after: $cursor, orderBy: { field: STARRED_AT, direction: DESC }) {
              totalCount
              pageInfo { hasNextPage endCursor }
              edges {
                starredAt
                node {
                  id
                  nameWithOwner
                  description
                  url
                  isArchived
                  isPrivate
                  stargazerCount
                  primaryLanguage { name }
                  pushedAt
                  latestRelease { tagName publishedAt }
                  repositoryTopics(first: 8) { nodes { topic { name } } }
                }
              }
            }
          }
        }
      `, { cursor }))
      const conn = data?.viewer?.starredRepositories
      viewer = data?.viewer?.login ?? viewer
      total = conn?.totalCount ?? total
      for (const edge of conn?.edges ?? []) {
        const node = edge?.node
        if (!node?.nameWithOwner) continue
        repos.push({
          nameWithOwner: node.nameWithOwner,
          id: node.id,
          description: node.description ?? '',
          url: node.url ?? `https://github.com/${node.nameWithOwner}`,
          archived: Boolean(node.isArchived),
          isPrivate: Boolean(node.isPrivate),
          stars: node.stargazerCount ?? 0,
          language: node.primaryLanguage?.name ?? null,
          pushedAt: node.pushedAt ?? null,
          latestRelease: node.latestRelease ? {
            tagName: node.latestRelease.tagName ?? null,
            publishedAt: node.latestRelease.publishedAt ?? null,
          } : null,
          topics: (node.repositoryTopics?.nodes ?? []).map((entry) => entry?.topic?.name).filter(Boolean),
          starredAt: edge?.starredAt ?? null,
        })
      }
      if (!conn?.pageInfo?.hasNextPage) break
      cursor = conn.pageInfo.endCursor
    }
    return { viewer, total, repos }
  }

  /** 一次拿全量，供快照 diff 使用。 */
  async fetchAll() {
    const [listsPart, starredPart] = await Promise.all([this.fetchLists(), this.fetchStarred()])
    if (!starredPart.viewer || starredPart.viewer !== listsPart.viewer) {
      throw new GitHubError('conflict', '抓取期间 GitHub 账号已变化，请重新刷新')
    }
    return {
      viewer: starredPart.viewer ?? listsPart.viewer,
      total: starredPart.total,
      lists: listsPart.lists,
      listsComplete: listsPart.listsComplete,
      repos: starredPart.repos,
    }
  }

  /** 探测 gh 是否可用、是否登录、token 有没有 user scope；失败不抛，交给面板显示。 */
  async probeAuth() {
    try {
      return parseAuthStatus(await this.#run(['auth', 'status', '--json', 'hosts']))
    } catch (error) {
      const message = error?.message ?? String(error)
      if (/找不到 gh|gh 启动失败/.test(message)) {
        return { state: 'no-gh', command: 'https://cli.github.com/', detail: message }
      }
      if (error?.code === 'unauthenticated') {
        return { state: 'not-logged-in', command: 'gh auth login', detail: message }
      }
      return { state: 'unknown', detail: message }
    }
  }

  /** 把一个仓库归属的 Lists 整体设置为 listIds（GitHub 的语义是替换）。 */
  async setItemLists(itemId, listIds) {
    const data = await this.#graphql(`
      mutation ($itemId: ID!, $listIds: [ID!]!) {
        updateUserListsForItem(input: { itemId: $itemId, listIds: $listIds }) {
          item { ... on Repository { nameWithOwner } }
          lists { id name }
        }
      }
    `, { itemId, listIds })
    const result = data?.updateUserListsForItem
    const applied = result?.lists?.map((list) => list.id)
    if (!Array.isArray(applied) || applied.length !== listIds.length || !listIds.every((id) => applied.includes(id))) {
      throw new GitHubError('unavailable', 'GitHub 返回的归属与预期不符，请重新核对分类')
    }
    return result
  }

  /** 取消 star。GitHub 会顺手把仓库从所有 Lists 里移除，不需要再清归属。 */
  async removeStar(itemId) {
    const data = await this.#graphql(`
      mutation ($itemId: ID!) {
        removeStar(input: { starrableId: $itemId }) {
          starrable { ... on Repository { nameWithOwner } }
        }
      }
    `, { itemId })
    return data?.removeStar ?? null
  }

  /** 删除一个 Lists 分类。调用前必须先把成员搬走，否则成员会带着悬空 id。 */
  async deleteList(listId) {
    const data = await this.#graphql(`
      mutation ($listId: ID!) {
        deleteUserList(input: { listId: $listId }) {
          user { login }
        }
      }
    `, { listId })
    return data?.deleteUserList ?? null
  }

  async createList(name, description = '', isPrivate = false) {
    const data = await this.#graphql(`
      mutation ($name: String!, $description: String, $isPrivate: Boolean!) {
        createUserList(input: { name: $name, description: $description, isPrivate: $isPrivate }) {
          list { id name description isPrivate }
        }
      }
    `, { name, description, isPrivate })
    const list = data?.createUserList?.list
    if (!list?.id) throw new GitHubError('unavailable', '创建 List 没有返回 id')
    return list
  }
}
