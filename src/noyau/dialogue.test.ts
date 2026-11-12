/**
 * CE QU'UNE RÉPONSE OFFRE ET ANNONCE VIENT DE SA DONNÉE (#1869) — contrats POSITIFS du vocabulaire
 * pur du dialogue (`noyau/dialogue.ts`), la SOURCE UNIQUE que la fenêtre et les touches consomment :
 *  · le RANG est celui de la liste VISIBLE (une réponse masquée par son `when` ne prend pas de
 *    numéro), et l'`id` reste celui de la DONNÉE — c'est lui que reçoit le choix `dialogue.reponse` ;
 *  · l'OFFRE tombe pour une bourse trop courte et pour un siège qui ne décide pas ;
 *  · le TEST annoncé est celui que le flux DÉCLARE, en ids stables (nœud `test`, `sequence`, `si`, effet
 *    `extendedTest` avec son DR cumulé) ; un flux sans jet n'annonce rien ;
 *  · une CONVERSATION naît avec sa `session`, monotone et au-dessus de ce qui est déjà archivé.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { reponsesDuNoeud, testAnnonce, ouvrirDialogue } from './dialogue';
import { conditionCtx } from '../engine/flowCore';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import type { Dialogue, DialogueNode } from './monde/scene';
import type { Jeu } from './etat';
import { recordTurn, DIALOGUE_HISTORY_CAP, type DialogueTurn } from './monde/dialogueHistory';
import { campaignStart } from '../engine/clock';
import { withBourseMoney } from '../engine/bourse';
import type { Combatant } from '../engine/types';

const cc = conditionCtx({ flags: {}, gameTime: campaignStart() });

/** Héros porteur d'une bourse — la solvabilité d'une réponse payante se lit sur le GROUPE. */
const hero = (brass: number): Combatant =>
  withBourseMoney({ id: 'h1', name: 'Hero', kind: 'heros', chars: {}, items: [] } as unknown as Combatant, { gold: 0, silver: 0, brass }, idsDeTest);

const noeud = (choices: DialogueNode['choices']): Dialogue => ({ id: 'd', start: { id: 'n1' }, nodes: [{ id: 'n1', desc: '…', choices }] } as Dialogue);

/** État minimal : SOLO (un seul siège, il décide), une conversation ouverte sur son unique nœud. */
const etat = (dlg: Dialogue, over: Partial<Jeu> = {}): Jeu =>
  ({
    dialogue: { dialogue: dlg, nodeId: 'n1', session: 1 },
    flags: {}, gameTime: campaignStart(), party: [hero(0)],
    net: { mode: 'local', mySeat: 0, ownership: {} },
    battle: null,
    ...over,
  }) as never;

const testDIntuition: Flow = {
  kind: 'test',
  test: { skill: { id: 'intuition' }, difficulty: 'difficile', label: 'Quelque chose cloche' },
  reussite: { kind: 'sequence', etapes: [] },
  echec: { kind: 'sequence', etapes: [] },
} as Flow;

describe('reponsesDuNoeud — le RANG est celui de la liste VISIBLE', () => {
  it('une réponse masquée par son `when` ne prend PAS de numéro, et les ids de donnée sont conservés', () => {
    const dlg = noeud([
      { id: 'une', label: 'Une' },
      { id: 'cachee', label: 'Cachée', when: { kind: 'flag', expr: 'jamais' } },
      { id: 'trois', label: 'Trois' },
    ] as DialogueNode['choices']);
    const r = reponsesDuNoeud(etat(dlg));
    expect(r.map((x) => x.label)).toEqual(['Une', 'Trois']);
    expect(r.map((x) => x.rang)).toEqual([1, 2]);
    expect(r.map((x) => x.id)).toEqual(['une', 'trois']); // la 2ᵉ réponse VISIBLE est la 3ᵉ de la DONNÉE
  });

  it('hors dialogue : aucune réponse — la touche n’a rien à adresser', () => {
    expect(reponsesDuNoeud(etat(noeud([{ id: 'une', label: 'Une' }] as DialogueNode['choices']), { dialogue: null }))).toEqual([]);
  });
});

describe('reponsesDuNoeud — l’OFFRE, verdict partagé par le clic et par la touche', () => {
  it('bourse trop courte : la réponse payante est VISIBLE mais FERMÉE, avec sa raison', () => {
    const dlg = noeud([{ id: 'payer', label: 'Payer', cost: { silver: 5 } }] as DialogueNode['choices']);
    const pauvre = reponsesDuNoeud(etat(dlg))[0];
    expect(pauvre.enabled).toBe(false);
    expect(pauvre.refus).toBe('Pas assez d’argent pour cette option.');
    const riche = reponsesDuNoeud(etat(dlg, { party: [hero(240)] }))[0];
    expect(riche.enabled).toBe(true);
    expect(riche.refus).toBeUndefined();
  });

  it('coop, siège qui ne DÉCIDE pas : toutes les réponses sont fermées, le texte nomme le siège qui répond', () => {
    const dlg = noeud([{ id: 'une', label: 'Une' }, { id: 'deux', label: 'Deux' }] as DialogueNode['choices']);
    const r = reponsesDuNoeud(etat(dlg, { net: { mode: 'invite', mySeat: 1, ownership: {}, seatNames: { 0: 'Greta' } } as unknown as Jeu['net'] }));
    expect(r.every((x) => !x.enabled && x.refus === 'Greta répond pour le groupe.')).toBe(true);
  });
});

