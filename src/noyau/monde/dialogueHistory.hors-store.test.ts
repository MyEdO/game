/**
 * #718 — Archive verbatim des tours de dialogue : helper pur (`recordTurn`), résolution du
 * locuteur (`speakerEntity`), câblage le choix `dialogue.reponse`, survie cross-scène, reset nouvelle partie,
 * save/load, sur le banc du noyau.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { recordTurn, DIALOGUE_HISTORY_CAP, type DialogueTurn } from './dialogueHistory';
import { speakerEntity, type Dialogue, type SceneEntity } from './scene';
import { addEntity } from '../sceneEdit';
import { nextEntityId } from '../../lib/entityId';
import { ficheDEntite } from './sceneNpc';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { createHero } from '../../engine/character';
import { testScene } from '../../scenes/test-fixture';
import { chargerSurLeBanc, sansLaCleDeJeu, sauverLeBanc } from '../persistance/save.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const hero = () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });

/** Dialogue à deux nœuds ; n1 porte un override `speakerId`, n2 hérite du speaker de session. */
function makeDialogue(): Dialogue {
  return {
    id: 'd-archive', start: { id: 'n1' },
    nodes: [
      { id: 'n1', speakerId: { id: 'pnj-2' }, desc: 'Bonjour, voyageur.', choices: [{ id: 'salut', label: 'Salut.', next: { id: 'n2' } }] },
      { id: 'n2', desc: 'Autre chose ?', choices: [{ id: 'non-merci', label: 'Non merci.' }] },
    ],
  };
}

const entities: SceneEntity[] = [
  { id: 'pnj-1', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 0, y: 0 }, label: 'Aubergiste' },
  { id: 'pnj-2', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 0 }, label: 'Garde' },
];

describe('recordTurn (helper pur)', () => {
  const turn = (n: number): DialogueTurn => ({ nodeText: `n${n}`, choiceText: `c${n}`, at: n, dialogueId: 'd', session: 1 });

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

describe('speakerEntity (helper pur)', () => {
  const dialogue = { speakerId: 'pnj-1' };

  it('override du nœud prime sur le speaker de session', () => {
    expect(speakerEntity(entities, { speakerId: { id: 'pnj-2' } }, dialogue)?.id).toBe('pnj-2');
  });

  it('sans override, retombe sur le speaker de session', () => {
    expect(speakerEntity(entities, {}, dialogue)?.id).toBe('pnj-1');
  });

  it('aucun speaker (ni nœud ni session) → undefined', () => {
    expect(speakerEntity(entities, {}, {})).toBeUndefined();
  });

  it('id inconnu de la scène → undefined', () => {
    expect(speakerEntity(entities, { speakerId: { id: 'fantome' } }, dialogue)).toBeUndefined();
  });
});

describe('dialogue.reponse — archivage (#718)', () => {
  beforeEach(() => {
    banc.setState({ screen: 'campaign', battle: null, scene: null, mode: 'exploration', flags: {}, journal: [], dialogueHistory: [], pendingTest: null, dialogue: null });
  });

  it('un choix archive un DialogueTurn : nodeText/choiceText/speaker/dialogueId corrects', () => {
    banc.setState({
      party: [hero()],
      scene: { ...testScene(), entities: [...testScene().entities, ...entities] },
      dialogue: { dialogue: makeDialogue(), nodeId: 'n1', session: 7 },
    });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'salut');
    const h = banc.getState().dialogueHistory;
    expect(h.length).toBe(1);
    expect(h[0]).toMatchObject({
      speaker: 'Garde', // override n1.speakerId, pas le speaker de session (absent ici)
      nodeText: 'Bonjour, voyageur.',
      choiceText: 'Salut.',
      dialogueId: 'd-archive',
      sceneId: testScene().id,
      session: 7, // la SESSION de la conversation ouverte, recopiée sur le tour archivé
    });
  });

  it('un locuteur POSÉ à l’éditeur, sans libellé, archive le nom de sa fiche (#1463 S3)', () => {
    const base = testScene();
    const id = nextEntityId('personnage', base.entities.map((e) => e.id));
    const pose = { scene: addEntity(base, { id, kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 } }), id };
    const ent = pose.scene.entities.find((e) => e.id === pose.id)!;
    expect(ent).not.toHaveProperty('label');
    banc.setState({
      party: [hero()],
      scene: pose.scene,
      dialogue: { dialogue: { ...makeDialogue(), nodes: makeDialogue().nodes.map(({ speakerId: _s, ...n }) => n) }, nodeId: 'n1', speakerId: pose.id, session: 3 },
    });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'salut');
    expect(banc.getState().dialogueHistory[0].speaker).toBe(ficheDEntite(ent, () => undefined).label);
  });

  it('deux choix successifs archivent DEUX tours distincts', () => {
    banc.setState({
      party: [hero()],
      scene: { ...testScene(), entities: [...testScene().entities, ...entities] },
      dialogue: { dialogue: makeDialogue(), nodeId: 'n1', session: 7 },
    });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'salut');
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'non-merci'); // le nœud courant est n2
    const h = banc.getState().dialogueHistory;
    expect(h.length).toBe(2);
    expect(h[1].nodeText).toBe('Autre chose ?');
    expect(h[1].choiceText).toBe('Non merci.');
  });
});

