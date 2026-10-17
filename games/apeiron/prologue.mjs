import { FACE_NAMES, getReflectedFaces } from './dice.mjs';

const DOTS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]] };
// unflip=true：镜中骰子整体水平翻转，问号再翻一次以保持可读
const pips = (v, unflip = false) => v ? DOTS[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"/>`).join('') : `<text x="50" y="64" text-anchor="middle" font-size="40" fill="currentColor" opacity=".5"${unflip ? ' transform="translate(100 0) scale(-1 1)"' : ''}>?</text>`;
const faceIcon = v => `<svg class="pip-icon" viewBox="0 0 100 100" aria-hidden="true"><rect x="6" y="6" width="88" height="88" rx="14"/>${pips(v)}</svg>`;

function cube(s, mirror) {
  const known = getReflectedFaces(s);
  const val = f => mirror ? (s.faces?.[f]?.value ?? (known.includes(f) ? s.orientation[f] : null)) : s.orientation[f];
  const frames = { top: 'matrix(1 .55 -1 .55 180 35)', front: 'matrix(1 .55 0 1.1 80 90)', right: 'matrix(1 -.55 0 1.1 180 145)' };
  const label = ['front', 'right', 'top'].map(f => FACE_NAMES[f] + (val(f) ?? '未定')).join('，');
  return `<svg class="cube ${mirror ? 'is-mirror' : ''}" viewBox="0 0 360 300" role="img" aria-label="${mirror ? '镜中' : '镜外'}骰子：${label}">
    <ellipse cx="180" cy="276" rx="96" ry="12" class="cube-shadow"/>
    ${Object.entries(frames).map(([f, t]) => `<g class="face ${mirror && !known.includes(f) ? 'unknown' : ''}" transform="${t}"><rect width="100" height="100" rx="3"/><g class="dots">${pips(val(f), mirror)}</g></g>`).join('')}
  </svg>`;
}

export function renderPrologue(s) {
  const { phase } = s;
  const formed = phase === 'complete';
  const known = getReflectedFaces(s);
  const badReflection = known.some(f => s.orientation[f] !== 6);

  let controls = '';
  if (phase === 'outside') {
    controls = `<div class="controls">
      <div class="ctrl-group"><span class="ctrl-label">转动骰子</span>
        <div class="seg">${[['left', '←'], ['right', '→'], ['up', '↑'], ['down', '↓']].map(([d, a]) => `<button class="seg-btn" data-action="dice-rotate" data-id="${d}" aria-label="${{ left: '向左转', right: '向右转', up: '向上翻', down: '向下翻' }[d]}">${a}</button>`).join('')}</div></div>
      <div class="ctrl-group"><span class="ctrl-label">镜面映出</span>
        <div class="seg">${[1, 2, 3].map(n => `<button class="seg-btn ${s.exposure === n ? 'on' : ''}" data-action="dice-angle" data-id="${n}" aria-pressed="${s.exposure === n}">${n} 面</button>`).join('')}</div></div>
      <button class="btn primary" data-action="dice-enter">进入镜中</button>
    </div>`;
  } else if (phase === 'inside') {
    const sixes = Object.values(s.faces).filter(f => f.value === 6).length;
    controls = `<div class="controls inside">
      <div class="faces">${Object.entries(FACE_NAMES).map(([f, n]) => {
        const face = s.faces[f];
        return `<button class="face-tile ${face.locked ? 'locked' : ''} ${s.selectedFace === f ? 'sel' : ''} ${face.locked && face.value !== 6 ? 'bad' : ''}" data-action="dice-face" data-id="${f}" ${face.locked ? 'disabled' : ''} aria-label="${n}${face.locked ? '（已映出）' : ''}：${face.value ?? '未定'}">${faceIcon(face.value)}<span>${n}</span></button>`;
      }).join('')}</div>
      <div class="pad"><span class="ctrl-label">写入 ${FACE_NAMES[s.selectedFace]}</span>
        <div class="seg">${[1, 2, 3, 4, 5, 6].map(n => `<button class="seg-btn num" data-action="dice-inscribe" data-id="${n}">${n}</button>`).join('')}</div></div>
      <div class="inside-actions">
        <button class="btn primary" data-action="dice-materialize" ${sixes === 6 ? '' : 'disabled'}>成形并掷下（${sixes}/6）</button>
        <button class="btn ghost" data-action="dice-outside">← 回到镜外</button>
      </div>
    </div>`;
  } else {
    controls = `<div class="controls done">
      <div class="roll">${faceIcon(6)}<b>6</b></div>
      <p class="moral">镜外的骰子依旧普通。<br>镜中未被规定的部分，可以被创造。</p>
      <button class="btn primary" data-action="dice-continue">那么，镜子所说的「你」呢？ →</button>
    </div>`;
  }

  const hint = phase === 'inside' && badReflection
    ? '映出的面不是 6，镜中改不了它。'
    : s.message;

  return `<main class="screen prologue">
    <header class="screen-head"><h1>不存在的骰子</h1><p>让一枚骰子的六个面都成为 <b>6</b></p></header>
    <div class="worlds">
      <figure class="world"><figcaption>派朗 · 镜外</figcaption>${cube(s, false)}</figure>
      <div class="mirror-line" aria-hidden="true"></div>
      <figure class="world mirror ${formed ? 'formed' : ''}"><figcaption>阿派朗 · 镜中</figcaption>${cube(s, true)}</figure>
    </div>
    <p class="line ${phase === 'inside' && badReflection ? 'warn' : ''}" role="status" aria-live="polite">${hint}</p>
    ${controls}
    ${phase === 'outside' ? '<details class="hint"><summary>提示</summary>让 6 朝向正面，再让镜子只映出 1 面。</details>' : ''}
  </main>`;
}
