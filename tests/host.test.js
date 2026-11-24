import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setImmediate as tick } from 'node:timers/promises'
import { apply } from '../index.js'
import { GitHub } from '../src/github.js'

const repo = (name) => ({ id: name, nameWithOwner: name, stars: 1, topics: [] })
const list = (id, repos = []) => ({ id, name: id, repos, itemIds: Object.fromEntries(repos.map((name) => [name, name])) })
const project = 'example/project'

function snapshot(viewer, repos = [project]) {
  return { viewer, repos: repos.map(repo), lists: [list('A', [...repos]), list('B'), list('C')], listsComplete: true }
}

async function fixture(t, { data = snapshot('alice'), llm } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'stars-route-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const config = { stateFile: join(dir, 'state.json') }
  const session = { login: data.viewer }
  const accounts = new Map([[data.viewer, data]])
  const writes = []
  const client = (login) => ({
    fetchAll: async () => structuredClone(accounts.get(login)),
    fetchLists: async () => {
      const { viewer, lists, listsComplete } = accounts.get(login)
      return structuredClone({ viewer, lists, listsComplete })
    },
    fetchStarredItems: async (ids) => new Map(accounts.get(login).repos
      .filter((row) => ids.includes(row.id)).map((row) => [row.id, row.nameWithOwner])),
    fetchListMembers: async (id) => structuredClone(accounts.get(login).lists.find((entry) => entry.id === id)),
    async setItemLists(itemId, ids) {
      writes.push({ login, itemId, ids })
      for (const entry of accounts.get(login).lists) {
        entry.repos = entry.repos.filter((name) => name !== itemId)
        if (ids.includes(entry.id)) entry.repos.push(itemId)
      }
    },
    async deleteList(id) {
      const state = accounts.get(login)
      state.lists = state.lists.filter((entry) => entry.id !== id)
    },
  })
  const bindings = t.mock.method(GitHub.prototype, 'forAccount', client)
  t.mock.method(GitHub.prototype, 'probeAuth', async () => ({ state: 'ok', login: session.login }))
  function openHost() {
    let handler
    apply({
      effect(fn) { fn() },
      connection: { fetch: { register(route) { handler = route.fetch } } },
      get() { return llm },
    }, config)
    return async (action, fields = {}) => {
      const response = await handler(new Request('http://local.test/api/dsh-stars', {
        method: 'POST', body: JSON.stringify({ action, ...fields }),
      }))
      const result = await response.json()
      if (!result.ok) throw Object.assign(new Error(result.message), { code: result.code, reason: result.reason, status: response.status })
      return result.value
    }
  }
  const call = openHost()
  await call('state')
  return { call, openHost, bindings, client, session, accounts, writes }
}

async function waitJob(call, expectSuccess = true) {
  for (let i = 0; i < 1000; i++) {
    const result = await call('progress')
    if (!result.job?.running) {
      if (expectSuccess) assert.deepEqual(result.job?.failed, [])
      return result
    }
    await tick()
  }
  assert.fail('job did not finish')
}

async function confirm(call) {
  const { plan, planVersion } = await call('plan')
  await call('sync', { expectCount: plan.length, planVersion })
  return waitJob(call)
}

test('预览后条数相同但去向改变会拒绝写回和撤销，最新预览可以逐条撤销', async (t) => {
  const { call, writes } = await fixture(t)
  await call('stage', { fullNames: [project], add: ['B'] })
  const first = await call('plan')
  await call('stage', { fullNames: [project], add: ['C'], remove: ['B'] })
  await assert.rejects(call('sync', { expectCount: 1, planVersion: first.planVersion }), { status: 409 })
  await assert.rejects(call('discardPending', { fullName: project, planVersion: first.planVersion }), { status: 409 })
  assert.deepEqual(writes, [])
  const latest = await call('plan')
  const result = await call('discardPending', { fullName: project, planVersion: latest.planVersion })
  assert.equal(result.preview.plan.length, 0)
  assert.deepEqual(result.repos[0].desired, ['A'])
})

