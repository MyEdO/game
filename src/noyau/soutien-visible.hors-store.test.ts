import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { runFlow } from './combatEffects';
import { cleDeFixture } from './noyau.testkit';
import { openPartyTest } from './rollSeam';
import { routeTriggeredTest } from './combat/triggeredTest';
import { findTrappingById, refLabel } from '../data';
import { RULE_REF } from '../engine/ruleRefs';
import { testFlow } from './monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #1064 — le Soutien (LDB 12 l.187-200) est une DONNÉE du pending, pas un bonus fondu et muet : la
 * couture (`openSkillTest`, porte du seam `openPartyTest`) POSE `support {count,bonus}` à côté de la
 * valeur soutenue, et l'allègement de Difficulté (`FlowTest.easierIf`) POSE la raison qui l'a permis.
 * Sans ces champs, la modale n'a rien à afficher : c'est ici que le trou d'affichage se ferme.
 */
const skilled = (id: string, pos: { x: number; y: number } | undefined, skillId = 'perception', advances = 1, chars: Partial<Record<string, number>> = {}): Combatant => (blessuresSurLeProfil({
  id, name: id, kind: 'heros', pos,
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, ...chars },
  wounds: blessuresDeBase(10), advantage: 0, conditions: [], movement: 4,
  skills: [{ id: skillId, characteristic: 'agilite', advances }], talents: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
}) as unknown as Combatant);

const battleOf = (combatants: Combatant[], turn = 0) => ({ combatants, order: combatants.map((c) => c.id), turn, round: 1, log: [], acted: false, action: null, movementUsed: 0, over: null } as never);

