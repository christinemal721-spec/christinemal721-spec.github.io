import * as D from './dice.mjs';
import * as G from './engine.mjs';
import { renderPrologue } from './prologue.mjs';

const { ELEMENTS, ORDER, ROLES, WEAPONS, DROPS, elName } = G;
const KEY = 'apeiron.v2';
const app = document.getElementById('app');
const modal = document.getElementById('modal');

let store = load() || { chapter: 'dice', dice: D.newDice(), game: null };
let ui = { role: null, weapon: null, syringe: false, pendingEvidence: 0 };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || !['dice', 'game'].includes(raw.chapter) || !D.validateDiceSave(raw.dice)) return null;
    if (raw.game && !G.validateSave(raw.game)) raw.game = null;
    if (raw.chapter === 'game' && !raw.game) raw.chapter = 'dice';
    return raw;
  } catch { return null; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 无痕模式等 */ } }

/* ---------- 小组件 ---------- */
const el = (e, extra = '') => `<span class="el el-${e} ${extra}" title="${elName(e)}">${elName(e)}</span>`;
const unknownEl = () => `<span class="el el-unknown">?</span>`;
const hpBar = (hp, max) => `<div class="hp"><div class="hp-fill" style="width:${Math.max(0, hp / max * 100)}%"></div><span>${hp} / ${max}</span></div>`;
const candidates = g => `<div class="cands" aria-label="本原候选：${g.candidates.map(elName).join('、')}">${ORDER.map(e => `<span class="cand el-${e} ${g.candidates.includes(e) ? '' : 'out'}">${elName(e)}</span>`).join('')}</div>`;
const cycle = () => `<div class="cycle" aria-label="五行克制：土克水，水克火，火克金，金克木，木克土">${[...ORDER, 'earth'].map((e, i) => `${i ? '<i>›</i>' : ''}<b class="t-${e}">${elName(e)}</b>`).join('')}<small>左克右 · 克制 ×1.6</small></div>`;

