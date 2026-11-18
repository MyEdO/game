/* La cour du combat, images d'intention (#3935) : le champ de bataille, une cour de ruine en isométrie, et ses pions,
   à l'état que l'écran nomme (`#ecran` : `data-etat`, sinon `data-variante`). L'écran de combat (`combat.js`) y pose son
   interface, la page de rendu des maquettes (`../rendu.js`) son décor `cour`. Se charge après `../gestes.js`, `jet.js` et
   `socle.js`. Maquette hors du jeu : le champ de bataille est dessiné, il ne prétend pas être le rendu du moteur. */
const ECRAN = document.getElementById('ecran');
/* la case d'une cible désignée, partagée par la Suite du combat */
const caseDeCible = (i, j) => { const [x, y] = P(i, j); return { class: 'case-cible', d: losange(x, y, A - 3, B - 1.5), fill: '#9c2a1a', 'fill-opacity': .34, stroke: '#d2553a', 'stroke-width': 2.4 }; };
/* un état neuf se range sous l'un des deux socles : le meuble de l'actif (« tour ») ou le bandeau (« jet ») */
const NEUFS = {
  'tour-adverse': ['tour', 'adverse'], 'cible-survolee': ['tour', 'cible'], 'journal-ouvert': ['tour', 'journal'], 'fiche-au-clic': ['tour', 'fiche'],
  'jet-avant-le-de': ['jet', 'avant'], 'jet-de-defense': ['jet', 'defense'], incantation: ['jet', 'incantation'], 'coup-critique': ['jet', 'critique'],
  'debut-du-round': ['jet', 'round'], 'fin-victoire': ['jet', 'victoire'], 'fin-defaite': ['jet', 'defaite'],
  'defense-avant-le-de': ['jet', 'parade'], 'defense-riposte': ['jet', 'riposte'],
  'meuble-engage-a-terre': ['tour', 'aTerre'], 'meuble-tireur': ['tour', 'tireur'], 'meuble-chef-de-piece': ['tour', 'piece'],
  determination: ['jet', 'determination'], 'determination-etat': ['jet', 'retirer'],
  'jet-avant-le-de-armes': ['jet', 'armes'], 'jet-avant-le-de-empoigner': ['jet', 'empoigner'],
  'fin-repli': ['jet', 'repli'], 'fin-aneantissement': ['jet', 'aneantissement'],
  'seconde-frappe': ['jet', 'seconde'], 'frappe-mortelle': ['jet', 'mortelle'], 'debut-du-round-tir-rapide': ['jet', 'tirRapide'],
  'defense-sociale': ['jet', 'sociale'], 'jet-avant-le-de-harpon': ['jet', 'harpon'], 'localisation-du-critique': ['jet', 'localiser'],
  'cible-montee': ['jet', 'montee'], 'visee-de-siege': ['jet', 'siege'],
};
const [ETAT, VAR] = NEUFS[ECRAN.dataset.etat] ?? [ECRAN.dataset.etat, ECRAN.dataset.variante || ''];
ECRAN.dataset.socle = ETAT;
const est = (...v) => v.includes(VAR);
const FIN = est('victoire', 'defaite', 'repli', 'aneantissement');
const PERDU = FIN && VAR !== 'victoire';
const ADVERSE = est('adverse', 'defense', 'parade', 'riposte', 'sociale');
const DEBUT = est('round', 'tirRapide');
/* les états où Berta porte le geste, et ceux où elle est À Terre au contact de l'Orc */
const BERTA_JOUE = est('parade', 'riposte', 'sociale', 'aTerre', 'tireur', 'piece', 'determination', 'retirer', 'armes', 'empoigner', 'harpon', 'localiser', 'seconde', 'mortelle', 'montee', 'siege');
/* les états où l'Orc se tient au loin : Berta tire, sert une pièce ou fait face à un autre */
const AU_LOIN = est('tireur', 'piece', 'montee', 'siege');
const COUCHEE = est('aTerre', 'determination', 'retirer');
const SURVOL = ETAT === 'tour' && (!VAR || VAR === 'cible');
/* ───────── le champ de bataille : une cour de ruine, en isométrie ───────── */
grad('nuit', [[0, '#0a0c16'], [.5, '#12131f'], [1, '#15131a']]);
grad('feu', [[0, '#ffdf9a', .85], [.16, '#ffb65a', .55], [.45, '#e07a2c', .2], [1, '#e07a2c', 0]], { cx: .5, cy: .5, r: .5 }, 'radialGradient');
grad('coeur', [[0, '#fff3c8', .95], [.3, '#ffc76e', .6], [1, '#ff9a3a', 0]], { cx: .5, cy: .5, r: .5 }, 'radialGradient');
grad('droite', [[0, '#000', .7], [.55, '#000', .35], [1, '#000', 0]], { cx: .5, cy: .5, r: .5 }, 'radialGradient');
grad('froid', [[0, '#2a3a6a', 0], [1, '#2a3a6a', .55]], { cx: .5, cy: .5, r: .5 }, 'radialGradient');
grad('ciel', [[0, '#080a14', .78], [1, '#080a14', 0]]);
const teinte = (id, clair, sombre) => grad(id, [[0, clair], [.55, sombre], [1, melange(sombre, '#000000', .35)]], { x1: 0, y1: 0, x2: 1, y2: 1 });
teinte('t-robe', '#7c88ad', '#2b3350'); teinte('t-cuir', '#b98a58', '#5a3d2a'); teinte('t-orc', '#7b8f5c', '#2f3a26'); teinte('t-gob', '#8ea064', '#3b4a2b');
teinte('t-bois', '#8a6a44', '#3f2c1a');


