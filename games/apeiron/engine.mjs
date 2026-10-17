/** 镜生非我 · 战斗规则（v2 精简版）
 * 流程：镜子宣告 → 3 场验证试炼 → 确定属性 → Boss。
 * 只有「元素」需要验证；身份与武器由玩家选择且为真。
 * 证据只来自「本原」与敌方元素的真实相克（玩家元素攻击 / 敌方攻击），
 * 魔法师的强制弱点、借来的元素都不算证据。
 */
export const ELEMENTS = Object.freeze({
  earth: { name: '土', color: '#c9a47a' },
  water: { name: '水', color: '#7fb6dc' },
  fire: { name: '火', color: '#ef8a64' },
  metal: { name: '金', color: '#e3c86f' },
  wood: { name: '木', color: '#93c07c' },
});
export const ORDER = Object.keys(ELEMENTS);
/** 土 > 水 > 火 > 金 > 木 > 土 */
const BEATS = { earth: 'water', water: 'fire', fire: 'metal', metal: 'wood', wood: 'earth' };

export const ROLES = Object.freeze({
  mage: { name: '魔法师', skill: '弱点术', text: '技能必定命中弱点' },
  thief: { name: '盗贼', skill: '窃元', text: '技能窃取敌人的元素' },
  healer: { name: '医师', skill: '愈合', text: '技能治愈自身伤势' },
});
export const WEAPONS = Object.freeze({
  staff: { name: '法杖', text: '自行验证一次：直接看清本原' },
  scissors: { name: '剪刀', text: '跳过验证一次：跳过一场试炼' },
  syringe: { name: '针管', text: '直接添加一条属性' },
});
export const DROPS = Object.freeze({
  power: { name: '锋芒', text: '攻击 +3' },
  vital: { name: '坚韧', text: '生命上限 +12' },
  heal: { name: '休憩', text: '恢复 30 生命' },
});
export const TRIAL_NAMES = ['水之守门人', '回廊巡礼者', '镜庭守卫'];
export const BOSS_NAME = '万相之镜';
const MULT = { 1: 1.6, 0: 1, '-1': 0.5 };
const SKILL_COOLDOWN = 2;

const clone = v => structuredClone(v);
const isEl = e => Object.hasOwn(ELEMENTS, e);
export const elName = e => ELEMENTS[e]?.name ?? '?';

/** +1 攻方克制守方；-1 攻方被克；0 无关 */
export function getRelation(a, d) { return BEATS[a] === d ? 1 : BEATS[d] === a ? -1 : 0; }

function rand(s) {
  let x = s.rng >>> 0 || 1;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];

export function newGame(seed = Date.now()) {
  const s = { version: 2, rng: (seed >>> 0) || 7, phase: 'setup' };
  s.trueElement = pick(s, ORDER);
  // 镜子的断言：约一半为真
  s.claim = rand(s) < 0.5 ? s.trueElement : pick(s, ORDER.filter(e => e !== s.trueElement));
  Object.assign(s, {
    role: null, weapon: null, weaponUsed: false,
    candidates: [...ORDER], verifiedBy: null, extras: [], chosen: null,
    power: 0, maxHp: 60, hp: 60,
    encounter: 0, enemy: null, turn: 0, cooldown: 0,
    events: [], evidence: [], result: null, stats: { turns: 0, falls: 0 },
  });
  return s;
}

export function setup(state, role, weapon) {
  if (state.phase !== 'setup' || !ROLES[role] || !WEAPONS[weapon]) return state;
  const s = clone(state);
  s.role = role; s.weapon = weapon;
  startEncounter(s);
  return s;
}

function informativeElement(s) {
  let best = Infinity, opts = [];
  for (const e of ORDER) {
    const score = Math.max(...[-1, 0, 1].map(r => s.candidates.filter(c => getRelation(e, c) === r).length));
    if (score < best) { best = score; opts = [e]; } else if (score === best) opts.push(e);
  }
  return pick(s, opts);
}

