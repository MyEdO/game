/* Socle commun des images d'intention (#3935), né avec « lieux et nuit » : matières, pictogrammes, portraits,
   bandeau des héros, postes, silhouettes de décor. Se charge après `../gestes.js` et `bustes.js`. Maquette hors du jeu. */


/* ───────── le décor : outils de dessin ───────── */
const radial = (id, stops, attrs = { cx: .5, cy: .5, r: .5 }) => grad(id, stops, attrs, 'radialGradient');
const flou = (id, d) => { const f = el(defs, 'filter', { id, x: '-40%', y: '-40%', width: '180%', height: '180%' }); el(f, 'feGaussianBlur', { stdDeviation: d }); };
flou('f1', 0.8); flou('f2', 2); flou('f4', 4); flou('f8', 8); flou('f18', 18);
radial('lueur', [[0, '#ffdf9a', .9], [.16, '#ffb65a', .55], [.45, '#e07a2c', .2], [1, '#e07a2c', 0]]);
radial('coeur', [[0, '#fff3c8', .95], [.3, '#ffc76e', .6], [1, '#ff9a3a', 0]]);
radial('vignette', [[.5, '#000', 0], [.82, '#000', .4], [1, '#000', .82]], { cx: .5, cy: .44, r: .74 });
grad('bas', [[0, '#000', 0], [1, '#000', .85]]);
grad('haut', [[0, '#000', .6], [1, '#000', 0]]);
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
const fermer = () => { // le fond se ferme : coins, bas sous l'interface
  el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)' });
  el(S, 'rect', { x: 0, y: 520, width: W, height: 260, fill: 'url(#bas)' });
};

