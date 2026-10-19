// Mécanique de scan de la QUARANTAINE d'import du bus d'événements de combat (#316). Le dispatcher de
// DONNÉES `fireTriggers` (`src/noyau/triggeredEffects.ts`) et le dispatcher de MACHINERIE
// `runCombatHooks` (`src/state/combatHooks.ts`) ne doivent être IMPORTÉS que par l'UNIQUE porte
// `emitCombatEvent` (`combatEvents.ts`) et les modules bus-owned explicitement whitelistés (les boucles
// internes de cycle roundHooks/turnHooks). Tout autre importeur ré-ouvre une porte de dispatch DIRECT —
// exactement l'affordance que #316 ferme. Module ESM pur (node nu), même patron que `inBattleFind.mjs`.

/** Symboles sous quarantaine (le dispatch DIRECT devient inexprimable hors whitelist). @type {string[]} */
export const QUARANTINED = ['fireTriggers', 'runCombatHooks'];

/**
 * Capture les IMPORTS/RÉEXPORTS nommés (`import { … } from …` / `export { … } from …`) portant un
 * symbole sous quarantaine — un `export *` n'est PAS un import de symbole nommé (il ne rouvre pas de
 * porte : le symbole n'est pas consommé), il n'est donc pas matché.
 * @param {string} contenu @returns {{ line: number, symbol: string }[]}
 */
export function scanCombatEventPort(contenu) {
  const findings = [];
  const rx = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]+['"]/g;
  let m;
  while ((m = rx.exec(contenu)) !== null) {
    const named = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim());
    for (const sym of QUARANTINED) {
      if (named.includes(sym)) {
        const line = contenu.slice(0, m.index).split('\n').length;
        findings.push({ line, symbol: sym });
      }
    }
  }
  return findings;
}
