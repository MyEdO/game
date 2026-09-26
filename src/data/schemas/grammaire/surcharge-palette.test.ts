/**
 * PORTES d'une surcharge de palette persistée (#1903) : chaque source de `colors`/`skin` que lit
 * `buildTokenMap`/`tableDObjet` passe par `surchargePaletteSchema` (clés dans `SLOTS`, valeurs
 * `#rrggbb`). Une clé de rôle (`…O`/`…H`) ou une couleur hors format est refusée à chaque porte.
 */
import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import raceAppearanceJson from '../../raceAppearance.json';
import { gameOpSchema } from './mecanique';
import { entityAppearanceSchema } from './valeurs';
import { giveTrappingSchema } from '../defs-scenes/effets';
import { schema as raceAppearanceSchema } from '../defs/raceAppearance';

const BASE = { metal: '#8fd4ff' };
const ROLE = { metal: '#8fd4ff', metalH: '#e6f7ff' };
const HORS_FORMAT = { metal: 'bleu' };

/** Porte → document complet portant la surcharge `s`. */
const PORTES: [string, z.ZodType<unknown>, (s: Record<string, string>) => unknown][] = [
  ['apparence d’entité `colors`', entityAppearanceSchema, (s) => ({ colors: s })],
  ['espèce `raceAppearance.colors`', raceAppearanceSchema, (s) => [{ ...raceAppearanceJson[0], colors: s }]],
  ['effet de scène `giveTrapping.skin`', giveTrappingSchema, (s) => ({ type: 'giveTrapping', trappingId: 'epee', skin: s })],
  ['op `grantWeapon.skin`', gameOpSchema, (s) => ({ op: 'grantWeapon', label: 'Arme aethyrique', damage: 6, skin: s })],
];

describe('surcharge de palette persistée : clés dans SLOTS, valeurs #rrggbb (#1903)', () => {
  for (const [nom, schema, doc] of PORTES) {
    it(`${nom} : une base #rrggbb passe`, () => expect(schema.safeParse(doc(BASE)).success).toBe(true));
    it(`${nom} : une clé de rôle est refusée`, () => expect(schema.safeParse(doc(ROLE)).success).toBe(false));
    it(`${nom} : une couleur hors format est refusée`, () => expect(schema.safeParse(doc(HORS_FORMAT)).success).toBe(false));
  }

  it('op `giveTrapping` : son payload ne porte pas de `skin`', () => {
    expect(gameOpSchema.safeParse({ op: 'giveTrapping', trappingId: 'ration' }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'giveTrapping', trappingId: 'ration', skin: BASE }).success).toBe(false);
  });
});
