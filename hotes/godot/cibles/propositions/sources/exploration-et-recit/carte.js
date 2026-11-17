/* La carte du monde : le Reikland à l'encre, les seuls lieux que le groupe connaît, le trajet choisi et ce qu'il
   coûte. « carte-du-monde-depart-de-nuit » : le départ pressé de nuit, que la porte de départ diffère à l'aube.
   Images d'intention (#3935, #4411), maquette hors du jeu. */
const NUIT = document.getElementById('ecran').dataset.etat === 'carte-du-monde-depart-de-nuit';
const CW = 1225, CH = 572;
const LIEUX = [
  { id: 'diligence', x: 318, y: 389, icone: 'lit', nom: 'Auberge La Diligence', quoi: 'Le groupe est ici', ici: true, sous: true },
  { id: 'route', x: 441, y: 337, etape: true },
  { id: 'rayons', x: 539, y: 292, icone: 'lit', nom: 'Auberge des Sept Rayons', quoi: 'Auberge-relais · 75 km' },
  { id: 'altdorf', x: 882, y: 149, icone: 'ville', nom: 'Altdorf', quoi: 'Capitale de l’Empire · 190 km', choisi: true },
];
const pieces = [];
pieces.push(titre({ icone: 'carte', nom: 'Le Reikland', sous: `Carte du monde · ${NUIT ? 'la nuit' : 'lieux connus du groupe'}`, largeur: 400 }));
const etape = (nom, ici) => `<div class="e ${ici ? 'ici' : ''}"><i></i><span class="rubrique">${nom}</span></div>`, troncon = (km) => `<div class="t"><u></u><span class="lin">${km} km</span></div>`;
pieces.push(`<div id="trajet" class="cadre bois" data-piece="trajet"><div class="fond bois">
  <h3 data-texte="destination">Altdorf</h3><div class="s rubrique">Par la grand-route · 190 km</div>
  <p data-texte="prose du lieu">Les murs blancs d’Altdorf, capitale de l’Empire, la plus grande et la plus riche de ses cités.</p>
  <div class="etapes">${etape('La Diligence', true)}${troncon(75)}${etape('Les Sept Rayons')}${troncon(115)}${etape('Altdorf')}</div>
  <div class="moyen ${NUIT ? '' : 'pris'}">${medaillon('roue', { petit: true })}<div class="q"><b>En diligence</b><span class="c rubrique">2 jours · une nuit à l’auberge</span></div><div class="px lin">4/– dehors<br>8/– dedans<small>par tête</small></div></div>
  <div class="moyen ${NUIT ? 'pris' : ''}">${medaillon('botte', { petit: true })}<div class="q"><b>À pied</b><span class="c rubrique">6 jours · cinq nuits en route</span></div><div class="px lin">sans frais</div></div>
  ${plaque('Prendre la route', { armee: !NUIT, fermee: NUIT, icone: 'route', classe: 'partir' })}
</div><div class="ruban rubrique">Destination</div>${ferrures}</div>`);
pieces.push(`<div id="carte" class="cadre bois" data-piece="carte"><div class="fond parchemin"><svg viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none"></svg>
  ${LIEUX.filter((l) => !l.etape).map((l) => `<div class="lieu bois ${l.choisi ? 'choisi' : ''} ${l.sous ? 'sous' : ''}" style="left:${l.x}px;top:${l.y}px">${medaillon(l.icone, { petit: true, taille: 17 })}<div><b>${l.nom}</b><span class="rubrique">${l.quoi}</span></div>${l.ici ? `<div class="ici">${HEROS.map((h) => portrait(h.id)).join('')}</div>` : ''}</div>`).join('')}
</div>${ferrures}</div>`);
/* #340, règle maison `voyage-heure-de-depart` ; `fenetreValider('depart')`, `fenetreFermer('depart')`
   (`src/noyau/modalArbiter.ts:362`, `src/noyau/travelFlow.ts:303-329`) ; `wm.departDeNuit`, `wm.nuitTombee`,
   `verbe.depart.valider`, `verbe.depart.fermer` (`src/i18n/messages/fr.ts:3605-3606`, `:286`, `:301`) */
