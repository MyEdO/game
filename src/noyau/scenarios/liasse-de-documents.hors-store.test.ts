/**
 * Scénario `liasse-de-documents` (#679, #4936) : à côté de la liasse, son geste authoré ouvre la conversation ; chaque
 * document du registre du scénario est offert par un chapitre, s'ouvre à son titre et à sa prose (`store.document`), et
 * la conversation revient à la liasse quand le document se referme (#2689). Deux réponses par document, depuis la liasse
 * ouverte.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc, documentDAuteur } from '../banc.testkit';
import { scenario } from '../../scenes/test-scenarios/liasse-de-documents';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Case voisine de la liasse (`pos { x: 3, y: 2 }`). */
const A_COTE = { x: 2, y: 2 };

/** Le scénario chargé par la chaîne réelle, à l'écran de jeu, carte d'entrée refermée. */
function charger() {
  const construit = scenario.construire(idsDeTest);
  const { party, scene, narratif } = construit;
  banc.setState({ party, scene: null, dialogue: null, document: null, clues: {}, dialogueHistory: [] });
  banc.getState().chargerLeProjet({ scenes: [scene], entryId: scene.id, narratif, projet: null });
  banc.setState({ screen: 'campaign', pendingCascade: null });
  return construit;
}

describe('liasse-de-documents — la liasse sert le registre du scénario', () => {
  it('portée : depuis le départ la liasse ne s’ouvre pas ; à côté, elle s’ouvre', () => {
    charger();
    banc.getState().jouerAction('liasse', 'lire');
    expect(banc.getState().dialogue, 'hors de portée').toBeNull();
    banc.setState({ partyPos: A_COTE });
    banc.getState().jouerAction('liasse', 'lire');
    expect(banc.getState().dialogue?.nodeId).toBe('liasse');
  });

  it('chaque document : offert par son chapitre, ouvert à son titre et à sa prose, retour à la liasse une fois refermé, en deux réponses', () => {
    const { narratif } = charger();
    const documents = narratif!.documents;
    expect(documents.length).toBeGreaterThan(1);
    for (const doc of documents) {
      banc.setState({ partyPos: A_COTE, dialogue: null, document: null });
      banc.getState().jouerAction('liasse', 'lire');
      const dlg = banc.getState().dialogue!.dialogue;
      const racine = dlg.nodes.find((n) => n.id === dlg.start.id)!;
      const chapitre = racine.choices.find((c) => dlg.nodes.find((n) => n.id === c.next?.id)?.choices.some((r) => r.id === `lire-${doc.id}`));
      expect(chapitre, `${doc.id} offert par un chapitre`).toBeDefined();
      banc.getState().fenetreChoisir('dialogue', 'reponse', chapitre!.id);
      banc.getState().fenetreChoisir('dialogue', 'reponse', `lire-${doc.id}`);
      expect([documentDAuteur(banc.getState())?.title, documentDAuteur(banc.getState())?.text]).toEqual([doc.titre, doc.prose]);
      expect(banc.getState().dialogue?.nodeId, 'le dialogue n’avance pas sous le document (#2689)').toBe(chapitre!.next!.id);
      banc.getState().fenetreFermer('document');
      expect(banc.getState().dialogue?.nodeId).toBe('liasse');
    }
  });
});
