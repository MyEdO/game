/**
 * Registre des timers RÉELS tracés de `state/`, `noyau/`, `lib/` et `web/` : beats de cadence de COMBAT
 * (IA/enchaînement de tour/auto-résolution) ET timers hors combat (cascade différée
 * portFlow/tavernFlow, coop netFlow, délai d'ouverture IndexedDB). `combatFlow`/`combatDirector`/`combatAuto` chorégraphient leurs beats (TEMPO) par
 * `programmer` (`src/noyau/plateforme.ts`), que la plateforme web relaie à `scheduleCombatTimer` : de
 * VRAIS `setTimeout` qui mutent `battle` (et tirent `battleRng`) à leur échéance. Un test SYNCHRONE
 * qui arme un tel timer sans laisser le temps réel s'écouler le laisse EN VOL ; sous `isolate:false`
 * (module partagé entre fichiers du même worker) le timer se déclenche pendant un test ultérieur et
 * corrompt son `battle`/sa séquence de RNG — flake d'ordonnancement, pas d'instance (#405).
 *
 * `scheduleCombatTimer` porte l'appel différé de la plateforme web du noyau, `scheduleFlowTimer` tout
 * timer de flux ; `clearTrackedTimers` (appelé par `src/test-setup.ts` en
 * `afterEach`) annule tout timer encore en vol au sortir d'un test (#405, #415).
 *
 * SOURCE UNIQUE : mur `murs/minuteries` (`oxlint.config.mjs`, #415).
 */
const pending = new Set<ReturnType<typeof setTimeout>>();

function track(fn: () => void, delay: number): ReturnType<typeof setTimeout> {
  const id = setTimeout(() => {
    pending.delete(id);
    fn();
  }, delay);
  pending.add(id);
  return id;
}

/** Beat de cadence de COMBAT (IA/enchaînement de tour/auto-résolution). */
export const scheduleCombatTimer = track;

/** Timer hors combat (ouverture de cascade différée portFlow/tavernFlow, coop netFlow, délai
 *  d'ouverture IndexedDB). */
export const scheduleFlowTimer = track;

/** Le timer tracé `id` est-il encore en vol (ni tiré, ni annulé) ? */
export function timerEnVol(id: ReturnType<typeof setTimeout>): boolean {
  return pending.has(id);
}

/** Annule tout timer tracé encore en vol (teardown de test). */
export function clearTrackedTimers(): void {
  for (const id of pending) clearTimeout(id);
  pending.clear();
}

/** Annule UN timer tracé et le retire du registre (les timers de flux annulés fonctionnellement —
 *  ex. reconnexion coop `netFlow` — n'attendent pas le teardown pour libérer leur entrée dans `pending`). */
export function clearTrackedTimer(id: ReturnType<typeof setTimeout>): void {
  clearTimeout(id);
  pending.delete(id);
}
