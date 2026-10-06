/**
 * #766 LOT A — une SAVE de campagne est AUTO-SUFFISANTE et REJOUABLE.
 *
 * Contrat POSITIF du snapshot `campaignDoc` : après un reload (registre `sceneRegistry` en mémoire
 * module reparti de zéro — seule la scène courante y serait sinon), le chargement d'une
 * save RÉ-ENREGISTRE toutes les scènes du paquet ET RE-DÉRIVE la couche narrative (`campaignNarratif`).
 * On simule le reload par `resetSceneRegistry()` (#777 — plus de reset des modules Vitest, incompatible
 * avec la suite sous `isolate:false`) : le registre repart de zéro, scene-b n'y est jamais réenregistrée
 * hors du chemin `loadGame`. Sans le fix (campaignDoc absent), `transitionTo('scene-b')` échouerait.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame, resetSceneRegistry } from './store';
import { presetPnjById } from './campaignData';
import { resoudreObjet } from '../engine/items';
import { emptyScene, type Scene } from './scene';
import type { NarratifBlock } from './campaignNarratif';
import type { WorldMap } from './worldMap';
import { makePregens } from '../data/pregens';
import { campagneALancer, lancerCampagne } from '../scenes/campaign';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

/** Scène minimale (heroStart) chargeable par le chemin RÉEL (`loadProject`/`transitionTo`). */
function scene(id: string): Scene {
  const s = emptyScene(6, 6);
  s.id = id;
  s.label = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

const OBJET_ID = 'snap-lame-maudite';
const narratif: NarratifBlock = {
  affaires: [{ id: 'snap-aff', titre: 'Le Corbeau noir' }],
  indices: [],
  presetsPnj: [{ id: 'snap-pnj', profil: {} }],
  objets: [{ id: OBJET_ID, label: 'Lame maudite', categorie: 'melee', subType: null } as NarratifBlock['objets'][number]],
};

const worldMap: WorldMap = {
  id: 'snap-carte', label: 'Carte', places: [{ id: 'p', label: 'Bourg', pos: { x: 0, y: 0 }, scene: 'scene-a' }], routes: [],
};

describe('loadProject — la scène d’entrée est une scène du paquet, ou le chargement LÈVE', () => {
  beforeEach(() => {
    resetSceneRegistry();
    useGame.setState(useGame.getInitialState());
  });

  it.each([
    ['id inconnu', [scene('sa'), scene('sb')], 'INEXISTANTE', /« INEXISTANTE » absente \(sa, sb\)/],
    ['paquet sans scène', [], 'x', /« x » absente \(\)/],
  ] as const)('%s : aucune scène démarrée ni enregistrée, aucun `campaignDoc` écrit', (_nom, scenes, entree, motif) => {
    useGame.getState().loadProject([scene('avant')], 'avant');
    const docAvant = useGame.getState().campaignDoc;
    expect(() => useGame.getState().loadProject([...scenes], entree)).toThrow(motif);
    expect(useGame.getState().scene?.id).toBe('avant');
    expect(useGame.getState().campaignDoc).toBe(docAvant);
    useGame.getState().transitionTo('sb');
    expect(useGame.getState().scene?.id).toBe('avant');
  });
});

describe('#766 — save de campagne auto-suffisante et rejouable', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    resetSceneRegistry();
    useGame.setState(useGame.getInitialState());
  });

  it('reload (registre vidé) : campaignDoc re-registre la scène B → transitionTo réussit', () => {
    // 1. Charge un projet MULTI-scènes par le chemin réel, puis sauve.
    useGame.setState({ party: makePregens().slice(0, 1), battle: null });
    useGame.getState().loadProject([scene('scene-a'), scene('scene-b')], 'scene-a', worldMap, narratif);
    expect(useGame.getState().scene?.id).toBe('scene-a');
    expect(useGame.getState().campaignDoc?.scenes.map((s) => s.id)).toEqual(['scene-a', 'scene-b']);
    expect(useGame.getState().saveGame(1)).toBe(true);

    // 2. Reload : `sceneRegistry` reparti de zéro, scene-b INCONNUE.
    resetSceneRegistry();
    useGame.setState({ party: makePregens().slice(0, 1) });
    useGame.getState().loadProject([scene('scene-solo')], 'scene-solo');
    useGame.getState().transitionTo('scene-b');
    expect(useGame.getState().scene?.id).toBe('scene-solo'); // scene-b introuvable → transition ignorée

    // 3. Chargement de la save : re-registration des scènes du paquet + re-dérivation du narratif.
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().scene?.id).toBe('scene-a');
    expect(useGame.getState().worldMap?.id).toBe('snap-carte'); // carte du paquet restaurée
    // La couche narrative est re-dérivée de campaignDoc.narratif (non persistée au snapshot).
    expect(presetPnjById('snap-pnj')?.id).toBe('snap-pnj');
    expect(resoudreObjet(OBJET_ID)?.label).toBe('Lame maudite');
    // La preuve : scene-b, absente du registre reparti de zéro, l'est de nouveau → la transition réussit.
    useGame.getState().transitionTo('scene-b');
    expect(useGame.getState().scene?.id).toBe('scene-b');
  });

  it('l’Arène lancée sans choix (#1692) : sa save porte son paquet, et ses zones résolvent au rechargement', () => {
    useGame.setState({ party: makePregens().slice(0, 1), battle: null });
    const arene = campagneALancer(null);
    expect(lancerCampagne(useGame.getState, null)).toBeNull();
    expect(useGame.getState().campaignDoc?.scenes.map((s) => s.id)).toEqual(arene.scenes.map((s) => s.id));
    expect(useGame.getState().saveGame(1)).toBe(true);

    resetSceneRegistry();
    useGame.setState(useGame.getInitialState());
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().worldMap?.id).toBe(arene.worldMap?.id);
    useGame.getState().transitionTo('arene-hub');
    expect(useGame.getState().scene?.id).toBe('arene-hub');
  });
});
