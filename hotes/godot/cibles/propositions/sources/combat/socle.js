/* Socle du combat, images d'intention (#3935) : grille isométrique et gabarits de l'écran de combat (ordre, rangs,
   mesures) montés sur les pièces de `../gestes.js`, sans décor. La page de rendu des maquettes (`../rendu.js`) y pose la
   cour, `../voyage/navale.js` la mer du combat naval. Se charge après `../gestes.js` et `jet.js`. Maquette hors du jeu. */
grad('gauche', [[0, '#000', .62], [1, '#000', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
/* la grille isométrique */
const A = 46, B = 23, OX = 394, OY = -114;
const P = (i, j) => [OX + (i - j) * A, OY + (i + j) * B];
const losange = (x, y, a = A, b = B) => `M${x},${y - b}L${x + a},${y}L${x},${y + b}L${x - a},${y}Z`;

/* ───────── les gabarits de l'écran ───────── */
/* `etats` : les États que porte le combattant (`etatPorte`), sous sa barre ; l'actif et le lu sont choisis */
const combattant = (genre, camp, nom, pv, max, classe = '', etats = '') => rang(genre, {
  camp, nom, classe, gothique: classe.includes('actif') ? 'petit' : '', choisi: /actif|lu/.test(classe),
  taille: classe.includes('actif') ? 'grand' : classe.includes('fantome') ? 'petit' : 'moyen',
  corps: `${classe.includes('fantome') ? '' : `<div class="ligne">${vie(pv, max)}<span class="pv ombre">${pv} / ${max}</span></div>`}${etats ? `<div class="etats">${etats}</div>` : ''}`,
});
const borne = (n) => `<div class="borne">${disque(n)}<span class="rubrique ombre">Round ${n}</span>${filet({ fondu: true })}</div>`;
const vieux = (t) => `<p class="vieux ombre">${t}</p>`, neuf = (t) => `<p class="ombre">${t}</p>`, borneJ = (t) => `<p class="borne-j ombre">${t}</p>`;
/* la pièce fixe : le système */
const SYSTEME = `<div id="systeme" data-piece="systeme">${rond('systeme')}</div>`;
const mesure = (nom, valeur, teinte = 'cire') => { const [a, b] = valeur.split(' / '); return ligne({ libelle: nom, valeur, variante: 'mesure', format: 'nombre', dessous: jauge(a / b, { teinte, taille: 'forte' }) }); };
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { P, losange, combattant, borne, vieux, neuf, borneJ, SYSTEME, mesure });
