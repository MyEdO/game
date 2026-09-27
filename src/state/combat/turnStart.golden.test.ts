import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { runEnemyAI } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng, battleRng } from '../battleRng';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';

/**
 * GOLDEN du CYCLE DE TOUR ENNEMI (phase `turnStart`) : fige byte-pour-byte la séquence de début de
 * tour de `runEnemyAI` (fin de Frénésie → Rage → tentative de Frénésie IA → psychologie), AVANT le
 * test Stupide inline et l'action IA. La migration de ces 4 étapes vers des hooks `turnStart`
 * ordonnés DOIT garder ce snapshot identique (ordre + tirages RNG préservés).
 *
 * - Ennemi RAGE (Rage + Avantage ≥ 3) → entre en Frénésie SANS RNG (journal), puis devient
 *   immunisé à la Psychologie → resolvePsychAI no-op (verrouille la dépendance d'ordre RAW :
 *   Frénésie/Rage AVANT la psychologie).
 * - Ennemi PEUR (source de Peur en Ligne de Vue, pas de Frénésie) → resolvePsychAI consomme le RNG
 *   et journalise.
 * Pour chaque ennemi, on capture les lignes de journal produites par la portion synchrone de début
 * de tour + la position du RNG (`battleRng().int(1,100)`) juste après.
 */
describe('GOLDEN — cycle de tour ennemi (runEnemyAI turnStart)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    seedBattleRng(777);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    return { b, H, enemies };
  }

  it('séquence de début de tour + position RNG inchangées', () => {
    const { b, H, enemies } = setup();
    const [rageE, fearE, spare] = enemies;
    (spare as Combatant).dead = true; // un seul Round, deux acteurs testés
    H.pos = { x: 10, y: 10 };
    // Ennemi RAGE : Rage + Avantage 3, adjacent au héros (Ligne de Vue dégagée).
    rageE.pos = { x: 11, y: 10 };
    rageE.traits = [{ id: 'rage' }];
    rageE.advantage = 3;
    // Ennemi PEUR : le héros lui inspire de la Peur (Indice 2), adjacent, pas de Frénésie.
    fearE.pos = { x: 9, y: 10 };
    H.causesPeur = 2;
    useGame.setState({ battle: { ...b } });

    seedBattleRng(424242); // RNG du cycle de tour fixé, indépendant du setup

    const captureTurnStart = (id: string): string[] => {
      const before = useGame.getState().battle!.log.length;
      // Chacun à SON rang : `runEnemyAI` refuse un tour qui n'est pas celui de l'actif (jeton de
      // tour, #1852) — deux acteurs testés = deux tours, jamais deux fois le même.
      const b = useGame.getState().battle!;
      b.turn = b.order.indexOf(id);
      runEnemyAI(useGame.getState, useGame.setState, id);
      // Portion synchrone seulement : les setTimeout d'attaque ne sont PAS avancés (fake timers).
      return useGame.getState().battle!.log.slice(before).map((e) => `${e.kind}:${e.text}`);
    };

    const rageLines = captureTurnStart(rageE.id);
    const fearLines = captureTurnStart(fearE.id);
    const rngProbe = battleRng().int(1, 100);

    expect({ rageLines, fearLines, rngProbe }).toMatchInlineSnapshot(`
      {
        "fearLines": [
          "fear:Mutant a peur de H.",
        ],
        "rageLines": [
          "frenzy:Mutant entre dans une rage dévorante (Frénésie) !",
        ],
        "rngProbe": 13,
      }
    `);
  });
});
