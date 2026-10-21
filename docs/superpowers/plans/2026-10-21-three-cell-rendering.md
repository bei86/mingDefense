# 三格与清晰度修正 Implementation Plan

**Goal:** 执行用户从5格改为3格的修正，恢复角色可读性并提高画布采样密度。

**Spec:** docs/superpowers/specs/2026-10-21-three-cell-rendering-design.md

**Architecture:** 仿真只改出生行；内部画布按设备像素密度放大，相机同步缩放保持世界坐标和DOM格子匹配。已有5格设计/验收保留为历史。

- [x] 更新 approach-distance.test.ts：3格实际出生，近战/首领先走、远程开场前摇、冻结减速；先运行确认旧5格实现失败。
- [x] 配置v17/spawnRow=-3，persistence白名单与备份/写失败测试加入v16，16个开发检查点只迁移版本字段。
- [x] Battlefield.tsx：.9镜头中心(180,150)，按容器宽×DPR计算1–3倍canvas尺寸，相机同步乘密度，resize与清理完整；路径高度从配置计算。
- [x] 更新开发文案；导出当前72路线，固定新结果并验证守恒，历史1格断言保留。
- [x] 浏览器320/390及桌面检查清晰度、入口/底排、尺寸切换与暂停返回；保存截图。
- [x] 运行完整测试（maxWorkers=2）、构建、源码/文档格式与diff检查；simplify自审并更新README/验收记录，不自动提交。
