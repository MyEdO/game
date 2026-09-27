/**
 * Schéma de `river-perils.json` — Dangers fluviaux (MSRC 7 l.119-166 : Débris/Barrage/Rochers/Eaux
 * peu profondes). Dérivé de `RiverPerilDef` (`src/engine/riverNavigation.ts`), seul
 * consommateur. La racine est NUE : chaque péril porte son `source`
 * (`src/data/source-racine-aveugle.test.ts`).
 */
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
      z.strictObject({
        id: z.string(),
        label: z.string(),
        kind: z.enum(['navTest', 'obstacle', 'detect']),
        /** Débris (l.125) : Test de Navigation raté → `hullHits` coups à la coque. */
        onFail: z.strictObject({ hullHits: z.number(), damagePerHit: z.number() }).optional(),
        /** Barrage (l.128) : Endurance/Blessures d'expression dé (`1d10`…), bélier +`ramDamage`. */
        obstacle: z
          .strictObject({ endurance: z.string(), enduranceMult: z.number(), wounds: z.string(), ramDamage: z.number() })
          .optional(),
        /** Déblayage à la main (MSRC 7 l.128 : `objects` = 3d10 éléments de `encPerObject` = 4d10 Enc) ;
         *  `encPerHour` = débit de halage, valeur maison éditable (MSRC 7 l.128, règle stricte 7). */
        clear: z
          .strictObject({ objects: z.string(), encPerObject: z.string(), encPerHour: z.number() })
          .optional(),
        /** Rochers/eaux peu profondes (l.138-144) : Dégâts + chances de percée/échouage. */
        onHit: z
          .strictObject({ hullDamage: z.number(), holeChancePct: z.number().optional(), echouageChancePct: z.number().optional() })
          .optional(),
        ref: z.string(),
        source: sourceRefSchema,
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
    edit: { niche: { categories: ['riverPerils'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
