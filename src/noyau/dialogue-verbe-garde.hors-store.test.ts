/**
 * LE VERBE VALIDE — le choix `dialogue.reponse` refuse tout ce que les surfaces refusent (#1869 correctif 1).
 *
 * Les gardes d'une réponse ne vivent PAS dans la fenêtre ni dans la touche : elles vivent dans le
 * VERBE, seul chemin commun du clic, du raccourci et de l'intent coop appliqué par l'hôte. Un intent
 * FORGÉ (index d'une réponse masquée, réponse trop chère) et une touche restée vive sous une modale
 * arrivent tous ici, et repartent sans rien changer.
 *
 * Contrats POSITIFS : l'état ne bouge pas (nœud, archive, bourse, pending). Le prédicat unique des portes d'une
 * réponse est `conversationRepond`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { partyMoneyTotal } from './bourseFlow';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import { toBrass } from '../engine/money';
import type { Combatant } from '../engine/types';
import type { Dialogue } from './monde/scene';
import type { Jeu } from './etat';

const hero = (brass = 0): Combatant =>
  withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 }), { gold: 0, silver: 0, brass }, idsDeTest);

/** Un nœud, trois réponses : un Test, une MASQUÉE par son `when`, une PAYANTE hors de portée. */
const dlg: Dialogue = {
  id: 'd-garde', start: { id: 'n1' },
  nodes: [
    { id: 'n1', desc: '…', choices: [
      { id: 'tenter', label: 'Tenter', next: { id: 'n2' }, flow: { kind: 'test', test: { characteristic: 'force', label: 'Force' }, reussite: { kind: 'sequence', etapes: [] }, echec: { kind: 'sequence', etapes: [] } } },
      { id: 'secret', label: 'Secret', next: { id: 'n2' }, when: { kind: 'flag', expr: 'jamais' } },
      { id: 'acheter', label: 'Acheter', next: { id: 'n2' }, cost: { gold: 5 } },
    ] },
    { id: 'n2', desc: 'Suite', choices: [] },
  ],
} as Dialogue;

function monter(over: Partial<Jeu> = {}) {
  banc.setState({
    screen: 'campaign', battle: null, scene: null, mode: 'exploration', flags: {}, journal: [], pendingTest: null,
    party: [hero(12)], dialogueHistory: [],
    dialogue: { dialogue: dlg, nodeId: 'n1', session: 1 },
    ...over,
  } as Partial<Jeu>);
}

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); monter(); });

describe('dialogue.reponse — la fenêtre de jet SUSPEND la conversation', () => {
  it('une seconde réponse sous la modale de jet n’archive rien et n’écrase pas le pending', () => {
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'tenter');
    const avant = banc.getState();
    expect(avant.pendingTest, 'le Test a bien ouvert la fenêtre de jet ORDINAIRE').toBeTruthy();
    expect(avant.dialogueHistory).toHaveLength(1);
    const pendingAvant = avant.pendingTest;

    banc.getState().fenetreChoisir('dialogue', 'reponse', 'tenter'); // le joueur re-clique / la touche est restée vive

    const apres = banc.getState();
    expect(apres.dialogueHistory, 'un second tour archivé serait une réponse jouée deux fois').toHaveLength(1);
    expect(apres.pendingTest, 'le pending — et son `dialogueNext` — ne doit pas être remplacé').toBe(pendingAvant);
  });

});

describe('dialogue.reponse — un id que le joueur ne peut PAS choisir est refusé', () => {
  it('réponse MASQUÉE par son `when` (intent forgé) : rien n’avance', () => {
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'secret');
    expect(banc.getState().dialogue?.nodeId).toBe('n1');
    expect(banc.getState().dialogueHistory).toHaveLength(0);
  });

  it('réponse trop CHÈRE : refus SANS débit (la bourse est intacte)', () => {
    const avant = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'acheter');
    expect(banc.getState().dialogue?.nodeId).toBe('n1');
    expect(toBrass(partyMoneyTotal(banc.getState)), 'le coût ne se paie pas sur un refus').toBe(avant);
    expect(banc.getState().dialogueHistory).toHaveLength(0);
  });

  it('réponse payante ACCESSIBLE : elle passe, et le coût est débité une fois', () => {
    // Contrat POSITIF opposé : la garde refuse ce qui doit l'être, et LAISSE passer le reste.
    monter({ party: [hero(2400)] });
    const avant = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'acheter');
    expect(banc.getState().dialogue?.nodeId).toBe('n2');
    expect(avant - toBrass(partyMoneyTotal(banc.getState))).toBe(toBrass({ gold: 5, silver: 0, brass: 0 }));
  });

  it('id HORS de la donnée : rien n’avance', () => {
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'inconnu');
    expect(banc.getState().dialogue?.nodeId).toBe('n1');
    expect(banc.getState().dialogueHistory).toHaveLength(0);
  });
});

describe('dialogue.reponse — le siège qui ne DÉCIDE pas n’avance rien', () => {
  it('invité coop hors décision : le verbe refuse (le snapshot n’a rien à écraser)', () => {
    monter({ net: { ...banc.getState().net, mode: 'invite', mySeat: 1, gmSeat: 0 } as Jeu['net'] });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'tenter');
    expect(banc.getState().dialogue?.nodeId).toBe('n1');
    expect(banc.getState().pendingTest).toBeNull();
    expect(banc.getState().dialogueHistory).toHaveLength(0);
  });
});
