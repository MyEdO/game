/**
 * Les options (#4411) : les préférences sur un volet de bois, les règles maison dans un registre relié, un domaine par
 * signet, le premier feuillet du domaine Combat ouvert à deux pages (`../../accueil-et-systeme.md`, section `options`).
 */
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'options',
    gabarit: 'gestion',
    titre: { nom: 'Options', sous: 'Préférences et règles maison' },
    son: [
      { nom: 'Couper le son', oui: false },
      { nom: 'Volume de la musique', pourcent: 70 },
      { nom: 'Volume des ambiances', pourcent: 80 },
      { nom: 'Volume des effets', pourcent: 100 },
      { nom: 'Volume de l’interface', pourcent: 55 },
    ],
    jeu: [
      { nom: 'Cadence de combat', valeurs: ['Manuel', 'Rapide', 'Auto'], tenue: 0, aide: 'Chaque jet d’un héros passe par sa modale.' },
      { nom: 'Dés fixés', oui: false, aide: 'Un champ pour saisir vous-même la valeur du d100, sur les jets que vous contrôlez.' },
    ],
    domaines: [
      ['Tests', 11], ['Destin & Résistance', 1], ['Combat', 22, 1], ['Social', 8], ['Création', 4], ['Marché', 5], ['Activités', 7], ['Avancement', 2],
      ['Magie', 4], ['Prières', 3], ['Corruption', 1], ['Psychologie', 1], ['Maladies', 2], ['Voyage', 32, 2], ['Possessions', 1],
    ].map(([nom, regles, modifiees = 0]) => ({ nom: nom as string, regles: regles as number, modifiees: modifiees as number })),
    ouvert: {
      domaine: 'Combat', feuillet: 1, feuillets: 2,
      gauche: [
        { nom: 'Plafond d’Avantage', ref: 'LDB 14 l.198', valeur: 10, min: 1, max: 20 },
        { nom: 'Plafond d’Avantage = Bonus d’Initiative', ref: 'LDB 14 l.197', oui: false },
        { nom: 'Plafond des bonus de Difficulté', ref: 'LDB 14 l.95', valeur: 60, min: 0, max: 100, signe: true },
        { nom: 'Plafond des malus de Difficulté', ref: 'LDB 14 l.95', valeur: -30, min: 0, max: -100, signe: true },
        { nom: 'Frappe Mortelle', ref: 'LDB 14 l.9', oui: true, modifiee: true },
        { nom: 'Sur la Défensive', ref: 'LDB 13 l.118', oui: true, aide: 'Action « Sur la Défensive » : +20 aux Tests de défense jusqu’au prochain tour. Désactiver retire cette Action.' },
      ],
      droite: [
        { nom: 'Déviation Critique', ref: 'LDB 63 l.30', oui: true },
        { nom: 'Blessures & Critiques (Aux Armes)', ref: 'AA 07 l.1-185', valeurs: ['Livre de base', 'Aux Armes'], tenue: 0 },
        { nom: 'Avantage de groupe (Aux Armes)', ref: 'AA 11 l.3-100', oui: false },
        { nom: 'Tir dans un corps à corps', ref: 'LDB 14 l.112-116', oui: true },
        { nom: 'Coup de corps à corps par une croisée : couvert de la cible', ref: 'LDB 14 l.86', maison: true, liste: 'Très Difficile' },
        { nom: 'Cible Inconsciente', ref: 'LDB 16 l.113', valeurs: ['Critique', 'Mort automatique'], tenue: 0 },
      ],
    },
  }],
} satisfies Ecran;
