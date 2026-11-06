/**
 * LES VERBES OUVERTS D'UN JET (#2936) : pour chaque flux mono d'une étape-jet de combat (attaque, défense, Test,
 * incantation), la fenêtre qui tient la main n'ouvre, avant le jet puis après lui, que les verbes que les gardes des
 * ops de son flux laissent passer (`fermeturesDeLaFenetre`), et chaque verbe fermé dit pourquoi
 * (`FermetureDuJet`). Le duel est celui de `combatDeTest.testkit.ts`, ses pendings posés comme `jetsEnVue`.
 */
import { describe, it, expect } from 'vitest';
import { VERBE_DE_REGLAGE, creerPartie, etatInitialDuJeu, fermeturesDeLaFenetre, fenetreDuJeu, type EntreesDeLaPartie, type Jeu } from './index';
import { fermeturesDuFlux } from './verbesOuverts';
import { rollOups } from '../engine/oups';
import { makeRNG } from '../engine/dice';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { evaluateTest, type TestResult } from '../engine/tests';
import { setDesFixes } from '../engine/fixedDie';
import { resetRule, setRule } from '../engine/policy';
import type { AttackResult, RollBreakdown } from '../engine/combat';
import type { CascadeStep, OppositionParticipant, PendingAttack, PendingCascade, PendingCast, PendingCastOpposition, PendingDefense, PendingTest } from './pendings';
import type { HostJet } from './slotsDeJet';
import type { FermetureDuJet } from './rollFlowFactory';
import { fixtureText } from '../i18n/fixtureText';
import { tableTotale } from '../lib/tableTotale';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

function leDuel() {
  const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
  ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), combatDirect: 'enc-mutants' });
  ouverture.envoyer({ type: 'fenetreValider', args: ['roundStart'] });
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

/** Les gestes de la fenêtre qui tient la main, ouverts puis fermés avec ce qui les ferme : ses verbes de jet, ou ses
 *  réglages (`jetRegler`). */
function verbes(patch: Partial<Jeu>, reglages = false): { ouverts: string[]; fermes: Record<string, FermetureDuJet> } {
  const s = { ...BASE, ...patch } as Jeu;
  const f = fenetreDuJeu(s);
  expect(f, 'aucune fenêtre ne tient la main').not.toBeNull();
  const juges = [...fermeturesDeLaFenetre(s, f)].filter(([v]) => v.startsWith(`${VERBE_DE_REGLAGE}@`) === reglages);
  const fermes: Record<string, FermetureDuJet> = {};
  for (const [v, raison] of juges) if (raison) fermes[v] = raison;
  return { ouverts: juges.filter(([, r]) => r === null).map(([v]) => v).sort(), fermes };
}

/** L'étape-jet `jet` de la cascade, son pending posé. */
const enEtape = (jet: HostJet, pending: Partial<Jeu>): Partial<Jeu> => ({ pendingCascade: cascade(etape(jet)), ...pending });

