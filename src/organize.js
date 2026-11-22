/**
 * AI 整理：把 star 仓库按语义分进 GitHub Lists。
 *
 * 关键词规则能覆盖常见仓库，但用户第一次打开面板时往往「一个分类都没有、27 条未归类」，
 * 手工点太累。这里走 DSH 宿主已经配好的模型（`ctx.llm`），一次调用给出分类方案，
 * 面板只把它当作「建议」——真正写回 GitHub 仍要用户确认预览并点同步。
 */
import { GitHubError } from './github.js'

/** 一次喂给模型的仓库上限；超过就分批，避免输出被截断。 */
export const MAX_REPOS_PER_CALL = 60
/** 分类名长度上限，和面板输入框一致。 */
export const MAX_LIST_NAME = 24
/** 模型给出的分类数上限，防止它把每个仓库都单开一类。 */
export const MAX_GROUPS = 12
/** 「基于当前分类整理」时，新建分类至少要有这么多个仓库，否则回未归类。 */
export const MIN_NEW_GROUP = 2

const SYSTEM = [
  '你是 GitHub star 整理助手。你的任务是把用户 star 的仓库分进若干「列表」（类似收藏夹）。',
  '只输出 JSON，不要解释、不要 Markdown 代码块。',
].join('\n')

/** 拼一次调用的 prompt。纯函数，便于单测。 */
export function buildPrompt({ repos, lists = [], mode = 'reuse', batch = 1, batches = 1 }) {
  const existing = lists
    .map((list) => `- ${list.name}（${list.count ?? list.repos?.length ?? 0} 个）`)
    .join('\n')
  const lines = repos.map((repo, index) => {
    const topics = (repo.topics ?? []).slice(0, 6).join(',')
    const desc = String(repo.description ?? '').replace(/\s+/g, ' ').slice(0, 160)
    return `${index + 1}|${repo.nameWithOwner}|${desc}|${topics}|${repo.language ?? ''}|${repo.stars ?? 0}`
  })
  const rules = mode === 'rebuild'
    ? [
      '这次要「完全重新整理」：忽略用户现有的分类，重新给出一套你觉得更合理的分类。',
      '可以直接复用上面的分类名，也可以新建。',
    ]
    : [
      '这次要「基于当前分类整理」：优先复用上面的分类名；某个仓库确实不属于任何现有分类时，可以新建一个分类。',
      '不要为了整齐而新建与现有分类同义的名字（例如「AI 工具」和「AI Agent 与技能」只留一个）。',
      `新建的分类至少要装 ${MIN_NEW_GROUP} 个仓库；只有 1 个仓库的零散主题放进 unsorted，不要为它单开分类。`,
    ]
  return [
    existing ? `用户现有的分类：\n${existing}` : '用户现在没有任何分类。',
    '',
    ...rules,
    '',
    `下面是 ${repos.length} 个 star 仓库，每行格式：序号|仓库|描述|topics|语言|star 数`,
    ...lines,
    '',
    batches > 1 ? `（这是第 ${batch}/${batches} 批，只需要处理这些仓库。）` : '',
    '要求：',
    '1. 每个仓库最多进一个分类；实在判断不了的放进 "unsorted"。',
    '2. 分类名简洁具体（不超过 12 个字），同类仓库要合在一起，不要按仓库单开分类。',
    '3. 输出格式（严格 JSON，不要代码块）：',
    '{"groups":[{"list":"分类名","repos":["owner/name",...]}],"unsorted":["owner/name",...]}',
    `4. repos 里只能用上面出现过的仓库名；最多 ${MAX_GROUPS} 个分类。`,
  ].filter(Boolean).join('\n')
}

/** 从模型输出里抠出 JSON：容忍代码块包裹、前后废话、结尾逗号。 */
export function extractJson(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)
  const candidate = fenced ? fenced[1] : raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  const body = candidate.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

/**
 * 把模型输出对齐到真实数据：丢掉不存在的仓库名、去掉重复归属、裁剪超长分类名。
 * 纯函数，返回 `{ groups, unsorted, dropped }`。
 */
export function normalizePlan(parsed, { repos, lists = [], mode = 'reuse' }) {
  const known = new Set(repos.map((repo) => repo.nameWithOwner))
  const existingNames = new Map(lists.map((list) => [list.name.toLowerCase(), list.name]))
  const seen = new Set()
  const groups = []
  let dropped = 0
  for (const group of Array.isArray(parsed?.groups) ? parsed.groups : []) {
    const rawName = String(group?.list ?? '').trim()
    if (!rawName) continue
    const name = existingNames.get(rawName.toLowerCase()) ?? rawName.slice(0, MAX_LIST_NAME)
    const names = []
    for (const value of Array.isArray(group?.repos) ? group.repos : []) {
      const fullName = String(value ?? '').trim()
      if (!known.has(fullName)) {
        dropped += 1
        continue
      }
      if (seen.has(fullName)) continue
      seen.add(fullName)
      names.push(fullName)
    }
    if (names.length === 0) continue
    // 基于现有分类整理时，别让模型为单个仓库新建分类：留着未归类更清爽。
    if (mode !== 'rebuild' && !existingNames.has(name.toLowerCase()) && names.length < MIN_NEW_GROUP) {
      for (const fullName of names) seen.delete(fullName)
      continue
    }
    groups.push({ name, repos: names })
    if (groups.length >= MAX_GROUPS) break
  }
  const unsorted = []
  for (const value of Array.isArray(parsed?.unsorted) ? parsed.unsorted : []) {
    const fullName = String(value ?? '').trim()
    if (!known.has(fullName)) {
      dropped += 1
      continue
    }
    if (seen.has(fullName) || unsorted.includes(fullName)) continue
    unsorted.push(fullName)
  }
  const unassigned = repos.map((repo) => repo.nameWithOwner).filter((fullName) => !seen.has(fullName))
  return { groups, unsorted: unsorted.length ? unsorted : unassigned, dropped }
}

/** 取模型的一次完整输出：`ctx.llm` 的流按 text-delta 累积，只接受正常结束。 */
export async function askModel({ llm, provider, model, prompt, maxTokens = 4000, signal, timeoutMs = 90_000 }) {
  const call = await llm.prepareCall({ provider, model, maxTokens }, signal)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('模型响应超时')), timeoutMs)
  const merged = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  let text = ''
  let reason = null
  try {
    for await (const chunk of call.stream({
      ...call.config,
      system: SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      signal: merged,
    })) {
      if (chunk.type === 'text-delta') text += chunk.text
      else if (chunk.type === 'finish') reason = chunk.reason
    }
  } finally {
    clearTimeout(timer)
  }
  if (reason && reason.kind === 'error') throw new GitHubError('model', '模型调用失败')
  if (reason && reason.kind === 'aborted') throw new GitHubError('model', '模型调用被中断')
  if (!text.trim()) throw new GitHubError('model', '模型没有返回内容')
  return { text, config: call.config }
}

/**
 * 选一个能用的模型路由：配置优先，否则从已注册的 provider 里挑第一个报出模型的。
 * 面板没有模型选择器，所以这里尽量少做判断，选中什么就原样告诉用户。
 */
export async function pickModel(llm, { provider, model } = {}) {
  if (!llm) return null
  const providers = llm.listProviders().map((row) => row.id)
  if (provider) {
    if (!providers.includes(provider)) return null
    if (model) return { provider, model }
    const models = await llm.listModels(provider)
    const first = models[0]?.id
    return first ? { provider, model: first } : null
  }
  for (const id of providers) {
    const models = await llm.listModels(id)
    const first = models[0]?.id
    if (first) return { provider: id, model: first }
  }
  return null
}
