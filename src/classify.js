/**
 * 归类建议：只给建议，不自动写。规则按顺序匹配 topics / 描述 / 仓库名。
 * 用 config.suggestRules 可以整表替换（每项 { name, keywords }）。
 */
export const DEFAULT_RULES = [
  {
    name: 'AI Agent 与技能',
    keywords: ['claude-code', 'claude code', 'codex', 'agent', 'mcp', 'skill', 'copilot', 'cursor', 'openai', 'prompt', '工作流'],
  },
  {
    name: '音乐与音频',
    keywords: ['music', 'midi', 'audio', 'tts', 'voice', 'speech', 'song', 'vocal', 'synth', 'ableton', '音'],
  },
  {
    name: 'LLM 与深度学习',
    keywords: ['transformer', 'deep-learning', 'pytorch', 'tensorflow', 'diffusion', 'llama', 'vllm', 'embedding', 'rag', 'fine-tune', 'neural', 'llm'],
  },
  {
    name: '量化交易',
    keywords: ['quant', 'trading', 'backtest', 'stock', 'finance', 'akshare', 'tushare'],
  },
  {
    name: '学习与教程',
    keywords: ['leetcode', 'algorithm', 'tutorial', 'course', 'awesome', 'roadmap', '教程', '指南'],
  },
  {
    name: '前端与工具',
    keywords: ['react', 'vue', 'svelte', 'tailwind', 'vite', 'frontend', 'component', 'css', 'design'],
  },
]

function normalizeRules(rules) {
  if (!Array.isArray(rules)) return DEFAULT_RULES
  const cleaned = rules
    .filter((rule) => rule && typeof rule.name === 'string' && Array.isArray(rule.keywords))
    .map((rule) => ({ name: rule.name, keywords: rule.keywords.filter((keyword) => typeof keyword === 'string' && keyword) }))
    .filter((rule) => rule.keywords.length > 0)
  return cleaned.length > 0 ? cleaned : DEFAULT_RULES
}

/** @returns {{ list: string|null, keyword: string|null }} */
export function suggestFor(repo, rules) {
  if (!repo) return { list: null, keyword: null }
  const haystack = [
    ...(Array.isArray(repo.topics) ? repo.topics : []),
    repo.description ?? '',
    repo.nameWithOwner ?? '',
  ].join(' ').toLowerCase()
  for (const rule of normalizeRules(rules)) {
    const hit = rule.keywords.find((keyword) => haystack.includes(keyword.toLowerCase()))
    if (hit) return { list: rule.name, keyword: hit }
  }
  return { list: null, keyword: null }
}

export function suggestAll(repos, rules) {
  const out = {}
  for (const repo of repos ?? []) {
    const suggestion = suggestFor(repo, rules)
    if (suggestion.list) out[repo.nameWithOwner] = suggestion
  }
  return out
}
