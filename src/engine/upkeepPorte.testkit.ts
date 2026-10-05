/**
 * LA PORTE d'entretien, côté test (#1657 B3-3). Le moteur ne roule plus aucun Test du cycle de maladie
 * ni de convalescence : il DIFFÈRE (`UpkeepDeferTest`). Un test qui veut juger une CONSÉQUENCE doit donc
 * (1) collecter la spec — c'est ce que la porte reçoit — puis (2) INJECTER l'issue qu'il veut juger.
 *
 * `applique` est le miroir STRICT des appliers de nuit (`registerNightBandApplier('diseaseTick' |
 * 'diseaseGangrene' | 'diseasePersist')`, `src/state/restFlow.ts`) : mêmes trois routes, même lecture du
 * `meta`, et surtout LES MÊMES FONCTIONS — chaque route appelle l'unique foyer de sa conséquence
 * (`applyOps` ancré à la maladie, `applyDiseaseGangrene`, `applyDiseaseEnd` qui porte la guérison ET la
 * réconciliation des États portés par un passif). Le kit ne peut donc pas dériver de l'applier réel : il n'y a
 * qu'un exemplaire de chaque geste, et `maladie-porte-valeur.test.ts` le mesure (cure kit === nuit).
 */
import type { Combatant, UpkeepDeferTest } from './types';
import type { RNG } from './dice';
import { defaultRNG } from './dice';
import { applyOps, type GameOp } from './ops';
import { applyDiseaseGangrene } from './disease';
import { applyDiseaseEnd } from './rest';

/** Ce que le moteur remet à la porte pour UN Test d'entretien. */
export type SpecEntretien = Parameters<UpkeepDeferTest>[0];

/** Collecteur : `defer` à passer au moteur, `specs` à juger. */
export function porteEntretien(): { specs: SpecEntretien[]; defer: UpkeepDeferTest } {
  const specs: SpecEntretien[] = [];
  return { specs, defer: (s) => { specs.push(s); } };
}

/** ISSUE INJECTÉE d'un Test différé → sa conséquence, par la MÊME route que l'applier de nuit. */
export function applique(
  c: Combatant,
  spec: SpecEntretien,
  res: { success: boolean; sl?: number },
  rng: RNG = defaultRNG,
): string[] {
  const sl = res.sl ?? 0;
  const meta = spec.meta ?? {};
  if (spec.kind === 'diseasePersist') return applyDiseaseEnd(c, String(meta.diseaseName ?? ''), res.success, sl, rng);
  if (spec.kind === 'diseaseGangrene') return applyDiseaseGangrene(c, String(meta.diseaseName ?? ''), res.success, Number(meta.be ?? 0));
  if (res.success) return []; // `diseaseTick` : la réussite n'applique RIEN (branche `success` vide au schéma)
  // MÊME ancrage que l'applier de nuit : la maladie est l'entité SOURCE de ce que son échec inflige.
  const source = { kind: 'disease' as const, id: String(meta.diseaseName ?? '') };
  return applyOps(c, (meta.opsEchec ?? []) as GameOp[], { rng, sl, source });
}
