#!/usr/bin/env node
/**
 * 只读冒烟：真实调 gh 抓一次 star + Lists，打印统计、建议与变更。
 * 不写 GitHub，也不碰面板的正式状态文件（用临时文件）。
 *
 *   node scripts/smoke.mjs
 */
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { GitHub } from '../src/github.js'
import { Store } from '../src/store.js'
import { suggestAll } from '../src/classify.js'

const file = path.join(tmpdir(), `dsh-stars-smoke-${process.pid}.json`)
await rm(file, { force: true })
const gh = new GitHub({})
const store = new Store(file)

const fetched = await gh.fetchAll()
console.log('viewer', fetched.viewer, '· repos', fetched.repos.length, '· lists', fetched.lists.map((l) => `${l.name}:${l.repos.length}`).join(', '))

const first = store.applyFetch(fetched, { staleDays: 365 })
await store.save()
console.log('baseline changes', first.length, '(首次只建基线)')

const s = store.state
const sugg = suggestAll(Object.values(s.repos), undefined)
const unsorted = Object.values(s.repos).filter((r) => r.lists.length === 0).length
console.log('suggested', Object.keys(sugg).length, '· unsorted', unsorted)

for (const r of Object.values(s.repos).slice(0, 3)) {
  console.log(' -', r.nameWithOwner, r.stars, '★', r.latestRelease?.tagName ?? '-', '|', (r.topics ?? []).slice(0, 3).join(','), '| 建议', sugg[r.nameWithOwner]?.list ?? '-')
}

const second = store.applyFetch(await gh.fetchAll(), { staleDays: 365 })
console.log('second changes', second.length)
const view = store.view()
console.log('view', view.repos.length, 'repos ·', view.lists.map((l) => `${l.name}:${l.count}`).join(', '))
await rm(file, { force: true })
