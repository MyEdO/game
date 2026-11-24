/**
 * Les vignettes du carton de récit : une gravure carrée par salle, à l'encre sépia sur parchemin, relevée de cire
 * rouge et d'or. `viewBox` 0 0 140 140, sans `id` : plusieurs peuvent tenir dans la même page.
 */

export type Vignette = 'combat' | 'elite' | 'camp' | 'tresor' | 'boss' | 'retour' | 'reglages' | 'recommencer';

const ENCRE = '#2a1d12', SOMBRE = '#5a4530', LAVIS = '#a58d62', CLAIR = '#efe1bc', ROUGE = '#9c2a1a', OR = '#c39c44';
const T = `stroke="${ENCRE}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
const p = (d: string, fill: string, extra = T) => `<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const trait = (d: string, e = 1.6, couleur = ENCRE, extra = '') => `<path d="${d}" fill="none" stroke="${couleur}" stroke-width="${e}" stroke-linecap="round" stroke-linejoin="round"${extra ? ` ${extra}` : ''}/>`;
const rond = (x: number, y: number, r: number, fill: string, extra = T) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const lavis = (x: number, y: number, rx: number, ry: number, couleur = LAVIS, o = 0.4) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${couleur}" opacity="${o}"/>`;
const miroir = (s: string) => `${s}<g transform="translate(140,0) scale(-1,1)">${s}</g>`;
const SAPINS = p('M6,106L19,60L32,106ZM24,106L41,46L58,106ZM82,106L99,50L116,106ZM108,106L121,64L134,106Z', LAVIS, 'opacity=".7"');
const SOL = trait('M6,109Q70,101 134,109') + trait('M20,118h14M96,121h20M54,125h10', 1, SOMBRE);
const CORNE = p('M46,60C24,56 13,36 21,14C29,34 39,44 53,50Z', SOMBRE);

const epee = p('M43.6,95.9L96.8,34.4L104,30L100.8,37.8L48.4,100.1Z', CLAIR) + trait('M48,95.5L98,37.5', 0.8, SOMBRE) + trait('M37.6,90.9L54.4,105.1', 3.6)
  + trait('M46,98L36.5,109.5', 3.4, SOMBRE) + rond(35, 111.4, 3.2, OR);

/** La dent d'une roue : huit crans autour de (70, 62). */
function roue(): string {
  let d = '';
  for (let k = 0; k < 8; k++) for (const [a, r] of [[-13, 33], [-8, 43], [8, 43], [13, 33]]) { const t = ((k * 45 + a) * Math.PI) / 180; d += `${d ? 'L' : 'M'}${(70 + r * Math.sin(t)).toFixed(1)},${(62 - r * Math.cos(t)).toFixed(1)}`; }
  return p(`${d}Z`, LAVIS, `${T} opacity=".75"`) + rond(70, 62, 14, '#d6c196');
}

