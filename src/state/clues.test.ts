import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { revealClue, discreditClue, togglePin, marquerVus, estNouveauPour, affichageDe, type ClueState, type IndiceAffiché } from './clues';
import { emptyNarratif, type Indice, type NarratifBlock } from './campaignNarratif';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { emptyScene } from './scene';
import type { Combatant } from '../engine/types';
import type { Scene } from './scene';
import { readSlot, saveToSlot, deleteSlot, type SaveGame } from './saves';
import { withActingSeat } from './netOwnership';
import { emettreIntentInvite, interceptGuestActions, restoreGuestActions } from './netFlow';

const IND: Indice = {
  id: 'ind-lettre',
  affaireId: 'aff-corbeau',
  kind: 'indice',
  titre: 'La lettre scellée',
  stades: [
    { id: 's1', prose: 'Une lettre cachetée de cire noire traîne sur le bureau.' },
    { id: 's2', prose: 'Le cachet porte les armes du corbeau — une correspondance secrète.' },
  ],
};

const IND_MONO: Indice = {
  id: 'ind-mono',
  affaireId: 'aff-corbeau',
  kind: 'indice',
  titre: 'Le mouchoir brodé',
  stades: [{ id: 'unique', prose: 'Un mouchoir brodé d’un corbeau, oublié sur la scène.' }],
};

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
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

/** Ce que le Carnet affiche MAINTENANT de ces indices (présents). */
const affichés = (clues: Record<string, ClueState>, ids: readonly string[]): IndiceAffiché[] =>
  ids.filter((id) => clues[id]).map((id) => affichageDe(id, clues[id]));