describe('fermeturesDeLaFenetre — une étape-jet de combat n’ouvre que ce que les ops de son flux laissent passer', () => {
  it('attaque : avant le jet, lancer, annuler ou choisir le dé par Résilience ; après, la clôture et les influences que le jet réussi admet', () => {
    const avant = verbes(enEtape('attack', { pendingAttack: attaque() }));
    expect(avant.ouverts).toEqual(['jetCancel@attack', 'jetForceSuccess@attack', 'jetRoll@attack']);
    expect(avant.fermes).toMatchObject({ 'jetConfirm@attack': 'jetNonLance', 'jetReroll@attack': 'jetNonLance', 'jetSetForcedRoll@attack': 'jetNonLance' });
    const apres = verbes(enEtape('attack', { pendingAttack: attaque(COUP) }));
    expect(apres.ouverts).toEqual(['jetBonusSL@attack', 'jetConfirm@attack', 'jetDarkPact@attack', 'jetSetForcedRoll@attack']);
    expect(apres.fermes).toMatchObject({ 'jetRoll@attack': 'jetLance', 'jetCancel@attack': 'jetLance', 'jetReroll@attack': 'jetReussi', 'jetForceSuccess@attack': 'jetReussi', 'jetReverse@attack': 'sansVoieDInversion' });
  });

  it('attaque : la 2ᵉ frappe du Maniement de deux armes a son jet imposé (LDB 10 l.767-773)', () => {
    const { fermes } = verbes(enEtape('attack', { pendingAttack: { ...attaque(COUP), dualSecond: true } as PendingAttack }));
    expect(fermes).toMatchObject({ 'jetReroll@attack': 'jetImpose', 'jetDarkPact@attack': 'jetImpose', 'jetReverse@attack': 'jetImpose', 'jetCancel@attack': 'jetLance' });
    const avant = verbes(enEtape('attack', { pendingAttack: { ...attaque(), dualSecond: true } as PendingAttack }));
    expect(avant.fermes['jetCancel@attack'], 'avant le jet, l’Annuler se montre refusé (`refusDAnnulerLAttaque`)').toBe('actionEngagee');
  });

  it('défense : avant le jet, le jet ou la Résilience ; après, la clôture et toute l’influence d’un jet raté', () => {
    const avant = verbes(enEtape('defense', { pendingDefense: defense(false) }));
    expect(avant.ouverts).toEqual(['jetForceSuccess@defense', 'jetRoll@defense']);
    expect(avant.fermes).toMatchObject({ 'jetConfirm@defense': 'jetNonLance', 'jetReroll@defense': 'jetNonLance', 'jetSetForcedRoll@defense': 'jetNonLance' });
    const apres = verbes(enEtape('defense', { pendingDefense: defense(true) }));
    expect(apres.ouverts).toEqual(['jetBonusSL@defense', 'jetConfirm@defense', 'jetDarkPact@defense', 'jetForceSuccess@defense', 'jetReroll@defense', 'jetSetForcedRoll@defense']);
    expect(apres.fermes).toMatchObject({ 'jetRoll@defense': 'jetLance' });
  });

  it('Test : avant le jet, lancer, annuler ou la Résilience, la Détermination sans malus psychologique fermée ; après, la clôture', () => {
    const avant = verbes(enEtape('test', { pendingTest: test(false) }));
    expect(avant.ouverts).toEqual(['jetCancel@test', 'jetForceSuccess@test', 'jetRoll@test']);
    expect(avant.fermes).toMatchObject({ 'jetConfirm@test': 'jetNonLance', 'jetDetermine@test': 'sansMalusPsy', 'jetSetForcedRoll@test': 'jetNonLance' });
    const apres = verbes(enEtape('test', { pendingTest: test(true) }));
    expect(apres.ouverts).toEqual(['jetBonusSL@test', 'jetConfirm@test', 'jetDarkPact@test', 'jetSetForcedRoll@test']);
    expect(apres.fermes).toMatchObject({ 'jetRoll@test': 'jetLance', 'jetCancel@test': 'jetLance', 'jetReroll@test': 'jetReussi', 'jetForceSuccess@test': 'jetReussi' });
    expect(verbes(enEtape('test', { pendingTest: test(false, false) })).fermes['jetCancel@test'], 'un Test de scène ne s’annule pas').toBe('nonOffert');
  });

  it('incantation : avant le jet, le jet ou la Résilience ; après, la clôture et les influences d’un jet réussi', () => {
    const avant = verbes(enEtape('cast', { pendingCast: incantation(false) }));
    expect(avant.ouverts).toEqual(['jetCancel@cast', 'jetForceSuccess@cast', 'jetRoll@cast']);
    expect(avant.fermes).toMatchObject({ 'jetConfirm@cast': 'jetNonLance', 'jetReroll@cast': 'jetNonLance', 'jetSetForcedRoll@cast': 'jetNonLance' });
    const apres = verbes(enEtape('cast', { pendingCast: incantation(true) }));
    expect(apres.ouverts).toEqual(['jetBonusSL@cast', 'jetConfirm@cast', 'jetDarkPact@cast', 'jetSetForcedRoll@cast']);
    expect(apres.fermes).toMatchObject({ 'jetRoll@cast': 'jetLance', 'jetReroll@cast': 'jetReussi', 'jetForceSuccess@cast': 'jetReussi' });
  });

  it('un réglage se joue dans sa phase (`REGLAGES_DU_JET`) : avant le dé, ou une fois le dé tombé', () => {
    const avantLeJet = ['arme', 'deuxArmes', 'empoigner', 'localisation', 'retenirSesCoups', 'sansLaCorde'].map((r) => `jetRegler@attack#${r}`);
    const avant = verbes(enEtape('attack', { pendingAttack: attaque() }), true);
    expect(avant.ouverts).toEqual(avantLeJet);
    expect(avant.fermes).toEqual({ 'jetRegler@attack#localisationDuCritique': 'jetNonLance' });
    const apres = verbes(enEtape('attack', { pendingAttack: attaque(COUP) }), true);
    expect(apres.ouverts).toEqual(['jetRegler@attack#localisationDuCritique']);
    expect(apres.fermes).toEqual(tableTotale(avantLeJet, () => 'jetLance'));
    const lance = verbes(enEtape('cast', { pendingCast: incantation(true, true) }), true);
    expect(lance.ouverts, 'LDB 46 l.26-32 ; LDB 47 l.15-17').toEqual(expect.arrayContaining(['jetRegler@cast#effetCritique', 'jetRegler@cast#surincantationDuree', 'jetRegler@cast#ciblesSupplementaires']));
    expect(lance.fermes).toMatchObject({ 'jetRegler@cast#discret': 'jetLance' });
  });

  it('sans l’option « Dés fixés », aucun dé ne se fixe après le jet', () => {
    setDesFixes(false);
    try {
      expect(verbes(enEtape('attack', { pendingAttack: attaque(COUP) })).fermes['jetSetForcedRoll@attack']).toBe('desFixesInactifs');
    } finally {
      setDesFixes(ENTREES.desFixes);
    }
  });

  it('Résilience : sans point, ni avant ni après le jet', () => {
    expect(verbes({ ...enEtape('attack', { pendingAttack: attaque() }), ...resilienceA(0) }).fermes['jetForceSuccess@attack']).toBe('sansResilience');
    expect(verbes({ ...enEtape('defense', { pendingDefense: defense(true) }), ...resilienceA(0) }).fermes['jetForceSuccess@defense']).toBe('sansResilience');
  });

  it('Résilience : un jet propre réussi dont l’issue est perdue la laisse ouverte (LDB 17 l.68)', () => {
    const touche = verbes(enEtape('defense', { pendingDefense: defense(true, tr(30, 40)) }));
    expect(touche.ouverts).toContain('jetForceSuccess@defense');
    expect(touche.fermes['jetReroll@defense'], 'la Chance, elle, suit le jet propre').toBe('jetReussi');
  });

  it('Résilience : une incantation au d100 réussi mais au NI non atteint la laisse ouverte (LDB 17 l.68, l.75)', () => {
    const rate = verbes(enEtape('cast', { pendingCast: { ...incantation(true), result: { ...incantation(true).result!, cast: false } } }));
    expect(rate.ouverts).toContain('jetForceSuccess@cast');
    expect(rate.fermes['jetCancel@cast']).toBe('jetLance');
  });

  it('Détermination : un malus psychologique l’ouvre avant le jet, tant que la réserve n’est pas vide (LDB 17 l.59)', () => {
    const psy = (resolve: number) => verbes({ ...enEtape('test', { pendingTest: { ...test(false), psychMod: -20 } }), ...reserves({ resolve }) });
    expect(psy(2).ouverts).toContain('jetDetermine@test');
    expect(psy(0).fermes['jetDetermine@test']).toBe('sansDetermination');
  });

  it('incantation Critique d’un Sort : la clôture attend le choix de l’effet (LDB 46 l.28-32)', () => {
    expect(verbes(enEtape('cast', { pendingCast: incantation(true, true) })).fermes['jetConfirm@cast']).toBe('choixCritiqueDu');
    const choisi = verbes(enEtape('cast', { pendingCast: { ...incantation(true, true), critChoice: 'puissance' } }));
    expect(choisi.ouverts).toContain('jetConfirm@cast');
  });
});

