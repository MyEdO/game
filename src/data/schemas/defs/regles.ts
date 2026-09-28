/**
 * Schéma de `regles.json` — catalogue des PROCÉDURES / OPTIONS de jeu (Sombre Pacte, modes
 * d'attaque/défense, Empoignade, Focalisation étendue…) dont la prose est ADRESSÉE au passage du
 * `Source/` (`descRef`, #1887). Consommé par le Codex (`registry.ts`, catégorie `regles`) et routé en
 * tooltip `CodexRef`.
 *
 * ZÉRO champ hors enveloppe : une règle EST son identité, sa prose et son folio — la prose (`desc` ou
 * `descRef`, `exiges: ['desc']`) et la `source` sont EXIGÉES (`options.exiges`).
 */
import { document } from '../grammaire/document';

export const file = 'regles.json';
export const famille = 'entite';

const doc = document(
  'regles',
  famille,
  {},
  {},
  {
    codex: { keys: ['regles'] },
    edit: { none: 'exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
