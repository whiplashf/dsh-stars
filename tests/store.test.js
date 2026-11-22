/**
 * src/store.js 的单元测试：只用 node:test + node:assert/strict，不引入依赖。
 * 每个用例都使用独立的临时 state 文件，绝不读写仓库里的真实 state.json。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Store, desiredLists, STAR_DELTA_MIN } from '../src/store.js'

const PUSHED_AT = '2026-01-01T00:00:00.000Z'

function repo(nameWithOwner, overrides = {}) {
  return {
    id: `repo-${nameWithOwner}`,
    nameWithOwner,
    url: `https://github.com/${nameWithOwner}`,
    stars: 100,
    pushedAt: PUSHED_AT,
    ...overrides,
  }
}

/** 新建使用临时目录的 Store，测试结束自动清理。 */
async function makeStore(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-stars-store-'))
  t.after(async () => {
    await rm(dir, { recursive: true, force: true })
  })
  return new Store(join(dir, 'state.json'))
}

function seed(store, repos, lists = []) {
  // 首次 applyFetch 只建立基线（hadBaseline=false），不会产生 new 记录。
  const { ops, updates } = store.applyFetch({ repos, lists })
  return [...ops, ...updates]
}

function starsChanges(changes) {
  return changes.filter((change) => change.kind === 'stars')
}

test('desiredLists：current 减去 pending.remove 再加 pending.add，去重；pending 为空时等于 current', () => {
  assert.deepEqual(desiredLists({ lists: ['L1', 'L2'], pending: {} }), ['L1', 'L2'])
  assert.deepEqual(desiredLists({ lists: ['L1', 'L2'] }), ['L1', 'L2'])
  assert.deepEqual(
    desiredLists({ lists: ['L1', 'L2', 'L2'], pending: { add: ['L3', 'L2'], remove: ['L1'] } }),
    ['L2', 'L3'],
  )
  assert.deepEqual(desiredLists({ lists: [], pending: { add: ['L1', 'L1'], remove: ['L9'] } }), ['L1'])
  // 同一 id 既在 remove 又在 add：add 胜出。
  assert.deepEqual(desiredLists({ lists: ['L1'], pending: { add: ['L1'], remove: ['L1'] } }), ['L1'])
})

test('load：state 文件不存在时正常返回空白状态，不抛错', async (t) => {
  const store = await makeStore(t)
  const state = await store.load()
  assert.deepEqual(state.repos, {})
  assert.deepEqual(state.lists, [])
  assert.deepEqual(state.ops, [])
  assert.deepEqual(state.updates, [])
  assert.deepEqual(state.watched, {})
  assert.equal(state.snapshotAt, null)
  // 幂等：重复 load 返回同一状态对象。
  assert.equal(await store.load(), state)
})

test('stage：过滤 state.lists 中不存在的 id，staged 后 planSync 产出一条计划且 to 正确', async (t) => {
  const store = await makeStore(t)
  await seed(store, [repo('a/one')], [{ id: 'L1', name: 'Work', repos: ['a/one'] }])
  store.setList({ id: 'L2', name: 'Read' })

  const touched = store.stage(['a/one'], { add: ['L2', 'L-unknown'], remove: ['L-also-unknown'] })
  assert.equal(touched, 1)
  const staged = store.state.repos['a/one']
  assert.deepEqual(staged.pending.add, ['L2'])
  assert.deepEqual(staged.pending.remove, [])

  const plans = store.planSync()
  assert.equal(plans.length, 1)
  assert.deepEqual(plans[0], {
    nameWithOwner: 'a/one',
    itemId: 'repo-a/one',
    from: ['L1'],
    to: ['L1', 'L2'],
  })
})

test('planSync：pending 存在但 desired === lists 时是 noop，不产出计划并清空 pending', async (t) => {
  const store = await makeStore(t)
  await seed(store, [repo('a/one')], [{ id: 'L1', name: 'Work', repos: ['a/one'] }])
  store.state.repos['a/one'].pending = { add: ['L1'], remove: [] }

  assert.deepEqual(store.planSync(), [])
  assert.deepEqual(store.state.repos['a/one'].pending, { add: [], remove: [] })
})

test('markSynced：写入 lists、清空 pending，desiredLists 结果一致', async (t) => {
  const store = await makeStore(t)
  await seed(store, [repo('a/one')], [{ id: 'L1', name: 'Work', repos: ['a/one'] }])
  store.state.repos['a/one'].pending = { add: ['L2'], remove: ['L1'] }

  store.markSynced('a/one', ['L2', 'L1', 'L2'])
  const synced = store.state.repos['a/one']
  assert.deepEqual(synced.lists, ['L2', 'L1'])
  assert.deepEqual(synced.pending, { add: [], remove: [] })
  assert.deepEqual(desiredLists(synced), synced.lists)
  // 未知仓库不抛错、不改变状态。
  assert.doesNotThrow(() => store.markSynced('a/missing', ['L1']))
})

