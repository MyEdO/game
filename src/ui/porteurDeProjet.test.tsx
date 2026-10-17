// @vitest-environment jsdom
/**
 * #2206 lot 3 — la prose d'un document de PROJET est portée par son champ (`{ type: 'projet', id,
 * chemin }`) quand la partie a un document, et nue en scénario de test (`liage.ts`).
 *
 * Trois volets : la résolution PURE (`porteurDeProjet`, `porteurDuNarratif` : rang par id dans
 * `campaignDoc.narratif`), l'id que pose CHAQUE voie de lancement (celui du DOCUMENT parsé), et les
 * sites de prose de projet montés, où le porteur se voit à ses liens (`CodexRef`) : la prose porte
 * un terme du Codex (`TEXTE`), qui ne se lie que sous un porteur.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame, resetSceneRegistry } from '../state/store';
import { applyEffects } from '../state/combatFlow';
import { beginShipwreck } from '../state/shipwreck';
import { emptyScene, type Scene } from '../state/scene';
import { emptyNarratif, type NarratifBlock } from '../state/campaignNarratif';
import { campagneDeLEntree, __resetLibraryForTest, type SavedProject } from '../state/projectLibrary';
import { buildApi } from '../state/devtools';
import { addCondition } from '../engine/conditions';
import { makePregens, makeShowcaseParty } from '../data/pregens';
import { builtinCampaigns, campagneDuJeu, diligenceCampaign, documentDuJeu, lancerCampagne, paquetDuJeu } from '../scenes/campaign';
import { porteurDeProjet, porteurDuNarratif } from './porteurDeProjet';
import { CHEMINS_ADRESSES, type Porteur } from './liage';
import { Prose } from './Prose';
import { CampaignOpeningScreen } from './CampaignOpeningScreen';
import { CarnetScreen } from './CarnetScreen';
import { DocumentModal } from './DocumentModal';
import { Editor } from './editor/Editor';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const get = useGame.getState;
const PROJET = 'projet-du-test';
/** Une prose qui cite un terme du Codex : elle se lie sous un porteur, jamais nue. */
const TEXTE = 'La Peur gagne le groupe.';
const NEUTRE = 'Rien à signaler.';

/** Le narratif du test : chaque cible est au rang 1 de son registre, pour que le rang se lise PAR ID. */
const narratif: NarratifBlock = {
  ...emptyNarratif(),
  ouverture: { titre: 'Chapitre', pitch: TEXTE },
  affaires: [{ id: 'aff', titre: 'L’affaire' }],
  indices: [
    { id: 'ind-autre', affaireId: 'aff', kind: 'indice', titre: 'Autre', stades: [{ id: 's1', prose: NEUTRE }] },
    {
      id: 'ind-cible', affaireId: 'aff', kind: 'indice', titre: 'Cible',
      stades: [{ id: 's1', prose: NEUTRE }, { id: 's2', prose: TEXTE }, { id: 's3', documentId: 'doc-cible' }],
    },
  ],
  documents: [
    { id: 'doc-autre', titre: 'Autre', prose: NEUTRE },
    { id: 'doc-cible', titre: 'Cible', prose: TEXTE },
  ],
};

