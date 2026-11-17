/* Fond commun et charte des gestes, images d'intention (#3935) : ce que les deux socles partagent (dessin du décor,
   textures, ferrures) et les pièces qu'un écran appelle quel que soit son socle. Fermer un
   panneau (`croix`), quitter un lieu (`retour`), ouvrir un écran posé sur celui-ci (`ouvrir`), régler une quantité (`moinsPlus`), dire au survol la raison d'un refus
   (`raison`), dire qui paie (`bourse`), saisir un texte (`champ`). Se charge avant tout socle ; à l'appel, `rond` vient du socle de la page
   (`combat/socle.js` ou un `commun.js`) et `medaillon`, pour la bourse, d'un `commun.js`. Maquette hors du jeu. */
/* ───────── le fond commun aux deux socles : dessin du décor, textures, ferrures ───────── */
const NS = 'http://www.w3.org/2000/svg';
const W = 1707, H = 780;
const el = (hote, tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; hote.appendChild(e); return e; };
const alea = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const melange = (c1, c2, t) => { const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); const a = p(c1), b = p(c2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const svgUrl = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
document.documentElement.style.setProperty('--tex-bois', svgUrl(`<svg xmlns='${NS}' width='600' height='300'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.22' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.30  0.9 0.9 0.9 0 -0.75'/></filter><rect width='100%' height='100%' fill='#c9a57a'/><rect width='100%' height='100%' filter='url(#f)'/></svg>`));
document.documentElement.style.setProperty('--tex-parchemin', svgUrl(`<svg xmlns='${NS}' width='500' height='400'><filter id='a' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='4' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.16  0.9 0.9 0.9 0 -0.95'/></filter><filter id='b' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' fill='#fff'/><rect width='100%' height='100%' filter='url(#a)'/><rect width='100%' height='100%' filter='url(#b)'/></svg>`));
const S = document.getElementById('scene');
const defs = el(S, 'defs');
const grad = (id, stops, attrs = { x1: 0, y1: 0, x2: 0, y2: 1 }, type = 'linearGradient') => { const g = el(defs, type, { id, ...attrs }); stops.forEach(([o, c, a]) => el(g, 'stop', { offset: o, 'stop-color': c, 'stop-opacity': a ?? 1 })); return g; };
const ferrures = '<i class="ferrure hg"></i><i class="ferrure hd"></i><i class="ferrure bg"></i><i class="ferrure bd"></i>';

/* ───────── la charte des gestes ───────── */
/* fermer un panneau posé sur le jeu : la croix de laiton, en haut à droite de l'écran. `dansLePanneau` : elle se pose
   dans le cadre qu'elle ferme, dont la feuille la place */
const croix = ({ dansLePanneau = false } = {}) => `<div class="croix"${dansLePanneau ? '' : ' data-piece="fermer"'}>${rond('croix', 20)}</div>`;
/* quitter un lieu ou un écran de jeu : la pastille du bas à gauche, son libellé dit où l'on retourne */
const retour = (libelle, icone = 'sortie') => `<div class="retour" data-piece="retour">${rond(icone, 24)}<span class="rubrique ombre">${libelle}</span></div>`;
/* ouvrir un écran posé sur celui-ci (carte, dossier du navire, postes de bord) : la pastille du bord droit, à la hauteur `haut` */
const ouvrir = (libelle, icone, haut) => `<div class="ouvrir" data-piece="ouvrir ${libelle}" style="top:${haut}px"><span class="rubrique ombre">${libelle}</span>${rond(icone, 18)}</div>`;
/* régler une quantité : − et +, la valeur réglée entre les deux ; un bord atteint se ferme */
const signe = (d, ouvert) => `<div class="bouton-rond ${ouvert ? 'laiton' : 'fer ferme'}"><div><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${ouvert ? '#e2c06a' : '#7d7668'}" stroke-width="3" stroke-linecap="round"><path d="${d}"/></svg></div></div>`;
const moinsPlus = ({ moins = true, plus = true, entre = '' } = {}) => `<div class="moins-plus">${signe('M6 12h12', moins)}${entre}${signe('M6 12h12M12 6v12', plus)}</div>`;
/* fiche `user-arbitrage-raison-de-refus-au-survol-jamais-inline` : la bulle du geste fermé que le curseur survole */
const raison = (texte) => `<span class="bulle-refus parchemin">${texte}</span>`;
/* #3004. Acte individuel : `bourse({ heros, avoir })`, la bourse de celui qui agit. Entreprise commune ou tarif par
   personne : `bourse({ parts: [[nom, part, avoir]], total })`, la part de chacun réglable avant validation ;
   `reglable: false` pour qui regarde sans régler (l'invité d'une partie à plusieurs). */
const bourse = ({ heros, avoir, parts, total, reglable = true }) => `<div class="qui-paie${parts ? ' parts' : ''}">${medaillon('bourse', { petit: true })}<div class="q">${parts
  ? `<span class="rubrique">Bourses du groupe</span>${parts.map(([nom, part, reste]) => `<div class="part"><span>${nom}</span>${reglable ? moinsPlus({ entre: `<b>${part}</b>` }) : `<b>${part}</b>`}<i>sur ${reste}</i></div>`).join('')}<div class="total"><span class="rubrique">Total</span><b>${total}</b></div>`
  : `<span class="rubrique">Bourse de ${heros}</span><b>${avoir}</b>`}</div></div>`;
/* saisir un texte : le libellé de rubrique s'il y en a un, la valeur et son curseur, ou l'attente d'un champ vide */
const champ = (libelle, valeur, { attente = '', classe = '' } = {}) => `<label class="champ ${classe}">${libelle ? `<span class="rubrique">${libelle}</span>` : ''}<b class="${valeur ? '' : 'vide'}">${valeur || attente}${valeur ? '<i class="curseur-texte"></i>' : ''}</b></label>`;
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { croix, retour, ouvrir, moinsPlus, raison, bourse, champ, W, H, alea, melange, grad, ferrures });
