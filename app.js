'use strict';
/* 筋モン（仮）
   ・はじめに「やる曜日」と「1回のメニュー（ウォームアップ・サーキット・仕上げ）」を自分で決める
   ・予定の曜日にサーキットを回数で進める（マシンは重さ×回数、有酸素は分）。3回続けて目標どおりなら負荷アップを提案
   ・やった分だけ相棒モンスターが育って進化し、運動でたまったガチャ石でガチャが引ける
   ・予定の曜日にサボると相棒が弱り、3回で寝込む（休みの曜日は減らない。運動すればすぐ回復）
   データはこのiPhoneの中（localStorage）だけに保存する。運動の記録は「いつ・何を・何回」の履歴で残し、
   あとでログインを付けたときにそのままサーバーへ移せるようにしておく */

const VERSION = '0.3.0';
const KEY = 'kinmon-v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n) => String(n).padStart(2, '0');
const mmss = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; };
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dayKey(d); };
const weekKey = (k = dayKey()) => { const d = parseKey(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d); };
const r1 = (v) => Math.round(v * 10) / 10;
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月曜はじまり

/* ---------- ルール ---------- */
const DONE_PT = 5; // 5pt以上で「やった日」
const CAP = 300; // 1日の上限
const EVO_DAYS = [1, 3, 14, 30]; // やった日の合計がこの日数で 幼年期→成長期→成熟期→完全体
const COST = 5; // ガチャ1回
const HIT_UP = 3; // 3回続けて目標どおりなら負荷アップを提案
const MISS_DOWN = 2; // 2回続けて届かなければ軽くする提案

/* ---------- 種目 ----------
   kind：machine＝重さ×回数、body＝回数（自重）、sec＝秒、cardio＝分（ルームランナー・バイク） */
const KINDS = { machine: 'マシン', body: '自重', sec: '自重（秒）', cardio: '有酸素' };
const LIB = [
  { id: 'chest', name: 'チェストプレス', kind: 'machine', line: 'pw', w: 20 },
  { id: 'shoulder', name: 'ショルダープレス', kind: 'machine', line: 'pw', w: 15 },
  { id: 'fly', name: 'バタフライ', kind: 'machine', line: 'pw', w: 15 },
  { id: 'pushdown', name: 'トライセプスプッシュダウン', kind: 'machine', line: 'pw', w: 15 },
  { id: 'curl', name: 'アームカール', kind: 'machine', line: 'pw', w: 10 },
  { id: 'legext', name: 'レッグエクステンション', kind: 'machine', line: 'tf', w: 25 },
  { id: 'legcurl', name: 'レッグカール', kind: 'machine', line: 'tf', w: 20 },
  { id: 'legpress', name: 'レッグプレス', kind: 'machine', line: 'tf', w: 40 },
  { id: 'latpull', name: 'ラットプルダウン', kind: 'machine', line: 'gd', w: 25 },
  { id: 'row', name: 'シーテッドロー', kind: 'machine', line: 'gd', w: 25 },
  { id: 'cablecrunch', name: 'ケーブルクランチ', kind: 'machine', line: 'gd', w: 15 },
  { id: 'push', name: '腕立て', kind: 'body', line: 'pw', n: 10 },
  { id: 'squat', name: 'スクワット', kind: 'body', line: 'tf', n: 15 },
  { id: 'lunge', name: 'ランジ', kind: 'body', line: 'tf', n: 10 },
  { id: 'hiplift', name: 'ヒップリフト', kind: 'body', line: 'tf', n: 15 },
  { id: 'abs', name: '腹筋', kind: 'body', line: 'gd', n: 15 },
  { id: 'legraise', name: 'レッグレイズ', kind: 'body', line: 'gd', n: 10 },
  { id: 'burpee', name: 'バーピー', kind: 'body', line: 'sp', n: 5, per: 3 },
  { id: 'climber', name: 'マウンテンクライマー', kind: 'body', line: 'sp', n: 20 },
  { id: 'plank', name: 'プランク', kind: 'sec', line: 'gd', n: 30 },
  { id: 'tread', name: 'ルームランナー', kind: 'cardio', line: 'sp', n: 10, ic: '🏃' },
  { id: 'bike', name: 'バイク', kind: 'cardio', line: 'sp', n: 5, ic: '🚲' },
];
const FREE = ['push', 'squat', 'abs', 'plank', 'burpee', 'tread', 'bike']; // 「自由に記録」に出す種目
const exOf = (id) => LIB.find((e) => e.id === id) || (S.custom || []).find((e) => e.id === id) || { id, name: id, kind: 'body', line: 'pw' };
const unitOf = (e) => (e.kind === 'sec' ? '秒' : e.kind === 'cardio' ? '分' : '回');
const ptOf = (e, n) => (e.kind === 'sec' ? Math.floor(n / 10) : n * (e.per || 1));
const stepsOf = (e) => (e.kind === 'sec' ? [10, 30] : e.kind === 'cardio' ? [5, 10] : e.per ? [3, 5] : [5, 10]);
const wStep = (ex) => S.step[ex] || 2.5;
const tgtText = (it) => { const e = exOf(it.ex); return e.kind === 'machine' ? `${r1(it.w)}kg × ${it.n}回` : `${it.n}${unitOf(e)}`; };
const lvOf = (exp) => Math.floor(Math.sqrt(exp / 10)) + 1;
// 龍太郎さんのはじめのメニュー（重さは仮。最初の1回で実際の重さに直す）
const DEFAULT_PLAN = () => ({
  days: [1, 3, 5],
  warm: { ex: 'bike', n: 5 },
  items: [{ ex: 'chest', n: 12, w: 20 }, { ex: 'legext', n: 12, w: 25 }, { ex: 'latpull', n: 12, w: 25 }, { ex: 'squat', n: 15 }, { ex: 'plank', n: 30 }],
  rounds: 2, rest: 30, rrest: 90,
  cool: { ex: 'tread', n: 10 },
  hist: [],
});

/* ---------- ガチャの中身 ---------- */
const ITEMS = [
  { id: 'protein', r: 'N', kind: 'boost', name: 'プロテイン', w: 3, ic: '🥤' },
  { id: 'bg_gym', r: 'N', kind: 'bg', name: 'ジム' },
  { id: 'bg_dojo', r: 'N', kind: 'bg', name: '道場' },
  { id: 'bg_beach', r: 'N', kind: 'bg', name: '海辺' },
  { id: 'bg_park', r: 'N', kind: 'bg', name: '夕焼けの公園' },
  { id: 't_rookie', r: 'N', kind: 'title', name: '筋トレ見習い' },
  { id: 't_3days', r: 'N', kind: 'title', name: '三日坊主卒業' },
  { id: 'bg_night', r: 'R', kind: 'bg', name: '夜の街' },
  { id: 'bg_volcano', r: 'R', kind: 'bg', name: '火山' },
  { id: 'bg_arena', r: 'R', kind: 'bg', name: '闘技場' },
  { id: 'fx_fire', r: 'R', kind: 'fx', name: '炎のオーラ', ic: '🔥' },
  { id: 'fx_thunder', r: 'R', kind: 'fx', name: '雷のオーラ', ic: '⚡' },
  { id: 'fx_sparkle', r: 'R', kind: 'fx', name: 'キラキラ', ic: '✨' },
  { id: 't_morning', r: 'R', kind: 'title', name: '朝トレの鬼' },
  { id: 't_push', r: 'R', kind: 'title', name: '腕立て職人' },
  { id: 't_leg', r: 'R', kind: 'title', name: '脚の日の男' },
  { id: 't_abs', r: 'R', kind: 'title', name: '鋼の腹筋' },
  { id: 'egg', r: 'SR', kind: 'egg', name: '新しいタマゴ', ic: '🥚' },
  { id: 'skin_gold', r: 'SR', kind: 'skin', name: '金色の相棒', ic: '👑' },
  { id: 'bg_space', r: 'SR', kind: 'bg', name: '宇宙' },
];
const RARITY = [['SR', 5], ['R', 25], ['N', 70]];
const KIND_NAME = { bg: '背景', fx: 'オーラ', title: '称号', skin: '見た目' };
const MAX_MONS = 4;
const itemIcon = (it) => (it.kind === 'bg' ? `<i class="sw-bg bg-${it.id}"></i>` : it.kind === 'title' ? '🏅' : it.ic || '🎁');

/* ---------- 保存 ---------- */
const zero = () => ({ pw: 0, tf: 0, gd: 0, sp: 0 });
const newMon = (d) => ({ id: uid(), form: 'egg', stage: 0, exp: 0, stats: zero(), since: zero(), days: 0, born: d, evo: [] });
function defaults() {
  const t = dayKey();
  return {
    v: 1, uid: uid() + uid(), created: t,
    log: [], // { at: 時刻(ms), d:'2026-10-25', ex:'chest', n:12, w:20(マシンだけ), pt:12, src:'manual'|'circuit' }
    mons: [newMon(t)], active: 0,
    gems: 0, boost: 0, freeze: 1, freezeWeek: weekKey(t), frozen: [],
    items: {}, equip: { bg: '', fx: '', title: '', skin: '' }, seen: { egg: t }, pulls: 0,
    plan: null, planFrom: '', // planFrom＝目標をつくった日（それより前は曜日の予定なし）
    custom: [], // 自分で追加した種目 { id, name, kind, line }
    step: {}, // マシンの重さの刻み { chest: 2.5 }
    prog: {}, // 負荷アップの判定 { chest: { hit: 連続で目標どおり, miss: 連続で届かず } }
    goal: {}, // 目標達成した日 { '2026-10-25': true }
    weekBonus: {}, // 週の目標達成ボーナスをもらった週
    settings: { voice: true, tenSec: true, beep: true, silentOk: true, rate: 'normal', remind: '21:00' },
    push: { on: false, sent: '' }, // sent＝通知サーバーに「やった」を伝えた最後の日
  };
}
let S;
function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      S = { ...base, ...d, settings: { ...base.settings, ...d.settings }, equip: { ...base.equip, ...d.equip }, push: { ...base.push, ...d.push } };
      if (!Array.isArray(S.mons) || !S.mons.length) S.mons = base.mons;
      if (!S.mons[S.active]) S.active = 0;
      delete S.tmenu; // 前の版の固定タイマーの選択（もう使わない）
      return;
    }
  } catch { /* 読めないときは初期状態で始める */ }
  S = base;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('保存できませんでした'); }
}
const mon = () => S.mons[S.active];
// お休み札：週に1枚（2枚まで持てる）
function grantFreeze() {
  const wk = weekKey();
  if (S.freezeWeek !== wk) { S.freezeWeek = wk; S.freeze = Math.min(2, S.freeze + 1); save(); }
}

