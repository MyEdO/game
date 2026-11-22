/* Socle des écrans hors combat, images d'intention (#3935) : silhouettes de décor, bandeau des héros, rail des services,
   postes, montés sur les pièces de `../gestes.js`. Se charge après `../gestes.js` et `bustes.js`. Maquette hors du jeu. */


/* ───────── le décor : outils de dessin ───────── */
const radial = (id, stops, attrs = { cx: .5, cy: .5, r: .5 }) => grad(id, stops, attrs, 'radialGradient');
radial('lueur', [[0, '#ffdf9a', .9], [.16, '#ffb65a', .55], [.45, '#e07a2c', .2], [1, '#e07a2c', 0]]);
radial('coeur', [[0, '#fff3c8', .95], [.3, '#ffc76e', .6], [1, '#ff9a3a', 0]]);
/* silhouettes éclairées d'un côté : le feu est à gauche (rimG) ou à droite (rimD) */
const rims = (clair, sombre) => { grad('rimG', [[0, clair], [.42, sombre], [1, sombre]], { x1: 0, y1: 0, x2: 1, y2: 0 }); grad('rimD', [[0, sombre], [.58, sombre], [1, clair]], { x1: 0, y1: 0, x2: 1, y2: 0 }); };

const sapin = (g, x, y, h, fill) => {
  const w = h * .34; let d = `M${x},${y - h}`; const n = 5;
  for (let k = 1; k <= n; k++) { const yy = y - h + h * .94 * k / n, ww = w * k / n; d += `L${x + ww * .55},${yy - h * .035}L${x + ww},${yy}L${x + ww * .35},${yy - h * .02}`; }
  for (let k = n; k >= 1; k--) { const yy = y - h + h * .94 * k / n, ww = w * k / n; d += `L${x - ww * .35},${yy - h * .02}L${x - ww},${yy}L${x - ww * .55},${yy - h * .035}`; }
  el(g, 'path', { d: d + `L${x - w * .06},${y - h * .06}L${x - w * .06},${y}L${x + w * .06},${y}L${x + w * .06},${y - h * .06}Z`, fill });
};
/* un personnage en silhouette. pose : debout, assis, accroupi, couche. coiffe : chapeau, capuche, chignon, bonnet, casque */
function perso(g, x, y, h, { pose = 'debout', fill = '#0b0806', coiffe = '', vers = 1, extra = '' } = {}) {
  const f = el(g, 'g', { transform: `translate(${x},${y}) scale(${vers * h / 100},${h / 100})`, fill });
  if (pose === 'couche') {
    el(f, 'path', { d: 'M-52,0C-50,-16 -30,-20 -6,-19C22,-18 46,-15 54,-6C56,-2 54,0 50,0Z' });
    el(f, 'circle', { cx: -58, cy: -10, r: 9 });
    return f;
  }
  const hy = pose === 'debout' ? -88 : pose === 'assis' ? -64 : -52;
  if (pose === 'debout') el(f, 'path', { d: 'M-15,0C-18,-28 -19,-54 -13,-72C-9,-78 9,-78 13,-72C19,-54 18,-28 15,0Z' });
  if (pose === 'assis') el(f, 'path', { d: 'M-14,0L-15,-30C-16,-42 -13,-52 -9,-56C-5,-59 6,-59 10,-55C14,-50 15,-40 14,-30L30,-28C35,-27 36,-22 35,-16L34,0L24,0L24,-14L6,-12L4,0Z' });
  if (pose === 'accroupi') el(f, 'path', { d: 'M-16,0C-20,-18 -18,-36 -11,-44C-6,-48 7,-47 11,-42C16,-35 18,-26 26,-20C30,-16 30,-8 26,0Z' });
  el(f, 'circle', { cx: 0, cy: hy, r: 10.5 });
  if (coiffe === 'chapeau') el(f, 'path', { d: `M-19,${hy - 5}L19,${hy - 5}L18,${hy - 2}L-18,${hy - 2}ZM-9,${hy - 5}C-9,${hy - 20} 9,${hy - 20} 9,${hy - 5}Z` });
  if (coiffe === 'capuche') el(f, 'path', { d: `M-12,${hy + 10}C-16,${hy - 6} -8,${hy - 17} 0,${hy - 17}C8,${hy - 17} 16,${hy - 6} 12,${hy + 10}Z` });
  if (coiffe === 'chignon') el(f, 'circle', { cx: -2, cy: hy - 14, r: 5.5 });
  if (coiffe === 'bonnet') el(f, 'path', { d: `M-11,${hy - 2}C-11,${hy - 18} 11,${hy - 18} 11,${hy - 2}Z` });
  if (coiffe === 'casque') el(f, 'path', { d: `M-12,${hy - 1}C-12,${hy - 17} 12,${hy - 17} 12,${hy - 1}ZM-1.500,${hy - 22}h3v8h-3z` });
  if (extra) f.insertAdjacentHTML('beforeend', extra);
  return f;
}
function flammes(g, x, y, s = 1) {
  const f = el(g, 'g', { transform: `translate(${x},${y}) scale(${s})` });
  el(f, 'path', { d: 'M-22,0C-30,-22 -12,-34 -14,-58C0,-46 -2,-34 6,-50C12,-70 6,-78 4,-88C22,-70 30,-46 24,-28C30,-34 30,-42 30,-46C40,-26 34,-8 24,0Z', fill: '#f08a2c' });
  el(f, 'path', { d: 'M-12,0C-18,-16 -6,-26 -6,-42C4,-32 2,-24 8,-34C16,-22 20,-10 12,0Z', fill: '#ffd778' });
  el(f, 'path', { d: 'M-5,0C-8,-8 -2,-14 -1,-22C5,-14 8,-8 5,0Z', fill: '#fff3c8' });
  return f;
}
/* la toile d'un décor peint à 1707 × 780 : un calque de la scène qui la rogne à la vue, centrée */
const toile = () => el(S, 'svg', { width: W, height: H, viewBox: '0 0 1707 780', preserveAspectRatio: 'xMidYMid slice' });
const fermer = () => { // le fond se ferme : coins, bas sous l'interface
  el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)' });
  el(S, 'rect', { x: 0, y: H - 260, width: W, height: 260, fill: 'url(#bas)' });
};

