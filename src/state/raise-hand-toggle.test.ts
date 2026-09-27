/**
 * PAUSE AU PROCHAIN ROUND (`raise-hand`, #1411 P2-A) — INTERRUPTEUR par SIÈGE : la demande est une
 * liste de sièges (`battle.handRaisedBy`), et chacun n'y pose et n'en retire que la SIENNE. Le siège
 * n'est pas un argument : il vient du transport (`decidingSeat`/`withActingSeat`), donc un client ne
 * peut ni signer la demande d'un autre ni la lui retirer. L'état vit dans `battle` : il voyage dans
 * le snapshot, tous les clients le voient — ce que le test de RÉPLICATION ci-dessous mesure sur le
 * sérialiseur réel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { runAction, actionGate } from './actionRegistry';
import { ROUTES, intentAllowedFor, withActingSeat } from './netOwnership';
import { GUEST_INTENTS } from '../net/intents';
import { useGame, type BattleState } from './store';
import { emptyScene } from './scene';
import { createHero } from '../engine/character';
import { findActionById } from '../data/index';
import { serializeMessage, parseMessage } from '../net/protocol';
import type { Combatant } from '../engine/types';

function combat(mode: 'local' | 'host' | 'guest' = 'host') {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 4 });
  h.id = 'h1';
  h.pos = { x: 2, y: 2 };
  useGame.setState({
    party: [h], scene: emptyScene(),
    net: { ...useGame.getState().net, mode, mySeat: mode === 'guest' ? 1 : 0, ownership: { h1: 0 }, seatNames: { 0: 'L’hôte' } },
    battle: {
      combatants: [h], order: ['h1'], baseOrder: ['h1'], turn: 0, round: 3,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null,
    } as unknown as BattleState,
  });
  return h;
}

const battle = () => useGame.getState().battle!;
const mains = () => battle().handRaisedBy ?? [];
const ctx = (): Parameters<typeof actionGate>[1] => ({ active: battle().combatants[0] as Combatant, battle: battle(), netMode: useGame.getState().net.mode });

beforeEach(() => {
  useGame.setState({ battle: null, net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {}, seatNames: {} } });
});

describe('raise-hand — interrupteur, jamais un latch', () => {
  it('l’aller POSE la demande, le retour la RETIRE — par la MÊME entrée de registre', () => {
    combat();
    runAction('raise-hand', useGame.getState);
    expect(mains(), 'la demande n’a pas été posée').toEqual([0]);
    runAction('raise-hand', useGame.getState, { toggleOff: true });
    expect(mains(), 'le retrait n’a rien retiré : la demande reste un latch').toEqual([]);
    // … et l'aller-retour est REJOUABLE (aucun verrou de tour).
    runAction('raise-hand', useGame.getState);
    expect(mains()).toEqual([0]);
  });

  it('le retrait est GRATUIT : il ne dépense ni Action ni Mouvement, et se dit au journal', () => {
    combat();
    runAction('raise-hand', useGame.getState);
    runAction('raise-hand', useGame.getState, { toggleOff: true });
    expect(battle().acted, 'le retrait a dépensé l’Action').toBe(false);
    expect(battle().movementUsed, 'le retrait a dépensé du Mouvement').toBe(0);
    expect(battle().log.length, 'la pose et son retrait se disent tous deux au journal').toBe(2);
    expect(findActionById('raise-hand')!.coutAction).toBe('aucun');
  });

  it('un retrait SANS demande en cours est inerte (aucune ligne de journal fantôme)', () => {
    combat();
    runAction('raise-hand', useGame.getState, { toggleOff: true });
    expect(mains()).toEqual([]);
    expect(battle().log.length).toBe(0);
  });

  it('HORS COOP : le geste est REFUSÉ avec sa raison (le verdict du registre, pas un silence)', () => {
    combat('local');
    const v = actionGate('raise-hand', ctx());
    expect(v.ok).toBe(false);
    expect(v.reason, 'un refus muet ne peut pas s’afficher au point du geste').toBeTruthy();
  });

  it('EN COOP : le geste est offert (témoin du refus ci-dessus)', () => {
    combat('host');
    expect(actionGate('raise-hand', ctx()).ok).toBe(true);
  });
});

describe('raise-hand — la demande porte SON siège (l’annulation gratuite vaut pour SON geste)', () => {
  it('un siège TIERS ne retire pas la main d’un autre ; le sien seul répond', () => {
    combat();
    withActingSeat(1, () => useGame.getState().raiseHand());
    expect(mains(), 'la demande du siège 1 n’est pas enregistrée sous SON siège').toEqual([1]);
    withActingSeat(2, () => useGame.getState().lowerHand());
    expect(mains(), 'le siège 2 a baissé la main du siège 1').toEqual([1]);
    withActingSeat(1, () => useGame.getState().lowerHand());
    expect(mains(), 'le siège 1 n’a pas pu retirer SA demande').toEqual([]);
  });

  it('deux sièges peuvent demander la pause ; le retrait de l’un laisse celle de l’autre', () => {
    combat();
    withActingSeat(1, () => useGame.getState().raiseHand());
    withActingSeat(2, () => useGame.getState().raiseHand());
    expect(mains()).toEqual([1, 2]);
    withActingSeat(1, () => useGame.getState().lowerHand());
    expect(mains(), 'le retrait d’un siège a emporté la demande de l’autre').toEqual([2]);
  });

  it('une demande RÉPÉTÉE du même siège ne s’empile pas (ni doublon, ni 2ᵉ ligne de journal)', () => {
    combat();
    withActingSeat(1, () => useGame.getState().raiseHand());
    withActingSeat(1, () => useGame.getState().raiseHand());
    expect(mains()).toEqual([1]);
    expect(battle().log.length).toBe(1);
  });
});

describe('raise-hand — routage réseau : les DEUX sens voyagent pareil', () => {
  it('`lowerHand` est exposé à l’invité et routé comme `raiseHand` (le siège marque le SIEN)', () => {
    combat();
    for (const verbe of ['raiseHand', 'lowerHand']) {
      expect(GUEST_INTENTS.has(verbe), `${verbe} : jamais atteignable par un invité`).toBe(true);
      expect(ROUTES.has(verbe), `${verbe} : sans route nominative, il retombe sur le repli universel`).toBe(true);
      for (const seat of [0, 1, 2]) {
        expect(intentAllowedFor(useGame.getState(), seat, verbe, []), `${verbe} refusé au siège ${seat}`).toBe(true);
      }
    }
  });

  it('le verbe existe bien au store (une allowlist qui nomme un verbe absent ne route rien)', () => {
    const store = useGame.getState() as unknown as Record<string, unknown>;
    for (const verbe of ['raiseHand', 'lowerHand']) expect(typeof store[verbe], verbe).toBe('function');
  });

  it('les verbes sont NULLAIRES : le siège vient du transport, aucun argument à falsifier', () => {
    const store = useGame.getState() as unknown as Record<string, () => void>;
    expect(store.raiseHand.length, 'un paramètre de siège serait signable par n’importe quel client').toBe(0);
    expect(store.lowerHand.length).toBe(0);
  });

  it('l’état est RÉPLIQUÉ : `handRaisedBy` survit à la sérialisation du snapshot d’hôte', () => {
    combat();
    withActingSeat(1, () => useGame.getState().raiseHand());
    const msg = parseMessage(serializeMessage({ kind: 'snapshot', data: { battle: useGame.getState().battle } as never }));
    const recu = (msg as { kind: 'snapshot'; data: { battle: BattleState } }).data.battle;
    expect(recu.handRaisedBy, 'la demande d’un client resterait invisible aux autres').toEqual([1]);
  });
});
