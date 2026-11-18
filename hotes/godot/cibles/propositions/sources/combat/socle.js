/* Socle du combat, images d'intention (#3935) : grille isométrique et gabarits de l'écran de combat (ordre, meuble,
   États, réserves) montés sur les pièces de `../gestes.js`, sans décor. `combat.js` y pose la cour, `../voyage/` la mer
   du combat naval. Se charge après `../gestes.js` et `jet.js`. Maquette hors du jeu. */
grad('gauche', [[0, '#000', .62], [1, '#000', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
/* la grille isométrique */
const A = 46, B = 23, OX = 394, OY = -114;
const P = (i, j) => [OX + (i - j) * A, OY + (i + j) * B];
const losange = (x, y, a = A, b = B) => `M${x},${y - b}L${x + a},${y}L${x},${y + b}L${x - a},${y}Z`;

/* ───────── les gabarits de l'écran ───────── */
/* `etats` : les États que porte le combattant (`etatPorte`), sous sa barre ; l'actif et le lu sont choisis */
const combattant = (genre, camp, nom, pv, max, classe = '', etats = '') => rang(genre, {
  camp, nom, classe, gothique: classe.includes('actif'), choisi: /actif|lu/.test(classe),
  taille: classe.includes('actif') ? 'grand' : classe.includes('fantome') ? 'petit' : 'moyen',
  corps: `${classe.includes('fantome') ? '' : `<div class="ligne">${vie(pv, max)}<span class="pv ombre">${pv} / ${max}</span></div>`}${etats ? `<div class="etats">${etats}</div>` : ''}`,
});
const borne = (n) => `<div class="borne">${disque(n)}<span class="rubrique ombre">Round ${n}</span><i></i></div>`;
const vieux = (t) => `<p class="vieux ombre">${t}</p>`, neuf = (t) => `<p class="ombre">${t}</p>`, borneJ = (t) => `<p class="borne-j ombre">${t}</p>`;
/* la pièce fixe : le système */
const SYSTEME = `<div id="systeme" data-piece="systeme">${rond('systeme')}</div>`;
/* le meuble de l'actif : les outils du tour, la barre (état, plaques, pastilles), son portrait et son nom ;
   `conditionnelles` : le second rang de plaques, celles que la situation de l'actif ouvre */
const mesure = (nom, valeur, teinte = 'cire') => { const [a, b] = valeur.split(' / '); return `<div class="mesure"><div class="tete rubrique"><span>${nom}</span><b>${valeur}</b></div>${jauge(a / b, { teinte, taille: 'forte' })}</div>`; };
/* LDB 16 : un État porté, en sceau de cire ; `n` : ses exemplaires cumulés ; `presse` : celui que le joueur vient de presser */
const ETATS = { aTerre: { nom: 'À Terre', icone: 'aTerre' }, hemorragique: { nom: 'Hémorragique', icone: 'goutte' } };
const etatPorte = (id, { n = 1, presse = false } = {}) => `<div class="etat-porte${presse ? ' presse' : ''}">${sceau(ETATS[id].icone, 'menu')}<span class="rubrique">${ETATS[id].nom}</span>${n > 1 ? `<b>${n}</b>` : ''}</div>`;
const JETONS = `<div class="jeton">${sceau('epee')}<div class="v"><span class="rubrique">Action</span> <em>disponible</em></div></div>
  <div class="jeton"><div class="chiffre">0</div><div class="v"><span class="rubrique">Avantage</span></div></div>`;
/* le médaillon de Détermination se presse : il est de laiton, à côté de l'Avantage (transversal §2) ; sans réserve, il manque */
const jetons = (determination = null) => `<div class="jetons">${JETONS}${determination === null ? '' : `<div class="jeton">${rond(determination, 'petit')}<div class="v"><span class="rubrique">Détermination</span></div></div>`}</div>`;
const pas = (n) => `<div class="mesure"><div class="tete rubrique"><span>Mouvement</span><b>${n} / ${n}</b></div>${rangDePas(n, n)}</div>`;
const meuble = ({ genre, camp = 'heros', nom, sous, etat, plaques, conditionnelles = '', pastilles, adverse = false, ouverte = null }) => [
  `<div id="tour-outils" data-piece="tour-outils">${rond('annuler', 'petit', { ferme: true })}${rond('pause', 'petit', { ferme: true })}</div>`,
  cadre('barre', null, null, null, null, '', `
    <div id="etat">${etat}</div>
    <div id="gestes">
      <div class="plaques">${plaques}</div>${conditionnelles ? `
      <div class="plaques conditionnelles">${conditionnelles}</div>` : ''}
      <div class="pastilles">${pastilles.map(([p, l]) => outil(p, l, { ouvert: p === ouverte, ferme: adverse })).join('')}</div>
    </div>
  `, { classe: adverse ? 'adverse' : '', tete: ruban('Action', { style: 'left:930px' }) + clouer() }),
  `<div id="actif-portrait">${portrait(genre, { camp, taille: 'maitre' })}</div>`,
  `<div id="actif-nom"><div class="n gothique" data-texte="nom de l'actif">${nom}</div><div class="a rubrique">${sous}</div></div>`,
];
/* la cible d'un sort, sans dé */
const vise = (genre, nom, role, pv) => `<div class="camp droite visee">${portrait(genre, { camp: 'ennemi', taille: 'grand' })}<div><div class="n gothique">${nom}</div><div class="c rubrique">${role}</div>${pv ? `<div class="pv">${jauge(1, { taille: 'forte' })}<b class="rubrique">${pv}</b></div>` : ''}</div></div>`;
/* les réserves des deux héros de la cour ; Ilyanwe : la fiche validée (`../../../maquettes/fiche-du-heros.jpg`) */
const RESERVES = { ilyanwe: { chance: 4, resilience: 3, determination: 3 }, berta: { chance: 2, resilience: 1, determination: 1 } };
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { P, losange, combattant, borne, vieux, neuf, borneJ, SYSTEME, mesure, etatPorte, JETONS, jetons, pas, meuble, vise, RESERVES });