function progress() {
  const g = store.game;
  const steps = ['序', '试炼一', '试炼二', '试炼三', '镜'];
  let cur = 0;
  if (store.chapter === 'game' && g) cur = g.phase === 'setup' ? 1 : ['attune', 'boss', 'won', 'lost'].includes(g.phase) ? 4 : g.encounter + 1;
  return `<ol class="progress">${steps.map((t, i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}">${t}</li>`).join('')}</ol>`;
}

function topbar() {
  return `<header class="topbar"><div class="brand">阿派朗<small>镜生非我</small></div>${progress()}<div class="tools"><button class="icon-btn" data-action="help" aria-label="玩法">?</button><button class="icon-btn" data-action="restart" aria-label="重新开始" title="重新开始">↺</button></div></header>`;
}

/* ---------- 第二章各界面 ---------- */
function setupScreen(g) {
  const ready = ui.role && ui.weapon;
  const opt = (kind, id, o) => `<button class="choice ${ui[kind] === id ? 'on' : ''}" data-action="pick-${kind}" data-id="${id}" aria-pressed="${ui[kind] === id}"><b>${o.name}</b><span>${o.text}</span></button>`;
  return `<main class="screen setup">
    <div class="oracle"><div class="mirror-glyph" aria-hidden="true"></div>
      <p class="quote">镜子说：你是 ${el(g.claim, 'big')}</p>
      <p class="sub">真假未知。用战斗去验证。</p></div>
    <section class="pick"><h2>身份</h2><div class="choices">${Object.entries(ROLES).map(([k, o]) => opt('role', k, o)).join('')}</div></section>
    <section class="pick"><h2>武器 <small>每局一次</small></h2><div class="choices">${Object.entries(WEAPONS).map(([k, o]) => opt('weapon', k, o)).join('')}</div></section>
    <button class="btn primary wide" data-action="start" ${ready ? '' : 'disabled'}>走入镜中</button>
  </main>`;
}

function eventLines(g) {
  if (!g.events.length) return `<p class="ev muted">${g.phase === 'boss' ? '镜的弱点每回合都在变。' : '选择行动。用「本原攻击」试探自己。'}</p>`;
  return g.events.map(e => {
    if (e.note) return `<p class="ev note">${e.note}</p>`;
    if (e.heal) return `<p class="ev good">${e.label}：恢复 ${e.amount}</p>`;
    const tag = e.rel === 1 ? '<em class="up">拔群</em>' : e.rel === -1 ? '<em class="down">微弱</em>' : '';
    return e.side === 'enemy' ? `<p class="ev">你 · ${e.label} → <b>${e.amount}</b> ${tag}</p>` : `<p class="ev hurt">${e.label} → 你 <b>-${e.amount}</b> ${tag}</p>`;
  }).join('');
}

function battleScreen(g) {
  const e = g.enemy, boss = g.phase === 'boss';
  const selfEl = boss ? el(g.chosen) : (g.candidates.length === 1 ? el(g.candidates[0]) : unknownEl());
  const newest = g.evidence.at(-1);
  const clue = !boss && newest && ui.pendingEvidence ? `<p class="clue">线索：${newest.text}<br><small>本原可能是：${newest.left.map(elName).join('、')}</small></p>` : '';
  const role = ROLES[g.role];
  const skillLabel = g.cooldown > 0 ? `${role.skill}<small>冷却 ${g.cooldown}</small>` : `${role.skill}<small>${role.text.replace('技能', '')}</small>`;
  const weapon = WEAPONS[g.weapon];
  const weaponOff = g.weaponUsed || (g.weapon === 'scissors' && boss);
  const syringeRow = ui.syringe ? `<div class="syringe-row"><span>注入哪种属性？</span>${ORDER.filter(x => !g.extras.includes(x)).map(x => `<button class="el-btn el-${x}" data-action="syringe" data-id="${x}">${elName(x)}</button>`).join('')}<button class="btn ghost sm" data-action="syringe-cancel">取消</button></div>` : '';
  const lent = g.extras.filter(x => x !== G.selfElement(g));
  const borrowed = lent.length ? `<div class="borrowed-row"><span>借来的属性攻击</span>${lent.map(x => `<button class="el-btn el-${x}" data-action="element" data-id="${x}" aria-label="以${elName(x)}攻击（不算线索）">${elName(x)}</button>`).join('')}<small>不算线索</small></div>` : '';
  return `<main class="screen battle ${boss ? 'is-boss' : ''}">
    <div class="arena">
      <section class="unit me">
        <img src="./assets/wanderer.svg" alt="" class="portrait">
        <div class="info"><h3>你 ${selfEl}</h3>${hpBar(g.hp, g.maxHp)}
          ${boss ? `<p class="meta">已确定属性：${elName(g.chosen)}${g.extras.length ? ` · 附加 ${g.extras.map(elName).join('、')}` : ''}</p>` : `<p class="meta">镜子说：${elName(g.claim)}</p>${candidates(g)}`}
        </div>
      </section>
      <div class="vs">${eventLines(g)}${clue}</div>
      <section class="unit foe">
        <img src="./assets/${boss ? 'boss' : 'water-spirit'}.svg" alt="" class="portrait tint-${e.element}">
        <div class="info"><h3>${e.name} ${el(e.element)}</h3>${hpBar(e.hp, e.maxHp)}
          ${boss ? `<p class="meta">下回合变为 ${el(e.next, 'sm')}</p>` : `<p class="meta">试炼 ${g.encounter + 1} / 3</p>`}</div>
      </section>
    </div>
    ${cycle()}
    ${syringeRow}
    <nav class="actions" aria-label="行动">
      <button class="act" data-action="attack"><kbd>1</kbd>普通攻击<small>${8 + g.power} 伤害 · 无属性</small></button>
      <button class="act key" data-action="element" data-id="self"><kbd>2</kbd>本原攻击<small>${boss ? `以「${elName(g.chosen)}」攻击` : '以真实本原攻击 · 可得线索'}</small></button>
      <button class="act" data-action="skill" ${g.cooldown > 0 ? 'disabled' : ''}><kbd>3</kbd>${skillLabel}</button>
      <button class="act weapon" data-action="weapon" ${weaponOff ? 'disabled' : ''}><kbd>4</kbd>${weapon.name}<small>${g.weaponUsed ? '已使用' : weapon.text.split('：')[0]}</small></button>
    </nav>
    ${borrowed}
  </main>`;
}

function resultScreen(g) {
  const r = g.result;
  const title = { win: '试炼通过', fall: '你倒下了 —— 这也是答案', skip: '剪刀剪断了这场试炼' }[r.outcome];
  const ev = r.evidence.length ? `<ul class="evidence">${r.evidence.map(t => `<li>${t}</li>`).join('')}</ul>` : `<p class="muted">${r.outcome === 'skip' ? '跳过的试炼不留下证据。' : '这场战斗没有留下新线索。'}</p>`;
  const verdict = r.candidates.length === 1 ? `你的本原是 ${el(r.candidates[0], 'big')}` : `本原仍可能是：${r.candidates.map(x => el(x)).join('')}`;
  return `<main class="screen result">
    <h2>${title}</h2>
    ${ev}
    <div class="verdict">${verdict}</div>
    <p class="claim-check">${r.candidates.includes(g.claim) ? (r.candidates.length === 1 ? '镜子说对了。' : '镜子的话尚未被推翻。') : `镜子说你是「${elName(g.claim)}」—— 它错了。`}</p>
    <section class="drops"><h3>选择一份收获</h3><div class="choices">${Object.entries(DROPS).map(([k, d]) => `<button class="choice" data-action="drop" data-id="${k}"><b>${d.name}</b><span>${d.text}</span></button>`).join('')}</div></section>
  </main>`;
}

function attuneScreen(g) {
  const known = g.candidates.length === 1;
  return `<main class="screen attune">
    <h2>确定你的属性</h2>
    <p class="sub">${known ? `已验证的本原：${elName(g.candidates[0])}。选它可获得共鸣加成。` : `本原尚未确定，可能是 ${g.candidates.map(elName).join('、')}。<br>未验证的，也可以被选择为真。`}</p>
    <div class="el-pick">${ORDER.map(x => `<button class="el-card el-${x} ${g.candidates.includes(x) ? 'possible' : 'not'}" data-action="attune" data-id="${x}"><b>${elName(x)}</b><small>${g.candidates.includes(x) ? (known ? '本原' : '可能') : '非我'}</small></button>`).join('')}</div>
    <p class="muted">选定后迎战最终的「${G.BOSS_NAME}」。</p>
  </main>`;
}

function endScreen(g) {
  if (g.phase === 'lost') return `<main class="screen end"><h2>镜吞没了你</h2><p class="sub">你的本原是 ${el(g.trueElement)}，你选择了 ${el(g.chosen)}。</p><div class="row"><button class="btn primary" data-action="retry">再战万相之镜</button><button class="btn ghost" data-action="new-journey">新的旅程</button></div></main>`;
  const kind = G.endingKind(g);
  const text = {
    verified: ['镜已破碎，你仍是你。', '你验证了自己，并成为了它。'],
    matched: ['镜已破碎，你猜中了自己。', '你没有证据，却选中了真实的本原。'],
    other: ['镜已破碎，你成为了非我。', `你的本原是「${elName(g.trueElement)}」，而你选择成为「${elName(g.chosen)}」。未被规定的，也可以被创造。`],
  }[kind];
  return `<main class="screen end"><div class="mirror-glyph broken" aria-hidden="true"></div><h2>${text[0]}</h2><p class="sub">${text[1]}</p>
    <dl class="stats"><div><dt>镜子说</dt><dd>${elName(g.claim)}</dd></div><div><dt>本原</dt><dd>${elName(g.trueElement)}</dd></div><div><dt>你的选择</dt><dd>${elName(g.chosen)}</dd></div><div><dt>回合</dt><dd>${g.stats.turns}</dd></div></dl>
    <div class="row"><button class="btn primary" data-action="new-journey">再照一次镜子</button><button class="btn ghost" data-action="replay-dice">重玩引子</button></div></main>`;
}

/* ---------- 渲染 ---------- */
function render() {
  let body;
  if (store.chapter === 'dice') body = renderPrologue(store.dice);
  else {
    const g = store.game;
    body = g.phase === 'setup' ? setupScreen(g)
      : ['battle', 'boss'].includes(g.phase) ? battleScreen(g)
      : g.phase === 'result' ? resultScreen(g)
      : g.phase === 'attune' ? attuneScreen(g) : endScreen(g);
  }
  app.innerHTML = topbar() + body;
  save();
}

function help() {
  modal.innerHTML = `<form method="dialog" class="help"><h2>怎么玩</h2>
    <p><b>序章</b>：转动骰子、调整镜子映出的面数，进入镜中，把未被映出的面写成 6。</p>
    <p><b>镜生非我</b>：镜子告诉你一个元素，但它可能在说谎。</p>
    <ul><li>用 <b>本原攻击</b> 或承受敌人攻击时，「拔群 / 微弱 / 普通」就是线索。</li>
    <li>魔法师的弱点术、借来的属性 <b>不算</b> 线索。</li>
    <li>三场试炼后确定属性，迎战每回合变换元素的 Boss。</li></ul>
    ${cycle()}
    <button class="btn primary">知道了</button></form>`;
  modal.showModal();
}

function setGame(next) {
  const prev = store.game;
  store.game = next;
  ui.pendingEvidence = prev && next.evidence.length > (prev.evidence?.length ?? 0) && next.phase === prev.phase ? 1 : 0;
  if (next.phase !== 'battle' && next.phase !== 'boss') ui.syringe = false;
  render();
  if (prev && ['battle', 'boss'].includes(prev.phase)) floatDamage(next);
}

function floatDamage(g) {
  for (const e of g.events) {
    if (!e.amount) continue;
    const target = app.querySelector(e.side === 'enemy' ? '.unit.foe' : '.unit.me');
    if (!target) continue;
    const n = document.createElement('span');
    n.className = `float ${e.heal ? 'heal' : e.rel === 1 ? 'up' : e.rel === -1 ? 'down' : ''}`;
    n.textContent = (e.heal ? '+' : '-') + e.amount;
    target.appendChild(n);
    setTimeout(() => n.remove(), 1100);
  }
}

function handle(action, id) {
  const d = store.dice, g = store.game;
  switch (action) {
    case 'dice-rotate': store.dice = D.rotateDice(d, id); break;
    case 'dice-angle': store.dice = D.setExposure(d, Number(id)); break;
    case 'dice-enter': store.dice = D.enterMirror(d); break;
    case 'dice-face': store.dice = D.selectFace(d, id); break;
    case 'dice-inscribe': store.dice = D.inscribeFace(d, Number(id)); break;
    case 'dice-outside': store.dice = D.returnOutside(d); break;
    case 'dice-materialize': store.dice = D.rollDice(D.materialize(d)); break;
    case 'dice-continue': store.chapter = 'game'; if (!store.game || store.game.phase === 'won') store.game = G.newGame(); break;
    case 'replay-dice': store.chapter = 'dice'; store.dice = D.newDice(); break;
    case 'pick-role': ui.role = id; break;
    case 'pick-weapon': ui.weapon = id; break;
    case 'start': ui.syringe = false; return setGame(G.setup(g, ui.role, ui.weapon));
    case 'attack': return setGame(G.act(g, 'attack'));
    case 'element': return setGame(G.act(g, 'element', id));
    case 'skill': return setGame(G.act(g, 'skill'));
    case 'weapon':
      if (g.weapon === 'syringe') { ui.syringe = !ui.syringe; break; }
      return setGame(G.act(g, 'weapon'));
    case 'syringe': ui.syringe = false; return setGame(G.act(g, 'weapon', id));
    case 'syringe-cancel': ui.syringe = false; break;
    case 'drop': return setGame(G.chooseDrop(g, id));
    case 'attune': return setGame(G.attune(g, id));
    case 'retry': return setGame(G.retryBoss(g));
    case 'new-journey': store.game = G.newGame(); ui.role = ui.weapon = null; break;
    case 'help': return help();
    case 'restart':
      if (!confirm('从序章重新开始？当前进度会清除。')) return;
      store = { chapter: 'dice', dice: D.newDice(), game: null }; ui = { role: null, weapon: null, syringe: false, pendingEvidence: 0 }; break;
    default: return;
  }
  render();
}

app.addEventListener('click', ev => {
  const b = ev.target.closest('[data-action]');
  if (b && !b.disabled) handle(b.dataset.action, b.dataset.id);
});
document.addEventListener('keydown', ev => {
  if (modal.open || store.chapter !== 'game' || !['battle', 'boss'].includes(store.game?.phase)) return;
  const map = { 1: '[data-action="attack"]', 2: '[data-action="element"][data-id="self"]', 3: '[data-action="skill"]', 4: '[data-action="weapon"]' };
  const b = map[ev.key] && app.querySelector(map[ev.key]);
  if (b && !b.disabled) { ev.preventDefault(); b.click(); }
});

render();