test('切换 gh 账号时拒绝旧预览，两个账号的暂存、跟踪和历史能跨重启恢复', async (t) => {
  const { call, openHost, session, accounts, writes } = await fixture(t)
  await call('stage', { fullNames: [project], remove: ['A'] })
  await call('watch', { fullNames: [project], watch: true })
  const first = await call('plan')
  session.login = 'bob'
  accounts.set('bob', snapshot('bob'))
  await assert.rejects(call('sync', { viewer: 'alice', planVersion: first.planVersion }), { status: 409 })
  const bob = await call('refresh')
  assert.equal(bob.viewer, 'bob')
  assert.deepEqual(bob.watched, [])
  assert.deepEqual(bob.ops, [])
  assert.deepEqual((await call('plan')).plan, [])
  await assert.rejects(call('unstar', { viewer: 'alice', fullNames: [project] }), { status: 409 })
  assert.deepEqual(writes, [])
  session.login = 'alice'
  const reopened = openHost()
  assert.deepEqual((await reopened('state')).watched, [project])
  assert.equal((await reopened('plan')).planVersion, first.planVersion)
  await confirm(reopened)
  assert.deepEqual(writes, [{ login: 'alice', itemId: project, ids: [] }])
})

test('同步移出 B 后直接删除 A，远端和面板均变成未归类', async (t) => {
  const data = snapshot('alice')
  data.lists[1] = list('B', [project])
  const { call, writes } = await fixture(t, { data })
  await call('stage', { fullNames: [project], remove: ['B'] })
  const synced = await confirm(call)
  assert.equal(synced.lists.find((entry) => entry.id === 'B').count, 0)
  await call('deleteList', { listId: 'A' })
  const deleted = await waitJob(call)
  assert.deepEqual(writes.map((row) => row.ids), [['A'], []])
  assert.deepEqual(deleted.repos[0].desired, [])
})

test('开始写入后较早的刷新不能覆盖已同步归属', async (t) => {
  const { call, client, bindings } = await fixture(t)
  const started = Promise.withResolvers()
  const finish = Promise.withResolvers()
  bindings.mock.mockImplementationOnce(() => ({ ...client('alice'), async fetchAll() {
    started.resolve()
    return finish.promise
  } }))
  const refreshing = call('refresh')
  await started.promise
  await call('stage', { fullNames: [project], add: ['B'] })
  await confirm(call)
  finish.resolve(snapshot('alice'))
  assert.deepEqual((await refreshing).repos[0].desired, ['A', 'B'])
  await call('stage', { fullNames: [project], add: ['C'] })
  assert.deepEqual((await call('plan')).plan[0].to, ['A', 'B', 'C'])
})

test('删除预检已经占用作业位，预检失败会释放它', async (t) => {
  const { call, client, bindings } = await fixture(t)
  const started = Promise.withResolvers()
  const finish = Promise.withResolvers()
  bindings.mock.mockImplementationOnce(() => ({ ...client('alice'), async fetchLists() {
    started.resolve()
    return finish.promise
  } }))
  const removing = call('deleteList', { listId: 'A' })
  await started.promise
  await assert.rejects(call('unstar', { fullNames: [project] }), { code: 'busy' })
  await assert.rejects(call('sync'), { code: 'busy' })
  finish.reject(new Error('test read failure'))
  await assert.rejects(removing, /test read failure/)
  await call('stage', { fullNames: [project], add: ['B'] })
  await confirm(call)
})

test('同步重放本地相对旧快照的增删，保留网页的移入移出，重新确认前零写入', async (t) => {
  const { call, accounts, writes, openHost } = await fixture(t)
  await call('stage', { fullNames: [project], add: ['A', 'B'] })
  const before = await call('plan')
  const remote = accounts.get('alice')
  remote.lists = [list('A'), list('B'), list('C', [project])]
  await assert.rejects(call('sync', { planVersion: before.planVersion }), { status: 409, reason: 'remote-lists' })
  assert.deepEqual(writes, [])
  const reopened = openHost()
  const next = await reopened('plan')
  assert.deepEqual(next.plan[0].from, ['C'])
  assert.deepEqual(next.plan[0].to, ['C', 'B'])
  await confirm(reopened)
  assert.deepEqual(writes.map((row) => row.ids), [['C', 'B']])
})