/* ---------- 記録の集計 ---------- */
function dayTotals() {
  const t = {};
  for (const l of S.log) t[l.d] = (t[l.d] || 0) + l.pt;
  return t;
}
const isDoneIn = (tot, d) => (tot[d] || 0) >= DONE_PT;
// 予定の曜日か（目標をつくる前は毎日が予定）
const isPlanned = (d) => !S.plan || d < S.planFrom || S.plan.days.includes(parseKey(d).getDay());
const planDays = () => (S.plan ? S.plan.days : [0, 1, 2, 3, 4, 5, 6]);
// 最後に「やった日」から今日までのあいだで、休んだ予定の曜日（今日はふくめない）
function missedList(tot = dayTotals()) {
  const today = dayKey();
  const last = Object.keys(tot).filter((k) => k < today && isDoneIn(tot, k)).sort().pop();
  if (!last) return [];
  const out = [];
  for (let d = addDays(last, 1); d < today; d = addDays(d, 1)) if (isPlanned(d)) out.push(d);
  return out;
}
function energy(tot = dayTotals()) {
  if (isDoneIn(tot, dayKey())) return 100;
  return [100, 60, 30][missedList(tot).length] ?? 5;
}
const sleeping = (tot = dayTotals()) => !isDoneIn(tot, dayKey()) && missedList(tot).length >= 3;
// 連続回数：やった日を数える。休みの曜日はとばし、休んだ予定の曜日はお休み札（使ったもの＋手持ち）でつなぐ
function streak(tot = dayTotals()) {
  const today = dayKey();
  const doneKeys = Object.keys(tot).filter((k) => isDoneIn(tot, k)).sort();
  if (!doneKeys.length) return 0;
  const frozen = new Set(S.frozen);
  let d = isDoneIn(tot, today) ? today : addDays(today, -1);
  let n = 0, budget = S.freeze;
  while (d >= doneKeys[0]) {
    if (isDoneIn(tot, d)) n++;
    else if (isPlanned(d) && !frozen.has(d)) { if (budget > 0) budget--; else break; }
    d = addDays(d, -1);
  }
  return n;
}
const weekDates = (wk = weekKey()) => Array.from({ length: 7 }, (_, i) => addDays(wk, i));
const weekDone = (tot = dayTotals(), wk = weekKey()) => weekDates(wk).filter((d) => isDoneIn(tot, d)).length;
// カレンダーの印：goal◎ done● fz🧊 miss× plan○ rest（休みの曜日） none（予定前）
function dayMark(d, tot) {
  if (S.goal[d]) return 'goal';
  if (isDoneIn(tot, d)) return 'done';
  if (S.frozen.includes(d)) return 'fz';
  if (!S.plan || d < S.planFrom) return 'none';
  if (!isPlanned(d)) return 'rest';
  return d < dayKey() ? 'miss' : 'plan';
}
const MARK = { goal: '◎', done: '●', fz: '🧊', miss: '×', plan: '○', rest: '', none: '' };

/* ---------- 記録して、育てる ---------- */
function addEntries(entries, { goal = false } = {}) {
  const d = dayKey();
  const m = mon();
  const tot0 = dayTotals();
  const missed = missedList(tot0);
  const before = { total: tot0[d] || 0, done: isDoneIn(tot0, d), lv: lvOf(m.exp) };
  const raw = entries.reduce((a, en) => a + en.pt, 0);
  S.log.push(...entries);
  const after = before.total + raw;
  const eff = Math.max(0, Math.min(after, CAP) - Math.min(before.total, CAP));
  const f = raw ? eff / raw : 0;
  const boost = S.boost > 0 && eff > 0;
  if (boost) S.boost--;
  const goalNew = goal && !S.goal[d];
  if (goalNew) S.goal[d] = true;
  const mult = (boost ? 1.5 : 1) * (goalNew ? 1.5 : 1);
  const gain = zero();
  entries.forEach((en) => { gain[exOf(en.ex).line] += en.pt * f; });
  for (const k in gain) {
    m.since[k] += Math.round(gain[k]);
    gain[k] = Math.round(gain[k] * mult);
    m.stats[k] += gain[k];
  }
  const exp = Math.round(eff * mult);
  m.exp += exp;

  let gems = 0;
  const notes = [];
  if (goalNew) { gems += 5; notes.push('目標達成 ＋5'); }
  const newDone = !before.done && after >= DONE_PT;
  let st = streak();
  let weekGoal = false;
  if (newDone) {
    gems += 3; notes.push('やった日 ＋3');
    if (missed.length >= 3) { gems += 3; notes.push('おかえりボーナス ＋3'); }
    // 休んだ予定の曜日をお休み札でうめる
    if (missed.length > 0 && missed.length <= S.freeze) {
      S.frozen.push(...missed);
      S.freeze -= missed.length;
      notes.push(`お休み札を${missed.length}枚使って連続をつなぎました`);
    }
    m.days++;
    st = streak();
    if (st > 0 && st % 7 === 0) { gems += 5; notes.push(`${st}回連続 ＋5`); }
    const wk = weekKey(d);
    if (S.plan && !S.weekBonus[wk] && weekDone(dayTotals(), wk) >= S.plan.days.length) {
      S.weekBonus[wk] = true; weekGoal = true;
      gems += 10; notes.push('週の目標達成 ＋10');
    }
  }
  const tens = (x) => Math.min(10, Math.floor(Math.min(x, CAP) / 10));
  const tg = tens(after) - tens(before.total);
  if (tg > 0) { gems += tg; notes.push(`10ptごと ＋${tg}`); }
  const evo = checkEvo(m);
  if (evo) { gems += 10; notes.push('進化ボーナス ＋10'); }
  S.gems += gems;
  save();
  return { raw, eff, exp, gain, gems, notes, newDone, boost, goal: goalNew, weekGoal, evo, lvUp: lvOf(m.exp) > before.lv, streak: st, capped: eff < raw, sugg: [] };
}
// 自由に記録（回数だけ）
function addWorkout(counts) {
  const at = Date.now(), d = dayKey();
  const entries = FREE.map(exOf).filter((e) => counts[e.id] > 0).map((e) => ({ at, d, ex: e.id, n: counts[e.id], pt: ptOf(e, counts[e.id]), src: 'manual' }));
  return addEntries(entries);
}
// 進化：前の進化からいちばん多くやった系統へ。完全体は4系統どれも2割以上なら隠しのマッスルキング
function checkEvo(m) {
  if (m.stage >= 4 || m.days < EVO_DAYS[m.stage]) return null;
  const from = m.form;
  m.stage++;
  const top = Object.keys(m.since).reduce((a, k) => (m.since[k] > m.since[a] ? k : a), 'pw');
  const sum = Object.values(m.stats).reduce((a, v) => a + v, 0);
  if (m.stage === 1) m.form = 'baby';
  else if (m.stage === 4 && sum > 0 && Object.values(m.stats).every((v) => v >= sum * 0.2)) m.form = 'king';
  else m.form = `${top}${m.stage}`;
  m.since = zero();
  m.evo.push({ d: dayKey(), form: m.form });
  S.seen[m.form] ||= dayKey();
  return { from, to: m.form };
}

/* ---------- 少しずつ改良（負荷アップ・ダウンの提案） ---------- */
const planParts = (p = S.plan) => [p.warm, ...p.items, p.cool].filter(Boolean);
function nextVal(it, dir) {
  const e = exOf(it.ex);
  if (e.kind === 'machine') return { ...it, w: r1(Math.max(wStep(it.ex), it.w + dir * wStep(it.ex))) };
  if (e.kind === 'sec') return { ...it, n: Math.max(10, it.n + dir * 10) };
  return { ...it, n: Math.max(1, it.n + dir * 2) };
}
function applyChange(ex, fn, why) {
  const parts = planParts().filter((it) => it.ex === ex);
  if (!parts.length) return;
  const before = tgtText(parts[0]);
  parts.forEach((it) => Object.assign(it, fn(it)));
  const after = tgtText(parts[0]);
  if (before !== after) S.plan.hist.push({ d: dayKey(), text: `${exOf(ex).name} ${before} → ${after}${why ? `（${why}）` : ''}` });
  S.prog[ex] = { hit: 0, miss: 0 };
  save();
}

/* ---------- ガチャ ---------- */
function pull() {
  if (S.gems < COST || sleeping()) return null;
  S.gems -= COST; S.pulls++;
  let x = Math.random() * 100, rar = 'N';
  for (const [r, p] of RARITY) { if (x < p) { rar = r; break; } x -= p; }
  const pool = ITEMS.filter((i) => i.r === rar);
  let y = Math.random() * pool.reduce((a, i) => a + (i.w || 1), 0);
  const it = pool.find((i) => (y -= i.w || 1) < 0) || pool[0];
  const res = { it, note: '', isNew: false };
  if (it.kind === 'boost') { S.boost++; res.note = `次の筋トレの経験値が1.5倍（手持ち${S.boost}本）`; }
  else if (it.kind === 'egg') {
    if (S.mons.length < MAX_MONS) { S.mons.push(newMon(dayKey())); res.isNew = true; res.note = '「図鑑」の相棒から切りかえて育てられます'; }
    else { S.gems += 10; res.note = '相棒がいっぱいなので 💎10 に交換しました'; }
  } else if (S.items[it.id]) { S.gems += 2; res.note = 'もう持っているので 💎2 に交換しました'; }
  else { S.items[it.id] = dayKey(); res.isNew = true; res.note = '「図鑑」のコレクションで付けられます'; }
  save();
  return res;
}

/* ---------- リマインド通知（通知サーバーとのやりとり） ----------
   送るのは ランダムな番号（S.uid）・通知の宛先・知らせる時刻・曜日・時差・最後にやった日 だけ */