if (NUIT) pieces.push(`<div id="depart" class="apercu parchemin vers-droite" style="left:450px;top:262px;width:296px;--pointe:148px">
  <div class="tete"><span class="n gothique">Départ de nuit</span></div>
  <p data-texte="départ de nuit">La nuit est tombée — un voyage à pied ne s’ébranle qu’au grand jour. Prochain départ possible à l’aube (6 h).</p>
  <div class="gestes">${plaque('Attendre l’aube', { armee: true, icone: 'sommeil' })}${plaque('Rester')}</div></div>`);
pieces.push(bandeau({}, { bourses: true }));
pieces.push(retour('Revenir à l’auberge', 'porte'), coins());
monter(pieces);

{
  const M = document.querySelector('#carte svg'); const encre = '#3a2a18';
  const r = alea(23);
  const ligne = (pts) => { let d = `M${pts[0]}`; for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]; d += `Q${(x0 + x1) / 2 + (y1 - y0) * .12 * (k % 2 ? 1 : -1)},${(y0 + y1) / 2 - (x1 - x0) * .12 * (k % 2 ? 1 : -1)} ${x1},${y1}`; } return d; };
  const REIK = [[1225, 560], [1120, 470], [1050, 372], [960, 262], [895, 168], [800, 118], [640, 96], [470, 60], [300, 44], [120, 62], [-10, 40]];
  const TALABEC = [[895, 168], [1000, 128], [1110, 124], [1235, 84]];
  const ROUTE = [[318, 389], [384, 370], [441, 337], [492, 318], [539, 292], [640, 262], [742, 214], [826, 178], [875, 156]];
  const NORD = [[441, 337], [420, 262], [372, 190], [352, 118]];
  const SUD = [[318, 389], [240, 420], [150, 470], [60, 572]];
  const pres = (x, y, pts, d) => pts.some(([a, b]) => Math.hypot(a - x, b - y) < d);
  const dense = (pts) => { const o = []; for (let k = 1; k < pts.length; k++) for (let t = 0; t < 1; t += .1) o.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t]); return o; };
  const EAU = dense([...REIK]).concat(dense(TALABEC)), CHEMINS = dense(ROUTE).concat(dense(NORD), dense(SUD));
  // les bois : des arbres à l'encre, serrés au sud (le Reikwald) et au nord (le Drakwald)
  const g0 = el(M, 'g', { stroke: encre, 'stroke-width': 1, fill: 'none', opacity: .5 });
  for (let n = 0; n < 520; n++) { const x = r() * CW, y = r() * CH; if (pres(x, y, EAU, 34) || pres(x, y, CHEMINS, 22) || Math.hypot(x - 882, y - 149) < 70) continue; const clair = y > 250 && x < 300 || (x > 560 && y > 300 && x < 1000) || (y < 250 && x > 420 && x < 760 && y > 120); if (!clair && r() < .7) continue; const s = .8 + r() * .6; el(g0, 'path', { d: `M${x - 6 * s},${y + 6 * s}L${x},${y - 8 * s}L${x + 6 * s},${y + 6 * s}ZM${x},${y + 6 * s}v${4 * s}` }); }
  // les collines, à l'est
  for (let n = 0; n < 16; n++) { const x = 1040 + r() * 170, y = 200 + r() * 160; if (pres(x, y, EAU, 40)) continue; el(M, 'path', { d: `M${x - 16},${y + 6}Q${x},${y - 14} ${x + 16},${y + 6}M${x - 8},${y}l-3,6M${x + 2},${y - 4}l-2,9`, stroke: encre, 'stroke-width': 1, fill: 'none', opacity: .5 }); }
  // le Reik et le Talabec
  for (const [pts, w] of [[REIK, 26], [TALABEC, 17]]) { const d = ligne(pts); el(M, 'path', { d, stroke: '#5f7a80', 'stroke-width': w + 4, fill: 'none', opacity: .9, 'stroke-linecap': 'round' }); el(M, 'path', { d, stroke: '#a9bdbd', 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round' }); }
  for (const [x, y] of EAU.filter((_, k) => k % 7 === 3)) el(M, 'path', { d: `M${x - 9},${y}q4,-3 8,0t8,0`, stroke: '#5f7a80', 'stroke-width': 1, fill: 'none' });
  // les routes : en pointillé ; le trajet choisi au trait rouge
  for (const pts of [NORD, SUD]) el(M, 'path', { d: ligne(pts), stroke: encre, 'stroke-width': 1.6, 'stroke-dasharray': '7 5', fill: 'none', opacity: .75 });
  el(M, 'path', { d: ligne(ROUTE), stroke: '#e6d5ad', 'stroke-width': 7, fill: 'none', opacity: .7 });
  el(M, 'path', { d: ligne(ROUTE), stroke: '#8a2416', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' });
  // Altdorf : les murs, à la rencontre des deux fleuves
  { const g = el(M, 'g', { transform: 'translate(882,149)', stroke: encre, 'stroke-width': 1.6, fill: '#e6d5ad' });
    el(g, 'path', { d: 'M-34,10L-30,-16L-8,-28L20,-24L36,-4L28,20L0,28L-24,24Z', 'stroke-width': 3 });
    for (const [x, y, w, h] of [[-18, -8, 9, 14], [-4, -16, 10, 22], [10, -6, 9, 14], [-10, 8, 12, 10], [8, 10, 10, 9]]) el(g, 'path', { d: `M${x},${y + h}v${-h}l${w / 2},-6l${w / 2},6v${h}z`, fill: 'rgba(90,60,30,.35)', 'stroke-width': 1 });
    for (const [x, y] of [[-34, 10], [-30, -16], [-8, -28], [20, -24], [36, -4], [28, 20], [0, 28], [-24, 24]]) el(g, 'rect', { x: x - 3.5, y: y - 3.5, width: 7, height: 7 }); }
  // les étapes : relais et croisement
  for (const l of LIEUX) { if (l.id === 'altdorf') continue; el(M, 'circle', { cx: l.x, cy: l.y, r: l.etape ? 4.5 : 7, fill: l.ici ? '#c8452c' : l.etape ? '#e6d5ad' : '#2a1d12', stroke: l.etape ? encre : '#e6d5ad', 'stroke-width': 1.8 }); }
  // la nuit d'étape, sur le trajet
  el(M, 'path', { d: 'M549,268a8,8 0 1 0 9,9a6.500,6.500 0 0 1-9-9z', fill: encre, opacity: .8 });
  // les noms à l'encre
  const nom = (x, y, t, o = {}) => el(M, 'text', { x, y, 'text-anchor': 'middle', 'font-family': 'Fell', 'font-style': 'italic', 'font-size': 17, fill: encre, opacity: .8, ...o }, t);
  nom(690, 430, 'le Reikwald', { 'font-size': 24, 'letter-spacing': 4 }); nom(600, 180, 'le Drakwald', { 'font-size': 20, 'letter-spacing': 3, opacity: .65 });
  nom(1012, 330, 'le Reik', { 'font-size': 14, fill: '#3f5a60', transform: 'rotate(52 1012 330)' }); nom(214, 40, 'le Reik', { 'font-size': 14, fill: '#3f5a60', transform: 'rotate(3 214 40)' }); nom(1088, 112, 'le Talabec', { 'font-size': 13, fill: '#3f5a60', transform: 'rotate(-8 1088 112)' });
  const petit = (x, y, t, o = {}) => el(M, 'text', { x, y, 'text-anchor': 'middle', 'font-family': 'Fell SC', 'font-size': 11.5, 'letter-spacing': 1, fill: encre, opacity: .8, ...o }, t);
  petit(318, 104, 'vers Middenheim'); petit(118, 548, 'vers Delberz'); petit(452, 362, 'la grand-route', { transform: 'rotate(-24 452 362)', 'font-size': 10.5, opacity: .7 });
  // le cartouche et la rose des vents
  { const c = el(M, 'g', { transform: 'translate(1140,490)', stroke: encre, fill: 'none', 'stroke-width': 1, opacity: .7 }); el(c, 'circle', { r: 20 }); el(c, 'circle', { r: 27, 'stroke-dasharray': '2 4' }); el(c, 'path', { d: 'M0,-36L6,0L0,36L-6,0ZM-36,0L0,-6L36,0L0,6Z' }); el(c, 'text', { x: 0, y: -41, 'text-anchor': 'middle', 'font-family': 'Fell SC', 'font-size': 12, fill: encre, stroke: 'none' }, 'N'); }
  { const g = el(M, 'g', { transform: 'translate(64,500)', stroke: encre, 'stroke-width': 1.2, fill: 'none', opacity: .75 }); el(g, 'path', { d: 'M0,0h120M0,-5v10M60,-4v8M120,-5v10' }); el(g, 'text', { x: 60, y: 22, 'text-anchor': 'middle', 'font-family': 'Fell SC', 'font-size': 11, 'letter-spacing': 1, fill: encre, stroke: 'none' }, '50 kilomètres'); }
}
