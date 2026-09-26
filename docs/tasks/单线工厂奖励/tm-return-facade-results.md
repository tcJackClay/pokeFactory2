# TM01 与 TM03 静态验收结果

Rogue expansion 固定提交 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014` 的 `battle_moves.h:3885` 定义 TM01 Return 为物理一般招式、20 PP、`EFFECT_RETURN`；`battle_util.c:9040` 将威力按 `10 × 使用者亲密度 / 25` 计算。项目从物种资料 `base_happiness` 为普通租借和参考 set 租借赋初始亲密度，缺值回退 70，存档归一保留 0–255，换人清理不抹除。PokeAPI 本机缓存 `move/return` 原正文 SHA256 为 `c686da79f52e706b548108739551719ee7fef1ca97ea2f0fb68e7076996f6287`，字段快照经正式转换后为 `FRIENDSHIP_POWER`。固定随机数的结果断言覆盖 0、70、255 点伤害严格递增、零亲密度仍有合法最小伤害、越界夹取、换人后相同伤害及 READY 检查点保存恢复。项目当前没有战内亲密度增长机制；Return 对单个租借成员的威力因此以物种基础值为准。

Rogue `battle_moves.h:4708` 定义 TM03 Facade 为物理一般招式、70 威力、20 PP、`EFFECT_FACADE`；`battle_util.c:9290` 只在烧伤、中毒或麻痹等指定状态翻倍，`battle_util.c:10137` 对 Facade 豁免普通物攻烧伤减半。PokeAPI 本机缓存 `move/facade` 原正文 SHA256 为 `8428ee2b4b475359803b2402399761ff6583ab1b301ecdff58e5b94b9cb7b054`，项目转换得到 `FACADE`。原实现对**任意**主要异常翻倍，睡眠和冰冻也被错误增强。本切片把条件收窄为烧伤、中毒、剧毒和麻痹。结果测试确认这四类伤害高于健康状态，烧伤 Facade 与中毒 Facade 等伤害，普通物攻仍受烧伤减半，睡眠和冰冻不增强。Rogue 源另列 Frostbite，但项目目前没有该主要异常 ID，未在本轮引入新状态。

两招所用字段快照从本机缓存正文提取前逐项核对缓存元数据 SHA256；提交的快照仅包含转换所需字段及原正文摘要。聚焦测试 27 项、全套 185 项、`npm run lint` 和 `npm run build` 通过。一次全套运行中，现有钱包测试比较两个相差 1 毫秒的 `updatedAt` 而失败；再次全套运行 185/185 通过。首次紧随该失败的构建进程也异常退出，单独重跑构建通过；两次异常未归因于本切片，交审时仍需留意。两招仍不进入奖励可发池；固定 `VERSION` 正文、PP/日志完整回合和手机实战仍须按总验收矩阵复核。
