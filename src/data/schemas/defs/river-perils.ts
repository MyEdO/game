import { nommerChamps } from '../grammaire/meta';
/** MSRC 7 l.119-166 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { sourceRefSchema } from '../grammaire/valeurs';
import { marquerCollection, marqueDeListe } from '../grammaire/collection-cle';

export const file = 'river-perils.json';
export const famille = 'config';

const doc = document(
  'river-perils',
  famille,
  {
  perils: marquerCollection(
    z.array(
      nommerChamps(z.strictObject({
        id: z.string(),
        label: z.string(),
        kind: z.enum(['navTest', 'obstacle', 'detect']),
        /** Débris (l.125) : Test de Navigation raté → `hullHits` coups à la coque. */
        onFail: nommerChamps(z.strictObject({ hullHits: z.number(), damagePerHit: z.number() }), { hullHits: { label: 'Coups à la coque' }, damagePerHit: { label: 'Dégâts par coup' } }).optional(),
        /** Barrage (l.128) : Endurance/Blessures d'expression dé (`1d10`…), bélier +`ramDamage`. */
        obstacle: nommerChamps(z
          .strictObject({ endurance: z.string(), enduranceMult: z.number(), wounds: z.string(), ramDamage: z.number() }), {
          endurance: { label: 'Endurance' },
          enduranceMult: { label: 'Multiplicateur d’Endurance' },
          wounds: { label: 'Blessures' },
          ramDamage: { label: 'Dégâts d’éperonnage' },
        })
          .optional(),
        /** MSRC 7 l.128 */
        clear: nommerChamps(z
          .strictObject({ objects: z.string(), encPerObject: z.string(), encPerHour: z.number() }), {
          objects: { label: 'Objets' },
          encPerObject: { label: 'Encombrement par objet' },
          encPerHour: { label: 'Encombrement par heure' },
        })
          .optional(),
        /** Rochers/eaux peu profondes (l.138-144) : Dégâts + chances de percée/échouage. */
        onHit: nommerChamps(z
          .strictObject({ hullDamage: z.number(), holeChancePct: z.number().optional(), echouageChancePct: z.number().optional() }), {
          hullDamage: { label: 'Dégâts de coque' },
          holeChancePct: { label: 'Risque de brèche (%)' },
          echouageChancePct: { label: 'Risque d’échouage (%)' },
        })
          .optional(),
        ref: z.string(),
        source: sourceRefSchema,
      }), {
        id: { label: 'Identifiant' },
        label: { label: 'Libellé' },
        kind: { label: 'Type' },
        onFail: { label: 'À l’échec' },
        obstacle: { label: 'Obstacle' },
        clear: { label: 'Dégagement' },
        onHit: { label: 'À l’impact' },
        ref: { label: 'Référence' },
        source: { label: 'Source' },
      }),
    ).superRefine((perils, ctx) => {
      // Un péril qui fait LANCER dit ce que l'échec coûte : sans `onFail`, l'enjeu du Test d'évitement
      // (`riverPerilNav`) n'aurait ni coups ni Dégâts à annoncer — le jet redeviendrait muet (#1117).
      for (const p of perils) {
        if (p.kind === 'navTest' && !p.onFail) {
          ctx.addIssue({ code: 'custom', message: `${p.id} : péril à Test d'évitement sans onFail — le jet ne pourrait pas dire son enjeu` });
        }
      }
    }),
    marqueDeListe<{ id: string }>('id'),
  ),
  },
  { perils: { label: 'Dangers fluviaux', hint: 'Catalogue des dangers (Débris/Barrage/Rochers/Eaux peu profondes)' } },
  {
    codex: { keys: ['riverPerils'] },
    edit: { niche: { categories: { riverPerils: 'perils' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