const PUSH_URL = 'https://kinmon-push.kinmon-push.workers.dev';
const VAPID_PUBLIC = 'BF2tvSpLtl9zHFW7PqjiPlBmvDRvuzgFbptTM9TdlFjBmZGMSBE4BznJLdDw3p6KBkunEdazc0kBe9l697EZUuk';
const b64uBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const tzMin = () => -new Date().getTimezoneOffset();
const pushReady = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const daysText = () => (S.plan ? WD_ORDER.filter((w) => S.plan.days.includes(w)).map((w) => WD[w]).join('・') : '毎日');
function lastDoneDay() {
  const tot = dayTotals();
  return Object.keys(tot).filter((k) => isDoneIn(tot, k)).sort().pop() || '';
}
async function pushPost(path, body) {
  const r = await fetch(PUSH_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: S.uid, ...body }) });
  if (!r.ok) throw new Error(`push ${path} ${r.status}`);
  return r.json();
}
async function pushOn() {
  if (!pushReady()) {
    toast(standalone() ? 'このiPhoneでは通知が使えません（iOS 16.4以降が必要）' : 'ホーム画面に追加した筋モンから開いて、もう一度押してください');
    return;
  }
  try {
    if ((await Notification.requestPermission()) !== 'granted') { toast('通知が許可されませんでした（iPhoneの設定→通知→筋モン で変えられます）'); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(VAPID_PUBLIC) }));
    await pushPost('/subscribe', { sub: sub.toJSON(), remind: S.settings.remind, tz: tzMin(), days: planDays(), lastDone: lastDoneDay() });
    S.push.on = true; S.push.sent = lastDoneDay(); save();
    toast(`${daysText()}の${S.settings.remind}に、まだなら知らせます`);
  } catch { toast('通知の準備に失敗しました。電波のよいところでもう一度'); }
  keepScroll(render);
}
async function pushOff() {
  try {
    await pushPost('/unsubscribe', {});
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch { /* サーバーに届かなくても、こちらは止める */ }
  S.push.on = false; save();
  toast('通知を止めました');
  keepScroll(render);
}
async function pushSettings() {
  if (!S.push.on) return true;
  try { await pushPost('/settings', { remind: S.settings.remind, tz: tzMin(), days: planDays() }); return true; } catch { return false; }
}
// 「今日やった」を通知サーバーに伝える（今日の通知を止めるため）
async function pushDone() {
  const d = dayKey();
  if (!S.push.on || S.push.sent === d || !isDoneIn(dayTotals(), d)) return;
  try { await pushPost('/done', { d }); S.push.sent = d; save(); } catch { /* 次に開いたときにまた送る */ }
}

/* ---------- 相棒のセリフ ---------- */
const pickOf = (arr) => arr[Math.floor(parseKey(dayKey()) / 864e5) % arr.length];
function serif(tot = dayTotals()) {
  const m = mon();
  if (m.stage === 0) return '（タマゴが小さくゆれている…。1回筋トレしたら、かえりそうだ）';
  if (sleeping(tot)) return '……zzz（スクワット5回で起きられる気がする）';
  const today = dayKey();
  if (isDoneIn(tot, today)) {
    const st = streak(tot);
    if (S.goal[today]) return pickOf(['目標達成だ。お前、やるじゃないか', '今日のメニュー、全部やりきったな！', 'この調子なら、もっと重くできるぞ']);
    if (st > 0 && st % 7 === 0) return `${st}回連続！お前、本物だな`;
    return pickOf(['今日はよくやった。また次な', '力がみなぎる…！', 'お前、だんだん本物になってきたな', 'いい汗だ。次もたのむぞ']);
  }
  if (S.plan && !isPlanned(today)) return pickOf(['今日は休みの日だ。しっかり休め', '休むのもトレーニングのうちだ', '休みの日だが、軽くやってもいいぞ']);
  const miss = missedList(tot).length;
  if (miss === 2) return 'このままだと寝込むぞ…スクワット5回でいい';
  if (miss === 1) return 'おい、この前サボったな。今日は待ってるぞ';
  if (m.stage < 4 && EVO_DAYS[m.stage] - m.days === 1) return '体が熱い…今日やったら何かが起きる気がする';
  if (!S.plan) return '筋トレタブで、まず目標をつくろうぜ';
  return pickOf(['今日はトレーニングの日だ。いくぞ', '腹へった…5回だけでもいいから頼む', 'おい、そろそろ時間だぞ', 'メニューはできてる。あとはやるだけだ']);
}

/* ---------- 音・声 ---------- */
let audioCtx = null;
// iPhoneでは、音を出す前に一度ボタン操作の中で準備しておく必要がある
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = S.settings.silentOk ? 'playback' : 'auto'; } catch { /* 未対応 */ }
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* 音が出せない環境 */ }
  try { if (window.speechSynthesis && !unlockAudio.done) { speechSynthesis.speak(new SpeechSynthesisUtterance('')); unlockAudio.done = true; } } catch { /* 読み上げが使えない環境 */ }
}
const TONES = {
  pop: [[880, 0, 0.09]],
  chime: [[988, 0, 0.14], [1319, 0.15, 0.26]],
  fanfare: [[784, 0, 0.12], [988, 0.13, 0.12], [1175, 0.26, 0.12], [1568, 0.4, 0.45]],
  coin: [[1319, 0, 0.07], [1976, 0.08, 0.2]],
  shake: [[330, 0, 0.06], [392, 0.12, 0.06], [330, 0.24, 0.06], [392, 0.36, 0.06], [440, 0.48, 0.06], [494, 0.6, 0.06]],
  rare: [[1568, 0, 0.08], [2093, 0.07, 0.08], [2637, 0.14, 0.1], [3136, 0.22, 0.3]],
  evolve: [[392, 0, 0.18], [523, 0.18, 0.18], [659, 0.36, 0.18], [784, 0.54, 0.18], [1047, 0.72, 0.5], [1319, 0.9, 0.12], [1568, 1.02, 0.6]],
};
function playTone(kind) {
  return new Promise((res) => {
    if (!audioCtx) { res(); return; }
    const t0 = audioCtx.currentTime + 0.02;
    let end = 0;
    for (const [f, at, dur] of TONES[kind]) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = kind === 'shake' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
      end = Math.max(end, at + dur);
    }
    setTimeout(res, (end + 0.05) * 1000);
  });
}
const RATE = { slow: 0.9, normal: 1.05, fast: 1.25 };
function jaVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return vs.find((v) => v.lang === 'ja-JP' && /Otoya|Kyoko|O-ren/.test(v.name)) || vs.find((v) => (v.lang || '').startsWith('ja'));
}
function say(text, interrupt = false) {
  if (!S.settings.voice || !text || !window.speechSynthesis) return;
  try {
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = RATE[S.settings.rate] || 1.05;
    const v = jaVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch { /* 読み上げ失敗は無視 */ }
}
function stopSpeech() { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch { /* なし */ } }

/* 画面が自動で消えないようにする（消えるとタイマーと声が止まるため） */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* 未対応・拒否 */ }
}

/* ---------- サーキット（回数で進める。休憩・有酸素・秒の種目はタイマー） ---------- */
function buildSteps(p, rounds) {
  const st = [];
  if (p.warm) st.push({ k: 'cardio', it: p.warm, tag: 'ウォームアップ' });
  for (let r = 0; r < rounds; r++) {
    p.items.forEach((it, i) => {
      st.push({ k: 'set', it, r, i });
      const lastItem = i === p.items.length - 1;
      if (lastItem && r === rounds - 1) return;
      const dur = lastItem ? p.rrest : p.rest;
      if (dur > 0) st.push({ k: 'rest', dur, r, round: lastItem });
    });
  }
  if (p.cool) st.push({ k: 'cardio', it: p.cool, tag: '仕上げ' });
  return st;
}
// 目安の時間（秒）。1回3秒＋準備15秒で見積もる
function planSec(p, rounds = p.rounds) {
  return buildSteps(p, rounds).reduce((a, s) => {
    if (s.k === 'rest') return a + s.dur;
    if (s.k === 'cardio') return a + s.it.n * 60;
    const e = exOf(s.it.ex);
    return a + (e.kind === 'sec' ? s.it.n + 10 : s.it.n * 3 + 15);
  }, 0);
}
const minText = (sec) => `約${Math.max(1, Math.round(sec / 60))}分`;
let SES = null;
const sesStep = () => SES.steps[SES.idx];
const timed = (s) => s.k === 'rest' || s.k === 'cardio' || exOf(s.it.ex).kind === 'sec';
const stepDur = (s) => (s.k === 'rest' ? s.dur : s.k === 'cardio' ? s.it.n * 60 : exOf(s.it.ex).kind === 'sec' ? s.it.n : 0);
const nextWork = (from) => SES.steps.slice(from + 1).find((s) => s.k !== 'rest');
const sayItem = (it) => { const e = exOf(it.ex); return `${e.name}、${e.kind === 'machine' ? `${r1(it.w)}キロ、${it.n}回` : `${it.n}${e.kind === 'sec' ? '秒' : e.kind === 'cardio' ? '分' : '回'}`}`; };
function startSession(light) {
  unlockAudio();
  const p = light ? { ...S.plan, warm: null, cool: null } : S.plan;
  const rounds = light ? 1 : S.plan.rounds;
  SES = { steps: buildSteps(p, rounds), idx: 0, res: [], light, rounds, state: 'idle', endAt: 0, left: 0, last: -1, timer: null };
  keepAwake(true);
  go('ses');
  enterStep();
}
function enterStep() {
  clearInterval(SES.timer);
  const s = sesStep();
  if (!s) { finishSession(); return; }
  Object.assign(SES, { state: 'idle', left: stepDur(s), last: -1 });
  let text;
  if (s.k === 'rest') { const nx = nextWork(SES.idx); text = `${s.round ? `${s.r + 1}周目おわり。` : ''}休憩。つぎは、${nx ? exOf(nx.it.ex).name : ''}`; }
  else if (s.k === 'cardio') text = `${s.tag}。${sayItem(s.it)}`;
  else text = sayItem(s.it);
  playTone('chime').then(() => say(text, true));
  if (s.k === 'rest') runTimer();
  if (view === 'ses') render();
}
const sesLeft = () => (SES.state === 'run' ? Math.max(0, (SES.endAt - Date.now()) / 1000) : SES.left);
function runTimer() {
  SES.state = 'run';
  SES.endAt = Date.now() + SES.left * 1000;
  clearInterval(SES.timer);
  SES.timer = setInterval(sesTick, 250);
  updSes();
}
function pauseSes() {
  SES.left = sesLeft();
  SES.state = 'pause';
  clearInterval(SES.timer);
  updSes();
}
function sesTick() {
  if (!SES || SES.state !== 'run') return;
  const s = sesStep();
  const left = sesLeft();
  const sec = Math.ceil(left);
  if (sec !== SES.last) {
    SES.last = sec;
    if (sec >= 1 && sec <= 3 && S.settings.beep) playTone('pop');
    if (sec === 10 && s.k !== 'rest' && stepDur(s) >= 30 && S.settings.tenSec) say('あと10秒');
  }
  if (left <= 0) {
    clearInterval(SES.timer);
    if (s.k === 'rest') nextStep(); else recordStep(s.it.n);
    return;
  }
  updSes();
}
function recordStep(n, w) {
  const s = sesStep();
  SES.res.push({ si: SES.idx, ex: s.it.ex, n, w: w ?? s.it.w, skip: false });
  nextStep();
}
function skipStep() {
  const s = sesStep();
  if (s.k !== 'rest') SES.res.push({ si: SES.idx, ex: s.it.ex, n: 0, skip: true });
  nextStep();
}
function nextStep() { clearInterval(SES.timer); SES.idx++; enterStep(); }
// タイマーの種目の「できた」：タイマーを使っていなければ目標どおり、途中なら使った分
function doneTimed() {
  const s = sesStep();
  if (SES.state === 'idle') { recordStep(s.it.n); return; }
  const used = stepDur(s) - sesLeft();
  const n = s.k === 'cardio' ? Math.floor(used / 60) : Math.round(used);
  if (n > 0) recordStep(n); else skipStep();
}
function finishSession() {
  clearInterval(SES.timer);
  keepAwake(false);
  const at = Date.now(), d = dayKey();
  const entries = SES.res.filter((r) => !r.skip && r.n > 0).map((r) => {
    const e = exOf(r.ex);
    return { at, d, ex: r.ex, n: r.n, ...(e.kind === 'machine' ? { w: r.w } : {}), pt: ptOf(e, r.n), src: 'circuit' };
  });
  // 目標達成：軽めでなく、全部の種目を目標の回数・重さ以上でやった
  const okRes = (s, r) => r && !r.skip && r.n >= s.it.n && (exOf(s.it.ex).kind !== 'machine' || r.w >= s.it.w);
  const resOf = (i) => SES.res.find((x) => x.si === i);
  const goal = !SES.light && SES.steps.every((s, i) => s.k === 'rest' || okRes(s, resOf(i)));
  // 種目ごとに、目標どおりだったかを数えて負荷アップ・ダウンを判断
  const groups = {};
  SES.steps.forEach((s, i) => { if (s.k !== 'rest') (groups[s.it.ex] ||= []).push({ s, r: resOf(i) }); });
  const sugg = [];
  for (const [ex, arr] of Object.entries(groups)) {
    if (!arr.some((a) => a.r && !a.r.skip)) continue;
    const pg = S.prog[ex] ||= { hit: 0, miss: 0 };
    if (arr.every((a) => okRes(a.s, a.r))) { pg.hit++; pg.miss = 0; } else { pg.miss++; pg.hit = 0; }
    if (pg.hit >= HIT_UP) sugg.push({ ex, dir: 1 });
    else if (pg.miss >= MISS_DOWN) sugg.push({ ex, dir: -1 });
  }
  SES = null;
  if (!entries.length) { save(); go('log'); toast('記録はありませんでした'); return; }
  const r = addEntries(entries, { goal });
  r.sugg = sugg;
  playTone('fanfare').then(() => say(goal ? '目標達成。おつかれ' : 'おつかれ', true));
  go('log');
  showResult(r);
  pushDone();
}

/* ---------- アイコン ---------- */
const IC = {
  home: '<svg viewBox="0 0 24 24"><path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24"><path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/></svg>',
  capsule: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="5"/><path d="M7 12h10"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  play: '<svg viewBox="0 0 24 24" class="fill"><path d="M8.5 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.7 4.5a.8.8 0 0 0-1.2.7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" class="fill"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
};

