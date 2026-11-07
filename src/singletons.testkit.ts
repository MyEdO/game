/**
 * Les SINGLETONS DE MODULE du moteur et du noyau qu'un test peut poser, remis à leur état de départ. Les deux setups
 * l'appellent en fin de fichier : sous `isolate: false`, le corps de module du fichier suivant s'évalue hors de tout
 * `beforeEach` (#3503). Le web (`src/test-setup.ts`) l'appelle aussi avant chaque test ; le noyau
 * (`src/test-setup-noyau.ts`) non, l'ouverture du propriétaire posant ces singletons pour tout son fichier.
 */
import { loadRuleOverrides } from './engine/policy';
import { resetDesFixes } from './engine/fixedDie';
import { seedBattleRng } from './noyau/battleRng';
import { resetOwnTestFailedGuard } from './noyau/triggeredEffects';

export function remettreLesSingletons(): void {
  loadRuleOverrides({});
  resetDesFixes();
  seedBattleRng(1); // #1788
  resetOwnTestFailedGuard();
}
