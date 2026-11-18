/* L'interlude en ville : entre deux aventures, les activités sont des lieux et des gens de Bögenhafen. */
const LIEUX = [
  { x: 214, y: 298, icone: 'chope', nom: 'Taverne d’Altstadt', quoi: 'Dernières nouvelles', choisi: true, fantome: 'mira' },
  { x: 432, y: 206, icone: 'livre', nom: 'Temple de Verena', quoi: 'Recherche de savoir', heros: 'aldric' },
  { x: 650, y: 122, icone: 'enclume', nom: 'La forge', quoi: 'Passer commande' },
  { x: 700, y: 330, icone: 'bouclier', nom: 'Caserne du Guet', quoi: 'Entraînement au combat', heros: 'greta' },
  { x: 548, y: 462, icone: 'pieces', nom: 'Comptoir de change', quoi: 'Opérations bancaires' },
  { x: 356, y: 398, icone: 'ancre', nom: 'Les quais', quoi: 'Revenus', heros: 'bjorn' },
  { x: 268, y: 524, icone: 'epee', nom: 'Le maître d’armes', quoi: 'Entraînement' },
];
const pieces = [];
pieces.push(cartouche({ icone: 'ville', nom: 'Bögenhafen', sous: 'Entre deux aventures', taille: 'titre', largeur: 400 }));
pieces.push(`<div id="lieu" class="cadre bois" data-piece="lieu"><div class="fond bois">
  <h3 data-texte="lieu">Taverne d’Altstadt</h3>
  <div class="pnj">${portrait('hote')}<div><b>Le tenancier</b><p>Les bateliers parlent, pour peu qu’on paie la tournée.</p></div></div>
  <div class="activite prise">${medaillon('bulle', { taille: 'moyen' })}<div><b>Dernières nouvelles</b><span class="c rubrique">Ragot · une Activité</span><i>Une rumeur venue de loin, et une de plus par degré de réussite.</i></div></div>
  <div class="activite">${medaillon('goutte', { taille: 'moyen' })}<div><b>Semer la dissension</b><span class="c rubrique">Ragot, puis Charme · deux Activités</span><i>Monter le quartier contre un homme, une guilde ou le Guet.</i></div></div>
  ${plaque('Envoyer Mira à la taverne', { armee: true, icone: 'route', classe: 'envoyer' })}
</div>${ruban('Altstadt')}${ferrures}</div>`);
pieces.push(`<div id="carte" class="cadre bois" data-piece="carte"><div class="fond parchemin"><svg viewBox="0 0 844 572" preserveAspectRatio="none"></svg>
  ${LIEUX.map((l) => `<div class="lieu bois ${l.choisi ? 'choisi' : ''}" style="left:${l.x}px;top:${l.y}px">${medaillon(l.icone, { taille: 'petit' })}<div><b>${l.nom}</b><span class="rubrique">${l.quoi}</span></div>${l.heros ? portrait(l.heros, { taille: 'petit' }) : ''}${l.fantome ? portrait(l.fantome, { taille: 'petit', classe: 'fantome' }) : ''}</div>`).join('')}
</div>${ferrures}</div>`);
/* LDB 22 l.5 ; LDB 23 l.5, l.15 ; `src/noyau/interludeEnVue.ts:48-52` */
const restantes = (n) => `<div class="pips">${[0, 1, 2].map((k) => `<i class="${k < n ? '' : 'vide'}"></i>`).join('')}</div>`;
const activites = (id, nom, evenement, n, choisi) => rang(id, { taille: 'petit', choisi, nom, gothique: true, sous: `Événement · ${evenement}`, fin: `<div class="r">${restantes(n)}<span class="rubrique">${n} sur 3</span></div>` });
pieces.push(`<div id="interlude" class="cadre bois" data-piece="interlude"><div class="fond bois">
  <h3>Activités restantes</h3><div class="s rubrique">Une par semaine, trois au plus</div>
  <div class="rangs">
    ${activites('bjorn', 'Bjorn', 'Profits abondants', 1)}
    ${activites('mira', 'Mira', 'Rien à signaler', 2, true)}
    ${activites('aldric', 'Aldric', 'Enchères ésotériques', 1)}
    ${activites('greta', 'Greta', 'Festivités', 2)}
  </div>
  ${filet({ fondu: true })}
  <div class="avis">${sceau('pieces')}<span>À la reprise, les bourses seront vides : seul l’argent déposé au comptoir est gardé.</span></div>
</div>${ruban('L’interlude')}${ferrures}</div>`);
pieces.push(bandeau({
  bjorn: { icone: 'ancre', texte: 'décharge les barges sur les quais' },
  mira: { choisi: true, html: '<span class="attend rubrique">À envoyer en ville</span>' },
  aldric: { icone: 'livre', texte: 'fouille les registres du temple' },
  greta: { icone: 'epee', texte: 's’exerce avec les hommes du Guet' },
}, { bourses: true }));
pieces.push(retour('Reprendre la route', 'sablier'), coins());
monter(pieces);

