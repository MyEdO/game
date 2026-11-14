/**
 * Schéma de `oups.json` — Maladresses, folio 160 : les 7 bandes du Tableau des Oups !
 * (`LDB 14 l.21-30`) et l'Incident de Tir (`LDB 14 l.32-34`), section DISTINCTE du livre, hors de la
 * table. Ces deux sections du livre partagent ICI un seul document ; le découpage côté produit est la
 * question #1544.
 *
 * Document mono-table (`config` + `rangee` + `deDeTirage`) : son dé `die` est celui des bandes.
 * UNE SEULE FORME DE LIGNE, la disjonction portée par la charge par `kind` de l'espace de ses
 * rangées (`espace.chargeParDiscriminant`, bornée au parse de chaque rangée par la fabrique) : `min`/`max`/`mod` sont déclarés optionnels, et la charge les exige
 * dans les deux sens — un `misfire` ne porte rien, une bande ses DEUX bornes, le Malus d'Action en plus
 * son `mod`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { nommerChamps } from '../grammaire/meta';
import { enumNomme, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'oups.json';
export const famille = 'config';

/** Effets mécaniques que le moteur sait jouer (`OupsKind` + `misfire`, `src/engine/oups.ts`), NOMMÉS :
 *  les options de l'enum SONT les clés de cette table (#1694). */
const KINDS = {
  selfWound: 'Auto-blessure',
  weaponDamageActLast: 'Arme abîmée + agit en dernier',
  actionPenalty: 'Malus d’Action',
  loseMovement: 'Perte de Mouvement',
  loseAction: 'Perte d’Action',
  trauma: 'Traumatisme',
  hitAlly: 'Touche un allié',
  misfire: 'Incident de Tir',
} as const;

/** CHARGE par `kind`, toute exigée : la bande porte ses bornes, le Malus d'Action son modificateur,
 *  l'Incident de Tir rien (LDB 14 l.21-34). */
const chargeParDiscriminant = {
  selfWound: ['min', 'max'],
  weaponDamageActLast: ['min', 'max'],
  actionPenalty: ['min', 'max', 'mod'],
  loseMovement: ['min', 'max'],
  loseAction: ['min', 'max'],
  trauma: ['min', 'max'],
  hitAlly: ['min', 'max'],
  misfire: [],
} as const satisfies Record<keyof typeof KINDS, readonly string[]>;

/** Une ligne : une bande du dé de la table, ou l'Incident de Tir, hors table. */
export const rangee = nommerChamps(z.strictObject({
  id: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  kind: enumNomme(KINDS),
  label: z.string(),
  mod: z.number().optional(),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  min: { label: 'Borne basse du dé' },
  max: { label: 'Borne haute du dé' },
  kind: {
    label: 'Effet mécanique',
    hint: 'misfire = Incident de Tir, HORS table (LDB 14 folio 160)',
  },
  label: { label: 'libellé' },
  mod: { label: 'Modificateur de l’Action suivante', hint: 'Malus d’Action seulement' },
  source: { label: 'source' },
});

const doc = document(
  'oups',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { oups: 'entries' } } },
  },
  // LDB 14 l.23-30
  { rangee, deDeTirage: true, espace: { discriminant: 'kind', chargeParDiscriminant } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