// l'extérieur : la nuit et la lisière, derrière les murs
el(S, 'rect', { width: W, height: H, fill: 'url(#nuit)' });
{
  const r = alea(3); const murY = (x) => (x < OX + 230 ? OY + 138 - (x - OX) / 2 : OY - 92 + (x - OX) / 2);
  const arbres = []; for (let n = 0; n < 150; n++) { const x = r() * W; const y = murY(x) - 26 - r() * 170; if (y > -10) arbres.push([x, y, 46 + r() * 70, r()]); }
  arbres.sort((p, q) => p[1] - q[1]);
  for (const [x, y, h, t] of arbres) {
    const w = h * .34; let d = `M${x},${y - h}`; const n = 5;
    for (let k = 1; k <= n; k++) { const yy = y - h + h * .94 * k / n, ww = w * k / n; d += `L${x + ww * .55},${yy - h * .035}L${x + ww},${yy}L${x + ww * .35},${yy - h * .02}`; }
    for (let k = n; k >= 1; k--) { const yy = y - h + h * .94 * k / n, ww = w * k / n; d += `L${x - ww * .35},${yy - h * .02}L${x - ww},${yy}L${x - ww * .55},${yy - h * .035}`; }
    el(S, 'path', { d: d + 'Z', fill: melange('#0c0e18', '#1a1d2b', t * .8) });
  }
  el(S, 'rect', { width: W, height: 380, fill: 'url(#ciel)' });
}

