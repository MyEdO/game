import { nommerChamps } from '../grammaire/meta';
/** LDB 85. */
import { z } from 'zod';
import { attackKindSchema, charKeySchema, enumNomme, stakeFormSchema, weaponDamageSpecSchema } from '../grammaire/valeurs';
import { ref } from '../grammaire/ref';
import { document } from '../grammaire/document';
import { triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'maneuvers.json';
export const famille = 'entite';

/** Portée/Souffle en mètres (`ManeuverMeasure` en dérive, `src/data/index.ts`) = `bonus(ref) + plus`. */
const maneuverMeasure = nommerChamps(z.strictObject({
  bonusOf: charKeySchema.optional(),
  plus: z.number().optional(),
}), { bonusOf: { label: 'bonus de caractéristique' }, plus: { label: 'ajout' } });


const doc = document(
  'maneuvers',
  famille,
  {
    kind: attackKindSchema,
    activation: enumNomme({ action: 'Action', free: 'Gratuite (coût d’Avantage)', charge: 'À la Charge' }),
    coutEnAvantage: z.number(),
    modeDAvantage: enumNomme({ fixe: 'Coût fixe', variable: 'Au choix (+1 DR/Av)', tout: 'Tout l’Avantage' }).optional(),
    stat: enumNomme({ 'capacite-de-combat': 'CC (mêlée)', 'capacite-de-tir': 'CT (distance)' }).optional(),
    defense: enumNomme({ esquive: 'Esquive', parade: 'Parade', init: 'Initiative', resist: 'Résistance (cible)', auto: 'Meilleure (auto)' }).optional(),
    ciblage: enumNomme({ melee: 'Mêlée', distance: 'Distance', zone: 'Zone', adversairesAutour: 'Tous les ennemis', toutAutour: 'Tout le monde alentour', soi: 'Sur soi' }),
    range: maneuverMeasure.optional(),
    blast: maneuverMeasure.optional(),
    magic: z.boolean().optional(),
    /** LDB 85 l.329 */
    fumee: z.boolean().optional(),
    /** LDB 85 l.387 */
    ecartDeTailleMin: z.number().int().min(1).optional(),
    subType: ref('weaponGroup').optional(),
    damage: weaponDamageSpecSchema.optional(),
    effects: z.array(triggeredEffectSchema),
    /** ENJEU de l'ENTRÉE (#1117) — ce que la manœuvre met en jeu, COLLÉ à ses `effects` (éditable au
     *  Codex). Rendu par `resolveStake` et PRIORITAIRE sur le gabarit de l’enjeu `combat-manoeuvre-defense`. */
    stake: z.string().optional(),
    stakeForm: stakeFormSchema.optional(),
    rendu: ref('rendu').optional(),
  },
  {
    kind: { label: 'Type d’attaque (rendu)', hint: 'Anime et illustre la manœuvre — n’entre pas dans la résolution' },
    activation: { label: 'Activation', hint: 'Action / gratuite / charge' },
    coutEnAvantage: { label: 'Coût en Avantage' },
    modeDAvantage: { label: 'Mode de coût', hint: 'Fixe / variable / tout l’Avantage' },
    stat: { label: 'Caractéristique de test' },
    defense: { label: 'Défense opposée' },
    ciblage: { label: 'Ciblage' },
    range: { label: 'Portée' },
    blast: { label: 'Zone d’effet' },
    magic: { label: 'Magique' },
    fumee: { label: 'Fumée', hint: 'La zone se remplit de fumée qui bloque les Lignes de vue pendant Bonus d’Endurance Rounds' },
    ecartDeTailleMin: { label: 'Écart de Taille minimal', hint: 'Ouverte à tout combattant plus grand que sa cible d’au moins ce nombre de catégories de Taille' },
    subType: { label: 'Groupe d’armes', hint: 'Spécialisation de Corps à corps du jet d’attaque' },
    damage: { label: 'Dégâts', hint: 'Dégâts de l’attaque, à défaut l’Indice du trait qui l’octroie' },
    effects: { label: 'Effets déclenchés' },
    stake: { label: 'Enjeu', hint: 'Ce que la manœuvre met en jeu, collé à ses effets déclenchés' },
    rendu: { label: 'Rendu', hint: 'Rendu visuel et sonore d’une manœuvre de zone (`rendus.json`) ; celui d’un Souffle est celui de son Type' },
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