describe('clues — helpers PURS (#670, mécanique maison)', () => {
  it('revealClue sur un indice absent : pose le PREMIER stade, historique à une entrée, statut révélé', () => {
    const out = revealClue({}, IND, 100);
    expect(out['ind-lettre']).toEqual<ClueState>({ stadeCourant: 's1', statut: 'révélé', épinglé: undefined, historique: [{ stade: 's1', at: 100 }] });
  });

  it('revealClue avec un stade explicite ultérieur : avance stadeCourant, ajoute une entrée d’historique', () => {
    const first = revealClue({}, IND, 100);
    const second = revealClue(first, IND, 200, 's2');
    expect(second['ind-lettre'].stadeCourant).toBe('s2');
    expect(second['ind-lettre'].historique).toEqual([{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }]);
  });

  it('revealClue ré-appelé sur le même stade courant : idempotent (pas de doublon d’historique)', () => {
    const first = revealClue({}, IND, 100);
    const again = revealClue(first, IND, 150);
    expect(again).toBe(first); // sans stade explicite et indice déjà présent → no-op
    const sameStade = revealClue(first, IND, 150, 's1');
    expect(sameStade['ind-lettre'].historique).toHaveLength(1);
  });

  it('revealClue sur un stade ANTÉRIEUR pas encore lu : l’ajoute à l’historique, garde le stade le plus avancé', () => {
    const avancé = revealClue({}, IND, 100, 's2');
    const out = revealClue(avancé, IND, 200, 's1');
    expect(out['ind-lettre']).toEqual<ClueState>({
      stadeCourant: 's2', statut: 'révélé', épinglé: undefined,
      historique: [{ stade: 's2', at: 100 }, { stade: 's1', at: 200 }],
    });
  });

  it('revealClue sur un stade ANTÉRIEUR déjà lu, indice révélé : même Record (pas de recul, pas de doublon)', () => {
    const lu = revealClue(revealClue({}, IND, 100), IND, 200, 's2');
    expect(revealClue(lu, IND, 300, 's1')).toBe(lu);
  });

  it('revealClue sur un stade ANTÉRIEUR déjà lu, indice réfuté : réactivé au stade courant, historique inchangé', () => {
    const réfuté = discreditClue(revealClue(revealClue({}, IND, 100), IND, 200, 's2'), IND, 250);
    const out = revealClue(marquerVus(réfuté, affichés(réfuté, ['ind-lettre']), 0), IND, 300, 's1');
    expect(out['ind-lettre']).toEqual<ClueState>({
      stadeCourant: 's2', statut: 'révélé', épinglé: undefined,
      historique: [{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }],
    });
  });

  it('revealClue : stadeCourant en retard sur un stade déjà lu → remis au plus avancé, sans doublon d’historique', () => {
    const hérité: Record<string, ClueState> = {
      'ind-lettre': { stadeCourant: 's1', statut: 'révélé', historique: [{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }] },
    };
    expect(revealClue(hérité, IND, 300, 's2')['ind-lettre']).toEqual<ClueState>({
      stadeCourant: 's2', statut: 'révélé', épinglé: undefined,
      historique: [{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }],
    });
  });

  it('revealClue avec un stade inconnu : no-op (authoring fautif, ne casse pas le jeu)', () => {
    const out = revealClue({}, IND, 100, 'stade-inconnu');
    expect(out).toEqual({});
  });

  it('revealClue ré-active une piste précédemment réfutée (garde l’historique)', () => {
    const discredited = discreditClue({}, IND, 100);
    expect(discredited['ind-lettre'].statut).toBe('réfuté');
    const revived = revealClue(discredited, IND, 200, 's2');
    expect(revived['ind-lettre'].statut).toBe('révélé');
    expect(revived['ind-lettre'].historique).toEqual([{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }]);
  });

  it('revealClue résurrecte un indice réfuté au MÊME stade (mono-stade) — statut repasse révélé', () => {
    const revealed = revealClue({}, IND_MONO, 100);
    const discredited = discreditClue(revealed, IND_MONO, 200);
    expect(discredited['ind-mono'].statut).toBe('réfuté');
    const revived = revealClue(discredited, IND_MONO, 300);
    expect(revived['ind-mono'].statut).toBe('révélé');
    expect(revived['ind-mono'].stadeCourant).toBe('unique');
    expect(revived['ind-mono'].historique).toEqual([{ stade: 'unique', at: 100 }]); // pas de doublon
    // ré-appeler revealClue sur un indice DÉJÀ révélé au même stade : vrai no-op (Record identique).
    const noop = revealClue(revived, IND_MONO, 400);
    expect(noop).toBe(revived);
  });

  it('discreditClue sur un indice PRÉSENT : passe réfuté, garde stadeCourant/historique/épinglé', () => {
    const revealed = revealClue({}, IND, 100);
    const pinned = togglePin(revealed, 'ind-lettre');
    const out = discreditClue(pinned, IND, 300);
    expect(out['ind-lettre']).toEqual<ClueState>({ stadeCourant: 's1', statut: 'réfuté', épinglé: true, historique: [{ stade: 's1', at: 100 }] });
  });

  it('discreditClue sur un indice ABSENT : créé d’abord révélé à son premier stade, puis réfuté (relisible)', () => {
    const out = discreditClue({}, IND, 100);
    expect(out['ind-lettre']).toEqual<ClueState>({ stadeCourant: 's1', statut: 'réfuté', historique: [{ stade: 's1', at: 100 }] });
  });

  it('discreditClue sur un indice DÉJÀ réfuté : vrai no-op (Record identique, pas de re-journalisation)', () => {
    const discredited = discreditClue({}, IND, 100);
    const again = discreditClue(discredited, IND, 200);
    expect(again).toBe(discredited);
  });

  it('togglePin flip un indice présent, no-op sur un indice absent', () => {
    const revealed = revealClue({}, IND, 100);
    const pinned = togglePin(revealed, 'ind-lettre');
    expect(pinned['ind-lettre'].épinglé).toBe(true);
    const unpinned = togglePin(pinned, 'ind-lettre');
    expect(unpinned['ind-lettre'].épinglé).toBe(false);
    const absent = togglePin({}, 'ind-inconnu');
    expect(absent).toEqual({});
  });
});

