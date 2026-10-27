/**
 * Résolution d'un Trait OCTROYÉ (`grantTrait`, `domeWard`), que `applyOps` et `attachMutation`
 * (`engine/corruption.ts`) partagent. Dans la composante fortement connexe d'`ops.ts` par `formule.ts` :
 * #3044.
 */
import type { RNG } from './dice';
import type { Combatant, EffectSource } from './types';
import type { GameOp } from './ops';
import { slBonus, valeurSansTirage } from './formule';
import { traitsDuPorteur, type TraitInstance } from './statEntry';
import { TIRAGE_DE_CIBLE } from '../data/obsessions';

/**
 * Les instances qu'accorde un Trait octroyé à `porteur`, chacune à la provenance `src` : l'Indice formulé se
 * lit sur le `lanceur` (LDB 47 l.441), plus `indicePerSL` au DR `sl` (LDB 47 l.420) ; une Cible tirée donne
 * une instance par tirage (EDOC 12 l.217, l.241) ; une fourchette se tire pour le porteur (`traitsDuPorteur`).
 * SEULE résolution d'un Trait octroyé.
 */
export function traitsOctroyes(
  o: Pick<Extract<GameOp, { op: 'grantTrait' }>, 'trait' | 'cible' | 'indicePerSL'>,
  { lanceur, porteur, rng, sl, src }: { lanceur: Combatant; porteur: Combatant; rng: RNG; sl?: number; src?: EffectSource },
): TraitInstance[] {
  const { value, ...pose } = o.trait;
  const indice = value === undefined ? {} : { value: valeurSansTirage(value, lanceur) + slBonus(sl, o.indicePerSL) };
  const cible = o.cible;
  const poses = cible
    ? Array.from({ length: cible.pick }, () => ({ ...pose, ...indice, arg: TIRAGE_DE_CIBLE[cible.table.id](rng) }))
    : [{ ...pose, ...indice }];
  return traitsDuPorteur(poses, porteur.id, porteur.traits, { src });
}