/* ---------- 画面 ---------- */
let view = 'home'; // home | log | free | plan | ses | gacha | zukan | settings
let draft = {}; // 自由に記録で入力中の回数
let draftP = null; // 編集中の目標
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function render() {
  const main = $('#main');
  main.className = `v-${view}`;
  main.innerHTML = { home: homeHTML, log: logHTML, free: freeHTML, plan: planHTML, ses: sesHTML, gacha: gachaHTML, zukan: zukanHTML, settings: settingsHTML }[view]();
  main.scrollTop = 0;
  if (view === 'ses') updSes();
  const tab = ['free', 'plan', 'ses'].includes(view) ? 'log' : view === 'settings' ? 'home' : view;
  $('#tabs').hidden = view === 'ses';
  $('#tabs').innerHTML = [['home', 'ホーム', 'home'], ['log', '筋トレ', 'dumbbell'], ['gacha', 'ガチャ', 'capsule'], ['zukan', '図鑑', 'book']]
    .map(([v, label, ic]) => `<button type="button" data-act="tab" data-v="${v}" class="${tab === v ? 'on' : ''}"><span class="ic">${IC[ic]}</span>${label}</button>`).join('');
}
function go(v) { view = v; render(); }

// 相棒の舞台（背景・オーラ・寝込み）
function stageHTML(m, cls = '') {
  const e = S.equip;
  const fx = e.fx ? `<div class="fx fx-${e.fx}">${e.fx === 'fx_fire' ? '' : Array.from({ length: 6 }, (_, i) => `<i style="--i:${i}">${e.fx === 'fx_thunder' ? '⚡' : '✦'}</i>`).join('')}</div>` : '';
  const zz = cls.includes('sleep') ? '<div class="zzz"><i>Z</i><i>z</i><i>z</i></div>' : '';
  return `<div class="stage bg-${e.bg || 'default'} ${cls}">${fx}<div class="mon">${monSVG(m.form, e.skin)}</div>${zz}</div>`;
}
const statsHTML = (m) => `<div class="stats">${Object.entries(LINES).map(([k, l]) => `<div style="--c:${l.color}"><small>${l.stat}</small><b>${m.stats[k]}</b></div>`).join('')}</div>`;
// 今週の7マス（月〜日）
function weekRowHTML(tot) {
  return `<div class="week">${weekDates().map((d) => {
    const mk = dayMark(d, tot);
    return `<button type="button" class="wk m-${mk} ${d === dayKey() ? 'today' : ''}" data-act="dayInfo" data-d="${d}"><small>${WD[parseKey(d).getDay()]}</small><b>${MARK[mk] || parseKey(d).getDate()}</b></button>`;
  }).join('')}</div>`;
}

/* ホーム */
function homeHTML() {
  const tot = dayTotals();
  const m = mon();
  const f = FORMS[m.form];
  const en = energy(tot);
  const sl = sleeping(tot);
  const today = dayKey();
  const evoLeft = m.stage < 4 ? EVO_DAYS[m.stage] - m.days : 0;
  const dayLine = !S.plan ? '' : isDoneIn(tot, today) ? (S.goal[today] ? '🎯 今日は目標達成！' : '✓ 今日はやった日') : isPlanned(today) ? '💪 今日はトレーニングの日' : '😴 今日は休みの日';
  return `<div class="page home">
    <header class="h-top">
      <span class="chip-st">🔥 連続 <b>${streak(tot)}</b>回</span>
      <span class="chip-st" title="お休み札">🧊×${S.freeze}</span>
      <span class="chip-st">💎 <b>${S.gems}</b></span>
      <button type="button" class="icbtn" data-act="settings" aria-label="設定"><span class="ic">${IC.gear}</span></button>
    </header>
    ${stageHTML(m, sl ? 'sleep' : '')}
    <div class="m-name"><b>${esc(f.name)}</b><span>${STAGE_NAMES[m.stage]}${m.stage ? ` ・ Lv.${lvOf(m.exp)}` : ''}</span></div>
    ${S.equip.title ? `<div class="m-title">🏅 ${esc(ITEMS.find((i) => i.id === S.equip.title).name)}</div>` : ''}
    <div class="gauge ${en <= 30 ? 'low' : ''}"><span>元気</span><div class="bar"><i style="width:${en}%"></i></div><b>${sl ? '寝込み中' : en}</b></div>
    ${m.stage ? statsHTML(m) : ''}
    <div class="say">${esc(serif(tot))}</div>
    <button type="button" class="big" data-act="tab" data-v="log">${sl ? '起こしてやる' : '筋トレする'}</button>
    ${dayLine ? `<div class="today">${dayLine}${S.plan ? ` ・ 今週 <b>${weekDone(tot)}</b> / ${S.plan.days.length}回` : ''}</div>` : ''}
    ${weekRowHTML(tot)}
    <p class="days-cap">今週（◎ 目標達成 ● やった日 × 休んだ予定日 ○ 予定 🧊 お休み札）</p>
    <div class="evo-next">${m.stage < 4 ? `${m.stage === 0 ? 'タマゴがかえる' : '進化'}まで あと <b>${evoLeft}</b> 日（やった日の合計）` : '完全体！ 最後の姿です'}${S.boost ? ` ・ 🥤×${S.boost}` : ''}</div>
  </div>`;
}

/* 筋トレ（今日のメニュー＋カレンダー） */
function logHTML() {
  const tot = dayTotals();
  const today = dayKey();
  if (!S.plan) {
    return `<div class="page log">
      <h1 class="p-title">筋トレ</h1>
      <div class="card intro"><b>まず目標をつくろう</b><p>やる曜日と、1回のメニュー（何を何回）を決めます。あとからいつでも変えられます。</p>
        <button type="button" class="big" data-act="planEdit">目標をつくる</button></div>
      <button type="button" class="big ghost" data-act="tab" data-v="free">自由に記録（ずぼらな日）</button>
      ${calendarHTML(tot)}
    </div>`;
  }
  const p = S.plan;
  const done = isDoneIn(tot, today);
  const head = S.goal[today] ? '🎯 今日は目標達成！' : isPlanned(today) ? '今日はトレーニングの日' : '今日は休みの日（やってもOK）';
  return `<div class="page log">
    <h1 class="p-title">${head}</h1>
    <div class="sub-line">今週 <b>${weekDone(tot)}</b> / ${p.days.length}回 ・ ${daysText()} ・ 🔥連続 ${streak(tot)}回</div>
    <div class="card plan-sum">
      ${p.warm ? `<div class="ps-row"><span>${exOf(p.warm.ex).ic || ''} ${esc(exOf(p.warm.ex).name)} <small>ウォームアップ</small></span><b>${p.warm.n}分</b></div>` : ''}
      <div class="ps-row ps-circ"><span>サーキット <small>${p.items.length}種目 × ${p.rounds}周</small></span><b></b></div>
      ${p.items.map((it) => `<div class="ps-item" style="--c:${LINES[exOf(it.ex).line].color}"><span>${esc(exOf(it.ex).name)}</span><b>${tgtText(it)}</b></div>`).join('')}
      ${p.cool ? `<div class="ps-row"><span>${exOf(p.cool.ex).ic || ''} ${esc(exOf(p.cool.ex).name)} <small>仕上げ</small></span><b>${p.cool.n}分</b></div>` : ''}
    </div>
    <button type="button" class="big" data-act="sesStart" ${p.items.length ? '' : 'disabled'}>${done ? 'もう一度やる' : 'スタート'}（${minText(planSec(p))}）</button>
    <div class="btn-row">
      <button type="button" class="big ghost" data-act="sesLight" ${p.items.length ? '' : 'disabled'}>軽めに（1周だけ）</button>
      <button type="button" class="big ghost" data-act="planEdit"><span class="ic">${IC.pencil}</span>目標を編集</button>
    </div>
    <button type="button" class="big ghost" data-act="tab" data-v="free">自由に記録（ずぼらな日）</button>
    ${calendarHTML(tot)}
    ${p.hist.length ? `<h2 class="sec-title">メニューの変化</h2><div class="card rows">${p.hist.slice(-8).reverse().map((h) => `<div class="row"><span>${esc(h.text)}</span><small>${h.d.slice(5).replace('-', '/')}</small></div>`).join('')}</div>` : ''}
  </div>`;
}
// 月のカレンダー
function calendarHTML(tot) {
  const y = calMonth.getFullYear(), mo = calMonth.getMonth();
  const first = new Date(y, mo, 1);
  const lead = (first.getDay() + 6) % 7;
  const n = new Date(y, mo + 1, 0).getDate();
  const keys = Array.from({ length: n }, (_, i) => dayKey(new Date(y, mo, i + 1)));
  const today = dayKey();
  const doneN = keys.filter((d) => isDoneIn(tot, d)).length;
  const goalN = keys.filter((d) => S.goal[d]).length;
  const planned = keys.filter((d) => S.plan && d >= S.planFrom && d <= today && isPlanned(d) && !(d === today && !isDoneIn(tot, d)));
  const rate = planned.length ? Math.round((planned.filter((d) => isDoneIn(tot, d) || S.frozen.includes(d)).length / planned.length) * 100) : null;
  return `<h2 class="sec-title">カレンダー</h2>
    <div class="card cal">
      <div class="cal-head"><button type="button" class="icbtn" data-act="calMove" data-d="-1" aria-label="前の月"><span class="ic">${IC.back}</span></button>
        <b>${y}年${mo + 1}月</b>
        <button type="button" class="icbtn" data-act="calMove" data-d="1" aria-label="次の月"><span class="ic">${IC.chev}</span></button></div>
      <div class="cal-grid">${WD_ORDER.map((w) => `<i class="cal-wd">${WD[w]}</i>`).join('')}${'<i></i>'.repeat(lead)}${keys.map((d, i) => {
        const mk = dayMark(d, tot);
        return `<button type="button" class="cal-d m-${mk} ${d === today ? 'today' : ''}" data-act="dayInfo" data-d="${d}"><span>${i + 1}</span><em>${MARK[mk]}</em></button>`;
      }).join('')}</div>
      <div class="cal-sum">やった日 <b>${doneN}</b>日 ・ 目標達成 <b>${goalN}</b>回${rate == null ? '' : ` ・ 予定の達成 <b>${rate}</b>%`}</div>
      <div class="cal-legend">◎ 目標達成 ● やった日 × 休んだ予定日 ○ これからの予定 🧊 お休み札</div>
    </div>`;
}

