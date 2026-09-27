// @vitest-environment jsdom
/**
 * DialogueBox — résolution du locuteur 100 % PAR ID (#669) : `DialogueNode.speakerId` (nœud) ou
 * `dialogue.speakerId` (session) référence une `SceneEntity` de la scène → SON `label` sert de nom
 * affiché. Preuve : deux entités distinctes (e1/e2), deux nœuds — un sans `speakerId` (retombe sur
 * la session) puis un avec `speakerId: 'e2'` — le nom affiché passe d'Alice à Bob. Patron réel du
 * repo pour les tests interactifs (`createRoot`/`act`, cf. `EtatPanel.behavior.test.tsx`) —
 * `@testing-library` n'est pas une dépendance de ce dépôt.
 */
import { describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DialogueBox } from './DialogueBox';
import { useGame } from '../state/store';
import { campaignStart } from '../engine/clock';
import type { Dialogue, SceneEntity } from '../state/scene';
import type { Scene } from '../state/scene';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import { spellMoney, toMoney } from '../engine/money';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const alice: SceneEntity = { id: 'e1', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, label: 'Alice' };
const bob: SceneEntity = { id: 'e2', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 0 }, label: 'Bob' };

const dlg: Dialogue = {
  id: 'dlg-test',
  start: 'n1',
  nodes: [
    { id: 'n1', desc: 'Réplique de session.', choices: [{ label: 'Suite', next: 'n2' }] },
    { id: 'n2', speakerId: 'e2', desc: 'Réplique de Bob.', choices: [] },
  ],
};

const scene: Scene = { id: 'scn', nom: 'Scène de test', desc: '', size: [4, 4], entities: [alice, bob], dialogues: [dlg], triggers: [], encounters: [] } as unknown as Scene;

describe('DialogueBox — résolution du locuteur PAR ID (#669)', () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount(nodeId: string) {
    useGame.setState({
      scene,
      flags: {},
      gameTime: campaignStart(),
      party: [],
      dialogue: { dialogue: dlg, nodeId, speakerId: 'e1', session: 1 },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<DialogueBox />); });
  }

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    useGame.setState({ dialogue: null });
  });

  it('nœud SANS speakerId : retombe sur le locuteur de SESSION (Alice)', () => {
    mount('n1');
    expect(container.querySelector('.dlg-speaker')?.textContent).toBe('Alice');
  });

  it('nœud AVEC speakerId : alterne vers l’entité référencée (Bob), sans toucher la session', () => {
    mount('n2');
    expect(container.querySelector('.dlg-speaker')?.textContent).toBe('Bob');
  });
});

/**
 * CE QUE LA RÉPONSE ANNONCE (#1869) : « N. [Compétence — Difficulté] libellé », composé à partir du
 * FLUX. Mesuré sur le NOM ACCESSIBLE du bouton (ce qu'un joueur lit, ce qu'un lecteur d'écran dit),
 * jamais sur une classe CSS.
 */
const dlgTeste: Dialogue = {
  id: 'dlg-tag', start: 'n1',
  nodes: [{ id: 'n1', desc: 'La cage est là.', choices: [
    { label: 'Crocheter la cage.', flow: { kind: 'test', test: { skill: { id: 'crochetage' }, difficulty: 'accessible', label: 'Crocheter la cage du garde-manger' }, success: { kind: 'seq', steps: [] }, fail: { kind: 'seq', steps: [] } } },
    { label: 'Renoncer.' },
  ] }],
} as Dialogue;

