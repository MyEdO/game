import { nommerChamps } from '../grammaire/meta';
/** LDB 05 l.705-728 ; NADJ 15 l.80, l.112 ; ADE II 02 l.278, l.315. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { diceSpecSchema, raceKeySchema } from '../grammaire/valeurs';

export const file = 'details.json';
export const famille = 'config';

const detailTextSchema = nommerChamps(z.strictObject({
  all: z.string(),
  /** Surcharges PAR ESPÈCE, colonne `raceKeySchema` (id stable, #313) — partiel : un texte d'aide
   *  ne couvre que les races qu'il nomme (7 pour les noms, 6 pour l'âge, 2 pour la taille, 0 pour
   *  les Ambitions). */
  bySpecies: z.partialRecord(raceKeySchema, z.string()),
}), { all: { label: 'toutes les espèces' }, bySpecies: { label: 'par espèce' } });

const doc = document(
  'details',
  famille,
  {
    /** Jets d'Âge et de Taille, un `DiceSpec` par colonne `raceKeySchema` (id stable, #313). */
    age: z.record(raceKeySchema, diceSpecSchema),
    taille: z.record(raceKeySchema, diceSpecSchema),
    texts: nommerChamps(z.strictObject({
      nom: detailTextSchema,
      age: detailTextSchema,
      taille: detailTextSchema,
      ambitionShort: detailTextSchema,
      ambitionLong: detailTextSchema,
    }), {
      nom: { label: 'nom' },
      age: { label: 'âge' },
      taille: { label: 'taille' },
      ambitionShort: { label: 'ambition à court terme' },
      ambitionLong: { label: 'ambition à long terme' },
    }),
  },
  {
    age: { label: 'Jet d’Âge', hint: 'Dés de l’Âge de départ, par colonne d’espèce' },
    taille: { label: 'Jet de Taille', hint: 'Dés de la Taille de départ en cm, par colonne d’espèce' },
    texts: { label: 'Textes d’aide', hint: 'Aides affichées à la création : Nom, Âge, Taille, Ambitions' },
  },
  { codex: { keys: ['details'] }, edit: { object: 'unique' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
