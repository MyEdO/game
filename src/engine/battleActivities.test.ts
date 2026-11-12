import { describe, it, expect } from 'vitest';
import {
  activityById, activitiesFor, matchBattleOutcomes, battleOutcomeAmount, battleCondMet, testsDeLActivite,
  type ActivityDef, type BattleResolution,
} from './activities';

/** Résolution de Test (Scène de Test / Activité de préparation). `generalDown` est EXPLICITE ici (la
 *  condition — Succès simple vs Stupéfiant — est déclarée par Scène côté flux, `def.generalDownOn`). */
function testRes(success: boolean, sl: number, generalDown = false): BattleResolution {
  return { success, sl, hits: 0, kills: 0, generalDown, intervention: false, combat: false };
}
/** Résolution de COMBAT victorieuse (touches/kills, général tombé, intervention si > 1 frappeur). */
function combatWin(hits: number, kills: number, hitters: number): BattleResolution {
  return { success: true, sl: 0, hits, kills, generalDown: true, intervention: hitters > 1, combat: true };
}
/** Résolution de COMBAT perdue. */
function combatLoss(hits: number, hitters: number): BattleResolution {
  return { success: false, sl: 0, hits, kills: 0, generalDown: false, intervention: hitters > 1, combat: true };
}

/** Somme des deltas de Puissance (`might`/`startMight`) appliqués par une résolution, agrégée par camp. */
function deltas(def: ActivityDef, res: BattleResolution): { side: string; amount: number }[] {
  const out: { side: string; amount: number }[] = [];
  for (const b of matchBattleOutcomes(def, res)) {
    for (const o of b.battle ?? []) {
      const amount = battleOutcomeAmount(o, res);
      if (amount !== 0) out.push({ side: (o.side ?? (o.target === 'might' ? 'ennemi' : 'allie')), amount });
    }
  }
  return out;
}
/** Enchaînements imposés par une résolution. */
function chains(def: ActivityDef, res: BattleResolution): string[] {
  return matchBattleOutcomes(def, res).flatMap((b) => b.chains ?? []);
}
const total = (ds: { amount: number }[]) => ds.reduce((s, d) => s + d.amount, 0);

