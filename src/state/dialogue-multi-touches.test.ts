/**
 * Scénario « Dialogue multi-interlocuteurs » (#1869), côté web : la touche du RANG (`dialogue-reponse-N`), jouée par le
 * store et le dispatcher RÉEL des touches (`runBindingById`), part vers la réponse VISIBLE de ce rang, à son index de
 * donnée. La reprise par `when` et le rang des réponses se jouent au banc du noyau
 * (`src/noyau/scenarios/dialogue-multi.hors-store.test.ts`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { ouvrirDialogue } from '../noyau/dialogue';
import { runBindingById } from './clavier/keybindings';
import { scenario } from '../scenes/test-scenarios/dialogue-multi';

const scenarioConstruit = scenario.construire(idsDeTest);
const tablee = scenarioConstruit.scene.dialogues.find((d) => d.id === 'dlg-tablee')!;
const get = useGame.getState;

/** Ouvre `dlg-tablee` sur Gustav, avec les flags DU STORE (ceux que la partie a posés). */
function parlerAGustav() {
  useGame.setState({ dialogue: ouvrirDialogue(get(), tablee, 'gustav') });
}

describe('dialogue-multi — la touche du rang choisit la réponse visible', () => {
  it('2ᵉ passage : Digit1 choisit la 1ʳᵉ réponse visible', () => {
    useGame.setState({
      screen: 'campaign', mode: 'exploration', battle: null, scene: scenarioConstruit.scene, flags: {},
      party: scenario.construire(idsDeTest).party, dialogueHistory: [], merchant: null, document: null, pendingTest: null,
    });
    parlerAGustav();
    for (const noeud of ['a1', 'a2', 'a3', 'a4']) {
      expect(get().dialogue?.nodeId).toBe(noeud);
      runBindingById('dialogue-reponse-1', get);
    }
    expect(get().dialogue, 'le 1ᵉʳ passage s’est clos').toBeNull();
    parlerAGustav();
    runBindingById('dialogue-reponse-1', get);
    expect(get().dialogue?.nodeId, 'la touche 1 part vers la 1ʳᵉ réponse VISIBLE (la 2ᵉ de la donnée)').toBe('a2');
  });
});