test('applyFetch：首次抓取不产生 new，第二次抓取新增一个仓库才产生一条 new', async (t) => {
  const store = await makeStore(t)
  const first = await seed(store, [repo('a/one'), repo('a/two')])
  assert.deepEqual(first, [])

  const second = store.applyFetch({ repos: [repo('a/one'), repo('a/two'), repo('a/three')], lists: [] })
  assert.equal(second.ops.length, 1)
  assert.equal(second.ops[0].kind, 'new')
  assert.equal(second.ops[0].nameWithOwner, 'a/three')
  assert.deepEqual(second.updates, [])
})

test('applyFetch：归属归零——第二次抓取 lists 中没有原 list（数量 < 30）时仓库 lists 变成 []', async (t) => {
  const store = await makeStore(t)
  await seed(store, [repo('a/x')], [{ id: 'L1', name: 'Work', repos: ['a/x'] }])
  assert.deepEqual(store.state.repos['a/x'].lists, ['L1'])

  const { ops } = store.applyFetch({
    repos: [repo('a/x')],
    lists: [{ id: 'L2', name: 'Other', repos: [] }],
  })
  assert.deepEqual(store.state.repos['a/x'].lists, [])
  assert.equal(ops.filter((entry) => entry.kind === 'new').length, 0)
})

test('applyFetch：一次抓到 0 个仓库后，再抓新仓库仍然算 new（baselineAt 落盘）', async (t) => {
  const store = await makeStore(t)
  seed(store, [repo('a/one')])
  const cleared = store.applyFetch({ repos: [], lists: [] })
  assert.deepEqual(cleared.ops.map((entry) => entry.kind), ['gone'])
  // 关键：中间这次空抓不应该把基线重置，否则下一批仓库会被当成「首次基线」吞掉 new。
  const next = store.applyFetch({ repos: [repo('a/two')], lists: [] })
  assert.deepEqual(next.ops.map((entry) => entry.kind), ['new'])
})

test('applyFetch：star 变化低于阈值（10 或 10%）不产生 stars，超过则产生且 delta 正确，同类变更只留一条', async (t) => {
  assert.equal(STAR_DELTA_MIN, 10)
  const store = await makeStore(t)
  await seed(store, [repo('a/star', { stars: 100 }), repo('a/pct', { stars: 200 })], [])
  // 远端更新只对跟踪的仓库记录。
  store.setWatched(['a/star', 'a/pct'], true)

  // a/star delta=5 < 10；a/pct delta=15 < 200 的 10%（20）：都静默。
  const quiet = store.applyFetch({
    repos: [repo('a/star', { stars: 105 }), repo('a/pct', { stars: 215 })],
    lists: [],
  })
  assert.deepEqual(starsChanges(quiet.updates), [])

  // a/star delta=25 >= 10；a/pct delta=30 >= 20：各产生一条，delta 正确。
  const loud = store.applyFetch({
    repos: [repo('a/star', { stars: 130 }), repo('a/pct', { stars: 245 })],
    lists: [],
  })
  const stars = starsChanges(loud.updates)
  assert.equal(stars.length, 2)
  assert.equal(stars.find((change) => change.nameWithOwner === 'a/star')?.delta, 25)
  assert.equal(stars.find((change) => change.nameWithOwner === 'a/pct')?.delta, 30)

  // 再抓一次（137/250，delta 7/5 低于阈值）：不新增，state 中每个仓库仍只有一条 stars。
  const again = store.applyFetch({
    repos: [repo('a/star', { stars: 137 }), repo('a/pct', { stars: 250 })],
    lists: [],
  })
  assert.deepEqual(starsChanges(again.updates), [])
  const kept = store.state.updates.filter((change) => change.kind === 'stars')
  assert.equal(kept.length, 2)
  assert.equal(kept.filter((change) => change.nameWithOwner === 'a/star').length, 1)
  assert.equal(kept.filter((change) => change.nameWithOwner === 'a/pct').length, 1)
})

