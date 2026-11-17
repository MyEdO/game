/* Socle du combat, images d'intention (#3935) : outils de dessin, matières, grille isométrique et pièces d'interface
   (portraits, pastilles, plaques, ordre, journal, bandeau du jet), sans décor. `combat.js` y pose la cour, `../voyage/`
   la mer du combat naval. Se charge après `jet.js`. Maquette hors du jeu. */
const NS = 'http://www.w3.org/2000/svg';
const W = 1707, H = 780;
const el = (hote, tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; hote.appendChild(e); return e; };
const alea = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const melange = (c1, c2, t) => { const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); const a = p(c1), b = p(c2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const svgUrl = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

/* textures : bois et parchemin, en bruit (les mêmes que l'écran de voyage) */
document.documentElement.style.setProperty('--tex-bois', svgUrl(`<svg xmlns='${NS}' width='600' height='300'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.22' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.30  0.9 0.9 0.9 0 -0.75'/></filter><rect width='100%' height='100%' fill='#c9a57a'/><rect width='100%' height='100%' filter='url(#f)'/></svg>`));
document.documentElement.style.setProperty('--tex-parchemin', svgUrl(`<svg xmlns='${NS}' width='500' height='400'><filter id='a' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='4' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.16  0.9 0.9 0.9 0 -0.95'/></filter><filter id='b' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' fill='#fff'/><rect width='100%' height='100%' filter='url(#a)'/><rect width='100%' height='100%' filter='url(#b)'/></svg>`));

const S = document.getElementById('scene');
const defs = el(S, 'defs');
const grad = (id, stops, attrs = { x1: 0, y1: 0, x2: 0, y2: 1 }, type = 'linearGradient') => { const g = el(defs, type, { id, ...attrs }); stops.forEach(([o, c, a]) => el(g, 'stop', { offset: o, 'stop-color': c, 'stop-opacity': a ?? 1 })); return g; };
const flou = (id, d) => { const f = el(defs, 'filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%' }); el(f, 'feGaussianBlur', { stdDeviation: d }); };
flou('f1', 0.8); flou('f2', 2); flou('f6', 6); flou('f18', 18);
grad('vignette', [[.5, '#000', 0], [.82, '#000', .4], [1, '#000', .8]], { cx: .5, cy: .44, r: .74 }, 'radialGradient');
grad('haut', [[0, '#080a14', .78], [1, '#080a14', 0]]);
grad('bas', [[0, '#000', 0], [1, '#000', .82]]);
grad('gauche', [[0, '#000', .62], [1, '#000', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
/* la grille isométrique */
const A = 46, B = 23, OX = 608, OY = -84;
const P = (i, j) => [OX + (i - j) * A, OY + (i + j) * B];
const losange = (x, y, a = A, b = B) => `M${x},${y - b}L${x + a},${y}L${x},${y + b}L${x - a},${y}Z`;

/* ───────── les pièces d'interface ───────── */
const BUSTES = {
  ilyanwe: '<path d="M16 90c0-17 7-25 19-27l-2-8c-6-5-8-15-5-23 3-8 19-8 22 0 3 8 1 18-5 23l-2 8c12 2 19 10 19 27z"/><path d="M25 37l-10-10 10 3zM53 37l10-10-10 3z"/><path d="M21 41c-3-17 5-30 18-30s21 13 18 30c4 10 5 23 3 36l-9-7c2-10 1-21-3-28-4-5-14-5-18 0-4 7-5 18-3 28l-9 7c-2-13-1-26 3-36z" fill="#1c1410"/>',
  berta: '<path d="M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z"/><path d="M24 31c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z" fill="#1c1410"/><path d="M52 33c7 9 7 22 2 33l-6-3c4-10 4-19-1-27z" fill="#1c1410"/>',
  gobelin: '<path d="M18 90c0-14 8-20 17-22l-1-5c-8-4-11-13-8-21 3-8 23-8 26 0 3 8 0 17-8 21l-1 5c9 2 17 8 17 22z"/><path d="M27 45L5 34l20 21zM51 45l22-11-20 21z"/><path d="M24 47c-2-16 5-27 15-31 10 4 17 15 15 31-10-6-20-6-30 0z" fill="#0c0605"/>',
  orc: '<path d="M4 90c0-22 11-30 25-32l-1-6c-8-5-11-17-7-26 4-9 32-9 36 0 4 9 1 21-7 26l-1 6c14 2 25 10 25 32z"/><path d="M21 33c7-6 29-6 36 0l-3 5c-9-4-21-4-30 0z" fill="#0c0605"/><path d="M29 54l-2-11 6 8zM49 54l2-11-6 8z" fill="#e6d6b0"/>',
};
const portrait = (genre, camp, style = '') => `<div class="portrait ${camp === 'ennemi' ? 'ennemi fer' : 'laiton'}" style="${style}"><div><svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice" fill="${camp === 'ennemi' ? '#170a08' : '#2a1f17'}">${BUSTES[genre]}</svg></div></div>`;
const ferrures = '<i class="ferrure hg"></i><i class="ferrure hd"></i><i class="ferrure bg"></i><i class="ferrure bd"></i>';
const picto = (d, taille = 22, couleur = '#e2c06a', trait = 1.6) => `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="${couleur}" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const PICTOS = {
  attaque: '<path d="M4 4l11 11M4 4v3.500M4 4h3.500M13 17l4-4M16.500 16.500L20 20M20 4L9 15M20 4v3.500M20 4h-3.500M11 17l-4-4M7.500 16.500L4 20"/>',
  course: '<path d="M9 3v9.500l-4 3.500v4h14v-2.500c0-2-2.500-3-6-3.500V3zM9 7h4M9 10.500h4M5 17.500h14"/>',
  defensive: '<path d="M12 3l7.500 2.500v5.500c0 4.800-3.200 8-7.500 9.500-4.300-1.500-7.500-4.700-7.500-9.500V5.500zM12 3v17.500M4.500 10.500h15"/>',
  sort: '<path d="M12 2.500l1.800 6.200 6.200-1.700-4.400 4.700 4.400 4.800-6.200-1.800L12 21l-1.800-6.300L4 16.500l4.400-4.800L4 7l6.200 1.700z"/>',
  focaliser: '<circle cx="12" cy="12" r="2.200"/><path d="M12 4.500a7.500 7.500 0 1 0 7.500 7.500M12 8a4 4 0 1 1-4 4M19.500 12a7.500 7.500 0 0 0-3-6"/>',
  competence: '<path d="M12 2.500l8 8-3.500 10.500h-9L4 10.500zM12 2.500l4 9.500-4 4-4-4zM4 10.500L8 12M20 10.500L16 12M12 16v5"/>',
  poser: '<path d="M12 3.500v11M7.500 10.500l4.500 4.500 4.500-4.500M4.500 20h15"/>',
  armes: '<path d="M4.500 8.500h13l-3.500-3.500M19.500 15.500h-13l3.500 3.500"/>',
  fin: '<path d="M7 3h10M7 21h10M8.500 3c0 5 7 6.500 7 9s-7 4-7 9M15.500 3c0 5-7 6.500-7 9s7 4 7 9M10.500 18.500h3"/>',
  annuler: '<path d="M9 6.500L4.500 11 9 15.500M4.500 11h9.500a4.500 4.500 0 0 1 0 9H10"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  journal: '<path d="M4 5c3-1.200 5.500-1.200 8 0v14c-2.500-1.200-5-1.200-8 0zM20 5c-3-1.200-5.500-1.200-8 0v14c2.500-1.200 5-1.200 8 0z"/>',
  systeme: '<circle cx="12" cy="12" r="3.200"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>',
  epee: '<path d="M6 18L17 7l2-3-3 2L5 17zM8 13l3 3M4 20l2-2"/>',
};
const rond = (nom, taille, { ferme = false, couleur } = {}) => `<div class="bouton-rond ${ferme ? 'fer ferme' : 'laiton'}"><div>${picto(PICTOS[nom], taille, couleur ?? (ferme ? '#7d7668' : '#e2c06a'))}</div></div>`;
const plaque = (libelle, { armee = false, icone = null, large = false, fermee = false } = {}) => `<div class="plaque ${fermee ? 'fer fermee' : 'laiton'}${armee ? ' armee' : ''}${large ? ' large' : ''}"><div>${icone ? picto(PICTOS[icone], 21, armee ? '#2a1a08' : fermee ? '#7d7668' : '#e2c06a', 1.7) : ''}${libelle}</div></div>`;

const rang = (genre, camp, nom, pv, max, classe = '') => `
  <div class="rang ${camp === 'ennemi' ? 'ennemi' : ''} ${classe}">${portrait(genre, camp)}
    <div class="qui"><div class="nom ${classe.includes('actif') ? '' : 'rubrique'} ombre" data-texte="rang ${nom}">${nom}</div>
    ${classe.includes('fantome') ? '' : `<div class="ligne"><div class="vie"><i style="width:${100 * pv / max}%"></i></div><span class="pv ombre">${pv} / ${max}</span></div>`}</div>
  </div>`;
const borne = (n) => `<div class="borne"><div class="disque fer"><div>${n}</div></div><span class="rubrique ombre">Round ${n}</span><i></i></div>`;
const vieux = (t) => `<p class="vieux ombre">${t}</p>`, neuf = (t) => `<p class="ombre">${t}</p>`, borneJ = (t) => `<p class="borne-j ombre">${t}</p>`;
const medaillon = (n, t) => `<div class="medaillon"><div class="disque fer"><div>${n}</div></div><span class="rubrique">${t}</span></div>`;
/* les pièces fixes : le système, la fermeture d'une fiche */
const SYSTEME = `<div id="systeme" data-piece="systeme">${rond('systeme', 22, { couleur: '#c9b995' })}</div>`;
const FERMER = `<div id="fermer" data-piece="fermer"><span class="rubrique ombre">Fermer</span>${rond('annuler', 20)}</div>`;
/* le meuble de l'actif : les outils du tour, la barre (état, plaques, pastilles), son portrait et son nom */
const mesure = (nom, valeur, classe = '') => `<div class="mesure ${classe}"><div class="tete rubrique"><span>${nom}</span><b>${valeur}</b></div><div class="vie"><i style="width:100%"></i></div></div>`;
const JETONS = `<div class="jeton"><div class="sceau">${picto(PICTOS.epee, 18, '#3a0c06', 1.7)}</div><div class="v"><span class="rubrique">Action</span> <em>disponible</em></div></div>
  <div class="jeton"><div class="chiffre">0</div><div class="v"><span class="rubrique">Avantage</span></div></div>`;
const meuble = ({ genre, camp = 'heros', nom, sous, etat, plaques, pastilles, adverse = false, ouverte = null }) => [
  `<div id="tour-outils" data-piece="tour-outils">${rond('annuler', 19, { ferme: true })}${rond('pause', 19, { ferme: true })}</div>`,
  `<div id="barre" class="cadre bois${adverse ? ' adverse' : ''}" data-piece="barre"><div class="fond">
    <div id="etat">${etat}</div>
    <div id="gestes">
      <div class="plaques">${plaques}</div>
      <div class="pastilles">${pastilles.map(([p, l]) => `<div class="outil${p === ouverte ? ' ouvert' : ''}"><div style="width:34px;height:34px;display:flex">${rond(p, 18, { ferme: adverse }).replace('class="bouton-rond', 'style="width:34px;height:34px" class="bouton-rond')}</div><span class="rubrique">${l}</span></div>`).join('')}</div>
    </div>
  </div><div class="ruban rubrique" style="left:880px;top:-9px">Action</div>${ferrures}</div>`,
  portrait(genre, camp, '').replace('class="portrait', 'id="actif-portrait" class="portrait'),
  `<div id="actif-nom"><div class="n gothique" data-texte="nom de l'actif">${nom}</div><div class="a rubrique">${sous}</div></div>`,
];
/* le bandeau du jet, à la place de la barre */
const bandeau = (titre, classe, contenu, suites) => `<div id="jet" class="cadre bois" data-piece="jet"><div class="fond parchemin ${classe}">
  ${contenu}
  <div id="suites">${suites}</div>
</div><div class="ruban titre">${titre}</div>${ferrures}</div>`;
/* la cible d'un sort, sans dé */
const vise = (genre, nom, role, pv) => `<div class="camp droite visee">${portrait(genre, 'ennemi')}<div><div class="n gothique">${nom}</div><div class="c rubrique">${role}</div>${pv ? `<div class="pv"><div class="vie"><i style="width:100%"></i></div><b class="rubrique">${pv}</b></div>` : ''}</div></div>`;
const APRES = ({ relance = true } = {}) => `${plaque('Appliquer', { armee: true })}${plaque('Relancer', { fermee: !relance })}${plaque('Chance : +1 DR', { large: true })}${plaque('Pacte')}${plaque('Résilience')}`;
/* pose les pièces, cloue le meuble du bas, passe le grain */
const monter = (ui) => {
  document.getElementById('ui').innerHTML = ui.join('');
  const b = document.querySelector('#barre, #jet'); if (b) clouer(b);
  document.getElementById('grain').style.cssText = 'background-image:' + svgUrl(`<svg xmlns='${NS}' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`) + ';mix-blend-mode:overlay;opacity:.3';
};
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { W, H, alea, melange, P, losange, rang, borne, vieux, neuf, borneJ, medaillon, SYSTEME, FERMER, mesure, JETONS, meuble, bandeau, vise, APRES, monter });
