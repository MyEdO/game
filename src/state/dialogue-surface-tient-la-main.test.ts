/**
 * UNE SURFACE TIENT LA MAIN → la conversation attend (#1869 correctif 2, condition 1).
 *
 * Une réponse ne se choisit que si la conversation est CE QUE LE JOUEUR A SOUS LES YEUX. Le verdict
 * « une surface tient la main » vit à l'ARBITRE (`surfaceTientLaMain`, `state/modalArbiter.ts`),
 * dérivé de ses registres ; `conversationRepond` le consomme, donc le VERBE et les touches
 * `dialogue-choice-N` avec lui.
 *
 * Contrats POSITIFS, un par surface : sous chacune la conversation ne répond pas ; au témoin, elle
 * répond. Puis la question du juge, jouée par le store et le dispatcher RÉEL des touches
 * (`runBindingById`) sur la donnée committée : une réponse qui ouvre une fenêtre en RESTANT au nœud.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useGame } from './store';
import type { GameState } from './store';
import { conversationRepond, ouvrirDialogue } from './dialogue';
import { runBindingById } from './keybindings';
import { withActingSeat } from './netOwnership';
import { parseProject } from './worldMap';
import { makeShowcaseParty } from '../data/pregens';
import type { Dialogue, Scene } from './scene';

const dlg: Dialogue = {
  id: 'd-surface', start: 'n1',
  nodes: [
    { id: 'n1', desc: '…', choices: [{ label: 'Oui', next: 'n2' }, { label: 'Non', next: 'n2' }] },
    { id: 'n2', desc: 'Suite', choices: [] },
  ],
} as Dialogue;

/** Le TÉMOIN : écran de jeu, conversation ouverte, aucune surface par-dessus. */
function temoin(over: Partial<GameState> = {}) {
  useGame.setState({
    screen: 'campaign', mode: 'exploration', battle: null, scene: null, flags: {}, journal: [],
    party: makeShowcaseParty(), dialogueHistory: [], merchant: null, tavernGames: null,
    document: null, pendingLoot: null, pendingTest: null, pendingLogQueue: [], pendingOrders: [],
    gameMenuOpen: false, codexOverlay: null, sheetId: null, worldMapOpen: false, port: null, landMarket: null,
    dialogue: { dialogue: dlg, nodeId: 'n1', session: 1 },
    ...over,
  } as Partial<GameState>);
}

const repond = () => conversationRepond(useGame.getState());

describe('conversationRepond — une surface qui tient la main suspend la conversation', () => {
  beforeEach(() => temoin());

  it('témoin : la conversation est à l’écran, elle répond', () => {
    expect(repond()).toBe(true);
  });

  it('marché ouvert : elle attend', () => {
    temoin({ merchant: { entityId: 'forgeron' } as GameState['merchant'] });
    expect(repond()).toBe(false);
  });

  it('butin (fenêtre hors-modale) : elle attend', () => {
    temoin({ pendingLoot: { title: 'Butin', money: { gold: 0, silver: 1, brass: 0 } } as unknown as GameState['pendingLoot'] });
    expect(repond()).toBe(false);
  });

  it('jeux de taverne ouverts : elle attend', () => {
    temoin({ tavernGames: { result: null } as GameState['tavernGames'] });
    expect(repond()).toBe(false);
  });

  it('document ouvert : elle attend', () => {
    temoin({ document: { title: 'Lettre', text: '…' } });
    expect(repond()).toBe(false);
  });

  it('écran plein (écran de groupe) : elle attend', () => {
    temoin({ screen: 'party' });
    expect(repond()).toBe(false);
  });

  it('carte du monde, port, marché de terre (exploration) : elle attend', () => {
    temoin({ worldMapOpen: true });
    expect(repond()).toBe(false);
    temoin({ port: {} as GameState['port'] });
    expect(repond()).toBe(false);
    temoin({ landMarket: {} as GameState['landMarket'] });
    expect(repond()).toBe(false);
  });

  it('file de journal ou commande d’interlude en souffrance : aucune surface, elle répond', () => {
    temoin({ pendingLogQueue: [{ line: 'x' }], pendingOrders: [{ heroId: 'h', trappingId: 't' }] });
    expect(repond()).toBe(true);
  });
});

