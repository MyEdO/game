/* Héros : création et progression, images d'intention (#3935). Pièces de la famille : frise des étapes, panneaux,
   héros qui se dessine, bande de profil, bandeau. Posé sur commun.js. Maquette hors du jeu. */
Object.assign(PICTOS, {
  etoile: '<path d="M12 3.500l2.300 5.400 5.700.500-4.300 3.800 1.300 5.700L12 15.900 7 18.900l1.300-5.700L4 9.400l5.700-.500z"/>',
  palette: '<path d="M12 4c-4.700 0-8.500 3.400-8.500 7.600 0 4 3.300 7.400 7.500 7.400 1.300 0 1.800-.900 1.300-1.900-.6-1.200.2-2.400 1.600-2.400h2.300c2.400 0 4.300-1.800 4.300-4.100C20.500 6.900 16.700 4 12 4z"/><circle cx="8" cy="10" r=".9"/><circle cx="12" cy="7.800" r=".9"/><circle cx="16" cy="9.500" r=".9"/>',
  couronne: '<path d="M4 18h16M4.500 15l-1-8 4.500 4 4-6 4 6 4.500-4-1 8z"/>',
  epi: '<path d="M12 21V9M12 9c-2-1-3-3-3-5 2 .5 3 2 3 5zM12 9c2-1 3-3 3-5-2 .5-3 2-3 5zM12 14c-2-1-4-1-5-3M12 14c2-1 4-1 5-3M12 18c-2-1-4-1-5-3M12 18c2-1 4-1 5-3"/>',
  chariot: '<circle cx="8" cy="17" r="2.500"/><circle cx="17" cy="17" r="2.500"/><path d="M3 14V8h12v6M15 10h3.500l2.500 3v1"/>',
  masque: '<path d="M4 7c5-2 11-2 16 0 0 6-3 11-8 11S4 13 4 7zM8 10.500h2.500M13.500 10.500H16M9.500 14.500c1.500 1 3.500 1 5 0"/>',
  chevron_d: '<path d="M9 6l6 6-6 6"/>',
  chevron_g: '<path d="M15 6l-6 6 6 6"/>',
  plume: '<path d="M5 19c1-7 5-13 14-15-1 8-5 12-11 13M5 19l3-3M9 13l3 .5"/>',
  de20: '<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9zM12 3v5.500M4 7.500l8 1 8-1M12 8.500l-5 8.500h10zM4 16.500l3 .500M20 16.500l-3 .500M12 21v-4"/>',
  cadenas: '<rect x="5.500" y="11" width="13" height="9" rx="1.500"/><path d="M8.500 11V8a3.500 3.500 0 0 1 7 0v3"/>',
});
Object.assign(BUSTES, {
  ilyanwe: BASE + '<path fill-rule="evenodd" d="M15 90C9 54 15 9 39 9s30 45 24 81zM27 43c0 9 5 15 12 15s12-6 12-15c0-10-5-17-12-17s-12 7-12 17z" fill="#1c1410"/><path d="M27 34c7-4 17-4 24 0l1 4c-8-4-18-4-26 0z" fill="#e9dcc0"/>',
  berta: BASE + '<circle cx="39" cy="8" r="6.500" fill="#1c1410"/><path d="M24 33c-1-13 6-21 15-21s16 8 15 21c-4-7-9-10-15-10s-11 3-15 10z" fill="#1c1410"/>',
  astrid: BASE + '<path d="M21 26c1-9 9-15 20-14 9 1 15 6 14 13-11-3-23-3-34 1z" fill="#1c1410"/><path d="M23 34c-1 8 0 16 2 22l5-3c-2-7-2-13 0-19zM55 34c1 8 0 16-2 22l-5-3c2-7 2-13 0-19z" fill="#1c1410"/>',
});
const SANG = '#8f2a1a';
/* le buste à l'esquisse : au trait de sanguine, avec ses repères */
const BUSTE_ESQUISSE = `<g fill="none" stroke="${SANG}" stroke-width="1.300"><path d="M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28"/><path d="M21 26c1-9 9-15 20-14 9 1 15 6 14 13-11-3-23-3-34 1z" fill="rgba(143,42,26,.25)"/><path d="M39 2v88M10 42h58" stroke-dasharray="2 3" stroke-width=".7"/></g>`;
const portraitEsquisse = (classe = '') => `<div class="portrait esquisse laiton ${classe}"><div><svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice">${BUSTE_ESQUISSE}</svg></div></div>`;