describe('fermeturesDeLaFenetre — un geste de jet se juge sur SON flux (#3311)', () => {
  it('l’incantation jetée et son Contre-sort à jeter : le même verbe, fermé sur l’un, ouvert sur l’autre', () => {
    const contre = { participants: [{ id: E.id, interactive: true, declared: 'solo', result: null }] } as unknown as Jeu['pendingCounterspell'];
    const { ouverts, fermes } = verbes(enEtape('cast', { pendingCast: incantation(true), pendingCounterspell: contre }));
    expect(fermes['jetRoll@cast'], 'le jet d’incantation est tombé').toBe('jetLance');
    expect(ouverts, 'la rangée du Contre-sort, elle, reste à jeter').toContain('jetRoll@counterspell');
  });

  it('le Contre-sort ouvert : « Tout déclarer » tant qu’une rangée d’ici est vierge, l’incantation ne s’applique qu’après lui (LDB 46 l.156)', () => {
    const contre = (declared: string | undefined) => ({ participants: [{ id: H.id, interactive: true, declared, result: null }] }) as unknown as Jeu['pendingCounterspell'];
    const vierge = verbes(enEtape('cast', { pendingCast: incantation(true), pendingCounterspell: contre(undefined) }));
    expect(vierge.ouverts, 'une rangée du héros reste à déclarer').toContain('counterspellDeclareAll');
    const declare = verbes(enEtape('cast', { pendingCast: incantation(true), pendingCounterspell: contre('solo') }));
    expect(declare.fermes.counterspellDeclareAll, 'plus rien à déclarer : l’Entrée passe au jet').toBe('rienADeclarer');
    expect(declare.ouverts).toContain('jetRoll@counterspell');
    expect(declare.fermes['jetConfirm@cast'], 'l’incantation attend son Contre-sort').toBe('contreSortDu');
    expect(verbes(enEtape('cast', { pendingCast: incantation(true) })).ouverts, 'sans Contre-sort, l’incantation s’applique').toContain('jetConfirm@cast');
  });

  it('l’incantation n’offre que les réglages qui changent son Sort', () => {
    const { fermes } = verbes(enEtape('cast', { pendingCast: incantation(true) }), true);
    expect(['effetCritique', 'formeConjuree', 'discret', 'jetsDeTable'].map((r) => fermes[`jetRegler@cast#${r}`]), 'un Sort jeté sans Critique, sans arme invoquée ni Durée surincantée')
      .toEqual(['nonOffert', 'nonOffert', 'jetLance', 'nonOffert']);
    expect(verbes(enEtape('cast', { pendingCast: incantation(true, true) }), true).ouverts, 'LDB 46 l.26-32').toContain('jetRegler@cast#effetCritique');
    setRule('prayer-conviction', true);
    try {
      const priere = verbes(enEtape('cast', { pendingCast: { ...incantation(false), spellId: 'benediction-de-guerison' } }), true);
      expect(priere.ouverts, 'LDB 40 l.42').toContain('jetRegler@cast#discret');
      expect(priere.fermes['jetRegler@cast#effetCritique'], 'une Prière n’a pas de Critique').toBe('jetNonLance');
    } finally {
      resetRule('prayer-conviction');
    }
  });
});

