import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { scanCombatEventPort } from '../../scripts/guards/lib/combatEventPort.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * QUARANTAINE D'IMPORT du bus d'événements de combat (#316 — « le bus est l'UNIQUE porte »).
 * `fireTriggers` (dispatcher de DONNÉES, `triggeredEffects.ts`) et `runCombatHooks` (dispatcher de
 * MACHINERIE, `combatHooks.ts`) ne peuvent être IMPORTÉS que par :
 *   - `combatEvents.ts` : l'UNIQUE porte (`emitCombatEvent`) ;
 *   - les modules BUS-OWNED `combat/roundHooks.ts` / `combat/turnHooks.ts` : leurs boucles internes
 *     `fireTriggers` par combattant SONT la machinerie du bus pour les événements de cycle
 *     (`onRoundEnd`/`onRoundStart`/`onTurnStart`/`onTurnEnd`), ordonnées par `order` et interleavées ;
 *   - les modules DÉFINISSEURS (`triggeredEffects.ts`, `combatHooks.ts`) eux-mêmes ;
 *   - les tests.
 * Tout autre importeur ré-ouvre le dispatch DIRECT que #316 ferme → échec fail-closed. Garde
 * STRUCTURELLE (le dispatch direct devient INEXPRIMABLE), patron cliquet-libre : la whitelist est
 * FIXE, il n'y a pas de baseline à faire décroître (zéro violation tolérée).
 */

const SCAN_DIRS = ['src'];

/** Importeurs AUTORISÉS de `fireTriggers`/`runCombatHooks` (chemins POSIX relatifs à la racine). */
const WHITELIST = new Set<string>([
  'src/state/combatEvents.ts', // l'unique porte
  'src/noyau/triggeredEffects.ts', // définit fireTriggers
  'src/state/combatHooks.ts', // définit runCombatHooks
  'src/state/combat/roundHooks.ts', // bus-owned : boucles de cycle onRoundEnd/onRoundStart
  'src/state/combat/turnHooks.ts', // bus-owned : boucles de cycle onTurnStart/onTurnEnd
  'src/state/clockHooks.ts', // bus-owned : boucle de cycle d'HORLOGE onDayStart/onWake (jumeau hors-combat de roundHooks)
]);


describe('quarantaine d’import — bus d’événements de combat unique (#316)', () => {
  it('fireTriggers / runCombatHooks importés UNIQUEMENT par la porte + les modules bus-owned', () => {
    const offenders: string[] = [];
    for (const { rel, text } of readCorpus(SCAN_DIRS, { tests: true })) {
      if (estFichierVitest(rel) || WHITELIST.has(rel)) continue;
      for (const { line, symbol } of scanCombatEventPort(text)) {
        offenders.push(`${rel}:${line} importe ${symbol}`);
      }
    }
    expect(
      offenders,
      'Dispatch DIRECT ré-ouvert — passer par emitCombatEvent (src/state/combatEvents.ts) ; ' +
        `si module bus-owned légitime, l’ajouter à WHITELIST :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('FAIL-CLOSED : un importeur fictif hors whitelist est DÉTECTÉ', () => {
    const fake = "import { fireTriggers } from '../triggeredEffects';\nimport { runCombatHooks } from './combatHooks';\n";
    const found = scanCombatEventPort(fake).map((f) => f.symbol);
    expect(found).toEqual(['fireTriggers', 'runCombatHooks']);
  });

  it('FAIL-CLOSED : un `export *` (ré-export baril) n’est PAS matché (pas de porte rouverte)', () => {
    expect(scanCombatEventPort("export * from './combatHooks';")).toEqual([]);
  });
});
