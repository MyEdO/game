import { describe, it, expect } from 'vitest';
import type { RNG } from './dice';
import { difficultyFromModifier } from './tests';
import {
  mightFromRelation, estimateMightFromAspects, warMachineMight, normalizeMights,
  mightReduction, rollMightTest, resolveClash,
  battleOutcome, isDestroyed, gapDifficulty, roundToStep,
  battleHazard, clampMight, MIGHT_MODIFIERS, POWER_ESTIMATE,
  WAR_MACHINES, STRUCTURES, BATTLE_HAZARDS,
  rallyHealAmount, initHoldState, resolveHoldRound, holdEnemyBonus, INSPIRE_BONUS,
} from './massBattle';
import { desEnSuite } from './dice.testkit';

/** RNG déterministe : renvoie tour à tour les d100 fournis (bornés à [min,max]). */
function seqRNG(...vals: number[]): RNG {
  return desEnSuite(vals, { boucle: true, borne: true });
}

describe('Puissance de Bataille — estimation (ADE II 08 l.24-47)', () => {
  it('table de force relative (l.28-32) : couple {allié, ennemi}', () => {
    expect(mightFromRelation('egale')).toEqual({ ally: 50, enemy: 50 });
    expect(mightFromRelation('insignifiante')).toEqual({ ally: 30, enemy: 70 });
    expect(mightFromRelation('ecrasante')).toEqual({ ally: 70, enemy: 30 });
    expect(POWER_ESTIMATE).toHaveLength(5);
  });

  it('méthode des aspects (l.34-47) : 30 + Σ modificateurs', () => {
    // Chevaliers Panthères : Bien équipée (+10) + Vétérans (+10) → 50 (exemple l.48).
    expect(estimateMightFromAspects(['bien-equipee', 'unites-veterans'])).toBe(50);
    // Orcs Vétérans (+10) → 40 (exemple l.48).
    expect(estimateMightFromAspects(['unites-veterans'])).toBe(40);
    // Aucun aspect → base 30 (l.34).
    expect(estimateMightFromAspects([])).toBe(30);
    expect(MIGHT_MODIFIERS.find((m) => m.id === 'taille-monstrueuse')!.mod).toBe(30);
    expect(MIGHT_MODIFIERS.find((m) => m.id === 'mal-equipee')!.mod).toBe(-10);
  });

  it('machines de guerre et Puissance (l.302-304)', () => {
    expect(warMachineMight([{}, {}])).toBe(10); // +5 par machine
    expect(warMachineMight([{ siege: true }, { siege: false }], { siege: true, offensive: true })).toBe(15); // Siège offensif +10 / +5
    expect(warMachineMight([{ fullCrew: false }])).toBe(2.5); // équipage incomplet ÷2
    expect(warMachineMight([{ siege: true }], { offensive: true })).toBe(5); // hors siège : Atout Siège = +5
  });

  it('normalisation (l.34) : retirer 10 aux deux jusqu\'à ≤ 100 ; décidé si écart brut > 100', () => {
    expect(normalizeMights(50, 50)).toEqual({ ally: 50, enemy: 50, decided: false });
    expect(normalizeMights(120, 40)).toEqual({ ally: 100, enemy: 20, decided: false }); // −20 des deux
    const r = normalizeMights(150, 30);
    expect(r.decided).toBe(true); // écart brut 120 > 100
    expect(r.ally).toBe(100);
    expect(r.enemy).toBe(0);
  });
});

describe('Test spectaculaire de Puissance (l.120)', () => {
  it('réduction = 10 + DR, minimum 5', () => {
    expect(mightReduction(0)).toBe(10);
    expect(mightReduction(3)).toBe(13);
    expect(mightReduction(-3)).toBe(7);
    expect(mightReduction(-6)).toBe(5); // 10 − 6 = 4 → plancher 5
    expect(mightReduction(-20)).toBe(5);
  });

  it('un Test NON opposé jette d100 ≤ Puissance', () => {
    const t = rollMightTest(60, 0, seqRNG(34));
    expect(t.roll).toBe(34);
    expect(t.success).toBe(true);
    expect(t.sl).toBe(3); // dizaines(60) − dizaines(34) = 6 − 3
  });

  it('affrontement simultané : chaque armée réduit l\'adverse de 10 + son DR (min 5)', () => {
    // Allié 60 → jette 34 (DR +3) ; Ennemi 40 → jette 55 (échec, DR −1 : dizaines 4 − 5).
    const c = resolveClash(60, 40, { rng: seqRNG(34, 55) });
    expect(c.allyTest.sl).toBe(3);
    expect(c.enemyTest.sl).toBe(-1);
    expect(c.enemyLoss).toBe(13); // 10 + 3
    expect(c.allyLoss).toBe(9); // 10 − 1
  });
});