/* la figure du héros neuf : `pose` dit jusqu'où la sanguine est posée (0 = tout au trait, 1 = achevée) */
const figure = (pose, { palette = false } = {}) => {
  const bas = Math.round(40 + pose * 380);
  return `<svg viewBox="0 0 200 430" preserveAspectRatio="xMidYMid meet">
  <defs><linearGradient id="sang" gradientUnits="userSpaceOnUse" x1="0" y1="${Math.max(30, bas - 150)}" x2="0" y2="${bas}"><stop offset="0" stop-color="#7c2416" stop-opacity=".92"/><stop offset="1" stop-color="#7c2416" stop-opacity="${pose >= 1 ? .92 : 0}"/></linearGradient></defs>
  <g fill="none" stroke="${SANG}" stroke-width=".8" stroke-dasharray="3 4" opacity="${pose >= 1 ? .35 : .8}"><path d="M100 22v386M38 122h124"/><circle cx="100" cy="76" r="29"/></g>
  <ellipse cx="100" cy="398" rx="64" ry="9" fill="none" stroke="${SANG}" stroke-width="1"/>
  <ellipse cx="100" cy="398" rx="44" ry="5.500" fill="none" stroke="${SANG}" stroke-width=".7" opacity=".7"/>
  <g fill="url(#sang)" stroke="${SANG}" stroke-width="1.400" stroke-linejoin="round">
    <path d="M74 300l-3 86-11 8h36l3-94zM126 300l3 86 11 8h-36l-3-94z"/>
    <path d="M100 100c-17 0-34 8-40 22l-10 112 12 4 5-74-4 142h74l-4-142 5 74 12-4-10-112c-6-14-23-22-40-22z"/>
    <circle cx="100" cy="76" r="21"/>
    <path d="M70 64c-3-20 22-27 40-25 17 2 26 12 21 24-19-6-41-6-61 1z"/>
    ${palette ? '<path d="M150 226c14-3 26 5 26 16 0 9-8 14-17 13-5-1-4-6-9-7-6-1-9-5-8-10 1-6 4-11 8-12z"/><path d="M48 240l-16 46" stroke-width="2.200"/>' : ''}
  </g>
  ${palette ? `<g fill="#e9dcc0"><circle cx="158" cy="236" r="2.200"/><circle cx="166" cy="242" r="2.200"/><circle cx="164" cy="250" r="2.200"/></g>` : ''}
</svg>`;
};

const cadre = (id, x, y, w, h, matiere, contenu, { ruban = null, classe = '' } = {}) => `<div id="${id}" class="cadre bois ${classe}" data-piece="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><div class="fond ${matiere}">${contenu}</div>${ruban ? `<div class="ruban gothique">${ruban}</div>` : ''}${ferrures}</div>`;
const sep = () => '<div class="sep"><i></i></div>';
const rub = (t, note = '') => `<div class="rub">${t}${note ? ` <span class="note">${note}</span>` : ''}</div>`;
const car = (ab) => `<span class="tag">${ab}</span>`;
const coche = (taille = 26) => `<div class="pst laiton" style="width:${taille}px;height:${taille}px"><div>${picto('coche', Math.round(taille * .55), '#2a1a08', 2.2)}</div></div>`;

/* ───────── la frise des étapes : pastille cochée, ruban de l'étape en cours, clou ───────── */
const PAGES = ['Race', 'Carrière', 'Caractéristiques', 'Signe astral', 'Compétences de race', 'Compétences de carrière', 'Talents', 'Possessions', 'Identité', 'Présentation'];
const frise = (rang) => {
  const x = (i) => 88 + i * 152;
  const etapes = PAGES.map((p, i) => {
    if (i < rang - 1) return `<div class="etape faite" style="left:${x(i)}px"><div class="pst laiton"><div>${picto('coche', 14, '#e2c06a', 2)}</div></div><span class="rubrique">${p}</span></div>`;
    if (i === rang - 1) return `<div class="etape" style="left:${x(i)}px"><div class="ruban gothique" data-texte="étape">${p}<small class="lin">${rang}/${PAGES.length}</small></div></div>`;
    return `<div class="etape a-venir" style="left:${x(i)}px"><i class="clou"></i>${i === rang ? `<span class="rubrique">${p}</span>` : ''}</div>`;
  }).join('');
  return cadre('frise', 26, 12, 1655, 74, 'bois', `<i class="rail fait" style="left:${x(0)}px;width:${x(rang - 1) - x(0)}px"></i><i class="rail" style="left:${x(rang - 1)}px;width:${x(9) - x(rang - 1)}px"></i>${etapes}${croix({ dansLePanneau: true })}`);
};

