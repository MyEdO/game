import { describe, it, expect } from 'vitest';
import { ladderClimbReach, resolveLadderClimb, resolveSurfaceClimb, resolveDeliberateFall } from './movement';
import {
  pursuitOutcome, pursuitMoveBonus, pursuitLaggard, npcSacrificeChoice, npcPursuerChoice,
  PURSUIT_ESCAPE_DISTANCE, type PursuitRunner,
} from './pursuit';
import { deFixe } from './dice.testkit';

/** RNG d100 → `roll` (le reste des int() renvoie `roll` aussi ; escalade/chute n'utilisent qu'un d100). */
const fixed = deFixe;

describe('Escalade (LDB 15 l.53-57)', () => {
  it('échelle sans Test : ½ vitesse → M mètres avec le Mouvement du Round', () => {
    expect(ladderClimbReach(4)).toBe(4);
  });
  it('échelle rapide (Action + Escalade Accessible) : M + DR mètres (M4, réussite ample)', () => {
    const r = resolveLadderClimb(80, 4, fixed(1)); // 01 → réussite, DR élevé
    expect(r.success).toBe(true);
    expect(r.metres).toBeGreaterThanOrEqual(4); // au moins M
  });
  it('surface à prises : (½M + DR) mètres sur réussite, 0 sur échec', () => {
    const ok = resolveSurfaceClimb(80, 4, fixed(1)); // réussite
    expect(ok.metres).toBeGreaterThanOrEqual(2); // ½M(=2) + DR
    const ko = resolveSurfaceClimb(20, 4, fixed(99)); // échec
    expect(ko.metres).toBe(0);
  });
  it('surface exigeant Grimpeur, sans le Talent → escalade impossible', () => {
    const r = resolveSurfaceClimb(80, 4, fixed(1), { requiresGrimpeur: true, hasGrimpeur: false });
    expect(r.impossible).toBe(true);
    expect(r.metres).toBe(0);
  });
});

describe('Chute volontaire (LDB 15 l.82)', () => {
  it('réussite : −1 m de chute par DR', () => {
    const r = resolveDeliberateFall(80, 'accessible', 6, fixed(1)); // 01 → réussite, gros DR
    expect(r.success).toBe(true);
    expect(r.effectiveMetres).toBeLessThan(6);
  });
  it('DR suffisant → chute ramenée à 0 (aucun Dégât)', () => {
    const r = resolveDeliberateFall(100, 'accessible', 2, fixed(1)); // DR ≥ 2 attendu
    expect(r.effectiveMetres).toBe(0);
  });
  it('échec : aucune réduction (on ne tombe pas de plus haut)', () => {
    const r = resolveDeliberateFall(20, 'accessible', 6, fixed(99)); // échec
    expect(r.effectiveMetres).toBe(6);
  });
});

describe('Poursuite terrestre — Distance (LDB 15 l.86-108)', () => {
  it('issue partagée : ≤0 rattrapé, ≥10 semé, sinon continue', () => {
    expect(pursuitOutcome(0)).toBe('caught');
    expect(pursuitOutcome(-2)).toBe('caught');
    expect(pursuitOutcome(PURSUIT_ESCAPE_DISTANCE)).toBe('escaped');
    expect(pursuitOutcome(5)).toBe('ongoing');
  });
  it('bonus de Mouvement = différence avec le plus lent (M8/M7/M9 → 1/0/2)', () => {
    expect(pursuitMoveBonus(8, 7)).toBe(1);
    expect(pursuitMoveBonus(7, 7)).toBe(0);
    expect(pursuitMoveBonus(9, 7)).toBe(2);
  });
  /** Les trois décisions de l.94, du côté du camp PNJ (le camp joueur, lui, ouvre une fenêtre). */
  const coureur = (id: string, movement: number, total = 0): PursuitRunner => ({ id, label: id, movement, total });

  it('« le plus lent d’entre eux » (l.94) : le plus petit Mouvement, départagé par le DR de la manche', () => {
    expect(pursuitLaggard([coureur('a', 5), coureur('b', 4), coureur('c', 6)])?.id).toBe('b');
    expect(pursuitLaggard([coureur('a', 4, 2), coureur('b', 4, -1)])?.id).toBe('b');
    expect(pursuitLaggard([coureur('seul', 4)]), 'sacrifier le dernier fuyard n’a personne à sauver').toBeUndefined();
  });

  /**
   * L'EXEMPLE CANONIQUE tranche le défaut (l.98-100) : les trois cultistes n'ont AUCUN Mouvement
   * distinct au Source — leur « plus lent » se départage au DR de la manche (0 contre 2 et 2) — et ils
   * l'abandonnent quand même. Le sacrifice sert « à ralentir les poursuivants » (l.94) : il OCCUPE la
   * chasse, il n'allège pas le camp. Une politique par défaut indexée sur l'écart de Mouvement
   * rendrait donc `affronter` sur ce camp-là — et la voie (a) serait morte par défaut.
   */
  it('camp PNJ poursuivi, exemple canonique : trois coureurs de MÊME Mouvement (DR 0/2/2) SACRIFIENT', () => {
    const camp = [coureur('cultiste-1', 4, 0), coureur('cultiste-2', 4, 2), coureur('cultiste-3', 4, 2)];
    const laggard = pursuitLaggard(camp)!;
    expect(laggard.id, 'à Mouvement égal, le plus lent est celui qui traine au DR').toBe('cultiste-1');
    expect(npcSacrificeChoice({}, laggard, camp)).toBe('sacrifier');
  });

  it('camp PNJ poursuivi : la RETENUE reste disponible en donnée (jamais / à partir d’un écart de M)', () => {
    const lent = coureur('lent', 3);
    const camp = [lent, coureur('rapide', 5)];
    expect(npcSacrificeChoice({ sacrifice: 'jamais' }, lent, camp)).toBe('affronter');
    expect(npcSacrificeChoice({ sacrifice: 'si-ecart', ecartM: 1 }, lent, camp)).toBe('sacrifier');
    const homogene = [coureur('a', 5), coureur('b', 5)];
    expect(npcSacrificeChoice({ sacrifice: 'si-ecart', ecartM: 1 }, homogene[0], homogene)).toBe('affronter');
  });

  it('camp PNJ poursuivant : le plus lent s’arrête ; le retardataire NON prioritaire est ignoré (l.94)', () => {
    const camp = [coureur('vif', 6), coureur('trainard', 4)];
    const abandonne = coureur('abandonne', 3);
    const arret = npcPursuerChoice({}, abandonne, camp);
    expect(arret).toEqual({ go: 'arreter', who: camp[1] });
    // Une scène qui NOMME ses cibles prioritaires rend l'abandon possible : le retardataire n'en est pas.
    expect(npcPursuerChoice({ prioritaires: ['un-autre'] }, abandonne, camp)).toEqual({ go: 'ignorer' });
    expect(npcPursuerChoice({ prioritaires: ['abandonne'] }, abandonne, camp).go).toBe('arreter');
    expect(npcPursuerChoice({ arret: 'aucun' }, abandonne, camp)).toEqual({ go: 'ignorer' });
  });
});