describe('dialogueHistory / journal — survie cross-scène (quitterLaScene)', () => {
  it('les DEUX slots SURVIVENT à une transition de scène (campagne-scopés)', () => {
    banc.setState({ screen: 'campaign', battle: null, mode: 'exploration', flags: {}, dialogue: null, pendingTest: null });
    banc.getState().lancerLaScene(testScene());
    banc.setState({ party: [hero()] });
    banc.getState().ecrireAuJournal('événement récent');
    banc.setState({ dialogueHistory: [{ nodeText: 'n', choiceText: 'c', at: 0, dialogueId: 'd', session: 1 }] });
    banc.getState().quitterLaScene(testScene().id);
    expect(banc.getState().dialogueHistory.length).toBe(1);
    expect(banc.getState().journal).toContain('événement récent');
  });
});

describe('lancerLaScene (nouvelle partie) — reset', () => {
  it('remet dialogueHistory ET journal à leur état neuf', () => {
    banc.setState({
      party: [hero()],
      dialogueHistory: [{ nodeText: 'n', choiceText: 'c', at: 0, dialogueId: 'd', session: 1 }],
      journal: ['un vieux message'],
    });
    banc.getState().lancerLaScene(testScene());
    expect(banc.getState().dialogueHistory).toEqual([]);
    expect(banc.getState().journal).not.toContain('un vieux message');
  });
});

describe('save/load — dialogueHistory round-trip', () => {
  beforeEach(() => {
    banc.getState().lancerLaScene(testScene());
    banc.setState({ party: [hero()] });
  });

  it('un dialogueHistory non vide survit à un save → nouvelle partie → load', () => {
    const seeded: DialogueTurn[] = [{ speaker: 'Garde', nodeText: 'n1', choiceText: 'c1', at: 5, dialogueId: 'd-archive', sceneId: testScene().id, session: 3 }];
    banc.setState({ dialogueHistory: seeded });
    const texte = sauverLeBanc(banc);
    banc.getState().lancerLaScene(testScene()); // « nouvelle partie » : dialogueHistory repart à zéro
    expect(banc.getState().dialogueHistory).toEqual([]);
    chargerSurLeBanc(banc, texte);
    expect(banc.getState().dialogueHistory).toEqual(seeded);
  });

  it('un save ANTÉRIEUR à #718 (data sans dialogueHistory) se charge sans crash → historique vide', () => {
    banc.setState({ dialogueHistory: [{ nodeText: 'n', choiceText: 'c', at: 0, dialogueId: 'd', session: 1 }] });
    // une save dont le `data` ne porte PAS la clé : elle est optionnelle au chargement
    const texte = sansLaCleDeJeu(sauverLeBanc(banc), 'dialogueHistory');
    banc.getState().lancerLaScene(testScene());
    chargerSurLeBanc(banc, texte);
    expect(banc.getState().dialogueHistory).toEqual([]);
  });
});