describe('clues — nouveauté vue PAR SIÈGE (#2415)', () => {
  /** L'indice tel que le siège 0 l'a déjà affiché au carnet. */
  const lu = (clues: Record<string, ClueState>, id: string) => marquerVus(clues, affichés(clues, [id]), 0);

  it('un indice NEUF est nouveau pour tout siège', () => {
    const c = revealClue({}, IND, 100)['ind-lettre'];
    expect(estNouveauPour(c, 0)).toBe(true);
    expect(estNouveauPour(c, 1)).toBe(true);
  });

  it('marquerVus marque le SEUL siège nommé : l’autre voit encore la nouveauté', () => {
    const neuf = revealClue({}, IND, 100);
    const c = marquerVus(neuf, affichés(neuf, ['ind-lettre']), 1)['ind-lettre'];
    expect(c.vuParSiège).toEqual({ 1: true });
    expect(estNouveauPour(c, 1)).toBe(false);
    expect(estNouveauPour(c, 0)).toBe(true);
  });

  it('revealClue RETIRE `vuParSiège` quand l’indice AVANCE d’un stade', () => {
    const avancé = revealClue(lu(revealClue({}, IND, 100), 'ind-lettre'), IND, 200, 's2');
    expect(avancé['ind-lettre'].vuParSiège).toBeUndefined();
  });

  it('revealClue RETIRE `vuParSiège` sur une piste écartée, déjà vue, qui est RÉACTIVÉE', () => {
    const écartéeLue = lu(discreditClue(revealClue({}, IND_MONO, 100), IND_MONO, 200), 'ind-mono');
    expect(écartéeLue['ind-mono'].vuParSiège).toEqual({ 0: true });
    expect(revealClue(écartéeLue, IND_MONO, 300)['ind-mono'].vuParSiège).toBeUndefined();
  });

  it('discreditClue RETIRE `vuParSiège` d’un indice déjà vu', () => {
    const réfuté = discreditClue(lu(revealClue({}, IND, 100), 'ind-lettre'), IND, 200);
    expect(réfuté['ind-lettre'].statut).toBe('réfuté');
    expect(réfuté['ind-lettre'].vuParSiège).toBeUndefined();
  });

  it('revealClue sans changement (déjà révélé au stade cible) : même Record, `vuParSiège` gardé', () => {
    const luAvant = lu(revealClue({}, IND, 100), 'ind-lettre');
    const again = revealClue(luAvant, IND, 150, 's1');
    expect(again).toBe(luAvant);
    expect(again['ind-lettre'].vuParSiège).toEqual({ 0: true });
  });

  it('marquerVus marque les seuls indices nommés, et garde le reste de l’état', () => {
    const deux = revealClue(revealClue({}, IND, 100), IND_MONO, 100);
    const out = marquerVus(deux, affichés(deux, ['ind-lettre']), 0);
    expect(out['ind-lettre']).toEqual<ClueState>({ stadeCourant: 's1', statut: 'révélé', épinglé: undefined, historique: [{ stade: 's1', at: 100 }], vuParSiège: { 0: true } });
    expect(out['ind-mono'].vuParSiège).toBeUndefined();
  });

  it('marquerVus déjà posé pour ce siège (ou id inconnu) : même Record', () => {
    const luAvant = lu(revealClue({}, IND, 100), 'ind-lettre');
    const inconnu: IndiceAffiché = { id: 'ind-inconnu', étapes: 1, statut: 'révélé', stadeCourant: 's1' };
    expect(marquerVus(luAvant, [...affichés(luAvant, ['ind-lettre']), inconnu], 0)).toBe(luAvant);
  });

  it('marquerVus ignore un indice qui a CHANGÉ depuis son affichage (stade avancé, statut basculé)', () => {
    const s1 = revealClue({}, IND, 100);
    const vuÀS1 = affichés(s1, ['ind-lettre']);
    const s2 = revealClue(s1, IND, 200, 's2');
    expect(marquerVus(s2, vuÀS1, 1), 'stade avancé depuis l’affichage').toBe(s2);
    const réfuté = discreditClue(s1, IND, 200);
    expect(marquerVus(réfuté, vuÀS1, 1), 'statut basculé depuis l’affichage').toBe(réfuté);
  });

  it('marquerVus ignore un indice dont seul `stadeCourant` a remonté depuis son affichage (historique et statut identiques)', () => {
    const enRetard: Record<string, ClueState> = {
      'ind-lettre': { stadeCourant: 's1', statut: 'révélé', historique: [{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }] },
    };
    const vuEnRetard = affichés(enRetard, ['ind-lettre']);
    const remonté = revealClue(enRetard, IND, 300, 's2');
    expect(remonté['ind-lettre'].stadeCourant, 'témoin : revealClue a remonté le stade courant').toBe('s2');
    expect(remonté['ind-lettre'].historique, 'témoin : même historique').toHaveLength(2);
    expect(remonté['ind-lettre'].statut, 'témoin : même statut').toBe('révélé');
    expect(estNouveauPour(marquerVus(remonté, vuEnRetard, 1)['ind-lettre'], 1), 's2 courant marqué vu sur l’affichage de s1').toBe(true);
  });

  it('togglePin (geste du joueur) garde `vuParSiège`', () => {
    const épinglé = togglePin(lu(revealClue({}, IND, 100), 'ind-lettre'), 'ind-lettre');
    expect(épinglé['ind-lettre'].épinglé).toBe(true);
    expect(épinglé['ind-lettre'].vuParSiège).toEqual({ 0: true });
  });
});

