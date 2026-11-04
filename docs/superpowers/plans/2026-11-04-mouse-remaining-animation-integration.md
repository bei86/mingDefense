# 烬灵鼠待机、受击与重伤动作接入计划

**Goal:** 整理用户提供的三张原图，补齐已批准的烬灵鼠动作样板。

**Architecture:** 继续复用独立动作选帧、CombatFeedback表现时钟、ArtLayer图片池。原图与规范化帧图分开保存，动作不驱动模拟。当前原图已暂存，重命名时保留其内容与暂存状态，不提交其他工作。

**Tech Stack:** Pillow、TypeScript、Phaser、Vitest。

**Spec:** docs/superpowers/specs/2026-11-04-character-animation-design.md。用户按已有提示词提供待机4帧、受击3帧、重伤5帧，本次延续同一方案并在当前会话实施。

## 约束与关注点

- 不改规则、攻击时间、伤害、3格接敌、RNG及存档；不自动提交或推送。
- 同动作共用缩放，固定256画布、脚底参考点与绘制原点；重伤自然降低，禁止逐帧拉满。
- 重伤图不是严格五等分，使用主体之间的透明间隔切分，避免切到相邻尾焰。
- 受击包含护盾吸收；重复受击重新开始但不积压。攻击事件独立读取，受击不能伪造或延迟攻击。
- 暂停、待选天赋、失焦冻结，倍速跟随既有表现时钟；减少动态活体取首帧、重伤取末帧。
- 初次读入已倒下单位直接保持末帧；返回整备和新战斗清除旧动作。缺某个动作只回退该动作，不影响其他角色。

## Task 1: 素材规范化

Files: tools/prepare-mouse-motions.py、docs/img/animations/ember_mouse/{idle,hurt,fallen}-sheet-raw.png、prepared/*.webp、public/assets/animations/ember_mouse/*.webp。

- [x] 验证附件与已暂存原图哈希一致，git mv为对应原图名称。
- [x] 使用每组统一缩放及共享落点，输出256像素帧条与忽略目录artifacts/mouse-motions下的逐帧图、接触表、循环预览和JSON处理报告。
- [x] 检查透明通道、主体未截断、各动作起始比例与攻击首帧衔接；原图哈希不变。

## Task 2: 动作仲裁与绘制

Files: src/presentation/mouse-motion.ts、mouse-motion.test.ts、mouse-attack-frames.ts、combat-feedback.ts；src/render/character-art.ts、ArtLayer.ts、ArtLayer.test.ts、Battlefield.tsx。

Interfaces: MouseAttackFrames新增active(id): boolean。selectMouseMotion({time,dead,hitAt,deadAt,attacking,attackFrame,reducedMotion})返回{action,frame}；CombatFeedback.mouseMotion(id,reducedMotion)负责组装已有actor状态，整备活体允许待机。

- [x] 先写仲裁、循环、冻结、只读测试，确认新增接口尚不存在时失败；追加缺图回退测试。
- [x] 实现重伤>受击>攻击>待机，重伤5帧各80ms后保持、受击3帧各60ms、待机4帧各200ms。沿用既有鼠攻击真实事件选帧。
- [x] 为四组动作统一清单、原点与图片池缩放；逐组预载，增加加载计数；缺动作尝试攻击基准，最终回退原静态图。
- [x] 执行定向Vitest、typecheck、全量测试、生产构建和启动边界；按simplify检查状态职责与重复代码。

## Task 3: 预览及文档

Files: README.md、现有动作提示词/方案、docs/reviews/2026-11-04-mouse-motions-integration.md。

- [x] 用game-playtest流程尝试连接独立八灵场景，浏览器访问服务不可用，记录具体阻塞；不能用Pillow预览替代游戏截图。
- [ ] 浏览器恢复后检查待机、攻击、受击、重伤、暂停和减少动态，截图复核手机尺寸下的衔接和原点。
- [x] 清单改为已收到素材并记录接入状态、命名、哈希、测试及仍待确认的品质问题；保留前一轮未提交的提示词资料。
- [x] git diff --check，检查工作区只包含预期范围。
