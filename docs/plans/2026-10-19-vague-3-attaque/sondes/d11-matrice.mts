// Matrice D11 : detenteurDuCiblage (tel que le design l'écrit) vs targetingHolder et la tête de currentTargetingMode d'aujourd'hui.
import '/home/user/game/src/state/store';
import { targetingHolder, coupFerme } from '/home/user/game/src/state/targetingHolder';
import { placingZoneOf } from '/home/user/game/src/state/combatFlow';
import { currentTargetingMode } from '/home/user/game/src/state/targetingModes';
type Det = { kind: 'cleave' | 'dual' | 'overcast' } | { kind: 'zone'; source: 'cast' | 'siege' } | null;
function detenteurDuCiblage(s: any): Det {
  if (s.pendingCleave && !s.pendingAttack && coupFerme(s)) return { kind: 'cleave' };
  if (s.pendingDualStrike && !s.pendingAttack && coupFerme(s)) return { kind: 'dual' };
  if (s.pendingCast?.pickingTargets) return { kind: 'overcast' };
  const pz = placingZoneOf(s); if (pz) return { kind: 'zone', source: pz.source };
  return null;
}
const holderDerive = (d: Det) => d?.kind === 'cleave' ? 'pendingCleave' : d?.kind === 'dual' ? 'pendingDualStrike' : d?.kind === 'zone' && d.source === 'siege' ? 'pendingSiegeAim' : undefined;
const modeDerive = (d: Det) => d?.kind === 'cleave' ? 'cleave' : d?.kind === 'dual' ? 'dual' : d?.kind === 'overcast' ? 'overcast' : d?.kind === 'zone' ? 'placing-zone' : null;
const cascades = [null, { purpose: 'combat', cursor: 0, participants: [{ id: 'p', committed: false, kind: 'x' }] }];
const casts = [null, { casterId: 'c', spellId: 's', pickingTargets: true }, { casterId: 'c', spellId: 's', zone: { placing: true, radius: 1 } }, { casterId: 'c', spellId: 's', zone: { placing: true, radius: 1, center: { x: 1, y: 1 } } }, { casterId: 'c', spellId: 's', pickingTargets: true, zone: { placing: true, radius: 1 } }];
let n = 0, dh = 0, dm = 0; const ids = new Set<string>();
for (const cleave of [null, { attackerId: 'a' }]) for (const dual of [null, { attackerId: 'a' }]) for (const atk of [null, { attackerId: 'a' }])
for (const pc of casts) for (const sa of [null, { gunnerId: 'g', radius: 1, rangeTiles: 5 }]) for (const casc of cascades) {
  const s: any = { pendingCleave: cleave, pendingDualStrike: dual, pendingAttack: atk, pendingCast: pc, pendingSiegeAim: sa, pendingCascade: casc, battle: null };
  n++;
  const d = detenteurDuCiblage(s);
  if (targetingHolder(s) !== holderDerive(d)) { dh++; console.log('HOLDER≠', JSON.stringify(s), targetingHolder(s), holderDerive(d)); }
  const real = currentTargetingMode(() => s).id; ids.add(real);
  const md = modeDerive(d);
  if (md !== null && real !== md) { dm++; console.log('MODE≠', JSON.stringify(s), real, md); }
  if (md === null && ['cleave', 'dual', 'overcast', 'placing-zone'].includes(real)) { dm++; console.log('MODE tête manquée', JSON.stringify(s), real); }
}
console.log('cas', n, 'écarts holder', dh, 'écarts mode', dm, 'modes vus', [...ids].join(','));