test('applyFetch：没跟踪的仓库发新版本/新提交也不产生更新，跟踪后才开始记录', async (t) => {
  const store = await makeStore(t)
  await seed(store, [repo('a/followed'), repo('a/ignored')], [])

  const quiet = store.applyFetch({
    repos: [repo('a/followed', { latestRelease: { tagName: 'v1.0.0' } }), repo('a/ignored', { latestRelease: { tagName: 'v9.9.9' } })],
    lists: [],
  })
  assert.deepEqual(quiet.updates, [])
  assert.equal(store.view().updatesUnread, 0)

  store.setWatched(['a/followed'], true)
  const loud = store.applyFetch({
    repos: [repo('a/followed', { latestRelease: { tagName: 'v1.1.0' } }), repo('a/ignored', { latestRelease: { tagName: 'v10.0.0' } })],
    lists: [],
  })
  assert.deepEqual(loud.updates.map((entry) => entry.nameWithOwner), ['a/followed'])
  assert.equal(store.view().updatesUnread, 1)
  // 取消跟踪后不再累积。
  store.setWatched(['a/followed'], false)
  store.markViewed()
  const after = store.applyFetch({
    repos: [repo('a/followed', { latestRelease: { tagName: 'v1.2.0' } }), repo('a/ignored', { latestRelease: { tagName: 'v11.0.0' } })],
    lists: [],
  })
  assert.deepEqual(after.updates, [])
  assert.equal(store.view().updatesUnread, 0)
})

test('applyFetch：抓取结果中消失（取消 star）的仓库产生一条 gone 变更', async (t) => {
  const store = await makeStore(t)
  await seed(store, [repo('a/keep'), repo('a/gone')], [])

  const { ops } = store.applyFetch({ repos: [repo('a/keep')], lists: [] })
  assert.equal(ops.length, 1)
  assert.equal(ops[0].kind, 'gone')
  assert.equal(ops[0].nameWithOwner, 'a/gone')
  assert.ok(ops[0].text.includes('a/gone'))
  assert.equal(store.state.repos['a/gone'], undefined)
})

test('view：返回带 desired 的仓库、列表计数与未读数，markViewed 后未读清零', async (t) => {
  const store = await makeStore(t)
  await seed(
    store,
    [repo('a/one'), repo('a/two')],
    [{ id: 'L1', name: 'Work', repos: ['a/one', 'a/two'] }],
  )

  let view = store.view()
  assert.equal(view.lists.length, 1)
  assert.equal(view.lists[0].id, 'L1')
  assert.equal(view.lists[0].count, 2)
  assert.equal(view.lists[0].repos, undefined)
  assert.deepEqual(view.repos.map((item) => item.nameWithOwner), ['a/one', 'a/two'])
  assert.deepEqual(view.repos[0].desired, ['L1'])
  assert.equal(view.updatesUnread, 0)
  assert.deepEqual(view.watched, [])
  assert.equal(view.repos[0].watched, false)

  // 新出现的 star 属于「用户操作」，进操作记录，不算未读。
  store.applyFetch({
    repos: [repo('a/one'), repo('a/two'), repo('a/three')],
    lists: [{ id: 'L1', name: 'Work', repos: ['a/one', 'a/two'] }],
  })
  view = store.view()
  assert.equal(view.ops.length, 1)
  assert.equal(view.ops[0].kind, 'new')
  assert.equal(view.updatesUnread, 0)

  // 跟踪之后，远端更新才进未读。
  store.setWatched(['a/one'], true)
  store.applyFetch({
    repos: [repo('a/one', { latestRelease: { tagName: 'v2.0.0' } }), repo('a/two'), repo('a/three')],
    lists: [{ id: 'L1', name: 'Work', repos: ['a/one', 'a/two'] }],
  })
  view = store.view()
  assert.equal(view.updates.length, 1)
  assert.equal(view.updates[0].kind, 'release')
  assert.equal(view.updatesUnread, 1)
  assert.equal(view.repos[0].watched, true)

  store.markViewed()
  view = store.view()
  assert.equal(view.updatesUnread, 0)
  assert.ok(view.updatesViewedAt)
})

// ---- v0.2 数据模型：墓碑、结构操作、孤儿 ----

test('applyFetch：保留 list 的 itemIds，并给没有 itemIds 的旧数据补空对象', async (t) => {
  const store = await makeStore(t)
  await seed(store, [repo('a/one')], [{ id: 'L1', name: 'Work', repos: ['a/one'] }])
  assert.deepEqual(store.state.lists[0].itemIds, {})
  assert.equal(store.state.lists[0].count, 1)

  store.applyFetch({
    repos: [repo('a/one')],
    lists: [{ id: 'L1', name: 'Work', repos: ['a/one'], itemIds: { 'a/one': 'R_1' } }],
  })
  assert.deepEqual(store.state.lists[0].itemIds, { 'a/one': 'R_1' })
})

