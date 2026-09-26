# 第六代隔离资料试同步

2026-09-26 在提交 `0d6f48a` 后运行隔离准备命令，状态目录为仓库忽略路径 `output/factory-gen6-trial-20260926`，没有读写共享 `var`，没有激活版本，也没有运行游戏。命令限定第六代、1200 键、200 MiB、5 分钟、4 worker：

```text
go run ./backend/cmd/sync -factory-generation=6 -state output/factory-gen6-trial-20260926 -version gen6-trial-20260926 -max-entries=1200 -max-bytes=209715200 -max-duration=5m -workers=4
```

进度在约 1 分 52 秒达到 746/746 键、25,476,461 字节；类型计数为 pokemon 79、pokemon-species 72、ability 72、move 523。发现集合没有超过设定键数，单阶段下载也没有超过字节或时间限制。**命令最终退出码为 1**：暂存版本目录改名为正式版本目录时 Windows 返回 `Access is denied`。因此没有发布 manifest 或可用的固定 VERSION，更不能将 746/746 视为同步成功。失败清理删除了暂存对象，未改变任何活动指针。

同一父目录随后做一个小目录的普通改名探针成功，仅证明该目录通常允许改名，不能证明 746 对象的失败原因。正在核查是否为 Windows 文件占用、扫描或发布过程的其他问题；修复前不重跑九代大同步，不恢复可能覆盖既有版本的拷贝回退。第六代图像背面原素材覆盖与游戏实际画面仍需另验。
