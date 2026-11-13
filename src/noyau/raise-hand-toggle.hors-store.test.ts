/**
 * PAUSE AU PROCHAIN ROUND (`pause`, #1411 P2-A) — INTERRUPTEUR par SIÈGE : la demande est une
 * liste de sièges (`battle.handRaisedBy`), et chacun n'y pose et n'en retire que la SIENNE. Le siège
 * n'est pas un argument : il vient du transport (`decidingSeat`/`withActingSeat`), donc un client ne
 * peut ni signer la demande d'un autre ni la lui retirer. L'état vit dans `battle` : il voyage dans
 * le snapshot, tous les clients le voient — ce que le test de RÉPLICATION ci-dessous mesure sur le
 * sérialiseur réel.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { actionGate } from './actionRegistry';
import { ROUTES, intentAllowedFor, withActingSeat } from './netOwnership';
import { GUEST_INTENTS } from './intentionsDeSiege';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { emptyScene } from './monde/scene';
import { createHero } from '../engine/character';
import { findActionById } from '../data/index';
import { serializeMessage, parseMessage } from '../hote/coop/protocol';
import type { Combatant } from '../engine/types';

function combat(mode: 'local' | 'hote' | 'invite' = 'hote') {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 4 });
  h.id = 'h1';
  h.pos = { x: 2, y: 2 };
  banc.setState({
    party: [h], scene: emptyScene('scene-test'), screen: 'campaign',
    net: { ...banc.getState().net, mode, mySeat: mode === 'invite' ? 1 : 0, ownership: { h1: 0 }, seatNames: { 0: 'L’hôte' } },
    battle: {
      combatants: [h], order: ['h1'], baseOrder: ['h1'], turn: 0, round: 3,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null,
    } as unknown as BattleState,
  });
  return h;
}

const battle = () => banc.getState().battle!;
const mains = () => battle().handRaisedBy ?? [];
const ctx = (): Parameters<typeof actionGate>[1] => ({ scene: banc.getState().scene, active: battle().combatants[0] as Combatant, battle: battle(), netMode: banc.getState().net.mode, gameTime: banc.getState().gameTime });

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('pause — interrupteur, jamais un latch', () => {
  it('l’aller POSE la demande, le retour la RETIRE — par la MÊME entrée de registre', () => {
    combat();
    banc.jouerLaCase('pause');
    expect(mains(), 'la demande n’a pas été posée').toEqual([0]);
    banc.jouerLaCase('pause');
    expect(mains(), 'le retrait n’a rien retiré : la demande reste un latch').toEqual([]);
    // … et l'aller-retour est REJOUABLE (aucun verrou de tour).
    banc.jouerLaCase('pause');
    expect(mains()).toEqual([0]);
  });

  it('le retrait est GRATUIT : il ne dépense ni Action ni Mouvement, et se dit au journal', () => {
    combat();
    banc.jouerLaCase('pause');
    banc.jouerLaCase('pause');
    expect(battle().acted, 'le retrait a dépensé l’Action').toBe(false);
    expect(battle().movementUsed, 'le retrait a dépensé du Mouvement').toBe(0);
    expect(battle().log.length, 'la pose et son retrait se disent tous deux au journal').toBe(2);
    expect(findActionById('pause')!.coutAction).toBe('aucun');
  });

  it('un retrait SANS demande en cours est inerte (aucune ligne de journal fantôme)', () => {
    combat();
    banc.getState().leverLaMain(false);
    expect(mains()).toEqual([]);
    expect(battle().log.length).toBe(0);
  });

  it('HORS COOP : le geste est REFUSÉ avec sa raison (le verdict du registre, pas un silence)', () => {
    combat('local');
    const v = actionGate('pause', ctx());
    expect(v.ok).toBe(false);
    expect(v.reason, 'un refus muet ne peut pas s’afficher au point du geste').toBeTruthy();
    banc.jouerLaCase('pause');
    expect(mains(), 'l’offre refusée a levé la main').toEqual([]);
    expect(banc.getState().refus?.texte, 'l’offre refusée ne dit pas la raison de son gate').toBe(v.reason);
  });

  it('EN COOP : le geste est offert (témoin du refus ci-dessus)', () => {
    combat('hote');
    expect(actionGate('pause', ctx()).ok).toBe(true);
  });
});

describe('pause — la demande porte SON siège (l’annulation gratuite vaut pour SON geste)', () => {
  it('un siège TIERS ne retire pas la main d’un autre ; le sien seul répond', () => {
    combat();
    withActingSeat(1, () => banc.getState().leverLaMain(true));
    expect(mains(), 'la demande du siège 1 n’est pas enregistrée sous SON siège').toEqual([1]);
    withActingSeat(2, () => banc.getState().leverLaMain(false));
    expect(mains(), 'le siège 2 a baissé la main du siège 1').toEqual([1]);
    withActingSeat(1, () => banc.getState().leverLaMain(false));
    expect(mains(), 'le siège 1 n’a pas pu retirer SA demande').toEqual([]);
  });

  it('deux sièges peuvent demander la pause ; le retrait de l’un laisse celle de l’autre', () => {
    combat();
    withActingSeat(1, () => banc.getState().leverLaMain(true));
    withActingSeat(2, () => banc.getState().leverLaMain(true));
    expect(mains()).toEqual([1, 2]);
    withActingSeat(1, () => banc.getState().leverLaMain(false));
    expect(mains(), 'le retrait d’un siège a emporté la demande de l’autre').toEqual([2]);
  });

  it('une demande RÉPÉTÉE du même siège ne s’empile pas (ni doublon, ni 2ᵉ ligne de journal)', () => {
    combat();
    withActingSeat(1, () => banc.getState().leverLaMain(true));
    withActingSeat(1, () => banc.getState().leverLaMain(true));
    expect(mains()).toEqual([1]);
    expect(battle().log.length).toBe(1);
  });
});

describe('pause — routage réseau : les DEUX sens voyagent par le MÊME verbe', () => {
  it('`leverLaMain` est exposé à l’invité et routé nominativement, dans les deux sens (le siège marque le SIEN)', () => {
    combat();
    expect(GUEST_INTENTS.has('leverLaMain'), 'jamais atteignable par un invité').toBe(true);
    expect(ROUTES.has('leverLaMain'), 'sans route nominative, il retombe sur le repli universel').toBe(true);
    for (const levee of [true, false]) {
      for (const seat of [0, 1, 2]) {
        expect(intentAllowedFor(banc.getState(), seat, 'leverLaMain', [levee]), `levée ${levee} refusée au siège ${seat}`).toBe(true);
      }
    }
  });

  it('le seul argument est le SENS : le siège vient du transport, aucun argument de siège à falsifier', () => {
    expect(banc.getState().leverLaMain.length, 'un paramètre de siège serait signable par n’importe quel client').toBe(1);
  });

  it('l’état est RÉPLIQUÉ : `handRaisedBy` survit à la sérialisation du snapshot d’hôte', () => {
    combat();
    withActingSeat(1, () => banc.getState().leverLaMain(true));
    const msg = parseMessage(serializeMessage({ kind: 'snapshot', data: { battle: banc.getState().battle } as never }));
    const recu = (msg as { kind: 'snapshot'; data: { battle: BattleState } }).data.battle;
    expect(recu.handRaisedBy, 'la demande d’un client resterait invisible aux autres').toEqual([1]);
  });
});