function startEncounter(s) {
  const boss = s.encounter === 3;
  const el = s.encounter === 0 ? 'water' : boss ? pick(s, ORDER) : informativeElement(s);
  const hp = boss ? 84 : 32 + s.encounter * 4;
  s.enemy = {
    name: boss ? BOSS_NAME : TRIAL_NAMES[s.encounter], element: el, isBoss: boss,
    hp, maxHp: hp, dmg: boss ? 12 : 9 + s.encounter,
    next: boss ? pick(s, ORDER.filter(e => e !== el)) : null,
  };
  s.phase = boss ? 'boss' : 'battle';
  s.turn = 1; s.cooldown = 0; s.evidence = []; s.events = []; s.stolen = false;
}

/** 当前「我」以什么元素承受攻击 / 发动元素攻击 */
export function selfElement(s) { return s.phase === 'boss' ? s.chosen : s.trueElement; }

function observe(s, attacker, rel, who) {
  // 只在试炼中、且只对本原产生证据
  if (s.phase !== 'battle') return;
  const before = s.candidates.length;
  s.candidates = s.candidates.filter(c => (who === 'enemy' ? getRelation(attacker, c) : getRelation(c, attacker)) === rel);
  if (s.candidates.length === 1 && !s.verifiedBy) s.verifiedBy = 'battle';
  const verb = who === 'enemy'
    ? { 1: `${elName(attacker)}的攻击对你效果拔群`, 0: `${elName(attacker)}的攻击对你效果普通`, '-1': `${elName(attacker)}的攻击对你效果微弱` }[rel]
    : { 1: `你的本原对${elName(attacker)}效果拔群`, 0: `你的本原对${elName(attacker)}效果普通`, '-1': `你的本原对${elName(attacker)}效果微弱` }[rel];
  const key = `${who}:${attacker}:${rel}`;
  if (!s.evidence.some(e => e.key === key)) s.evidence.push({ key, text: verb, left: [...s.candidates], changed: s.candidates.length !== before });
}

const dmgText = rel => rel === 1 ? '拔群' : rel === -1 ? '微弱' : '';

/** 玩家行动。action: attack | element | skill | weapon；element 指定借来的元素攻击 */
export function act(state, action, arg) {
  if (!['battle', 'boss'].includes(state.phase)) return state;
  const s = clone(state);
  s.events = [];
  const e = s.enemy, P = s.power;
  const hit = (amount, rel, label) => {
    e.hp = Math.max(0, e.hp - amount);
    s.events.push({ side: 'enemy', amount, rel, label });
  };

  if (action === 'attack') {
    hit(8 + P, 0, '普通攻击');
  } else if (action === 'element') {
    const borrowed = arg && arg !== 'self';
    if (borrowed && !s.extras.includes(arg)) return state;
    const el = borrowed ? arg : selfElement(s);
    const rel = getRelation(el, e.element);
    const resonance = !borrowed && s.phase === 'boss' && s.chosen === s.trueElement ? 3 : 0;
    hit(Math.round((9 + P + resonance) * MULT[rel]), rel, borrowed ? `${elName(el)}·元素攻击` : '本原攻击');
    if (!borrowed) observe(s, e.element, rel, 'self');
  } else if (action === 'skill') {
    if (s.cooldown > 0) return state;
    s.cooldown = SKILL_COOLDOWN + 1;
    if (s.role === 'mage') hit(Math.round((10 + P) * MULT[1]), 1, '弱点术（不算证据）');
    else if (s.role === 'thief') {
      hit(9 + P, 0, '窃元');
      if (!s.extras.includes(e.element)) s.extras.push(e.element);
      s.events.push({ side: 'self', note: `窃得「${elName(e.element)}」属性` });
    } else {
      const heal = Math.min(16 + Math.floor(P / 2), s.maxHp - s.hp);
      s.hp += heal;
      s.events.push({ side: 'self', amount: heal, heal: true, label: '愈合' });
    }
  } else if (action === 'weapon') {
    if (s.weaponUsed) return state;
    if (s.weapon === 'staff') {
      s.weaponUsed = true; s.candidates = [s.trueElement]; s.verifiedBy = 'staff';
      s.events.push({ side: 'self', note: `法杖照见本原：${elName(s.trueElement)}` });
      return s; // 不消耗回合
    }
    if (s.weapon === 'syringe') {
      if (!isEl(arg) || s.extras.includes(arg)) return state;
      s.weaponUsed = true; s.extras.push(arg);
      s.events.push({ side: 'self', note: `针管注入「${elName(arg)}」属性` });
      return s;
    }
    if (s.weapon === 'scissors') {
      if (s.phase !== 'battle') return state;
      s.weaponUsed = true;
      return finishTrial(s, 'skip');
    }
    return state;
  } else return state;

  s.stats.turns++;
  if (e.hp <= 0) return s.phase === 'boss' ? endGame(s, true) : finishTrial(s, 'win');

  // 敌方回合
  const def = selfElement(s);
  const rel = getRelation(e.element, def);
  const dmg = Math.round((e.dmg + (s.turn % 3 === 0 ? 4 : 0)) * MULT[rel]);
  s.hp = Math.max(0, s.hp - dmg);
  s.events.push({ side: 'self', amount: dmg, rel, label: `${elName(e.element)}之击` });
  observe(s, e.element, rel, 'enemy');
  if (s.cooldown > 0) s.cooldown--;
  s.turn++;
  if (s.phase === 'boss') { e.element = e.next; e.next = pick(s, ORDER.filter(x => x !== e.element)); }
  if (s.hp <= 0) return s.phase === 'boss' ? endGame(s, false) : finishTrial(s, 'fall');
  return s;
}