// ── Câblage store (#670) ────────────────────────────────────────────────────────────────────────
const narratif: NarratifBlock = {
  ...emptyNarratif(),
  affaires: [{ id: 'aff-corbeau', titre: 'Le Corbeau noir' }],
  indices: [IND, IND_MONO],
  presetsPnj: [],
  objets: [],
};

function hero(): Combatant {
  return ({
    id: 'a', label: 'A', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  }) as unknown as Combatant;
}

function fixtureScene(id: string): Scene {
  const s = emptyScene(6, 6);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

beforeEach(() => {
  useGame.setState({ campaignNarratif: null, party: [], scene: null, clues: {} });
});

describe('clues — câblage store (#670)', () => {
  it('applyEffects « revealClue » pose state.clues et journalise une ligne', () => {
    useGame.setState({ party: [hero()] });
    useGame.getState().loadProject([fixtureScene('scene-a')], 'scene-a', undefined, narratif);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    expect(useGame.getState().clues['ind-lettre'].stadeCourant).toBe('s1');
    expect(useGame.getState().journal.some((l) => l.includes('nouvel indice au carnet'))).toBe(true);
  });

  it('applyEffects « discreditClue » passe l’indice réfuté et journalise', () => {
    useGame.setState({ party: [hero()] });
    useGame.getState().loadProject([fixtureScene('scene-b')], 'scene-b', undefined, narratif);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'discreditClue', indiceId: 'ind-lettre' }]);
    expect(useGame.getState().clues['ind-lettre'].statut).toBe('réfuté');
    expect(useGame.getState().journal.some((l) => l.includes('fausse piste écartée'))).toBe(true);
  });

  it('state.clues SURVIT à une transition de scène (campagne-scopé, pas de reset scène)', () => {
    useGame.setState({ party: [hero()] });
    const sceneA = fixtureScene('scene-a2');
    const sceneB = fixtureScene('scene-b2');
    useGame.getState().loadProject([sceneA, sceneB], 'scene-a2', undefined, narratif);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    expect(useGame.getState().clues['ind-lettre']).toBeDefined();
    useGame.getState().transitionTo('scene-b2');
    expect(useGame.getState().scene?.id).toBe('scene-b2');
    expect(useGame.getState().clues['ind-lettre'].stadeCourant).toBe('s1'); // assertion POSITIVE, survit
  });

  it('nouvelle partie (startScene) REMET le carnet à vide', () => {
    useGame.setState({ party: [hero()] });
    useGame.getState().loadProject([fixtureScene('scene-c')], 'scene-c', undefined, narratif);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    expect(Object.keys(useGame.getState().clues)).toHaveLength(1);
    useGame.getState().startScene(fixtureScene('scene-d'));
    expect(useGame.getState().clues).toEqual({});
  });

  it('`markCluesSeen` marque le siège LOCAL hors intent (#2415)', () => {
    useGame.setState({ party: [hero()] });
    useGame.getState().loadProject([fixtureScene('scene-n')], 'scene-n', undefined, narratif);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    expect(estNouveauPour(useGame.getState().clues['ind-lettre'], 0)).toBe(true);
    useGame.getState().markCluesSeen(affichés(useGame.getState().clues, ['ind-lettre']));
    expect(useGame.getState().clues['ind-lettre'].vuParSiège).toEqual({ 0: true });
  });

  it('`markCluesSeen` appliqué AU NOM du siège 1 ne marque que lui : le siège 0 voit encore la nouveauté (#2415)', () => {
    useGame.setState({ party: [hero()] });
    useGame.getState().loadProject([fixtureScene('scene-p')], 'scene-p', undefined, narratif);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    withActingSeat(1, () => useGame.getState().markCluesSeen(affichés(useGame.getState().clues, ['ind-lettre'])));
    const c = useGame.getState().clues['ind-lettre'];
    expect(c.vuParSiège).toEqual({ 1: true });
    expect(estNouveauPour(c, 0), 'le marquage d’un invité a levé la nouveauté de l’hôte').toBe(true);
  });

  it('chez un invité, `markCluesSeen` PART en intent vers l’hôte et ne s’exécute pas localement (#2415)', () => {
    useGame.setState({ party: [hero()] });
    useGame.getState().loadProject([fixtureScene('scene-o')], 'scene-o', undefined, narratif);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    const local = useGame.getState().markCluesSeen;
    const envoyer = vi.fn();
    const vus = affichés(useGame.getState().clues, ['ind-lettre']);
    emettreIntentInvite('markCluesSeen', local as never, envoyer, [vus]);
    expect(envoyer).toHaveBeenCalledWith('markCluesSeen', [vus]);
    expect(useGame.getState().clues['ind-lettre'].vuParSiège, 'le marquage s’est joué EN LOCAL chez l’invité').toBeUndefined();
    // Câblage : le substitut RÉELLEMENT posé par `interceptGuestActions` (sans session, l'envoi est inerte).
    interceptGuestActions();
    try {
      expect(useGame.getState().markCluesSeen, 'markCluesSeen n’est pas enrobé en intent').not.toBe(local);
      useGame.getState().markCluesSeen(vus);
      expect(useGame.getState().clues['ind-lettre'].vuParSiège).toBeUndefined();
    } finally {
      restoreGuestActions();
    }
  });

  it('COURSE : l’intent du siège 1 arrive APRÈS que l’hôte a avancé l’indice — s2 reste nouveau pour lui (#2415)', () => {
    useGame.setState({ party: [hero()] });
    useGame.getState().loadProject([fixtureScene('scene-q')], 'scene-q', undefined, narratif);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    const affiché = affichés(useGame.getState().clues, ['ind-lettre']); // le Carnet du siège 1 affiche s1 et émet son intent
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre', stade: 's2' }]);
    withActingSeat(1, () => useGame.getState().markCluesSeen(affiché));
    const c = useGame.getState().clues['ind-lettre'];
    expect(c.stadeCourant).toBe('s2');
    expect(estNouveauPour(c, 1), 's2 est marqué vu pour un siège qui n’a affiché que s1').toBe(true);
  });

  it('toggleCluePin épingle/désépingle par l’action du store', () => {
    useGame.setState({ party: [hero()] });
    useGame.getState().loadProject([fixtureScene('scene-e')], 'scene-e', undefined, narratif);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    useGame.getState().toggleCluePin('ind-lettre');
    expect(useGame.getState().clues['ind-lettre'].épinglé).toBe(true);
  });

  describe('save/load RÉEL (applyLoadedSave, #670)', () => {
    beforeEach(() => {
      (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
      deleteSlot(1);
    });
    afterEach(() => { deleteSlot(1); });

    it('un indice révélé+épinglé et un autre réfuté survivent à un vrai saveGame → loadGame', () => {
      useGame.setState({ party: [hero()] });
      useGame.getState().loadProject([fixtureScene('scene-f')], 'scene-f', undefined, narratif);
      applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
      useGame.getState().toggleCluePin('ind-lettre');
      applyEffects(useGame.getState, useGame.setState, [{ type: 'discreditClue', indiceId: 'ind-mono' }]);
      const before = useGame.getState().clues;
      expect(before['ind-lettre'].épinglé).toBe(true);
      expect(before['ind-mono'].statut).toBe('réfuté');
      expect(useGame.getState().saveGame(1)).toBe(true);
      useGame.setState({ clues: {} }); // « nouvelle partie » — état écrasé avant le chargement
      expect(useGame.getState().clues).toEqual({});
      expect(useGame.getState().loadGame(1)).toBe(true);
      expect(useGame.getState().clues).toEqual(before);
    });

    it('tolérance PAR CONSTRUCTION : clé « clues » absente du snapshot → valeur initiale ({}) au chargement', () => {
      useGame.setState({ party: [hero()] });
      useGame.getState().loadProject([fixtureScene('scene-g')], 'scene-g', undefined, narratif);
      applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
      expect(useGame.getState().saveGame(1)).toBe(true);
      const withClues = readSlot(1)!;
      const dataSansClues = { ...withClues.data } as Record<string, unknown>;
      delete dataSansClues.clues;
      // La save est écrite à la version COURANTE, clé `clues` RETIRÉE : c'est le filet n°1 de la
      // politique de version (champ manquant → `initialFields`), pas une save d'une autre version.
      saveToSlot(1, { ...withClues, data: dataSansClues } as unknown as SaveGame);
      expect(useGame.getState().loadGame(1)).toBe(true);
      expect(useGame.getState().clues).toEqual({});
    });
  });
});
