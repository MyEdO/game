/* Hors partie et outils, images d'intention (#3935). Ajouts au kit (commun.js, systeme.js) : pictogrammes des outils,
   champ de saisie, ligne à compte. Maquette hors du jeu. */
Object.assign(PICTOS, {
  loupe: '<circle cx="10.500" cy="10.500" r="6"/><path d="M15 15l5.500 5.500"/>',
  selection: '<path d="M6 3.500l12 9-5.500 1 3 6-2.500 1.200-3-6L6 18.500z"/>',
  terrain: '<path d="M12 4l9 5-9 5-9-5zM3 14l9 5 9-5"/>',
  hauteur: '<path d="M4 20h16M7 20V10M7 10l-3 3M7 10l3 3M15 20V5M15 5l-3 3M15 5l3 3"/>',
  murs: '<path d="M3 6h18v12H3zM3 10h18M3 14h18M9 6v4M15 10v4M9 14v4M15 6v0"/>',
  volee: '<path d="M3 20h5v-4h5v-4h5V8h3"/>',
  crenelage: '<path d="M3 20V8h4v4h3V8h4v4h3V8h4v12z"/>',
  decor: '<path d="M7 4h10c2 5 2 11 0 16H7C5 15 5 9 7 4zM5.800 9h12.400M5.800 15h12.400"/>',
  personnage: '<circle cx="12" cy="7.500" r="3.500"/><path d="M5 20c0-4.500 3-7 7-7s7 2.500 7 7"/>',
  navire: '<path d="M3 15h18l-2.500 5h-13zM12 15V3M12 4c4 1 6 4 6 8h-6M12 6c-3 1-4.500 3-5 6h5"/>',
  baliste: '<path d="M4 18l14-9M6 8c5 0 9 4 9 9M4 18l1-4M4 18l4 .5M18 9l2-3"/>',
  depart: '<path d="M6 21V4M6 4h11l-3 4 3 4H6"/>',
  zone: '<path d="M4 4h4M11 4h3M17 4h3v3M20 10v4M20 17v3h-3M14 20h-3M8 20H4v-3M4 14v-4M4 7V4"/>',
  gomme: '<path d="M4 16l9-10 7 6-7 8H8zM9.500 10.500l6.500 6M12 20h8"/>',
  epingle: '<path d="M12 21c-4-5-6-8-6-11a6 6 0 0 1 12 0c0 3-2 6-6 11z"/><circle cx="12" cy="10" r="2.200"/>',
  chemin: '<circle cx="5.500" cy="18" r="2"/><circle cx="18.500" cy="6" r="2"/><path d="M7.500 18h6a3 3 0 0 0 0-6h-3a3 3 0 0 1 0-6h6"/>',
  etoile: '<path d="M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.800-5.200-2.800-5.200 2.800 1-5.800-4.300-4.100 5.900-.8z"/>',
  copier: '<rect x="8" y="8" width="12" height="12" rx="1.500"/><path d="M16 8V4H4v12h4"/>',
  refaire: '<path d="M15 6.500L19.500 11 15 15.500M19.500 11H10a4.500 4.500 0 0 0 0 9h4"/>',
  couches: '<path d="M12 4l9 4.500-9 4.500-9-4.500zM3 12.500l9 4.500 9-4.500M3 16.500l9 4.500 9-4.500"/>',
});
/* un champ de saisie : libellé de rubrique, valeur ou attente */
const champ = (libelle, valeur, { attente = '', classe = '' } = {}) => `<label class="champ ${classe}"><span class="rubrique">${libelle}</span><b class="${valeur ? '' : 'vide'}">${valeur || attente}${valeur ? '<i class="curseur-texte"></i>' : ''}</b></label>`;
/* une ligne de liste : nom, compte à droite */
const ligneDeListe = (nom, compte = '', { la = false, icone = null } = {}) => `<div class="ligne ${la ? 'la' : ''}">${icone ? picto(icone, 16, la ? '#2a1a08' : '#e2c06a') : ''}<span>${nom}</span>${compte !== '' ? `<em class="lin">${compte}</em>` : ''}</div>`;
const fondDeTable = () => { el(S, 'rect', { width: W, height: H, fill: '#150c07' }); return `<div class="calque bois" id="table"></div><div class="calque" id="lueur-table"></div>`; };
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { champ, ligneDeListe, fondDeTable });
