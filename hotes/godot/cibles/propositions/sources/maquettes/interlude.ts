/**
 * L'interlude en ville (#4411) : entre deux aventures, chaque héros envoie ses Activités dans un lieu de Bögenhafen ;
 * avant une bataille de masse, le camp de l'armée hors les murs offre celles de la préparation (LDB 22 l.5, LDB 23
 * l.5-15, l.132-240 ; ADE II 08 l.60-108) (`../../lieux-et-nuit.md`, section `interlude`, et `../../combat-suite.md`,
 * section `bataille-de-masse-preparation`).
 */
import { groupe } from './compagnie.ts';
import type { Ecran, LieuDeLaVille } from './maquette.ts';

const VILLE = { nom: 'Bögenhafen', sous: 'Entre deux aventures' };
const RESTANTES = [
  { qui: 'bjorn', evenement: 'Profits abondants', activites: 1 }, { qui: 'mira', evenement: 'Rien à signaler', activites: 2 },
  { qui: 'aldric', evenement: 'Enchères ésotériques', activites: 1 }, { qui: 'greta', evenement: 'Festivités', activites: 2 }];
const AVIS = 'À la reprise, les bourses seront vides : seul l’argent déposé au comptoir est gardé.';
/** Les lieux de la ville, la taverne `taverne` (choisie ou non). */
const lieuxDeLaVille = (taverne: Partial<LieuDeLaVille>): LieuDeLaVille[] => [
  { id: 'taverne', nom: 'Taverne d’Altstadt', quoi: 'Dernières nouvelles', ...taverne },
  { id: 'temple', nom: 'Temple de Verena', quoi: 'Recherche de savoir', heros: 'aldric' },
  { id: 'forge', nom: 'La forge', quoi: 'Passer commande' },
  { id: 'caserne', nom: 'Caserne du Guet', quoi: 'Entraînement au combat', heros: 'greta' },
  { id: 'comptoir', nom: 'Comptoir de change', quoi: 'Opérations bancaires' },
  { id: 'quais', nom: 'Les quais', quoi: 'Revenus', heros: 'bjorn' },
  { id: 'armes', nom: 'Le maître d’armes', quoi: 'Entraînement' }];
const DITS = { bjorn: { id: 'quais', texte: 'décharge les barges sur les quais' }, aldric: { id: 'temple', texte: 'fouille les registres du temple' }, greta: { id: 'caserne', texte: 's’exerce avec les hommes du Guet' } };

export default {
  etats: [{
    nom: 'interlude-en-ville', gabarit: 'lieu-et-voyage', decor: 'ville',
    ville: VILLE, restantes: RESTANTES, avis: AVIS,
    lieux: lieuxDeLaVille({ choisi: true, fantome: 'mira' }),
    lieu: {
      quartier: 'Altstadt', nom: 'Taverne d’Altstadt',
      hote: { buste: 'hote', nom: 'Le tenancier', dit: 'Les bateliers parlent, pour peu qu’on paie la tournée.' },
      activites: [
        { id: 'bulle', nom: 'Dernières nouvelles', test: 'Ragot · une Activité', enjeu: 'Une rumeur venue de loin, et une de plus par degré de réussite.', prise: true },
        { id: 'goutte', nom: 'Semer la dissension', test: 'Ragot, puis Charme · deux Activités', enjeu: 'Monter le quartier contre un homme, une guilde ou le Guet.' }],
      envoi: 'Envoyer Mira à la taverne',
    },
    retour: 'Reprendre la route',
    groupe: groupe({ ...DITS, mira: { attend: 'À envoyer en ville' } }, 'mira'),
  }, {
    nom: 'bataille-de-masse-preparation', gabarit: 'lieu-et-voyage', decor: 'ville',
    ville: VILLE, restantes: RESTANTES, avis: AVIS,
    lieux: [{ id: 'camp', nom: 'Le camp de l’armée', quoi: 'Préparer la bataille', choisi: true, fantome: 'mira' }, ...lieuxDeLaVille({})],
    lieu: {
      quartier: 'Hors les murs', nom: 'Le camp de l’armée', forces: { allies: 50, ennemis: 55 },
      activites: [
        { id: 'carte', nom: 'Planification', test: 'Savoir (Guerre) · une Activité · Soutien', enjeu: 'Réussite : +10 à tous les Tests de Puissance de ton armée pendant la bataille, +20 à partir de +6 DR.', prise: true },
        { id: 'bulle', nom: 'Discours inspirant', test: 'Commandement · une Activité' },
        { id: 'oeil', nom: 'Repérage', test: 'Chevaucher et Perception · une Activité' },
        { id: 'reseau', nom: 'Rassembler des forces', test: 'Commandement, Charme ou Intimidation' },
        { id: 'cle', nom: 'Infiltration', refus: 'Exige une Planification réussie au préalable.' },
        { id: 'feu', nom: 'Sabotage', refus: 'Exige un Repérage réussi au préalable.', survol: true }],
      envoi: 'Envoyer Mira au camp',
    },
    retour: 'Livrer bataille',
    groupe: groupe({ ...DITS, mira: { attend: 'À envoyer au camp' } }, 'mira'),
  }],
} satisfies Ecran;
