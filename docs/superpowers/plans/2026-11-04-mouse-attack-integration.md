# 烬灵鼠攻击帧接入 Implementation Plan

> 延续用户授权，由当前会话顺序实施、自审和验收，不派代理，不提交或推送，保留上一轮工作区。

**Goal:** 将用户提供并已切分的六帧攻击图接入烬灵鼠，出手帧与真实释放同步。

**Architecture:** MouseAttackFrames只读观察Combat中的攻击准备和新鼠攻击Flash，按游戏时间返回0–5帧；CombatFeedback组合该实例状态。独立动作素材描述及Phaser spritesheet预加载，ArtLayer复用现有图片池并重置帧/原点；缺图回退旧静态绘制。血条、占位及战斗数据不动。

**Tech Stack:** TypeScript、Phaser3、Vitest、Pillow、Chrome/CUA。

**Spec:** docs/superpowers/specs/2026-11-04-character-animation-design.md；本次切片仅实现已收到的攻击六帧，其余动作等待素材。

## Global Constraints

保持v24/schema2、规则、数值、攻击前摇和冷却、RNG、3格接敌、正式战役档、现有静态原图与转换清单、依赖和npm命令。无API生图。新文件和上一轮改动留工作区。

## Review Focus

1. 攻击取消/目标先死不能凭前摇到期播放已释放帧。
2. 暂停、选天赋、失焦和2倍速使用真实游戏时间，读图不驱动模拟。
3. 同名不同实例及id0隔离；旧Flash不重播，回滚/重试清空状态。
4. 动作帧和普通图片共用池时原点与纹理帧必须重置；失图不抛错或阻止开战。
5. 尺寸用统一参考包围盒，不能将1536宽整条或256画布直接当角色大小；减少动态固定第1帧。

## Task 1：动作时序

**Files:** 新增src/presentation/mouse-attack-frames.ts及.test.ts，修改combat-feedback.ts。

**Interfaces:** MouseAttackFrames.update(battle:Combat|null):void；frame(id:number,reducedMotion=false):number；CombatFeedback.mouseFrame(id,reducedMotion):number。

- [x] 写真实Session/Combat测试：准备0/1/2→释放3→收势4/5→0、连续新攻击、取消、死亡、id0/多鼠、暂停/天赋冻结、倍速、旧Flash初始化、回滚与完整Session/RNG只读。
- [x] 实现按攻击ordinal识别准备，按真实鼠Flash识别释放，收势每帧70ms；无释放不进入3–5。
- [x] 将update接在Feedback里，prepare传null；不新增React state/effect。

```ts
frames.update(session.battle);
expect(frames.frame(mouse.id)).toBe(3); // only after a real mouse release Flash
```

## Task 2：素材与图片池

**Files:** 新增src/render/character-art.ts、发布public/assets/animations/ember_mouse/attack.webp；修改ArtLayer.ts、ArtLayer.test.ts、Battlefield.tsx、tools/prepare-mouse-attack.py。

- [x] 根据现有prepared/attack.webp发布同字节精灵条，并让处理脚本同时更新独立运行资源，不触及静态art-manifest。
- [x] 配置6个256×256帧、参考第1帧固定包围盒及原点；ArtLayer.draw追加可选frame参数，普通图恢复frame/origin。
- [x] 扩充图片池测试：动画→静态复用、失图回退、显示尺寸/原点。更新预加载总数和失败计数，允许缺图开战。
- [x] Battlefield对鼠优先画帧，成功时关闭旧整体前倾；失败走原静态图；血条和占格照旧。

## Task 3：验证与交付

- [x] 定向动作/Feedback/ArtLayer测试、typecheck、全量test、build及CHECK_STARTUP_BUILD=1。
- [x] 自审并格式检查改动代码，git diff --check；文档记录第一批仅攻击。
- [ ] 独立首战/八灵场景浏览器验收：CUA返回浏览器访问服务不可用，未打开标签或改视口，未操作正式档。代码和资源验证已完成，目视验收待连接恢复。
- [x] 更新README及docs/reviews/2026-11-04-mouse-attack-integration.md，勾选本计划。

```powershell
npx.cmd vitest run src/presentation/mouse-attack-frames.test.ts src/presentation/combat-feedback.test.ts src/render/ArtLayer.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```
