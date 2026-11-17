/* Le socle du jet, images d'intention (#3935) : le bandeau du bas et ses pièces, avant le dé (testeur, réglages,
   « Lancer ») comme après (les deux camps, le verdict, « Appliquer »), les réserves du héros et les gestes qui les
   dépensent, le choix par carte. Se pose sur le combat (`socle.js`) comme sur un `commun.js` : `plaque` et `ferrures`
   viennent du socle de la page, le portrait d'un camp arrive déjà dessiné. Se charge après `../gestes.js`.
   Maquette hors du jeu. */
const d10 = (texte) => `<svg width="36" height="40" viewBox="-19 -21 38 42"><path d="M0,-19L17,-5L10,17L-10,17L-17,-5Z" fill="#b8a67e" stroke="#2a1d12" stroke-width="1.300" stroke-linejoin="round"/><path d="M0,-19L10,4L0,13L-10,4Z" fill="#f1e6cc" stroke="#2a1d12" stroke-width="1" stroke-linejoin="round"/><path d="M-17,-5L-10,4M17,-5L10,4M0,13L-10,17M0,13L10,17" stroke="#2a1d12" stroke-width="1" fill="none"/><text x="0" y="3.500" text-anchor="middle" font-family="Grenze Gotisch" font-weight="600" font-size="${texte.length > 1 ? 12.5 : 15}" fill="#2a1d12">${texte}</text></svg>`;
const camp = ({ cote = '', portrait, nom, carac, seuil, des = ['', ''], regles = false, total = null, dr = null, modif = null, reussite = false, verdict = reussite ? 'réussite' : 'échec', sous = '' }) => `
  <div class="camp ${cote}">${portrait}
    <div><div class="n gothique">${nom}${modif ? ` <span class="modif rubrique" style="vertical-align:3px;margin-left:6px">${modif}</span>` : ''}</div><div class="c rubrique">${carac}</div>
    <div class="des${regles ? ' regles' : ''}"><span class="seuil">≤ ${seuil}</span>${des.map((d) => (regles ? moinsPlus({ entre: d10(d) }) : d10(d))).join('')}<div class="resultat${total == null ? ' vide' : reussite ? ' reussite' : ''}">${total ?? ''}</div>${total == null ? '' : `<div class="issue${reussite ? ' reussite' : ''}"><b>${verdict}</b><span>DR ${dr}</span></div>`}</div>${sous}</div>
  </div>`;
const verdict = (sous, dr, phrase, classe = '') => `<div id="verdict" class="${classe}"><div class="sous rubrique" data-texte="sous-titre">${sous}</div><div class="dr gothique">${dr}</div><p data-texte="phrase d'issue">${phrase}</p></div>`;
/* le bandeau, à la place de la barre de l'actif ou du bandeau des héros */
const bandeauDuJet = (titre, classe, contenu, suites) => `<div id="jet" class="cadre bois" data-piece="jet"><div class="fond parchemin ${classe}">
  ${contenu}
  <div id="suites">${suites}</div>
</div><div class="ruban">${titre}</div>${ferrures}</div>`;
/* les clous d'un meuble du bas : barre de l'actif, bandeau du jet, bandeau d'arrêt */
const clouer = (b) => { const h = b.offsetHeight, w = b.offsetWidth; [[.0593, 3], [.2797, 3], [.7203, 3], [.9407, 3], [.0593, h - 9], [.2797, h - 9], [.5, h - 9], [.7203, h - 9], [.9407, h - 9]].forEach(([t, y]) => { const c = document.createElement('i'); c.className = 'clou'; c.style.left = Math.round(w * t) + 'px'; c.style.top = y + 'px'; b.appendChild(c); }); };

/* ───────── avant le dé : qui teste, ce qui se règle ───────── */
/* sous le camp du testeur (`camp({ sous })`) : les héros qui peuvent porter le Test, celui qui le porte éclairé */
const testeurs = (portraits, choisi = 0) => `<div class="testeurs"><span class="rubrique">Testeur</span>${portraits.map((p, k) => `<div class="t${k === choisi ? ' choisi' : ''}">${p}</div>`).join('')}</div>`;
/* la colonne du centre : ce sur quoi porte le jet, puis ses réglages */
const reglages = (sous, corps, classe = '') => `<div id="verdict" class="reglages ${classe}"><div class="sous rubrique" data-texte="sous-titre">${sous}</div>${corps}</div>`;
/* un choix exclusif court : une plaque par option, la choisie en laiton plein */
const options = (liste) => `<div class="options">${liste.map(([libelle, o = {}]) => plaque(libelle, o)).join('')}</div>`;
/* une option qui s'allume ou s'éteint */
const bascule = (libelle, allumee = false) => `<div class="bascule${allumee ? ' allumee' : ''}"><i class="fer"><b class="laiton"></b></i><span class="rubrique">${libelle}</span></div>`;
/* choisir par carte : la carte pressée passe en laiton plein, une plaque des suites commet le choix */
const carte = (nom, sous, { armee = false, fermee = false, portrait = '', classe = '' } = {}) => `<div class="plaque ${fermee ? 'fer fermee' : 'laiton'} carte${armee ? ' armee' : ''} ${classe}"><div>${portrait}<div class="qui"><div class="n gothique">${nom}</div><div class="c">${sous}</div></div></div></div>`;

/* ───────── les gestes du bandeau ───────── */
/* les réserves d'un héros : un médaillon par réserve, à gauche des gestes */
const reserves = (...r) => `<div class="en-reserve">${r.map(([n, t]) => `<div class="res${n ? '' : ' vide'}"><div class="disque fer"><div>${n}</div></div><span class="rubrique">${t}</span></div>`).join('')}</div>`;
const duHeros = ({ chance, resilience, determination }) => reserves([chance, 'Chance'], [resilience, 'Résilience'], [determination, 'Détermination']);
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
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { d10, camp, verdict, bandeauDuJet, clouer, testeurs, reglages, options, bascule, carte, reserves, avantLeDe, apresLeDe });
