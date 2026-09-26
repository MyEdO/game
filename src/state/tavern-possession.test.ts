/**
 * #1279 S1 — POSSESSION d'une partie de taverne HÉROS contre HÉROS. Les acquis #1262 couvraient
 * héros-contre-monde ; la taverne, elle, roulait l'adversaire HÉROS côté monde et le FIGEAIT
 * (`meta.opposed.aT`) : le second héros n'avait jamais de jet à jouer, quel que soit le siège qui le
 * tenait. L'invariant posé ici : tout jeu qui oppose deux héros ouvre sa manche en BANDE, une rangée
 * par camp, chacune à jouer par le siège qui possède son porteur (patron `pursuitFlow`, LDB 15 l.92).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns } from './netOwnership';
import type { Combatant } from '../engine/types';

const g = useGame.getState;
const NET0 = useGame.getState().net;

/** Deux héros, l'un à l'hôte (siège 0), l'autre à l'invité (siège 1). */
function deuxSieges(): [Combatant, Combatant] {
  const [a, b] = makePregens().slice(0, 2) as [Combatant, Combatant];
  useGame.setState({ battle: null, party: [a, b], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
  useGame.setState({ net: { ...NET0, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership: { [b.id]: 1 } } } as never);
  return [a, b];
}

beforeEach(() => {
  seedBattleRng(3);
  useGame.setState({ battle: null, pendingCascade: null, sequence: null } as never);
});
afterEach(() => {
  useGame.setState({ net: NET0, battle: null, pendingCascade: null, sequence: null } as never);
});

describe('#1279 S1 — la manche héros-vs-héros appartient AUX DEUX sièges', () => {
  it('Bras de fer : une BANDE de deux rangées À JOUER, une fenêtre PARTAGÉE', () => {
    const [a, b] = deuxSieges();
    g().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });

    const step = g().pendingCascade!.participants[0];
    expect(step.kind).toBe('tavern-round');
    expect(step.participants!.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    const sien = step.participants!.find((r) => r.id === b.id)!;
    expect(sien.interactive, 'la rangée de l’invité est À JOUER').toBe(true);
    expect(sien.result, 'et rien n’a été roulé à sa place').toBeNull();
    expect(sien.target, 'sa cible est calculée : ce n’est pas un affichage validé d’office').toBeGreaterThan(0);
    expect(step.meta?.opposed, 'plus aucun jet adverse figé côté monde').toBeUndefined();
    expect(step.groupOwner, 'deux porteurs de sièges différents : la fenêtre est partagée').toBe(true);
    expect(modalOwnerOf(g()), 'owner « * » — chaque siège voit la fenêtre où se tient SA rangée').toBe('*');
    expect(seatOwns(g(), 1, b.id), 'la rangée de l’invité est à l’invité').toBe(true);
    expect(seatOwns(g(), 0, b.id), 'et plus à l’hôte').toBe(false);
    expect(seatOwns(g(), 0, a.id), 'le challenger reste à l’hôte').toBe(true);
  });

  it('contre la SALLE (adversaire abstrait), la manche reste MONO : un seul porteur, un seul siège', () => {
    const [a] = deuxSieges();
    g().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });

    const step = g().pendingCascade!.participants[0];
    expect(step.participants, 'aucune bande : personne d’autre ne joue').toBeUndefined();
    expect(step.actorId).toBe(a.id);
    expect(step.meta?.opposed?.aT, 'la salle roule côté monde, figée avant le jet du joueur (#579)').toBeTruthy();
    expect(modalOwnerOf(g())).toBe(a.id);
  });
});