/* la carte de la ville, à l'encre sur le parchemin */
{
  const M = document.querySelector('#carte svg');
  const encre = '#3a2a18';
  const MUR = [[150, 196], [352, 92], [500, 74], [652, 78], [772, 152], [802, 332], [742, 492], [542, 550], [300, 534], [148, 384]];
  const dedans = (x, y) => { let c = false; for (let i = 0, j = MUR.length - 1; i < MUR.length; j = i++) { const [xi, yi] = MUR[i], [xj, yj] = MUR[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const riv = (x) => 512 - x * .41 + 14 * Math.sin(x / 90);
  // la campagne : arbres, chemins
  const r = alea(14); const g0 = el(M, 'g', { stroke: encre, 'stroke-width': 1, fill: 'none', opacity: .55 });
  for (let n = 0; n < 70; n++) { const x = r() * 844, y = r() * 572; if (dedans(x, y) || Math.abs(y - riv(x)) < 40) continue; el(g0, 'path', { d: `M${x - 6},${y + 6}L${x},${y - 7}L${x + 6},${y + 6}ZM${x},${y + 6}v4` }); }
  for (const d of ['M0,300C50,296 100,300 148,300', 'M802,300C820,296 834,300 844,296', 'M500,74C502,50 498,24 502,0', 'M420,542C424,556 420,566 424,572']) el(M, 'path', { d, stroke: encre, 'stroke-width': 1.4, 'stroke-dasharray': '6 5', fill: 'none', opacity: .7 });
  // la Bögen
  let d = ''; for (let x = -10; x <= 860; x += 20) d += `${x < 0 ? 'M' : 'L'}${x},${riv(x)}`;
  el(M, 'path', { d, stroke: '#5f7a80', 'stroke-width': 40, fill: 'none', opacity: .9 });
  el(M, 'path', { d, stroke: '#a9bdbd', 'stroke-width': 35, fill: 'none' });
  for (let x = 30; x < 840; x += 74) el(M, 'path', { d: `M${x},${riv(x) + 4}q6,-4 12,0t12,0`, stroke: '#5f7a80', 'stroke-width': 1, fill: 'none' });
  // les maisons
  const g1 = el(M, 'g', { stroke: encre, 'stroke-width': .9, fill: 'rgba(90,60,30,.18)', opacity: .8 });
  for (let n = 0; n < 520; n++) { const x = 150 + r() * 660, y = 70 + r() * 490; if (!dedans(x, y) || Math.abs(y - riv(x)) < 30) continue; const w = 9 + r() * 10, h = 6 + r() * 6; el(g1, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, transform: `translate(${x},${y}) rotate(${-22 + r() * 30})` }); }
  // les quartiers, en pointillé
  for (const d of ['M352,92C360,180 330,260 300,360', 'M500,74C520,160 560,220 600,270', 'M150,300C240,330 300,340 330,372', 'M430,340C470,420 440,480 420,542', 'M560,286C600,380 660,440 742,492']) el(M, 'path', { d, stroke: encre, 'stroke-width': 1.1, 'stroke-dasharray': '4 5', fill: 'none', opacity: .65 });
  // le rempart, ses tours, ses portes, le pont
  el(M, 'path', { d: 'M' + MUR.map((p) => p.join(',')).join('L') + 'Z', stroke: encre, 'stroke-width': 5, fill: 'none', 'stroke-linejoin': 'round' });
  el(M, 'path', { d: 'M' + MUR.map((p) => p.join(',')).join('L') + 'Z', stroke: '#d8c49a', 'stroke-width': 2, fill: 'none', 'stroke-linejoin': 'round' });
  for (const [x, y] of MUR) el(M, 'rect', { x: x - 6, y: y - 6, width: 12, height: 12, fill: '#e6d5ad', stroke: encre, 'stroke-width': 1.8 });
  for (const [x, y] of [[148, 300], [802, 300], [500, 74], [420, 542]]) el(M, 'path', { d: `M${x - 8},${y + 7}v-12h4v-4h8v4h4v12z`, fill: encre });
  el(M, 'path', { d: `M452,${riv(452) - 24}L470,${riv(470) + 24}`, stroke: '#e6d5ad', 'stroke-width': 11 });
  el(M, 'path', { d: `M452,${riv(452) - 24}L470,${riv(470) + 24}M441,${riv(452) - 20}L459,${riv(470) + 28}M463,${riv(452) - 28}L481,${riv(470) + 20}`, stroke: encre, 'stroke-width': 1.6 });
  // les noms
  const nom = (x, y, t, o = {}) => el(M, 'text', { x, y, 'text-anchor': 'middle', 'font-family': 'Fell', 'font-style': 'italic', 'font-size': 15, fill: encre, opacity: .85, ...o }, t);
  nom(400, 138, 'la Fosse'); nom(610, 214, 'Quartier des artisans'); nom(206, 358, 'Altstadt'); nom(548, 268, 'Göttenplatz'); nom(676, 404, 'Teuerberg'); nom(600, 512, 'Dreieckeplatz'); nom(420, 500, 'Adel Ring');
  nom(744, 250, 'la Bögen', { 'font-size': 12, fill: '#3f5a60', transform: 'rotate(-22 744 250)' });
  const petit = (x, y, t) => el(M, 'text', { x, y, 'text-anchor': 'middle', 'font-family': 'Fell SC', 'font-size': 10.5, 'letter-spacing': 1, fill: encre, opacity: .8 }, t);
  petit(86, 290, 'Porte Ouest'); petit(560, 60, 'Porte de l’Eau'); petit(806, 284, 'Porte Est'); petit(478, 564, 'La Poterne');
  // la rose des vents
  const c = el(M, 'g', { transform: 'translate(70,500)', stroke: encre, fill: 'none', 'stroke-width': 1, opacity: .7 });
  el(c, 'circle', { r: 16 }); el(c, 'path', { d: 'M0,-26L5,0L0,26L-5,0ZM-26,0L0,-5L26,0L0,5Z' });
  // les épingles des lieux
  for (const l of LIEUX) { el(M, 'circle', { cx: l.x, cy: l.y, r: 6.5, fill: l.choisi ? '#c8452c' : '#2a1d12', stroke: '#e6d5ad', 'stroke-width': 1.6 }); }
}
