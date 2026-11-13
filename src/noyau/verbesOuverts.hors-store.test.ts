/**
 * LES VERBES OUVERTS D'UN JET (#2936) : pour chaque flux mono d'une étape-jet de combat (attaque, défense, Test,
 * incantation), la fenêtre qui tient la main n'ouvre, avant le jet puis après lui, que les verbes que les gardes des
 * ops de son flux laissent passer (`fermeturesDeLaFenetre`), et chaque verbe fermé dit pourquoi
 * (`FermetureDuJet`). Le duel est celui de `combatDeTest.testkit.ts`, ses pendings posés comme `jetsEnVue`.
 */
import { describe, it, expect } from 'vitest';
import {
  VERBE_DE_REGLAGE,
  creerPartie,
  etatInitialDuJeu,
  fenetreDeDetermination,
  fermeturesDeLaFenetre,
  fenetreDuJeu,
  libelleDeLaFermeture,
  type EntreesDeLaPartie,
  type Jeu,
} from './index';
import { t } from '../i18n';
import { fermeturesDuFlux } from './verbesOuverts';
import { rollOups } from '../engine/oups';
import { makeRNG } from '../engine/dice';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { evaluateTest, type TestResult } from '../engine/tests';
import { setDesFixes } from '../engine/fixedDie';
import { resetRule, setRule } from '../engine/policy';
import type { AttackResult, RollBreakdown } from '../engine/combat';
import type {
  CascadeStep,
  OppositionParticipant,
  PendingAttack,
  PendingCascade,
  PendingCast,
  PendingCastOpposition,
  PendingDefense,
  PendingTest,
} from './pendings';
import type { HostJet } from './slotsDeJet';
import type { FermetureDuJet } from './rollFlowFactory';
import { fixtureText } from '../i18n/fixtureText';
import { tableTotale } from '../lib/tableTotale';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

function leDuel() {
  const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
  ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
  ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
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
  hit: true, attackerRoll: 21, netSL: 2, critical: false, advantageTo: 'attaquant', defenderDefeated: false, log: '',
  attackerDetail: bd('Corps à corps', 21, 45), defenderDetail: bd('Esquive', 60, 40),
};
const cascade = (step: CascadeStep): PendingCascade => ({ title: 'Témoin', cursor: 0, seq: 1, log: [], purpose: 'combat', participants: [step] });
const etape = (jet: HostJet): CascadeStep => ({ id: `hote-${jet}`, kind: 'testDeclenche', actorId: H.id, jet, label: fixtureText(`hote-${jet}`) });