describe('Activités de préparation de bataille (ADE II 08 l.79-110) — données RAW', () => {
  it('les 6 Activités de préparation existent (contexte bataille)', () => {
    const ids = activitiesFor('bataille').map((a) => a.id).sort();
    expect(ids).toEqual(['infiltration', 'inspire', 'planification', 'rassembler-des-forces', 'reperage', 'sabotage'].sort());
  });

  it('Planification (l.79-89) : Savoir (Guerre), assistée ; Succès +10 / Stupéfiant +20 aux Tests alliés', () => {
    const plan = activityById('planification')!;
    expect(testsDeLActivite(plan)).toEqual([{ skill: { id: 'savoir', spec: 'guerre' } }]);
    expect(plan.assisted).toBe(true);
    expect(plan.grantsFlag).toBe('planned');
    // Succès (DR < 6) : +10 permanent (l.81).
    expect(matchBattleOutcomes(plan, testRes(true, 2)).flatMap((b) => b.battle!)).toEqual([{ target: 'allyTestMod', scale: 'fixed', amount: 10 }]);
    // Succès Stupéfiant (DR ≥ 6) : +20 (l.89).
    expect(matchBattleOutcomes(plan, testRes(true, 6)).flatMap((b) => b.battle!)).toEqual([{ target: 'allyTestMod', scale: 'fixed', amount: 20 }]);
  });

  it('Infiltration (l.75) : combiné Discrétion+Perception, requiert la Planification ; Succès = +20 à la Planification', () => {
    const inf = activityById('infiltration')!;
    expect(inf.combined).toBe(true);
    expect(testsDeLActivite(inf)).toEqual([{ skill: { id: 'discretion' } }, { skill: { id: 'perception' } }]);
    expect(inf.requires).toEqual(['planned']);
    // RAW ADE II 8 l.75 : « En cas de Succès, le Personnage obtient un bonus de +20 à l'Activité Planification. »
    expect(matchBattleOutcomes(inf, testRes(true, 1)).flatMap((b) => b.battle!)).toEqual([{ target: 'planningBonus', scale: 'fixed', amount: 20 }]);
  });

  it('Repérage (l.100-102) : combiné Chevaucher+Perception, octroie scouted ; Succès +10 à la Planification', () => {
    const rep = activityById('reperage')!;
    expect(rep.combined).toBe(true);
    expect(testsDeLActivite(rep)).toEqual([{ skill: { id: 'chevaucher' } }, { skill: { id: 'perception' } }]);
    expect(rep.grantsFlag).toBe('scouted');
    expect(matchBattleOutcomes(rep, testRes(true, 1)).flatMap((b) => b.battle!)).toEqual([{ target: 'planningBonus', scale: 'fixed', amount: 10 }]);
  });

  it('Sabotage (l.104-106) : requiert le Repérage ; ennemi −5 (Succès) / −10 (Stupéfiant) de départ', () => {
    const sab = activityById('sabotage')!;
    expect(sab.requires).toEqual(['scouted']);
    expect(matchBattleOutcomes(sab, testRes(true, 2)).flatMap((b) => b.battle!)).toEqual([{ side: 'ennemi', target: 'startMight', scale: 'fixed', amount: -5 }]);
    expect(matchBattleOutcomes(sab, testRes(true, 6)).flatMap((b) => b.battle!)).toEqual([{ side: 'ennemi', target: 'startMight', scale: 'fixed', amount: -10 }]);
  });

  it('Rassembler des forces (l.94-96) : +5 (Succès) / +10 (Stupéfiant) / −10 (Éch. Stupéfiant) de départ allié', () => {
    const ras = activityById('rassembler-des-forces')!;
    expect(ras.tests!.map((o) => o.skill?.id)).toEqual(['commandement', 'charme', 'intimidation']);
    expect(matchBattleOutcomes(ras, testRes(true, 2)).flatMap((b) => b.battle!)).toEqual([{ side: 'allie', target: 'startMight', scale: 'fixed', amount: 5 }]);
    expect(matchBattleOutcomes(ras, testRes(true, 6)).flatMap((b) => b.battle!)).toEqual([{ side: 'allie', target: 'startMight', scale: 'fixed', amount: 10 }]);
    // Échec Stupéfiant (DR ≤ −6) : −10 (mutinerie/désertion, l.96).
    expect(matchBattleOutcomes(ras, testRes(false, -6)).flatMap((b) => b.battle!)).toEqual([{ side: 'allie', target: 'startMight', scale: 'fixed', amount: -10 }]);
    // Échec ordinaire : aucun effet.
    expect(matchBattleOutcomes(ras, testRes(false, -2)).flatMap((b) => b.battle ?? [])).toEqual([]);
  });
});

