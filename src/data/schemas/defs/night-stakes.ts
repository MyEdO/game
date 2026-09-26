/**
 * Schéma de `night-stakes.json` — enjeu VERBATIM (règle 5) d'un `kind` d'étape de la cascade de nuit
 * (#331), donnée app-owned (arbitrage doctrine 2026-07-12 : un catalogue en dur est l'exception, il
 * migre en donnée). Chargé en `NIGHT_STAKES` (`src/data/index.ts`), lu par `nightStakeRef`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { stakeFormSchema } from '../grammaire/valeurs';

export const file = 'night-stakes.json';
export const famille = 'entite';

const doc = document(
  'night-stakes',
  famille,
  {
    kind: z.string(),
    stake: z.string(),
    /** FORME du `stake`, DÉCLARÉE par la donnée (garde `night-stake-form.test.ts`, #1117 L0b) :
     *  - absente / `'verbatim'` : chaque bloc du `stake` est une sous-chaîne CONTIGUË d'une ligne du
     *    chapitre cité par `source.note` — recollable tel quel (règle stricte 5) ;
     *  - `'descripteur'` : descripteur MÉCANIQUE assemblé depuis ce que l'applier fait réellement
     *    (aucun fragment n'est réputé verbatim). Le verbatim intégral vit dans la fiche `rule`.
     *  La garde distingue les deux STRUCTURELLEMENT : un assemblage non déclaré échoue. */
    form: stakeFormSchema.optional(),
    /** FICHE derrière cette étape — la règle est à UN CLIC depuis l'enjeu (#1117). C'est l'id de
     *  l'entité qui PORTE déjà la règle (amendement A, 2026-08-06 : « tant qu'on évite de surcharger
     *  au maximum la table régle ») : une compétence, un État, un symptôme… `regles.json` n'est que
     *  le foyer des règles de CADRE, sans entité porteuse. */
    rule: z.string().optional(),
    /** CATÉGORIE Codex du foyer — `'regles'` par défaut. `'skills'` quand la règle vit sur la
     *  compétence, `'etats'` sur l'État, etc. Le renvoi est un couple {catégorie, id}. */
    ruleCategory: z.string().optional(),
  },
  {
    kind: {
      label: 'Étape de la cascade',
      hint: 'Vocabulaire d’étape de nuit consommé par `nightStakeRef` — distinct de l’identifiant',
    },
    stake: { label: 'Enjeu' },
    form: { label: 'Forme de l’enjeu' },
    rule: { label: 'Règle associée', hint: 'Identifiant de l’entité qui porte la règle derrière l’étape' },
    ruleCategory: {
      label: 'Catégorie de la règle',
      hint: 'Catégorie Codex de l’entité désignée par « Règle associée »',
    },
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
