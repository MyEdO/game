/* La fin de séance (#3935), commune à `fin-de-seance` et à `fin-de-chapitre` : les cases de chaque héros et du groupe,
   et ce que leur validation octroie. LDB 05 l.795-799, l.837-841 ; LDB 17 l.41, l.81 ; `src/noyau/partyFlow.ts:694`,
   `src/engine/session.ts:28`, `verbe.finDeSeance.*` de `src/i18n/messages/fr.ts`. Motivations et Ambitions écrites :
   les exemples de LDB 05 l.444, l.776-778, l.786-788. Se charge après `systeme.js`. Maquette hors du jeu. */
const PX_D_AMBITION = { courte: 50, longue: 500 };
const GROUPE = { courte: true, longue: false };
const SEANCE = {
  bjorn: { motivation: '« Amateur de sensations fortes »', courte: 'Venger un camarade tombé au combat.', longue: 'Posséder votre propre relais de diligences.', coches: { courte: true } },
  mira: { motivation: '« Rebelle »', courte: 'Ruiner la réputation d’un rival amoureux.', longue: 'Faire de votre village une ville prospère', coches: { motivation: true } },
  aldric: { motivation: '« Esprit brillant »', courte: 'Se lier d’amitié avec un érudit solitaire', longue: 'Débarrasser les Collèges de Magie de l’influence des elfes.', coches: {} },
  greta: { motivation: '« Protectrice »', courte: null, longue: null, coches: {} },
};
/* Mira a dépensé un Point de Détermination : sa Motivation le lui rend */
HEROS.find((h) => h.id === 'mira').determination = 1;
const pxDeLaSeance = (id) => ['courte', 'longue'].reduce((n, terme) => n + PX_D_AMBITION[terme] * (!!SEANCE[id].coches[terme] + GROUPE[terme]), 0);
/* une case : cochée en laiton plein ; son libellé, puis ce qu'elle octroie */
const cochable = (libelle, gain, cochee = false) => `<div class="cochable${cochee ? ' cochee' : ''}"><i class="case ${cochee ? 'laiton' : 'fer'}">${cochee ? picto('coche', 13, '#2a1a08', 2.8) : ''}</i><span>${libelle}</span><b class="lin">${gain}</b></div>`;
const casesDuGroupe = () => `${cochable('Ambition de groupe à court terme accomplie', `+${PX_D_AMBITION.courte} PX à chaque héros`, GROUPE.courte)}${cochable('Ambition de groupe à long terme accomplie', `+${PX_D_AMBITION.longue} PX à chaque héros`, GROUPE.longue)}`;
/* ce que la séance vaut au héros */
const gainDuHeros = (id) => `<div class="gain"><b class="lin">+${pxDeLaSeance(id)} PX</b>${SEANCE[id].coches.motivation ? '<span class="rubrique">+1 Détermination</span>' : ''}</div>`;
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { PX_D_AMBITION, SEANCE, cochable, casesDuGroupe, gainDuHeros });