/* 自由に記録（ずぼらな日） */
function freeHTML() {
  const tot = dayTotals();
  const today = tot[dayKey()] || 0;
  const list = FREE.map(exOf);
  const pts = list.reduce((a, e) => a + ptOf(e, draft[e.id] || 0), 0);
  const room = Math.max(0, CAP - today);
  return `<div class="page log">
    <header class="e-head"><button type="button" class="txtbtn" data-act="tab" data-v="log"><span class="ic">${IC.back}</span>もどる</button><h1>自由に記録</h1><span></span></header>
    <p class="hint">メニューどおりにできない日や、予定外の日に。5pt（腕立て5回）でも「やった日」になります。</p>
    <div class="ex-list">${list.map((e) => {
      const n = draft[e.id] || 0;
      const st = stepsOf(e);
      return `<div class="ex" style="--c:${LINES[e.line].color}">
        <div class="ex-name"><b>${e.name}</b><small>${LINES[e.line].stat}アップ${e.per ? ` ・ 1回${e.per}pt` : e.kind === 'sec' ? ' ・ 10秒1pt' : e.kind === 'cardio' ? ' ・ 1分1pt' : ''}</small></div>
        <div class="ex-n"><b>${n}</b>${unitOf(e)}</div>
        <div class="ex-btns">
          <button type="button" class="sbtn" data-act="cnt" data-ex="${e.id}" data-d="-${st[0]}" ${n ? '' : 'disabled'}>−</button>
          ${st.map((s) => `<button type="button" class="sbtn add" data-act="cnt" data-ex="${e.id}" data-d="${s}">＋${s}</button>`).join('')}
        </div>
      </div>`;
    }).join('')}</div>
    <div class="sum-line">今回 <b>${pts}</b> pt ${today + pts >= DONE_PT ? (today < DONE_PT && pts ? '<span class="ok">→ やった日 達成！</span>' : '') : `<small>（あと${DONE_PT - today - pts}ptで「やった日」）</small>`}
      ${pts > room ? `<br><small class="warn">1日の上限は${CAP}ptです（今日はあと${room}ptまで）</small>` : ''}</div>
    <button type="button" class="big" data-act="commit" ${pts ? '' : 'disabled'}>終わった！</button>
  </div>`;
}

/* 目標づくり・編集 */
function planHTML() {
  const p = draftP;
  const cardioRow = (key, label) => {
    const c = p[key];
    return `<button type="button" class="prow" data-act="pCardio" data-k="${key}"><span><small>${label}</small><b>${c ? `${exOf(c.ex).ic || ''} ${esc(exOf(c.ex).name)}` : 'なし'}</b></span><b>${c ? `${c.n}分` : ''}</b><span class="ic chev">${IC.chev}</span></button>`;
  };
  const num = (key, label, unit) => `<button type="button" class="prow" data-act="pNum" data-k="${key}"><span><b>${label}</b></span><b>${p[key]}${unit}</b><span class="ic chev">${IC.chev}</span></button>`;
  return `<div class="page plan">
    <header class="e-head"><button type="button" class="txtbtn" data-act="planCancel"><span class="ic">${IC.back}</span>やめる</button><h1>${S.plan ? '目標を編集' : '目標をつくる'}</h1><button type="button" class="txtbtn strong" data-act="planSave">保存</button></header>
    <h2 class="sec-title">やる曜日</h2>
    <div class="pdays">${WD_ORDER.map((w) => `<button type="button" class="pday ${p.days.includes(w) ? 'on' : ''}" data-act="pDay" data-w="${w}">${WD[w]}</button>`).join('')}</div>
    <p class="hint">選んだ曜日だけ通知が来ます。休みの曜日は元気が減りません。今は週${p.days.length}回。</p>
    <h2 class="sec-title">ウォームアップ</h2>
    <div class="card rows">${cardioRow('warm', 'はじめに')}</div>
    <h2 class="sec-title">サーキット</h2>
    <div class="card rows">
      ${p.items.map((it, i) => {
        const e = exOf(it.ex);
        return `<div class="prow pitem" style="--c:${LINES[e.line].color}">
          <button type="button" class="pi-main" data-act="pItem" data-i="${i}"><span><small>${KINDS[e.kind]}</small><b>${esc(e.name)}</b></span><b>${tgtText(it)}</b></button>
          <span class="pi-btns">
            <button type="button" class="mini" data-act="pUp" data-i="${i}" ${i ? '' : 'disabled'} aria-label="上へ"><span class="ic">${IC.up}</span></button>
            <button type="button" class="mini" data-act="pDown" data-i="${i}" ${i < p.items.length - 1 ? '' : 'disabled'} aria-label="下へ"><span class="ic">${IC.down}</span></button>
            <button type="button" class="mini" data-act="pDel" data-i="${i}" aria-label="けす"><span class="ic">${IC.x}</span></button>
          </span>
        </div>`;
      }).join('')}
      <button type="button" class="prow add" data-act="pAdd"><b>＋ 種目を追加</b></button>
    </div>
    <div class="card rows">
      ${num('rounds', '周回数', '周')}
      ${num('rest', '種目の間の休憩', '秒')}
      ${num('rrest', '周の間の休憩', '秒')}
    </div>
    <h2 class="sec-title">仕上げ</h2>
    <div class="card rows">${cardioRow('cool', 'さいごに')}</div>
    <div class="est">目安 <b>${minText(planSec(p))}</b>（1回3秒で計算）</div>
    <button type="button" class="big" data-act="planSave">保存</button>
  </div>`;
}

/* サーキット中 */
function sesHTML() {
  if (!SES) return '';
  const s = sesStep();
  if (!s) return '';
  const nItems = SES.steps.filter((x) => x.k === 'set' && x.r === 0).length;
  const label = s.k === 'set' ? `${s.r + 1}周目 ・ ${s.i + 1} / ${nItems}種目` : s.k === 'cardio' ? s.tag : s.round ? `${s.r + 1}周目おわり` : '休憩';
  const nx = nextWork(SES.idx);
  const nextLine = nx ? `<div class="s-next">つぎ：${esc(exOf(nx.it.ex).name)} <b>${nx.k === 'cardio' ? `${nx.it.n}分` : tgtText(nx.it)}</b></div>` : '<div class="s-next">これで最後！</div>';
  const head = `<header class="s-head"><button type="button" class="txtbtn" data-act="sesQuit"><span class="ic">${IC.x}</span>やめる</button><span>${label}</span><span class="s-prog">${SES.idx + 1}/${SES.steps.length}</span></header>
    <div class="s-all"><i style="width:${(SES.idx / SES.steps.length) * 100}%"></i></div>`;
  if (s.k === 'rest') {
    return `<div class="page ses">${head}
      <div class="s-card k-rest"><div class="s-label">${s.round ? '周の間の休憩' : '休憩'}</div><div class="s-time"></div><div class="s-bar"><i></i></div></div>
      ${nextLine}
      <div class="btn-row"><button type="button" class="big ghost" data-act="sesAdd15">＋15秒</button><button type="button" class="big ghost" data-act="sesSkip">休憩をとばす</button></div>
    </div>`;
  }
  const e = exOf(s.it.ex);
  if (timed(s)) {
    return `<div class="page ses">${head}
      <div class="s-card k-${s.k === 'cardio' ? 'cardio' : 'set'}"><div class="s-label">${s.k === 'cardio' ? esc(s.tag) : KINDS[e.kind]}</div>
        <div class="s-name">${e.ic || ''} ${esc(e.name)}</div><div class="s-tgt">${s.k === 'cardio' ? `${s.it.n}分` : `${s.it.n}秒`}</div>
        <div class="s-time"></div><div class="s-bar"><i></i></div></div>
      <button type="button" class="big" data-act="sesTimer"></button>
      <div class="btn-row"><button type="button" class="big ghost" data-act="sesDoneTimed">できた！</button><button type="button" class="big ghost" data-act="sesSkip">とばす</button></div>
      <p class="hint center">${s.k === 'cardio' ? 'マシンの表示で測るなら、終わってから「できた！」だけでOK' : 'スタートで数えはじめます'}</p>
      ${nextLine}
    </div>`;
  }
  return `<div class="page ses">${head}
    <div class="s-card k-set"><div class="s-label">${KINDS[e.kind]}</div><div class="s-name">${esc(e.name)}</div><div class="s-tgt big-t">${tgtText(s.it)}</div></div>
    <button type="button" class="big" data-act="sesDone">できた！</button>
    <div class="btn-row"><button type="button" class="big ghost" data-act="sesChange">${e.kind === 'machine' ? '回数・重さを変えて記録' : '回数を変えて記録'}</button><button type="button" class="big ghost" data-act="sesSkip">とばす</button></div>
    ${nextLine}
  </div>`;
}
function updSes() {
  if (view !== 'ses' || !SES) return;
  const s = sesStep();
  if (!s) return;
  const left = sesLeft();
  const dur = stepDur(s);
  const t = $('.s-time');
  if (t) t.textContent = mmss(left);
  const bar = $('.s-bar i');
  if (bar && dur) bar.style.width = `${Math.min(100, (1 - left / dur) * 100)}%`;
  const b = $('[data-act="sesTimer"]');
  if (b) b.textContent = { idle: 'スタート', run: '一時停止', pause: 'つづける' }[SES.state] || 'スタート';
}

/* ガチャ */
function gachaHTML() {
  const sl = sleeping();
  const can = S.gems >= COST && !sl;
  const owned = Object.keys(S.items).length;
  const collectable = ITEMS.filter((i) => !['boost', 'egg'].includes(i.kind)).length;
  return `<div class="page gacha">
    <h1 class="p-title">ガチャ</h1>
    <div class="g-gems">💎 <b>${S.gems}</b><small>／ 1回 ${COST}</small></div>
    <div class="g-machine">${capsuleSVG('idle')}</div>
    ${sl ? '<div class="banner warn">相棒が寝込んでいるので引けません。筋トレして起こしてやろう</div>' : ''}
    <button type="button" class="big" data-act="pull" ${can ? '' : 'disabled'}>ガチャを引く（💎${COST}）</button>
    ${!sl && S.gems < COST ? `<p class="hint center">あと💎${COST - S.gems}。ガチャ石は筋トレでしか手に入りません</p>` : ''}
    <h2 class="sec-title">ガチャ石のもらい方</h2>
    <div class="card rows">
      <div class="row"><span>やった日</span><b>＋3</b></div>
      <div class="row"><span>目標達成（メニューを全部）</span><b>＋5</b></div>
      <div class="row"><span>週の目標達成（予定の回数）</span><b>＋10</b></div>
      <div class="row"><span>10ptごと（1日10個まで）</span><b>＋1</b></div>
      <div class="row"><span>7回連続ごと</span><b>＋5</b></div>
      <div class="row"><span>進化したとき</span><b>＋10</b></div>
      <div class="row"><span>3回以上休んで戻ってきた（おかえり）</span><b>＋3</b></div>
    </div>
    <h2 class="sec-title">出るものと確率</h2>
    <div class="card rows">${RARITY.map(([r, p]) => `<div class="row rar-${r}"><span><b class="rar">${r}</b> ${p}%</span><small>${ITEMS.filter((i) => i.r === r).map((i) => i.name).join('・')}</small></div>`).join('')}</div>
    <p class="hint">コレクション ${owned} / ${collectable}。同じものが出たら💎に交換されます。</p>
  </div>`;
}
const CAP_COL = { idle: ['#ff8a3d', '#ffd24d'], N: ['#8fa3c7', '#d5def0'], R: ['#7c5cff', '#4fc3f7'], SR: ['#f5c542', '#fff1b8'] };
function capsuleSVG(r, open = false) {
  const [a, b] = CAP_COL[r];
  return `<svg viewBox="0 0 120 140" class="capsule ${open ? 'open' : ''}" aria-hidden="true">
    <g stroke="#1c1f2b" stroke-width="4" stroke-linejoin="round">
      <path d="M24 70 V54 A36 36 0 0 1 96 54 V70Z" fill="${a}" fill-opacity=".85"/>
      <path d="M24 70 V86 A36 36 0 0 0 96 86 V70Z" fill="${b}"/>
      <rect x="19" y="63" width="82" height="14" rx="5" fill="#eef1f7"/>
    </g>
    <path d="M38 40 Q46 28 60 26" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".55"/>
  </svg>`;
}