test('网页已完成的归类自动清空暂存，远端读取不完整时保留暂存', async (t) => {
  const { call, accounts, writes } = await fixture(t)
  await call('stage', { fullNames: [project], add: ['B'] })
  const data = accounts.get('alice')
  data.listsComplete = false
  await assert.rejects(call('sync'), { code: 'unavailable' })
  assert.equal((await call('plan')).plan.length, 1)
  data.listsComplete = true
  data.lists[1] = list('B', [project])
  await assert.rejects(call('sync'), { reason: 'remote-lists' })
  assert.deepEqual((await call('plan')).plan, [])
  assert.deepEqual(writes, [])
})

test('同步前发现取消收藏会刷新并保留零远端写入', async (t) => {
  const { call, accounts, writes } = await fixture(t)
  await call('stage', { fullNames: [project], add: ['B'] })
  accounts.get('alice').repos = []
  await assert.rejects(call('sync'), { status: 409 })
  assert.deepEqual(writes, [])
  assert.equal((await call('plan')).plan.length, 0)
})

test('搬迁和移出孤儿时保留网页新增的其他归属，收尾时发现新成员会保留列表', async (t) => {
  const orphan = 'example/orphan'
  const data = snapshot('alice')
  data.lists[0] = list('A', [project, orphan])
  const { call, writes, client, bindings } = await fixture(t, { data })
  data.lists[2] = list('C', [project, orphan])
  await call('removeOrphan', { listId: 'A', fullName: orphan })
  assert.deepEqual(writes[0], { login: 'alice', itemId: orphan, ids: ['C'] })
  bindings.mock.mockImplementationOnce(() => ({ ...client('alice'), async fetchListMembers(id) {
    data.lists[0] = list(id, ['example/arrived'])
    return data.lists[0]
  } }))
  await call('deleteList', { listId: 'A', mode: 'move', targetListId: 'B' })
  const result = await waitJob(call, false)
  assert.equal(result.job.failed[0].code, 'conflict')
  assert.deepEqual(writes[1].ids, ['C', 'B'])
  assert.equal(data.lists[0].id, 'A')
})

test('仓库转移、原名被复用后，待写分类和跟踪只属于原仓库节点', async (t) => {
  const { call, accounts, writes } = await fixture(t)
  await call('stage', { fullNames: [project], add: ['B'] })
  await call('watch', { fullNames: [project], watch: true })
  const renamed = 'other/project'
  const data = accounts.get('alice')
  data.repos = [{ ...repo(renamed), id: project }, { ...repo(project), id: 'new-node' }]
  data.lists[0] = { ...list('A', [renamed]), itemIds: { [renamed]: project } }
  await assert.rejects(call('sync'), { status: 409 })
  assert.deepEqual(writes, [])
  assert.deepEqual((await call('state')).watched, [renamed])
  assert.deepEqual((await call('plan')).plan.map((row) => [row.itemId, row.nameWithOwner, row.to]),
    [[project, renamed, ['A', 'B']]])
})

test('已存视图跨重启、按账号隔离，重复名称和过期编辑均保留原视图', async (t) => {
  const { call, openHost, accounts, session } = await fixture(t)
  const filters = { tab: 'A', query: ' tool ', lang: 'TypeScript', chips: ['recent'], sort: { key: 'stars', dir: 'asc' }, suggestFilter: null }
  const payload = { viewer: 'alice', name: '常看的工具', filters }
  const { savedViews: [saved] } = await call('saveView', payload)
  assert.equal(saved.filters.query, 'tool')
  await assert.rejects(call('saveView', payload), /同名/)
  await assert.rejects(call('saveView', { ...payload, name: '错', filters: { ...filters, tab: 'missing' } }), /不存在/)
  const updated = await call('saveView', { ...payload, id: saved.id, revision: saved.revision, name: '工具' })
  await assert.rejects(call('deleteView', { viewer: 'alice', id: saved.id, revision: saved.revision }), { status: 409 })
  session.login = 'bob'
  accounts.set('bob', snapshot('bob'))
  assert.deepEqual((await call('refresh')).savedViews, [])
  await assert.rejects(call('saveView', payload), { status: 409 })
  session.login = 'alice'
  const reopened = openHost()
  assert.deepEqual((await reopened('state')).savedViews, updated.savedViews)
  assert.deepEqual((await reopened('deleteView', { viewer: 'alice', id: saved.id, revision: updated.savedViews[0].revision })).savedViews, [])
})