/* ───────── l'interface ───────── */
const BUSTES = {
  ...COMPAGNIE,
  hote: BASE + '<path d="M22 34c-2-14 6-23 17-23s19 9 17 23c-3-8-9-12-17-12s-14 4-17 12z" fill="#15100c"/><circle cx="39" cy="9" r="5" fill="#15100c"/>',
  docteur: BASE + '<path d="M21 28h36l-3 6H24zM27 28c0-11 5-17 12-17s12 6 12 17z" fill="#15100c"/>',
  brasseur: '<path d="M8 90c0-20 10-27 24-29l-1-7c-7-5-9-17-5-25 4-8 22-8 26 0 4 8 2 20-5 25l-1 7c14 2 24 9 24 29z"/><path d="M25 30c0-10 6-16 14-16s14 6 14 16c-9-3-19-3-28 0z" fill="#15100c"/>',
  batelier: BASE + '<path d="M18 30h42l-2 5H20zM25 30c1-12 6-18 14-18s13 6 14 18z" fill="#15100c"/>',
  cocher: BASE + '<path d="M17 27h44v4H17zM27 27V13h24v14z" fill="#15100c"/>',
};
const portrait = (genre, { classe = '', style = '' } = {}) => `<div class="portrait ${BUSTES_PNJ.has(genre) ? 'pnj fer' : 'laiton'} ${classe}" style="${style}"><div><svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice" fill="${BUSTES_PNJ.has(genre) ? '#14100c' : '#2a1f17'}">${BUSTES[genre]}</svg></div></div>`;
const BUSTES_PNJ = new Set(['hote', 'docteur', 'brasseur', 'batelier', 'cocher']);
const picto = (nom, taille = 22, couleur = '#e2c06a', trait = 1.6) => `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="${couleur}" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round">${PICTOS[nom]}</svg>`;
const PICTOS = {
  journal: '<path d="M4 5c3-1.200 5.500-1.200 8 0v14c-2.500-1.200-5-1.200-8 0zM20 5c-3-1.200-5.500-1.200-8 0v14c2.500-1.200 5-1.200 8 0z"/>',
  systeme: '<circle cx="12" cy="12" r="3.200"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>',
  sortie: '<path d="M10 4H5v16h5M10 12h10M16 8l4 4-4 4"/>',
  route: '<circle cx="12" cy="12" r="8.500"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>',
  lit: '<path d="M3 18V7M3 15h18v3M21 15v-3a2 2 0 0 0-2-2h-8v5M5 12.500a1.800 1.800 0 1 0 3.600 0a1.800 1.800 0 1 0-3.600 0"/>',
  chope: '<path d="M6 7h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 7c0-2 2-3 3.500-2C10.500 3.500 13 3.500 13.500 5c1.500-.5 2.500.5 2.500 2"/>',
  bulle: '<path d="M4 5h16v11h-9l-4 3.500V16H4zM8 9h8M8 12h5"/>',
  des: '<rect x="4" y="4" width="16" height="16" rx="2.500"/><circle cx="8.500" cy="8.500" r=".8"/><circle cx="15.500" cy="15.500" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="15.500" cy="8.500" r=".8"/><circle cx="8.500" cy="15.500" r=".8"/>',
  soin: '<path d="M9.500 4h5v5.500H20v5h-5.500V20h-5v-5.500H4v-5h5.500z"/>',
  scalpel: '<path d="M4 20l6-6M10 14l9-9c1.500 2 1.500 4.500 0 6l-6 6zM8 16l1.500 1.500"/>',
  porte: '<path d="M6 21V8a6 6 0 0 1 12 0v13zM12 3v18M14.500 13h.01"/>',
  tente: '<path d="M12 4L3 20h18zM12 4v-1.500M12 11l-3.500 9M12 11l3.500 9"/>',
  oeil: '<path d="M2.500 12C5 7.500 8.300 5.500 12 5.500s7 2 9.500 6.500c-2.500 4.500-5.800 6.500-9.500 6.500S5 16.500 2.500 12z"/><circle cx="12" cy="12" r="3"/>',
  carte: '<path d="M3.500 6l5.500-2 6 2 5.500-2v14l-5.500 2-6-2-5.500 2zM9 4v14M15 6v14"/>',
  arc: '<path d="M6 3c8 2 12 8 12 18M6 3l12 18M5 21l9-12M5 21l1.500-4M5 21l4-1"/>',
  ciel: '<path d="M7 17a4 4 0 0 1 .5-8 5 5 0 0 1 9.500 1.500 3.300 3.300 0 0 1 0 6.500zM9 20.500h7"/>',
  epee: '<path d="M6 18L17 7l2-3-3 2L5 17zM8 13l3 3M4 20l2-2"/>',
  sommeil: '<path d="M19 14.500A8 8 0 0 1 9.500 5a8 8 0 1 0 9.500 9.500zM15 4h4l-4 4.500h4"/>',
  feu: '<path d="M12 21c-4 0-6.500-2.500-6.500-6 0-3 2-4.500 3-7 1.500 1 2 2.500 2 4 1.500-2 2.500-5 1.500-8.500 4 2 6.500 6 6.500 11 0 4-2.500 6.500-6.500 6.500z"/>',
  vivres: '<path d="M4 13c0-4 3.500-7 8-7s8 3 8 7v4H4zM8 10v3M12 9v4M16 10v3"/>',
  flocon: '<path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2"/>',
  bol: '<path d="M3.500 11h17c0 5-3.500 8.500-8.500 8.500S3.500 16 3.500 11zM9 8c0-1.500 1.500-1.500 1.500-3M13.500 8c0-1.500 1.500-1.500 1.500-3"/>',
  fer_a_cheval: '<path d="M7 20V11a5 5 0 0 1 10 0v9M5 20h4M15 20h4"/>',
  bourse: '<path d="M9 7h6l-1-3h-4zM9 7c-3 2.500-4.500 5.500-4.500 8.500 0 3 3 4.500 7.500 4.500s7.500-1.500 7.500-4.500c0-3-1.500-6-4.500-8.500"/>',
  balance: '<path d="M12 4v16M7 20h10M4 8h16M4 8l-2 6a3.200 3.200 0 0 0 6 0L6 8M20 8l-2 6a3.200 3.200 0 0 0 6 0l-2-6" transform="translate(-.5 0) scale(.96)"/>',
  bouclier: '<path d="M12 3l7.500 2.500v5.500c0 4.800-3.200 8-7.500 9.500-4.300-1.500-7.500-4.700-7.500-9.500V5.500z"/>',
  enclume: '<path d="M4 8h13c0 2-1.500 3.500-4 3.500v3.500h3v4H7v-4h3v-3.500C7 11.500 4 10.500 4 8zM17 8h3.500"/>',
  livre: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6"/>',
  pieces: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.700 3.100 3 7 3s7-1.300 7-3V7M5 12v5c0 1.700 3.100 3 7 3s7-1.300 7-3v-5"/>',
  cible: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.500"/>',
  poing: '<path d="M7 11V7.500a1.500 1.500 0 0 1 3 0V7a1.500 1.500 0 0 1 3 0v.5a1.500 1.500 0 0 1 3 0V9a1.500 1.500 0 0 1 3 0v5c0 4-2.500 6.500-6.500 6.500S6 18 5 15l-1-3c-.4-1.500 1.500-2.500 3-1z"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  moins: '<path d="M6 12h12"/>',
  ancre: '<circle cx="12" cy="5.500" r="2"/><path d="M12 7.500V20M5 13c0 4 3 7 7 7s7-3 7-7M8.500 11h7"/>',
  sablier: '<path d="M7 3h10M7 21h10M8.500 3c0 5 7 6.500 7 9s-7 4-7 9M15.500 3c0 5-7 6.500-7 9s7 4 7 9"/>',
  lune: '<path d="M19 14.500A8 8 0 0 1 9.500 5a8 8 0 1 0 9.500 9.500z"/>',
  ville: '<path d="M4 20V9l2-2 2 2v3h3V6l3-2.500L17 6v6h3v8zM4 20h16M13 9.500h2M7 14h.01M13 14h2"/>',
  cle: '<circle cx="8" cy="8" r="4"/><path d="M11 11l9 9M16.500 16.500l2-2M14 14l2-2"/>',
  coche: '<path d="M5 12.500l4.500 4.500L19 7"/>',
  croix: '<path d="M6 6l12 12M18 6L6 18"/>',
  goutte: '<path d="M12 4c3 4 5 6.500 5 9.500a5 5 0 0 1-10 0C7 10.500 9 8 12 4z"/>',
  botte: '<path d="M9 3v9.500l-4 3.500v4h14v-2.500c0-2-2.500-3-6-3.500V3zM9 7h4M9 10.500h4M5 17.500h14"/>',
  reseau: '<circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="6" r="2.500"/><circle cx="18" cy="18" r="2.500"/><path d="M8.200 10.900l7.600-3.800M8.200 13.100l7.600 3.800"/>',
  roue: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="2"/><path d="M12 3.500v6.500M12 14v6.500M3.500 12H10M14 12h6.500M6 6l4.500 4.500M13.500 13.500L18 18M6 18l4.500-4.500M13.500 10.500L18 6"/>',
};
const rond = (nom, taille, { ferme = false, couleur } = {}) => `<div class="bouton-rond ${ferme ? 'fer ferme' : 'laiton'}"><div>${picto(nom, taille, couleur ?? (ferme ? '#7d7668' : '#e2c06a'))}</div></div>`;
const plaque = (libelle, { armee = false, fermee = false, icone = null, prix = null, classe = '', style = '' } = {}) => `<div class="plaque ${fermee ? 'fer fermee' : 'laiton'}${armee ? ' armee' : ''} ${classe}" style="${style}"><div>${icone ? picto(icone, 19, armee ? '#2a1a08' : fermee ? '#8d8474' : '#e2c06a', 1.7) : ''}${libelle}${prix ? `<span class="prix">${prix}</span>` : ''}</div></div>`;
const medaillon = (nom, { petit = false, ferme = false, taille } = {}) => `<div class="medaillon ${petit ? 'petit' : ''} ${ferme ? 'fer' : 'laiton'}"><div>${picto(nom, taille ?? (petit ? 19 : 27), ferme ? '#8d8474' : '#e2c06a')}</div></div>`;
const pastille = (nom) => `<div class="pst laiton"><div>${picto(nom, 14, '#2a1a08', 1.9)}</div></div>`;
const sceau = (nom, t = 14) => `<div class="sceau">${picto(nom, t, '#3a0c06', 1.9)}</div>`;

