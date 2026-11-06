/**
 * UNE SURFACE TIENT LA MAIN → la conversation attend (#1869 correctif 2, condition 1).
 *
 * Une réponse ne se choisit que si la conversation est CE QUE LE JOUEUR A SOUS LES YEUX. Le verdict
 * « une surface tient la main » vit à l'ARBITRE (`surfaceTientLaMain`, `noyau/modalArbiter.ts`),
 * dérivé de ses registres ; `conversationRepond` le consomme, donc le VERBE et les touches
 * `dialogue-choice-N` avec lui.
 *
 * Contrats POSITIFS, un par surface : sous chacune la conversation ne répond pas ; au témoin, elle
 * répond. Les écrans par siège de l'adaptateur (fiche, menu système, codex) et la question du juge jouée par le
 * dispatcher RÉEL des touches se jouent en `src/state/dialogue-surface-tient-la-main.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';
import { conversationRepond } from './dialogue';
import { withActingSeat } from './netOwnership';
import { makeShowcaseParty } from '../data/pregens';
import type { Dialogue } from './monde/scene';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const dlg: Dialogue = {
  id: 'd-surface', start: 'n1',
  nodes: [
    { id: 'n1', desc: '…', choices: [{ id: 'oui', label: 'Oui', next: 'n2' }, { id: 'non', label: 'Non', next: 'n2' }] },
    { id: 'n2', desc: 'Suite', choices: [] },
  ],
} as Dialogue;

/** Le TÉMOIN : écran de jeu, conversation ouverte, aucune surface par-dessus. */
function temoin(over: Partial<Jeu> = {}) {
  banc.setState({
    screen: 'campaign', mode: 'exploration', battle: null, scene: null, flags: {}, journal: [],
    party: makeShowcaseParty(), dialogueHistory: [], merchant: null, tavernGames: null,
    document: null, pendingLoot: null, pendingTest: null, pendingLogQueue: [], pendingOrders: [],
    worldMapOpen: false, port: null, landMarket: null,
    dialogue: { dialogue: dlg, nodeId: 'n1', session: 1 },
    ...over,
  } as Partial<Jeu>);
}

const repond = () => conversationRepond(banc.getState());

describe('conversationRepond — une surface qui tient la main suspend la conversation', () => {
  beforeEach(() => temoin());

  it('témoin : la conversation est à l’écran, elle répond', () => {
    expect(repond()).toBe(true);
  });

  it('marché ouvert : elle attend', () => {
    temoin({ merchant: { entityId: 'forgeron' } as Jeu['merchant'] });
    expect(repond()).toBe(false);
  });

  it('butin (fenêtre hors-modale) : elle attend', () => {
    temoin({ pendingLoot: { title: 'Butin', money: { gold: 0, silver: 1, brass: 0 } } as unknown as Jeu['pendingLoot'] });
    expect(repond()).toBe(false);
  });

  it('jeux de taverne ouverts : elle attend', () => {
    temoin({ tavernGames: { result: null } as Jeu['tavernGames'] });
    expect(repond()).toBe(false);
  });

  it('document ouvert : elle attend', () => {
    temoin({ document: { title: 'Lettre', text: '…', remise: 1 } });
    expect(repond()).toBe(false);
  });

  it('écran plein (écran de groupe) : elle attend', () => {
    temoin({ screen: 'party' });
    expect(repond()).toBe(false);
  });

  it('carte du monde, port, marché de terre (exploration) : elle attend', () => {
    temoin({ worldMapOpen: true });
    expect(repond()).toBe(false);
    temoin({ port: {} as Jeu['port'] });
    expect(repond()).toBe(false);
    temoin({ landMarket: {} as Jeu['landMarket'] });
    expect(repond()).toBe(false);
  });

  it('file de journal ou commande d’interlude en souffrance : aucune surface, elle répond', () => {
    temoin({ pendingLogQueue: [{ line: 'x' }], pendingOrders: [{ heroId: 'h', trappingId: 't' }] });
    expect(repond()).toBe(true);
  });
});

describe('coop — l’écran PAR SIÈGE de l’hôte ne refuse pas la réponse de l’invité qui décide', () => {
  // L'invité (siège 1) tient la décision de groupe ; l'hôte applique son intent DANS SON store.
  // Une surface PARTAGÉE (le document que tous lisent) met la réponse en attente.
  const repondreCommeInvite = (over: Partial<Jeu>) => {
    temoin({ net: { ...banc.getState().net, mode: 'host', mySeat: 0, gmSeat: 1 } as Jeu['net'], ...over });
    withActingSeat(1, () => banc.getState().fenetreChoisir('dialogue', 'reponse', 'oui'));
    return banc.getState().dialogue?.nodeId;
  };

  it('document PARTAGÉ ouvert : la réponse de l’invité attend', () => {
    expect(repondreCommeInvite({ document: { title: 'Lettre', text: '…', remise: 1 } })).toBe('n1');
  });
});

