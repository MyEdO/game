/**
 * Les options (#4411) : les préférences sur un volet de bois, les règles maison dans un registre relié, un domaine par
 * signet, le premier feuillet du domaine ouvert à deux pages (`../../accueil-et-systeme.md`, section `options`). États :
 * `options`, le domaine Combat ; `chance`, le domaine Destin & Résistance et l'action de sa règle
 * (`src/data/reglesOptionnelles.json:128-147`) ; `verrou`, les règles maison fermées pendant un combat, la raison au
 * survol de la règle pointée (`src/hote/reglages.ts:81-82`).
 */
import type { Domaine, Ecran, Options, RegleMaison } from './maquette.ts';

const TITRE = { nom: 'Options', sous: 'Préférences et règles maison' };
const SON: Options['son'] = [
  { nom: 'Couper le son', oui: false },
  { nom: 'Volume de la musique', pourcent: 70 },
  { nom: 'Volume des ambiances', pourcent: 80 },
  { nom: 'Volume des effets', pourcent: 100 },
  { nom: 'Volume de l’interface', pourcent: 55 },
];
const JEU: Options['jeu'] = [
  { nom: 'Cadence de combat', valeurs: ['Manuel', 'Rapide', 'Auto'], tenue: 0, aide: 'Chaque jet d’un héros passe par sa modale.' },
  { nom: 'Dés fixés', oui: false, aide: 'Un champ pour saisir vous-même la valeur du d100, sur les jets que vous contrôlez.' },
];
/** Les domaines des règles maison, leur compte de règles ; `chance`, la règle de la Chance est modifiée. */
const domaines = (chance = false): Domaine[] => ([
  ['Tests', 11], ['Destin & Résistance', 1, chance ? 1 : 0], ['Combat', 22, 1], ['Social', 8], ['Création', 4], ['Marché', 5], ['Activités', 7], ['Avancement', 2],
  ['Magie', 4], ['Prières', 3], ['Corruption', 1], ['Psychologie', 1], ['Maladies', 2], ['Voyage', 32, 2], ['Possessions', 1],
] as const).map(([nom, regles, modifiees = 0]) => ({ nom, regles, modifiees }));
const COMBAT: { gauche: RegleMaison[]; droite: RegleMaison[] } = {
  gauche: [
    { nom: 'Plafond d’Avantage', valeur: 10, min: 1, max: 20 },
    { nom: 'Plafond d’Avantage = Bonus d’Initiative', oui: false },
    { nom: 'Plafond des bonus de Difficulté', valeur: 60, min: 0, max: 100, signe: true },
    { nom: 'Plafond des malus de Difficulté', valeur: -30, min: 0, max: -100, signe: true },
    { nom: 'Frappe Mortelle', oui: true, modifiee: true },
    { nom: 'Sur la Défensive', oui: true, aide: 'Action « Sur la Défensive » : +20 aux Tests de défense jusqu’au prochain tour. Désactiver retire cette Action.' },
  ],
  droite: [
    { nom: 'Déviation Critique', oui: true },
    { nom: 'Blessures & Critiques (Aux Armes)', valeurs: ['Livre de base', 'Aux Armes'], tenue: 0 },
    { nom: 'Avantage de groupe (Aux Armes)', oui: false },
    { nom: 'Tir dans un corps à corps', oui: true },
    { nom: 'Coup de corps à corps par une croisée : couvert de la cible', maison: true, liste: 'Très Difficile' },
    { nom: 'Cible Inconsciente', valeurs: ['Critique', 'Mort automatique'], tenue: 0 },
  ],
};
const OPTIONS = { gabarit: 'gestion', decor: 'table', titre: TITRE, son: SON, jeu: JEU } as const;

export default {
  etats: [{
    ...OPTIONS, nom: 'options', domaines: domaines(),
    ouvert: { domaine: 'Combat', feuillet: 1, feuillets: 2, ...COMBAT },
  }, {
    ...OPTIONS, nom: 'chance', domaines: domaines(true),
    ouvert: {
      domaine: 'Destin & Résistance', feuillet: 1, feuillets: 1, droite: [],
      gauche: [{
        nom: 'Chance regagnée en cours de session', valeurs: ['Non', 'Manuelle', 'Auto'], tenue: 1, modifiee: true, action: 'Regagner la Chance maintenant',
        aide: 'Longues Séances de Jeu : regagner des Points de Chance en cours de session, environ une fois par heure. Non : seulement en début de session ; Manuelle : le bouton « Regagner la Chance maintenant », à la demande ; Auto : un rappel seulement, le jeu ne mesure pas le temps passé, regagnez-la à la main.',
      }],
    },
  }, {
    ...OPTIONS, nom: 'verrou', domaines: domaines(),
    ouvert: { domaine: 'Combat', feuillet: 1, feuillets: 2, ...COMBAT },
    verrou: 'Règles verrouillées : un combat est en cours. Les changer maintenant réécrirait un combat déjà commencé (réserves d’Avantage, Initiative, Blessures). Terminez le combat pour les modifier.',
  }],
} satisfies Ecran;
