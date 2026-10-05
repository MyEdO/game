/**
 * Câblage de la variante « Fuite ! » d'Aux Armes (AA 13 l.68) dans la POURSUITE terrestre (LDB 15
 * l.104-108) : la Cible d'une Poursuite qui porte le Talent compte un Mouvement augmenté de 1, ce qui
 * lui donne un DR de vitesse supplémentaire sur le plus lent de la course — donc une Distance qui varie
 * d'autant à la clôture de la manche. La preuve se mesure sur le chemin RÉEL (la clôture de manche du
 * socle de séquence, `closeSequenceRound`, le même que le jeu emprunte), à jets FIGÉS des deux côtés : seule la règle optionnelle change.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { pursuedMovement, pursuitOf, PURSUIT_POLICY_DEFAUT } from './pursuitFlow';
import { closeSequenceRound, type MancheClose } from './sequenceCore';
import { setRule, resetRule } from '../engine/policy';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

const RULE = 'combat-aa-avantage-groupe';

/** Un héros unique, porteur (ou non) de Fuite !, de Mouvement fixé à 4 comme l'adversaire. */
function hero(withTalent: boolean): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Alix', seed: 1 });
  h.movement = 4;
  h.talents = withTalent ? [{ talentId: 'fuite', times: 1 }] : [];
  h.items = [];
  useGame.setState({ party: [h] });
  return h;
}

/** Manche FIGÉE (la BANDE de la manche, une rangée) : le héros a roulé `sl`, l'adversaire roulera au
 *  RNG semé (identique d'un run à l'autre). */
function doneRound(h: Combatant, sl: number): MancheClose {
  const participants: CascadeStep[] = [{
    id: 'pursuit-1', kind: 'pursuitMove', label: fixtureText('Manche 1 — Athlétisme'), aggregate: 'none',
    participants: [{
      id: h.id, label: 'Athlétisme', base: 40, target: 40, interactive: true,
      result: { roll: 40, target: 40, sl, success: sl >= 0 },
    }],
  }];
  return { participants };
}

/** Distance obtenue au bout d'une manche, groupe POURSUIVI, héros et adversaire à Mouvement 4. */
function distanceAfterRound(h: Combatant, partyRole: 'fleeing' | 'pursuing'): number {
  useGame.getState().seedRng(7);
  useGame.setState({
    sequence: {
      def: 'pursuit', round: 1, cum: {}, params: { score: { fleeing: 'min', pursuers: 'max' } },
      payload: {
        partyRole, distance: 5, escapeAt: 10, skill: 'athletisme', policy: { ...PURSUIT_POLICY_DEFAUT },
        foes: [{ id: 'foe-1', label: 'Bandit', movement: 4, skill: 40 }], manche: 1, phase: 'course', retires: [],
      },
    },
  });
  closeSequenceRound(useGame.getState, useGame.setState, doneRound(h, 0));
  return pursuitOf(useGame.getState())?.distance ?? 0;
}

describe('Fuite ! — Cible d’une Poursuite (variante AA 13 l.68)', () => {
  beforeEach(() => useGame.setState({ battle: null, party: [], journal: [], pendingCascade: null, sequence: null }));
  afterEach(() => resetRule(RULE));

  it('pursuedMovement : le porteur gagne +1 M comme POURSUIVI sous la règle, jamais comme poursuivant', () => {
    const h = hero(true);
    expect(pursuedMovement(h, 'fleeing')).toBe(4);
    setRule(RULE, true);
    expect(pursuedMovement(h, 'fleeing')).toBe(5);
    expect(pursuedMovement(h, 'pursuing')).toBe(4); // la variante ne parle que de la CIBLE d'une Poursuite
  });

  it('pursuedMovement : sans le Talent, la règle ne change rien', () => {
    const h = hero(false);
    expect(pursuedMovement(h, 'fleeing')).toBe(4);
    setRule(RULE, true);
    expect(pursuedMovement(h, 'fleeing')).toBe(4);
  });

  it('MANCHE RÉELLE : à jets identiques, le porteur poursuivi creuse d’exactement 1 de plus sous la règle', () => {
    const h = hero(true);
    const off = distanceAfterRound(h, 'fleeing');
    setRule(RULE, true);
    expect(distanceAfterRound(h, 'fleeing')).toBe(off + 1); // le DR de vitesse de la Cible (LDB 15 l.104-108)
  });

  it('MANCHE RÉELLE : sans le Talent, la même manche donne la même Distance dans les deux modes', () => {
    const h = hero(false);
    const off = distanceAfterRound(h, 'fleeing');
    setRule(RULE, true);
    expect(distanceAfterRound(h, 'fleeing')).toBe(off);
  });

  it('MANCHE RÉELLE : le groupe POURSUIVANT ne tire aucun bonus de la variante', () => {
    const h = hero(true);
    const off = distanceAfterRound(h, 'pursuing');
    setRule(RULE, true);
    expect(distanceAfterRound(h, 'pursuing')).toBe(off);
  });
});
