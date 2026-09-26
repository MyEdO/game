/**
 * LE VERBE VALIDE — `chooseDialogue` refuse tout ce que les surfaces refusent (#1869 correctif 1).
 *
 * Les gardes d'une réponse ne vivent PAS dans la fenêtre ni dans la touche : elles vivent dans le
 * VERBE, seul chemin commun du clic, du raccourci et de l'intent coop appliqué par l'hôte. Un intent
 * FORGÉ (index d'une réponse masquée, réponse trop chère) et une touche restée vive sous une modale
 * arrivent tous ici, et repartent sans rien changer.
 *
 * Contrats POSITIFS : l'état ne bouge pas (nœud, archive, bourse, pending), et le `when` de la touche
 * dit la MÊME chose que le verbe (`conversationRepond`, prédicat unique).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { KEYBINDINGS } from './keybindings';
import { conversationRepond } from './dialogue';
import { partyMoneyTotal } from './bourseFlow';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import { makeRNG } from '../engine/dice';
import { toBrass } from '../engine/money';
import type { Combatant } from '../engine/types';
import type { Dialogue } from './scene';
import type { GameState } from './store';

const hero = (brass = 0): Combatant =>
  withBourseMoney(createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) }), { gold: 0, silver: 0, brass });

/** Un nœud, trois réponses : un Test, une MASQUÉE par son `when`, une PAYANTE hors de portée. */
const dlg: Dialogue = {
  id: 'd-garde', start: 'n1',
  nodes: [
    { id: 'n1', desc: '…', choices: [
      { label: 'Tenter', next: 'n2', flow: { kind: 'test', test: { characteristic: 'force', label: 'Force' }, success: { kind: 'seq', steps: [] }, fail: { kind: 'seq', steps: [] } } },
      { label: 'Secret', next: 'n2', when: { kind: 'flag', expr: 'jamais' } },
      { label: 'Acheter', next: 'n2', cost: { gold: 5 } },
    ] },
    { id: 'n2', desc: 'Suite', choices: [] },
  ],
} as Dialogue;

const touche = (n: number) => KEYBINDINGS.find((k) => k.id === `dialogue-choice-${n}`)!;

function monter(over: Partial<GameState> = {}) {
  useGame.setState({
    battle: null, scene: null, mode: 'exploration', flags: {}, journal: [], pendingTest: null,
    party: [hero(12)], dialogueHistory: [],
    dialogue: { dialogue: dlg, nodeId: 'n1', session: 1 },
    ...over,
  } as Partial<GameState>);
}

beforeEach(() => monter());

describe('chooseDialogue — la fenêtre de jet SUSPEND la conversation', () => {
  it('une seconde réponse sous la modale de jet n’archive rien et n’écrase pas le pending', () => {
    useGame.getState().chooseDialogue(0);
    const avant = useGame.getState();
    expect(avant.pendingTest, 'le Test a bien ouvert la fenêtre de jet ORDINAIRE').toBeTruthy();
    expect(avant.dialogueHistory).toHaveLength(1);
    const pendingAvant = avant.pendingTest;

    useGame.getState().chooseDialogue(0); // le joueur re-clique / la touche est restée vive

    const apres = useGame.getState();
    expect(apres.dialogueHistory, 'un second tour archivé serait une réponse jouée deux fois').toHaveLength(1);
    expect(apres.pendingTest, 'le pending — et son `dialogueNext` — ne doit pas être remplacé').toBe(pendingAvant);
  });

  it('la TOUCHE dit la même chose que le verbe : fermée sous la modale, ouverte sans elle', () => {
    expect(touche(1).when(useGame.getState())).toBe(true);
    useGame.getState().chooseDialogue(0);
    expect(touche(1).when(useGame.getState()), 'la fenêtre de jet tient la main : la touche se tait').toBe(false);
    expect(conversationRepond(useGame.getState())).toBe(false);
  });
});

describe('chooseDialogue — un index que le joueur ne peut PAS choisir est refusé', () => {
  it('réponse MASQUÉE par son `when` (intent forgé) : rien n’avance', () => {
    useGame.getState().chooseDialogue(1);
    expect(useGame.getState().dialogue?.nodeId).toBe('n1');
    expect(useGame.getState().dialogueHistory).toHaveLength(0);
  });

  it('réponse trop CHÈRE : refus SANS débit (la bourse est intacte)', () => {
    const avant = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().chooseDialogue(2);
    expect(useGame.getState().dialogue?.nodeId).toBe('n1');
    expect(toBrass(partyMoneyTotal(useGame.getState)), 'le coût ne se paie pas sur un refus').toBe(avant);
    expect(useGame.getState().dialogueHistory).toHaveLength(0);
  });

  it('réponse payante ACCESSIBLE : elle passe, et le coût est débité une fois', () => {
    // Contrat POSITIF opposé : la garde refuse ce qui doit l'être, et LAISSE passer le reste.
    monter({ party: [hero(2400)] });
    const avant = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().chooseDialogue(2);
    expect(useGame.getState().dialogue?.nodeId).toBe('n2');
    expect(avant - toBrass(partyMoneyTotal(useGame.getState))).toBe(toBrass({ gold: 5, silver: 0, brass: 0 }));
  });

  it('index HORS de la donnée : rien n’avance', () => {
    useGame.getState().chooseDialogue(42);
    expect(useGame.getState().dialogue?.nodeId).toBe('n1');
    expect(useGame.getState().dialogueHistory).toHaveLength(0);
  });
});

describe('chooseDialogue — le siège qui ne DÉCIDE pas n’avance rien', () => {
  it('invité coop hors décision : le verbe refuse (le snapshot n’a rien à écraser)', () => {
    monter({ net: { ...useGame.getState().net, mode: 'guest', mySeat: 1, gmSeat: 0 } as GameState['net'] });
    useGame.getState().chooseDialogue(0);
    expect(useGame.getState().dialogue?.nodeId).toBe('n1');
    expect(useGame.getState().pendingTest).toBeNull();
    expect(useGame.getState().dialogueHistory).toHaveLength(0);
  });
});
