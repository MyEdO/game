/* Héros : création et progression, images d'intention (#3935). Pièces de la famille : frise des étapes, panneaux,
   héros qui se dessine, bande de profil. Posé sur commun.js, dont il prend le bandeau. Maquette hors du jeu. */
const SANG = '#8f2a1a';

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

/* une Compétence et sa spécialité */
const nomDe = (n, spec) => `${n}${spec ? ` <small>(${spec})</small>` : ''}`;
const rub = (t, note = '') => `<div class="rub">${t}${note ? ` <span class="note">${note}</span>` : ''}</div>`;
const car = (ab) => `<span class="tag">${ab}</span>`;
const coche = (taille = 'menu') => rond('coche', taille, { arme: true });

/* ───────── la frise des étapes : pastille cochée, ruban de l'étape en cours, clou ───────── */
const PAGES = ['Race', 'Carrière', 'Caractéristiques', 'Signe astral', 'Compétences de race', 'Compétences de carrière', 'Talents', 'Possessions', 'Identité', 'Présentation'];
const frise = (rang) => {
  const x = (i) => 88 + i * 152;
  const etapes = PAGES.map((p, i) => {
    if (i < rang - 1) return `<div class="etape faite" style="left:${x(i)}px">${rond('coche', 'menu')}<span class="rubrique">${p}</span></div>`;
    if (i === rang - 1) return `<div class="etape" style="left:${x(i)}px">${ruban(`${p}<small class="chiffres">${rang}/${PAGES.length}</small>`, { gothique: true })}</div>`;
    return `<div class="etape a-venir" style="left:${x(i)}px"><i class="clou"></i>${i === rang ? `<span class="rubrique">${p}</span>` : ''}</div>`;
  }).join('');
  return cadre('frise', 26, 12, 1655, 74, 'bois', `<i class="rail fait" style="left:${x(0)}px;width:${x(rang - 1) - x(0)}px"></i><i class="rail" style="left:${x(rang - 1)}px;width:${x(9) - x(rang - 1)}px"></i>${etapes}${croix({ dansLePanneau: true })}`);
};

/* ───────── les trois panneaux ───────── */
const gauche = (contenu) => cadre('choix', 26, 96, 610, 512, 'parchemin', contenu, { classe: 'pan' });
const centre = (ruban, contenu) => cadre('page', 653, 96, 482, 512, 'parchemin', `<div class="page-c">${contenu}</div>`, { ruban, classe: 'pan' });
/* acquis : [rubrique, valeur, jeton] ; gestes : { suivant, refus } ; `refus` ferme « Suivant » et se dit au survol */
const herosNeuf = ({ nom = 'Nouveau héros', acquis, pose, suivant = 'Suivant', refus = null, palette = false }) => cadre('heros-neuf', 1152, 96, 529, 512, 'bois', `
  <div class="niche laiton"><div>${figure(pose, { palette })}</div></div>
  <div class="acquis">
    <div class="qui" data-texte="nom du héros">${nom}</div>
    ${acquis.map(([r, v, j]) => `<div class="a"><i>${r}</i><b>${v}${j ? `<span class="jeton">${j}</span>` : ''}</b></div>`).join('')}
    <div class="gestes">
      ${refus ? plaque(`${suivant} ${picto('chevron_d', 16, undefined, 2)}${raison(refus)}`, { fermee: true, taille: 'petite' }) : plaque(`${suivant} ${picto('chevron_d', 16, undefined, 2)}`, { armee: true })}
      ${plaque(`${picto('chevron_g', 15, undefined, 2)} Précédent`, { taille: 'petite' })}
    </div>
  </div>`, { classe: 'pan' });

/* ───────── le bandeau : le groupe, le héros lu ou à venir éclairé ───────── */
/* le groupe en création : le héros neuf se dessine tant qu'il n'a pas de portrait (`neuf.id`) */
const groupeEnCreation = (neuf = {}) => { const h = { id: 'esquisse', nom: 'Nouveau héros', car: 'Artiste', ...neuf };
  return bandeau({ [h.id]: { choisi: true } }, { groupe: [...HEROS.slice(0, 2), h] }); };
const groupeDIlyanwe = (lu = 'ilyanwe') => bandeau({ [lu]: { choisi: true } }, { groupe: [
  { id: 'ilyanwe', nom: 'Ilyanwe la Voilée', car: 'Sorcière', pv: 17, max: 17 },
  { id: 'berta', nom: 'Berta', car: 'Soldate', pv: 12, max: 12 },
] });

/* ───────── la bande de profil, les réserves ───────── */
const ABR = ['M', 'CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc', 'B'];
/* une case de la bande : [valeur, Augmentations, prix de la suivante, de la carrière] */
const caseDeCarac = ([v, aug, cout, carriere], i) => `<div class="c ${carriere ? 'carr' : ''}"><span class="ab">${ABR[i]}</span><span class="v">${v}</span><span class="aug">${aug ? `+${aug}` : ''}</span>${cout ? `<span class="jeton ${carriere ? 'or' : 'fer'}">${cout} PX</span>` : ''}</div>`;
/* régler une répartition : − et +, le + fermé quand elle est pleine */
const pm = (plein) => `<div class="pm">${rond('moins', 'menu', { arme: true })}${rond('plus', 'menu', plein ? { ferme: true } : { arme: true })}</div>`;
const reserve = (n, nom) => `<div class="reserve">${disque(n, { taille: 'grand' })}<span class="rub">${nom}</span></div>`;

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
Object.assign(globalThis, { nomDe, rub, car, coche, frise, gauche, centre, herosNeuf, groupeEnCreation, groupeDIlyanwe, ABR, caseDeCarac, pm, reserve, poser, ACQUIS });