function finishTrial(s, outcome) {
  if (outcome === 'fall') { s.stats.falls++; s.hp = Math.ceil(s.maxHp * 0.6); }
  s.result = { outcome, enemy: s.enemy.name, element: s.enemy.element, evidence: s.evidence.map(e => e.text), candidates: [...s.candidates] };
  s.phase = 'result';
  return s;
}

export function chooseDrop(state, id) {
  if (state.phase !== 'result' || !DROPS[id]) return state;
  const s = clone(state);
  if (id === 'power') s.power += 3;
  if (id === 'vital') { s.maxHp += 12; s.hp += 12; }
  if (id === 'heal') s.hp = Math.min(s.maxHp, s.hp + 30);
  s.result = null; s.encounter++;
  if (s.encounter >= 3) { s.phase = 'attune'; s.enemy = null; } else startEncounter(s);
  return s;
}

/** 确定属性：可以选任何元素。只有选中已验证的本原才获得共鸣加成。 */
export function attune(state, el) {
  if (state.phase !== 'attune' || !isEl(el)) return state;
  const s = clone(state);
  s.chosen = el; s.hp = s.maxHp;
  startEncounter(s);
  return s;
}

function endGame(s, won) {
  s.phase = won ? 'won' : 'lost';
  return s;
}

export function retryBoss(state) {
  if (state.phase !== 'lost') return state;
  const s = clone(state);
  s.hp = s.maxHp; s.encounter = 3; startEncounter(s);
  return s;
}

/** 结局类型：verified 证实本原 / matched 未证实却选中 / other 选择了非我 */
export function endingKind(s) {
  if (s.chosen !== s.trueElement) return 'other';
  return s.candidates.length === 1 ? 'verified' : 'matched';
}

export function validateSave(s) {
  try {
    return !!s && s.version === 2 && ['setup', 'battle', 'result', 'attune', 'boss', 'won', 'lost'].includes(s.phase)
      && isEl(s.trueElement) && isEl(s.claim) && Array.isArray(s.candidates) && s.candidates.every(isEl)
      && Number.isFinite(s.hp) && Number.isFinite(s.maxHp)
      && (['battle', 'boss'].includes(s.phase) ? !!s.enemy && isEl(s.enemy.element) : true);
  } catch { return false; }
}
