/** #2968 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { foyerDeRegleSchema } from '../grammaire/valeurs';

export const file = 'voyage-stakes.json';
export const famille = 'entite';

const doc = document(
  'voyage-stakes',
  famille,
  {
    /** Gabarit du descripteur mécanique — trous `{nom}` remplis par le flux (valeurs calculées). */
    template: z.string(),
    /** #1117 */
    rule: foyerDeRegleSchema.optional(),
  },
  {
    template: {
      label: 'Gabarit du texte',
      // Les ACCOLADES restent hors du répertoire des libellés (garde `libelles-guard`) : ce sont des
      // signes de code, et les admettre laisserait passer une interpolation à l’écran. Le trou
      // nommé se DIT donc en français plutôt qu’il ne se montre.
      hint: 'Descripteur mécanique dont les trous nommés sont remplis par les valeurs calculées au moment de l’étape',
    },
    rule: {
      label: 'Règle associée',
      hint: 'Entité qui porte la règle derrière l’étape (Compétence/État/Talent, ou fiche de règles-cadre)',
    },
  },
  {
    codex: { keys: ['voyageStakes'] },
    edit: { none: 'exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier', dataset: 'voyageStakes' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