function sceneDuTest(): Scene {
  const s = emptyScene(4, 4);
  s.id = 'scene-porteur';
  s.label = 'Scène';
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

/** Le paquet du test chargé par la voie de toute partie (`loadProject`), sous `projet`. */
function charger(projet: { id: string } | null): void {
  useGame.setState({ party: makePregens().slice(0, 1), battle: null });
  get().loadProject({ scenes: [sceneDuTest()], entryId: 'scene-porteur', narratif, projet });
}

const liensDe = (el: Element): string[] => [...el.querySelectorAll('.codex-ref')].map((a) => a.textContent ?? '');

describe('porteurDeProjet — résolution PURE', () => {
  beforeEach(() => {
    resetSceneRegistry();
    useGame.setState(useGame.getInitialState());
  });

  it('en campagne : `{ type: projet, id du document, chemin }` ; en scénario, et sans paquet : rien', () => {
    expect(porteurDeProjet(get(), 'narratif.ouverture.pitch')).toBeUndefined();
    charger({ id: PROJET });
    expect(porteurDeProjet(get(), 'narratif.ouverture.pitch')).toEqual({ type: 'projet', id: PROJET, chemin: 'narratif.ouverture.pitch' });
    charger(null);
    expect(porteurDeProjet(get(), 'narratif.ouverture.pitch')).toBeUndefined();
  });

  it('le rang d’une entrée se lit PAR ID dans `campaignDoc.narratif` ; une entrée absente n’a pas de porteur', () => {
    charger({ id: PROJET });
    expect(porteurDuNarratif(get(), 'indices', 'ind-cible', 'stades[1].prose')?.chemin).toBe('narratif.indices[1].stades[1].prose');
    expect(porteurDuNarratif(get(), 'documents', 'doc-cible', 'prose')?.chemin).toBe('narratif.documents[1].prose');
    expect(porteurDuNarratif(get(), 'documents', 'doc-inconnu', 'prose')).toBeUndefined();
    charger(null);
    expect(porteurDuNarratif(get(), 'documents', 'doc-cible', 'prose')).toBeUndefined();
  });

  it('les chemins émis appartiennent à `CHEMINS_ADRESSES` (forme générique)', () => {
    charger({ id: PROJET });
    const emis = [
      porteurDeProjet(get(), 'narratif.ouverture.pitch'),
      porteurDuNarratif(get(), 'indices', 'ind-cible', 'stades[1].prose'),
      porteurDuNarratif(get(), 'documents', 'doc-cible', 'prose'),
    ].map((p) => p!.chemin.replace(/\[\d+\]/g, '[]'));
    const projets = new Set(CHEMINS_ADRESSES.filter((c) => c.type === 'projet').map((c) => c.chemin));
    expect(emis.filter((c) => !projets.has(c))).toEqual([]);
  });
});

describe('L’id du projet est celui du DOCUMENT, par chaque voie de lancement', () => {
  const idDuDocument = paquetDuJeu(diligenceCampaign).id;

  beforeEach(() => {
    resetSceneRegistry();
    useGame.setState({ ...useGame.getInitialState(), party: makeShowcaseParty() });
  });

  it('campagne du jeu (`campagneDuJeu` → `lancerCampagne`)', () => {
    expect(lancerCampagne(get, campagneDuJeu(diligenceCampaign))).toBeNull();
    expect(get().campaignDoc?.projet).toEqual({ id: idDuDocument });
  });

  it('bibliothèque : une entrée `proj-copie` dont le document est `la Diligence` porte l’id du DOCUMENT', () => {
    const doc = documentDuJeu(diligenceCampaign);
    const entree: SavedProject = { id: 'proj-copie', label: 'Ma copie', startSceneId: doc.scenes[0].id, savedAt: 0, published: true, project: doc };
    const lancee = campagneDeLEntree(entree);
    expect(lancee.id, 'la clé du picker reste celle de l’entrée').toBe('proj-copie');
    expect(lancerCampagne(get, lancee)).toBeNull();
    expect(get().campaignDoc?.projet).toEqual({ id: idDuDocument });
    expect(idDuDocument).not.toBe('proj-copie');
  });

  describe('éditeur : « ▶ Tester » après l’ouverture d’une campagne du jeu', () => {
    let root: Root | null = null;
    let container: HTMLElement | null = null;

    afterEach(async () => {
      if (root) await act(async () => { root!.unmount(); });
      container?.remove();
      root = null;
      container = null;
      await __resetLibraryForTest();
    });

    it('le projet testé porte l’id du document ouvert (`barge-du-sel`), pas celui de sa première scène', async () => {
      const barge = builtinCampaigns.find((c) => c.id === 'barge-du-sel')!;
      const { id, scenes } = paquetDuJeu(barge);
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      await act(async () => { root!.render(<Editor initialScene={{ ...emptyScene(4, 4), id: 'brouillon' }} />); });
      let verdict: unknown = '';
      await act(async () => { verdict = await buildApi().editorOpen(barge.id); });
      expect(String(verdict)).toMatch(/^✓/);
      const tester = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Tester'))!;
      await act(async () => { tester.click(); });
      expect(get().screen).toBe('campaign');
      expect(get().campaignDoc?.projet).toEqual({ id });
      expect(id, 'l’id du document se distingue de celui de sa première scène').not.toBe(scenes[0].id);
    });
  });
});

describe('Sites de prose de PROJET : portés en campagne, nus en scénario', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    resetSceneRegistry();
    useGame.setState(useGame.getInitialState());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const monter = async (el: React.ReactElement): Promise<void> => {
    await act(async () => { root.render(el); });
  };

  it('le terme de `TEXTE` se lie sous un porteur de projet, et pas sans', () => {
    const porteur: Porteur = { type: 'projet', id: PROJET, chemin: 'narratif.ouverture.pitch' };
    expect(renderToStaticMarkup(<Prose md={TEXTE} porteur={porteur} />)).toContain('codex-ref');
    expect(renderToStaticMarkup(<Prose md={TEXTE} />)).not.toContain('codex-ref');
  });

  it.each([[true], [false]])('ouverture (`narratif.ouverture.pitch`), en campagne = %s', async (enCampagne) => {
    charger(enCampagne ? { id: PROJET } : null);
    await monter(<CampaignOpeningScreen />);
    expect(liensDe(container.querySelector('.parchment-card')!)).toEqual(enCampagne ? ['Peur'] : []);
  });

  it.each([[true], [false]])('Carnet, prose d’un stade (`narratif.indices[].stades[].prose`), en campagne = %s', async (enCampagne) => {
    charger(enCampagne ? { id: PROJET } : null);
    applyEffects(get, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-cible', stade: 's2' }]);
    await monter(<CarnetScreen onClose={() => {}} />);
    expect(container.textContent).toContain(TEXTE);
    expect(liensDe(container)).toEqual(enCampagne ? ['Peur'] : []);
  });

  it.each([[true], [false]])('Carnet, document croisé par un stade (`narratif.documents[].prose`), en campagne = %s', async (enCampagne) => {
    charger(enCampagne ? { id: PROJET } : null);
    applyEffects(get, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-cible', stade: 's3' }]);
    await monter(<CarnetScreen onClose={() => {}} />);
    expect(liensDe(container.querySelector('.parchment-card')!)).toEqual(enCampagne ? ['Peur'] : []);
  });

  it.each([[true], [false]])('document remis (`DocumentModal`, effet `document`), en campagne = %s', async (enCampagne) => {
    charger(enCampagne ? { id: PROJET } : null);
    applyEffects(get, useGame.setState, [{ type: 'document', documentId: 'doc-cible' }]);
    await monter(<DocumentModal />);
    expect(liensDe(document.querySelector('.parchment-card')!)).toEqual(enCampagne ? ['Peur'] : []);
  });

  it('rapport de naufrage EN CAMPAGNE (`DocumentModal`, texte runtime) : NU, même s’il cite un terme du Codex', async () => {
    charger({ id: PROJET });
    const inconscients = get().party.map((h) => {
      const c = { ...h, conditions: [...(h.conditions ?? [])] };
      addCondition(c, 'inconscient');
      return c;
    });
    useGame.setState({ party: inconscients, vessel: { vehicleId: 'cogue', label: 'La Peur', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [] } } as never);
    beginShipwreck(get, useGame.setState);
    const rapport = get().document!;
    expect(rapport.documentId).toBeUndefined();
    expect(renderToStaticMarkup(<Prose md={rapport.text} porteur={{ type: 'projet', id: PROJET, chemin: 'x' }} />), 'le rapport cite un terme du Codex').toContain('codex-ref');
    await monter(<DocumentModal />);
    expect(liensDe(document.querySelector('.parchment-card')!)).toEqual([]);
  });
});
