import { describe, it, expect } from 'vitest';
import { MODAL_DEFS } from './modalArbiter';
import { JET_AUTO } from './combatAuto';
import { useGame } from './store';

/**
 * Garde-fous de la politique d'auto-cadence (Cadence de combat) :
 *  - COUVERTURE : chaque entrée MODAL_DEFS a une politique `auto` (le champ requis le force déjà à la
 *    compilation ; ce test documente + verrouille la liste des modes).
 *  - VALIDITÉ : chaque action `drive` (MODAL_DEFS + JET_AUTO) existe RÉELLEMENT comme fonction du store
 *    (anti-dérivation : on ne devine pas les noms — cf. `stateRecovery`→`recover*`, `corruption`→`resolveCorruption`).
 *  - EXHAUSTIVITÉ JET_AUTO : tous les `CascadeStep['jet']` ont une politique.
 */
describe('Cadence — couverture & validité de la politique auto', () => {
  it('chaque entrée MODAL_DEFS a une politique auto valide', () => {
    for (const d of MODAL_DEFS) {
      expect(d.auto, d.key).toBeDefined();
      expect(['self', 'choice', 'partial', 'hostOnly'], d.key).toContain(d.auto.mode);
    }
  });

  it('chaque action `drive` (MODAL_DEFS + JET_AUTO) existe comme fonction du store', () => {
    const st = useGame.getState() as unknown as Record<string, unknown>;
    const drives = [
      ...MODAL_DEFS.flatMap((d) => (d.auto.mode === 'self' ? [...d.auto.drive] : [])),
      ...Object.values(JET_AUTO).flatMap((p) => (p.mode === 'self' ? [...p.drive] : [])),
    ];
    expect(drives.length).toBeGreaterThan(0);
    for (const name of drives) {
      expect(typeof st[name as string], `store.${String(name)}`).toBe('function');
    }
  });

  it('JET_AUTO couvre tous les types de jet de cascade de combat', () => {
    const jets: NonNullable<import('./pendings').CascadeStep['jet']>[] = [
      'attack', 'defense', 'fumble', 'test', 'cast', 'disengage', 'extended', 'forceDoor',
    ];
    for (const j of jets) expect(JET_AUTO[j], j).toBeDefined();
  });
});
