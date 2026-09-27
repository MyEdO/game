/**
 * Résolveur de `TrappingRef` `{choice}`/`{wildcard}` (construct de choix d'équipement, Lot 1/3 —
 * EN MIROIR de `advancementLabel` pour `AdvancementRef`, `src/data/index.ts`).
 */
import type { TrappingRef } from '../data/index';
import { trappingRefLabel, DEFAULT_FABRICATION_ATOUT, fabricationAtoutQuality } from '../data/index';

/** Résout les emplacements `{choice}`/`{wildcard}` d'une liste de `TrappingRef` en refs CONCRÈTES,
 *  RÉCURSIF (un `choice` peut contenir un `choice`). `choices` : clé = `trappingRefLabel(ref)` de
 *  l'EMPLACEMENT (même convention que `opts.choices`/`specChoices` des talents), valeur = le libellé
 *  de la branche/l'id choisi. Sans entrée dans `choices` : `choice` retombe sur sa 1re branche
 *  (DÉFAUT, comme les talents) ; `wildcard` reste INCHANGÉ (non résolu — ignoré par le
 *  matérialiseur, exactement comme un `{text}` aujourd'hui). */
export function resolveTrappingChoices(refs: TrappingRef[], choices: Record<string, string>): TrappingRef[] {
  return refs.map((ref) => resolveOne(ref, choices));
}

function resolveOne(ref: TrappingRef, choices: Record<string, string>): TrappingRef {
  if ('choice' in ref) {
    const key = trappingRefLabel(ref);
    const picked = choices[key];
    const branch = (picked && ref.choice.find((b) => trappingRefLabel(b) === picked)) || ref.choice[0];
    return resolveOne(branch, choices);
  }
  if ('wildcard' in ref) {
    const key = trappingRefLabel(ref);
    const pickedId = choices[key];
    return pickedId ? { id: pickedId } : ref;
  }
  if ('id' in ref && ref.qualityChoice) {
    const key = trappingRefLabel(ref);
    // Sans choix : défaut sur `DEFAULT_FABRICATION_ATOUT` (Raffiné), EN MIROIR de `{choice}` qui
    // défaute sur sa 1re branche — un objet « de qualité » a TOUJOURS un Atout (RAW),
    // jamais matérialisé nu (correctif juge Lot 1, #657).
    const pickedAtoutId = choices[key] ?? DEFAULT_FABRICATION_ATOUT;
    return { id: ref.id, spec: ref.spec, count: ref.count, qualities: [fabricationAtoutQuality(pickedAtoutId)] };
  }
  return ref;
}