// le sol : des dalles
{
  const r = alea(17); const g = el(S, 'g', { stroke: '#1b1921', 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
  for (let i = 4; i < 44; i++) for (let j = -1; j < 44; j++) {
    const [x, y] = P(i, j); if (x < -A || x > W + A || y < -B || y > H + B) continue;
    const t = r(); const mousse = r() < .13;
    el(g, 'path', { d: losange(x, y), fill: mousse ? melange('#4a4f47', '#565b4f', t) : melange('#45434f', '#5d5a66', t) });
    const k = r();
    if (k < .22) el(g, 'path', { d: `M${x - A / 2},${y - B / 2}L${x + A / 2},${y + B / 2}`, opacity: .8 });
    else if (k < .4) el(g, 'path', { d: `M${x + A / 2},${y - B / 2}L${x - A / 2},${y + B / 2}`, opacity: .8 });
    else if (k < .47) el(g, 'path', { d: `M${x - 14},${y - 4}l9,5l-3,6l8,4`, fill: 'none', opacity: .7, 'stroke-width': 1 });
    if (r() < .08) el(g, 'path', { d: `M${x - 10 + r() * 20},${y + 4}q2,-9 4,0q2,-7 4,0`, fill: 'none', stroke: '#6a7355', 'stroke-width': 1.2, opacity: .8 });
  }
}
// le brasero éclaire la cour
const FEU = P(8, 5);
el(S, 'ellipse', { cx: FEU[0] + 6, cy: FEU[1] + 60, rx: 520, ry: 290, fill: 'url(#feu)', style: 'mix-blend-mode:screen' });

el(S, 'ellipse', { cx: FEU[0] + 6, cy: FEU[1] + 100, rx: 1500, ry: 800, fill: 'url(#froid)', style: 'mix-blend-mode:soft-light' });

// ce que le tour dessine au sol
const HEROS = BERTA_JOUE ? [12, 7] : ETAT === 'tour' || VAR === 'incantation' || VAR === 'defense' ? [10, 8] : [13, 6];
const BERTA = VAR === 'mortelle' ? [11, 9] : [10, 9];
const ORC = VAR === 'mortelle' ? [11, 10] : VAR === 'harpon' ? [13, 9] : BERTA_JOUE && !AU_LOIN ? [9, 9] : ADVERSE ? [11, 7] : [14, 6];
const MONTURE = [9, 9], PIECE = [11, 9];
const GOBELIN = VAR === 'seconde' ? [11, 9] : VAR === 'montee' ? MONTURE : [12, -1];
/* AA 10 l.169, l.171 : la case que le curseur survole, centre de l'aire du tir indirect */
const IMPACT = [14, 6];
const SUJET = BERTA_JOUE ? BERTA : HEROS;
const CIBLES = FIN || est('round', 'determination', 'retirer', 'siege') ? [] : est('seconde', 'tirRapide') ? [ORC, GOBELIN] : VAR === 'montee' ? [GOBELIN] : SURVOL || ETAT === 'jet' ? [ORC] : [];
const OCCUPE = new Set([HEROS, BERTA, ORC, ...(VAR === 'tireur' ? [MONTURE] : []), ...(est('tireur', 'piece') ? [PIECE] : [])].map(String).concat('8,5', '5,10', '6,11', '12,3', '13,3'));
/* LDB 16 l.35 : À Terre, le Mouvement ne sert qu'à se relever ou à ramper de sa moitié */
const PORTEE = COUCHEE ? 2 : 4;
{
  const g = el(S, 'g');
  if (VAR === 'adverse' || DEBUT || FIN) {
    // rien au sol : personne ne vise ni ne marche
  } else if (ETAT === 'tour') {
    // les cases atteignables : une teinte et un liseré
    const [si, sj] = SUJET, bord = 2 * PORTEE + 1;
    for (let i = si - PORTEE; i <= si + PORTEE; i++) for (let j = sj - PORTEE; j <= sj + PORTEE; j++) if (!OCCUPE.has(`${i},${j}`)) { const [x, y] = P(i, j); el(g, 'path', { d: losange(x, y, A - 1.5, B - .8), fill: '#efe2bd', opacity: .105 }); }
    const [cx, cy] = P(si, sj);
    el(g, 'path', { d: losange(cx, cy, bord * A, bord * B), fill: 'none', stroke: '#000', 'stroke-width': 5, opacity: .35, filter: 'url(#f2)' });
    el(g, 'path', { d: losange(cx, cy, bord * A, bord * B), fill: 'none', stroke: '#efe2bd', 'stroke-width': 1.6, opacity: .8 });
    if (SURVOL) {
    const pas = [[10, 8], [11, 7], [12, 6], [13, 6]].map(([i, j]) => P(i, j));
    const d = 'M' + pas.map((p) => p.join(',')).join('L');
    el(g, 'path', { d, fill: 'none', stroke: '#000', 'stroke-width': 7, opacity: .4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#f1)' });
    el(g, 'path', { d, fill: 'none', stroke: '#f6ecd0', 'stroke-width': 3.2, 'stroke-dasharray': '1 10', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const [ax, ay] = pas[3];
    el(g, 'path', { d: losange(ax, ay, A - 3, B - 1.5), fill: '#efe2bd', 'fill-opacity': .16, stroke: '#f6ecd0', 'stroke-width': 2 });
    }
  } else {
    const [ax, ay] = P(...SUJET);
    el(g, 'path', { d: losange(ax, ay, A - 3, B - 1.5), fill: '#efe2bd', 'fill-opacity': .14, stroke: '#f6ecd0', 'stroke-width': 2 });
  }
  // les cases des cibles
  for (const c of CIBLES) el(g, 'path', caseDeCible(...c));
  // l'aire du tir indirect, d'une case de rayon autour de la case survolée
  if (VAR === 'siege') for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) el(g, 'path', { ...caseDeCible(IMPACT[0] + i, IMPACT[1] + j), 'fill-opacity': i || j ? .2 : .5, 'stroke-width': i || j ? 1.2 : 2.4 });
}

// une boîte isométrique : dessus, face sud-ouest (éclairée), face sud-est (à l'ombre)
function boite(g, cx, cy, a, b, h, [dessus, so, se], assises = 0) {
  const tr = { stroke: '#15131a', 'stroke-width': .9, 'stroke-linejoin': 'round' };
  el(g, 'path', { d: `M${cx - a},${cy - h}L${cx},${cy + b - h}L${cx},${cy + b}L${cx - a},${cy}Z`, fill: so, ...tr });
  el(g, 'path', { d: `M${cx},${cy + b - h}L${cx + a},${cy - h}L${cx + a},${cy}L${cx},${cy + b}Z`, fill: se, ...tr });
  el(g, 'path', { d: `M${cx},${cy - b - h}L${cx + a},${cy - h}L${cx},${cy + b - h}L${cx - a},${cy - h}Z`, fill: dessus, ...tr });
  for (let k = 1; k <= assises; k++) { const t = h * k / (assises + 1); el(g, 'path', { d: `M${cx - a},${cy - h + t}L${cx},${cy + b - h + t}L${cx + a},${cy - h + t}`, fill: 'none', stroke: '#15131a', 'stroke-width': .8, opacity: .55 }); }
}
const PIERRE = ['#8a8694', '#5c5966', '#33313c'];
const pierre = (t) => PIERRE.map((c) => melange(c, '#2a2833', t * .35));

// les murs bas, au fond
{
  const r = alea(29); const g = el(S, 'g'); const murs = [];
  for (let i = 4; i <= 24; i++) { if (i === 8 || i === 9) continue; let h = 34 + r() * 6; if (i === 7 || i === 10) h = 80; if (i === 15) h = 24; if (i === 16) h = 13; if (i === 17) h = 30; murs.push([i, -2, h]); }
  for (let j = -2; j <= 21; j++) { let h = 34 + r() * 6; if (j === -2) h = 92; if (j === 3) h = 74; if (j === 7) h = 20; if (j === 8) h = 11; if (j === 9) h = 28; if (j === 14) h = 70; murs.push([3, j, h]); }
  murs.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
  for (const [i, j, h] of murs) { const [x, y] = P(i, j); boite(g, x, y, A, B, h, pierre(r()), h > 30 ? 3 : 1); }
}

{ const [x, y] = P(10, -2); const g = el(S, 'g'); const t = y - 80;
  el(g, 'path', { d: `M${x - 39},${t + 9}L${x - 7},${t + 25}L${x - 7},${t + 70}L${x - 15},${t + 60}L${x - 23},${t + 68}L${x - 31},${t + 54}L${x - 39},${t + 58}Z`, fill: '#7c1f14', stroke: '#2a0b06', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x - 39},${t + 9}L${x - 7},${t + 25}L${x - 7},${t + 31}L${x - 39},${t + 15}Z`, fill: '#d9c69b', opacity: .85 });
  el(g, 'path', { d: `M${x - 28},${t + 20}L${x - 28},${t + 58}M${x - 17},${t + 26}L${x - 17},${t + 62}`, stroke: '#4a110a', 'stroke-width': 2.5, opacity: .6 });
}

// les objets et les pions, du fond vers l'avant
const objets = [];
const objet = (i, j, dessine) => objets.push({ z: i + j, dessine, p: P(i, j) });
objet(8, 5, (g, [x, y]) => { // le brasero
  el(g, 'ellipse', { cx: x, cy: y + 3, rx: 20, ry: 9, fill: '#000', opacity: .5, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 13},${y + 2}L${x - 5},${y - 30}M${x + 13},${y + 2}L${x + 5},${y - 30}M${x},${y + 7}L${x},${y - 30}`, stroke: '#141214', 'stroke-width': 3.2, 'stroke-linecap': 'round' });
  el(g, 'path', { d: `M${x - 19},${y - 40}Q${x},${y - 12} ${x + 19},${y - 40}Z`, fill: '#1b181a', stroke: '#0a0909', 'stroke-width': 1 });
  el(g, 'ellipse', { cx: x, cy: y - 40, rx: 19, ry: 6.5, fill: '#3a1c0c', stroke: '#0a0909', 'stroke-width': 1 });
  el(g, 'circle', { cx: x, cy: y - 52, r: 62, fill: 'url(#coeur)', style: 'mix-blend-mode:screen' });
  el(g, 'path', { d: `M${x - 11},${y - 41}C${x - 15},${y - 56} ${x - 5},${y - 60} ${x - 6},${y - 74}C${x + 2},${y - 66} ${x + 1},${y - 58} ${x + 5},${y - 66}C${x + 13},${y - 56} ${x + 13},${y - 48} ${x + 10},${y - 41}Z`, fill: '#f08a2c' });
  el(g, 'path', { d: `M${x - 6},${y - 41}C${x - 8},${y - 52} ${x - 1},${y - 54} ${x - 1},${y - 63}C${x + 6},${y - 55} ${x + 7},${y - 48} ${x + 5},${y - 41}Z`, fill: '#ffd778' });
});
objet(5, 10, (g, [x, y]) => { // la colonne brisée
  el(g, 'ellipse', { cx: x + 6, cy: y + 5, rx: 26, ry: 11, fill: '#000', opacity: .45, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 22},${y - 4}L${x - 22},${y + 2}A22,10 0 0 0 ${x + 22},${y + 2}L${x + 22},${y - 4}Z`, fill: '#4a4753', stroke: '#15131a', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x - 16},${y - 66}L${x - 16},${y - 4}A16,7 0 0 0 ${x + 16},${y - 4}L${x + 16},${y - 52}L${x + 8},${y - 60}L${x + 2},${y - 50}L${x - 6},${y - 64}Z`, fill: '#6a6773', stroke: '#15131a', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x + 3},${y - 50}L${x + 3},${y + 3}M${x + 10},${y - 56}L${x + 10},${y + 1}`, stroke: '#33313c', 'stroke-width': 5, opacity: .55 });
  el(g, 'path', { d: `M${x - 9},${y - 62}L${x - 9},${y + 1}M${x - 3},${y - 56}L${x - 3},${y + 2}`, stroke: '#8f8b99', 'stroke-width': 2, opacity: .5 });
});
objet(6, 11, (g, [x, y]) => { // son tambour tombé
  el(g, 'ellipse', { cx: x + 4, cy: y + 6, rx: 24, ry: 9, fill: '#000', opacity: .4, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 20},${y - 8}L${x + 8},${y + 6}A9,13 0 0 0 ${x + 12},${y - 18}L${x - 14},${y - 30}A9,12 0 0 0 ${x - 20},${y - 8}Z`, fill: '#5c5966', stroke: '#15131a', 'stroke-width': .9 });
  el(g, 'ellipse', { cx: x + 10, cy: y - 6, rx: 8, ry: 12.5, fill: '#7d7987', stroke: '#15131a', 'stroke-width': .9, transform: `rotate(-12 ${x + 10} ${y - 6})` });
});
for (const [i, j, h] of [[12, 3, 27], [13, 3, 20]]) objet(i, j, (g, [x, y]) => boite(g, x, y, A, B, h, pierre(.2), 1)); // un muret
objet(16, 9, (g, [x, y]) => { // des caisses
  el(g, 'ellipse', { cx: x + 6, cy: y + 8, rx: 40, ry: 16, fill: '#000', opacity: .4, filter: 'url(#f2)' });
  const bois = ['#8a6a44', '#6a4c2e', '#3f2c1a'];
  boite(g, x - 10, y - 2, 27, 13.5, 32, bois, 2); boite(g, x + 20, y + 9, 22, 11, 24, bois, 1); boite(g, x - 8, y - 34, 19, 9.5, 20, bois, 1);
});
objet(17, 9, (g, [x, y]) => { // un tonneau
  el(g, 'ellipse', { cx: x + 14, cy: y + 8, rx: 22, ry: 9, fill: '#000', opacity: .4, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 4},${y - 36}Q${x - 8},${y - 16} ${x - 4},${y + 3}A15,6.500 0 0 0 ${x + 26},${y + 3}Q${x + 30},${y - 16} ${x + 26},${y - 36}Z`, fill: 'url(#t-bois)', stroke: '#15100a', 'stroke-width': .9 });
  el(g, 'ellipse', { cx: x + 11, cy: y - 36, rx: 15, ry: 6.5, fill: '#6a4c2e', stroke: '#15100a', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x - 6},${y - 24}A17,7 0 0 0 ${x + 28},${y - 24}M${x - 6},${y - 8}A17,7 0 0 0 ${x + 28},${y - 8}`, fill: 'none', stroke: '#1d1b1a', 'stroke-width': 2.4 });
});