describe('DialogueBox — numéro et Test annoncé (#1869)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useGame.setState({
      scene: { ...scene, dialogues: [dlgTeste] } as Scene,
      flags: {}, gameTime: campaignStart(), party: [],
      dialogue: { dialogue: dlgTeste, nodeId: 'n1', speakerId: 'e1', session: 2 },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<DialogueBox />); });
  });
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    useGame.setState({ dialogue: null });
  });

  const noms = () => Array.from(container.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));

  it('chaque réponse porte son NUMÉRO, dans l’ordre de la liste visible', () => {
    expect(noms()[0]?.startsWith('1. ')).toBe(true);
    expect(noms()[1]?.startsWith('2. ')).toBe(true);
  });

  it('la réponse à Test porte le TAG dérivé de son flux — Compétence et Difficulté résolues au registre', () => {
    expect(noms()[0]).toBe('1. [Crochetage — Accessible (+20)] Crocheter la cage.');
  });

  it('la réponse SANS Test ne porte aucun tag (rien à annoncer)', () => {
    expect(noms()[1]).toBe('2. Renoncer.');
  });

  it('tag et libellé forment UN bloc de texte, frère du seul numéro : ils refluent d’un tenant', () => {
    const bouton = container.querySelectorAll('button')[0];
    const blocs = Array.from(bouton.querySelectorAll('span')).filter((el) => el.textContent === '[Crochetage — Accessible (+20)] Crocheter la cage.');
    expect(blocs, 'un élément porte le tag PUIS le libellé').toHaveLength(1);
    expect(blocs[0].parentElement?.textContent, 'à côté du bloc : le numéro, rien d’autre').toBe('1.[Crochetage — Accessible (+20)] Crocheter la cage.');
  });
});

/**
 * LA FENÊTRE SUIT L'ÉTAT (#1869 correctif 2, condition 4) : la liste affichée est ABONNÉE au résultat
 * de `reponsesDuNoeud`, jamais à une liste d'entrées recopiée. Boîte montée, conversation inchangée :
 * un `flag` qui bascule RENUMÉROTE à l'écran, une bourse qui redevient suffisante ROUVRE la réponse.
 */
const dlgVivant: Dialogue = {
  id: 'dlg-vivant', start: 'n1',
  nodes: [{ id: 'n1', desc: 'Le passeur attend.', choices: [
    { label: 'Montrer le laissez-passer.', when: { kind: 'flag', expr: 'laissez_passer' } },
    { label: 'Attendre.' },
    { label: 'Payer le passage.', cost: { gold: 1 } },
  ] }],
} as Dialogue;

describe('DialogueBox — la fenêtre suit l’état sans que la conversation bouge (#1869)', () => {
  let container: HTMLDivElement;
  let root: Root;
  const hero = (gold: number) =>
    withBourseMoney(createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 }), { gold, silver: 0, brass: 0 });

  beforeEach(() => {
    useGame.setState({
      scene: { ...scene, dialogues: [dlgVivant] } as Scene,
      flags: {}, gameTime: campaignStart(), party: [hero(0)],
      dialogue: { dialogue: dlgVivant, nodeId: 'n1', speakerId: 'e1', session: 3 },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<DialogueBox />); });
  });
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    useGame.setState({ dialogue: null });
  });

  const boutons = () => Array.from(container.querySelectorAll('button'));
  const noms = () => boutons().map((b) => b.getAttribute('aria-label'));
  /** Le coût, tel que l'épellation canon le dit (le `title` de la puce `Coins`). */
  const COUT = spellMoney(toMoney({ gold: 1 }));

  it('un flag qui bascule RENUMÉROTE les réponses à l’écran', () => {
    expect(noms()).toEqual(['1. Attendre.', `2. Payer le passage. ${COUT}`]);
    act(() => { useGame.setState({ flags: { laissez_passer: true } }); });
    expect(noms()).toEqual(['1. Montrer le laissez-passer.', '2. Attendre.', `3. Payer le passage. ${COUT}`]);
  });

  it('le nom ACCESSIBLE d’une réponse payante dit son coût, là où l’écran le montre (après le libellé)', () => {
    // `aria-label` REMPLACE le contenu du bouton : la puce `Coins` n'est lue que si le nom la porte.
    expect(noms()[1]).toBe(`2. Payer le passage. ${COUT}`);
    expect(COUT).toContain('couronne');
  });

  it('une bourse qui redevient suffisante ROUVRE la réponse payante à l’écran', () => {
    const payer = () => boutons().find((b) => b.getAttribute('aria-label') === `2. Payer le passage. ${COUT}`)!;
    expect(payer().getAttribute('aria-disabled')).toBe('true');
    act(() => { useGame.setState({ party: [hero(5)] }); });
    expect(payer().getAttribute('aria-disabled')).toBeNull();
  });
});
