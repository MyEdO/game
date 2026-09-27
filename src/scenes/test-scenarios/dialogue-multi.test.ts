/**
 * Scénario « Dialogue multi-interlocuteurs » — la REPRISE vit dans le dialogue de l'entité (#1869).
 *
 * Gustav ouvre toujours `dlg-tablee` (`dialogueId` fixe) : le 2ᵉ passage se distingue par le `when`
 * de ses réponses. Contrats POSITIFS, un par passage, joués par le store et le dispatcher RÉEL des
 * touches : le numéro est le RANG de la liste visible, la réponse masquée n'en consomme pas. Le 2ᵉ
 * passage naît de la FIN RÉELLE du 1ᵉʳ (le flag que la donnée pose), jamais d'un flag injecté.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { ouvrirDialogue, reponsesDuNoeud } from '../../state/dialogue';
import { runBindingById } from '../../state/keybindings';
import { scenario } from './dialogue-multi';

const tablee = scenario.scene.dialogues.find((d) => d.id === 'dlg-tablee')!;
const get = useGame.getState;

/** Ouvre `dlg-tablee` sur Gustav, avec les flags DU STORE (ceux que la partie a posés). */
function parlerAGustav() {
  useGame.setState({ dialogue: ouvrirDialogue(get(), tablee, 'gustav') });
}

/** Le 1ᵉʳ passage joué jusqu'au bout, à la touche 1, puis Gustav de nouveau abordé. */
function secondPassage() {
  for (const noeud of ['a1', 'a2', 'a3', 'a4']) {
    expect(get().dialogue?.nodeId).toBe(noeud);
    runBindingById('dialogue-choice-1', get);
  }
  expect(get().dialogue, 'le 1ᵉʳ passage s’est clos').toBeNull();
  parlerAGustav();
}

describe('dialogue-multi — la reprise par `when` dans le dialogue de Gustav', () => {
  beforeEach(() => {
    useGame.setState({
      screen: 'campaign', mode: 'exploration', battle: null, scene: scenario.scene, flags: {},
      party: scenario.makeParty(), dialogueHistory: [], merchant: null, document: null, pendingTest: null,
    });
    parlerAGustav();
  });

  it('1ᵉʳ passage : une réponse, numérotée 1', () => {
    expect(reponsesDuNoeud(get()).map((r) => [r.rang, r.label])).toEqual([[1, '« Un dragon ? »']]);
    runBindingById('dialogue-choice-1', get);
    expect(get().dialogue?.nodeId).toBe('a2');
  });

  it('2ᵉ passage : la réponse masquée ne consomme pas de numéro, Digit1 choisit la 1ʳᵉ visible', () => {
    secondPassage();
    expect(reponsesDuNoeud(get()).map((r) => [r.rang, r.index, r.label])).toEqual([
      [1, 1, '« Encore ce dragon ? »'],
      [2, 2, '« Une autre fois. »'],
    ]);
    runBindingById('dialogue-choice-1', get);
    expect(get().dialogue?.nodeId, 'la touche 1 part vers la 1ʳᵉ réponse VISIBLE (index de donnée 1)').toBe('a2');
  });

  it('2ᵉ passage : « Une autre fois. » clôt la conversation', () => {
    secondPassage();
    runBindingById('dialogue-choice-2', get);
    expect(get().dialogue).toBeNull();
  });
});
