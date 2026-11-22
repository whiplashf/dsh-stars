/**
 * GitHub 访问层：所有网络请求都通过 `gh` 子进程完成，不直接持有 token。
 * 子进程环境被裁剪（只保留 PATH/HOME/语言/GH_*），避免 DSH 的密钥变量泄漏进去。
 */
import { spawn } from 'node:child_process'

const DEFAULT_TIMEOUT_MS = 40_000
const MAX_BUFFER = 32 * 1024 * 1024

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

export class GitHub {
  #ghPath
  #timeoutMs
  #active = 0
  #maxConcurrent = 3

  constructor({ ghPath = 'gh', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.#ghPath = ghPath || 'gh'
    this.#timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS
  }

  /** 执行一次 gh 子进程，成功时返回 stdout 文本。 */
  #run(args, input) {
    return new Promise((resolve, reject) => {
      let child
      try {
        child = spawn(this.#ghPath, args, { env: ghEnv(), stdio: ['pipe', 'pipe', 'pipe'] })
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
        child.kill('SIGKILL')
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
          child.kill('SIGKILL')
          finish(reject, new GitHubError('too-large', 'gh 输出超过 32MB'))
          return
        }
        stdout += chunk
      })
      child.stderr.on('data', (chunk) => { stderr += chunk })
      child.on('close', (code) => {
        if (code === 0) finish(resolve, stdout)
        else {
          const code = classify(stderr)
          finish(reject, new GitHubError(code, withHint(code, shortMessage(stderr, `gh 退出码 ${code}`))))
        }
      })
      if (input !== undefined) child.stdin.end(input)
      else child.stdin.end()
    })
  }

  /** 通过 stdin 传 JSON，避免 `-f` 只能传字符串的限制（数组/布尔都需要）。 */
  async #graphql(query, variables) {
    const body = JSON.stringify({ query, variables: variables ?? {} })
    const out = await this.#run(['api', 'graphql', '--input', '-'], body)
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

  /** 当前账号与他的全部 Lists（含每个 List 的仓库归属，超过 100 个自动翻页）。 */
  async fetchLists() {
    const data = await this.#graphql(`
      query {
        viewer {
          login
          lists(first: 30) {
            totalCount
            nodes {
              id
              name
              description
              isPrivate
              items(first: 1) { totalCount }
            }
          }
        }
      }
    `)
    const viewer = data?.viewer?.login ?? null
    const nodes = data?.viewer?.lists?.nodes ?? []
    const lists = []
    for (const node of nodes) {
      const total = node?.items?.totalCount ?? 0
      const members = []
      let cursor = null
      for (let page = 0; page < 20; page += 1) {
        if (page > 0 && total <= members.length) break
        const chunk = await this.#limit(() => this.#graphql(`
          query ($id: ID!, $cursor: String) {
            node(id: $id) {
              ... on UserList {
                items(first: 100, after: $cursor) {
                  totalCount
                  pageInfo { hasNextPage endCursor }
                  nodes { ... on Repository { nameWithOwner } }
                }
              }
            }
          }
        `, { id: node.id, cursor }))
        const items = chunk?.node?.items
        for (const item of items?.nodes ?? []) {
          if (item?.nameWithOwner) members.push(item.nameWithOwner)
        }
        if (!items?.pageInfo?.hasNextPage) break
        cursor = items.pageInfo.endCursor
      }
      lists.push({
        id: node.id,
        name: node.name ?? '',
        description: node.description ?? '',
        isPrivate: Boolean(node.isPrivate),
        count: total,
        repos: members,
      })
    }
    return { viewer, lists }
  }

  /** 全部 star 仓库，按收藏时间倒序，最多 10 页（1000 个）。 */
  async fetchStarred() {
    const repos = []
    let viewer = null
    let cursor = null
    let total = 0
    for (let page = 0; page < 10; page += 1) {
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
    return {
      viewer: starredPart.viewer ?? listsPart.viewer,
      total: starredPart.total,
      lists: listsPart.lists,
      repos: starredPart.repos,
    }
  }

  /** 把一个仓库归属的 Lists 整体设置为 listIds（GitHub 的语义是替换）。 */
  async setItemLists(itemId, listIds) {
    const data = await this.#graphql(`
      mutation ($itemId: ID!, $listIds: [ID!]!) {
        updateUserListsForItem(input: { itemId: $itemId, listIds: $listIds }) {
          item { ... on Repository { nameWithOwner } }
          lists { totalCount }
        }
      }
    `, { itemId, listIds })
    return data?.updateUserListsForItem ?? null
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
