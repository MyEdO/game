import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { advanceTurn } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng, battleRng } from '../battleRng';
import { addCondition, COND } from '../../engine/conditions';
import { testScene } from '../../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * GOLDEN d'ordre de franchissement de Round (filet anti-régression du plan d'archi) : combat
 * déterministe, un combattant Empoisonné (exerce `endOfRound` + le RNG), Round franchi de force →
 * on fige (a) la séquence EXACTE des lignes de journal produites par le franchissement et (b) la
 * position du RNG après coup. Les hooks `roundBoundary` d'`advanceTurn` DOIVENT garder ce snapshot
 * byte-pour-byte (ordre + tirages préservés).
 */
describe('GOLDEN — séquence de franchissement de Round (advanceTurn)', () => {
  it('lignes de journal + position RNG inchangées', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    seedBattleRng(777);
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const enemy = b.combatants.find((c) => c.kind === 'enemy')!;
    addCondition(enemy, COND.empoisonne); // exerce endOfRound (dégâts périodiques + RNG)
    const beforeLen = banc.getState().battle!.log.length;
    seedBattleRng(424242); // RNG du franchissement fixé, indépendant du setup
    banc.setState({ battle: { ...banc.getState().battle!, turn: banc.getState().battle!.order.length - 1 } });
    advanceTurn(banc.getState, banc.setState);
    const after = banc.getState().battle!;
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
