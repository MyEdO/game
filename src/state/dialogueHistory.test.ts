/**
 * #718 — Archive verbatim des tours de dialogue : helper pur (`recordTurn`), résolution du
 * locuteur (`speakerLabel`), câblage `chooseDialogue`, survie cross-scène, reset nouvelle partie,
 * save/load.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { recordTurn, DIALOGUE_HISTORY_CAP, type DialogueTurn } from './dialogueHistory';
import { speakerLabel, type Dialogue, type SceneEntity } from './scene';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { deleteSlot, readSlot, saveToSlot } from './saves';

const hero = () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });

/** Dialogue à deux nœuds ; n1 porte un override `speakerId`, n2 hérite du speaker de session. */
function makeDialogue(): Dialogue {
  return {
    id: 'd-archive', start: 'n1',
    nodes: [
      { id: 'n1', speakerId: 'pnj-2', desc: 'Bonjour, voyageur.', choices: [{ label: 'Salut.', next: 'n2' }] },
      { id: 'n2', desc: 'Autre chose ?', choices: [{ label: 'Non merci.' }] },
    ],
  };
}

const entities: SceneEntity[] = [
  { id: 'pnj-1', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, label: 'Aubergiste' },
  { id: 'pnj-2', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 0 }, label: 'Garde' },
];

describe('recordTurn (helper pur)', () => {
  const turn = (n: number): DialogueTurn => ({ nodeText: `n${n}`, choiceText: `c${n}`, at: n, dialogueId: 'd' });

  it('ajoute un tour en fin d’historique', () => {
    const h = recordTurn([turn(1)], turn(2));
    expect(h).toEqual([turn(1), turn(2)]);
  });

  it('ne mute pas l’historique reçu', () => {
    const original = [turn(1)];
    recordTurn(original, turn(2));
    expect(original).toEqual([turn(1)]);
  });

  it('borne à `cap` (fenêtre glissante, garde les DERNIERS tours)', () => {
    let h: DialogueTurn[] = [];
    for (let i = 0; i < 5; i++) h = recordTurn(h, turn(i), 3);
    expect(h.map((t) => t.nodeText)).toEqual(['n2', 'n3', 'n4']);
  });

  it('cap par défaut = DIALOGUE_HISTORY_CAP', () => {
    let h: DialogueTurn[] = [];
    for (let i = 0; i < DIALOGUE_HISTORY_CAP + 10; i++) h = recordTurn(h, turn(i));
    expect(h.length).toBe(DIALOGUE_HISTORY_CAP);
    expect(h[0].nodeText).toBe(`n${10}`);
  });
});

describe('speakerLabel (helper pur)', () => {
  const dialogue = { speakerId: 'pnj-1' };

  it('override du nœud prime sur le speaker de session', () => {
    expect(speakerLabel(entities, { speakerId: 'pnj-2' }, dialogue)).toBe('Garde');
  });

  it('sans override, retombe sur le speaker de session', () => {
    expect(speakerLabel(entities, {}, dialogue)).toBe('Aubergiste');
  });

  it('aucun speaker (ni nœud ni session) → undefined', () => {
    expect(speakerLabel(entities, {}, {})).toBeUndefined();
  });

  it('id inconnu de la scène → undefined', () => {
    expect(speakerLabel(entities, { speakerId: 'fantome' }, dialogue)).toBeUndefined();
  });
});

