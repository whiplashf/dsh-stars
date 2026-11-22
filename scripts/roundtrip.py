#!/usr/bin/env python3
"""真实写回往返验证（会真的改 GitHub Lists，再删掉临时列表）。

前置：插件已安装、面板可用、gh token 带 user scope。
用法：
  DSH_BASE=https://192.168.31.212:3080 DSH_COOKIE=cookie.txt python3 scripts/roundtrip.py

cookie 从静态 token 换：GET $DSH_BASE/?token=$DSH_WEB_STATIC_TOKEN
（token 在 ~/.dsh/web-token.env），返回 303 的 set-cookie 即登录态。
"""
import json
import os
import subprocess
import sys
import time

BASE = os.environ.get('DSH_BASE', 'https://192.168.31.212:3080')
COOKIE_FILE = os.environ.get('DSH_COOKIE', '/home/massiwei/tmp/cookie.txt')
REPO = os.environ.get('DSH_RT_REPO', 'backnotprop/plannotator')
LIST = 'dsh-stars 同步测试'


def api(payload):
    cookie = open(COOKIE_FILE).read().strip()
    out = subprocess.run(
        ['curl', '-s', '-k', '-X', 'POST', f'{BASE}/api/dsh-stars', '-H', f'Cookie: {cookie}',
         '-H', 'content-type: application/json', '-d', json.dumps(payload)],
        capture_output=True, text=True,
    ).stdout
    return json.loads(out)


def sync_and_wait():
    """sync 只启动后台任务；轮询 progress 直到 running=false，返回最终 job。"""
    started = api({'action': 'sync'})
    if not started.get('ok'):
        sys.exit(f"sync 失败：{started}")
    job = started['value'].get('syncJob')
    while job and job.get('running'):
        time.sleep(0.4)
        job = api({'action': 'progress'})['value'].get('syncJob')
    return job or {}


def gh(query, variables=None):
    out = subprocess.run(
        ['gh', 'api', 'graphql', '--input', '-'],
        input=json.dumps({'query': query, 'variables': variables or {}}),
        capture_output=True, text=True,
    ).stdout
    return json.loads(out)


def repo_row(state):
    for repo in state['value']['repos']:
        if repo['nameWithOwner'] == REPO:
            return {'lists': repo['lists'], 'pending': repo['pending'], 'desired': repo['desired']}
    return None


def main():
    state = api({'action': 'refresh'})
    if not state.get('ok'):
        sys.exit(f"state 失败：{state}")
    names = {item['id']: item['name'] for item in state['value']['lists']}
    existing = [item for item in state['value']['lists'] if item['name'] == LIST]
    if existing:
        list_id = existing[0]['id']
    else:
        created = api({'action': 'createList', 'name': LIST, 'description': '临时，验证后删除'})
        if not created.get('ok'):
            sys.exit(f"createList 失败：{created}")
        list_id = [item['id'] for item in created['value']['lists'] if item['name'] == LIST][0]
    print('临时列表', list_id)

    api({'action': 'stage', 'fullNames': [REPO], 'add': [list_id]})
    job = sync_and_wait()
    print('加入 → applied', job.get('applied'), 'failed', job.get('failed'))
    print('本地', repo_row(api({'action': 'state'})))

    node = gh('query($id:ID!){node(id:$id){... on UserList{items(first:10){totalCount nodes{... on Repository{nameWithOwner}}}}}}', {'id': list_id})
    print('GitHub', json.dumps(node.get('data', {}).get('node'), ensure_ascii=False))

    api({'action': 'stage', 'fullNames': [REPO], 'add': [], 'remove': [list_id]})
    job = sync_and_wait()
    print('移出 → applied', job.get('applied'))

    node = gh('query($id:ID!){node(id:$id){... on UserList{items(first:10){totalCount}}}}', {'id': list_id})
    print('GitHub 剩余', json.dumps(node.get('data', {}).get('node'), ensure_ascii=False))

    print('删除列表', json.dumps(gh('mutation($id:ID!){deleteUserList(input:{listId:$id}){clientMutationId}}', {'id': list_id}), ensure_ascii=False))
    print('当前列表', [item['name'] for item in api({'action': 'refresh'})['value']['lists']])
    print('仓库归属', repo_row(api({'action': 'state'})))


if __name__ == '__main__':
    main()
