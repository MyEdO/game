/* Charte des gestes, images d'intention (#3935) : les pièces qu'un écran appelle quel que soit son socle. Fermer un
   panneau (`croix`), quitter un lieu (`retour`), régler une quantité (`moinsPlus`), dire au survol la raison d'un refus
   (`raison`), dire qui paie (`bourse`). Se charge avant tout socle ; à l'appel, `rond` vient du socle de la page
   (`combat/socle.js` ou un `commun.js`) et `medaillon`, pour la bourse, d'un `commun.js`. Maquette hors du jeu. */
/* fermer un panneau posé sur le jeu : la croix de laiton, en haut à droite de l'écran. `dansLePanneau` : elle se pose
   dans le cadre qu'elle ferme, dont la feuille la place */
const croix = ({ dansLePanneau = false } = {}) => `<div class="croix"${dansLePanneau ? '' : ' data-piece="fermer"'}>${rond('croix', 20)}</div>`;
/* quitter un lieu ou un écran de jeu : la pastille du bas à gauche, son libellé dit où l'on retourne */
const retour = (libelle, icone = 'sortie') => `<div class="retour" data-piece="retour">${rond(icone, 24)}<span class="rubrique ombre">${libelle}</span></div>`;
/* régler une quantité : − et +, la valeur réglée entre les deux ; un bord atteint se ferme */
const signe = (d, ouvert) => `<div class="bouton-rond ${ouvert ? 'laiton' : 'fer ferme'}"><div><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${ouvert ? '#e2c06a' : '#7d7668'}" stroke-width="3" stroke-linecap="round"><path d="${d}"/></svg></div></div>`;
const moinsPlus = ({ moins = true, plus = true, entre = '' } = {}) => `<div class="moins-plus">${signe('M6 12h12', moins)}${entre}${signe('M6 12h12M12 6v12', plus)}</div>`;
/* fiche `user-arbitrage-raison-de-refus-au-survol-jamais-inline` : la bulle du geste fermé que le curseur survole */
const raison = (texte) => `<span class="bulle-refus parchemin">${texte}</span>`;
/* #3004. Acte individuel : `bourse({ heros, avoir })`, la bourse de celui qui agit. Entreprise commune ou tarif par
   personne : `bourse({ parts: [[nom, part, avoir]], total })`, la part de chacun réglable avant validation. */
const bourse = ({ heros, avoir, parts, total }) => `<div class="qui-paie${parts ? ' parts' : ''}">${medaillon('bourse', { petit: true })}<div class="q">${parts
  ? `<span class="rubrique">Bourses du groupe</span>${parts.map(([nom, part, reste]) => `<div class="part"><span>${nom}</span>${moinsPlus({ entre: `<b>${part}</b>` })}<i>sur ${reste}</i></div>`).join('')}<div class="total"><span class="rubrique">Total</span><b>${total}</b></div>`
  : `<span class="rubrique">Bourse de ${heros}</span><b>${avoir}</b>`}</div></div>`;
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { croix, retour, moinsPlus, raison, bourse });