/* 図鑑 */
function zukanHTML() {
  const tot = dayTotals();
  const exSum = {}, exMax = {};
  S.log.forEach((l) => { exSum[l.ex] = (exSum[l.ex] || 0) + l.n; if (l.w) exMax[l.ex] = Math.max(exMax[l.ex] || 0, l.w); });
  const doneN = Object.keys(tot).filter((d) => isDoneIn(tot, d)).length;
  const kinds = ['bg', 'fx', 'title', 'skin'];
  return `<div class="page zukan">
    <h1 class="p-title">図鑑</h1>
    <h2 class="sec-title">相棒（${S.mons.length} / ${MAX_MONS}）</h2>
    <div class="mons">${S.mons.map((m, i) => `<button type="button" class="mon-card ${i === S.active ? 'on' : ''}" data-act="pickMon" data-i="${i}">
      ${monSVG(m.form, S.equip.skin)}<b>${esc(FORMS[m.form].name)}</b><small>${STAGE_NAMES[m.stage]}${m.stage ? ` Lv.${lvOf(m.exp)}` : ''}</small>${i === S.active ? '<em>育成中</em>' : ''}</button>`).join('')}</div>
    <h2 class="sec-title">モンスター図鑑（${Object.keys(S.seen).length} / ${Object.keys(FORMS).length}）</h2>
    <div class="forms">${Object.entries(FORMS).map(([k, f]) => {
      const seen = S.seen[k];
      return `<button type="button" class="form ${seen ? '' : 'unknown'}" data-act="formInfo" data-k="${k}">${monSVG(k)}<small>${seen ? esc(f.name) : f.hidden ? '？？？（隠し）' : '？？？'}</small></button>`;
    }).join('')}</div>
    <p class="hint">進化先は、前の進化からいちばん多く鍛えた系統で決まります（押す・腕→パワー、脚→タフ、背中・お腹→ガード、全身・有酸素→スピード）。</p>
    <h2 class="sec-title">コレクション</h2>
    ${kinds.map((kd) => {
      const list = ITEMS.filter((i) => i.kind === kd);
      return `<h3 class="sub-title">${KIND_NAME[kd]}</h3><div class="items">${list.map((it) => {
        const has = S.items[it.id];
        const on = S.equip[kd] === it.id;
        return `<button type="button" class="item ${has ? '' : 'none'} ${on ? 'on' : ''}" data-act="equip" data-id="${it.id}" ${has ? '' : 'disabled'}>
          <span class="it-ic">${has ? itemIcon(it) : '？'}</span><small>${has ? esc(it.name) : '未入手'}</small>${on ? '<em>使用中</em>' : ''}</button>`;
      }).join('')}</div>`;
    }).join('')}
    <h2 class="sec-title">これまでの記録</h2>
    <div class="card rows">
      <div class="row"><span>やった日の合計</span><b>${doneN}日</b></div>
      <div class="row"><span>目標達成</span><b>${Object.keys(S.goal).length}回</b></div>
      ${Object.keys(exSum).map((id) => { const e = exOf(id); return `<div class="row"><span>${esc(e.name)}</span><b>${exSum[id]}${unitOf(e)}${exMax[id] ? ` ・ 最高${r1(exMax[id])}kg` : ''}</b></div>`; }).join('')}
      <div class="row"><span>ガチャを引いた回数</span><b>${S.pulls}回</b></div>
    </div>
  </div>`;
}