const SCENES: Record<Vignette, [string, () => string]> = {
  combat: ['Le combat', () => lavis(70, 62, 58, 44) + SAPINS + SOL + miroir(epee) + trait('M70,57v-11M60,62l-9,-6M80,62l9,-6M64,52l-4,-7M76,52l4,-7', 1.8, ROUGE)],
  elite: ['Un adversaire d’élite', () => lavis(70, 70, 60, 56)
    + p('M70,20L114,33V70C114,97 93,115 70,126C47,115 26,97 26,70V33Z', LAVIS, `${T} opacity=".6"`) + miroir(CORNE)
    + p('M70,44C65,29 72,16 85,11C81,22 81,33 75,44Z', ROUGE) + p('M47,98V63C47,39 93,39 93,63V98L70,109Z', CLAIR)
    + p('M54,66H86V73L72,71V90H68V71L54,73Z', ENCRE, '') + trait('M47,58Q70,50 93,58M70,41V52', 1.2, SOMBRE)
    + rond(52, 84, 1.3, ENCRE, '') + rond(88, 84, 1.3, ENCRE, '') + rond(78, 80, 0.9, ENCRE, '') + rond(82, 86, 0.9, ENCRE, '') + rond(78, 92, 0.9, ENCRE, '')],
  camp: ['Le campement', () => lavis(74, 70, 60, 46) + rond(106, 30, 11, CLAIR) + rond(111, 27, 9, '#d6c196', '') + SAPINS + SOL
    + trait('M22,26h4M24,24v4M56,18h4M58,16v4M84,40h3M85.5,38.5v3', 1, SOMBRE)
    + p('M26,106L60,48L94,106Z', CLAIR) + p('M60,64L50,106H70Z', SOMBRE) + trait('M60,48v-9M60,48L40,106M60,48L80,106', 1, SOMBRE) + p('M60,39l12,3 -12,4z', ROUGE)
    + lavis(108, 100, 22, 18, ROUGE, 0.14) + trait('M95,111l26,-7M96,104l24,9', 3.6, SOMBRE)
    + p('M107,104C98,95 105,88 102,76C111,83 116,91 114,104Z', ROUGE) + p('M108,104C104,98 108,94 107,88C112,93 113,98 111,104Z', '#e2c06a', '')
    + rond(98, 70, 1, ROUGE, '') + rond(115, 66, 0.8, ROUGE, '') + rond(108, 58, 0.7, ROUGE, '')],
  tresor: ['Un trésor', () => lavis(70, 76, 60, 50) + p('M70,76L16,26L34,14ZM70,76L59,8H81ZM70,76L106,14L124,26Z', CLAIR, 'opacity=".75"')
    + p('M30,80L37,50Q70,36 103,50L110,80Z', SOMBRE) + trait('M48,45L44,80M92,45L96,80', 1.2, ENCRE)
    + [[46, 77], [58, 73], [72, 77], [84, 72], [96, 77], [66, 68], [78, 66], [90, 68], [54, 68]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7.5" ry="3.6" fill="#e2c06a" ${T}/>`).join('')
    + p('M70,66l5,-8 5,8 -5,6z', ROUGE) + p('M28,80H112V118H28Z', LAVIS) + trait('M44,80V118M96,80V118M28,92H112', 1.2)
    + p('M63,86h14v15h-14z', OR) + trait('M70,91v5', 2.2) + trait('M8,124Q70,118 132,124')
    + `<ellipse cx="20" cy="121" rx="6.5" ry="3" fill="#e2c06a" ${T}/><ellipse cx="121" cy="123" rx="6.5" ry="3" fill="#e2c06a" ${T}/>`],
  boss: ['Le maître des lieux', () => lavis(70, 72, 62, 60, SOMBRE, 0.5) + miroir(CORNE)
    + p('M70,36C46,36 36,54 36,72C36,86 42,94 50,98V114H90V98C98,94 104,86 104,72C104,54 94,36 70,36Z', CLAIR)
    + p('M47,46L42,22L57,33L70,15L83,33L98,22L93,46Q70,38 47,46Z', OR) + rond(70, 31, 2.6, ROUGE) + rond(51, 35, 1.8, ROUGE) + rond(89, 35, 1.8, ROUGE)
    + `<ellipse cx="55" cy="74" rx="9.5" ry="10.5" fill="${ENCRE}"/><ellipse cx="85" cy="74" rx="9.5" ry="10.5" fill="${ENCRE}"/>` + rond(56, 75, 2.8, '#e0452a', '') + rond(84, 75, 2.8, '#e0452a', '')
    + p('M70,84l-5,10h10z', ENCRE, '') + trait('M50,103H90M58,100v14M66,101v13M74,101v13M82,100v14', 1.3) + trait('M80,48l-4,9 6,5-3,6', 1, SOMBRE)],
  retour: ['Le retour au hameau', () => lavis(70, 60, 60, 36, OR, 0.3) + p('M38,86A32,32 0 0 1 102,86Z', '#e2c06a', `${T} opacity=".9"`)
    + trait('M70,46V36M44,58l-8,-7M96,58l8,-7M30,78H20M110,78h10', 1.4, OR) + trait('M20,30q5,-5 9,0q5,-5 9,0M104,24q4,-4 7,0q4,-4 7,0', 1.2, SOMBRE)
    + p('M6,90Q38,76 70,88T134,84V134H6Z', LAVIS, 'opacity=".7"') + trait('M6,90Q38,76 70,88T134,84', 1.2, SOMBRE)
    + p('M46,88V75l7,-7 7,7V88ZM62,88V62l5,-14 5,14V88ZM74,88V77l8,-7 8,7V88Z', SOMBRE) + trait('M67,48v-7M64,44h6', 1.3)
    + p('M51,78h4v5h-4zM80,79h4v5h-4zM65.5,68h3v5h-3z', '#e2c06a', '')
    + p('M54,134C58,114 64,100 68,90H73C80,102 92,116 104,134Z', CLAIR) + trait('M66,128C67,114 69,102 70,94M84,130C80,116 75,104 72,96', 0.9, SOMBRE)
    + trait('M116,132V96', 3.4, SOMBRE) + p('M128,98H104l-8,7 8,7h24z', CLAIR) + trait('M106,105h16', 1, SOMBRE)],
  reglages: ['Les réglages', () => lavis(70, 66, 58, 52) + roue()
    + p('M38,100h36l7,24H31Z', SOMBRE) + p('M44,90h24v10H44z', LAVIS) + `<ellipse cx="56" cy="90" rx="12" ry="3.4" fill="${ENCRE}"/>`
    + p('M58,92C68,62 90,34 120,16C116,44 98,72 66,94Z', CLAIR) + trait('M56,96L114,24', 1.6) + trait('M74,74l-8,-4M84,62l-9,-5M94,50l-9,-6M104,38l-8,-6M82,76l9,-2M92,64l9,-1M102,52l8,-1', 0.9, SOMBRE)
    + trait('M10,126Q70,120 130,126')],
  recommencer: ['Recommencer', () => lavis(70, 70, 58, 56)
    + trait('M70,14A56,56 0 1 1 22,42', 4, LAVIS) + p('M33,30L12,38L27,54Z', LAVIS)
    + p('M50,35C50,57 66,62 66,70C66,78 50,83 50,105H90C90,83 74,78 74,70C74,62 90,57 90,35Z', CLAIR)
    + p('M56,48C60,57 66,61 70,67C74,61 80,57 84,48Z', OR, '') + trait('M70,67V96', 1.4, OR) + p('M54,105C58,96 66,92 70,92C74,92 82,96 86,105Z', OR, '')
    + p('M42,27h56v8H42zM42,105h56v8H42z', SOMBRE) + trait('M47,35V105M93,35V105', 2.6, SOMBRE) + trait('M56,40C57,48 60,52 63,55', 1, '#fff', 'opacity=".7"')],
};

/** La gravure d'une salle (ou d'un carton de l'hôte : retour, réglages, recommencer), en `<svg>` carré. */
export function vignetteDeSalle(type: Vignette): string {
  const [titre, scene] = SCENES[type];
  return `<svg class="vignette-salle" viewBox="0 0 140 140" width="100%" height="100%" role="img" aria-label="${titre}"><rect width="140" height="140" fill="#d6c196"/>${lavis(34, 30, 44, 30, CLAIR, 0.55)}${lavis(112, 118, 40, 26, '#b89f6e', 0.4)}${scene()}<rect x="2.5" y="2.5" width="135" height="135" fill="none" stroke="${ENCRE}" stroke-width="2"/><rect x="6" y="6" width="128" height="128" fill="none" stroke="${ENCRE}" stroke-width=".7" opacity=".7"/></svg>`;
}
