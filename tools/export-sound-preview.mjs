import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

// Explicit offline export only; no browser, game state or save access.
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('src/presentation/sound-palette.ts', root), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { soundPalette } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
const output = new URL('artifacts/combat-sound/', root);
const sampleRate = 44100;
const previews = [
  ['mouse_attack', '烬灵鼠 · 火弹'],
  ['boar_attack', '岩甲豚 · 重击'],
  ['eagle_attack', '青锋隼 · 剑鸣'],
  ['fish_attack', '霜尾鲤 · 冰音'],
  ['fox_shield', '月音狐 · 护盾'],
  ['monkey_attack', '穿林猿 · 气劲'],
  ['bear_attack', '磐拳熊 · 拳击'],
  ['attack', '敌方/旧记录 · 低音'],
  ['income', '桃产钱 · 原有音色'],
  ['warning', '横扫预警 · 原有音色'],
];

function sample(notes, time) {
  let value = 0;
  for (const note of notes) {
    const age = time - 0.1 - (note.delay ?? 0);
    if (age < 0 || age > note.duration + 0.015) continue;
    const glide = Math.log((note.end ?? note.frequency) / note.frequency);
    const phase =
      Math.abs(glide) < 1e-10
        ? 2 * Math.PI * note.frequency * age
        : (2 *
            Math.PI *
            note.frequency *
            note.duration *
            Math.expm1((glide * age) / note.duration)) /
          glide;
    let wave = Math.sin(phase);
    if (note.wave === 'triangle') wave = (2 / Math.PI) * Math.asin(wave);
    if (note.wave === 'sawtooth')
      wave = 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5));
    const peak = note.gain ?? 0.055;
    let envelope = 0.0001;
    if (age < 0.008) envelope = (peak * age) / 0.008;
    else if (age <= note.duration)
      envelope = peak * (0.0001 / peak) ** ((age - 0.008) / (note.duration - 0.008));
    value += wave * envelope;
  }
  return value;
}

function wav(samples) {
  const bytes = samples.length * 2;
  const file = Buffer.alloc(44 + bytes);
  file.write('RIFF', 0);
  file.writeUInt32LE(36 + bytes, 4);
  file.write('WAVEfmt ', 8);
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20);
  file.writeUInt16LE(1, 22);
  file.writeUInt32LE(sampleRate, 24);
  file.writeUInt32LE(sampleRate * 2, 28);
  file.writeUInt16LE(2, 32);
  file.writeUInt16LE(16, 34);
  file.write('data', 36);
  file.writeUInt32LE(bytes, 40);
  samples.forEach((value, i) =>
    file.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2),
  );
  return file;
}

await mkdir(output, { recursive: true });
const sequence = [];
for (const [cue] of previews) {
  const notes = soundPalette[cue];
  const length = Math.ceil(
    (0.25 + Math.max(...notes.map((n) => (n.delay ?? 0) + n.duration))) * sampleRate,
  );
  const samples = Float64Array.from({ length }, (_, index) => sample(notes, index / sampleRate));
  await writeFile(new URL(`${cue}.wav`, output), wav(samples));
  sequence.push(...samples, ...new Float64Array(sampleRate * 0.4));
}
await writeFile(new URL('all.wav', output), wav(sequence));
const rows = previews
  .map(
    ([cue, label]) =>
      `<article><h2>${label}</h2><audio controls preload="none" src="${cue}.wav"></audio><a href="${cue}.wav" download>下载 WAV</a></article>`,
  )
  .join('\n');
await writeFile(
  new URL('index.html', output),
  `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>灵林守阵 · 战斗音色试听</title>
<style>body{margin:0;background:#102c27;color:#eee3bd;font:16px/1.7 system-ui}main{max-width:800px;margin:auto;padding:24px}h1{font-size:25px}h2{font-size:17px;margin:0 0 12px}p{color:#bdd0bd}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:14px}article{background:#1a3e33;border:1px solid #566e50;border-radius:12px;padding:18px}audio{width:100%;display:block}a{color:#e3c77f;font-size:13px}small{display:block;color:#bdd0bd}</style>
<main><h1>灵林守阵 · 战斗音色试听</h1><p>七种技能音色，以及敌方低音、桃产钱与横扫提示。与游戏共用音色参数，按下播放后试听。</p>
<p>这是离线近似合成，保留原始相对声量；浏览器波形、设备和同时播放的音乐会影响实际听感。此页不运行游戏、不访问存档。</p>
<article><h2>全部依次试听</h2><audio controls preload="none" src="all.wav"></audio><small>顺序与下方列表一致，各段间隔0.4秒。</small><a href="all.wav" download>下载全部试听 WAV</a></article>
<h2 style="margin-top:24px">单项试听</h2><section>${rows}</section></main></html>`,
);
console.log(`已生成${previews.length}种单项音色、合辑和独立试听页：${fileURLToPath(output)}`);