describe('#1064 — le pending PORTE le détail du Soutien (couture)', () => {
  it('Test de scène/dialogue soutenu : `pendingTest.support` = {count, bonus} à côté de la valeur soutenue', () => {
    const leader = skilled('h1', undefined, 'perception', 5); // Ag 30 + 5 → 35
    const help1 = skilled('h2', undefined);
    const help2 = skilled('h3', undefined);
    banc.setState({ party: [leader, help1, help2] });
    runFlow(banc.getState, banc.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = banc.getState().pendingTest!;
    expect(pt.skillValue).toBe(55); // 35 + 2×10 (Soutien FONDU, inchangé)
    // …et DÉTAILLÉ pour l'affichage, NOMS COMPRIS (`ids` : la provenance de la chip « +20 Soutien »).
    expect(pt.support).toEqual({ count: 2, bonus: 20, ids: ['h2', 'h3'] });
    // Le détail suit le CANDIDAT (le plafond est celui de SA Caractéristique) : réglage `test.testeur` le recopie.
    expect(pt.candidates?.find((c) => c.id === 'h1')?.support).toEqual({ count: 2, bonus: 20, ids: ['h2', 'h3'] });
  });

  it('Test NON soutenu : aucun détail inventé (pas de ligne « Soutien +0 »)', () => {
    const leader = skilled('h1', undefined, 'perception', 5);
    banc.setState({ party: [leader] });
    runFlow(banc.getState, banc.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(banc.getState().pendingTest!.support).toBeUndefined();
  });

  it('Difficulté ALLÉGÉE (`easierIf`) : le pending PORTE la raison (`easedBy`), pas seulement la difficulté adoucie', () => {
    const leader = skilled('h1', undefined, 'perception', 5);
    const crocheteur = skilled('h2', undefined, 'crochetage', 3);
    banc.setState({ party: [leader, crocheteur] });
    runFlow(banc.getState, banc.setState, testFlow(
      { skill: { id: 'perception' }, requireSL: 0, difficulty: 'intermediaire', easierIf: { hasSkill: { id: 'crochetage' }, steps: 1 } },
      EMPTY_FLOW, EMPTY_FLOW,
    ));
    const pt = banc.getState().pendingTest!;
    expect(pt.difficulty).toBe('accessible'); // allégée d'un cran
    expect(pt.easedBy).toBe('Crochetage'); // …et on sait POURQUOI
  });

  it('Difficulté NON allégée (personne ne porte la compétence) : aucune raison affichée', () => {
    const leader = skilled('h1', undefined, 'perception', 5);
    banc.setState({ party: [leader] });
    runFlow(banc.getState, banc.setState, testFlow(
      { skill: { id: 'perception' }, requireSL: 0, difficulty: 'intermediaire', easierIf: { hasSkill: { id: 'crochetage' }, steps: 1 } },
      EMPTY_FLOW, EMPTY_FLOW,
    ));
    expect(banc.getState().pendingTest!.easedBy).toBeUndefined();
  });

  it('ÉCRÊTAGE de cible : `pendingTest.clamped` est MESURÉ, jamais déduit d’une cible qui vaut 99', () => {
    // Cible calculée 135 (Ag 30 + 105 Augmentations) → bornée à 99 : l'écrêtage réel est −36.
    const colosse = skilled('h1', undefined, 'perception', 105);
    banc.setState({ party: [colosse] });
    runFlow(banc.getState, banc.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = banc.getState().pendingTest!;
    expect(pt.target).toBe(99);
    expect(pt.clamped).toBe(-36); // 99 − 135

    // Cible qui VAUT 99 sans aucun bornage : rien à nommer.
    const juste = skilled('h2', undefined, 'perception', 69);
    banc.setState({ party: [juste], pendingTest: null });
    runFlow(banc.getState, banc.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(banc.getState().pendingTest!.target).toBe(99);
    expect(banc.getState().pendingTest!.clamped).toBeUndefined();
  });

  it('PORTE du seam (`openPartyTest`) : base NUE + Soutien en ligne de mod NOMMÉE, cible soutenue', () => {
    const leader = skilled('h1', undefined, 'perception', 5);
    const help = skilled('h2', undefined);
    banc.setState({ party: [leader, help] });
    openPartyTest(banc.getState, banc.setState, { skill: { id: 'perception' }, actionLabel: 'Fouiller la pièce', difficulty: 'intermediaire' }, cleDeFixture('testSoutienSeam'));
    const step = banc.getState().pendingCascade!.participants[0];
    expect(step.base).toBe(35); // Niveau de Compétence NU du meneur (Ag 30 + 5), LDB 09 l.17
    expect(step.target).toBe(45); // …le Soutien reste un MODIFICATEUR compris dans la cible (l.189-190)
    expect(step.mods).toEqual([{ label: refLabel('regles', RULE_REF.soutien), value: 10, famille: 'jet', ref: RULE_REF.soutien, by: [{ id: 'h2' }] }]);
  });
});

describe('#1064 — Cumuler l’Avantage passe par la COUTURE (LDB 09 l.305-308)', () => {
  it('`gagnerLAvantage` ouvre le Test par `openSkillTest` : acteur IMPOSÉ, octroi porté, Test PERSONNEL', () => {
    const observer = skilled('h1', { x: 5, y: 5 }, 'intuition', 5, { intelligence: 40 });
    const help = skilled('h2', { x: 6, y: 5 }, 'intuition', 2, { intelligence: 40 }); // adjacent + Augmentation
    banc.setState({ battle: battleOf([observer, help]), party: [observer, help] });
    banc.getState().gagnerLAvantage('intuition');
    const pt = banc.getState().pendingTest!;
    expect(pt.actorId).toBe('h1'); // l'observateur reste l'acteur imposé
    expect(pt.candidates).toBeUndefined(); // …aucun autre candidat n'est offert
    expect(pt.combatAdvantage?.combatantId).toBe('h1'); // l'octroi d'Avantage voyage par le pending
    expect(pt.cancellable).toBe(true); // Action pas encore dépensée
    // Test PERSONNEL (LDB 09 l.308) : aucun Soutien, même avec un camarade adjacent et capable.
    expect(pt.support).toBeUndefined();
    expect(pt.skillValue).toBe(35); // Ag 30 + 5 Augmentations, rien d'autre
  });
});

describe('LDB 12 l.197 — un Test SUBI ne se soutient pas (défaut de la VOIE, tri-état authoré)', () => {
  /** Effet DÉCLENCHÉ hors combat (Venin/Crampes/zone franchie) : `routeTriggeredTest` ouvre la modale
   *  du sujet — les camarades ne peuvent pas résister à sa place. */
  const subi = (test: Parameters<typeof routeTriggeredTest>[4] extends never ? never : { skill?: { id: string }; characteristic?: string; noSupport?: boolean }) =>
    ({ kind: 'test' as const, test: test as never, reussite: EMPTY_FLOW, echec: EMPTY_FLOW });

  it('Test de Résistance déclenché : AUCUN Soutien, même avec 2 camarades capables et adjacents', () => {
    const victime = skilled('h1', undefined, 'resistance', 5);
    const a = skilled('h2', undefined, 'resistance', 2);
    const b = skilled('h3', undefined, 'resistance', 2);
    banc.setState({ party: [victime, a, b] });
    routeTriggeredTest(banc.getState, banc.setState, victime, victime, subi({ skill: { id: 'resistance' } }));
    const pt = banc.getState().pendingTest!;
    expect(pt.support).toBeUndefined();
    expect(pt.skillValue).toBe(35); // base seule (Ag 30 + 5), pas 55
  });

  it('OPT-IN par la DONNÉE (`noSupport:false`) : un Test déclenché soutenable l’est vraiment', () => {
    const soigne = skilled('h1', undefined, 'guerison', 5);
    const aide = skilled('h2', undefined, 'guerison', 2);
    banc.setState({ party: [soigne, aide] });
    routeTriggeredTest(banc.getState, banc.setState, soigne, soigne, subi({ skill: { id: 'guerison' }, noSupport: false }));
    expect(banc.getState().pendingTest!.support).toEqual({ count: 1, bonus: 10, ids: ['h2'] });
  });

  it('DONNÉE — « Nécessaire antipoison » (Test de Guérison) est authoré SOUTENABLE (LDB 12 l.197)', () => {
    const kit = findTrappingById('necessaire-antipoison')!;
    const node = kit.consumable as { kind: string; test: { skill: { id: string }; noSupport?: boolean } };
    expect(node.test.skill.id).toBe('guerison');
    expect(node.test.noSupport).toBe(false); // soigner n'est pas résister (l.197 ne le couvre pas)
  });
});