describe('Scènes cinématiques de bataille (ADE II 08 l.137-225) — données RAW', () => {
  it('les 12 Scènes existent (contexte bataille-round) + le Rassemblement', () => {
    const ids = activitiesFor('bataille-round').map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([
      'motivation', 'pluie-de-fleches', 'protection', 'tenez-votre-position', 'compte-a-rebours',
      'percee', 'ligne-de-mire', 'tuez-la-bete', 'survol', 'charge', 'duel', 'intrus', 'rassemblement',
    ]));
  });

  it('Motivation (l.149) : ally +DR', () => {
    const m = activityById('motivation')!;
    expect(m.sceneKind).toBe('test');
    expect(total(deltas(m, testRes(true, 4)))).toBe(4);
    expect(total(deltas(m, testRes(false, -2)))).toBe(0);
  });

  it('Charge (l.139) : −1/touche ET −2/kill (5 touches + 1 kill = −7)', () => {
    const charge = activityById('charge')!;
    expect(charge.sceneKind).toBe('combat');
    expect(total(deltas(charge, combatWin(5, 1, 1)))).toBe(-7);
  });

  it('Ligne de mire (l.208) : −5, et −5 de PLUS quand le général tombe (bande generalDown)', () => {
    const ldm = activityById('ligne-de-mire')!;
    expect(total(deltas(ldm, testRes(true, 2)))).toBe(-5);
    expect(total(deltas(ldm, testRes(true, 2, true)))).toBe(-10); // generalDown → −5 de plus
  });

  it('Survol (l.217) : −5, et −15 de PLUS quand le général tombe ; Échec Stupéfiant → Charge', () => {
    const survol = activityById('survol')!;
    expect(total(deltas(survol, testRes(true, 2)))).toBe(-5);
    expect(total(deltas(survol, testRes(true, 6, true)))).toBe(-20); // −5 −15 generalDown
    expect(chains(survol, testRes(false, -6))).toEqual(['charge']);
    expect(chains(survol, testRes(false, -2))).toEqual([]);
  });

  it('Duel (l.223-225) : −20 solo, −10 + Charge si intervention, −20 ALLIÉ si le champion PERD', () => {
    const duel = activityById('duel')!;
    expect(total(deltas(duel, combatWin(3, 1, 1)))).toBe(-20); // solo (noIntervention)
    expect(chains(duel, combatWin(3, 1, 1))).toEqual([]);
    expect(total(deltas(duel, combatWin(4, 1, 2)))).toBe(-10); // intervention
    expect(chains(duel, combatWin(4, 1, 2))).toEqual(['charge']);
    // Défaite : le camp ALLIÉ perd −20 (l.223, symétrique) ; pas de Charge.
    expect(deltas(duel, combatLoss(2, 1))).toEqual([{ side: 'allie', amount: -20 }]);
    expect(chains(duel, combatLoss(2, 1))).toEqual([]);
  });

  it('Compte à rebours (l.167) : ennemi −10 ; échec → Motivation imposée', () => {
    const cr = activityById('compte-a-rebours')!;
    expect(total(deltas(cr, testRes(true, 3)))).toBe(-10);
    expect(chains(cr, testRes(false, -2))).toEqual(['motivation']);
  });

  it('Percée (l.173) : COMBAT, victoire → ally +10 ; défaite → Charge (pas de +10)', () => {
    const percee = activityById('percee')!;
    expect(percee.sceneKind).toBe('combat');
    expect(deltas(percee, combatWin(4, 2, 1))).toEqual([{ side: 'allie', amount: 10 }]);
    expect(chains(percee, combatWin(4, 2, 1))).toEqual([]);
    expect(deltas(percee, combatLoss(2, 1))).toEqual([]);
    expect(chains(percee, combatLoss(2, 1))).toEqual(['charge']);
  });

  it('Tenez votre position (l.161) : sceneKind hold + paramètres du Point de rupture ; issue −2 ennemi', () => {
    const t = activityById('tenez-votre-position')!;
    expect(t.sceneKind).toBe('hold');
    expect(t.hold).toEqual({ breakpoint: 10, maxRounds: 5, enemyBonusPerHold: 10 });
    expect(total(deltas(t, testRes(true, 0)))).toBe(-2); // −2 Puissance ennemie par Round tenu (l.163)
  });

  it('Intrus (l.219) : sceneKind threat, pénalité −20 aux autres Scènes', () => {
    const intrus = activityById('intrus')!;
    expect(intrus.sceneKind).toBe('threat');
    expect(intrus.threat?.penalty).toBe(-20);
  });

  it('Rassemblement (l.122) : sceneKind rally, Test de Résistance — sa résolution passe par le genre de Scène', () => {
    const r = activityById('rassemblement')!;
    expect(r.sceneKind).toBe('rally');
    expect(r.tests).toEqual([{ skill: { id: 'resistance' }, difficulty: 'intermediaire' }]);
    // Le genre 'rally' est la SEULE clé de résolution (branche `sceneKind === 'rally'` de
    // `massBattleFlow.confirmBattleActivity`) : aucune bande d'issue, aucun résolveur.
    expect(r.outcomes ?? []).toEqual([]);
    expect(r.resolver).toBeUndefined();
  });
});

describe('Conditions de bataille (battleCondMet)', () => {
  it('generalDown / intervention / combatWon / combatLost', () => {
    expect(battleCondMet(undefined, testRes(true, 0))).toBe(true);
    expect(battleCondMet('generalDown', testRes(true, 6, true))).toBe(true);
    expect(battleCondMet('generalDown', testRes(true, 3))).toBe(false);
    expect(battleCondMet('intervention', combatWin(3, 1, 2))).toBe(true);
    expect(battleCondMet('noIntervention', combatWin(3, 1, 1))).toBe(true);
    expect(battleCondMet('combatWon', combatWin(3, 1, 1))).toBe(true);
    expect(battleCondMet('combatLost', combatLoss(2, 1))).toBe(true);
    expect(battleCondMet('combatWon', combatLoss(2, 1))).toBe(false);
  });
});
