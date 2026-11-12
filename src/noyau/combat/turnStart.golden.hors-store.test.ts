import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runEnemyAI } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng, battleRng } from '../battleRng';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * GOLDEN du CYCLE DE TOUR ENNEMI (phase `turnStart`) : fige byte-pour-byte la séquence de début de
 * tour de `runEnemyAI` (Rage → tentative de Frénésie IA), AVANT le test Stupide inline et l'action IA.
 * Ces hooks `turnStart` ordonnés DOIVENT garder ce snapshot identique (ordre + tirages RNG préservés).
 *
 * - Ennemi RAGE (Rage + Avantage ≥ 3) → entre en Frénésie SANS RNG (journal).
 * - Ennemi PEUR (source de Peur en Ligne de Vue) → rien au début de SON tour : la psychologie de combat
 *   se joue aux passes de Round (LDB 21 l.9, l.25).
 * Pour chaque ennemi, on capture les lignes de journal produites par la portion synchrone de début
 * de tour + la position du RNG (`battleRng().int(1,100)`) juste après.
 */
describe('GOLDEN — cycle de tour ennemi (runEnemyAI turnStart)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    seedBattleRng(777);
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
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
    banc.setState({ battle: { ...b } });

    seedBattleRng(424242); // RNG du cycle de tour fixé, indépendant du setup

    const captureTurnStart = (id: string): string[] => {
      const before = banc.getState().battle!.log.length;
      // Chacun à SON rang : `runEnemyAI` refuse un tour qui n'est pas celui de l'actif (jeton de
      // tour, #1852) — deux acteurs testés = deux tours, jamais deux fois le même.
      const b = banc.getState().battle!;
      b.turn = b.order.indexOf(id);
      runEnemyAI(banc.getState, banc.setState, id);
      // Portion synchrone seulement : les jetons d'attaque ne sont PAS repris (horloge virtuelle du banc).
      return banc.getState().battle!.log.slice(before).map((e) => `${e.kind}:${e.text}`);
    };

    const rageLines = captureTurnStart(rageE.id);
    const fearLines = captureTurnStart(fearE.id);
    const rngProbe = battleRng().int(1, 100);

    expect({ rageLines, fearLines, rngProbe }).toMatchInlineSnapshot(`
      {
        "fearLines": [],
        "rageLines": [
          "frenesie:Dider Rudlos entre dans une rage dévorante (Frénésie) !",
        ],
        "rngProbe": 13,
      }
    `);
  });
});
