'use strict';
/* モンスターの絵（SVG）。Step1の仮の絵。売る前にイラストレーターへの外注を検討する
   形は左半分だけ描き、both() で左右対称にする */

const LINES = {
  pw: { name: 'パワー', stat: '攻撃', ex: '腕立て', color: '#ff6b5a' },
  tf: { name: 'タフ', stat: '体力', ex: 'スクワット', color: '#6fcf7f' },
  gd: { name: 'ガード', stat: '防御', ex: '腹筋・プランク', color: '#5aa9ff' },
  sp: { name: 'スピード', stat: '素早さ', ex: 'バーピー', color: '#ffd24d' },
};
const STAGE_NAMES = ['タマゴ', '幼年期', '成長期', '成熟期', '完全体'];
const FORMS = {
  egg: { name: 'タマゴ', stage: 0 },
  baby: { name: 'プチモン', stage: 1 },
  pw2: { name: 'ドララ', stage: 2, line: 'pw' },
  tf2: { name: 'クマタロ', stage: 2, line: 'tf' },
  gd2: { name: 'コロイワ', stage: 2, line: 'gd' },
  sp2: { name: 'コンライ', stage: 2, line: 'sp' },
  pw3: { name: 'ガルドラ', stage: 3, line: 'pw' },
  tf3: { name: 'グリズラー', stage: 3, line: 'tf' },
  gd3: { name: 'ゴーレック', stage: 3, line: 'gd' },
  sp3: { name: 'ライガル', stage: 3, line: 'sp' },
  pw4: { name: 'バーンドラグーン', stage: 4, line: 'pw' },
  tf4: { name: 'タイタンベア', stage: 4, line: 'tf' },
  gd4: { name: 'フォートレクス', stage: 4, line: 'gd' },
  sp4: { name: 'ボルトウルフ', stage: 4, line: 'sp' },
  king: { name: 'マッスルキング', stage: 4, hidden: true },
};
const PAL = {
  base: { m: '#ff9f5a', d: '#e07a35', l: '#ffd9b0', a: '#ffb02e' },
  pw: { m: '#ff5a4a', d: '#c0392b', l: '#ffd0a0', a: '#ffb02e' },
  tf: { m: '#9a6532', d: '#6b421c', l: '#e6bd8a', a: '#6fcf7f' },
  gd: { m: '#5aa9ff', d: '#2f6fbf', l: '#cfe6ff', a: '#9be7ff' },
  sp: { m: '#ffd24d', d: '#e0a800', l: '#fff6d0', a: '#ffb300' },
  gold: { m: '#f5c542', d: '#b8860b', l: '#fff1b8', a: '#fff7d6' },
};
const INK = '#1c1f2b';