const attaque = (result: AttackResult | null = null): PendingAttack => ({ attackerId: H.id, targetId: E.id, location: null, result });
const defense = (jete: boolean, def = tr(60, 40)): PendingDefense => ({
  attackerId: E.id, defenderId: H.id, weapon: E.weapons[0], location: null, atk: tr(21, 45), mode: 'esquive',
  def: jete ? def : null,
  result: jete ? COUP : null,
  suite: { mode: 'pilotee', pa: { attackerId: E.id, targetId: H.id, location: null, result: null } },
});
const test = (jete: boolean, cancellable = true): PendingTest => ({
  actorId: H.id, label: 'Escalade', skillValue: 40, difficulty: 'intermediaire', requireSL: 0, target: 40, cancellable,
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

/** Les porteurs auxquels la fenêtre qui tient la main offre l'immunité de la Détermination, chacun avec son refus
 *  (`fenetreDeDetermination`). */
const immunite = (patch: Partial<Jeu>) => fenetreDeDetermination({ ...BASE, ...patch } as Jeu)?.porteur.options;

/** L'étape-jet `jet` de la cascade, son pending posé. */
const enEtape = (jet: HostJet, pending: Partial<Jeu>): Partial<Jeu> => ({ pendingCascade: cascade(etape(jet)), ...pending });

describe('fermeturesDeLaFenetre — une étape-jet de combat n’ouvre que ce que les ops de son flux laissent passer', () => {
  it('attaque : avant le jet, lancer, annuler ou choisir le dé par Résilience ; après, la clôture et les influences que le jet réussi admet', () => {
    const avant = verbes(enEtape('attaque', { pendingAttack: attaque() }));
    expect(avant.ouverts).toEqual(['jetAnnuler@attaque', 'jetForcerLaReussite@attaque', 'jetLancer@attaque']);
    expect(avant.fermes).toMatchObject({ 'jetValider@attaque': 'jetNonLance', 'jetRelancer@attaque': 'jetNonLance', 'jetImposerLeResultat@attaque': 'jetNonLance' });
    const apres = verbes(enEtape('attaque', { pendingAttack: attaque(COUP) }));
    expect(apres.ouverts).toEqual(['jetAjouterUnDR@attaque', 'jetImposerLeResultat@attaque', 'jetPactiser@attaque', 'jetValider@attaque']);
    expect(apres.fermes).toMatchObject({ 'jetLancer@attaque': 'jetLance', 'jetAnnuler@attaque': 'jetLance', 'jetRelancer@attaque': 'jetReussi', 'jetForcerLaReussite@attaque': 'jetReussi', 'jetInverser@attaque': 'sansVoieDInversion' });
  });

  it('attaque : la 2ᵉ frappe du Maniement de deux armes a son jet imposé (LDB 10 l.767-773)', () => {
    const { fermes } = verbes(enEtape('attaque', { pendingAttack: { ...attaque(COUP), dualSecond: true } as PendingAttack }));
    expect(fermes).toMatchObject({ 'jetRelancer@attaque': 'jetImpose', 'jetPactiser@attaque': 'jetImpose', 'jetInverser@attaque': 'jetImpose', 'jetAnnuler@attaque': 'jetLance' });
    const avant = verbes(enEtape('attaque', { pendingAttack: { ...attaque(), dualSecond: true } as PendingAttack }));
    expect(avant.fermes['jetAnnuler@attaque'], 'avant le jet, l’Annuler se montre refusé (`refusDAnnulerLAttaque`)').toBe('actionEngagee');
  });

  it('défense : avant le jet, le jet ou la Résilience ; après, la clôture et toute l’influence d’un jet raté', () => {
    const avant = verbes(enEtape('defense', { pendingDefense: defense(false) }));
    expect(avant.ouverts).toEqual(['jetForcerLaReussite@defense', 'jetLancer@defense']);
    expect(avant.fermes).toMatchObject({ 'jetValider@defense': 'jetNonLance', 'jetRelancer@defense': 'jetNonLance', 'jetImposerLeResultat@defense': 'jetNonLance' });
    const apres = verbes(enEtape('defense', { pendingDefense: defense(true) }));
    expect(apres.ouverts).toEqual(['jetAjouterUnDR@defense', 'jetForcerLaReussite@defense', 'jetImposerLeResultat@defense', 'jetPactiser@defense', 'jetRelancer@defense', 'jetValider@defense']);
    expect(apres.fermes).toMatchObject({ 'jetLancer@defense': 'jetLance' });
  });

  it('Test : avant le jet, lancer, annuler ou la Résilience, la Détermination sans malus psychologique fermée ; après, la clôture', () => {
    const avant = verbes(enEtape('test', { pendingTest: test(false) }));
    expect(avant.ouverts).toEqual(['jetAnnuler@test', 'jetForcerLaReussite@test', 'jetLancer@test']);
    expect(avant.fermes).toMatchObject({ 'jetValider@test': 'jetNonLance', 'jetImposerLeResultat@test': 'jetNonLance' });
    expect(immunite(enEtape('test', { pendingTest: test(false) })), 'sans malus psychologique, la Détermination offerte se ferme').toEqual([{ valeur: H.id, libelle: H.label, refus: t('cs.determinationSansMalusPsy') }]);
    const apres = verbes(enEtape('test', { pendingTest: test(true) }));
    expect(apres.ouverts).toEqual(['jetAjouterUnDR@test', 'jetImposerLeResultat@test', 'jetPactiser@test', 'jetValider@test']);
    expect(apres.fermes).toMatchObject({ 'jetLancer@test': 'jetLance', 'jetAnnuler@test': 'jetLance', 'jetRelancer@test': 'jetReussi', 'jetForcerLaReussite@test': 'jetReussi' });
    expect(verbes(enEtape('test', { pendingTest: test(false, false) })).fermes['jetAnnuler@test'], 'un Test de scène ne s’annule pas').toBe('nonOffert');
  });

  it('incantation : avant le jet, le jet ou la Résilience ; après, la clôture et les influences d’un jet réussi', () => {
    const avant = verbes(enEtape('incantation', { pendingCast: incantation(false) }));
    expect(avant.ouverts).toEqual(['jetAnnuler@incantation', 'jetForcerLaReussite@incantation', 'jetLancer@incantation']);
    expect(avant.fermes).toMatchObject({ 'jetValider@incantation': 'jetNonLance', 'jetRelancer@incantation': 'jetNonLance', 'jetImposerLeResultat@incantation': 'jetNonLance' });
    const apres = verbes(enEtape('incantation', { pendingCast: incantation(true) }));
    expect(apres.ouverts).toEqual(['jetAjouterUnDR@incantation', 'jetImposerLeResultat@incantation', 'jetPactiser@incantation', 'jetValider@incantation']);
    expect(apres.fermes).toMatchObject({ 'jetLancer@incantation': 'jetLance', 'jetRelancer@incantation': 'jetReussi', 'jetForcerLaReussite@incantation': 'jetReussi' });
  });

  it('un réglage se joue dans sa phase (`REGLAGES_DU_JET`) : avant le dé, ou une fois le dé tombé', () => {
    const avantLeJet = ['arme', 'deuxArmes', 'empoigner', 'localisation', 'retenirSesCoups', 'sansLaCorde'].map((r) => `jetRegler@attaque#${r}`);
    const avant = verbes(enEtape('attaque', { pendingAttack: attaque() }), true);
    expect(avant.ouverts).toEqual(avantLeJet);
    expect(avant.fermes).toEqual({ 'jetRegler@attaque#localisationDuCritique': 'jetNonLance' });
    const apres = verbes(enEtape('attaque', { pendingAttack: attaque(COUP) }), true);
    expect(apres.ouverts).toEqual(['jetRegler@attaque#localisationDuCritique']);
    expect(apres.fermes).toEqual(tableTotale(avantLeJet, () => 'jetLance'));
    const lance = verbes(enEtape('incantation', { pendingCast: incantation(true, true) }), true);
    expect(lance.ouverts, 'LDB 46 l.26-32 ; LDB 47 l.15-17').toEqual(expect.arrayContaining(['jetRegler@incantation#effetCritique', 'jetRegler@incantation#surincantationDuree', 'jetRegler@incantation#ciblesSupplementaires']));
    expect(lance.fermes).toMatchObject({ 'jetRegler@incantation#discret': 'jetLance' });
  });

  it('sans l’option « Dés fixés », aucun dé ne se fixe après le jet', () => {
    setDesFixes(false);
    try {
      expect(verbes(enEtape('attaque', { pendingAttack: attaque(COUP) })).fermes['jetImposerLeResultat@attaque']).toBe('desFixesInactifs');
    } finally {
      setDesFixes(ENTREES.desFixes);
    }
  });

  it('Résilience : sans point, ni avant ni après le jet', () => {
    expect(verbes({ ...enEtape('attaque', { pendingAttack: attaque() }), ...resilienceA(0) }).fermes['jetForcerLaReussite@attaque']).toBe('sansResilience');
    expect(verbes({ ...enEtape('defense', { pendingDefense: defense(true) }), ...resilienceA(0) }).fermes['jetForcerLaReussite@defense']).toBe('sansResilience');
  });

  it('Résilience : un jet propre réussi dont l’issue est perdue la laisse ouverte (LDB 17 l.68)', () => {
    const touche = verbes(enEtape('defense', { pendingDefense: defense(true, tr(30, 40)) }));
    expect(touche.ouverts).toContain('jetForcerLaReussite@defense');
    expect(touche.fermes['jetRelancer@defense'], 'la Chance, elle, suit le jet propre').toBe('jetReussi');
  });

  it('Résilience : une incantation au d100 réussi mais au NI non atteint la laisse ouverte (LDB 17 l.68, l.75)', () => {
    const rate = verbes(enEtape('incantation', { pendingCast: { ...incantation(true), result: { ...incantation(true).result!, cast: false } } }));
    expect(rate.ouverts).toContain('jetForcerLaReussite@incantation');
    expect(rate.fermes['jetAnnuler@incantation']).toBe('jetLance');
  });

  it('Détermination : un malus psychologique l’ouvre avant le jet, tant que la réserve n’est pas vide (LDB 17 l.59)', () => {
    const psy = (resolve: number): Partial<Jeu> => ({ ...enEtape('test', { pendingTest: { ...test(false), psychMod: -20 } }), ...reserves({ resolve }) });
    expect(immunite(psy(2))).toEqual([{ valeur: H.id, libelle: H.label, refus: null }]);
    expect(immunite(psy(0))).toEqual([{ valeur: H.id, libelle: H.label, refus: t('agate.noResolve') }]);
    expect(immunite({ ...psy(2), pendingTest: { ...test(true), psychMod: -20 } }), 'après le jet, le malus a pesé').toEqual([{ valeur: H.id, libelle: H.label, refus: libelleDeLaFermeture('jetLance') }]);
  });

  it('incantation Critique d’un Sort : la clôture attend le choix de l’effet (LDB 46 l.28-32)', () => {
    expect(verbes(enEtape('incantation', { pendingCast: incantation(true, true) })).fermes['jetValider@incantation']).toBe('choixCritiqueDu');
    const choisi = verbes(enEtape('incantation', { pendingCast: { ...incantation(true, true), critChoice: 'puissance' } }));
    expect(choisi.ouverts).toContain('jetValider@incantation');
  });
});

describe('fermeturesDeLaFenetre — un geste de jet se juge sur SON flux (#3311)', () => {
  it('l’incantation jetée et son Contre-sort à jeter : le même verbe, fermé sur l’un, ouvert sur l’autre', () => {
    const contre = { participants: [{ id: E.id, interactive: true, declared: 'solo', result: null }] } as unknown as Jeu['pendingCounterspell'];
    const { ouverts, fermes } = verbes(enEtape('incantation', { pendingCast: incantation(true), pendingCounterspell: contre }));
    expect(fermes['jetLancer@incantation'], 'le jet d’incantation est tombé').toBe('jetLance');
    expect(ouverts, 'la rangée du Contre-sort, elle, reste à jeter').toContain('jetLancer@contreSort');
  });

  it('le Contre-sort ouvert : « Tout déclarer » tant qu’une rangée d’ici est vierge, l’incantation ne s’applique qu’après lui (LDB 46 l.156)', () => {
    const contre = (declared: string | undefined) => ({ participants: [{ id: H.id, interactive: true, declared, result: null }] }) as unknown as Jeu['pendingCounterspell'];
    const vierge = verbes(enEtape('incantation', { pendingCast: incantation(true), pendingCounterspell: contre(undefined) }), true);
    expect(vierge.ouverts, 'une rangée du héros reste à déclarer').toContain('jetRegler@contreSort*#declaration');
    const declare = verbes(enEtape('incantation', { pendingCast: incantation(true), pendingCounterspell: contre('solo') }));
    expect(verbes(enEtape('incantation', { pendingCast: incantation(true), pendingCounterspell: contre('solo') }), true).fermes['jetRegler@contreSort*#declaration'], 'plus rien à déclarer : l’Entrée passe au jet').toBe('rienADeclarer');
    expect(declare.ouverts).toContain('jetLancer@contreSort');
    expect(declare.fermes['jetValider@incantation'], 'l’incantation attend son Contre-sort').toBe('contreSortDu');
    expect(verbes(enEtape('incantation', { pendingCast: incantation(true) })).ouverts, 'sans Contre-sort, l’incantation s’applique').toContain('jetValider@incantation');
  });

  it('l’incantation n’offre que les réglages qui changent son Sort', () => {
    const { fermes } = verbes(enEtape('incantation', { pendingCast: incantation(true) }), true);
    expect(['effetCritique', 'formeConjuree', 'discret', 'jetsDeTable'].map((r) => fermes[`jetRegler@incantation#${r}`]), 'un Sort jeté sans Critique, sans arme invoquée ni Durée surincantée')
      .toEqual(['nonOffert', 'nonOffert', 'jetLance', 'nonOffert']);
    expect(verbes(enEtape('incantation', { pendingCast: incantation(true, true) }), true).ouverts, 'LDB 46 l.26-32').toContain('jetRegler@incantation#effetCritique');
    setRule('priere-conviction', true);
    try {
      const priere = verbes(enEtape('incantation', { pendingCast: { ...incantation(false), spellId: 'benediction-de-guerison' } }), true);
      expect(priere.ouverts, 'LDB 40 l.42').toContain('jetRegler@incantation#discret');
      expect(priere.fermes['jetRegler@incantation#effetCritique'], 'une Prière n’a pas de Critique').toBe('jetNonLance');
    } finally {
      resetRule('priere-conviction');
    }
  });
});

describe('la Maladresse (LDB 14) : le flux `maladresse`, son tirage puis sa clôture', () => {
  const maladresse = (tire: boolean): CascadeStep => ({
    ...etape('maladresse'), maladresse: { weapon: H.weapons[0], result: tire ? rollOups(H.weapons[0], makeRNG(3)) : null },
  });

  it('le tirage s’ouvre tant qu’il n’est pas tiré, son application une fois tiré', () => {
    expect(verbes({ pendingCascade: cascade(maladresse(false)) })).toMatchObject({ ouverts: ['jetLancer@maladresse'], fermes: { 'jetValider@maladresse': 'jetNonLance' } });
    expect(verbes({ pendingCascade: cascade(maladresse(true)) })).toMatchObject({ ouverts: ['jetValider@maladresse'], fermes: { 'jetLancer@maladresse': 'jetLance' } });
  });

  it('une étape sans Maladresse ne se tire ni ne s’applique', () => {
    const s = { ...BASE, pendingCascade: cascade(etape('maladresse')) } as Jeu;
    expect([fermeturesDuFlux(s, 'maladresse').lancer, fermeturesDuFlux(s, 'maladresse').valider]).toEqual(['sansJet', 'sansJet']);
  });
});

describe('fermeturesDuFlux — la clôture d’une opposition au Sort', () => {
  it('se montre refusée tant qu’une cible interactive n’a pas opposé son Test', () => {
    const cible = (result: OppositionParticipant['result']) => ({ id: H.id, interactive: true, result }) as OppositionParticipant;
    const opposition = (part: OppositionParticipant) => ({ pendingCastOpposition: { participants: [part] } as unknown as PendingCastOpposition });
    expect(fermeturesDuFlux({ ...BASE, ...opposition(cible(null)) } as Jeu, 'opposition').valider).toBe('oppositionsDues');
    expect(fermeturesDuFlux({ ...BASE, ...opposition(cible({ oppose: tr(30, 40), resisted: true, margin: 0 })) } as Jeu, 'opposition').valider).toBeNull();
  });
});
