import { nommerChamps } from '../grammaire/meta';
/** LDB 18 ; LDB 18 l.61/72 */
import { z } from 'zod';
import { formulaSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';

/** LDB 18 l.247/251/273/277/281 */
const cumulSchema = nommerChamps(z.strictObject({
  portee: z.enum(['localisation', 'porteur']),
  unite: formulaSchema.optional(),
  parPalier: nommerChamps(z.strictObject({ taille: z.number(), ops: z.array(gameOpSchema) }), { taille: { label: 'Taille' }, ops: { label: 'Opérations' } }).optional(),
  escalade: nommerChamps(z
    .strictObject({ atLeast: z.number(), versTraumaId: z.string(), mode: z.enum(['remplace', 'ajoute']) }), {
    atLeast: { label: 'Minimum' },
    versTraumaId: { label: 'Traumatisme associé' },
    mode: { label: 'Mode' },
  })
    .optional(),
}), {
  portee: { label: 'Portée' },
  unite: { label: 'Unité' },
  parPalier: { label: 'Par palier' },
  escalade: { label: 'Escalade' },
});

/** LDB 18 ; LDB 73 */
const rigSchema = nommerChamps(z.strictObject({
  bone: z.string(),
  lateral: z.boolean().optional(),
  art: z.string().optional(),
  byProsthesis: z.array(nommerChamps(z.strictObject({ trappingId: z.string(), art: z.string() }), { trappingId: { label: 'Objet' }, art: { label: 'Apparence' } })).optional(),
  hidesBone: z.string().optional(),
  view: z.literal('front').optional(),
  replace: z.boolean().optional(),
}), {
  bone: { label: 'Os' },
  lateral: { label: 'Latéral' },
  art: { label: 'Apparence' },
  byProsthesis: { label: 'Par prothèse' },
  hidesBone: { label: 'Os masqué' },
  view: { label: 'Vue' },
  replace: { label: 'Remplacement' },
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
        nommerChamps(z.strictObject({
          trappingId: z.string(),
          cancels: z.enum(['all', 'movement']),
        }), { trappingId: { label: 'Objet' }, cancels: { label: 'Annulations' } }),
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