/* 設定 */
function settingsHTML() {
  const st = S.settings;
  const tg = (key, label, sub = '') => `<label class="row tg"><span class="r-main"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    <input type="checkbox" data-set="${key}" ${st[key] ? 'checked' : ''}><i class="sw"></i></label>`;
  return `<div class="page settings">
    <header class="e-head"><button type="button" class="txtbtn" data-act="tab" data-v="home"><span class="ic">${IC.back}</span>もどる</button><h1>設定</h1><span></span></header>
    <h2 class="sec-title">リマインド</h2>
    <div class="rows card">
      ${S.push.on
        ? `<button type="button" class="row" data-act="pushOff"><span class="r-main"><b>🔔 通知オン</b><small>${daysText()}、その日まだならこの時刻と2時間後に知らせます。押すと止めます</small></span><span class="ic chev">${IC.chev}</span></button>`
        : `<button type="button" class="row" data-act="pushOn"><span class="r-main"><b>通知を受け取る</b><small>${standalone() ? '押すと「通知を許可」の確認が出ます' : 'iPhoneでは、ホーム画面に追加した筋モンから開いて押してください'}</small></span><span class="ic chev">${IC.chev}</span></button>`}
      <label class="row"><span class="r-main"><b>知らせる時刻</b><small>相棒が「やってないぞ」と知らせます</small></span><input type="time" id="remind" value="${esc(st.remind)}"></label>
      ${S.push.on ? `<button type="button" class="row" data-act="pushTest"><span class="r-main"><b>テスト通知を送る</b><small>数秒で届けば準備OK</small></span><span class="ic chev">${IC.chev}</span></button>` : ''}
    </div>
    <p class="hint">通知のために、ランダムな番号・通知の宛先・時刻・曜日・最後にやった日だけを通知サーバーに送ります。回数やモンスターのデータは送りません。</p>
    <h2 class="sec-title">サーキットの音と声</h2>
    <div class="rows card">
      ${tg('voice', '声の案内', '「チェストプレス、20キロ、12回」「休憩。つぎは〜」')}
      ${tg('tenSec', '「あと10秒」の声', '有酸素・プランクのとき')}
      ${tg('beep', 'のこり3秒のピッ')}
      ${tg('silentOk', 'マナーモードでも音を出す', 'iPhoneの消音スイッチがオンでも鳴らします')}
      <div class="row"><span class="r-main"><b>声の速さ</b></span>
        <div class="seg">${[['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやめ']].map(([v, l]) => `<button type="button" data-act="rate" data-v="${v}" class="${st.rate === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
    </div>
    <h2 class="sec-title">データ</h2>
    <div class="rows card">
      <button type="button" class="row" data-act="backup"><span class="r-main"><b>バックアップを書き出す</b><small>機種変更のときなどに。ファイルに保存します</small></span><span class="ic chev">${IC.chev}</span></button>
      <label class="row"><span class="r-main"><b>バックアップから戻す</b><small>書き出したファイルを読み込みます</small></span><input type="file" accept=".json,application/json" id="restore" hidden><span class="ic chev">${IC.chev}</span></label>
    </div>
    <p class="about">筋モン（仮） v${VERSION}<br>記録はこのiPhoneの中にだけ保存されます。</p>
  </div>`;
}

/* ---------- ダイアログ ---------- */
function ask(html, cls, bind) {
  return new Promise((res) => {
    const d = $('#dlg');
    if (d.open) d.close();
    d.className = cls;
    d.innerHTML = html;
    d.showModal();
    let fin = false;
    const finish = (v) => { if (fin) return; fin = true; d.removeEventListener('close', onClose); if (d.open) d.close(); res(v); };
    // 前のダイアログを閉じた合図は少し遅れて届くので、開いている間に来た合図は無視する
    const onClose = () => { if (!d.open) finish(null); };
    d.addEventListener('close', onClose);
    d.onclick = (e) => { if (e.target === d && cls === 'sheet') finish(null); };
    bind(d, finish);
  });
}
const confirmBox = (msg, ok = 'はい', danger = false) => ask(
  `<p class="dlg-msg">${esc(msg)}</p><div class="dlg-btns"><button type="button" class="btn ghost" data-v="0">やめる</button><button type="button" class="btn ${danger ? 'danger' : ''}" data-v="1">${esc(ok)}</button></div>`,
  'center', (d, fin) => { $$('[data-v]', d).forEach((b) => { b.onclick = () => fin(b.dataset.v === '1'); }); },
).then((v) => !!v);
/* 数字を選ぶシート。fields：{ key, label, value, min, max, step, unit, chips } または 選ぶだけの { key, label, value, choices:[[値, 表示]] }
   stepFrom：ほかの欄の値を刻みに使う（マシンの重さの刻み） */
function numSheet(title, fields, { sub = '', toggle = null } = {}) {
  const v = Object.fromEntries(fields.map((f) => [f.key, f.value]));
  const fmt = (f) => (f.choices ? '' : `${r1(v[f.key])}${f.unit || ''}`);
  const show = (d) => {
    fields.forEach((f) => {
      if (f.choices) $$(`[data-c="${f.key}"]`, d).forEach((c) => c.classList.toggle('on', String(v[f.key]) === c.dataset.v));
      else {
        $(`[data-o="${f.key}"]`, d).textContent = fmt(f);
        $$(`[data-q="${f.key}"]`, d).forEach((c) => c.classList.toggle('on', +c.dataset.v === v[f.key]));
      }
      if (f.showIf) $(`[data-f="${f.key}"]`, d).hidden = !f.showIf(v);
    });
  };
  return ask(`<h3 class="dlg-title">${esc(title)}</h3>${sub ? `<p class="dlg-sub">${esc(sub)}</p>` : ''}
    ${fields.map((f) => `<div class="nf" data-f="${f.key}"><div class="nf-label">${esc(f.label)}</div>${f.choices
      ? `<div class="chips center">${f.choices.map(([cv, cl]) => `<button type="button" class="chip" data-c="${f.key}" data-v="${cv}">${esc(cl)}</button>`).join('')}</div>`
      : `<div class="stepper"><button type="button" class="st-btn" data-k="${f.key}" data-d="-1" aria-label="へらす">−</button><output class="st-val" data-o="${f.key}"></output><button type="button" class="st-btn" data-k="${f.key}" data-d="1" aria-label="ふやす">＋</button></div>
        ${f.chips ? `<div class="chips center">${f.chips.map((c) => `<button type="button" class="chip" data-q="${f.key}" data-v="${c}">${c}${f.unit || ''}</button>`).join('')}</div>` : ''}`}</div>`).join('')}
    ${toggle ? `<label class="row tg nf-tg"><span class="r-main"><b>${esc(toggle.label)}</b></span><input type="checkbox" id="nf-tg" ${toggle.value ? 'checked' : ''}><i class="sw"></i></label>` : ''}
    <div class="dlg-btns"><button type="button" class="btn ghost" data-x>やめる</button><button type="button" class="btn" data-ok>決定</button></div>`,
  'sheet', (d, fin) => {
    $$('.st-btn', d).forEach((b) => {
      b.onclick = () => {
        const f = fields.find((x) => x.key === b.dataset.k);
        const step = f.stepFrom ? +v[f.stepFrom] : f.step;
        v[f.key] = r1(Math.min(f.max, Math.max(f.min, v[f.key] + step * +b.dataset.d)));
        show(d);
      };
    });
    $$('[data-q]', d).forEach((c) => { c.onclick = () => { v[c.dataset.q] = +c.dataset.v; show(d); }; });
    $$('[data-c]', d).forEach((c) => { c.onclick = () => { const f = fields.find((x) => x.key === c.dataset.c); const raw = f.choices.find(([cv]) => String(cv) === c.dataset.v)[0]; v[f.key] = raw; show(d); }; });
    $('[data-x]', d).onclick = () => fin(null);
    $('[data-ok]', d).onclick = () => fin({ ...v, toggle: toggle ? $('#nf-tg', d).checked : undefined });
    show(d);
  });
}
const itemFields = (it) => {
  const e = exOf(it.ex);
  if (e.kind === 'machine') {
    return [
      { key: 'w', label: '重さ', value: it.w, min: 0, max: 300, stepFrom: 'step', unit: 'kg' },
      { key: 'n', label: '回数', value: it.n, min: 1, max: 100, step: 1, unit: '回', chips: [8, 10, 12, 15] },
      { key: 'step', label: '重さの刻み', value: wStep(it.ex), choices: [[1, '1kg'], [2.5, '2.5kg'], [5, '5kg']] },
    ];
  }
  if (e.kind === 'sec') return [{ key: 'n', label: '秒', value: it.n, min: 5, max: 600, step: 5, unit: '秒', chips: [20, 30, 45, 60] }];
  if (e.kind === 'cardio') return [{ key: 'n', label: '分', value: it.n, min: 1, max: 90, step: 1, unit: '分', chips: [5, 10, 15, 20] }];
  return [{ key: 'n', label: '回数', value: it.n, min: 1, max: 200, step: 1, unit: '回', chips: [5, 10, 15, 20] }];
};
// 種目を選ぶ（サーキットに追加）
function pickExercise() {
  const groups = [['machine', 'マシン'], ['body', '自重'], ['sec', '自重（秒）']];
  const all = [...LIB, ...S.custom].filter((e) => e.kind !== 'cardio');
  return ask(`<h3 class="dlg-title">種目を追加</h3>
    <div class="pick-scroll">${groups.map(([k, label]) => `<div class="nf-label">${label}</div><div class="pick-grid">${all.filter((e) => e.kind === k).map((e) => `<button type="button" class="pick-ex" style="--c:${LINES[e.line].color}" data-id="${e.id}">${esc(e.name)}</button>`).join('')}</div>`).join('')}</div>
    <div class="dlg-btns"><button type="button" class="btn ghost" data-x>やめる</button><button type="button" class="btn" data-new>新しい種目を作る</button></div>`,
  'sheet', (d, fin) => {
    $('[data-x]', d).onclick = () => fin(null);
    $('[data-new]', d).onclick = () => fin('__new');
    $$('.pick-ex', d).forEach((b) => { b.onclick = () => fin(b.dataset.id); });
  });
}
function newExercise() {
  return ask(`<h3 class="dlg-title">新しい種目</h3>
    <input type="text" class="dlg-input" id="nx-name" maxlength="20" placeholder="種目の名前（例：ペックフライ）">
    <div class="nf-label">種類</div><div class="chips center">${[['machine', 'マシン（重さ×回数）'], ['body', '自重（回数）'], ['sec', '秒']].map(([k, l], i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-kind="${k}">${l}</button>`).join('')}</div>
    <div class="nf-label">伸びる力</div><div class="chips center">${Object.entries(LINES).map(([k, l], i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-line="${k}" style="--c:${l.color}">${l.stat}</button>`).join('')}</div>
    <div class="dlg-btns"><button type="button" class="btn ghost" data-x>やめる</button><button type="button" class="btn" data-ok>追加</button></div>`,
  'center', (d, fin) => {
    let kind = 'machine', line = 'pw';
    $$('[data-kind]', d).forEach((b) => { b.onclick = () => { kind = b.dataset.kind; $$('[data-kind]', d).forEach((x) => x.classList.toggle('on', x === b)); }; });
    $$('[data-line]', d).forEach((b) => { b.onclick = () => { line = b.dataset.line; $$('[data-line]', d).forEach((x) => x.classList.toggle('on', x === b)); }; });
    setTimeout(() => $('#nx-name', d).focus(), 50);
    $('[data-x]', d).onclick = () => fin(null);
    $('[data-ok]', d).onclick = () => {
      const name = $('#nx-name', d).value.trim();
      if (!name) { $('#nx-name', d).focus(); return; }
      fin({ id: `c_${uid()}`, name, kind, line, ...(kind === 'machine' ? { w: 10 } : { n: kind === 'sec' ? 30 : 10 }) });
    };
  });
}
// その日にやったこと
function dayInfo(d) {
  const tot = dayTotals();
  const logs = S.log.filter((l) => l.d === d);
  const by = {};
  logs.forEach((l) => { (by[l.ex] ||= []).push(l); });
  const dt = parseKey(d);
  const mk = dayMark(d, tot);
  const status = { goal: '🎯 目標達成', done: '● やった日', fz: '🧊 お休み札を使った日', miss: '× 予定の日だったけど休み', plan: '○ トレーニングの予定', rest: '休みの曜日', none: '' }[mk];
  ask(`<h3 class="dlg-title">${dt.getMonth() + 1}月${dt.getDate()}日（${WD[dt.getDay()]}）</h3>
    ${status ? `<p class="dlg-sub">${status}</p>` : ''}
    ${logs.length ? `<div class="card rows">${Object.entries(by).map(([id, arr]) => {
      const e = exOf(id);
      const val = e.kind === 'machine' ? arr.map((l) => `${r1(l.w)}kg×${l.n}`).join('、') : `${arr.reduce((a, l) => a + l.n, 0)}${unitOf(e)}`;
      return `<div class="row"><span>${esc(e.name)}</span><b class="wrap">${val}</b></div>`;
    }).join('')}</div><p class="hint center">合計 ${tot[d] || 0}pt</p>` : '<p class="dlg-msg">記録はありません</p>'}
    <div class="dlg-btns"><button type="button" class="btn" data-x>とじる</button></div>`, 'sheet', (dd, fin) => { $('[data-x]', dd).onclick = () => fin(null); });
}

// おつかれ画面。進化したときは、光って姿が変わる
function showResult(r) {
  const m = mon();
  const evo = r.evo;
  const gainChips = Object.entries(r.gain).filter(([, v]) => v > 0).map(([k, v]) => `<span style="--c:${LINES[k].color}">${LINES[k].stat} ＋${v}</span>`).join('');
  const body = `${r.goal ? '<p class="r-goal">🎯 目標達成！</p>' : ''}${r.weekGoal ? '<p class="r-goal week">🏆 週の目標達成！</p>' : ''}
    <p class="r-pt">＋${r.eff} pt <small>経験値 ＋${r.exp}${r.goal ? '（目標達成で1.5倍）' : ''}${r.boost ? '（🥤1.5倍）' : ''}</small></p>
    ${r.capped ? `<p class="r-note warn">今日の上限${CAP}ptに達しました</p>` : ''}
    ${gainChips ? `<div class="r-gain">${gainChips}</div>` : ''}
    ${r.gems ? `<p class="r-gems">💎 ＋${r.gems}</p><p class="r-note">${r.notes.filter((n) => !n.startsWith('お休み')).join(' ／ ')}</p>` : ''}
    ${r.notes.filter((n) => n.startsWith('お休み')).map((n) => `<p class="r-note">🧊 ${esc(n)}</p>`).join('')}
    ${r.newDone ? `<p class="r-streak">🔥 連続 ${r.streak}回</p>` : ''}
    ${r.lvUp && !evo ? `<p class="r-lv">レベルアップ！ Lv.${lvOf(m.exp)}</p>` : ''}`;
  const evoMsg = evo ? (evo.from === 'egg' ? `タマゴがかえった！<br><b>${esc(FORMS[evo.to].name)}</b> が生まれた` : `${esc(FORMS[evo.from].name)} は<br><b>${esc(FORMS[evo.to].name)}</b> に進化した！`) : '';
  const token = {};
  showResult.token = token;
  ask(`<h3 class="cel-title">おつかれ！</h3>
    <div class="cel-stage">${stageHTML({ form: evo ? evo.from : m.form }, evo ? 'shaking' : 'hop')}<div class="flash"></div></div>
    ${evo ? '<p class="cel-evo">…おや？ 相棒の様子が…！</p>' : ''}
    <div class="cel-body">${body}</div>
    <div class="dlg-btns"><button type="button" class="btn" data-x>OK</button></div>`,
  `center cel${evo ? ' is-evo' : ''}`, (d, fin) => {
    $('[data-x]', d).onclick = () => { fin(null); if (r.sugg.length) suggest(r.sugg); };
    if (!evo) { playTone('coin'); return; }
    playTone('shake');
    setTimeout(() => {
      if (showResult.token !== token || !d.open) return;
      d.classList.add('revealed');
      $('.cel-stage', d).innerHTML = `${stageHTML({ form: evo.to }, 'grown')}<div class="flash"></div>`;
      $('.cel-evo', d).innerHTML = evoMsg;
      playTone('evolve').then(() => say(evo.from === 'egg' ? `${FORMS[evo.to].name}が生まれた` : `${FORMS[evo.to].name}に進化した`));
    }, 1600);
  });
}
// 負荷アップ・ダウンの提案。1つの画面にまとめ、変える種目を選んでもらう
async function suggest(list) {
  const rows = list.map(({ ex, dir }) => {
    const it = planParts().find((x) => x.ex === ex);
    return it && { ex, dir, name: exOf(ex).name, from: tgtText(it), to: tgtText(nextVal(it, dir)) };
  }).filter((r) => r && r.from !== r.to);
  list.forEach(({ ex }) => { if (!rows.some((r) => r.ex === ex)) S.prog[ex] = { hit: 0, miss: 0 }; });
  if (!rows.length) { save(); return; }
  const up = rows.some((r) => r.dir > 0), down = rows.some((r) => r.dir < 0);
  const msg = up && !down ? `${HIT_UP}回続けて目標どおりできた種目があるな。次から少し強くするか？`
    : !up ? `${MISS_DOWN}回続けてきつそうな種目があるな。少し軽くするか？ 続けるのが一番だ`
    : '強くできる種目と、きつそうな種目があるな。目標を変えるか？';
  const picked = await ask(`<div class="sg-mon">${monSVG(mon().form, S.equip.skin)}</div><div class="say">${esc(msg)}</div>
    <div class="card rows sg-list">${rows.map((r, i) => `<label class="row tg"><span class="r-main"><b>${esc(r.name)}</b><small>${esc(r.from)} → <b class="${r.dir > 0 ? 'ok' : 'warn'}">${esc(r.to)}</b></small></span><input type="checkbox" data-i="${i}" checked><i class="sw"></i></label>`).join('')}</div>
    <div class="dlg-btns"><button type="button" class="btn ghost" data-x>まだ今のまま</button><button type="button" class="btn" data-ok>選んだものを変える</button></div>`,
  'center', (d, fin) => {
    $('[data-x]', d).onclick = () => fin([]);
    $('[data-ok]', d).onclick = () => fin($$('[data-i]', d).filter((c) => c.checked).map((c) => rows[+c.dataset.i]));
  });
  const chosen = picked || [];
  rows.forEach((r) => {
    if (chosen.includes(r)) applyChange(r.ex, (x) => nextVal(x, r.dir), r.dir > 0 ? '負荷アップ' : '軽く');
    else S.prog[r.ex] = { hit: 0, miss: 0 };
  });
  save();
  if (chosen.length) toast(`${chosen.length}種目の目標を変えました`);
  if (view === 'log') keepScroll(render);
}
// ガチャの結果：カプセルがゆれて、開くとアイテムが出る
function showPull(res) {
  const { it } = res;
  ask(`<div class="g-stage">${capsuleSVG(it.r)}</div>
    <div class="g-result">
      <p class="rar-big rar-${it.r}">${it.r}</p>
      <div class="g-item">${it.kind === 'egg' ? monSVG('egg') : `<span class="it-ic lg">${itemIcon(it)}</span>`}</div>
      <p class="g-name">${esc(it.name)}${it.kind !== 'boost' && it.kind !== 'egg' ? `<small>${KIND_NAME[it.kind]}</small>` : ''}</p>
      <p class="r-note">${esc(res.note)}</p>
    </div>
    <div class="dlg-btns"><button type="button" class="btn ghost" data-x>とじる</button>${res.isNew && KIND_NAME[it.kind] ? '<button type="button" class="btn" data-eq>今すぐ付ける</button>' : `<button type="button" class="btn" data-again ${S.gems >= COST ? '' : 'disabled'}>もう1回</button>`}</div>`,
  `center pull rar-${it.r}`, (d, fin) => {
    $('[data-x]', d).onclick = () => { fin(null); render(); };
    $('[data-eq]', d)?.addEventListener('click', () => { S.equip[it.kind] = it.id; save(); fin(null); go('home'); });
    $('[data-again]', d)?.addEventListener('click', () => { fin(null); doPull(); });
    playTone('shake');
    setTimeout(() => {
      if (!d.open) return;
      d.classList.add('revealed');
      playTone(it.r === 'N' ? 'coin' : 'rare').then(() => { if (it.r === 'SR') say('エスアール！'); });
    }, 1300);
  });
}
function doPull() {
  unlockAudio();
  const res = pull();
  if (!res) { toast(sleeping() ? '寝込み中は引けません' : 'ガチャ石が足りません'); return; }
  render();
  showPull(res);
}
function formInfo(k) {
  const f = FORMS[k];
  const seen = S.seen[k];
  const how = k === 'egg' ? 'はじめに持っているタマゴ。ガチャのSRでも出ます'
    : k === 'baby' ? 'はじめての「やった日」にタマゴからかえる'
    : f.hidden ? '完全体になるとき、4つの力をどれも2割以上きたえていると現れる'
    : `${LINES[f.line].stat}をいちばん多くきたえて${STAGE_NAMES[f.stage]}に進化する（やった日の合計${EVO_DAYS[f.stage - 1]}日）`;
  ask(`<div class="zk-img ${seen ? '' : 'unknown'}">${monSVG(k)}</div>
    <h3 class="dlg-title">${seen ? esc(f.name) : '？？？'}</h3>
    <p class="dlg-sub">${STAGE_NAMES[f.stage]}${f.line ? ` ・ ${LINES[f.line].name}系` : ''}</p>
    <p class="dlg-msg small">${seen || !f.hidden ? esc(how) : 'ひみつの条件で現れる、隠しモンスター'}</p>
    ${seen ? `<p class="hint center">はじめて会った日 ${seen.replace(/-/g, '/')}</p>` : ''}
    <div class="dlg-btns"><button type="button" class="btn" data-x>とじる</button></div>`, 'sheet', (d, fin) => { $('[data-x]', d).onclick = () => fin(null); });
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------- 操作 ---------- */
const clone = (o) => JSON.parse(JSON.stringify(o));
const ACT = {
  tab: (b) => go(b.dataset.v),
  settings: () => go('settings'),
  cnt(b) {
    const id = b.dataset.ex;
    draft[id] = Math.max(0, (draft[id] || 0) + +b.dataset.d);
    keepScroll(render);
  },
  commit() {
    unlockAudio();
    const r = addWorkout(draft);
    draft = {};
    go('log');
    showResult(r);
    pushDone();
  },
  dayInfo: (b) => dayInfo(b.dataset.d),
  calMove: (b) => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + +b.dataset.d, 1); keepScroll(render); },
  // 目標づくり
  planEdit() { draftP = clone(S.plan || DEFAULT_PLAN()); go('plan'); },
  async planCancel() {
    if (JSON.stringify(draftP) !== JSON.stringify(S.plan || DEFAULT_PLAN()) && !(await confirmBox('変更を保存せずにもどりますか？', 'もどる'))) return;
    draftP = null; go('log');
  },
  async planSave() {
    if (!draftP.days.length) { toast('やる曜日を1つ以上選んでください'); return; }
    if (!draftP.items.length) { toast('サーキットの種目を1つ以上入れてください'); return; }
    const first = !S.plan;
    if (first) { S.planFrom = dayKey(); draftP.hist = [{ d: dayKey(), text: '目標をつくった' }]; }
    else if (JSON.stringify(draftP.days) !== JSON.stringify(S.plan.days)) draftP.hist.push({ d: dayKey(), text: `曜日を ${WD_ORDER.filter((w) => draftP.days.includes(w)).map((w) => WD[w]).join('・')} に` });
    S.plan = draftP; draftP = null;
    save();
    const ok = await pushSettings();
    toast(ok ? (first ? '目標をつくりました。さっそくやってみよう' : '目標を保存しました') : '保存しました（通知の曜日は次に開いたときに直します）');
    go('log');
  },
  pDay(b) {
    const w = +b.dataset.w;
    draftP.days = draftP.days.includes(w) ? draftP.days.filter((x) => x !== w) : [...draftP.days, w].sort();
    keepScroll(render);
  },
  async pCardio(b) {
    const k = b.dataset.k;
    const c = draftP[k] || { ex: k === 'warm' ? 'bike' : 'tread', n: k === 'warm' ? 5 : 10 };
    const v = await numSheet(k === 'warm' ? 'ウォームアップ' : '仕上げ', [
      { key: 'ex', label: '種目', value: draftP[k] ? c.ex : '', choices: [['', 'なし'], ['bike', '🚲 バイク'], ['tread', '🏃 ルームランナー']] },
      { key: 'n', label: '時間', value: c.n, min: 1, max: 90, step: 1, unit: '分', chips: [5, 10, 15, 20], showIf: (x) => !!x.ex },
    ]);
    if (!v) return;
    draftP[k] = v.ex ? { ex: v.ex, n: v.n } : null;
    keepScroll(render);
  },
  async pNum(b) {
    const k = b.dataset.k;
    const f = { rounds: { label: '周回数', min: 1, max: 6, step: 1, unit: '周', chips: [1, 2, 3, 4] }, rest: { label: '種目の間の休憩', min: 0, max: 180, step: 5, unit: '秒', chips: [0, 15, 30, 45, 60] }, rrest: { label: '周の間の休憩', min: 0, max: 300, step: 15, unit: '秒', chips: [30, 60, 90, 120] } }[k];
    const v = await numSheet(f.label, [{ ...f, key: 'v', value: draftP[k], label: '' }]);
    if (!v) return;
    draftP[k] = v.v;
    keepScroll(render);
  },
  async pItem(b) {
    const it = draftP.items[+b.dataset.i];
    const v = await numSheet(exOf(it.ex).name, itemFields(it));
    if (!v) return;
    it.n = v.n;
    if (v.w != null) { it.w = v.w; S.step[it.ex] = v.step; }
    keepScroll(render);
  },
  pUp: (b) => { const i = +b.dataset.i; const a = draftP.items; [a[i - 1], a[i]] = [a[i], a[i - 1]]; keepScroll(render); },
  pDown: (b) => { const i = +b.dataset.i; const a = draftP.items; [a[i + 1], a[i]] = [a[i], a[i + 1]]; keepScroll(render); },
  pDel: (b) => { draftP.items.splice(+b.dataset.i, 1); keepScroll(render); },
  async pAdd() {
    let id = await pickExercise();
    if (!id) return;
    if (id === '__new') {
      const e = await newExercise();
      if (!e) return;
      S.custom.push({ id: e.id, name: e.name, kind: e.kind, line: e.line });
      save();
      id = e.id;
    }
    const e = exOf(id);
    draftP.items.push(e.kind === 'machine' ? { ex: id, n: 12, w: e.w || 10 } : { ex: id, n: e.n || (e.kind === 'sec' ? 30 : 10) });
    keepScroll(render);
    $('#main').scrollTop += 60;
  },
  // サーキット
  sesStart: () => startSession(false),
  sesLight: () => startSession(true),
  sesDone: () => recordStep(sesStep().it.n),
  sesDoneTimed: () => doneTimed(),
  sesSkip: () => skipStep(),
  sesTimer: () => { unlockAudio(); if (SES.state === 'run') pauseSes(); else runTimer(); },
  sesAdd15() { if (SES.state === 'run') SES.endAt += 15000; else SES.left += 15; updSes(); },
  async sesChange() {
    const s = sesStep();
    const e = exOf(s.it.ex);
    const v = await numSheet(e.name, itemFields(s.it).filter((f) => f.key !== 'step').map((f) => (f.key === 'w' ? { ...f, stepFrom: undefined, step: wStep(s.it.ex) } : f)), {
      sub: 'やった数字に直して「決定」',
      toggle: { label: '次からこの数字を目標にする', value: e.kind === 'machine' },
    });
    if (!v || !SES) return;
    if (v.toggle) applyChange(s.it.ex, () => ({ n: v.n, ...(v.w != null ? { w: v.w } : {}) }), '自分で変更');
    recordStep(v.n, v.w);
  },
  async sesQuit() {
    const any = SES.res.some((r) => !r.skip);
    const ok = await confirmBox(any ? 'ここまでを記録して終わりますか？' : 'サーキットをやめますか？', any ? '記録して終わる' : 'やめる');
    if (!ok || !SES) return;
    if (any) finishSession();
    else { clearInterval(SES.timer); SES = null; keepAwake(false); stopSpeech(); go('log'); }
  },
  pull: () => doPull(),
  async pickMon(b) {
    const i = +b.dataset.i;
    if (i === S.active) return;
    if (!(await confirmBox(`${FORMS[S.mons[i].form].name}を育てる相棒にしますか？（今の相棒の成長はそのまま残ります）`, '切りかえる'))) return;
    S.active = i; save(); keepScroll(render);
  },
  formInfo: (b) => formInfo(b.dataset.k),
  equip(b) {
    const it = ITEMS.find((i) => i.id === b.dataset.id);
    S.equip[it.kind] = S.equip[it.kind] === it.id ? '' : it.id;
    save(); keepScroll(render);
    toast(S.equip[it.kind] ? `${it.name}を付けました` : `${it.name}を外しました`);
  },
  pushOn: () => pushOn(),
  pushOff: () => pushOff(),
  async pushTest() {
    try { await pushPost('/test', {}); toast('送りました。数秒で届きます'); } catch { toast('送れませんでした。通知をいったん止めて、もう一度オンにしてください'); }
  },
  rate: (b) => { S.settings.rate = b.dataset.v; save(); keepScroll(render); unlockAudio(); say('この速さで案内する', true); },
  backup() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `筋モン_バックアップ_${dayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
};
function keepScroll(fn) {
  const y = $('#main').scrollTop;
  fn();
  $('#main').scrollTop = y;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled || b.closest('dialog')) return;
  ACT[b.dataset.act]?.(b, e);
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.set) { S.settings[t.dataset.set] = t.checked; save(); if (t.dataset.set === 'silentOk') unlockAudio(); }
  if (t.id === 'remind') {
    S.settings.remind = t.value || '21:00'; save();
    if (!S.push.on) { toast('時刻を保存しました'); return; }
    toast((await pushSettings()) ? `${daysText()}の${S.settings.remind}に知らせます` : '通知サーバーに届きませんでした。もう一度変えてください');
  }
  if (t.id === 'restore' && t.files[0]) {
    try {
      const d = JSON.parse(await t.files[0].text());
      if (!Array.isArray(d.mons) || !Array.isArray(d.log)) throw new Error('形式');
      if (!(await confirmBox(`バックアップ（記録${d.log.length}件）で、今のデータを置きかえますか？`, '置きかえる', true))) { t.value = ''; return; }
      localStorage.setItem(KEY, JSON.stringify(d));
      load(); toast('バックアップから戻しました'); render();
    } catch { toast('このファイルは読み込めませんでした'); }
    t.value = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (SES) { keepAwake(true); if (SES.state === 'run') sesTick(); }
  // 日付が変わっていたら、元気やセリフを今日の状態にする
  else if (['home', 'log', 'gacha'].includes(view)) { grantFreeze(); keepScroll(render); }
  pushDone();
});
// 声の一覧はあとから届くことがある
try { if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {}; } catch { /* なし */ }

/* ---------- 起動 ---------- */
load();
grantFreeze();
render();
pushDone();
try { navigator.storage?.persist?.(); } catch { /* なし */ }
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
