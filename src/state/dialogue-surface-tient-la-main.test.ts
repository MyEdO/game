/**
 * UNE SURFACE TIENT LA MAIN → la conversation attend (#1869 correctif 2, condition 1), côté web : un écran PAR SIÈGE
 * de l'adaptateur (fiche, menu système, codex) ne refuse pas la réponse de l'invité qui décide, et la question du juge,
 * jouée par le store et le dispatcher RÉEL des touches (`runBindingById`) sur la donnée committée : une réponse qui
 * ouvre une fenêtre en RESTANT au nœud. Le verdict par surface se joue au banc du noyau
 * (`src/noyau/dialogue-surface-tient-la-main.hors-store.test.ts`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import type { GameState } from './store';
import { ouvrirDialogue } from '../noyau/dialogue';
import { runBindingById } from './clavier/keybindings';
import { withActingSeat } from '../noyau/netOwnership';
import { parseProject } from '../noyau/worldMap';
import { groupeVitrineDeScenario } from '../scenes/test-scenarios/_heros';
import type { Dialogue, Scene } from '../noyau/monde/scene';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { builtinCampaigns, campagneDuJeu, lancerCampagne } from '../scenes/campaign';

const dlg: Dialogue = {
  id: 'd-surface', start: { id: 'n1' },
  nodes: [
    { id: 'n1', desc: '…', choices: [{ id: 'oui', label: 'Oui', next: { id: 'n2' } }, { id: 'non', label: 'Non', next: { id: 'n2' } }] },
    { id: 'n2', desc: 'Suite', choices: [] },
  ],
} as Dialogue;

/** Le TÉMOIN : écran de jeu, conversation ouverte, aucune surface par-dessus. */
function temoin(over: Partial<GameState> = {}) {
  useGame.setState({
    screen: 'campaign', mode: 'exploration', battle: null, scene: null, flags: {}, journal: [],
    party: groupeVitrineDeScenario(idsDeTest), dialogueHistory: [], merchant: null, tavernGames: null,
    document: null, pendingLoot: null, pendingTest: null, pendingLogQueue: [], pendingOrders: [],
    gameMenuOpen: false, codexOverlay: null, sheetId: null, worldMapOpen: false, port: null, landMarket: null,
    dialogue: { dialogue: dlg, nodeId: 'n1', session: 1 },
    ...over,
  } as Partial<GameState>);
}

describe('coop — l’écran PAR SIÈGE de l’hôte ne refuse pas la réponse de l’invité qui décide', () => {
  // L'invité (siège 1) tient la décision de groupe ; l'hôte applique son intent DANS SON store.
  // Une surface par siège de l'hôte (fiche, menu système, codex) est SON écran : elle ne lit pas le
  // verbe. Une surface PARTAGÉE (le document que tous lisent) met la réponse en attente.
  const repondreCommeInvite = (over: Partial<GameState>) => {
    temoin({ net: { ...useGame.getState().net, mode: 'hote', mySeat: 0, gmSeat: 1 } as GameState['net'], ...over });
    withActingSeat(1, () => useGame.getState().fenetreChoisir('dialogue', 'reponse', 'oui'));
    return useGame.getState().dialogue?.nodeId;
  };

  it('fiche, menu système, codex ouverts chez l’hôte : la réponse de l’invité part', () => {
    expect(repondreCommeInvite({ sheetId: 'h1' })).toBe('n2');
    expect(repondreCommeInvite({ gameMenuOpen: true })).toBe('n2');
    expect(repondreCommeInvite({ codexOverlay: { key: 'skills', id: 'intuition' } as unknown as GameState['codexOverlay'] })).toBe('n2');
  });
});

describe('dlg-kramer-nuit-du-chat — la touche 2 sous le document que la réponse vient d’ouvrir', () => {
  // Donnée COMMITTÉE : la réponse 1 jette un Test, chaque branche ouvre un `document`, et la
  // conversation revient à SON nœud (`next: nc1`) — derrière le document. La réponse 2 la clôt.
  const doc = parseProject(lireProjetLivre('loup-et-saumure/loup-et-saumure-projet.json'));
  const quai = (doc.scenes as Scene[]).find((s) => s.dialogues.some((d) => d.id === 'dlg-kramer-nuit-du-chat'))!;
  const nuitDuChat = quai.dialogues.find((d) => d.id === 'dlg-kramer-nuit-du-chat')!;

  it('Test → document ouvert → touche 2 inerte → document fermé → touche 2 joue', () => {
    useGame.setState({ party: groupeVitrineDeScenario(idsDeTest) });
    expect(lancerCampagne(useGame.getState, campagneDuJeu(builtinCampaigns.find((c) => c.id === 'loup-et-saumure')!), quai.id)).toBeNull();
    temoin({ scene: quai, document: null, dialogue: ouvrirDialogue({ dialogueHistory: [] }, nuitDuChat) });
    const get = useGame.getState;

    runBindingById('dialogue-reponse-1', get); // « L’interroger sur sa nuit »
    expect(get().pendingTest, 'la réponse ouvre la fenêtre de jet').toBeTruthy();
    useGame.setState({ pendingTest: { ...get().pendingTest!, roll: 99, success: false } });
    get().jetValider('test');
    expect(get().document, 'la branche ouvre le document').toBeTruthy();
    expect(get().dialogue?.nodeId, 'la conversation revient à son nœud, derrière le document').toBe('nc1');
    expect(get().dialogueHistory).toHaveLength(1);

    runBindingById('dialogue-reponse-2', get); // le joueur tape 2 en lisant le document
    expect(get().dialogue?.nodeId, 'sous le document, la touche ne répond pas').toBe('nc1');
    expect(get().dialogueHistory).toHaveLength(1);

    get().fenetreFermer('document');
    runBindingById('dialogue-reponse-2', get); // « La laisser tranquille »
    expect(get().dialogueHistory, 'document fermé : la réponse 2 se joue').toHaveLength(2);
    expect(get().dialogue).toBeNull();
  });
});