const titre = ({ icone, nom, sous, largeur }) => `<div id="titre" class="cadre bois" data-piece="titre" style="width:${largeur}px"><div class="fond bois">${`<div class="medaillon fer"><div>${picto(icone, 27, '#e9dcc0')}</div></div>`}<div><div class="n gothique" data-texte="titre">${nom}</div><div class="s rubrique">${sous}</div></div></div>${ferrures}</div>`;
/* dits : par héros, { texte, icone, mal, choisi, bourse } */
const bandeau = (dits = {}, { bourses = false } = {}) => `<div id="bandeau" class="cadre bois" data-piece="bandeau"><div class="fond bois">${HEROS.map((h) => { const d = dits[h.id] ?? {}; return `
  <div class="heros ${d.choisi ? 'choisi' : ''}">${portrait(h.id, { classe: d.choisi ? 'choisi' : '' })}
    <div class="qui"><div class="nom gothique" data-texte="héros ${h.nom}">${h.nom}</div>
      <div class="l2"><span class="car rubrique">${h.car}${bourses ? ` <span class="bourse lin">· ${h.bourse}</span>` : ''}</span><span class="pv lin">${h.pv} / ${h.max}</span></div>
      <div class="vie"><i style="width:${100 * h.pv / h.max}%"></i></div>
      ${d.texte ? `<div class="dit">${d.mal ? sceau(d.icone) : d.icone ? pastille(d.icone) : ''}<p>${d.texte}</p></div>` : ''}
      ${d.html ?? ''}
    </div>
  </div>`; }).join('')}</div>${ferrures}</div>`;
