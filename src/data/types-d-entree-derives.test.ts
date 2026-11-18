/**
 * Le lecteur d'un dataset lit le type DÉRIVÉ de son schéma, jamais un type écrit à la main : renommer un champ
 * du schéma rougit ses lecteurs (#4056). La preuve est de TYPE (`npm run typecheck`) : `toEqualTypeOf` refuse
 * une vue manuscrite, même compatible, et le `@ts-expect-error` rougit (TS2578) si l'ancien nom reste lisible.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { findPsychologyById, psychologies, type PsychologyData } from './index';
import type { DatasetDe, EntreeDe } from './datasets';
import type * as psychologyDef from './schemas/defs/psychology';

/** L'entrée du schéma de psychologie, `psychImmune` renommé : ce que le type dérivé deviendrait. */
type SchemaRenomme = Omit<EntreeDe<typeof psychologyDef>, 'psychImmune'> & { immunisePsy?: boolean };

describe('psychology.json — ses lecteurs lisent le type dérivé de son schéma', () => {
  it('le dataset et sa recherche par id rendent la sortie du schéma', () => {
    expectTypeOf(psychologies).toEqualTypeOf<DatasetDe<typeof psychologyDef>>();
    expectTypeOf(findPsychologyById).returns.toEqualTypeOf<EntreeDe<typeof psychologyDef> | undefined>();
    expectTypeOf<PsychologyData>().toEqualTypeOf<EntreeDe<typeof psychologyDef>>();
  });

  it('un champ renommé au schéma n’est plus lisible sous son ancien nom', () => {
    const lire = (p: SchemaRenomme) =>
      // @ts-expect-error — `psychImmune` renommé au schéma : le lecteur rougit
      p.psychImmune;
    expect(psychologies.some((p) => lire(p) === true)).toBe(true);
  });
});
