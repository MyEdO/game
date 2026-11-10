/** Espèce d'apparence par défaut. */
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';

export const file = 'speciesRace.json';
export const famille = 'config';

const doc = document(
  'speciesRace',
  famille,
  {
    default: ref('planDeBestiaire'),
  },
  {
    default: { label: 'Espèce d’apparence par défaut', hint: 'Espèce du plan de bestiaire retenue quand aucune espèce n’est donnée' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: "espèce d'apparence par défaut de l'authoring, pas une fiche de contenu.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