/* le rail des services d'un lieu : services = [icône, nom, armé] */
const rail = (ruban, services, pied) => `<div id="rail" class="cadre bois" data-piece="services"><div class="fond bois">
  ${services.map(([i, n, a]) => plaque(n, { icone: i, armee: !!a })).join('')}
  <div class="pied rubrique">${pied}</div>
</div><div class="ruban rubrique">${ruban}</div>${ferrures}</div>`;
/* un choix parmi quelques valeurs nommées : la valeur tenue est dorée */
const segments = (options, la) => `<span class="segments">${options.map((o) => `<b class="${o === la ? 'la' : ''}">${o}</b>`).join('')}</span>`;
const ouiNon = (v) => `<span class="oui-non"><b class="${v ? '' : 'la'}">Non</b><b class="${v ? 'la' : ''}">Oui</b></span>`;
const coins = () => `<div id="coins" data-piece="coins">${rond('journal', 23)}${rond('systeme', 23)}</div>`;
/* un poste dans la scène : cx = centre, y = haut ; `heros` : son titulaire, ou ses titulaires ; `plus` : il offre une place de plus */
const poste = (cx, y, { nom, sous, icone, heros = [], ferme = false, vise = false, plus = false }) => { const tenants = [heros].flat(); return `<div class="poste ${tenants.length ? 'occupe' : 'vide'} ${ferme ? 'ferme' : ''} ${vise ? 'vise' : ''}" style="left:${cx - 80}px;top:${y}px">
  ${tenants.length ? `<div class="tenants">${tenants.map((h) => portrait(h)).join('')}${plus ? medaillon('plus', { petit: true }) : ''}</div>` : medaillon(icone, { ferme, taille: 21 })}
  <div class="et bois"><b>${nom}</b>${sous ? `<span class="rubrique">${sous}</span>` : ''}</div></div>`; };
const monter = (pieces) => {
  document.getElementById('ui').innerHTML = pieces.join('');
  const b = document.getElementById('bandeau');
  if (b) [[296, 3], [592, 3], [889, 3], [296, 143], [592, 143], [889, 143], [60, 3], [1120, 3], [60, 143], [1120, 143]].forEach(([x, y]) => { const c = document.createElement('i'); c.className = 'clou'; c.style.left = x + 'px'; c.style.top = y + 'px'; b.appendChild(c); });
  document.getElementById('grain').style.cssText = 'background-image:' + svgUrl(`<svg xmlns='${NS}' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`) + ';mix-blend-mode:overlay';
};
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { rims, sapin, perso, flammes, fermer, plaque, titre, bandeau, rail, segments, ouiNon, coins, poste, monter });