describe('Discours inspirant (l.71)', () => {
  it('Difficulté depuis l\'écart de Puissance, arrondi au pas déclaré (la dizaine)', () => {
    expect(roundToStep(23, 10)).toBe(20);
    expect(roundToStep(-24, 10)).toBe(-20);
    expect(gapDifficulty(60 - 40, 10)).toBe('accessible');     // allié +20 → plus facile
    expect(gapDifficulty(50 - 50, 10)).toBe('intermediaire');  // égalité → +0
    expect(gapDifficulty(30 - 60, 10)).toBe('tresDifficile');  // allié −30 → plus dur
  });

  it('mappe un modificateur sur la bande de Difficulté la plus proche', () => {
    expect(difficultyFromModifier(0)).toBe('intermediaire');
    expect(difficultyFromModifier(40)).toBe('facile');
    expect(difficultyFromModifier(-20)).toBe('difficile');
  });

  it('bonus +10 au premier Round sur Succès (l.71)', () => {
    expect(INSPIRE_BONUS).toBe(10);
  });
});

describe('« Tenez votre position » — Point de rupture (l.161-163)', () => {
  const hold = { breakpoint: 10, maxRounds: 5, enemyBonusPerHold: 10 };

  it('bonus d\'opposition cumulatif : +10 par Round DÉJÀ tenu (l.163)', () => {
    expect(holdEnemyBonus(hold, 0)).toBe(0);
    expect(holdEnemyBonus(hold, 1)).toBe(10);
    expect(holdEnemyBonus(hold, 3)).toBe(30);
  });

  it('un DR net d\'ennemi négatif/nul → la position TIENT ; le Point de rupture reste borné à 0', () => {
    const r = resolveHoldRound(initHoldState(), hold, -2);
    expect(r.held).toBe(true);
    expect(r.next.breakpoint).toBe(0); // max(0, 0 + (−2))
    expect(r.next.held).toBe(1);
    expect(r.next.broken).toBe(false);
    expect(r.nextEnemyBonus).toBe(10);
  });

  it('le Point de rupture ACCUMULE les DR positifs de l\'ennemi entre Rounds', () => {
    let st = initHoldState();
    st = resolveHoldRound(st, hold, 3).next;
    expect(st.breakpoint).toBe(3);
    expect(st.held).toBe(1);
    st = resolveHoldRound(st, hold, 4).next;
    expect(st.breakpoint).toBe(7);
    expect(st.held).toBe(2);
    expect(st.broken).toBe(false);
  });

  it('Point de rupture ≥ 10 → la position CÈDE (déroute), ce Round n\'est PAS une tenue', () => {
    const st = resolveHoldRound({ breakpoint: 7, held: 2, broken: false }, hold, 4); // 7 + 4 = 11 ≥ 10
    expect(st.next.breakpoint).toBe(11);
    expect(st.held).toBe(false);
    expect(st.next.held).toBe(2);
    expect(st.next.broken).toBe(true);
  });

  it('5 Rounds écoulés → écrasement même si le Point de rupture n\'a pas atteint le seuil (l.163)', () => {
    const st = resolveHoldRound({ breakpoint: 0, held: 4, broken: false }, hold, 0);
    expect(st.next.broken).toBe(true); // 5ᵉ Round (held+1 = 5 = maxRounds)
    expect(st.next.breakpoint).toBe(0);
  });
});

describe('Rassemblement (l.122)', () => {
  it('guérit DR + Bonus d\'Endurance (DR négatif borné à 0)', () => {
    expect(rallyHealAmount(3, 4)).toBe(7);
    expect(rallyHealAmount(0, 4)).toBe(4);
    expect(rallyHealAmount(-2, 4)).toBe(4);
  });
});

describe('Issue de la bataille (l.124) & aléa (l.309)', () => {
  it('l\'armée à la plus haute Puissance gagne', () => {
    expect(battleOutcome(30, 20)).toBe('ally');
    expect(battleOutcome(10, 40)).toBe('enemy');
    expect(battleOutcome(25, 25)).toBe('draw');
    expect(isDestroyed(0)).toBe(true);
    expect(isDestroyed(5)).toBe(false);
  });

  it('facteur environnemental 1d10 (l.311-322) + tables verbatim', () => {
    expect(BATTLE_HAZARDS).toHaveLength(10);
    expect(battleHazard(1).label).toBe('Tempête');
    expect(battleHazard(10).label).toBe('Peur');
    expect(STRUCTURES.find((s) => s.id === 'mur-en-pierre')).toMatchObject({ be: 12, wounds: 40 });
    expect(WAR_MACHINES.find((m) => m.id === 'canon')?.siege).toBe(true);
  });

  it('clampMight borne et arrondit', () => {
    expect(clampMight(-4)).toBe(0);
    expect(clampMight(130)).toBe(100);
    expect(clampMight(49.6)).toBe(50);
  });
});
