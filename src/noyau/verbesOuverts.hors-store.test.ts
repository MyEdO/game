/**
 * LES VERBES OUVERTS D'UN JET (#2936) : pour chaque flux mono d'une étape-jet de combat (attaque, défense, Test,
 * incantation), la fenêtre qui tient la main n'ouvre, avant le jet puis après lui, que les verbes que les gardes des
 * ops de son flux laissent passer (`fermeturesDeLaFenetre`), et chaque verbe fermé dit pourquoi
 * (`FermetureDuJet`). Le duel est celui de `combatDeTest.testkit.ts`, ses pendings posés comme `jetsEnVue`.
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, fermeturesDeLaFenetre, fenetreDuJeu, type EntreesDeLaPartie, type Jeu } from './index';
import { fermeturesDeLaMaladresse } from './verbesOuverts';
import { rollOups } from '../engine/oups';
import { makeRNG } from '../engine/dice';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { evaluateTest, type TestResult } from '../engine/tests';
import { setDesFixes } from '../engine/fixedDie';
import type { AttackResult, RollBreakdown } from '../engine/combat';
import type { CascadeStep, PendingAttack, PendingCascade, PendingCast, PendingDefense, PendingTest } from './pendings';
import type { HostJet } from './slotsDeJet';
import type { FermetureDuJet } from './rollFlowFactory';
import { fixtureText } from '../i18n/fixtureText';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

function leDuel() {
  const ouverture = creerPartie({ ...etatInitialDuJeu(), party: [heroDuDuel()] }, ENTREES);
  ouverture.envoyer({ type: 'startScene', args: [testScene()] });
  ouverture.envoyer({ type: 'startCombat', args: ['enc-mutants'] });
  ouverture.envoyer({ type: 'confirmRoundStart', args: [] });
  const garde = ouverture.etat();
  ouverture.fermer();
  const contact = auContact(garde);
  return { ...contact, etat: { ...garde, ...contact.patch } as Jeu };
}

const { H, E, etat: BASE } = leDuel();

const tr = (roll: number, target: number): TestResult => ({ ...evaluateTest(roll, target), base: target });
const bd = (label: string, roll: number, target: number): RollBreakdown => {
  const t = evaluateTest(roll, target);
  return { label, base: target, modifier: 0, target, roll, sl: t.sl, success: t.success };
};
const COUP: AttackResult = {
  hit: true, attackerRoll: 21, netSL: 2, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
  attackerDetail: bd('Corps à corps', 21, 45), defenderDetail: bd('Esquive', 60, 40),
};
const cascade = (step: CascadeStep): PendingCascade => ({ title: 'Témoin', cursor: 0, seq: 1, log: [], purpose: 'combat', participants: [step] });
const etape = (jet: HostJet): CascadeStep => ({ id: `hote-${jet}`, kind: 'triggeredTest', actorId: H.id, jet, label: fixtureText(`hote-${jet}`) });

const attaque = (result: AttackResult | null = null): PendingAttack => ({ attackerId: H.id, targetId: E.id, location: null, result });
const defense = (jete: boolean, def = tr(60, 40)): PendingDefense => ({
  attackerId: E.id, defenderId: H.id, weapon: E.weapons[0], location: null, atk: tr(21, 45), mode: 'esquive',
  def: jete ? def : null,
  result: jete ? COUP : null,
  suite: { mode: 'pilotee', pa: { attackerId: E.id, targetId: H.id, location: null, result: null } },
});
const test = (jete: boolean, cancellable = true): PendingTest => ({
  actorId: H.id, actorName: H.label, label: 'Escalade', skillValue: 40, difficulty: 'intermediaire', requireSL: 0, target: 40, cancellable,
  ...(jete ? { roll: 25, success: true, sl: 1 } : { roll: null, success: false, sl: 0 }),
});
const incantation = (jete: boolean, isCritical = false): PendingCast => ({
  casterId: H.id, targetId: E.id, spellId: 'alerte', missile: false, focused: false,
  result: jete ? { cast: true, roll: isCritical ? 22 : 21, target: 45, sl: 2, isCritical, isFumble: false, log: '' } : null,
});
/** Le héros du duel, sa Résilience à `n`. */
const resilienceA = (n: number): Partial<Jeu> => reserves({ resilience: n });
/** Le héros du duel, ses réserves réécrites. */
function reserves(r: { resilience?: number; resolve?: number }): Partial<Jeu> {
  return { battle: { ...BASE.battle!, combatants: BASE.battle!.combatants.map((c) => (c.id === H.id ? { ...c, ...r } : c)) } };
}

