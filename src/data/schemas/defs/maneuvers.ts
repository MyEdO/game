import { nommerChamps } from '../grammaire/meta';
/** LDB 85. */
import { z } from 'zod';
import { charKeySchema, enumNomme, stakeFormSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'maneuvers.json';
export const famille = 'entite';

/** `ManeuverMeasure` (`src/data/index.ts`) — Portée/Souffle en mètres = `bonus(ref) + plus`. */
const maneuverMeasure = nommerChamps(z.strictObject({
  bonusOf: charKeySchema.optional(),
  plus: z.number().optional(),
}), { bonusOf: { label: 'bonus de caractéristique' }, plus: { label: 'ajout' } });

/**
 * FAMILLE d'attaque d'une manœuvre (`AttackKind`, `src/engine/creatureAttacks.ts`) — le libellé est
 * celui de la FAMILLE, jamais l'affichage d'une manœuvre PRÉCISE (`ManeuverDef.label`, ex. « Souffle
 * (Feu) ») : plusieurs `ManeuverDef` partagent un `kind` (6 souffles, 2 étreintes, 4 hurlements).
 */
export const attackKindSchema = enumNomme({
  arme: 'Arme / griffes',
  morsure: 'Morsure',
  caudale: 'Attaque caudale',
  cornes: 'Cornes',
  souffle: 'Souffle',
  vomi: 'Vomissement',
  tentacules: 'Tentacules',
  etreinte: 'Étreinte',
  regard: 'Regard pétrifiant',
  langue: 'Langue préhensile',
  hurlement: 'Hurlement',
});

const doc = document(
  'maneuvers',
  famille,
  {
    kind: attackKindSchema,
    activation: enumNomme({ action: 'Action', free: 'Gratuite (coût d’Avantage)', charge: 'À la Charge' }),
    advantageCost: z.number(),
    advantageMode: enumNomme({ fixed: 'Coût fixe', variable: 'Au choix (+1 DR/Av)', all: 'Tout l’Avantage' }).optional(),
    stat: enumNomme({ 'capacite-de-combat': 'CC (mêlée)', 'capacite-de-tir': 'CT (distance)' }).optional(),
    defense: enumNomme({ esquive: 'Esquive', parade: 'Parade', init: 'Initiative', resist: 'Résistance (cible)', auto: 'Meilleure (auto)' }).optional(),
    targeting: enumNomme({ melee: 'Mêlée', ranged: 'Distance', zone: 'Zone', allFoes: 'Tous les ennemis', allAround: 'Tout le monde alentour', self: 'Sur soi' }),
    range: maneuverMeasure.optional(),
    blast: maneuverMeasure.optional(),
    magic: z.boolean().optional(),
    effects: z.array(triggeredEffectSchema),
    /** ENJEU de l'ENTRÉE (#1117) — ce que la manœuvre met en jeu, COLLÉ à ses `effects` (éditable au
     *  Codex). Rendu par `resolveStake` et PRIORITAIRE sur le gabarit du kind `maneuverDefense`. */
    stake: z.string().optional(),
    stakeForm: stakeFormSchema.optional(),
  },
  {
    kind: { label: 'Type d’attaque (rendu)', hint: 'Anime et illustre la manœuvre — n’entre pas dans la résolution' },
    activation: { label: 'Activation', hint: 'Action / gratuite / charge' },
    advantageCost: { label: 'Coût en Avantage' },
    advantageMode: { label: 'Mode de coût', hint: 'Fixe / variable / tout l’Avantage' },
    stat: { label: 'Caractéristique de test' },
    defense: { label: 'Défense opposée' },
    targeting: { label: 'Ciblage' },
    range: { label: 'Portée' },
    blast: { label: 'Zone d’effet' },
    magic: { label: 'Magique' },
    effects: { label: 'Effets déclenchés' },
    stake: { label: 'Enjeu', hint: 'Ce que la manœuvre met en jeu, collé à ses effets déclenchés' },
    stakeForm: { label: 'Forme de l’enjeu' },
  },
  {
    codex: { keys: ['maneuvers'] },
    edit: { dataset: 'maneuvers' },
  },
  {
    exiges: ['source'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { id: string; desc?: string };
        if (e.desc !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['desc'],
            message: `${e.id} : une manœuvre ne porte AUCUNE prose (#1226) — le verbatim vit sur le Trait qui la projette`,
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
