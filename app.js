'use strict';
/* 筋モン（仮） Step1：一人用
   ・筋トレの回数を記録すると、相棒モンスターが育って進化する（進化先はやった種目で決まる）
   ・運動でガチャ石がたまり、ガチャで背景・オーラ・称号・新しいタマゴが出る
   ・サボると相棒が弱り、3日で寝込む（運動すればすぐ回復。成長は減らない）
   データはこのiPhoneの中（localStorage）だけに保存する。運動の記録は「いつ・何を・何回」の履歴で残し、
   あとでログインを付けたときにそのままサーバーへ移せるようにしておく */

const VERSION = '0.2.0';
const KEY = 'kinmon-v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n) => String(n).padStart(2, '0');
const mmss = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; };
const jpMin = (s) => (s < 60 ? `${s}秒` : `約${Math.round(s / 60)}分`);
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dayKey(d); };
const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
const weekKey = (k = dayKey()) => { const d = parseKey(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d); };

/* ---------- ルール（数字は Step1設計書のとおり） ---------- */
const DONE_PT = 5; // 5pt以上で「やった日」
const CAP = 300; // 1日の上限
const EVO_DAYS = [1, 3, 14, 30]; // やった日の合計がこの日数で 幼年期→成長期→成熟期→完全体
const COST = 5; // ガチャ1回
const EX = [
  { id: 'push', name: '腕立て', line: 'pw', unit: '回', steps: [5, 10], rate: 0.4 },
  { id: 'squat', name: 'スクワット', line: 'tf', unit: '回', steps: [5, 10], rate: 0.5 },
  { id: 'abs', name: '腹筋', line: 'gd', unit: '回', steps: [5, 10], rate: 0.4 },
  { id: 'plank', name: 'プランク', line: 'gd', unit: '秒', steps: [10, 30], div: 10 },
  { id: 'burpee', name: 'バーピー', line: 'sp', unit: '回', steps: [3, 5], per: 3, rate: 0.15 },
];
const exOf = (id) => EX.find((e) => e.id === id);
const ptOf = (e, n) => (e.div ? Math.floor(n / e.div) : n * (e.per || 1));
const lvOf = (exp) => Math.floor(Math.sqrt(exp / 10)) + 1;

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

/* ---------- タイマーのメニュー（Step1は固定） ---------- */
const TMENUS = [
  { id: 'basic', name: '6分サーキット', prep: 10, work: 30, rest: 15, sets: 2, setRest: 30, cool: 0, ex: ['push', 'squat', 'abs', 'burpee'] },
  { id: 'tabata', name: 'タバタ 4分', prep: 10, work: 20, rest: 10, sets: 4, setRest: 0, cool: 0, ex: ['squat', 'push'] },
  { id: 'easy', name: 'ゆる3分', prep: 10, work: 40, rest: 20, sets: 1, setRest: 0, cool: 0, ex: ['squat', 'push', 'plank'] },
];