/** Les verbes de la fenêtre qui tient la main, ouverts puis fermés avec ce qui les ferme. */
function verbes(patch: Partial<Jeu>): { ouverts: string[]; fermes: Record<string, FermetureDuJet> } {
  const s = { ...BASE, ...patch } as Jeu;
  const f = fenetreDuJeu(s);
  expect(f, 'aucune fenêtre ne tient la main').not.toBeNull();
  const juges = fermeturesDeLaFenetre(s, f);
  const fermes: Record<string, FermetureDuJet> = {};
  for (const [v, raison] of juges) if (raison) fermes[v] = raison;
  return { ouverts: [...juges].filter(([, r]) => r === null).map(([v]) => v).sort(), fermes };
}

/** L'étape-jet `jet` de la cascade, son pending posé. */
const enEtape = (jet: HostJet, pending: Partial<Jeu>): Partial<Jeu> => ({ pendingCascade: cascade(etape(jet)), ...pending });

describe('fermeturesDeLaFenetre — une étape-jet de combat n’ouvre que ce que les ops de son flux laissent passer', () => {
  it('attaque : avant le jet, lancer, annuler ou choisir le dé par Résilience ; après, la clôture et les influences que le jet réussi admet', () => {
    const avant = verbes(enEtape('attack', { pendingAttack: attaque() }));
    expect(avant.ouverts).toEqual(['attackCancel', 'attackForceSuccess', 'attackRoll']);
    expect(avant.fermes).toMatchObject({ attackConfirm: 'jetNonLance', attackReroll: 'jetNonLance', attackSetForcedRoll: 'jetNonLance' });
    const apres = verbes(enEtape('attack', { pendingAttack: attaque(COUP) }));
    expect(apres.ouverts).toEqual(['attackBonusSL', 'attackConfirm', 'attackDarkPact', 'attackSetForcedRoll']);
    expect(apres.fermes).toMatchObject({ attackRoll: 'jetLance', attackCancel: 'jetLance', attackReroll: 'jetReussi', attackForceSuccess: 'jetReussi', attackReverse: 'sansVoieDInversion' });
  });

  it('attaque : la 2ᵉ frappe du Maniement de deux armes a son jet imposé (LDB 10 l.767-773)', () => {
    const { fermes } = verbes(enEtape('attack', { pendingAttack: { ...attaque(COUP), dualSecond: true } as PendingAttack }));
    expect(fermes).toMatchObject({ attackReroll: 'jetImpose', attackDarkPact: 'jetImpose', attackReverse: 'jetImpose', attackCancel: 'jetImpose' });
  });

  it('défense : avant le jet, le jet ou la Résilience ; après, la clôture et toute l’influence d’un jet raté', () => {
    const avant = verbes(enEtape('defense', { pendingDefense: defense(false) }));
    expect(avant.ouverts).toEqual(['defenseForceSuccess', 'defenseRoll']);
    expect(avant.fermes).toMatchObject({ defenseConfirm: 'jetNonLance', defenseReroll: 'jetNonLance', defenseSetForcedRoll: 'jetNonLance' });
    const apres = verbes(enEtape('defense', { pendingDefense: defense(true) }));
    expect(apres.ouverts).toEqual(['defenseBonusSL', 'defenseConfirm', 'defenseDarkPact', 'defenseForceSuccess', 'defenseReroll', 'defenseSetForcedRoll']);
    expect(apres.fermes).toMatchObject({ defenseRoll: 'jetLance' });
  });

  it('Test : avant le jet, lancer, annuler ou la Résilience, la Détermination sans malus psychologique fermée ; après, la clôture', () => {
    const avant = verbes(enEtape('test', { pendingTest: test(false) }));
    expect(avant.ouverts).toEqual(['testCancel', 'testForceSuccess', 'testRoll']);
    expect(avant.fermes).toMatchObject({ resolveTest: 'jetNonLance', testDetermine: 'sansMalusPsy', testSetForcedRoll: 'jetNonLance' });
    const apres = verbes(enEtape('test', { pendingTest: test(true) }));
    expect(apres.ouverts).toEqual(['resolveTest', 'testBonusSL', 'testDarkPact', 'testSetForcedRoll']);
    expect(apres.fermes).toMatchObject({ testRoll: 'jetLance', testCancel: 'jetLance', testReroll: 'jetReussi', testForceSuccess: 'jetReussi' });
    expect(verbes(enEtape('test', { pendingTest: test(false, false) })).fermes.testCancel, 'un Test de scène ne s’annule pas').toBe('nonOffert');
  });

  it('incantation : avant le jet, le jet ou la Résilience ; après, la clôture et les influences d’un jet réussi', () => {
    const avant = verbes(enEtape('cast', { pendingCast: incantation(false) }));
    expect(avant.ouverts).toEqual(['castForceSuccess', 'castRoll']);
    expect(avant.fermes).toMatchObject({ castConfirm: 'jetNonLance', castReroll: 'jetNonLance', castSetForcedRoll: 'jetNonLance' });
    const apres = verbes(enEtape('cast', { pendingCast: incantation(true) }));
    expect(apres.ouverts).toEqual(['castBonusSL', 'castConfirm', 'castDarkPact', 'castSetForcedRoll']);
    expect(apres.fermes).toMatchObject({ castRoll: 'jetLance', castReroll: 'jetReussi', castForceSuccess: 'jetReussi' });
  });

  it('sans l’option « Dés fixés », aucun dé ne se fixe après le jet', () => {
    setDesFixes(false);
    try {
      expect(verbes(enEtape('attack', { pendingAttack: attaque(COUP) })).fermes.attackSetForcedRoll).toBe('desFixesInactifs');
    } finally {
      setDesFixes(ENTREES.desFixes);
    }
  });

  it('Résilience : sans point, ni avant ni après le jet', () => {
    expect(verbes({ ...enEtape('attack', { pendingAttack: attaque() }), ...resilienceA(0) }).fermes.attackForceSuccess).toBe('sansResilience');
    expect(verbes({ ...enEtape('defense', { pendingDefense: defense(true) }), ...resilienceA(0) }).fermes.defenseForceSuccess).toBe('sansResilience');
  });

  it('Résilience : un jet propre réussi dont l’issue est perdue la laisse ouverte (LDB 17 l.68)', () => {
    const touche = verbes(enEtape('defense', { pendingDefense: defense(true, tr(30, 40)) }));
    expect(touche.ouverts).toContain('defenseForceSuccess');
    expect(touche.fermes.defenseReroll, 'la Chance, elle, suit le jet propre').toBe('jetReussi');
  });

  it('Détermination : un malus psychologique l’ouvre avant le jet, tant que la réserve n’est pas vide (LDB 17 l.59)', () => {
    const psy = (resolve: number) => verbes({ ...enEtape('test', { pendingTest: { ...test(false), psychMod: -20 } }), ...reserves({ resolve }) });
    expect(psy(2).ouverts).toContain('testDetermine');
    expect(psy(0).fermes.testDetermine).toBe('sansDetermination');
  });

  it('incantation Critique d’un Sort : la clôture attend le choix de l’effet (LDB 46 l.28-32)', () => {
    expect(verbes(enEtape('cast', { pendingCast: incantation(true, true) })).fermes.castConfirm).toBe('choixCritiqueDu');
    const choisi = verbes(enEtape('cast', { pendingCast: { ...incantation(true, true), critChoice: 'puissance' } }));
    expect(choisi.ouverts).toContain('castConfirm');
  });
});

describe('fermeturesDeLaMaladresse — le tirage des Oups ! (LDB 14), hors des flux de jet', () => {
  const maladresse = (tire: boolean): CascadeStep => ({
    ...etape('fumble'), fumble: { weapon: H.weapons[0], result: tire ? rollOups(H.weapons[0], makeRNG(3)) : null },
  });

  it('le tirage s’ouvre tant qu’il n’est pas tiré, son application une fois tiré', () => {
    expect(fermeturesDeLaMaladresse(maladresse(false))).toEqual({ fumbleRoll: null, fumbleConfirm: 'jetNonLance' });
    expect(fermeturesDeLaMaladresse(maladresse(true))).toEqual({ fumbleRoll: 'jetLance', fumbleConfirm: null });
    expect(fermeturesDeLaMaladresse(etape('fumble'))).toEqual({ fumbleRoll: 'sansJet', fumbleConfirm: 'sansJet' });
  });
});
