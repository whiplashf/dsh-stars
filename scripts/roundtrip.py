#!/usr/bin/env python3
"""验证一次真实的 GitHub Lists 加入、移出和清理操作。

DSH_BASE、DSH_COOKIE（会话文件路径）、DSH_RT_REPO（已收藏的 owner/repo）指定测试目标。
使用自签名证书的宿主可以通过 DSH_CA_FILE 指定 CA 文件。
"""
import json
import os
import ssl
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def api(action, **fields):
    request = Request(
        os.environ['DSH_BASE'].rstrip('/') + '/api/dsh-stars',
        data=json.dumps({'action': action, **fields}).encode(),
        headers={'Cookie': Path(os.environ['DSH_COOKIE']).read_text().strip(), 'Content-Type': 'application/json'},
    )
    try:
        with urlopen(request, context=ssl.create_default_context(cafile=os.getenv('DSH_CA_FILE')), timeout=120) as response:
            result = json.load(response)
    except HTTPError as error:
        result = json.load(error)
    if not result.get('ok'):
        raise RuntimeError(result.get('message') or result.get('error'))
    return result['value']


def wait_job(response, viewer, kind):
    job = response['job']
    while job and job['running']:
        time.sleep(0.4)
        job = api('progress', viewer=viewer)['job']
    if not job or job['kind'] != kind or job['failed'] or job.get('error'):
        raise RuntimeError(f'作业未成功完成 {job}')
    return job


def sync_one(viewer, repo, before, after):
    preview = api('plan', viewer=viewer)
    plan = preview['plan']
    if len(plan) != 1 or plan[0]['nameWithOwner'] != repo or set(plan[0]['from']) != before or set(plan[0]['to']) != after:
        raise RuntimeError('暂存中出现了探针以外的改动，已停止同步')
    job = wait_job(api('sync', viewer=viewer, expectCount=1, planVersion=preview['planVersion']), viewer, 'sync')
    if job['applied'] != 1:
        raise RuntimeError('探针未写回')


def read_memberships(viewer, repo):
    state = api('refresh', viewer=viewer)
    if state.get('error') or state['viewer'] != viewer:
        raise RuntimeError('刷新账号或远端快照失败')
    return set(next(row['lists'] for row in state['repos'] if row['nameWithOwner'] == repo))


def main():
    repo = os.environ['DSH_RT_REPO']
    state = api('state')
    viewer = state['viewer']
    if not viewer or api('plan', viewer=viewer)['plan']:
        raise RuntimeError('验证需要已登录的账号和空的待同步队列')
    before = read_memberships(viewer, repo)
    name = 'dsh-stars-rt-' + uuid.uuid4().hex[:10]
    created = api('createList', viewer=viewer, name=name, description='dsh-stars 往返验证')
    list_id = created['createdListId']
    try:
        after = before | {list_id}
        api('stage', viewer=viewer, fullNames=[repo], add=[list_id])
        sync_one(viewer, repo, before, after)
        if read_memberships(viewer, repo) != after:
            raise RuntimeError('加入后的 GitHub 归属与预期不符')
        api('stage', viewer=viewer, fullNames=[repo], remove=[list_id])
        sync_one(viewer, repo, after, before)
        if read_memberships(viewer, repo) != before:
            raise RuntimeError('移出后的 GitHub 归属与原始归属不符')
    finally:
        result = wait_job(api('deleteList', viewer=viewer, listId=list_id, mode='unsorted'), viewer, 'deleteList')
        if not result['meta'].get('deleted'):
            raise RuntimeError(f'临时列表清理失败 {name}')
    print(f'通过 · {viewer} · {repo} · 已还原归属并删除临时列表 {name}')


if __name__ == '__main__':
    main()
