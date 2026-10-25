/** #2968 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { entryCategorySchema, foyerDeRegleSchema, stakeFormSchema } from '../grammaire/valeurs';

export const file = 'night-stakes.json';
export const famille = 'entite';

const doc = document(
  'night-stakes',
  famille,
  {
    stake: z.string(),
    /** FORME du `stake`, DÉCLARÉE par la donnée (garde `night-stake-form.test.ts`, #1117 L0b) :
     *  - absente / `'verbatim'` : chaque bloc du `stake` est une sous-chaîne CONTIGUË d'une ligne du
     *    chapitre cité par `source.note` — recollable tel quel (règle stricte 5) ;
     *  - `'descripteur'` : descripteur MÉCANIQUE assemblé depuis ce que l'applier fait réellement
     *    (aucun fragment n'est réputé verbatim). Le verbatim intégral vit dans la fiche `rule`.
     *  La garde distingue les deux STRUCTURELLEMENT : un assemblage non déclaré échoue. */
    form: stakeFormSchema.optional(),
    /** FICHE derrière cette étape — la règle est à UN CLIC depuis l'enjeu (#1117). C'est
     *  l'entité qui PORTE déjà la règle (amendement A, 2026-08-06 : « tant qu'on évite de surcharger
     *  au maximum la table régle ») : une compétence, un État, un symptôme… `regles.json` n'est que
     *  le foyer des règles de CADRE, sans entité porteuse. */
    rule: foyerDeRegleSchema.optional(),
    entryCategory: entryCategorySchema,
  },
  {
    entryCategory: { label: 'Catégorie de l’entrée jouée' },
    stake: { label: 'Enjeu' },
    form: { label: 'Forme de l’enjeu' },
    rule: { label: 'Règle associée', hint: 'Entité qui porte la règle derrière l’étape' },
  },
  {
    codex: { keys: ['nightStakes'] },
    edit: { dataset: 'nightStakes' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
