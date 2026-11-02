/**
 * Pions minimaux posés à (x, y, z) et bataille qui les porte, pour les tests z-blind de la géométrie
 * de combat et des gestes de placement (#798, #799, #802).
 */
import type { BattleState } from '../noyau/etat';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

export const mk = (id: string, x: number, y: number, z?: number, extra?: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({ id, name: id, pos: z ? { x, y, z } : { x, y }, wounds: blessuresDeBase(10), conditions: [], ...extra })) as unknown as Combatant;

export const battle = (cs: Combatant[], zones: BattleState['zones'] = []): BattleState => ({ combatants: cs, zones }) as unknown as BattleState;
