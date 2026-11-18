/**
 * L'interlude en ville (#4411) : entre deux aventures, chaque héros envoie ses Activités dans un lieu de Bögenhafen ;
 * avant une bataille de masse, le camp de l'armée hors les murs offre celles de la préparation (LDB 22 l.5, LDB 23
 * l.5-15 ; ADE II 08 l.60-108) (`../../combat-suite.md`, section `bataille-de-masse-preparation`).
 */
import { groupe } from './compagnie.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'bataille-de-masse-preparation', gabarit: 'lieu-et-voyage', decor: 'ville',
    ville: { nom: 'Bögenhafen', sous: 'Entre deux aventures' },
    restantes: [
      { qui: 'bjorn', evenement: 'Profits abondants', activites: 1 }, { qui: 'mira', evenement: 'Rien à signaler', activites: 2 },
      { qui: 'aldric', evenement: 'Enchères ésotériques', activites: 1 }, { qui: 'greta', evenement: 'Festivités', activites: 2 }],
    avis: 'À la reprise, les bourses seront vides : seul l’argent déposé au comptoir est gardé.',
    lieux: [
      { id: 'camp', nom: 'Le camp de l’armée', quoi: 'Préparer la bataille', choisi: true, fantome: 'mira' },
      { id: 'taverne', nom: 'Taverne d’Altstadt', quoi: 'Dernières nouvelles' },
      { id: 'temple', nom: 'Temple de Verena', quoi: 'Recherche de savoir', heros: 'aldric' },
      { id: 'forge', nom: 'La forge', quoi: 'Passer commande' },
      { id: 'caserne', nom: 'Caserne du Guet', quoi: 'Entraînement au combat', heros: 'greta' },
      { id: 'comptoir', nom: 'Comptoir de change', quoi: 'Opérations bancaires' },
      { id: 'quais', nom: 'Les quais', quoi: 'Revenus', heros: 'bjorn' },
      { id: 'armes', nom: 'Le maître d’armes', quoi: 'Entraînement' }],
    lieu: {
      quartier: 'Hors les murs', nom: 'Le camp de l’armée', forces: { allies: 50, ennemis: 55 },
      activites: [
        { id: 'carte', nom: 'Planification', test: 'Savoir (Guerre) · une Activité · Soutien', enjeu: 'Réussite : +10 à tous les Tests de Puissance de ton armée pendant la bataille, +20 à partir de +6 DR.' },
        { id: 'bulle', nom: 'Discours inspirant', test: 'Commandement · une Activité' },
        { id: 'oeil', nom: 'Repérage', test: 'Chevaucher et Perception · une Activité' },
        { id: 'reseau', nom: 'Rassembler des forces', test: 'Commandement, Charme ou Intimidation' },
        { id: 'cle', nom: 'Infiltration', refus: 'Exige une Planification réussie au préalable.' },
        { id: 'feu', nom: 'Sabotage', refus: 'Exige un Repérage réussi au préalable.', survol: true }],
      envoi: 'Envoyer Mira au camp',
    },
    retour: 'Livrer bataille',
    groupe: groupe({
      bjorn: { id: 'quais', texte: 'décharge les barges sur les quais' }, mira: { attend: 'À envoyer au camp' },
      aldric: { id: 'temple', texte: 'fouille les registres du temple' }, greta: { id: 'caserne', texte: 's’exerce avec les hommes du Guet' } }, 'mira'),
  }],
} satisfies Ecran;
