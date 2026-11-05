import { motionPreviewUrl } from './motion-preview-route';
import { playtestUrl } from './playtest-scenes';
import './mouse-combat-playtest.css';

export function MouseCombatPlaytest({
  pathname,
  result = false,
}: {
  pathname: string;
  result?: boolean;
}) {
  return (
    <details className="mouse-combat-playtest" open={result || undefined}>
      <summary>烬灵鼠 · 实战动作对照</summary>
      <p>
        前排第1行第2列为1阶鼠，后排第4行第5列为2阶鼠。人工固定阵容和全盘解锁，仅检查动作，
        不代表正常经济路线。
      </p>
      <p>
        开始守卫后观察待机、蓄力、火球释放、受击与倒下占位。场景使用第1关敌群；
        如出现天赋选择，请选后继续。
      </p>
      <p>
        可用原有暂停与2倍速检查衔接；在显示设置中开启减少动态，可对照静止姿态。
        重置或离开会丢弃本次试玩进度，正式战役仍按原检查点恢复。
      </p>
      <nav aria-label="实战动作对照导航">
        <a href={playtestUrl('mouse-combat', false, pathname)!}>重置动作样板</a>
        <a href={motionPreviewUrl(pathname)}>素材逐帧预览</a>
        <a href={pathname}>返回正式战役</a>
      </nav>
    </details>
  );
}