const cheval = (g, [x, y]) => { // un cheval de monte
  el(g, 'ellipse', { cx: x + 6, cy: y + 5, rx: 40, ry: 13, fill: '#000', opacity: .45, filter: 'url(#f2)' });
  el(g, 'path', { d: `M${x - 22},${y - 30}L${x - 24},${y}M${x - 10},${y - 28}L${x - 10},${y + 5}M${x + 14},${y - 28}L${x + 13},${y}M${x + 24},${y - 30}L${x + 26},${y + 5}`, stroke: '#3f2c1a', 'stroke-width': 5, 'stroke-linecap': 'round' });
  el(g, 'path', { d: `M${x - 30},${y - 40}C${x - 30},${y - 56} ${x + 24},${y - 58} ${x + 30},${y - 44}C${x + 32},${y - 30} ${x - 26},${y - 26} ${x - 30},${y - 40}Z`, fill: 'url(#t-bois)', stroke: '#1d130b', 'stroke-width': .9 });
  el(g, 'path', { d: `M${x + 16},${y - 50}L${x + 30},${y - 78}L${x + 50},${y - 68}L${x + 47},${y - 60}L${x + 37},${y - 62}L${x + 31},${y - 42}Z`, fill: '#8a6a44', stroke: '#1d130b', 'stroke-width': .9, 'stroke-linejoin': 'round' });
  el(g, 'path', { d: `M${x + 29},${y - 79}L${x + 27},${y - 87}L${x + 34},${y - 80}M${x - 30},${y - 44}Q${x - 42},${y - 34} ${x - 38},${y - 14}`, fill: 'none', stroke: '#2a1d12', 'stroke-width': 3, 'stroke-linecap': 'round' });
  el(g, 'path', { d: `M${x - 8},${y - 54}Q${x + 2},${y - 60} ${x + 12},${y - 54}L${x + 10},${y - 44}L${x - 6},${y - 44}Z`, fill: '#7c1f14', stroke: '#2a0b06', 'stroke-width': .8 });
};
if (VAR === 'tireur') objet(...MONTURE, cheval);
if (est('tireur', 'piece')) objet(...PIECE, (g, [x, y]) => { // une baliste
  const bois = ['#8a6a44', '#6a4c2e', '#3f2c1a'];
  el(g, 'ellipse', { cx: x + 5, cy: y + 6, rx: 38, ry: 15, fill: '#000', opacity: .45, filter: 'url(#f2)' });
  boite(g, x, y - 2, 30, 15, 16, bois, 1);
  el(g, 'path', { d: `M${x - 20},${y - 40}L${x + 30},${y - 15}`, stroke: '#3f2c1a', 'stroke-width': 6, 'stroke-linecap': 'round' });
  el(g, 'path', { d: `M${x - 22},${y - 14}Q${x + 2},${y - 46} ${x + 40},${y - 44}`, fill: 'none', stroke: '#6a4c2e', 'stroke-width': 4, 'stroke-linecap': 'round' });
  el(g, 'path', { d: `M${x - 22},${y - 14}L${x - 18},${y - 39}L${x + 40},${y - 44}`, fill: 'none', stroke: '#d8cdb4', 'stroke-width': 1 });
  el(g, 'path', { d: `M${x - 18},${y - 41}L${x + 36},${y - 14}`, stroke: '#d5d8de', 'stroke-width': 2, 'stroke-linecap': 'round' });
});

