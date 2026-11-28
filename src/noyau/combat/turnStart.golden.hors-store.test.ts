import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runEnemyAI } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng, battleRng } from '../battleRng';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';
import { poserLeDataset } from '../../data/datasetDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * GOLDEN du CYCLE DE TOUR ENNEMI : fige la portion synchrone du tour de `runEnemyAI` de deux ennemis, et la position du
 * RNG après eux.
 *
 * - Ennemi RAGE (Rage + Avantage 3, non Engagé) : sa décision joue sa Frénésie, manœuvre sur soi gratuite, sans RNG
 *   (#5042). Fixture déclarée au seam des datasets : le trait `rage-de-test` et sa manœuvre de Frénésie.
 * - Ennemi PEUR (source de Peur en Ligne de Vue) : rien au début de SON tour, la psychologie de combat se joue aux
 *   passes de Round (LDB 21 l.9, l.25).
 */
const FRENESIE = {
  id: 'frenesie-de-test', type: 'maneuvers', label: 'Frénésie de test', kind: 'hurlement', activation: 'free', coutEnAvantage: 3, ciblage: 'soi', modeDAvantage: 'tout',
  effects: [{ trigger: 'onHit', on: 'soi', flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [{ op: 'beginPsych', type: { id: 'frenesie' } }] } } }],
  source: { book: 'LDB', page: 0 },
} as never;
poserLeDataset('maneuvers', (livre) => [...livre, FRENESIE]);
poserLeDataset('traits', (livre) => [...livre, { id: 'rage-de-test', type: 'traits', label: 'Rage de test', grantsManeuvers: [{ id: 'frenesie-de-test' }], source: { book: 'LDB', page: 0 } } as never]);

describe('GOLDEN — cycle de tour ennemi (runEnemyAI)', () => {
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

  it('portion synchrone des deux tours + position RNG', () => {
    const { b, H, enemies } = setup();
    const [rageE, fearE, spare] = enemies;
    (spare as Combatant).dead = true; // un seul Round, deux acteurs testés
    H.pos = { x: 10, y: 10 };
    // Ennemi RAGE : Rage + Avantage 3, adjacent au héros (Ligne de Vue dégagée).
    rageE.pos = { x: 11, y: 10 };
    rageE.traits = [{ id: 'rage-de-test' }];
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
      return banc.getState().battle!.log.slice(before).map((e) => `${e.kind}:${e.entree.texte}`);
    };

    const rageLines = captureTurnStart(rageE.id);
    const fearLines = captureTurnStart(fearE.id);
    const rngProbe = battleRng().int(1, 100);

    expect({ rageLines, fearLines, rngProbe }).toMatchInlineSnapshot(`
      {
        "fearLines": [],
        "rageLines": [
          "attaque:Dider Rudlos déclenche Frénésie de test !",
          "attaque:Dider Rudlos tombe sous Frénésie.",
        ],
        "rngProbe": 13,
      }
    `);
  });
});
