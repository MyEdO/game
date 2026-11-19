/* La fin de séance (#3935, #4411), commune à la fin de séance et à la clôture d'un chapitre (`../rendu.js`) : la case à
   cocher, cochée en laiton plein, son libellé puis ce qu'elle octroie. Maquette hors du jeu. */
const cochable = (libelle, gain, cochee = false) => `<div class="cochable${cochee ? ' cochee' : ''}"><i class="case ${cochee ? 'laiton' : 'fer'}">${cochee ? picto('coche', 13, '#2a1a08', 2.8) : ''}</i><span>${libelle}</span><b class="chiffres">${gain}</b></div>`;
// Partagé avec `../rendu.js`, chargé avant ce script.
Object.assign(globalThis, { cochable });