/* ---------- 保存 ---------- */
const zero = () => ({ pw: 0, tf: 0, gd: 0, sp: 0 });
const newMon = (d) => ({ id: uid(), form: 'egg', stage: 0, exp: 0, stats: zero(), since: zero(), days: 0, born: d, evo: [] });
function defaults() {
  const t = dayKey();
  return {
    v: 1, uid: uid() + uid(), created: t,
    log: [], // { at: 時刻(ms), d:'2026-10-25', ex:'push', n:20, pt:20, src:'manual'|'timer' }
    mons: [newMon(t)], active: 0,
    gems: 0, boost: 0, freeze: 1, freezeWeek: weekKey(t), frozen: [],
    items: {}, equip: { bg: '', fx: '', title: '', skin: '' }, seen: { egg: t }, pulls: 0,
    tmenu: 'basic',
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
// 最後に「やった日」から、今日までに何日空いたか（今日はふくめない）
function missedDays(tot = dayTotals()) {
  const today = dayKey();
  const last = Object.keys(tot).filter((k) => k < today && isDoneIn(tot, k)).sort().pop();
  return last ? diffDays(last, today) - 1 : 0;
}
function energy(tot = dayTotals()) {
  if (isDoneIn(tot, dayKey())) return 100;
  return [100, 60, 30][missedDays(tot)] ?? 5;
}
const sleeping = (tot = dayTotals()) => !isDoneIn(tot, dayKey()) && missedDays(tot) >= 3;
// 連続日数。休んだ日はお休み札（使ったもの＋手持ち）でつなぐ
function streak(tot = dayTotals()) {
  const today = dayKey();
  const doneKeys = Object.keys(tot).filter((k) => isDoneIn(tot, k)).sort();
  if (!doneKeys.length) return 0;
  const frozen = new Set(S.frozen);
  let d = isDoneIn(tot, today) ? today : addDays(today, -1);
  let n = 0, budget = S.freeze;
  while (d >= doneKeys[0]) {
    if (isDoneIn(tot, d)) n++;
    else if (!frozen.has(d)) { if (budget > 0) budget--; else break; }
    d = addDays(d, -1);
  }
  return n;
}

/* ---------- 筋トレを記録して、育てる ---------- */
function addWorkout(counts, src) {
  const d = dayKey();
  const m = mon();
  const tot0 = dayTotals();
  const before = { total: tot0[d] || 0, done: isDoneIn(tot0, d), missed: missedDays(tot0), lv: lvOf(m.exp) };
  const at = Date.now();
  const entries = EX.filter((e) => counts[e.id] > 0).map((e) => ({ at, d, ex: e.id, n: counts[e.id], pt: ptOf(e, counts[e.id]), src }));
  const raw = entries.reduce((a, en) => a + en.pt, 0);
  S.log.push(...entries);
  const after = before.total + raw;
  const eff = Math.max(0, Math.min(after, CAP) - Math.min(before.total, CAP));
  const f = raw ? eff / raw : 0;
  const boost = S.boost > 0 && eff > 0;
  if (boost) S.boost--;
  const mult = boost ? 1.5 : 1;
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
  const newDone = !before.done && after >= DONE_PT;
  let st = streak();
  if (newDone) {
    gems += 3; notes.push('やった日 ＋3');
    if (before.missed >= 3) { gems += 3; notes.push('おかえりボーナス ＋3'); }
    // 休んだ日をお休み札でうめる
    if (before.missed > 0 && before.missed <= S.freeze) {
      for (let i = 1; i <= before.missed; i++) S.frozen.push(addDays(d, -i));
      S.freeze -= before.missed;
      notes.push(`お休み札を${before.missed}枚使って連続をつなぎました`);
    }
    m.days++;
    st = streak();
    if (st > 0 && st % 7 === 0) { gems += 5; notes.push(`${st}日連続 ＋5`); }
  }
  const tens = (x) => Math.min(10, Math.floor(Math.min(x, CAP) / 10));
  const tg = tens(after) - tens(before.total);
  if (tg > 0) { gems += tg; notes.push(`10ptごと ＋${tg}`); }
  const evo = checkEvo(m);
  if (evo) { gems += 10; notes.push('進化ボーナス ＋10'); }
  S.gems += gems;
  save();
  return { raw, eff, exp, gain, gems, notes, newDone, boost, evo, lvUp: lvOf(m.exp) > before.lv, streak: st, capped: eff < raw, todayPt: after };
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
   送るのは ランダムな番号（S.uid）・通知の宛先・知らせる時刻・時差・最後にやった日 だけ */
const PUSH_URL = 'https://kinmon-push.kinmon-push.workers.dev';
const VAPID_PUBLIC = 'BF2tvSpLtl9zHFW7PqjiPlBmvDRvuzgFbptTM9TdlFjBmZGMSBE4BznJLdDw3p6KBkunEdazc0kBe9l697EZUuk';
const b64uBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const tzMin = () => -new Date().getTimezoneOffset();
const pushReady = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
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
    await pushPost('/subscribe', { sub: sub.toJSON(), remind: S.settings.remind, tz: tzMin(), lastDone: lastDoneDay() });
    S.push.on = true; S.push.sent = lastDoneDay(); save();
    toast(`毎日${S.settings.remind}に、まだなら知らせます`);
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
  const today = isDoneIn(tot, dayKey());
  if (today) {
    const st = streak(tot);
    if (st > 0 && st % 7 === 0) return `${st}日連続！お前、本物だな`;
    return pickOf(['今日はよくやった。また明日な', '力がみなぎる…！', 'お前、だんだん本物になってきたな', 'いい汗だ。明日もたのむぞ']);
  }
  const miss = missedDays(tot);
  if (miss === 2) return 'このままだと寝込むぞ…スクワット5回でいい';
  if (miss === 1) return 'おい、昨日来なかったな。今日は待ってるぞ';
  if (m.stage < 4 && EVO_DAYS[m.stage] - m.days === 1) return '体が熱い…今日やったら何かが起きる気がする';
  return pickOf(['腹へった…腕立て5回でいいから頼む', '今日もやるぞ。5回でもいい', 'おい、そろそろ時間だぞ', '軽くでいい。体を動かそうぜ']);
}

/* ---------- 音・声（毎日トレーニングから流用） ---------- */
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

/* ---------- タイマー（毎日トレーニングから流用） ---------- */
const tMenu = () => TMENUS.find((m) => m.id === S.tmenu) || TMENUS[0];
function buildSegs(m) {
  const ex = m.ex;
  const segs = [];
  if (m.prep > 0) segs.push({ k: 'prep', dur: m.prep, ex: ex[0], set: 0 });
  for (let s = 0; s < m.sets; s++) {
    ex.forEach((id, i) => {
      segs.push({ k: 'work', dur: m.work, ex: id, set: s });
      const lastEx = i === ex.length - 1;
      if (lastEx && s === m.sets - 1) return;
      if (lastEx) {
        const d = m.setRest > 0 ? m.setRest : m.rest;
        if (d > 0) segs.push({ k: m.setRest > 0 ? 'setrest' : 'rest', dur: d, ex: ex[0], set: s + 1 });
      } else if (m.rest > 0) segs.push({ k: 'rest', dur: m.rest, ex: ex[i + 1], set: s });
    });
  }
  if (m.cool > 0) segs.push({ k: 'cool', dur: m.cool, ex: '', set: m.sets });
  return segs;
}
const totalSec = (m) => buildSegs(m).reduce((a, s) => a + s.dur, 0);
const PH = { prep: '準備', work: 'ワークアウト', rest: '休憩', setrest: 'セット間の休憩', cool: 'クールダウン', done: 'おわり' };
const exName = (id) => exOf(id)?.name || '';
const T = { segs: [], idx: 0, state: 'idle', endAt: 0, left: 0, lastSec: 0, timer: null };
function resetTimer() {
  clearInterval(T.timer);
  Object.assign(T, { segs: buildSegs(tMenu()), idx: 0, state: 'idle' });
  T.left = T.segs[0].dur;
  stopSpeech(); keepAwake(false);
  updateTimer();
}
function announce(seg) {
  const m = tMenu();
  let text = '';
  const last = seg.k === 'work' && !T.segs.slice(T.segs.indexOf(seg) + 1).some((s) => s.k === 'work');
  if (seg.k === 'prep') text = `準備しろ。さいしょは、${exName(seg.ex)}`;
  else if (seg.k === 'work') text = `${last ? 'ラスト、' : ''}${exName(seg.ex)}、スタート`;
  else if (seg.k === 'rest') text = `休憩。つぎは、${exName(seg.ex)}`;
  else if (seg.k === 'setrest') text = `セットの間の休憩。のこり${m.sets - seg.set}セット`;
  else if (seg.k === 'cool') text = 'クールダウン';
  playTone('chime').then(() => say(text, true));
}
function cue(sec) {
  const seg = T.segs[T.idx];
  if (!seg) return;
  if (sec >= 1 && sec <= 3 && seg.dur > 4 && S.settings.beep) playTone('pop');
  if (sec === 10 && seg.k === 'work' && seg.dur >= 20 && S.settings.tenSec) say('あと10秒');
}
function startTimer() {
  unlockAudio();
  if (T.state === 'done') resetTimer();
  const first = T.state === 'idle';
  T.state = 'run';
  T.endAt = Date.now() + T.left * 1000;
  T.lastSec = Math.ceil(T.left);
  if (first) announce(T.segs[T.idx]);
  clearInterval(T.timer);
  T.timer = setInterval(tick, 200);
  keepAwake(true);
  updateTimer();
}
function pauseTimer() {
  T.left = Math.max(0, (T.endAt - Date.now()) / 1000);
  T.state = 'pause';
  clearInterval(T.timer);
  stopSpeech(); keepAwake(false);
  updateTimer();
}
function tick() {
  if (T.state !== 'run') return;
  const now = Date.now();
  while (now >= T.endAt) {
    T.idx++;
    if (T.idx >= T.segs.length) { finishTimer(); return; }
    T.endAt += T.segs[T.idx].dur * 1000;
    // 画面が止まっていた間に次の区切りまで過ぎていたら、声を出さずに追いつく
    if (now < T.endAt) announce(T.segs[T.idx]);
    T.lastSec = Math.ceil((T.endAt - now) / 1000);
  }
  const sec = Math.ceil((T.endAt - now) / 1000);
  if (sec !== T.lastSec) { T.lastSec = sec; cue(sec); }
  updateTimer();
}
function jump(delta) {
  if (T.state === 'idle' || T.state === 'done') return;
  const seg = T.segs[T.idx];
  const left = T.state === 'run' ? (T.endAt - Date.now()) / 1000 : T.left;
  if (delta < 0 && seg.dur - left > 2) { /* 区切りの途中なら、その区切りの最初へ */ }
  else T.idx += delta;
  if (T.idx < 0) T.idx = 0;
  if (T.idx >= T.segs.length) { finishTimer(); return; }
  T.left = T.segs[T.idx].dur;
  if (T.state === 'run') { T.endAt = Date.now() + T.left * 1000; T.lastSec = Math.ceil(T.left); announce(T.segs[T.idx]); }
  updateTimer();
}
// タイマーが終わったら、やった分の目安の回数を記録画面に入れる（回数は自分で直せる）
function finishTimer() {
  clearInterval(T.timer);
  T.state = 'done'; T.idx = T.segs.length; T.left = 0;
  keepAwake(false);
  const counts = {};
  T.segs.filter((s) => s.k === 'work').forEach((s) => {
    const e = exOf(s.ex);
    counts[e.id] = (counts[e.id] || 0) + (e.div ? s.dur : Math.round(s.dur * e.rate));
  });
  draft = counts;
  draftFromTimer = tMenu().name;
  playTone('fanfare').then(() => say('おつかれ。回数を確かめて、終わったを押せ', true));
  go('log');
}

/* ---------- アイコン ---------- */
const IC = {
  home: '<svg viewBox="0 0 24 24"><path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24"><path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/></svg>',
  capsule: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><circle cx="12" cy="12" r="2.2"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  play: '<svg viewBox="0 0 24 24" class="fill"><path d="M8.5 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.7 4.5a.8.8 0 0 0-1.2.7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" class="fill"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M5 5.5l9 6.5-9 6.5zM18.5 5.5v13"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M19 5.5l-9 6.5 9 6.5zM5.5 5.5v13"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M3 4v6h6"/><path d="M5.5 15a8 8 0 1 0 1.9-8.3L3 10"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.3 6.7l1.4-1.4"/></svg>',
};

/* ---------- 画面 ---------- */
let view = 'home'; // home | log | timer | gacha | zukan | settings
let draft = {}; // 記録画面で入力中の回数
let draftFromTimer = '';

function render() {
  const main = $('#main');
  main.className = `v-${view}`;
  main.innerHTML = { home: homeHTML, log: logHTML, timer: timerHTML, gacha: gachaHTML, zukan: zukanHTML, settings: settingsHTML }[view]();
  main.scrollTop = 0;
  if (view === 'timer') updateTimer();
  const tab = view === 'timer' ? 'log' : view === 'settings' ? 'home' : view;
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

/* ホーム */
function homeHTML() {
  const tot = dayTotals();
  const m = mon();
  const f = FORMS[m.form];
  const en = energy(tot);
  const sl = sleeping(tot);
  const today = tot[dayKey()] || 0;
  const evoLeft = m.stage < 4 ? EVO_DAYS[m.stage] - m.days : 0;
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(dayKey(), i - 13));
  const fz = new Set(S.frozen);
  return `<div class="page home">
    <header class="h-top">
      <span class="chip-st">🔥 連続 <b>${streak(tot)}</b>日</span>
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
    <div class="today">今日 <b>${today}</b> pt ${today >= DONE_PT ? '<span class="ok">✓ やった日</span>' : `／ あと${DONE_PT - today}ptで「やった日」`}${S.boost ? ` ・ 🥤×${S.boost}` : ''}</div>
    <div class="evo-next">${m.stage < 4 ? `${m.stage === 0 ? 'タマゴがかえる' : '進化'}まで あと <b>${evoLeft}</b> 日（やった日の合計）` : '完全体！ 最後の姿です'}</div>
    <div class="days">${days14.map((d) => `<i class="${isDoneIn(tot, d) ? 'on' : fz.has(d) ? 'fz' : ''} ${d === dayKey() ? 'today' : ''}" title="${d}"></i>`).join('')}</div>
    <p class="days-cap">この2週間（● やった日 ／ 🧊 お休み札）</p>
  </div>`;
}

/* 記録 */
function logHTML() {
  const tot = dayTotals();
  const today = tot[dayKey()] || 0;
  const pts = EX.reduce((a, e) => a + ptOf(e, draft[e.id] || 0), 0);
  const todayLog = S.log.filter((l) => l.d === dayKey());
  const sum = {};
  todayLog.forEach((l) => { sum[l.ex] = (sum[l.ex] || 0) + l.n; });
  const room = Math.max(0, CAP - today);
  return `<div class="page log">
    <h1 class="p-title">筋トレを記録</h1>
    ${draftFromTimer ? `<div class="banner">⏱ ${esc(draftFromTimer)}の目安の回数を入れました。実際の回数に直して「終わった！」</div>` : ''}
    <div class="ex-list">${EX.map((e) => {
      const n = draft[e.id] || 0;
      return `<div class="ex" style="--c:${LINES[e.line].color}">
        <div class="ex-name"><b>${e.name}</b><small>${LINES[e.line].stat}アップ${e.per ? ` ・ 1回${e.per}pt` : e.div ? ' ・ 10秒1pt' : ''}</small></div>
        <div class="ex-n"><b>${n}</b>${e.unit}</div>
        <div class="ex-btns">
          <button type="button" class="sbtn" data-act="cnt" data-ex="${e.id}" data-d="-${e.steps[0]}" ${n ? '' : 'disabled'}>−</button>
          ${e.steps.map((s) => `<button type="button" class="sbtn add" data-act="cnt" data-ex="${e.id}" data-d="${s}">＋${s}</button>`).join('')}
        </div>
      </div>`;
    }).join('')}</div>
    <div class="sum-line">今回 <b>${pts}</b> pt ${today + pts >= DONE_PT ? (today < DONE_PT && pts ? '<span class="ok">→ やった日 達成！</span>' : '') : `<small>（あと${DONE_PT - today - pts}ptで「やった日」）</small>`}
      ${pts > room ? `<br><small class="warn">1日の上限は${CAP}ptです（今日はあと${room}ptまで）</small>` : ''}</div>
    <button type="button" class="big" data-act="commit" ${pts ? '' : 'disabled'}>終わった！</button>
    <button type="button" class="big ghost" data-act="toTimer"><span class="ic">${IC.timer}</span>タイマーでやる</button>
    ${todayLog.length ? `<h2 class="sec-title">今日の記録（${today}pt）</h2><div class="card rows">${Object.entries(sum).map(([id, n]) => `<div class="row"><span>${exName(id)}</span><b>${n}${exOf(id).unit}</b></div>`).join('')}</div>` : ''}
    <p class="hint">5pt（腕立て5回）でも「やった日」になります。ずぼらな日はそれだけでOK。</p>
  </div>`;
}

/* タイマー */
function timerHTML() {
  return `<div id="timer">
    <header class="t-head">
      <button type="button" class="icbtn" data-act="tab" data-v="log" aria-label="もどる"><span class="ic">${IC.back}</span></button>
      <button type="button" class="menu-pick" data-act="pickMenu"><span class="mname"></span><span class="total"></span></button>
      <button type="button" class="icbtn" data-act="reset" aria-label="最初から"><span class="ic">${IC.reset}</span></button>
    </header>
    <section class="phase">
      <div class="ph-label"></div>
      <div class="ph-ex"></div>
      <div class="ph-time"></div>
      <div class="ph-bar"><i></i></div>
    </section>
    <section class="next"><div><div class="nx-label"></div><div class="nx-ex"></div></div><div class="nx-time"></div></section>
    <div class="ctrl">
      <button type="button" class="pill" data-act="prev"><span class="ic">${IC.prev}</span></button>
      <div class="play-wrap"><button type="button" class="play" data-act="play"></button><span class="play-label"></span></div>
      <button type="button" class="pill" data-act="next"><span class="ic">${IC.next}</span></button>
    </div>
    <p class="hint center">終わると、目安の回数が記録画面に入ります</p>
  </div>`;
}
function updateTimer() {
  const root = $('#timer');
  if (!root) return;
  const m = tMenu();
  const done = T.state === 'done';
  const seg = done ? null : T.segs[T.idx];
  const left = T.state === 'run' ? Math.max(0, (T.endAt - Date.now()) / 1000) : T.left;
  const k = seg ? seg.k : 'done';
  $('.phase', root).dataset.k = k;
  $('.ph-label', root).textContent = PH[k];
  $('.ph-ex', root).textContent = !seg ? 'おつかれ！' : seg.k === 'work' ? exName(seg.ex) : seg.k === 'cool' ? 'ゆっくり呼吸' : `つぎは ${exName(seg.ex)}`;
  $('.ph-time', root).textContent = mmss(seg ? left : 0);
  $('.ph-bar i', root).style.width = `${seg ? Math.min(100, (1 - left / seg.dur) * 100) : 100}%`;
  const nx = done ? null : T.segs[T.idx + 1];
  $('.next', root).dataset.k = nx ? nx.k : 'done';
  $('.nx-label', root).textContent = `つぎ ・ ${nx ? PH[nx.k] : 'おわり'}`;
  $('.nx-ex', root).textContent = nx ? (nx.k === 'work' ? exName(nx.ex) : 'ひと休み') : 'もう少し！';
  $('.nx-time', root).textContent = nx ? mmss(nx.dur) : '';
  let total = seg ? left : 0;
  for (let i = T.idx + 1; i < T.segs.length; i++) total += T.segs[i].dur;
  $('.mname', root).textContent = m.name;
  $('.total', root).textContent = mmss(total);
  const run = T.state === 'run';
  const btn = $('.play', root);
  btn.innerHTML = run ? IC.pause : IC.play;
  btn.setAttribute('aria-label', run ? '一時停止' : 'スタート');
  $('.play-label', root).textContent = { idle: 'スタート', run: '一時停止', pause: 'つづける', done: 'もう一度' }[T.state];
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
      <div class="row"><span>10ptごと（1日10個まで）</span><b>＋1</b></div>
      <div class="row"><span>7日連続ごと</span><b>＋5</b></div>
      <div class="row"><span>進化したとき</span><b>＋10</b></div>
      <div class="row"><span>3日以上あけて戻ってきた（おかえり）</span><b>＋3</b></div>
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
  const exSum = {};
  S.log.forEach((l) => { exSum[l.ex] = (exSum[l.ex] || 0) + l.n; });
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
    <p class="hint">進化先は、前の進化からいちばん多くやった種目で決まります（腕立て→パワー、スクワット→タフ、腹筋・プランク→ガード、バーピー→スピード）。</p>
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
      ${EX.map((e) => `<div class="row"><span>${e.name}</span><b>${exSum[e.id] || 0}${e.unit}</b></div>`).join('')}
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
        ? `<button type="button" class="row" data-act="pushOff"><span class="r-main"><b>🔔 通知オン</b><small>その日まだなら、この時刻と2時間後に知らせます。押すと止めます</small></span><span class="ic chev">${IC.chev}</span></button>`
        : `<button type="button" class="row" data-act="pushOn"><span class="r-main"><b>通知を受け取る</b><small>${standalone() ? '押すと「通知を許可」の確認が出ます' : 'iPhoneでは、ホーム画面に追加した筋モンから開いて押してください'}</small></span><span class="ic chev">${IC.chev}</span></button>`}
      <label class="row"><span class="r-main"><b>知らせる時刻</b><small>相棒が「やってないぞ」と知らせます</small></span><input type="time" id="remind" value="${esc(st.remind)}"></label>
      ${S.push.on ? `<button type="button" class="row" data-act="pushTest"><span class="r-main"><b>テスト通知を送る</b><small>数秒で届けば準備OK</small></span><span class="ic chev">${IC.chev}</span></button>` : ''}
    </div>
    <p class="hint">通知のために、ランダムな番号・通知の宛先・時刻・最後にやった日だけを通知サーバーに送ります。回数やモンスターのデータは送りません。</p>
    <h2 class="sec-title">タイマーの音と声</h2>
    <div class="rows card">
      ${tg('voice', '声の案内', '「腕立て、スタート」「休憩。つぎは〜」')}
      ${tg('tenSec', '「あと10秒」の声')}
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
    <p class="about">筋モン（仮） v${VERSION} ・ Step1（一人用）<br>記録はこのiPhoneの中にだけ保存されます。</p>
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

// おつかれ画面。進化したときは、光って姿が変わる
function showResult(r) {
  const m = mon();
  const evo = r.evo;
  const gainChips = Object.entries(r.gain).filter(([, v]) => v > 0).map(([k, v]) => `<span style="--c:${LINES[k].color}">${LINES[k].stat} ＋${v}</span>`).join('');
  const body = `<p class="r-pt">＋${r.eff} pt <small>経験値 ＋${r.exp}${r.boost ? '（🥤1.5倍）' : ''}</small></p>
    ${r.capped ? `<p class="r-note warn">今日の上限${CAP}ptに達しました</p>` : ''}
    ${gainChips ? `<div class="r-gain">${gainChips}</div>` : ''}
    ${r.gems ? `<p class="r-gems">💎 ＋${r.gems}</p><p class="r-note">${r.notes.filter((n) => !n.startsWith('お休み')).join(' ／ ')}</p>` : ''}
    ${r.notes.filter((n) => n.startsWith('お休み')).map((n) => `<p class="r-note">🧊 ${esc(n)}</p>`).join('')}
    ${r.newDone ? `<p class="r-streak">🔥 連続 ${r.streak}日</p>` : ''}
    ${r.lvUp && !evo ? `<p class="r-lv">レベルアップ！ Lv.${lvOf(m.exp)}</p>` : ''}`;
  const evoMsg = evo ? (evo.from === 'egg' ? `タマゴがかえった！<br><b>${esc(FORMS[evo.to].name)}</b> が生まれた` : `${esc(FORMS[evo.from].name)} は<br><b>${esc(FORMS[evo.to].name)}</b> に進化した！`) : '';
  const token = {};
  showResult.token = token;
  ask(`<h3 class="cel-title">おつかれ！</h3>
    <div class="cel-stage">${stageHTML({ form: evo ? evo.from : m.form }, evo ? 'shaking' : 'hop')}<div class="flash"></div></div>
    ${evo ? `<p class="cel-evo">…おや？ 相棒の様子が…！</p>` : ''}
    <div class="cel-body">${body}</div>
    <div class="dlg-btns"><button type="button" class="btn" data-x>OK</button></div>`,
  `center cel${evo ? ' is-evo' : ''}`, (d, fin) => {
    $('[data-x]', d).onclick = () => { fin(null); go('home'); };
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
    : `${LINES[f.line].ex}をいちばん多くやって${STAGE_NAMES[f.stage]}に進化する（やった日の合計${EVO_DAYS[f.stage - 1]}日）`;
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
const timerBusy = () => T.state === 'run' || T.state === 'pause';
const ACT = {
  async tab(b) {
    if (view === 'timer' && timerBusy() && b.dataset.v !== 'timer' && !(await confirmBox('タイマーを止めますか？', '止める'))) return;
    if (view === 'timer' && b.dataset.v !== 'timer') resetTimer();
    go(b.dataset.v);
  },
  settings: () => go('settings'),
  cnt(b) {
    const id = b.dataset.ex;
    draft[id] = Math.max(0, (draft[id] || 0) + +b.dataset.d);
    keepScroll(render);
  },
  commit() {
    unlockAudio();
    const src = draftFromTimer ? 'timer' : 'manual';
    const r = addWorkout(draft, src);
    draft = {}; draftFromTimer = '';
    render();
    showResult(r);
    pushDone();
  },
  pushOn: () => pushOn(),
  pushOff: () => pushOff(),
  async pushTest() {
    try { await pushPost('/test', {}); toast('送りました。数秒で届きます'); } catch { toast('送れませんでした。通知をいったん止めて、もう一度オンにしてください'); }
  },
  toTimer() { resetTimer(); go('timer'); },
  play: () => (T.state === 'run' ? pauseTimer() : startTimer()),
  prev: () => jump(-1),
  next: () => jump(1),
  async reset() {
    if (timerBusy() && !(await confirmBox('最初からやり直しますか？', 'やり直す'))) return;
    resetTimer();
  },
  pickMenu() {
    ask(`<h3 class="dlg-title">メニューをえらぶ</h3><div class="pick-list">${TMENUS.map((m) => `<button type="button" class="pick-item ${m.id === S.tmenu ? 'on' : ''}" data-id="${m.id}"><b>${esc(m.name)}</b><small>${m.ex.map(exName).join('・')} ／ ${jpMin(totalSec(m))}</small></button>`).join('')}</div>
      <div class="dlg-btns"><button type="button" class="btn ghost" data-x>とじる</button></div>`, 'sheet', (d, fin) => {
      $('[data-x]', d).onclick = () => fin(null);
      $$('.pick-item', d).forEach((b) => { b.onclick = () => fin(b.dataset.id); });
    }).then(async (id) => {
      if (!id) return;
      if (timerBusy() && id !== S.tmenu && !(await confirmBox('タイマーを止めて、メニューを変えますか？', '変える'))) return;
      S.tmenu = id; save(); resetTimer();
    });
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
    try { await pushPost('/settings', { remind: S.settings.remind, tz: tzMin() }); toast(`毎日${S.settings.remind}に知らせます`); } catch { toast('通知サーバーに届きませんでした。もう一度変えてください'); }
  }
  if (t.id === 'restore' && t.files[0]) {
    try {
      const d = JSON.parse(await t.files[0].text());
      if (!Array.isArray(d.mons) || !Array.isArray(d.log)) throw new Error('形式');
      if (!(await confirmBox(`バックアップ（記録${d.log.length}件）で、今のデータを置きかえますか？`, '置きかえる', true))) { t.value = ''; return; }
      localStorage.setItem(KEY, JSON.stringify(d));
      load(); resetTimer(); toast('バックアップから戻しました'); render();
    } catch { toast('このファイルは読み込めませんでした'); }
    t.value = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (T.state === 'run') { keepAwake(true); tick(); }
  // 日付が変わっていたら、元気やセリフを今日の状態にする
  else if (['home', 'log', 'gacha'].includes(view)) { grantFreeze(); keepScroll(render); }
  pushDone();
});
// 声の一覧はあとから届くことがある
try { if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {}; } catch { /* なし */ }

/* ---------- 起動 ---------- */
load();
grantFreeze();
resetTimer();
render();
pushDone();
try { navigator.storage?.persist?.(); } catch { /* なし */ }
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
