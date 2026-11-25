/**
 * Chemin JOUEUR de la Détermination contre l'Inconscient de « Purifier la chair » (`LDB 40 l.75`), porté
 * par sa Colère pendant les 1d10 Rounds tirés (`LDB 16 l.117`) : la rangée est jouée par le chemin
 * miscast réel (`jouerPurifierLaChair`), la dépense par `depenserLaDetermination`, la fin de Round par
 * ses hooks.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { runCombatHooks, type CombatHookCtx } from './combatHooks';
import { jouerPurifierLaChair } from './combat/purifierLaChair.testkit';
import { createHero } from '../engine/character';
import { hasCondition } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le héros ACTIF d'un combat ouvert, 1 Point de Détermination, Blessures assez hautes pour encaisser la rangée. */
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
  banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id) }, pendingCascade: null, pendingLogQueue: [] });
  return H;
}

const vivant = (id: string): Combatant => banc.getState().battle!.combatants.find((c) => c.id === id)!;
const journal = (): string[] => banc.getState().battle!.log.map((e) => e.text);

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

const rounds = (n: number): string => `${n} Round${n > 1 ? 's' : ''}`;

describe('Détermination contre l’Inconscient porté de « Purifier la chair » (LDB 16 l.117, LDB 40 l.75)', () => {
  it('la POSE dit la durée tirée', () => {
    const h = jouerPurifierLaChair(banc, preparer);
    const n = roundsDuPorteur(h);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(10);
    expect(hasCondition(h, 'inconscient')).toBe(true);
    expect(journal()).toContain(`H gagne l’État Inconscient — Purifier la chair (${rounds(n)}).`);
  });

  it('Détermination dépensée : l’État est RETIRÉ, puis REGAGNÉ en fin de Round tant que le porteur dure', () => {
    const h = jouerPurifierLaChair(banc, preparer);
    const n = roundsDuPorteur(h);
    expect(n, 'la graine doit tirer au moins 2 Rounds pour qu’un Round reste après la dépense').toBeGreaterThanOrEqual(2);
    banc.getState().depenserLaDetermination(h.id, 'retirerUnEtat', 'inconscient');
    expect(hasCondition(vivant(h.id), 'inconscient'), 'le retrait A LIEU (LDB 17 l.61)').toBe(false);
    expect(vivant(h.id).resolve).toBe(0);

    const lignes = finDeRound();
    const apres = vivant(h.id);
    expect(hasCondition(apres, 'inconscient'), '« vous gagnez un nouvel État Inconscient à la fin du Round »').toBe(true);
    expect(apres.conditions.find((x) => x.id === 'inconscient')!.value).toBe(1);
    expect(lignes).toContain(`H gagne l’État Inconscient — Purifier la chair (${rounds(n - 1)}).`);
  });

  it('au bout des Rounds tirés, l’Inconscient tombe avec son porteur', () => {
    const h = jouerPurifierLaChair(banc, preparer);
    const n = roundsDuPorteur(h);
    for (let i = 0; i < n - 1; i++) finDeRound();
    expect(hasCondition(vivant(h.id), 'inconscient'), 'l’État tient tant que son porteur dure').toBe(true);
    finDeRound();
    expect(hasCondition(vivant(h.id), 'inconscient')).toBe(false);
  });
});