describe('la Maladresse (LDB 14) : le flux `fumble`, son tirage puis sa clôture', () => {
  const maladresse = (tire: boolean): CascadeStep => ({
    ...etape('fumble'), fumble: { weapon: H.weapons[0], result: tire ? rollOups(H.weapons[0], makeRNG(3)) : null },
  });

  it('le tirage s’ouvre tant qu’il n’est pas tiré, son application une fois tiré', () => {
    expect(verbes({ pendingCascade: cascade(maladresse(false)) })).toMatchObject({ ouverts: ['jetRoll@fumble'], fermes: { 'jetConfirm@fumble': 'jetNonLance' } });
    expect(verbes({ pendingCascade: cascade(maladresse(true)) })).toMatchObject({ ouverts: ['jetConfirm@fumble'], fermes: { 'jetRoll@fumble': 'jetLance' } });
  });

  it('une étape sans Maladresse ne se tire ni ne s’applique', () => {
    const s = { ...BASE, pendingCascade: cascade(etape('fumble')) } as Jeu;
    expect([fermeturesDuFlux(s, 'fumble').roll, fermeturesDuFlux(s, 'fumble').confirm]).toEqual(['sansJet', 'sansJet']);
  });
});

describe('fermeturesDuFlux — la clôture d’une opposition au Sort', () => {
  it('se montre refusée tant qu’une cible interactive n’a pas opposé son Test', () => {
    const cible = (result: OppositionParticipant['result']) => ({ id: H.id, interactive: true, result }) as OppositionParticipant;
    const opposition = (part: OppositionParticipant) => ({ pendingCastOpposition: { participants: [part] } as unknown as PendingCastOpposition });
    expect(fermeturesDuFlux({ ...BASE, ...opposition(cible(null)) } as Jeu, 'opposition').confirm).toBe('oppositionsDues');
    expect(fermeturesDuFlux({ ...BASE, ...opposition(cible({ oppose: tr(30, 40), resisted: true, margin: 0 })) } as Jeu, 'opposition').confirm).toBeNull();
  });
});
