import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { footprintN, occupiesTile, footprintsOverlap } from './monde/footprint';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Téléportation (sort « Téléportation », LDB 47) : comme TOUT autre atterrissage (Marche, Charge,
 * moveAttack, Course, IA), un combattant d'empreinte > 1 qui se pose dégage de sous son empreinte
 * les créatures de Taille STRICTEMENT inférieure (`displaceSmaller`, LDB 85 l.373-374). Régression :
 * le handler de téléportation oubliait cet appel → co-occupation possible d'un grand et d'un petit.
 */
describe('téléportation — un grand qui se téléporte dégage les plus petits (LDB 85 l.373-374)', () => {
  beforeEach(() => {
    banc.setState({ battle: null });
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    return { H, enemies };
  }

  it('battleClickTile en mode teleport : H 2×2 atterrit et déplace l\'ennemi petit de sous son empreinte', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // un seul ennemi actif

    H.size = 'grande'; // empreinte 2×2
    H.pos = { x: 6, y: 10 };
    E.size = 'petite';
    E.pos = { x: 9, y: 10 }; // sera SOUS le 2×2 de H après téléport en (8,10) : {8,10}/{9,10}/{8,11}/{9,11}

    const b = banc.getState().battle!;
    banc.setState({
      battle: { ...b, turn: b.order.indexOf(H.id), action: 'teleport', reachable: new Map([['8,10', 0]]) },
    });

    banc.getState().battleClickTile({ x: 8, y: 10 });

    const after = banc.getState().battle!.combatants;
    const Ha = after.find((c) => c.id === H.id)!;
    const Ea = after.find((c) => c.id === E.id)!;

    expect(Ha.pos).toEqual({ x: 8, y: 10 }); // H a bien atterri
    expect(Ea.pos).not.toEqual({ x: 9, y: 10 }); // E a été DÉPLACÉ (n'est plus sous l'empreinte)
    expect(occupiesTile(Ha.pos!, footprintN(Ha), Ea.pos!.x, Ea.pos!.y)).toBe(false); // hors empreinte de H

    // Invariant global : aucune paire de combattants VIVANTS ne partage de case.
    const live = after.filter((c) => !c.dead && c.pos);
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++)
        expect(footprintsOverlap(live[i].pos!, footprintN(live[i]), live[j].pos!, footprintN(live[j]))).toBe(false);
  });
});
