/**
 * Schéma de `traumas.json` — Traumatismes (LDB 18). Dérivé du contenu RÉEL (23 fiches) et de son
 * consommateur typé `TraumaFiche` (`src/engine/trauma.ts`). `ops` = `GameOp[]` (vocab partagé) ;
 * `cosmetic`/`passiveKind` : cicatrices post-guérison (LDB 18 l.61/72, #192) — `maison` est une clé
 * d'ENVELOPPE, posée par la fabrique.
 */
import { z } from 'zod';
import { formulaSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';

/** Règle de COMPTAGE/AGRÉGATION d'une séquelle cumulative (`TraumaCumul`, `src/engine/trauma.ts`) —
 *  LDB 18 l.247/251/273/277/281. */
const cumulSchema = z.strictObject({
  portee: z.enum(['localisation', 'porteur']),
  unite: formulaSchema.optional(),
  parPalier: z.strictObject({ taille: z.number(), ops: z.array(gameOpSchema) }).optional(),
  escalade: z
    .strictObject({ atLeast: z.number(), versTraumaId: z.string(), mode: z.enum(['remplace', 'ajoute']) })
    .optional(),
});

/** Routage d'APPARENCE de la séquelle sur le rig (`TraumaRig`, `src/engine/trauma.ts`) — LDB 18 / LDB 73. */
const rigSchema = z.strictObject({
  bone: z.string(),
  lateral: z.boolean().optional(),
  art: z.string().optional(),
  byProsthesis: z.array(z.strictObject({ trappingId: z.string(), art: z.string() })).optional(),
  hidesBone: z.string().optional(),
  view: z.literal('front').optional(),
  replace: z.boolean().optional(),
});

export const file = 'traumas.json';
export const famille = 'entite';

const doc = document(
  'traumas',
  famille,
  {
    ops: z.array(gameOpSchema).optional(),
    kind: z.enum(['dechirure', 'fracture']).optional(),
    severity: z.enum(['mineur', 'majeur']).optional(),
    prosthesis: z
      .array(
        z.strictObject({
          trappingId: z.string(),
          cancels: z.enum(['all', 'movement']),
        }),
      )
      .optional(),
    cumul: cumulSchema.optional(),
    rig: rigSchema.optional(),
    needsSurgery: z.boolean().optional(),
    cosmetic: z.boolean().optional(),
    amputation: z.boolean().optional(),
    passiveKind: z
      .enum(['douleur', 'mobilite', 'structurel', 'sensoriel', 'maladie', 'faim', 'magique', 'etat', 'ivresse', 'intrinseque'])
      .optional(),
  },
  {
    ops: { label: 'Effets passifs' },
    kind: { label: 'Type de séquelle', hint: 'Déchirure ou fracture' },
    severity: { label: 'Sévérité', hint: 'Mineure ou majeure' },
    prosthesis: { label: 'Prothèses compatibles', hint: 'Prothèses pouvant annuler tout ou partie de la séquelle' },
    cumul: { label: 'Règle de cumul', hint: 'Comptage/agrégation d’une séquelle qui s’accumule' },
    rig: { label: 'Routage d’apparence', hint: 'Endroit de l’apparence où la séquelle s’affiche' },
    needsSurgery: { label: 'Nécessite une opération' },
    cosmetic: { label: 'Cicatrice cosmétique', hint: 'Séquelle post-guérison sans effet mécanique' },
    amputation: { label: 'Est une amputation' },
    passiveKind: {
      label: 'Catégorie de passif',
      hint: 'Nature du passif porté par la séquelle (douleur, mobilité, structurel…)',
    },
  },
  {
    codex: { keys: ['traumas'] },
    edit: { dataset: 'traumas' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
