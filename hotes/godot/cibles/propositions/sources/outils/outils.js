/* Hors partie et outils, images d'intention (#3935). Ajouts au kit (commun.js, systeme.js) : pictogrammes des outils,
   ligne à compte. Maquette hors du jeu. */
/* une ligne de liste : nom, compte à droite */
const ligneDeListe = (nom, compte = '', { la = false, icone = null } = {}) => `<div class="ligne ${la ? 'la' : ''}">${icone ? picto(icone, 16, la ? '#2a1a08' : '#e2c06a') : ''}<span>${nom}</span>${compte !== '' ? `<em class="chiffres">${compte}</em>` : ''}</div>`;
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { ligneDeListe });
