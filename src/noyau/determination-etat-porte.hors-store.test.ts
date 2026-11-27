/**
 * Chemin JOUEUR de la Détermination contre un Inconscient PORTÉ par un effet à durée en Rounds (`LDB 16 l.117`,
 * LDB 17 l.61) : la pose par l'op `condition` portée, la dépense par `depenserLaDetermination`, la fin de Round par
 * ses hooks. La sortie de l'État est celle que ce fichier déclare (`declarerLesSorties`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { runCombatHooks, type CombatHookCtx } from './combatHooks';
import { applyOps } from '../engine/ops';
import { deFixe } from '../engine/dice.testkit';
import { declarerLesSorties } from '../engine/sortiesDeTest.testkit';
import { texteDuFait } from '../engine/faits';
import { t } from '../i18n';
import { conditionLabel } from '../data';
import { createHero } from '../engine/character';
import { hasCondition } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

declarerLesSorties({ inconscient: [{ op: 'condition', id: { id: 'assourdi' } }] });

/** Les Rounds que dure l'effet porteur de la fixture. */
const DUREE = 3;

/** Le héros ACTIF d'un combat ouvert, 1 Point de Détermination, l'Inconscient porté par la source de fixture `effet-de-fixture`. */
function preparer(): Combatant {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'H', seed: 3 });
  banc.setState({ party: [hero], pendingCascade: null, pendingFateSave: null, battle: null });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  H.wounds = blessuresDeBase(200, 200, H);
  H.resolve = 1;
  applyOps(H, [{ op: 'condition', id: { id: 'inconscient' }, value: 1, carried: true, durationRounds: DUREE }], { idNeuf: idsDeTest, rng: deFixe(1), source: { kind: 'sort', id: 'effet-de-fixture' } });
  banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id) }, pendingCascade: null, pendingLogQueue: [] });
  return H;
}

const vivant = (id: string): Combatant => banc.getState().battle!.combatants.find((c) => c.id === id)!;
const journal = (): string[] => banc.getState().battle!.log.map((e) => e.entree.texte);

/** Joue les hooks de fin de Round et rend les lignes de journal émises. */
function finDeRound(): string[] {
  const lignes: string[] = [];
  const battle = banc.getState().battle!;
  const ctx: CombatHookCtx = { get: banc.getState, set: banc.setState, battle, sink: (l: string, _c?: Combatant) => lignes.push(l) };
  runCombatHooks('onRoundEnd', ctx);
  return lignes;
}

/** Les Rounds tirés pour l'effet porteur de l'Inconscient. */
function roundsDuPorteur(h: Combatant): number {
  const porteur = (h.activeEffects ?? []).find((e) => e.passive?.some((o) => o.op === 'condition' && o.id.id === 'inconscient'))!;
  return porteur.duration.scale === 'rounds' ? porteur.duration.left : 0;
}

describe('Détermination contre un Inconscient porté (LDB 16 l.117, LDB 17 l.61)', () => {
  it('Détermination dépensée : l’État est RETIRÉ, puis REGAGNÉ en fin de Round tant que le porteur dure', () => {
    const h = preparer();
    const n = roundsDuPorteur(h);
    banc.getState().depenserLaDetermination(h.id, 'retirerUnEtat', 'inconscient');
    expect(hasCondition(vivant(h.id), 'inconscient'), 'le retrait A LIEU (LDB 17 l.61)').toBe(false);
    expect(vivant(h.id).resolve).toBe(0);
    expect(journal().slice(-2), 'la dépense dit le retrait une fois, puis la sortie du pion porté').toEqual([
      t('cs.determinationRemove', { name: 'H', cond: conditionLabel('inconscient'), extra: '' }),
      texteDuFait({ genre: 'etat', cible: h.id, camp: 'groupe', id: 'assourdi', valeur: 1 }, 'H'),
    ]);

    const lignes = finDeRound();
    const apres = vivant(h.id);
    expect(hasCondition(apres, 'inconscient'), '« vous gagnez un nouvel État Inconscient à la fin du Round »').toBe(true);
    expect(apres.conditions.find((x) => x.id === 'inconscient')!.value).toBe(1);
    const src = apres.conditions.find((x) => x.id === 'inconscient')!.derivedFrom!.src!;
    expect(lignes).toContain(texteDuFait({ genre: 'etat', cible: h.id, camp: 'groupe', id: 'inconscient', valeur: 1, porte: { src }, duree: { rounds: n - 1 } }, 'H'));
  });

  it('au bout des Rounds tirés, l’Inconscient tombe avec son porteur', () => {
    const h = preparer();
    const n = roundsDuPorteur(h);
    expect(n).toBe(DUREE);
    for (let i = 0; i < n - 1; i++) finDeRound();
    expect(hasCondition(vivant(h.id), 'inconscient'), 'l’État tient tant que son porteur dure').toBe(true);
    finDeRound();
    expect(hasCondition(vivant(h.id), 'inconscient')).toBe(false);
  });
});
