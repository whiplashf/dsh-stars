import { randomUUID } from 'node:crypto'
import { GitHubError } from './github.js'

const chips = new Set(['newRelease', 'recent', 'unsorted', 'archived'])
const sortFields = new Set(['starred', 'pushedAt', 'stars', 'name'])

function existingView(state, { id, revision }) {
  const view = state.savedViews.find((entry) => entry.id === id)
  if (!view || revision !== view.revision) {
    throw new GitHubError('conflict', '这个视图已在其他页面更改，请重新打开视图')
  }
  return view
}

export function saveView(state, payload) {
  const previous = payload.id == null ? null : existingView(state, payload)
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!name || name.length > 60) throw new GitHubError('invalid', '请输入 1–60 个字符的视图名称')
  if (state.savedViews.some((view) => view.id !== previous?.id && view.name.toLowerCase() === name.toLowerCase())) {
    throw new GitHubError('invalid', '已有同名视图，请换一个名称')
  }
  const f = payload.filters
  if (!f || typeof f.query !== 'string' || typeof f.lang !== 'string' || !f.lang ||
      !Array.isArray(f.chips) || !f.chips.every((chip) => chips.has(chip)) ||
      !sortFields.has(f.sort?.key) || !['asc', 'desc'].includes(f.sort.dir) ||
      (f.suggestFilter != null && typeof f.suggestFilter !== 'string')) {
    throw new GitHubError('invalid', '视图的筛选或排序条件无效')
  }
  const knownTab = ['all', 'unsorted', previous?.filters.tab].includes(f.tab) || state.lists.some((list) => list.id === f.tab)
  if (typeof f.tab !== 'string' || !knownTab) {
    throw new GitHubError('invalid', '视图所属的列表已不存在')
  }
  const view = {
    id: previous?.id ?? randomUUID(), revision: (previous?.revision ?? 0) + 1, name,
    filters: {
      tab: f.tab, query: f.query.trim(), lang: f.lang, chips: [...new Set(f.chips)].sort(),
      sort: { key: f.sort.key, dir: f.sort.dir }, suggestFilter: f.suggestFilter || null,
    },
  }
  if (previous) state.savedViews[state.savedViews.indexOf(previous)] = view
  else state.savedViews.push(view)
  return view.id
}

export function deleteView(state, payload) {
  const view = existingView(state, payload)
  state.savedViews.splice(state.savedViews.indexOf(view), 1)
}