test('发布说明只按需读取当前账号、已收藏仓库和快照中的版本', async (t) => {
  const data = snapshot('alice')
  data.repos[0].latestRelease = { tagName: 'v1' }
  const { call, client, bindings, session } = await fixture(t, { data })
  const reads = []
  bindings.mock.mockImplementation((login) => ({ ...client(login), async fetchRelease(id, tag) {
    reads.push([login, id, tag])
    return { tagName: tag, description: 'version notes' }
  } }))
  const args = { viewer: 'alice', fullName: project, tag: 'v1' }
  await call('refresh')
  await assert.rejects(call('releaseNotes', { ...args, tag: 'v2' }), { status: 409 })
  await assert.rejects(call('releaseNotes', { ...args, fullName: 'example/other' }), { status: 409 })
  assert.deepEqual(reads, [])
  assert.equal((await call('releaseNotes', args)).description, 'version notes')
  session.login = 'bob'
  await assert.rejects(call('releaseNotes', args), { status: 409 })
  assert.deepEqual(reads, [['alice', project, 'v1']])
})

test('刷新清理已删除目标，取消跟踪后未读与更新列表同时归零', async (t) => {
  const { call, accounts } = await fixture(t)
  await call('stage', { fullNames: [project], add: ['B'] })
  await call('watch', { fullNames: [project], watch: true })
  const data = accounts.get('alice')
  data.lists = data.lists.filter((entry) => entry.id !== 'B')
  data.repos[0].latestRelease = { tagName: 'v2' }
  const updated = await call('refresh')
  assert.equal(updated.updatesUnread, 1)
  assert.match(updated.ops[0].text, /已撤销.*B/)
  assert.deepEqual((await call('plan')).plan, [])
  const quiet = await call('watch', { fullNames: [project], watch: false })
  assert.equal(quiet.updatesUnread, 0)
  assert.deepEqual(quiet.updates, [])
})

test('AI 坏批次和漏答保留原归属，重试只向模型发送指定仓库', async (t) => {
  const names = Array.from({ length: 61 }, (_, i) => 'example/r' + i)
  const outputs = ['{"groups":[', JSON.stringify({ groups: [{ list: 'B', repos: [names[60]] }] }),
    JSON.stringify({ groups: [], unsorted: [names[0]] })]
  const prompts = []
  const llm = {
    listProviders: () => [{ id: 'fixture' }], listModels: () => [{ id: 'test' }],
    prepareCall: () => ({ async *stream({ messages }) {
      prompts.push(messages[0].content[0].text)
      yield { type: 'text-delta', text: outputs.shift() }
    } }),
  }
  const { call } = await fixture(t, { data: snapshot('alice', names), llm })
  const first = await call('organize', { mode: 'rebuild', scope: 'all' })
  assert.deepEqual(first.failedBatches[0].repos, names.slice(0, 60))
  assert.deepEqual(first.unsorted, [])
  await call('organizeApply', first)
  assert.deepEqual((await call('plan')).plan.map((row) => row.nameWithOwner), [names[60]])
  const retry = await call('organize', { mode: 'rebuild', scope: 'all', fullNames: first.failedBatches[0].repos })
  assert.deepEqual(retry.failedBatches, [])
  assert.deepEqual(retry.unsorted, [names[0]])
  assert.equal(retry.unchanged.length, 59)
  assert.doesNotMatch(prompts[2], /example\/r60\|/)
  await call('organizeApply', retry)
  assert.deepEqual((await call('plan')).plan.map((row) => row.to), [[], ['B']])
})