describe('chooseDialogue — archivage (#718)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, scene: null, mode: 'exploration', flags: {}, journal: [], dialogueHistory: [], pendingTest: null, dialogue: null });
  });

  it('un choix archive un DialogueTurn : nodeText/choiceText/speaker/dialogueId corrects', () => {
    useGame.setState({
      party: [hero()],
      scene: { ...testScene, entities: [...testScene.entities, ...entities] },
      dialogue: { dialogue: makeDialogue(), nodeId: 'n1' },
    });
    useGame.getState().chooseDialogue(0);
    const h = useGame.getState().dialogueHistory;
    expect(h.length).toBe(1);
    expect(h[0]).toMatchObject({
      speaker: 'Garde', // override n1.speakerId, pas le speaker de session (absent ici)
      nodeText: 'Bonjour, voyageur.',
      choiceText: 'Salut.',
      dialogueId: 'd-archive',
      sceneId: testScene.id,
    });
  });

  it('deux choix successifs archivent DEUX tours distincts', () => {
    useGame.setState({
      party: [hero()],
      scene: { ...testScene, entities: [...testScene.entities, ...entities] },
      dialogue: { dialogue: makeDialogue(), nodeId: 'n1' },
    });
    useGame.getState().chooseDialogue(0);
    useGame.getState().chooseDialogue(0); // le nœud courant est n2
    const h = useGame.getState().dialogueHistory;
    expect(h.length).toBe(2);
    expect(h[1].nodeText).toBe('Autre chose ?');
    expect(h[1].choiceText).toBe('Non merci.');
  });
});

describe('dialogueHistory / journal — survie cross-scène (transitionTo)', () => {
  it('les DEUX slots SURVIVENT à une transition de scène (campagne-scopés)', () => {
    useGame.setState({ battle: null, mode: 'exploration', flags: {}, dialogue: null, pendingTest: null });
    useGame.getState().startScene(testScene);
    useGame.setState({ party: [hero()] });
    useGame.getState().log('événement récent');
    useGame.setState({ dialogueHistory: [{ nodeText: 'n', choiceText: 'c', at: 0, dialogueId: 'd' }] });
    useGame.getState().transitionTo(testScene.id);
    expect(useGame.getState().dialogueHistory.length).toBe(1);
    expect(useGame.getState().journal).toContain('événement récent');
  });
});

describe('startScene (nouvelle partie) — reset', () => {
  it('remet dialogueHistory ET journal à leur état neuf', () => {
    useGame.setState({
      party: [hero()],
      dialogueHistory: [{ nodeText: 'n', choiceText: 'c', at: 0, dialogueId: 'd' }],
      journal: ['un vieux message'],
    });
    useGame.getState().startScene(testScene);
    expect(useGame.getState().dialogueHistory).toEqual([]);
    expect(useGame.getState().journal).not.toContain('un vieux message');
  });
});

describe('save/load — dialogueHistory round-trip', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = (() => {
      const m = new Map<string, string>();
      return {
        getItem: (k: string) => m.get(k) ?? null,
        setItem: (k: string, v: string) => void m.set(k, String(v)),
        removeItem: (k: string) => void m.delete(k),
        clear: () => m.clear(),
        key: (i: number) => [...m.keys()][i] ?? null,
        get length() { return m.size; },
      } as Storage;
    })();
    deleteSlot(1);
    useGame.setState({ battle: null });
    useGame.getState().startScene(testScene);
    useGame.setState({ party: [hero()] });
  });

  it('un dialogueHistory non vide survit à un save → nouvelle partie → load', () => {
    const seeded: DialogueTurn[] = [{ speaker: 'Garde', nodeText: 'n1', choiceText: 'c1', at: 5, dialogueId: 'd-archive', sceneId: testScene.id }];
    useGame.setState({ dialogueHistory: seeded });
    expect(useGame.getState().saveGame(1)).toBe(true);
    useGame.getState().startScene(testScene); // « nouvelle partie » : dialogueHistory repart à zéro
    expect(useGame.getState().dialogueHistory).toEqual([]);
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().dialogueHistory).toEqual(seeded);
  });

  it('un save ANTÉRIEUR à #718 (data sans dialogueHistory) se charge sans crash → historique vide', () => {
    useGame.setState({ dialogueHistory: [{ nodeText: 'n', choiceText: 'c', at: 0, dialogueId: 'd' }] });
    expect(useGame.getState().saveGame(1)).toBe(true);
    const saved = readSlot(1)!;
    const data = { ...(saved.data as Record<string, unknown>) };
    delete data.dialogueHistory; // une save dont le `data` ne porte PAS la clé : elle est optionnelle au chargement
    expect(saveToSlot(1, { ...saved, data } as typeof saved)).toBe(true);
    useGame.getState().startScene(testScene);
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().dialogueHistory).toEqual([]);
  });
});
