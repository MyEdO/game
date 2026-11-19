/* Le socle du jet, images d'intention (#3935) : le bandeau du bas et ses pièces, avant le dé (testeur, réglages,
   « Lancer ») comme après (les deux camps, le verdict, « Appliquer »), les réserves du héros et les gestes qui les
   dépensent. Se pose sur le combat (`socle.js`) comme sur un `commun.js`, sur les pièces de `../gestes.js` ; le portrait
   d'un camp arrive déjà dessiné. Se charge après `../gestes.js`.
   Maquette hors du jeu. */
const camp = ({ cote = '', portrait, nom, carac, seuil, des = ['', ''], regles = false, total = null, dr = null, modif = null, reussite = false, verdict = reussite ? 'réussite' : 'échec' }) => `
  <div class="camp ${cote}">${portrait}
    <div><div class="n gothique">${nom}${modif ? ` <span class="modif rubrique" style="vertical-align:3px;margin-left:6px">${modif}</span>` : ''}</div><div class="c rubrique">${carac}</div>
    <div class="des${regles ? ' regles' : ''}"><span class="seuil">≤ ${seuil}</span>${des.map((d) => (regles ? moinsPlus({ entre: d10(d) }) : d10(d))).join('')}${sceau(total ?? '', 'grand', { etat: total == null ? 'vide' : reussite ? 'reussite' : '' })}${total == null ? '' : `<div class="issue${reussite ? ' reussite' : ''}"><b>${verdict}</b><span>DR ${dr}</span></div>`}</div></div>
  </div>`;
const verdict = (sous, dr, phrase, classe = '') => `<div id="verdict" class="${classe}"><div class="sous rubrique" data-texte="sous-titre">${sous}</div><div class="dr gothique">${dr}</div><p data-texte="phrase d'issue">${phrase}</p></div>`;
/* le bandeau, à la place de la barre de l'actif ou du bandeau des héros */
const bandeauDuJet = (titre, classe, contenu, suites) => cadre('jet', null, null, null, null, `parchemin ${classe}`, `
  ${contenu}
  <div id="suites">${suites}</div>
`, { ruban: titre, tete: clouer(), piece: 'fenetre' });

/* ───────── avant le dé : qui teste, ce qui se règle ───────── */
/* aux suites, devant les réserves : les héros qui peuvent porter le Test, celui qui le porte choisi */
const testeurs = (genres, choisi = 0) => `<div class="testeurs"><span class="rubrique">Testeur</span>${genres.map((g, k) => `<div class="t${k === choisi ? ' choisi' : ''}">${portrait(g, { taille: 'menu', choisi: k === choisi })}</div>`).join('')}</div>`;
/* la colonne du centre : ce sur quoi porte le jet, puis ses réglages */
const reglages = (sous, corps, classe = '') => `<div id="verdict" class="reglages ${classe}"><div class="sous rubrique" data-texte="sous-titre">${sous}</div>${corps}</div>`;
/* un choix exclusif court : une plaque par option, la choisie en laiton plein */
const options = (liste) => `<div class="options">${liste.map(([libelle, o = {}]) => plaque(libelle, { taille: 'petite', ...o })).join('')}</div>`;
/* une option qui s'allume ou s'éteint */
const bascule = (libelle, allumee = false) => `<div class="bascule${allumee ? ' allumee' : ''}"><i class="fer"><b class="laiton"></b></i><span class="rubrique">${libelle}</span></div>`;

/* ───────── les gestes du bandeau ───────── */
/* les réserves d'un héros : un disque par réserve, à gauche des gestes ; `taille` du disque */
const reserves = (r, taille = 'petit') => `<div class="en-reserve">${r.map(([n, t]) => `<div class="res${n ? '' : ' vide'}">${disque(n, { taille, vide: !n })}<span class="rubrique">${t}</span></div>`).join('')}</div>`;
const duHeros = ({ chance, resilience, determination }) => reserves([[chance, 'Chance'], [resilience, 'Résilience'], [determination, 'Détermination']]);
/* `src/i18n/messages/fr.ts:146-149` */
const FERMETURES = { jetReussi: 'Le jet est réussi.', dejaRelance: 'Ce Test a déjà été relancé.', sansChance: 'Plus de Point de Chance.', sansResilience: 'Plus de Point de Résilience.' };
const geste = (libelle, fermeture, survole, classe = '') => plaque(`${libelle}${fermeture && survole ? raison(FERMETURES[fermeture]) : ''}`, { fermee: !!fermeture, classe });
/* LDB 17 l.68 ; `src/noyau/rollFlowFactory.ts:144-147`. `annuler` : le flux sait annuler (`src/noyau/flowVerbs.ts`). */
const avantLeDe = ({ heros, annuler = false, survol = null }) => `${duHeros(heros)}${plaque('Lancer', { armee: true })}${geste('Résilience', heros.resilience > 0 ? null : 'sansResilience', survol === 'resilience')}${annuler ? plaque('Annuler') : ''}`;
/* LDB 17 l.23-24, l.68 ; LDB 12 l.40 ; LDB 19 l.17 ; `src/noyau/rollFlowFactory.ts:124-147`. `echec` : le jet propre du
   héros a échoué ; `relance` : il a déjà été relancé ; `survol` : le geste fermé dont la raison se lit. */
const apresLeDe = ({ heros, echec = false, relance = false, valider = 'Appliquer', survol = null }) => `${duHeros(heros)}${plaque(valider, { armee: true })}${
  geste('Relancer', !echec || relance ? (relance ? 'dejaRelance' : 'jetReussi') : heros.chance > 0 ? null : 'sansChance', survol === 'relancer')}${
  geste('Chance : +1 DR', heros.chance > 0 ? null : 'sansChance', survol === 'chance', 'large')}${plaque('Pacte')}${
  geste('Résilience', !echec ? 'jetReussi' : heros.resilience > 0 ? null : 'sansResilience', survol === 'resilience')}`;
/* la silhouette des localisations : six zones, trois états (libre, choisie, touchee) */
const ZONES = {
  tete: '<circle cx="30" cy="11" r="9"/>',
  corps: '<path d="M19.500,23H40.500L39,56H21Z"/>',
  brasD: '<path d="M17,23.500L9,28L5,56L11.500,57.500L15,37L18,31Z"/>',
  brasG: '<path d="M43,23.500L51,28L55,56L48.500,57.500L45,37L42,31Z"/>',
  jambeD: '<path d="M21,58.500H29.200L28,97H20.500Z"/>',
  jambeG: '<path d="M39,58.500H30.800L32,97H39.500Z"/>',
};
const silhouette = (h, etats = {}) => `<svg class="silhouette" width="${h * .6}" height="${h}" viewBox="0 0 60 100">${Object.entries(ZONES).map(([z, d]) => `<g class="zone ${etats[z] ?? ''}">${d}</g>`).join('')}</svg>`;

// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { camp, verdict, bandeauDuJet, testeurs, reglages, options, bascule, reserves, avantLeDe, apresLeDe, silhouette });
