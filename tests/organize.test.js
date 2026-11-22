import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_GROUPS, MIN_NEW_GROUP, buildPrompt, extractJson, normalizePlan, pickModel } from '../src/organize.js'

const repos = [
  { nameWithOwner: 'a/llm-kit', description: 'LLM tooling', topics: ['llm', 'agent'], language: 'TypeScript', stars: 120 },
  { nameWithOwner: 'b/music', description: 'music player', topics: ['music'], language: 'Go', stars: 40 },
  { nameWithOwner: 'c/quant', description: 'quant trading', topics: ['trading'], language: 'Python', stars: 7 },
]
const lists = [{ id: 'L1', name: 'AI Agent 与技能', count: 42 }]

test('buildPrompt 带上现有分类、模式与仓库行', () => {
  const prompt = buildPrompt({ repos, lists, mode: 'reuse' })
  assert.match(prompt, /AI Agent 与技能（42 个）/)
  assert.match(prompt, /基于当前分类整理/)
  assert.match(prompt, /1\|a\/llm-kit\|LLM tooling\|llm,agent\|TypeScript\|120/)
  assert.doesNotMatch(prompt, /第 1\/1 批/)
})

test('buildPrompt 在 rebuild 模式与分批时换措辞', () => {
  const prompt = buildPrompt({ repos, lists: [], mode: 'rebuild', batch: 2, batches: 3 })
  assert.match(prompt, /没有任何分类/)
  assert.match(prompt, /完全重新整理/)
  assert.match(prompt, /第 2\/3 批/)
})

test('extractJson 容忍代码块、前后废话与尾逗号', () => {
  assert.deepEqual(extractJson('{"groups":[]}'), { groups: [] })
  assert.deepEqual(extractJson('好的：\n```json\n{"groups":[{"list":"x","repos":["a/b"]},]}\n```'), { groups: [{ list: 'x', repos: ['a/b'] }] })
  assert.equal(extractJson('完全没有 JSON'), null)
  assert.equal(extractJson(''), null)
})

test('normalizePlan 丢掉不存在的仓库名并去重', () => {
  const plan = normalizePlan({
    groups: [
      { list: 'AI Agent 与技能', repos: ['a/llm-kit', 'zzz/nope'] },
      { list: '音乐', repos: ['b/music', 'a/llm-kit'] },
    ],
    unsorted: ['c/quant', 'zzz/nope'],
  }, { repos, lists, mode: 'rebuild' })
  assert.deepEqual(plan.groups, [
    { name: 'AI Agent 与技能', repos: ['a/llm-kit'] },
    { name: '音乐', repos: ['b/music'] },
  ])
  assert.equal(plan.dropped, 2)
  assert.deepEqual(plan.unsorted, ['c/quant'])
})

test('normalizePlan 复用现有分类名的大小写，并裁掉超长分类名', () => {
  const plan = normalizePlan({
    groups: [
      { list: 'ai agent 与技能', repos: ['a/llm-kit'] },
      { list: '这是一个非常非常非常非常长的分类名字需要被截断', repos: ['b/music'] },
    ],
  }, { repos, lists, mode: 'rebuild' })
  assert.equal(plan.groups[0].name, 'AI Agent 与技能')
  assert.ok(plan.groups[1].name.length <= 24)
})

test('normalizePlan 把没归类的仓库补进 unsorted，并限制分类数', () => {
  const wide = Array.from({ length: 20 }, (_, index) => ({ nameWithOwner: `x/r${index}`, description: '', topics: [], language: 'Go', stars: 1 }))
  const many = Array.from({ length: MAX_GROUPS + 3 }, (_, index) => ({ list: `类${index}`, repos: [`x/r${index}`] }))
  const plan = normalizePlan({ groups: many }, { repos: wide, mode: 'rebuild' })
  assert.equal(plan.groups.length, MAX_GROUPS)
  // 被截掉的分类里的仓库回到 unsorted，而不是凭空消失。
  assert.equal(plan.unsorted.length, 20 - MAX_GROUPS)
  const empty = normalizePlan({ groups: [] }, { repos })
  assert.deepEqual(empty.unsorted, ['a/llm-kit', 'b/music', 'c/quant'])
})

test('reuse 模式下不给单个仓库新建分类（回退到 unsorted），rebuild 模式允许', () => {
  const parsed = {
    groups: [
      { list: 'AI Agent 与技能', repos: ['a/llm-kit'] },
      { list: '系统工具', repos: ['c/quant'] },
    ],
  }
  const reuse = normalizePlan(parsed, { repos, lists, mode: 'reuse' })
  assert.deepEqual(reuse.groups.map((group) => group.name), ['AI Agent 与技能'])
  assert.ok(reuse.unsorted.includes('c/quant'))
  const rebuild = normalizePlan(parsed, { repos, lists, mode: 'rebuild' })
  assert.deepEqual(rebuild.groups.map((group) => group.name), ['AI Agent 与技能', '系统工具'])
  assert.equal(MIN_NEW_GROUP, 2)
})

test('pickModel 优先用配置，缺配置时取第一个能报出模型的 provider', async () => {
  const llm = {
    listProviders: () => [{ id: 'magpie' }, { id: 'deepseek' }],
    listModels: async (id) => (id === 'magpie' ? [] : [{ id: 'deepseek-chat' }]),
  }
  assert.deepEqual(await pickModel(llm, { provider: 'magpie', model: 'm1' }), { provider: 'magpie', model: 'm1' })
  assert.deepEqual(await pickModel(llm, {}), { provider: 'deepseek', model: 'deepseek-chat' })
  assert.equal(await pickModel(llm, { provider: 'nope' }), null)
  assert.equal(await pickModel(null, {}), null)
})