describe('testAnnonce — le jet vient du FLUX, en ids stables', () => {
  it('nœud `test` : la Compétence et la difficulté DÉCLARÉES', () => {
    expect(testAnnonce(testDIntuition, { cc })).toEqual({ skill: { id: 'intuition' }, difficulty: 'difficile' });
  });

  it('`seq` : le PREMIER jet rencontré — le seul que le clic déclenche', () => {
    const flow = { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'setFlag', flag: 'x' } }, testDIntuition] } as Flow;
    expect(testAnnonce(flow, { cc })?.skill).toEqual({ id: 'intuition' });
  });

  it('`if` : le jet de la branche que la Condition PREND', () => {
    const flow = (expr: string) => ({ kind: 'si', condition: { kind: 'flag', expr }, alors: testDIntuition } as Flow);
    expect(testAnnonce(flow('jamais'), { cc })).toBeUndefined();
    expect(testAnnonce(flow('!jamais'), { cc })?.skill).toEqual({ id: 'intuition' });
  });

  it('effet `extendedTest` : Compétence spécialisée, difficulté par DÉFAUT de `resoudreFlowTest`, DR cumulé', () => {
    const flow = { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'extendedTest', skill: { id: 'metier', spec: 'charpentier' }, label: 'Réparation', drCible: 5 } }] } as Flow;
    expect(testAnnonce(flow, { cc })).toEqual({ skill: { id: 'metier', spec: 'charpentier' }, difficulty: 'intermediaire', drCible: 5 });
  });

  it('flux SANS jet (ou absent) : aucun tag à annoncer', () => {
    expect(testAnnonce(undefined, { cc })).toBeUndefined();
    expect(testAnnonce({ kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'endDialogue' } }] } as Flow, { cc })).toBeUndefined();
  });

  it('nœud `test` dont le `gate` est FERMÉ : l’annonce suit la Condition du flux — aucun tag', () => {
    const ferme = { ...testDIntuition, test: { ...(testDIntuition as { test: object }).test, gate: { kind: 'flag', expr: 'jamais' } } } as Flow;
    expect(testAnnonce(ferme, { cc })).toBeUndefined();
  });

  it('le tag SORT dans la réponse : la fenêtre n’a rien à recalculer', () => {
    const dlg = noeud([{ id: 'observer', label: 'L’observer discrètement', flow: testDIntuition }] as DialogueNode['choices']);
    expect(reponsesDuNoeud(etat(dlg))[0].test).toEqual({ skill: { id: 'intuition' }, difficulty: 'difficile' });
  });
});

describe('ouvrirDialogue — une conversation naît avec sa SESSION', () => {
  const dlg = noeud([{ id: 'une', label: 'Une' }] as DialogueNode['choices']);
  const archive = (session: number): DialogueTurn => ({ nodeText: 'n', choiceText: 'c', at: 0, dialogueId: 'd', session });

  it('l’id est DÉRIVÉ de l’archive, sans état caché : deux appels sur le MÊME historique concordent', () => {
    // PURETÉ : aucune variable de module ne survit d'un appel à l'autre — la 2ᵉ ouverture d'un même
    // état rend le même id, et un test n'hérite pas du compteur du test précédent.
    const a = ouvrirDialogue({ dialogueHistory: [archive(7)] }, dlg, 'pnj');
    const b = ouvrirDialogue({ dialogueHistory: [archive(7)] }, dlg, 'pnj');
    expect(a.session).toBe(8);
    expect(b.session).toBe(8);
  });

  it('une conversation qui a ARCHIVÉ un tour cède le numéro SUIVANT', () => {
    const premiere = ouvrirDialogue({ dialogueHistory: [] }, dlg, 'pnj');
    expect(premiere.session).toBe(1);
    // …le joueur répond : le tour part à l'archive avec CETTE session (le choix `dialogue.reponse`).
    const seconde = ouvrirDialogue({ dialogueHistory: [archive(premiere.session)] }, dlg, 'pnj');
    expect(seconde.session).toBe(2);
  });

  it('DEUX ouvertures sans tour archivé rendent le même id — sans conséquence atteignable', () => {
    // Une conversation qu'on quitte sans répondre n'archive RIEN : aucun tour ne porte cet id, donc
    // la relecture ne peut pas confondre deux groupes — elle ne voit QUE l'archive
    // (`groupConversations`, épinglé par `ui/DialogueHistoryScreen.test.tsx`).
    const a = ouvrirDialogue({ dialogueHistory: [] }, dlg);
    const b = ouvrirDialogue({ dialogueHistory: [] }, dlg);
    expect(b.session).toBe(a.session);
  });

  it('l’id part de ce qui est DÉJÀ archivé : une partie rechargée ne réattribue pas un numéro passé', () => {
    const suivant = ouvrirDialogue({ dialogueHistory: [archive(41), archive(42)] }, dlg);
    expect(suivant.session).toBe(43);
    expect(suivant.nodeId).toBe('n1'); // la conversation s'ouvre au nœud de DÉPART du dialogue
  });

  it('la fenêtre glissante de l’archive évince les PLUS VIEUX tours, jamais le max', () => {
    // `DIALOGUE_HISTORY_CAP` borne l'archive par la fin (`recordTurn` → `slice(-cap)`) : le plus
    // GRAND id survit toujours, donc la dérivation ne peut pas régresser.
    const plein = Array.from({ length: DIALOGUE_HISTORY_CAP + 5 }, (_, i) => archive(i + 1));
    const borne = recordTurn(plein.slice(0, -1), plein[plein.length - 1]);
    expect(ouvrirDialogue({ dialogueHistory: borne }, dlg).session).toBe(plein.length + 1);
  });
});