describe('coop — l’écran PAR SIÈGE de l’hôte ne refuse pas la réponse de l’invité qui décide', () => {
  // L'invité (siège 1) tient la décision de groupe ; l'hôte applique son intent DANS SON store.
  // Une surface par siège de l'hôte (fiche, menu système, codex) est SON écran : elle ne lit pas le
  // verbe. Une surface PARTAGÉE (le document que tous lisent) met la réponse en attente.
  const repondreCommeInvite = (over: Partial<GameState>) => {
    temoin({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: 1 } as GameState['net'], ...over });
    withActingSeat(1, () => useGame.getState().chooseDialogue(0));
    return useGame.getState().dialogue?.nodeId;
  };

  it('fiche, menu système, codex ouverts chez l’hôte : la réponse de l’invité part', () => {
    expect(repondreCommeInvite({ sheetId: 'h1' })).toBe('n2');
    expect(repondreCommeInvite({ gameMenuOpen: true })).toBe('n2');
    expect(repondreCommeInvite({ codexOverlay: { key: 'skills', id: 'intuition' } as unknown as GameState['codexOverlay'] })).toBe('n2');
  });

  it('document PARTAGÉ ouvert : la réponse de l’invité attend', () => {
    expect(repondreCommeInvite({ document: { title: 'Lettre', text: '…' } })).toBe('n1');
  });
});

describe('dlg-kramer-nuit-du-chat — la touche 2 sous le document que la réponse vient d’ouvrir', () => {
  // Donnée COMMITTÉE : la réponse 1 jette un Test, chaque branche ouvre un `document`, et la
  // conversation revient à SON nœud (`next: nc1`) — derrière le document. La réponse 2 la clôt.
  const doc = parseProject(JSON.parse(readFileSync(join(__dirname, '../scenes/loup-et-saumure/loup-et-saumure-projet.json'), 'utf8')));
  const quai = (doc.scenes as Scene[]).find((s) => s.dialogues.some((d) => d.id === 'dlg-kramer-nuit-du-chat'))!;
  const nuitDuChat = quai.dialogues.find((d) => d.id === 'dlg-kramer-nuit-du-chat')!;

  it('Test → document ouvert → touche 2 inerte → document fermé → touche 2 joue', () => {
    useGame.getState().loadProject(doc.scenes as Scene[], quai.id, doc.worldMap, doc.narratif);
    temoin({ scene: quai, document: null, dialogue: ouvrirDialogue({ dialogueHistory: [] }, nuitDuChat) });
    const get = useGame.getState;

    runBindingById('dialogue-choice-1', get); // « L’interroger sur sa nuit »
    expect(get().pendingTest, 'la réponse ouvre la fenêtre de jet').toBeTruthy();
    useGame.setState({ pendingTest: { ...get().pendingTest!, roll: 99, success: false } });
    get().resolveTest();
    expect(get().document, 'la branche ouvre le document').toBeTruthy();
    expect(get().dialogue?.nodeId, 'la conversation revient à son nœud, derrière le document').toBe('nc1');
    expect(get().dialogueHistory).toHaveLength(1);

    runBindingById('dialogue-choice-2', get); // le joueur tape 2 en lisant le document
    expect(get().dialogue?.nodeId, 'sous le document, la touche ne répond pas').toBe('nc1');
    expect(get().dialogueHistory).toHaveLength(1);

    get().closeDocument();
    runBindingById('dialogue-choice-2', get); // « La laisser tranquille »
    expect(get().dialogueHistory, 'document fermé : la réponse 2 se joue').toHaveLength(2);
    expect(get().dialogue).toBeNull();
  });
});
