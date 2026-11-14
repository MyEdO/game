/**
 * Scénario `documents-edo` (#679) : la liasse offre CHACUN des 11 documents joueur d'EDO, pris au
 * registre du paquet ; chaque réponse pose `store.document` au titre et à la prose du paquet puis
 * revient à la liasse, et les deux stades croisés de l'indice de fixture résolvent leur document et se
 * révèlent au Carnet. La liasse s'ouvre par l'exécuteur unique des gestes (`jouerAction`), portée comprise.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { documentDuNarratif } from '../../noyau/monde/resolveursDuNarratif';
import { walkFlow } from '../../engine/flowCore';
import { diligenceCampaign, paquetDuJeu } from '../../scenes/campaign';
import { scenario } from '../../scenes/test-scenarios/documents-edo';
import type { Dialogue } from '../../noyau/monde/scene';
import type { Flow } from '../../data/schemas/defs-scenes/effets';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

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
  const { party, scene, narratif } = scenario.construire(idsDeTest);
  banc.setState({ party, scene: null, dialogue: null, document: null, clues: {}, dialogueHistory: [] });
  banc.getState().chargerLeProjet({ scenes: [scene], entryId: scene.id, narratif, projet: null });
  banc.setState({ screen: 'campaign', pendingCascade: null });
}

/** Le groupe à côté de la liasse l'ouvre par son geste authoré. */
function ouvrirLaLiasse(): Dialogue {
  charger();
  banc.setState({ partyPos: A_COTE });
  banc.getState().jouerAction('liasse-edo', 'lire');
  const ouvert = banc.getState().dialogue;
  expect(ouvert?.nodeId).toBe('liasse');
  return ouvert!.dialogue;
}

/** Les `documentId` qu'un Flow joue par l'Effect `document`. */
function documentsJoues(flow: Flow | undefined): string[] {
  const ids: string[] = [];
  if (flow) walkFlow(flow, (n) => { if (n.kind === 'effet' && n.effet.type === 'document') ids.push(n.effet.documentId); });
  return ids;
}

/** Les chemins (réponse de chapitre, réponse de lecture, par leurs ids) qui mènent de la liasse à chaque document. */
function cheminsVersLesDocuments(dlg: Dialogue): Map<string, { chapitre: string; reponse: string }> {
  const racine = dlg.nodes.find((n) => n.id === dlg.start.id)!;
  const chemins = new Map<string, { chapitre: string; reponse: string }>();
  racine.choices.forEach((c) => {
    const noeud = dlg.nodes.find((n) => n.id === c.next?.id);
    noeud?.choices.forEach((r) => documentsJoues(r.flow).forEach((id) => chemins.set(id, { chapitre: c.id, reponse: r.id })));
  });
  return chemins;
}

beforeEach(() => {
  banc.setState({ campaignNarratif: null, scene: null, dialogue: null, document: null });
});

describe('documents-edo — la liasse sert le registre du paquet EDO', () => {
  it('les 11 documents du livre sont au registre du paquet, et le narratif du scénario PREND ce registre', () => {
    expect(paquet.map((d) => d.id)).toEqual(expect.arrayContaining([...DOCUMENTS_EDO]));
    const { narratif } = scenario.construire(idsDeTest);
    expect(narratif?.documents).toEqual(paquet);
  });

  it('portée : depuis le départ la liasse ne s’ouvre pas ; à côté, elle s’ouvre', () => {
    charger();
    banc.getState().jouerAction('liasse-edo', 'lire');
    expect(banc.getState().dialogue, 'hors de portée').toBeNull();
    banc.setState({ partyPos: A_COTE });
    banc.getState().jouerAction('liasse-edo', 'lire');
    expect(banc.getState().dialogue?.nodeId).toBe('liasse');
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
    banc.getState().fenetreChoisir('dialogue', 'reponse', chemin!.chapitre);
    banc.getState().fenetreChoisir('dialogue', 'reponse', chemin!.reponse);
    const ouvert = banc.getState().document;
    expect(ouvert?.title).toBe(doc!.titre);
    expect(ouvert?.text).toBe(doc!.prose);
    expect(banc.getState().dialogue?.nodeId).toBe('liasse');
  });

  it('chaque réponse de lecture cite son titre entre UNE paire de guillemets, même un titre qui porte les siens', () => {
    const lectures = ouvrirLaLiasse().nodes.flatMap((n) => n.choices.map((c) => String(c.label))).filter((l) => l.startsWith('Lire '));
    expect(lectures).toHaveLength(DOCUMENTS_EDO.length);
    for (const l of lectures) expect(l).toMatch(/^Lire «[^«»]*»\.$/);
    expect(lectures).toContain('Lire « Tout se passe bien ».');
  });

  it('les stades croisés résolvent leur document et se révèlent au Carnet', () => {
    const dlg = ouvrirLaLiasse();
    const narratif = banc.getState().campaignNarratif;
    const indice = narratif!.indices.find((i) => i.id === 'ind-billets-de-teugen')!;
    expect(indice.stades.map((s) => documentDuNarratif(narratif)(s.documentId!))).toEqual([
      paquet.find((d) => d.id === 'edo-document-8-invitation-de-teugen'),
      paquet.find((d) => d.id === 'edo-document-9-tout-se-passe-bien'),
    ]);
    const ch8 = dlg.nodes.find((n) => n.id === 'ch8')!;
    const racine = dlg.nodes.find((n) => n.id === dlg.start.id)!;
    const versCh8 = racine.choices.find((c) => c.next?.id === 'ch8')!.id;
    for (const stade of indice.stades) {
      const reponse = ch8.choices.find((c) => {
        let revele = false;
        if (c.flow) walkFlow(c.flow, (n) => { if (n.kind === 'effet' && n.effet.type === 'revealClue' && n.effet.stade === stade.id) revele = true; });
        return revele;
      });
      expect(reponse, `réponse qui révèle ${stade.id}`).toBeDefined();
      if (banc.getState().dialogue?.nodeId !== 'ch8') banc.getState().fenetreChoisir('dialogue', 'reponse', versCh8);
      banc.getState().fenetreChoisir('dialogue', 'reponse', reponse!.id);
      expect(banc.getState().clues['ind-billets-de-teugen']?.stadeCourant).toBe(stade.id);
    }
  });
});
