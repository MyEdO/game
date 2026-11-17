/* Les options (#3935) : les préférences sur un volet de bois, les règles maison dans un registre relié. Un domaine par
   signet, deux pages ouvertes, seules les règles du feuillet ouvert sont visibles. */
const ouiNon = (v) => `<span class="oui-non"><b class="${v ? '' : 'la'}">Non</b><b class="${v ? 'la' : ''}">Oui</b></span>`;
const curseur = (v, min, max, texte = v, l = 118) => `<span class="curseur"><span class="reglette" style="width:${l}px"><u style="width:${100 * (v - min) / (max - min)}%"></u><i style="left:${100 * (v - min) / (max - min)}%"></i></span><span class="val gothique">${texte}</span></span>`;
const segments = (options, la) => `<span class="segments">${options.map((o) => `<b class="${o === la ? 'la' : ''}">${o}</b>`).join('')}</span>`;
const liste = (v) => `<span class="pas-a-pas">${picto('gauche', 15, '#5a4530', 2)}<b class="rubrique">${v}</b>${picto('droite', 15, '#5a4530', 2)}</span>`;
const regle = ({ nom, ref, c, maison = false, modifiee = false, aide = null }) => `
  <div class="regle ${aide ? 'pointee' : ''} ${modifiee ? 'modifiee' : ''}">
    <div class="t"><b data-texte="règle ${nom}">${nom}</b><span class="ref rubrique">${ref}${maison ? ' · valeur maison' : ''}</span></div>
    <div class="c">${modifiee ? `<span class="defaut rubrique">${picto('retour', 12, '#6b1c10', 2)}Défaut</span>` : ''}${c}</div>
    ${aide ? `<p class="aide" data-texte="aide">${aide}</p>` : ''}
  </div>`;
const GAUCHE = [
  { nom: 'Plafond d’Avantage', ref: 'LDB 14 l.198', c: curseur(10, 1, 20) },
  { nom: 'Plafond d’Avantage = Bonus d’Initiative', ref: 'LDB 14 l.197', c: ouiNon(false) },
  { nom: 'Plafond des bonus de Difficulté', ref: 'LDB 14 l.95', c: curseur(60, 0, 100, '+60') },
  { nom: 'Plafond des malus de Difficulté', ref: 'LDB 14 l.95', c: curseur(30, 0, 100, '−30') },
  { nom: 'Frappe Mortelle', ref: 'LDB 14 l.9', c: ouiNon(true), modifiee: true },
  { nom: 'Sur la Défensive', ref: 'LDB 13 l.118', c: ouiNon(true), aide: 'Action « Sur la Défensive » : +20 aux Tests de défense jusqu’au prochain tour. Désactiver retire cette Action.' },
];
const DROITE = [
  { nom: 'Déviation Critique', ref: 'LDB 63 l.30', c: ouiNon(true) },
  { nom: 'Blessures & Critiques (Aux Armes)', ref: 'AA 07 l.1-185', c: segments(['Livre de base', 'Aux Armes'], 'Livre de base') },
  { nom: 'Avantage de groupe (Aux Armes)', ref: 'AA 11 l.3-100', c: ouiNon(false) },
  { nom: 'Tir dans un corps à corps', ref: 'LDB 14 l.112-116', c: ouiNon(true) },
  { nom: 'Coup de corps à corps par une croisée : couvert de la cible', ref: 'LDB 14 l.86', maison: true, c: liste('Très Difficile') },
  { nom: 'Cible Inconsciente', ref: 'LDB 16 l.113', c: segments(['Critique', 'Mort automatique'], 'Critique') },
];
const DOMAINES = [['Tests', 11], ['Destin & Résistance', 1], ['Combat', 22], ['Social', 8], ['Création', 4], ['Marché', 5], ['Activités', 7], ['Avancement', 2], ['Magie', 4], ['Prières', 3], ['Corruption', 1], ['Psychologie', 1], ['Maladies', 2], ['Voyage', 32], ['Possessions', 1]];
const MODIFIES = { Combat: 1, Voyage: 2 };
const pref = (nom, c, aide = '') => `<div class="pref"><div class="l"><b>${nom}</b>${c}</div>${aide ? `<p>${aide}</p>` : ''}</div>`;
const volume = (v) => curseur(v, 0, 100, v + ' %', 104);

el(S, 'rect', { width: W, height: H, fill: '#150c07' });
monter([
  `<div class="calque bois" id="table"></div><div class="calque" id="lueur-table"></div>`,
  titre({ icone: 'systeme', nom: 'Options', sous: 'Préférences et règles maison', largeur: 392 }),
  `<div id="preferences" class="cadre bois" data-piece="préférences"><div class="fond bois"><span class="ruban rubrique">Préférences</span>
     ${pref('Couper le son', ouiNon(false))}
     ${pref('Volume de la musique', volume(70))}
     ${pref('Volume des ambiances', volume(80))}
     ${pref('Volume des effets', volume(100))}
     ${pref('Volume de l’interface', volume(55))}
     <div class="trait"></div>
     ${pref('Cadence de combat', segments(['Manuel', 'Rapide', 'Auto'], 'Manuel'), 'Chaque jet d’un héros passe par sa modale.')}
     ${pref('Dés fixés', ouiNon(false), 'Un champ pour saisir vous-même la valeur du d100, sur les jets que vous contrôlez.')}
   </div>${ferrures}</div>`,
  `<div id="signets" data-piece="signets">${DOMAINES.map(([n, k]) => `<div class="signet ${n === 'Combat' ? 'ouvert' : ''}"><span class="rubrique">${n}</span>${MODIFIES[n] ? '<i class="cire"></i>' : ''}<em class="lin">${k}</em></div>`).join('')}</div>`,
  `<div id="registre" data-piece="registre"><div class="tranche"></div>
     <div class="feuille g parchemin">
       <div class="tete"><span class="dom gothique" data-texte="domaine">Combat</span><span class="sous rubrique">Règles maison · 22 règles</span></div>
       <div class="filet-l"><i></i></div>
       ${GAUCHE.map(regle).join('')}
       <div class="pied"><div class="bouton-rond fer ferme"><div>${picto('gauche', 16, '#7d7668', 1.8)}</div></div><span class="folio rubrique">Feuillet 1 sur 2</span><span class="marque">${sceau('plume', 11)}<i>1 règle modifiée</i></span></div>
     </div>
     <div class="feuille d parchemin">
       <div class="tete"><span class="sous rubrique">Combat, suite</span><span class="sous rubrique">Règles 7 à 12 sur 22</span></div>
       <div class="filet-l"><i></i></div>
       ${DROITE.map(regle).join('')}
       <div class="pied"><span class="suite"><span class="rubrique">Feuillet suivant</span>${rond('droite', 16)}</span></div>
     </div>
     <i class="clou" style="left:8px;top:8px"></i><i class="clou" style="right:8px;top:8px"></i><i class="clou" style="left:8px;bottom:8px"></i><i class="clou" style="right:8px;bottom:8px"></i>
   </div>`,
  croix(),
]);
