import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { advanceTurn } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng, battleRng } from '../battleRng';
import { addCondition, COND } from '../../engine/conditions';
import { testScene } from '../../scenes/test-fixture';

/**
 * GOLDEN d'ordre de franchissement de Round (filet anti-régression du plan d'archi) : combat
 * déterministe, un combattant Empoisonné (exerce `endOfRound` + le RNG), Round franchi de force →
 * on fige (a) la séquence EXACTE des lignes de journal produites par le franchissement et (b) la
 * position du RNG après coup. La migration des boucles inline d'`advanceTurn` vers des hooks
 * `roundBoundary` DOIT garder ce snapshot byte-pour-byte (ordre + tirages préservés).
 */
describe('GOLDEN — séquence de franchissement de Round (advanceTurn)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('lignes de journal + position RNG inchangées', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    seedBattleRng(777);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const enemy = b.combatants.find((c) => c.kind === 'enemy')!;
    addCondition(enemy, COND.empoisonne); // exerce endOfRound (dégâts périodiques + RNG)
    const beforeLen = useGame.getState().battle!.log.length;
    seedBattleRng(424242); // RNG du franchissement fixé, indépendant du setup
    useGame.setState({ battle: { ...useGame.getState().battle!, turn: useGame.getState().battle!.order.length - 1 } });
    advanceTurn(useGame.getState, useGame.setState);
    const after = useGame.getState().battle!;
    const lines = after.log.slice(beforeLen).map((e) => `${e.kind}:${e.text}`);
    const rngProbe = battleRng().int(1, 100);
    expect({ lines, rngProbe }).toMatchInlineSnapshot(`
      {
        "lines": [
          "round:— Round 2 —",
          "condition:Mutant subit 1 Blessure(s) (ignorant BE et PA).",
          "condition:Mutant — Test de Résistance Intermédiaire (+0) : 13/20 → réussi (DR +1).",
          "condition:Mutant retire 1 État Empoisonné.",
          "condition:Mutant reçoit 1 État Exténué.",
        ],
        "rngProbe": 24,
      }
    `);
  });
});