test('实际子进程使用作业指定的 gh 账号，获取授权失败时终止请求', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stars-gh-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const ghPath = join(dir, 'gh')
  await writeFile(ghPath, `#!/usr/bin/env node
const args = process.argv.slice(2)
if (args[0] === 'auth') {
  if (args.join(' ') !== 'auth token --hostname github.com --user alice') process.exit(1)
  process.stdout.write('mock-account-alice')
} else {
  if (process.env.GH_TOKEN !== 'mock-account-alice') throw new Error('fixture account selection mismatch')
  if (!args.includes('github.com')) throw new Error('fixture hostname mismatch')
  process.stdin.resume()
  process.stdin.on('end', () => console.log(JSON.stringify({ data: { updateUserListsForItem: { lists: [{ id: 'A' }] } } })))
}
`, { mode: 0o700 })
  const github = new GitHub({ ghPath })
  assert.deepEqual((await github.forAccount('alice').setItemLists('item', ['A'])).lists, [{ id: 'A' }])
  await assert.rejects(github.forAccount('bob').setItemLists('item', []), /无法使用当前账号的 gh 授权/)
})

test('GitHub 读取分类及成员的后续页，拒绝残缺分页并按指定 tag 读取发布说明', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stars-gh-pages-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const ghPath = join(dir, 'gh')
  const replies = join(dir, 'replies.json')
  await writeFile(ghPath, `#!/usr/bin/env node
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { query, variables } = JSON.parse(readFileSync(0, 'utf8'))
const replies = JSON.parse(readFileSync(join(__dirname, 'replies.json')))
const reply = replies.find((r) => query.includes(r.field) && JSON.stringify(r.variables) === JSON.stringify(variables))
if (!reply) process.exit(1)
process.stdout.write(JSON.stringify({ data: reply.data }))
`, { mode: 0o700 })
  const gh = new GitHub({ ghPath })
  const pageInfo = (endCursor = null) => ({ endCursor, hasNextPage: Boolean(endCursor) })
  const items = (names, totalCount, cursor) => ({ totalCount, pageInfo: pageInfo(cursor), nodes: names.map(repo) })
  const listPage = (nodes, cursor) => ({ viewer: { login: 'alice', lists: { totalCount: 2, pageInfo: pageInfo(cursor), nodes } } })
  const first = { id: 'A', name: 'A', items: items(['a/one'], 2, 'members-next') }
  const responses = [
    { field: 'lists(first: 30, after:', variables: { cursor: null }, data: listPage([first], 'lists-next') },
    { field: 'items(first: 100, after:', variables: { id: 'A', cursor: 'members-next' }, data: { node: { items: items(['a/two'], 2) } } },
    { field: 'lists(first: 30, after:', variables: { cursor: 'lists-next' }, data: listPage([{ id: 'B', name: 'B', items: items([], 0) }]) },
    { field: 'release(tagName: $tag)', variables: { id: project, tag: 'v1' },
      data: { node: { release: { tagName: 'v1', description: 'x'.repeat(16001), url: 'https://example.test/v1' } } } },
  ]
  const ids = Array.from({ length: 101 }, (_, n) => 'id-' + n)
  for (const batch of [ids.slice(0, 100), ids.slice(100)]) {
    responses.push({ field: 'nodes(ids: $ids)', variables: { ids: batch },
      data: { nodes: batch.map((id) => ({ id, nameWithOwner: 'a/' + id, viewerHasStarred: id !== 'id-2' })) } })
  }
  await writeFile(replies, JSON.stringify(responses))
  const catalog = await gh.fetchLists()
  assert.equal(catalog.listsComplete, true)
  assert.deepEqual(catalog.lists.map((row) => row.repos), [['a/one', 'a/two'], []])
  const starred = await gh.fetchStarredItems(ids)
  assert.equal(starred.size, 100)
  assert.equal(starred.get('id-100'), 'a/id-100')
  const notes = await gh.fetchRelease(project, 'v1')
  assert.equal(notes.description.length, 16000)
  assert.equal(notes.truncated, true)
  first.items.totalCount = 3
  await writeFile(replies, JSON.stringify(responses))
  await assert.rejects(gh.fetchLists(), { code: 'unavailable' })
})