/* ───────── l'interface ───────── */
/* `groupe` : les héros du bandeau, une place sans `id` est libre ; `dits` : par id, { texte, icone, mal, choisi, html } ;
   quatre cases, chacune à sa place, celles sans héros restent vides */
const bandeau = (dits = {}, { groupe = HEROS, bourses = false, ruban: titre = '' } = {}) => cadre('bandeau', null, null, null, null, 'bois', places('socle', Object.fromEntries(groupe.map((h, k) => { const d = dits[h.id ?? 'libre'] ?? {}; return [`case-${k + 1}`, `
  <div class="heros ${d.choisi ? 'choisi' : ''}" data-primitive="bandeau">${portrait(h.id, { taille: 'grand', choisi: d.choisi })}
    <div class="qui">${nom({ texte: h.nom, cle: `héros ${h.nom}` })}
      <div class="l2">${sousTitre({ texte: h.car })}${h.max ? `<span class="pv chiffres">${h.pv} / ${h.max}</span>` : ''}</div>
      ${h.max ? vie(h.pv, h.max) : ''}${bourses ? `<div class="bourse"><span class="rubrique">Bourse</span><b class="chiffres">${h.bourse}</b></div>` : ''}
      ${d.texte ? `<div class="dit">${d.mal ? sceau(d.icone) : d.icone ? rond(d.icone, 'menu', { arme: true }) : ''}<p>${d.texte}</p></div>` : ''}
      ${d.html ?? ''}
    </div>
  </div>`]; }))), { piece: 'socle', tete: (titre ? ruban(titre) : '') + clouer(4) });
/* l'hôte posé dans la scène : (x, y) son coin, `l` sa largeur, `pointe` l'abscisse de sa pointe depuis son bord gauche ;
   `piece` : son nom au relevé du rendu, celui d'un hôte qui suit la personne du décor qu'il désigne ; son corps défile
   sous le cartouche (`liste` : une liste longue par nature, `defile`), ses gestes (`pied`) au pied */
const hote = ({ id, classe = '', x, y, l, icone, nom, sous, marque, corps = '', liste = false, pied = '', pointe = 60, piece = '' }) => `<div class="hote ${classe} cadre bois" data-primitive="hote"${piece ? ` data-piece="${piece}"${mobile('scene')}` : ''} style="left:${x}px;top:${y}px;width:${l}px"><div class="fond bois" data-emplacement="contenu">
  ${cartouche({ icone, nom, sous, marque, texte: id })}${corps ? defile(corps, '', { liste }) : ''}${pied}</div><i class="pointe" style="left:${pointe}px;bottom:-8px"></i>${ferrures}</div>`;
/* le rail des services d'un lieu : services = [icône, nom, armé, compte à droite] ; `piece` : la colonne qu'il tient,
   sur sa grille (`colonne`) : les services en plein, qui défilent, `pied` en note sous eux, quel qu'en soit le nombre ;
   `suite` : ce qui suit la note dans le même panneau, à sa place */
const rail = (titre, services, pied, piece = 'colonne-gauche', suite = '') => cadre('rail', null, null, null, null, 'bois', `
  ${colonne(piece, { corps: services.map(([i, n, a, compte = null]) => plaque(n, { icone: i, armee: !!a, prix: compte })).join(''), note: glose({ texte: pied }) })}${suite}
`, { tete: ruban(titre), piece });
/* un poste dans la scène : cx = centre, y = haut ; `heros` : son titulaire, ou ses titulaires ; `plus` : il offre une place de plus ;
   `piece` : son nom au relevé du rendu ; `pointe` : le décalage de sa pointe depuis le centre */
const poste = (cx, y, { nom: nomme, sous, icone, heros = [], ferme = false, vise = false, plus = false, piece = '', pointe = 0 }) => { const tenants = [heros].flat(); return `<div class="poste ${tenants.length ? 'occupe' : 'vide'} ${ferme ? 'ferme' : ''} ${vise ? 'vise' : ''}" data-primitive="poste"${piece ? ` data-piece="${piece}"${mobile('scene')}` : ''} style="left:${cx}px;top:${y}px${pointe ? `;--pointe:${pointe}px` : ''}">
  ${tenants.length ? `<div class="tenants">${tenants.map((h) => portrait(h, { choisi: vise })).join('')}${plus ? medaillon('plus', { taille: 'petit' }) : ''}</div>` : medaillon(icone, { taille: 'moyen', ferme })}
  <div class="et bois">${nom({ texte: nomme, taille: 'petit' })}${sous ? `<span class="rubrique">${sous}</span>` : ''}</div></div>`; };
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { radial, rims, sapin, perso, flammes, toile, fermer, bandeau, hote, rail, poste });
