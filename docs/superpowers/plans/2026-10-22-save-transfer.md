# 存档备份与恢复实施计划

**Goal:** 为50关本地战役提供可预览、可取消、可恢复的手动跨浏览器备份。
**Architecture:** persistence共用版本兼容解析，save-transfer负责纯文本协议与存储事务，SaveManager负责交互；App外层重挂载Session，避免旧保存监听覆盖新档。
**Tech Stack:** 现有TypeScript、React、Phaser、Vite、Vitest，无新增依赖。
**Spec:** ../specs/2026-10-22-save-transfer-design.md

按用户已授权范围原生执行，不委派代理，不额外自动提交。保持v24、schema2及所有战斗和经济规则。

## Task 1：备份协议与事务

- [x] persistence.ts抽出compatibleSave(value: unknown): SessionSave | null，loadSession复用相同版本名单及既有失败处理。
- [x] 新建src/game/save-transfer.ts：MAX_BACKUP_BYTES=1048576、createBackup、inspectBackup、replaceSavedProgress、readPreviousBackup；备份版本1，校验无存储操作。
- [x] 新建save-transfer.test.ts，覆盖当前与旧版45、完成/待选/战斗回滚、损坏/超限、非法结构、所有读写失败、替换前备份与恢复。运行定向测试和原persistence回归。

## Task 2：玩家入口与会话替换

- [x] LoadResult可选isolated标记，五组DEV入口均true；blocked存储失败仍可导出，DEV不允许读写或导出。
- [x] 新建src/ui/SaveManager.tsx与save-manager.css：生成、复制/手动复制、下载、文件/粘贴、校验预览、确认/取消和读取替换前备份；状态清楚区分“已生成”和“已下载”。
- [x] App拆为外层Session宿主与GameApp，成功后替换并重挂载，旧循环及pagehide保存卸载。接整备、暂停、结果入口及统一焦点锁，关闭不恢复战斗。
- [x] 文件异步读取使用序号，旧读取不可覆盖新文本；文件超限不读取。新增DOM轻量校验与已有DEV禁写测试。

## Task 3：交付验收

- [x] 完整测试、build、Prettier及diff检查；simplify复核新增代码，确认未修改规则配置或旧fixture。
- [x] game-playtest：独立端口正式档，实际导出、损坏/有效校验、取消/确认/刷新/恢复；DEV禁用、暂停保持，320/390宽截图和日志。
- [x] README补备份用法与局限，docs/reviews记录实际证据、测试数量、失败边界及真机限制。
