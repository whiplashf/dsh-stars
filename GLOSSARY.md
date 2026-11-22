# 术语表

dsh-stars 的领域词汇。只收录有歧义风险、或与直觉不同义的词；实现细节不写在这里（见 `docs/DETAIL.md`、`docs/DESIGN-v0.2.md`）。

## 分类 / List

GitHub 的 `UserList`。**分类的唯一真源在 GitHub**，本地 state 只是缓存。同义词：list、分组、标签。UI 中文用「列表」。

注意：分类成员不要求是 star；GitHub 允许把没 star 的仓库放进分类（因此有「孤儿成员」）。

## 归属

一个仓库属于哪些分类。是集合，不是单个值。写回是**替换语义**：把仓库的整个归属集合一次写掉，所以算错一次会清空用户手工整理的结果。

## 暂存（pending）

用户在面板上做的、还没写回 GitHub 的**仓库级归属变更**。每个仓库有 `pending.add` / `pending.remove` 两个列表。

暂存不等于已生效：面板显示的是「期望归属」（`desired` = 当前归属 ± 暂存），GitHub 上还没变。

## 同步（sync）

把暂存写回 GitHub 的动作。一次同步 = 一个作业，逐条 `updateUserListsForItem`，每条成功后落盘。

## 作业（job）

一次正在跟 GitHub 对话的批量执行：取消 star、删除分类、同步。有 `kind`、进度、失败清单。**同一时刻只允许一个作业运行。**

## 结构操作

改变分类本身（删除分类）或改变仓库存在性（取消 star）的操作。它们不属于「仓库归属」，所以**不进暂存**，确认后直接作为作业执行。理由见 `docs/adr/0001-structural-ops-bypass-pending.md`。

## 孤儿成员

挂在某个分类里、但已经不在 star 列表里的仓库。GitHub 允许这种状态；面板无法从 star 侧看到它们，只能从分类成员侧比对出来。

## 变更记录（change）

快照之间的差异条目：新收藏、新版本、有新提交、已归档、star 数显著变化、消失。`kind` 决定文案。

## gone / unstarred

两种「仓库从 star 列表里消失」的原因。`gone` = 仓库被删、转私有或被别人取消；`unstarred` = 用户在面板里自己取消的 star。二者文案不同，判断依据是本地 `unstarredAt` 墓碑。

## 未归类

`desired` 归属集合为空的仓库。不是一种分类，所以没有对应的 GitHub 对象。

## 快照（snapshot）

一次从 GitHub 抓取全量 star + 分类的结果。快照之间做 diff 得到变更记录。`baselineAt` 标记「曾经建立过基线」，用于区分首次抓取。

## 星标去噪

star 数变化小于「10 个 或 10%」不记变更。理由是 star 数每天小幅波动，会淹没真正的代码变更。
