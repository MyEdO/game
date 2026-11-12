/**
 * La poignée d'un flux multi lit le refus de SA rangée (`refusDuSlot`, `makeRollFlow`, `rollFlowFactory.ts`) : contrat
 * déclaré, le texte que tout verbe du slot `pid` dit en se refusant (`spec.multi.refusDuSlot`), `null` s'il se joue ou
 * sans `pid`. Témoin : le Contre-sort (LDB 46 l.156), dont la rangée se refuse une fois le sort dissipé par un autre.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { FLOWS } from './rollFlowSpecs';
import type { Jeu } from './etat';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('refusDuSlot — le refus de la rangée, lu par la poignée du flux', () => {
  function setup() {
    const mk = (name: string, seed: number) => {
      const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: name, careerTalent: { id: 'magie-mineure' }, seed });
      h.resilience = 2; h.fortune = 2; h.corruption = 0;
      return h;
    };
    banc.setState({ party: [mk('Anna', 707), mk('Bert', 101)] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const [A, B] = b.combatants.filter((c) => c.kind === 'heros') as Combatant[];
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    [A, B].forEach((h, i) => { h.pos = { x: 10, y: 10 + i }; h.wounds = blessuresDeBase(99, 99, h); h.fortune = 2; h.resilience = 2; });
    E.pos = { x: 12, y: 10 };
    banc.setState({
      battle: { ...b },
      pendingCast: {
        casterId: E.id, targetId: A.id, spellId: 'carreau', missile: true, focused: false, counterspellRouted: true,
        result: { cast: true, roll: 20, target: 50, sl: 3, isCritical: false, isFumble: false, log: '' },
      },
    } as unknown as Partial<Jeu>);
    return { A, B };
  }
  const DISSIPE = { dispelled: true, counter: { roll: 5, target: 60, sl: 4, success: true, isDouble: false }, casterNetSL: -1, log: 'dissipé' };
  /** Réussite à DR égal à l'incantation : non dissipé, +1 DR le ferait basculer. */
  const PRESQUE = { dispelled: false, counter: { roll: 30, target: 60, sl: 3, success: true, isDouble: false }, casterNetSL: 0, log: 'presque' };
  const RATE = { dispelled: false, counter: { roll: 95, target: 60, sl: -4, success: false, isDouble: false }, casterNetSL: 7, log: 'raté' };
  const poser = (parts: unknown[]) => banc.setState({ pendingCounterspell: { participants: parts } } as unknown as Partial<Jeu>);

  it('la rangée encore à jouer après la dissipation par un AUTRE porte son refus ; celle qui a dissipé n’en porte aucun', () => {
    const { A, B } = setup();
    poser([{ id: A.id, interactive: true, declared: 'solo', result: PRESQUE }, { id: B.id, interactive: true, declared: 'solo', result: DISSIPE }]);
    expect(FLOWS.contreSort.refusDuSlot(banc.getState, A.id)).toBe('Déjà dissipé par Bert');
    expect(FLOWS.contreSort.refusDuSlot(banc.getState, B.id)).toBeNull();
    expect(FLOWS.contreSort.refusDuSlot(banc.getState), 'sans rangée visée, aucun refus').toBeNull();
  });

  it('avant toute dissipation, aucune rangée ne se refuse', () => {
    const { A, B } = setup();
    poser([{ id: A.id, interactive: true, declared: 'solo', result: null }, { id: B.id, interactive: true, declared: 'solo', result: RATE }]);
    expect(FLOWS.contreSort.refusDuSlot(banc.getState, A.id)).toBeNull();
    expect(FLOWS.contreSort.refusDuSlot(banc.getState, B.id)).toBeNull();
  });
});
