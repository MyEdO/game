/**
 * Scénario « Dialogue multi-interlocuteurs » — la REPRISE vit dans le dialogue de l'entité (#1869).
 *
 * Gustav ouvre toujours `dlg-tablee` (`dialogueId` fixe) : le 2ᵉ passage se distingue par le `when`
 * de ses réponses. Contrats POSITIFS, un par passage, joués sur le banc du noyau par le verbe
 * (le choix `dialogue.reponse`) : le numéro est le RANG de la liste visible, la réponse masquée n'en consomme pas. Le 2ᵉ
 * passage naît de la FIN RÉELLE du 1ᵉʳ (le flag que la donnée pose), jamais d'un flag injecté.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { ouvrirDialogue, reponsesDuNoeud } from '../../noyau/dialogue';
import { scenario } from '../../scenes/test-scenarios/dialogue-multi';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const scenarioConstruit = scenario.construire();

const tablee = scenarioConstruit.scene.dialogues.find((d) => d.id === 'dlg-tablee')!;
const get = () => banc.getState();

/** Ouvre `dlg-tablee` sur Gustav, avec les flags de la partie (ceux qu'elle a posés). */
function parlerAGustav() {
  banc.setState({ dialogue: ouvrirDialogue(get(), tablee, 'gustav') });
}

/** Choisit la réponse visible de rang `rang`, par son id de donnée (le choix `dialogue.reponse`). */
const choisir = (rang: number) => get().fenetreChoisir('dialogue', 'reponse', reponsesDuNoeud(get()).find((r) => r.rang === rang)!.id);

/** Le 1ᵉʳ passage joué jusqu'au bout, au rang 1, puis Gustav de nouveau abordé. */
function secondPassage() {
  for (const noeud of ['a1', 'a2', 'a3', 'a4']) {
    expect(get().dialogue?.nodeId).toBe(noeud);
    choisir(1);
  }
  expect(get().dialogue, 'le 1ᵉʳ passage s’est clos').toBeNull();
  parlerAGustav();
}

describe('dialogue-multi — la reprise par `when` dans le dialogue de Gustav', () => {
  beforeEach(() => {
    banc.setState({
      screen: 'campaign', mode: 'exploration', battle: null, scene: scenarioConstruit.scene, flags: {},
      party: scenario.construire().party, dialogueHistory: [], merchant: null, document: null, pendingTest: null,
    });
    parlerAGustav();
  });

  it('1ᵉʳ passage : une réponse, numérotée 1', () => {
    expect(reponsesDuNoeud(get()).map((r) => [r.rang, r.label])).toEqual([[1, '« Un dragon ? »']]);
    choisir(1);
    expect(get().dialogue?.nodeId).toBe('a2');
  });

  it('2ᵉ passage : la réponse masquée ne consomme pas de numéro', () => {
    secondPassage();
    expect(reponsesDuNoeud(get()).map((r) => [r.rang, r.id, r.label])).toEqual([
      [1, 'encore-dragon', '« Encore ce dragon ? »'],
      [2, 'autre-fois', '« Une autre fois. »'],
    ]);
  });

  it('2ᵉ passage : « Une autre fois. » clôt la conversation', () => {
    secondPassage();
    choisir(2);
    expect(get().dialogue).toBeNull();
  });
});
