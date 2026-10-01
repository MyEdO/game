/**
 * Chaque compteur de version persisté, dérivé de sa table (`versionCourante`, #2226), garde son type
 * LITTÉRAL : une valeur d'une autre version ne compile pas.
 */
import { describe, expectTypeOf, it } from 'vitest';
import { SAVE_VERSION } from './saves';
import { EXPORT_VERSION } from './roster';
import { SCHEMA_PROJET } from '../data/schemas/defs-scenes/projet';
import { FORMAT_DES_CHOIX } from '../engine/character';

type EstLitteral<T> = number extends T ? false : true;

describe('versions littérales (#2226)', () => {
  it('saves, export du roster, schéma de projet, format des choix', () => {
    expectTypeOf<EstLitteral<typeof SAVE_VERSION>>().toEqualTypeOf<true>();
    expectTypeOf<EstLitteral<typeof EXPORT_VERSION>>().toEqualTypeOf<true>();
    expectTypeOf<EstLitteral<typeof SCHEMA_PROJET>>().toEqualTypeOf<true>();
    expectTypeOf<EstLitteral<typeof FORMAT_DES_CHOIX>>().toEqualTypeOf<true>();
    // @ts-expect-error la version d'avant n'est pas la version courante
    const perimee: typeof SCHEMA_PROJET = SCHEMA_PROJET - 1;
    expectTypeOf(perimee).toEqualTypeOf<typeof SCHEMA_PROJET>();
  });
});
