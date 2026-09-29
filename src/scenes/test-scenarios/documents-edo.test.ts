/**
 * Scénario `documents-edo` (#679) : la liasse offre CHACUN des 11 documents joueur d'EDO, pris au
 * registre du paquet ; chaque réponse pose `store.document` au titre et à la prose du paquet puis
 * revient à la liasse, et les deux stades croisés de l'indice de fixture résolvent leur document et se
 * révèlent au Carnet. La liasse s'ouvre par l'exécuteur unique des gestes (`jouerAction`), portée comprise.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { documentById } from '../../state/campaignData';
import { walkFlow } from '../../engine/flowCore';
import { diligenceCampaign, paquetDuJeu } from '../campaign';
import { scenario } from './documents-edo';
import type { Dialogue } from '../../state/scene';
import type { Flow } from '../../state/flow';

const paquet = paquetDuJeu(diligenceCampaign).narratif.documents;

/** Les 11 documents joueur du livre (EDO, annexe 3). */
const DOCUMENTS_EDO = [
  'edo-document-1-on-recherche',
  'edo-document-2-rolf-hurtsis',
  'edo-document-3-heritage',
  'edo-document-4-affidavit',
  'edo-document-5-josef-quartjin',
  'edo-document-6-schaffenfest',
  'edo-document-7-lettre-q-f',
  'edo-document-8-invitation-de-teugen',
  'edo-document-9-tout-se-passe-bien',
  'edo-document-10-lettre-d-herzen',
  'edo-document-11-mot-de-magirius',
] as const;

/** Case voisine de la liasse (`pos { x: 3, y: 2 }`). */
const A_COTE = { x: 2, y: 2 };

/** Scène et narratif construits, chargés par la chaîne réelle, à l'écran de jeu, carte d'entrée refermée. */
function charger(): void {
  const { party, scene, narratif } = scenario.construire();
  useGame.setState({ party, scene: null, dialogue: null, document: null, clues: {}, dialogueHistory: [] });
  useGame.getState().loadProject([scene], scene.id, undefined, narratif);
  useGame.setState({ screen: 'campaign', pendingCascade: null });
}

/** Le groupe à côté de la liasse l'ouvre par son geste authoré. */
function ouvrirLaLiasse(): Dialogue {
  charger();
  useGame.setState({ partyPos: A_COTE });
  useGame.getState().jouerAction('liasse-edo', 'lire');
  const ouvert = useGame.getState().dialogue;
  expect(ouvert?.nodeId).toBe('liasse');
  return ouvert!.dialogue;
}

/** Les `documentId` qu'un Flow joue par l'Effect `document`. */
function documentsJoues(flow: Flow | undefined): string[] {
  const ids: string[] = [];
  if (flow) walkFlow(flow, (n) => { if (n.kind === 'do' && n.effect.type === 'document') ids.push(n.effect.documentId); });
  return ids;
}

/** Les chemins (nœud, index de réponse) qui mènent de la liasse à chaque document. */
function cheminsVersLesDocuments(dlg: Dialogue): Map<string, { chapitre: number; reponse: number }> {
  const racine = dlg.nodes.find((n) => n.id === dlg.start)!;
  const chemins = new Map<string, { chapitre: number; reponse: number }>();
  racine.choices.forEach((c, chapitre) => {
    const noeud = dlg.nodes.find((n) => n.id === c.next);
    noeud?.choices.forEach((r, reponse) => documentsJoues(r.flow).forEach((id) => chemins.set(id, { chapitre, reponse })));
  });
  return chemins;
}

beforeEach(() => {
  useGame.setState({ campaignNarratif: null, scene: null, dialogue: null, document: null });
});

describe('documents-edo — la liasse sert le registre du paquet EDO', () => {
  it('les 11 documents du livre sont au registre du paquet, et le narratif du scénario PREND ce registre', () => {
    expect(paquet.map((d) => d.id)).toEqual(expect.arrayContaining([...DOCUMENTS_EDO]));
    const { narratif } = scenario.construire();
    expect(narratif?.documents).toEqual(paquet);
  });

  it('portée : depuis le départ la liasse ne s’ouvre pas ; à côté, elle s’ouvre', () => {
    charger();
    useGame.getState().jouerAction('liasse-edo', 'lire');
    expect(useGame.getState().dialogue, 'hors de portée').toBeNull();
    useGame.setState({ partyPos: A_COTE });
    useGame.getState().jouerAction('liasse-edo', 'lire');
    expect(useGame.getState().dialogue?.nodeId).toBe('liasse');
  });

  it('chaque nœud tient aux touches 1..9', () => {
    const dlg = ouvrirLaLiasse();
    for (const n of dlg.nodes) expect(n.choices.length, n.id).toBeLessThanOrEqual(9);
  });

  it.each(DOCUMENTS_EDO)('%s : offert, ouvert au titre et à la prose du paquet, retour à la liasse', (id) => {
    const doc = paquet.find((d) => d.id === id);
    expect(doc, `${id} au registre du paquet`).toBeDefined();
    const dlg = ouvrirLaLiasse();
    const chemin = cheminsVersLesDocuments(dlg).get(id);
    expect(chemin, `${id} offert par la liasse`).toBeDefined();
    useGame.getState().chooseDialogue(chemin!.chapitre);
    useGame.getState().chooseDialogue(chemin!.reponse);
    const ouvert = useGame.getState().document;
    expect(ouvert?.title).toBe(doc!.titre);
    expect(ouvert?.text).toBe(doc!.prose);
    expect(useGame.getState().dialogue?.nodeId).toBe('liasse');
  });

  it('les stades croisés résolvent leur document et se révèlent au Carnet', () => {
    const dlg = ouvrirLaLiasse();
    const indice = useGame.getState().campaignNarratif!.indices.find((i) => i.id === 'ind-billets-de-teugen')!;
    expect(indice.stades.map((s) => documentById(s.documentId!))).toEqual([
      paquet.find((d) => d.id === 'edo-document-8-invitation-de-teugen'),
      paquet.find((d) => d.id === 'edo-document-9-tout-se-passe-bien'),
    ]);
    const ch8 = dlg.nodes.find((n) => n.id === 'ch8')!;
    const racine = dlg.nodes.find((n) => n.id === dlg.start)!;
    const versCh8 = racine.choices.findIndex((c) => c.next === 'ch8');
    for (const stade of indice.stades) {
      const reponse = ch8.choices.findIndex((c) => {
        let revele = false;
        if (c.flow) walkFlow(c.flow, (n) => { if (n.kind === 'do' && n.effect.type === 'revealClue' && n.effect.stade === stade.id) revele = true; });
        return revele;
      });
      expect(reponse, `réponse qui révèle ${stade.id}`).toBeGreaterThanOrEqual(0);
      if (useGame.getState().dialogue?.nodeId !== 'ch8') useGame.getState().chooseDialogue(versCh8);
      useGame.getState().chooseDialogue(reponse);
      expect(useGame.getState().clues['ind-billets-de-teugen']?.stadeCourant).toBe(stade.id);
    }
  });
});
