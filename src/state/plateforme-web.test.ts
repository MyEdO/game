import { describe, it, expect, vi, afterEach } from 'vitest';
import { useGame, initCombatAuto } from './store';
import { rosterUpdate } from './roster';
import { scheduleCombatTimer, clearTrackedTimers, timerEnVol } from '../web/minuteries';
import { poserLaPlateforme, retirerLaPlateforme, programmer } from '../noyau/plateforme';
import { setCadence, resetCadence } from '../engine/cadence';

/** #2817 (D6) : la plateforme web du noyau, posée par `src/state/store.ts`, et l'auto-cadence qu'elle
 *  planifie (`planifierLeTickAuto`, `src/state/combatAuto.ts`). */
describe('plateforme web du noyau', () => {
  afterEach(() => { vi.useRealTimers(); resetCadence(); });

  it('relaie le registre tracé de `web/minuteries` et le roster', () => {
    const web = retirerLaPlateforme();
    poserLaPlateforme(web);
    expect(web.programmer).toBe(scheduleCombatTimer);
    expect(web.persisterLeHeros).toBe(rosterUpdate);
    expect(web.enAttente).toBe(timerEnVol);
  });

  it('un appel `programmer` en timers réels est annulé par le teardown de test (#405, #415)', async () => {
    const suite = vi.fn();
    programmer(suite, 5);
    clearTrackedTimers();
    await new Promise<void>((fin) => { scheduleCombatTimer(fin, 30); });
    expect(suite).not.toHaveBeenCalled();
  });

  it('l’auto-cadence coalesce ses écritures en UN tick, rien en manuel ni après désabonnement', () => {
    vi.useFakeTimers();
    const desabonner = initCombatAuto();
    try {
      useGame.setState({}); useGame.setState({}); useGame.setState({});
      const manuel = vi.getTimerCount();
      setCadence('auto');
      useGame.setState({}); useGame.setState({}); useGame.setState({});
      const auto = vi.getTimerCount();
      vi.runOnlyPendingTimers();
      desabonner();
      useGame.setState({}); useGame.setState({});
      const apresDesabonnement = vi.getTimerCount();
      expect({ manuel, auto, apresDesabonnement }).toEqual({ manuel: 0, auto: 1, apresDesabonnement: 0 });
    } finally {
      desabonner();
    }
  });

  it('un tick coalescé que le teardown annule n’empêche pas le tick suivant', () => {
    vi.useFakeTimers();
    const desabonner = initCombatAuto();
    try {
      setCadence('auto');
      useGame.setState({});
      const avant = vi.getTimerCount();
      clearTrackedTimers();
      useGame.setState({}); useGame.setState({});
      const apres = vi.getTimerCount();
      expect({ avant, apres }).toEqual({ avant: 1, apres: 1 });
    } finally {
      desabonner();
    }
  });
});
