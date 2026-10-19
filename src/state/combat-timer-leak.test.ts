import { describe, it, expect } from 'vitest';
import { scheduleCombatTimer, scheduleFlowTimer, clearTrackedTimers } from '../lib/minuteries';

/**
 * #405 : un beat de combat armé (`scheduleCombatTimer`, VRAI `setTimeout`) par un test SYNCHRONE qui
 * ne le laisse pas s'écouler reste EN VOL après la fin du test. Sous `isolate:false`, il se déclenche
 * pendant le test SUIVANT du même worker et mute son état. Le filet est `clearTrackedTimers()` en
 * `afterEach` de `src/test-setup.ts` — ces deux tests reproduisent le scénario EXACT (armer sans
 * attendre puis vérifier, dans le test SUIVANT, que rien ne s'est déclenché). #415 étend le même
 * registre (`scheduleCombatTimer` / `clearTrackedTimers`) aux timers de flux hors combat.
 */
describe('scheduleCombatTimer / clearTrackedTimers — filet anti-fuite (#405)', () => {
  it('clearTrackedTimers annule un timer réel encore en vol avant son échéance', async () => {
    let fired = false;
    scheduleCombatTimer(() => { fired = true; }, 5);
    clearTrackedTimers();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(fired).toBe(false);
  });

  let leaked = false;
  it('test A : arme un beat de combat SANS attendre (comme le ferait un test synchrone)', () => {
    scheduleCombatTimer(() => { leaked = true; }, 5);
    expect(leaked).toBe(false); // synchrone : le timer de 5ms n'a pas eu d'occasion de tourner
  });

  it('test B : le timer armé par le test A ne doit PAS se déclencher pendant CE test (teardown global drainé)', async () => {
    await new Promise((resolve) => setTimeout(resolve, 30)); // largement > le délai de 5ms du test A
    expect(leaked).toBe(false);
  });

  it('scheduleFlowTimer (timer de FLUX hors combat) est drainé par la MÊME clearTrackedTimers (#415)', async () => {
    let fired = false;
    scheduleFlowTimer(() => { fired = true; }, 5);
    clearTrackedTimers();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(fired).toBe(false);
  });
});