if (VAR === 'siege') objet(...PIECE, (g, [x, y]) => { // un mortier
  el(g, 'ellipse', { cx: x + 5, cy: y + 6, rx: 36, ry: 14, fill: '#000', opacity: .45, filter: 'url(#f2)' });
  boite(g, x, y - 2, 28, 14, 12, ['#8a6a44', '#6a4c2e', '#3f2c1a'], 1);
  el(g, 'path', { d: `M${x - 14},${y - 14}L${x + 12},${y - 52}L${x + 30},${y - 42}L${x + 10},${y - 6}Z`, fill: '#3a3835', stroke: '#0f0e0d', 'stroke-width': 1, 'stroke-linejoin': 'round' });
  el(g, 'ellipse', { cx: x + 21, cy: y - 47, rx: 10.5, ry: 5.5, fill: '#0f0e0d', stroke: '#6b6862', 'stroke-width': 1.4, transform: `rotate(29 ${x + 21} ${y - 47})` });
  el(g, 'path', { d: `M${x - 9},${y - 20}L${x + 15},${y - 8}M${x - 2},${y - 31}L${x + 21},${y - 19}`, stroke: '#6b6862', 'stroke-width': 2.2 });
});
const path = (f, d, fill, extra = {}) => el(f, 'path', { d, fill, ...extra });
const FIGURES = {
  ilyanwe: (f) => {
    el(f, 'path', { d: 'M15,3L18,-92', stroke: '#6b5234', 'stroke-width': 2.8, 'stroke-linecap': 'round' });
    path(f, 'M-12,0C-14,-24 -11,-46 -8,-58C-6,-64 6,-64 8,-58C11,-46 14,-24 12,0Z', 'url(#t-robe)', { stroke: '#11131f', 'stroke-width': .8 });
    path(f, 'M8,-56L16,-36L12,-33L5,-48Z', '#3a4468');
    el(f, 'circle', { cx: 0, cy: -69, r: 7, fill: '#dcc4a8' });
    path(f, 'M-9,-66C-10,-81 10,-81 9,-66C12,-56 11,-45 8,-38L5,-58C3,-63 -3,-63 -5,-58L-8,-38C-11,-45 -12,-56 -9,-66Z', '#cfd4e4', { stroke: '#6a718c', 'stroke-width': .7 });
    el(f, 'circle', { cx: 18, cy: -93, r: 3.2, fill: '#d8cdb4', stroke: '#3a2c1a', 'stroke-width': .7 });
  },
  berta: (f) => {
    el(f, 'path', { d: 'M13,-30L23,-60', stroke: '#d5d8de', 'stroke-width': 2.6, 'stroke-linecap': 'round' });
    el(f, 'path', { d: 'M9,-33L18,-29', stroke: '#3a2c1a', 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    path(f, 'M-13,0C-15,-20 -13,-38 -9,-48C-7,-54 7,-54 9,-48C13,-38 15,-20 13,0Z', 'url(#t-cuir)', { stroke: '#1d130b', 'stroke-width': .8 });
    el(f, 'circle', { cx: 0, cy: -59, r: 7.2, fill: '#d6b596' });
    path(f, 'M-8,-59C-9,-71 9,-71 8,-59C4,-64 -4,-64 -8,-59Z', '#4a2f1b');
    el(f, 'ellipse', { cx: -12, cy: -27, rx: 9.5, ry: 13.5, fill: '#6f4d30', stroke: '#1d130b', 'stroke-width': 1 });
    el(f, 'ellipse', { cx: -12, cy: -27, rx: 6, ry: 9.5, fill: 'none', stroke: '#b9b3a4', 'stroke-width': 1, opacity: .7 });
    el(f, 'circle', { cx: -12, cy: -27, r: 2.4, fill: '#b9b3a4' });
  },
  orc: (f) => {
    el(f, 'path', { d: 'M21,-18L30,-76', stroke: '#4a3a28', 'stroke-width': 3.6, 'stroke-linecap': 'round' });
    path(f, 'M26,-80L45,-71L41,-48L30,-55Z', '#aeb2b8', { stroke: '#2a2c30', 'stroke-width': .9 });
    path(f, 'M-19,0C-22,-26 -24,-50 -16,-62C-10,-69 10,-69 16,-62C24,-50 22,-26 19,0Z', 'url(#t-orc)', { stroke: '#10140c', 'stroke-width': .8 });
    path(f, 'M-18,-28L18,-28L17,-22L-17,-22Z', '#2a221b');
    el(f, 'ellipse', { cx: -17, cy: -58, rx: 8.5, ry: 6, fill: '#3a3530', stroke: '#141210', 'stroke-width': .8 });
    el(f, 'ellipse', { cx: 17, cy: -58, rx: 8.5, ry: 6, fill: '#3a3530', stroke: '#141210', 'stroke-width': .8 });
    el(f, 'ellipse', { cx: 0, cy: -71, rx: 10.5, ry: 9, fill: '#7f9a62', stroke: '#1c2414', 'stroke-width': .8 });
    path(f, 'M-9,-68L9,-68L7,-59L-7,-59Z', '#56703f');
    path(f, 'M-6,-61L-5,-68L-2.500,-61ZM6,-61L5,-68L2.500,-61Z', '#efe6d0');
    path(f, 'M-8,-75L-2,-73M8,-75L2,-73', 'none', { stroke: '#1c2414', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
  },
  gobelin: (f) => {
    el(f, 'path', { d: 'M12,-50Q27,-27 12,-4', stroke: '#6b4a2a', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' });
    el(f, 'path', { d: 'M12,-50L12,-4', stroke: '#cfc7b0', 'stroke-width': .8 });
    path(f, 'M-9,0C-11,-13 -9,-25 -6,-31C-4,-35 4,-35 6,-31C9,-25 11,-13 9,0Z', 'url(#t-gob)', { stroke: '#141a0e', 'stroke-width': .8 });
    path(f, 'M-6,-41L-17,-48L-6,-36ZM6,-41L17,-48L6,-36Z', '#86a05e', { stroke: '#1c2414', 'stroke-width': .6 });
    el(f, 'circle', { cx: 0, cy: -39, r: 6.4, fill: '#86a05e', stroke: '#1c2414', 'stroke-width': .6 });
    path(f, 'M-7,-40C-7,-50 7,-50 7,-40C3,-44 -3,-44 -7,-40Z', '#3a2f28');
  },
};
const HAUT = { ilyanwe: 98, berta: 72, orc: 86, gobelin: 54 };
function pion(g, [x, y], { genre, camp, actif, cible, pv, couche = false }) {
  const anneau = camp === 'ennemi' ? '#d2553a' : '#e9dcc0';
  if (actif) el(g, 'ellipse', { cx: x, cy: y, rx: 42, ry: 20, fill: '#ffe2a6', opacity: .5, filter: 'url(#f6)' });
  if (cible) el(g, 'ellipse', { cx: x, cy: y, rx: 42, ry: 20, fill: '#e0553a', opacity: .5, filter: 'url(#f6)' });
  el(g, 'ellipse', { cx: x + 7, cy: y + 6, rx: 28, ry: 12, fill: '#000', opacity: .5, filter: 'url(#f2)' });
  el(g, 'ellipse', { cx: x, cy: y + 4, rx: 24, ry: 11, fill: '#0b0807' });
  el(g, 'ellipse', { cx: x, cy: y, rx: 24, ry: 11, fill: '#201915', stroke: anneau, 'stroke-width': actif || cible ? 3 : 2 });
  FIGURES[genre](el(g, 'g', { transform: couche ? `translate(${x - 30},${y - 9}) rotate(84)` : `translate(${x},${y - 1})` }));
  const yb = y - (couche ? 34 : HAUT[genre]) - 12, w = 38;
  el(g, 'rect', { x: x - w / 2 - 1, y: yb - 1, width: w + 2, height: 6, fill: '#0d0806', stroke: 'rgba(233,220,192,.55)', 'stroke-width': .8, rx: 1 });
  el(g, 'rect', { x: x - w / 2, y: yb, width: w * pv, height: 4, fill: '#b9412c' });
}
const CALME = DEBUT || FIN;
/* LDB 14 l.3 : 10 dégâts − 7 (BE 4 + PA 3) = 3 Blessures du coup, puis 2 du Critique (LDB 18 l.65) */
const PV_ORC = VAR === 'critique' ? 9 : VAR === 'seconde' ? 11 : 14;
const PV_BERTA = COUCHEE ? 9 : 12;
if (!PERDU) {
  objet(...HEROS, (g, p) => pion(g, p, { genre: 'ilyanwe', camp: 'heros', actif: !BERTA_JOUE && !ADVERSE && !CALME, pv: 1 }));
  objet(...BERTA, (g, p) => pion(g, p, { genre: 'berta', camp: 'heros', actif: BERTA_JOUE && !ADVERSE, pv: PV_BERTA / 12, couche: COUCHEE }));
}
if (VAR !== 'victoire') {
  objet(...ORC, (g, p) => pion(g, p, { genre: 'orc', camp: 'ennemi', cible: CIBLES.includes(ORC) || (!CALME && !est('determination', 'retirer', 'montee', 'siege')), pv: PV_ORC / 14 }));
  /* LDB 14 l.180 : le couple monté, le cavalier en selle sur sa monture */
  if (VAR === 'montee') objet(...GOBELIN, (g, [x, y]) => {
    el(g, 'ellipse', { cx: x, cy: y, rx: 48, ry: 22, fill: '#e0553a', opacity: .5, filter: 'url(#f6)' });
    cheval(g, [x, y]);
    FIGURES.gobelin(el(g, 'g', { transform: `translate(${x - 2},${y - 50})` }));
    el(g, 'rect', { x: x - 21, y: y - 119, width: 40, height: 6, fill: '#0d0806', stroke: 'rgba(233,220,192,.55)', 'stroke-width': .8, rx: 1 });
    el(g, 'rect', { x: x - 20, y: y - 118, width: 38, height: 4, fill: '#b9412c' });
  });
  else if (VAR !== 'mortelle') objet(...GOBELIN, (g, p) => pion(g, p, { genre: 'gobelin', camp: 'ennemi', cible: CIBLES.includes(GOBELIN), pv: 1 }));
}
{ const g = el(S, 'g'); objets.sort((p, q) => p.z - q.z).forEach((o) => o.dessine(g, o.p)); }

// le fond se ferme : coins, haut, bords et bas sous l'interface
el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)' });
el(S, 'rect', { x: 0, y: 0, width: 330, height: H, fill: 'url(#gauche)' });
el(S, 'ellipse', { cx: W - 67, cy: H - 180, rx: 430, ry: 260, fill: 'url(#droite)' });
el(S, 'rect', { x: 0, y: H - 280, width: W, height: 280, fill: 'url(#bas)' });
if (FIN || VAR === 'fiche') el(S, 'rect', { width: W, height: H, fill: '#06040a', opacity: FIN ? .66 : .42 });

/* les marques de la suite du combat que l'écran nomme (`#ecran` : `data-marques`) : la cible passée au Tireur gobelin
   (sa case et son halo), sa case cernée d'une cible supplémentaire, le Dôme sur son pion */
{
  const MARQUES = (ECRAN.dataset.marques ?? '').split(' ').filter(Boolean);
  const CASE_CIBLE = S.querySelector('path.case-cible');
  const HALO = S.querySelector('ellipse[fill="#e0553a"]');
  const PIONS = HALO?.parentNode;
  const sousLesPions = (tag, attrs) => S.insertBefore(el(S, tag, attrs), PIONS);
  const surLesPions = (tag, attrs) => S.insertBefore(el(S, tag, attrs), PIONS.nextSibling);
  if (MARQUES.includes('vise')) {
    const [x, y] = P(...GOBELIN);
    CASE_CIBLE.setAttribute('d', caseDeCible(...GOBELIN).d);
    HALO.remove();
    sousLesPions('ellipse', { cx: x, cy: y, rx: 42, ry: 20, fill: '#e0553a', opacity: .5, filter: 'url(#f6)' });
  }
  if (MARQUES.includes('cerne')) sousLesPions('path', caseDeCible(...GOBELIN));
  if (MARQUES.includes('dome')) {
    const [x, y] = P(...GOBELIN);
    grad('dome', [[0, '#bcd3ff', .05], [.7, '#8fb0f0', .16], [1, '#dbe6ff', .5]], { cx: .5, cy: .9, r: .9 }, 'radialGradient');
    surLesPions('path', { d: `M${x - 66},${y + 2}A66,30 0 0 0 ${x + 66},${y + 2}`, fill: 'none', stroke: '#dbe6ff', 'stroke-width': 1, 'stroke-opacity': .5, 'stroke-dasharray': '3 5' });
    surLesPions('path', { d: `M${x - 66},${y + 2}A66,74 0 0 1 ${x + 66},${y + 2}A66,30 0 0 1 ${x - 66},${y + 2}Z`, fill: 'url(#dome)', stroke: '#dbe6ff', 'stroke-width': 1.3, 'stroke-opacity': .75 });
  }
}