test('取消 star：markUnstarred 后的消失记成 unstarred，墓碑被消费掉', async (t) => {
  const store = await makeStore(t)
  await seed(store, [repo('a/one'), repo('a/two')], [])

  store.markUnstarred('a/one')
  assert.ok(store.state.unstarredAt['a/one'])
  const { ops } = store.applyFetch({ repos: [repo('a/two')], lists: [] })
  assert.equal(ops.length, 1)
  assert.equal(ops[0].kind, 'unstarred')
  assert.ok(ops[0].text.includes('已取消 star'))
  // 一次性语义：消费后删掉，避免下次误判。
  assert.equal(store.state.unstarredAt['a/one'], undefined)
})

test('取消 star：没有墓碑、或墓碑已过期时仍然记成 gone', async (t) => {
  const store = await makeStore(t)
  await seed(store, [repo('a/one'), repo('a/two')], [])

  // 过期墓碑（8 天前）
  store.markUnstarred('a/one')
  store.state.unstarredAt['a/one'] = new Date(Date.now() - 8 * 86_400_000).toISOString()
  const { ops } = store.applyFetch({ repos: [repo('a/two')], lists: [] })
  assert.equal(ops[0].kind, 'gone')
  assert.equal(store.state.unstarredAt['a/one'], undefined)
})

test('dropRepo：仓库从快照、顺序与所有分类成员里移除', async (t) => {
  const store = await makeStore(t)
  await seed(
    store,
    [repo('a/one'), repo('a/two')],
    [{ id: 'L1', name: 'Work', repos: ['a/one', 'a/two'], itemIds: { 'a/one': 'R_1', 'a/two': 'R_2' } }],
  )

  const dropped = store.dropRepo('a/one')
  assert.equal(dropped.nameWithOwner, 'a/one')
  assert.equal(store.state.repos['a/one'], undefined)
  assert.deepEqual(store.state.order, ['a/two'])
  assert.deepEqual(store.state.lists[0].repos, ['a/two'])
  assert.equal(store.state.lists[0].count, 1)
  assert.deepEqual(store.state.lists[0].itemIds, { 'a/two': 'R_2' })
  assert.equal(store.dropRepo('a/missing'), null)
})

test('removeList：分类消失后成员归属与指向它的暂存都被清掉', async (t) => {
  const store = await makeStore(t)
  await seed(
    store,
    [repo('a/one')],
    [{ id: 'L1', name: 'Work', repos: ['a/one'] }, { id: 'L2', name: 'Fun', repos: [] }],
  )
  store.stage(['a/one'], { add: ['L2'], remove: [] })
  assert.deepEqual(store.state.repos['a/one'].pending.add, ['L2'])

  assert.equal(store.removeList('L1'), true)
  assert.deepEqual(store.state.lists.map((list) => list.id), ['L2'])
  assert.deepEqual(store.state.repos['a/one'].lists, [])
  assert.equal(store.state.repos['a/one'].pending.add.includes('L1'), false)
  assert.equal(store.removeList('L1'), false)
})

test('applyListRemoval：变未归类与移入另一分类两种去向', async (t) => {
  const store = await makeStore(t)
  await seed(
    store,
    [repo('a/one'), repo('a/two')],
    [
      { id: 'L1', name: 'Old', repos: ['a/one', 'a/two'] },
      { id: 'L2', name: 'New', repos: [] },
    ],
  )

  store.applyListRemoval('a/one', 'L1')
  assert.deepEqual(store.state.lists[0].repos, ['a/two'])
  assert.deepEqual(store.state.repos['a/one'].lists, [])

  store.applyListRemoval('a/two', 'L1', 'L2')
  assert.deepEqual(store.state.lists[0].repos, [])
  assert.deepEqual(store.state.lists[1].repos, ['a/two'])
  assert.deepEqual(store.state.repos['a/two'].lists, ['L2'])
})

test('view：孤儿成员 = 分类成员里不在 star 快照里的仓库', async (t) => {
  const store = await makeStore(t)
  await seed(
    store,
    [repo('a/one')],
    [{ id: 'L1', name: 'Work', repos: ['a/one', 'a/orphan'] }, { id: 'L2', name: 'Empty', repos: [] }],
  )

  const view = store.view()
  // 只报有孤儿的分类：空分类不占位，客户端不用再过滤。
  assert.deepEqual(view.orphans, [{ id: 'L1', names: ['a/orphan'] }])
})