/* ───────── les trois panneaux ───────── */
const gauche = (contenu) => cadre('choix', 26, 96, 610, 512, 'parchemin', contenu, { classe: 'pan' });
const centre = (ruban, contenu) => cadre('page', 653, 96, 482, 512, 'parchemin', `<div class="page-c">${contenu}</div>`, { ruban, classe: 'pan' });
/* acquis : [rubrique, valeur, jeton] ; gestes : { suivant, refus } */
const herosNeuf = ({ nom = 'Nouveau héros', acquis, pose, suivant = 'Suivant', refus = null, palette = false }) => cadre('heros-neuf', 1152, 96, 529, 512, 'bois', `
  <div class="niche laiton"><div>${figure(pose, { palette })}</div></div>
  <div class="acquis">
    <div class="qui" data-texte="nom du héros">${nom}</div>
    ${acquis.map(([r, v, j]) => `<div class="a"><i>${r}</i><b>${v}${j ? `<span class="jeton">${j}</span>` : ''}</b></div>`).join('')}
    <div class="gestes">
      ${refus ? `<div class="refus">${refus}</div>` : ''}
      ${refus ? plaque(`${suivant} ${picto('chevron_d', 16, '#8d8474', 2)}`, { fermee: true }) : plaque(`${suivant} ${picto('chevron_d', 16, '#2a1a08', 2)}`, { armee: true })}
      ${plaque(`${picto('chevron_g', 15, '#e2c06a', 2)} Précédent`)}
    </div>
  </div>`, { classe: 'pan' });

/* ───────── le bandeau : le groupe, le héros lu ou à venir éclairé ───────── */
const caseHeros = ({ id, nom, car: c, pv, max, choisi = false, esquisse = false, etat = null }) => `
  <div class="heros ${choisi ? 'choisi' : ''}">${esquisse ? portraitEsquisse(choisi ? 'choisi' : '') : portrait(id, { classe: choisi ? 'choisi' : '' })}
    <div class="qui"><div class="nom gothique" data-texte="héros ${nom}">${nom}</div>
      <div class="l2"><span class="car rubrique">${c}</span>${max ? `<span class="pv lin">${pv} / ${max}</span>` : ''}</div>
      ${max ? `<div class="vie"><i style="width:${100 * pv / max}%"></i></div>` : ''}
      ${etat ? `<div class="etat">${sceau('sortie', 13)}${etat}</div>` : ''}
    </div>
  </div>`;
const bandeauDe = (cases) => `<div id="bandeau" class="cadre bois b${cases.length}" data-piece="bandeau"><div class="fond bois">${cases.map(caseHeros).join('')}</div>${ferrures}</div>`;
const groupeEnCreation = (neuf = {}) => bandeauDe([
  { id: 'bjorn', nom: 'Bjorn', car: 'Chasseur', pv: 16, max: 16 },
  { id: 'mira', nom: 'Mira', car: 'Éclaireuse', pv: 11, max: 11 },
  { id: 'astrid', nom: 'Nouveau héros', car: 'Artiste', choisi: true, esquisse: true, ...neuf },
]);
const groupeDIlyanwe = () => bandeauDe([
  { id: 'ilyanwe', nom: 'Ilyanwe la Voilée', car: 'Sorcière', pv: 17, max: 17, choisi: true },
  { id: 'berta', nom: 'Berta', car: 'Soldate', pv: 12, max: 12 },
]);

/* ───────── la bande de profil ───────── */
const ABR = ['M', 'CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc', 'B'];

const poser = (pieces) => {
  document.getElementById('ui').innerHTML = '<div id="mur" class="bois"></div>' + pieces.join('');
  document.getElementById('grain').style.cssText = 'background-image:' + svgUrl(`<svg xmlns='${NS}' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`) + ';mix-blend-mode:overlay;opacity:.2';
};
/* le héros d'exemple de la création, étape par étape */
const ACQUIS = [
  ['Race', 'Humains (Reiklander)', '+20 PX'],
  ['Carrière · Courtisans', 'Artiste', '+50 PX'],
  ['Caractéristiques', 'Jets gardés', '+50 PX'],
  ['Signe astral', 'Le Trait du Peintre', '+25 PX'],
];
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { sep, rub, car, coche, frise, gauche, centre, herosNeuf, groupeEnCreation, groupeDIlyanwe, ABR, poser, ACQUIS });