const both = (s) => `${s}<g transform="matrix(-1 0 0 1 200 0)">${s}</g>`;
// 目。angry で眉をつり上げる（左目として描き、both で右目にする）
const EYE = (x, y, r, angry = false) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>
  <circle cx="${x + r * 0.15}" cy="${y + r * 0.1}" r="${r * 0.55}" fill="${INK}" stroke="none"/>
  <circle cx="${x - r * 0.1}" cy="${y - r * 0.25}" r="${r * 0.2}" fill="#fff" stroke="none"/>
  ${angry ? `<path d="M${x - r - 2} ${y - r - 4} L${x + r + 1} ${y - r + 3}" fill="none" stroke-width="4.5"/>` : ''}`;
const aura = (id, col) => `<defs><radialGradient id="au-${id}"><stop offset="0" stop-color="${col}" stop-opacity=".6"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>
  <circle cx="100" cy="105" r="96" fill="url(#au-${id})" stroke="none"/>`;
const grow = (s) => `<g transform="translate(100 112) scale(1.1) translate(-100 -112)">${s}</g>`;
const BLOB = 'M55 155 C50 110 70 82 100 82 C130 82 150 110 145 155 C143 175 124 180 100 180 C76 180 57 175 55 155Z';
const bigWings = (c) => both(`<path d="M80 104 C44 42 14 50 6 72 C22 72 26 82 18 98 C32 96 40 106 30 120 C46 114 58 120 68 130Z" fill="${c}"/>
  <path d="M70 104 C50 76 34 70 22 78" fill="none" stroke-width="3"/>`);

/* ---------- タマゴ・幼年期 ---------- */
const artEgg = () => `<ellipse cx="100" cy="115" rx="50" ry="64" fill="#f4ecdc"/>
  <path d="M52 114 L65 105 L78 115 L91 105 L104 115 L117 105 L130 115 L143 105 L149 110" fill="none" stroke="#ff8a3d" stroke-width="5"/>
  <circle cx="80" cy="88" r="9" fill="#ff8a3d" stroke="none"/><circle cx="120" cy="140" r="12" fill="#ff8a3d" stroke="none"/>
  <circle cx="114" cy="78" r="6" fill="#4fc3f7" stroke="none"/><circle cx="78" cy="146" r="7" fill="#4fc3f7" stroke="none"/>`;
const artBaby = (c) => `${both(`<path d="M80 90 L84 68 L95 84Z" fill="${c.m}"/><ellipse cx="76" cy="177" rx="14" ry="7" fill="${c.d}"/>`)}
  <path d="${BLOB}" fill="${c.m}"/>
  <ellipse cx="100" cy="152" rx="28" ry="20" fill="${c.l}" stroke="none"/>
  ${both(`${EYE(84, 120, 11)}<circle cx="70" cy="138" r="6" fill="#ff7b9c" opacity=".5" stroke="none"/>`)}
  <path d="M92 140 Q100 148 108 140" fill="none"/>`;

/* ---------- 成長期 ---------- */
const artPw2 = (c) => `<path d="M135 150 C165 155 175 140 178 118 C184 140 176 170 138 170Z" fill="${c.m}"/>
  <path d="M178 120 C168 106 176 94 182 84 C186 98 198 104 188 122Z" fill="${c.a}"/>
  ${both(`<path d="M76 92 L70 64 L92 86Z" fill="${c.l}"/><ellipse cx="78" cy="178" rx="15" ry="8" fill="${c.d}"/>`)}
  <path d="${BLOB}" fill="${c.m}"/>
  <ellipse cx="100" cy="152" rx="26" ry="22" fill="${c.l}" stroke="none"/>
  ${both(`<path d="M58 130 C44 132 42 146 52 152 C56 148 58 144 63 142" fill="${c.m}"/>${EYE(84, 116, 10, true)}`)}
  <path d="M88 136 Q100 145 112 136" fill="none"/><path d="M103 139 L106 147 L109 139Z" fill="#fff" stroke-width="2"/>`;
const artTf2 = (c) => `${both(`<circle cx="70" cy="90" r="16" fill="${c.m}"/><circle cx="70" cy="90" r="7" fill="${c.l}" stroke="none"/><ellipse cx="78" cy="178" rx="15" ry="8" fill="${c.d}"/>`)}
  <path d="${BLOB}" fill="${c.m}"/>
  <ellipse cx="100" cy="130" rx="21" ry="15" fill="${c.l}"/>
  <ellipse cx="100" cy="123" rx="7" ry="5" fill="${INK}" stroke="none"/>
  ${both(EYE(82, 110, 8))}
  <path d="M100 128 L100 135 M92 137 Q100 143 108 137" fill="none"/>
  <path d="M100 150 C88 152 86 166 100 172 C114 166 112 152 100 150Z" fill="${c.a}"/><path d="M100 154 L100 168" fill="none" stroke-width="2.5"/>`;
const artGd2 = (c) => `${both(`<ellipse cx="78" cy="178" rx="15" ry="7" fill="${c.d}"/>`)}
  <path d="M52 150 C48 115 62 88 100 86 C138 88 152 115 148 150 C146 172 126 180 100 180 C74 180 54 172 52 150Z" fill="${c.m}"/>
  <path d="M66 104 L84 88 L116 88 L134 104 L122 116 L78 116Z" fill="${c.d}"/>
  <path d="M84 88 L92 116 M116 88 L108 116" fill="none" stroke-width="3"/>
  ${both(EYE(84, 132, 9))}
  <path d="M93 152 L107 152" fill="none"/>
  <path d="M132 124 L124 136 L130 144" fill="none" stroke-width="3"/>`;
const artSp2 = (c) => `<path d="M138 160 L172 140 L160 136 L186 106 L150 128 L162 132 L134 150Z" fill="${c.m}"/>
  ${both(`<path d="M66 102 L60 50 L94 86Z" fill="${c.m}"/><path d="M70 92 L66 62 L86 84Z" fill="${c.l}" stroke="none"/><ellipse cx="78" cy="178" rx="15" ry="8" fill="${c.d}"/>`)}
  <path d="${BLOB}" fill="${c.m}"/>
  <path d="M70 124 Q100 166 130 124 Q100 140 70 124Z" fill="${c.l}" stroke="none"/>
  ${both(`${EYE(84, 114, 9, true)}<path d="M62 134 L71 129 L69 136 L78 131" fill="none" stroke="${c.a}" stroke-width="3"/>`)}
  <ellipse cx="100" cy="130" rx="5" ry="3.5" fill="${INK}" stroke="none"/>
  <path d="M93 139 Q100 144 107 139" fill="none"/>`;

/* ---------- 成熟期 ---------- */
const pw3 = (c, wings = true) => `${wings ? both(`<path d="M70 106 L24 72 L34 100 L18 112 L40 120 L66 126Z" fill="${c.d}"/>`) : ''}
  <path d="M130 160 C165 168 182 150 186 128 C192 152 182 182 132 180Z" fill="${c.m}"/>
  <path d="M186 130 C176 116 184 104 190 94 C194 108 204 114 194 132Z" fill="${c.a}"/>
  ${both(`<ellipse cx="78" cy="180" rx="17" ry="9" fill="${c.d}"/>`)}
  <path d="M62 176 C58 130 72 104 100 104 C128 104 142 130 138 176Z" fill="${c.m}"/>
  <path d="M84 116 L116 116 L112 172 L88 172Z" fill="${c.l}"/>
  <path d="M85 131 L115 131 M86 146 L114 146 M87 160 L113 160" fill="none" stroke-width="3"/>
  ${both(`<path d="M66 118 C40 120 36 148 50 158 C58 152 62 142 72 140Z" fill="${c.m}"/><path d="M78 56 L62 20 L92 46Z" fill="${c.l}"/>`)}
  <path d="M68 78 C66 52 84 38 100 38 C116 38 134 52 132 78 C132 98 116 108 100 108 C84 108 68 98 68 78Z" fill="${c.m}"/>
  <ellipse cx="100" cy="90" rx="19" ry="12" fill="${c.l}" stroke="none"/>
  ${both(`${EYE(86, 68, 8, true)}<circle cx="94" cy="86" r="2.2" fill="${INK}" stroke="none"/><path d="M89 97 L92 105 L95 98Z" fill="#fff" stroke-width="2"/>`)}
  <path d="M86 97 Q100 103 114 97" fill="none"/>`;
const tf3 = (c, band = true) => `${both(`<circle cx="72" cy="48" r="13" fill="${c.m}"/><circle cx="72" cy="48" r="6" fill="${c.l}" stroke="none"/>
  <path d="M54 116 C26 120 20 154 36 166 C48 162 52 150 62 142Z" fill="${c.m}"/><circle cx="34" cy="166" r="12" fill="${c.d}"/>
  <path d="M68 166 L90 166 L88 184 L66 184Z" fill="${c.d}"/>`)}
  <path d="M50 176 C44 130 62 100 100 100 C138 100 156 130 150 176Z" fill="${c.m}"/>
  ${both(`<path d="M68 122 Q84 112 98 124 Q84 138 68 130Z" fill="${c.l}"/>`)}
  <path d="M92 144 L108 144 M92 156 L108 156 M100 140 L100 168" fill="none" stroke-width="3"/>
  <path d="M66 72 C64 48 82 34 100 34 C118 34 136 48 134 72 C134 94 118 104 100 104 C82 104 66 94 66 72Z" fill="${c.m}"/>
  <ellipse cx="100" cy="84" rx="17" ry="12" fill="${c.l}"/><ellipse cx="100" cy="78" rx="6" ry="4.5" fill="${INK}" stroke="none"/>
  ${both(EYE(85, 66, 7, true))}
  <path d="M93 90 Q100 95 107 90" fill="none"/>
  ${band ? `<path d="M66 54 Q100 44 134 54 L134 62 Q100 52 66 62Z" fill="${c.a}"/><path d="M133 56 L154 48 L150 66Z" fill="${c.a}"/>` : ''}`;
const gd3 = (c) => `${both(`<path d="M56 108 L30 118 L28 152 L52 156 L58 130Z" fill="${c.m}"/><rect x="22" y="148" width="34" height="26" rx="8" fill="${c.d}"/>
  <path d="M66 160 L90 160 L90 184 L64 184Z" fill="${c.d}"/>`)}
  <path d="M58 172 L54 112 Q56 100 70 98 L130 98 Q144 100 146 112 L142 172Z" fill="${c.m}"/>
  <path d="M72 110 L128 110 L122 150 L100 160 L78 150Z" fill="${c.d}"/>
  <circle cx="100" cy="130" r="9" fill="${c.a}"/>
  <path d="M76 50 L124 50 Q132 52 132 60 L132 88 Q130 96 122 96 L78 96 Q70 96 68 88 L68 60 Q68 52 76 50Z" fill="${c.m}"/>
  <path d="M76 64 L124 64 L124 78 L76 78Z" fill="${INK}"/>
  ${both(`<circle cx="88" cy="71" r="4.5" fill="${c.a}" stroke="none"/>`)}
  <path d="M136 120 L128 132 L134 140 M64 160 L72 150" fill="none" stroke-width="3"/>`;
const sp3 = (c) => `<path d="M134 164 L176 140 L162 136 L194 100 L150 128 L164 132 L130 154Z" fill="${c.m}"/>
  ${both(`<path d="M70 162 L90 162 L88 184 L68 184Z" fill="${c.d}"/>`)}
  <path d="M66 176 C62 136 76 110 100 110 C124 110 138 136 134 176Z" fill="${c.m}"/>
  <path d="M82 112 L90 124 L96 116 L100 132 L104 116 L110 124 L118 112Z" fill="${c.l}" stroke="none"/>
  <path d="M60 72 L42 58 L62 52 L54 32 L78 42 L84 20 L100 34 L116 20 L122 42 L146 32 L138 52 L158 58 L140 72 L148 92 L126 88 L100 100 L74 88 L52 92Z" fill="${c.a}"/>
  ${both(`<path d="M74 56 L64 16 L94 46Z" fill="${c.m}"/>`)}
  <path d="M70 74 C68 52 84 40 100 40 C116 40 132 52 130 74 C130 94 116 104 100 104 C84 104 70 94 70 74Z" fill="${c.m}"/>
  <path d="M84 84 Q100 106 116 84 Q100 92 84 84Z" fill="${c.l}" stroke="none"/>
  <ellipse cx="100" cy="86" rx="5" ry="3.5" fill="${INK}" stroke="none"/>
  ${both(`${EYE(86, 70, 7, true)}<path d="M72 86 L79 82 L77 88 L84 84" fill="none" stroke="${INK}" stroke-width="2.5"/>`)}
  <path d="M93 94 Q100 98 107 94" fill="none"/>`;

/* ---------- 完全体 ---------- */
const artPw4 = (c) => `${aura('pw4', c.a)}${bigWings(c.d)}${grow(pw3(c, false))}
  ${both(`<path d="M86 30 L74 2 L96 22Z" fill="${c.a}"/>`)}`;
const artTf4 = (c) => `${aura('tf4', c.a)}${both(`<path d="M44 104 L30 92 L56 100Z" fill="#e8e8f0"/>`)}
  ${grow(`${tf3(c)}<rect x="62" y="158" width="76" height="15" rx="4" fill="#f5c542"/><circle cx="100" cy="165" r="10" fill="#fff1b8"/><path d="M95 165 L105 165" fill="none" stroke-width="2.5"/>`)}`;
const artGd4 = (c) => `${aura('gd4', c.a)}
  ${both(`<path d="M18 112 L18 86 L26 86 L26 78 L34 78 L34 86 L42 86 L42 78 L50 78 L50 112Z" fill="${c.d}"/>`)}
  ${grow(gd3(c))}
  <path d="M86 52 L92 26 L100 42 L108 26 L114 52Z" fill="${c.a}"/>`;
const artSp4 = (c) => `${aura('sp4', c.a)}
  ${both(`<path d="M80 112 L30 70 L46 76 L18 42 L62 80 L50 82 L84 104Z" fill="${c.a}"/>`)}${grow(sp3(c))}`;
const artKing = (c) => `${aura('king', '#ff9ef5')}${bigWings(c.d)}${grow(tf3(c, false))}
  <path d="M78 30 L82 10 L92 22 L100 4 L108 22 L118 10 L122 30Z" fill="#f5c542"/>
  <circle cx="100" cy="20" r="3.5" fill="#ff5a4a" stroke="none"/>`;

const ART = {
  egg: artEgg, baby: artBaby, pw2: artPw2, tf2: artTf2, gd2: artGd2, sp2: artSp2,
  pw3: (c) => pw3(c), tf3: (c) => tf3(c), gd3: (c) => gd3(c), sp3: (c) => sp3(c),
  pw4: artPw4, tf4: artTf4, gd4: artGd4, sp4: artSp4, king: artKing,
};
function monSVG(form, skin = '') {
  const f = FORMS[form] || FORMS.egg;
  const c = skin === 'gold' && form !== 'egg' ? PAL.gold : form === 'king' ? PAL.gold : PAL[f.line] || PAL.base;
  return `<svg viewBox="-12 -10 224 210" class="mon-svg" aria-hidden="true">
    <ellipse cx="100" cy="190" rx="56" ry="7" fill="#000" opacity=".28"/>
    <g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${ART[form] ? ART[form](c) : artEgg()}</g>
  </svg>`;
}
