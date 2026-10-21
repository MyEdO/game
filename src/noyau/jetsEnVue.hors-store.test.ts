/**
 * LES JETS EN VUE (`jetsEnVue`) — la classe des fenêtres à jet : chaque modale qui déclare un flux de jet
 * (`ModalDef.flux`, `HorsModalDef.flux`), chaque étape-jet hôte de cascade (`HostJet`) et chaque interaction de
 * cascade qui lance un dé rend, une fois le dé tombé, une ligne avec d100, cible, DR et verdict (la ligne tirée
 * pour une table) ; un Test opposé rend sa ligne gagnante et son DR net. Le duel est celui de
 * `combatDeTest.testkit.ts` ; les deux témoins du dôme passent par la surface de la partie.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { creerPartie, etatInitialDuJeu, jetsEnVue, type EntreesDeLaPartie, type EtatDeJeu, type Jeu, type JetEnVue, type LigneDeJet } from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { MODAL_DEFS, HORS_MODAL, type ModalDef, type HorsModalDef, type ModalKey } from './modalArbiter';
import { FLOW_VERBS, type FlowKey } from './flowVerbs';
import type { HostJet } from './slotsDeJet';
import type { CascadeStep, PendingAttack, PendingCascade } from './pendings';
import { fenetreDuJeu } from './combatAuto';
import { CRIT_TABLE_IDS } from './combatFlow';
import { tableStepDef } from './cascade';
import { evaluateTest, type TestResult } from '../engine/tests';
import type { AttackResult, RollBreakdown } from '../engine/combat';
import type { TestNomme } from '../engine/reglesChiffrees';
import { fixtureText } from '../i18n/fixtureText';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

/** Le duel ouvert, au tour du héros. */
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
const jet = (roll: number, target: number) => { const t = evaluateTest(roll, target); return { roll, target, sl: t.sl, success: t.success }; };
const TEST: TestNomme = { skill: { id: 'athletisme' }, difficulty: 'intermediaire', label: 'Course' };
const COUP: AttackResult = {
  hit: true, attackerRoll: 21, netSL: 2, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
  attackerDetail: bd('Corps à corps', 21, 45), defenderDetail: bd('Esquive', 60, 40),
};
const ATTAQUE: PendingAttack = { attackerId: H.id, targetId: E.id, location: null, result: COUP };

/** Une cascade d'une étape. */
const cascade = (step: CascadeStep, cursor = 0): PendingCascade => ({ title: 'Témoin', cursor, seq: 1, log: [], purpose: 'combat', participants: [step] });
const etapeHote = (jetHote: HostJet, extra: Pick<CascadeStep, 'fumble' | 'groupOwner'> = {}): CascadeStep => ({ id: `hote-${jetHote}`, kind: 'triggeredTest', actorId: H.id, jet: jetHote, label: fixtureText(`hote-${jetHote}`), ...extra });

/** `patch` en thunk quand il lit une table du jeu, posée à l'ouverture de la partie. */
interface Fixture { patch: Partial<Jeu> | (() => Partial<Jeu>); flux: readonly JetEnVue['flux'][]; oppose?: true }

/** Les modales du registre qui déclarent un flux de jet (`ModalDef.flux`) : leur état, le dé tombé. */
const FENETRES_A_JET: Partial<Record<ModalKey, Fixture>> = {
  battement: { patch: { pendingBattement: { attackerId: H.id, foeId: E.id, result: tr(34, 45) } }, flux: ['battement'] },
  distraire: { patch: { pendingDistraire: { moverId: H.id, foeId: E.id, atk: tr(20, 50), defRoll: tr(70, 40), result: 'success' } }, flux: ['distraire'], oppose: true },
  maneuver: { patch: { pendingManeuver: { attackerId: H.id, kind: 'vomi', maneuverId: 'vomi', avantageSpent: 0, result: tr(30, 40) } }, flux: ['maneuver'] },
  auContact: { patch: { pendingAuContact: { moverId: H.id, foeId: E.id, phase: 'choice', atk: tr(20, 50), def: tr(70, 40), result: 'failure' } }, flux: ['auContact'], oppose: true },
  grapple: { patch: { pendingGrapple: { actorId: H.id, foeId: E.id, phase: 'options', canBreak: false, atk: tr(25, 40), def: tr(35, 50), result: 'success' } }, flux: ['grapple'], oppose: true },
  frenzy: { patch: { pendingFrenzy: { combatantId: H.id, result: jet(12, 30) } }, flux: ['frenzy'] },
  approach: { patch: { pendingApproach: { combatantId: H.id, test: TEST, sourceId: E.id, sourceName: E.label, intent: { kind: 'entity', id: E.id }, result: jet(55, 30) } }, flux: ['approach'] },
  ward: { patch: { pendingWard: { attackerId: H.id, targetId: E.id, targetName: E.label, result: jet(10, 50) } }, flux: ['ward'] },
  run: { patch: { pendingRun: { combatantId: H.id, test: TEST, result: { success: true, roll: 22, dr: 2, bonusCases: 1, target: 44 } } }, flux: ['run'] },
  fall: { patch: { pendingFall: { test: TEST, to: { x: 9, y: 10 }, metres: 3, initiateurId: H.id, participants: [{ id: H.id, attempt: true, result: { success: false, roll: 80, dr: -3, effectiveMetres: 3, target: 44 } }] } }, flux: ['fall'] },
  shipManeuver: { patch: { pendingShipManeuver: { shipId: 'nef', turnSteps: 0, moraleScore: 0, participants: [{ id: H.id, roleId: 'timonier', essential: true, navigation: { id: 'navigation' }, result: jet(40, 45) }] } }, flux: ['shipManeuver'] },
  shipBattery: { patch: { pendingShipBattery: { shipId: 'nef', targetId: 'autre', side: 'babord', moraleScore: 0, participants: [{ id: H.id, roleId: 'capitaine', essential: false, navigation: { id: 'navigation' }, result: jet(40, 45) }] } }, flux: ['shipBattery'] },
  crewTest: { patch: { pendingCrewTest: { shipId: 'nef', testTypeId: 'x', moraleScore: 0, participants: [{ id: H.id, roleId: 'capitaine', essential: false, navigation: { id: 'navigation' }, result: jet(40, 45) }] } }, flux: ['crewTest'] },
  shanty: { patch: { pendingShanty: { shipId: 'nef', singerId: H.id, shantyId: 'x', result: jet(40, 45) } }, flux: ['shanty'] },
  focus: { patch: { pendingFocus: { casterId: H.id, spellId: 'x', result: { dr: 2, isCritical: false, isFumble: false, roll: 21, target: 45, sl: 2, log: '' } } }, flux: ['focus'] },
  dispel: { patch: { pendingDispel: { casterId: H.id, spellId: 'x', spellCasterId: E.id, label: 'Sort', ni: 4, value: 45, result: jet(21, 45) } }, flux: ['dispel'] },
  medic: {
    patch: {
      medic: {} as NonNullable<Jeu['medic']>,
      pendingSurgery: { healerId: H.id, healerName: H.label, targetId: H.id, targetName: H.label, skillValue: 40, intBonus: 3, difficulty: 'intermediaire', target: 40, roll: 33, success: true, sl: 0, traumaIdx: 0, targetDR: 3, cumDR: 0 },
    },
    flux: ['surgery'],
  },
  heal: { patch: { pendingHeal: { healerId: H.id, healerName: H.label, targetId: H.id, targetName: H.label, mode: 'wounds', intBonus: 3, skillValue: 40, difficulty: 'intermediaire', target: 40, roll: 33, success: true, sl: 0 } }, flux: ['heal'] },
  reload: { patch: { pendingReload: { actorId: H.id, actorName: H.label, weaponUid: 'w', reload: 2, progressBefore: 0, skillValue: 40, difficulty: 'intermediaire', roll: 12, target: 40, sl: 2, success: true } }, flux: ['reload'] },
  handGate: { patch: { pendingHandGate: { attackerId: H.id, actorName: H.label, hand: 'main', skillValue: 40, difficulty: 'accessible', roll: 70, target: 60, sl: -1, success: false, pa: ATTAQUE, title: 'Main', icon: 'x' } }, flux: ['handGate'] },
  stateRecovery: {
    patch: {
      pendingStateRecovery: {
        actorId: H.id, actorName: H.label, state: 'empetre', skillLabel: 'Force', skillValue: 40, skillBase: 40, difficulty: 'intermediaire',
        opposition: { value: 35, base: 35, label: E.label, difficulty: 'intermediaire' }, stacks: 1, roll: tr(20, 40), opponentRoll: tr(50, 35), netSL: 3, success: true,
      },
    },
    flux: ['recover'],
    oppose: true,
  },
  steamSave: { patch: { pendingSteamSave: { actorId: H.id, actorName: H.label, skillValue: 40, target: 40, difficulty: 'intermediaire', scaldOps: [], roll: 41, success: false, sl: 0 } }, flux: ['steamSave'] },
  activity: {
    patch: {
      pendingActivity: {
        heroId: H.id, kind: 'catalog', label: 'Tenez', skillLabel: 'Commandement', skillValue: 40, difficulty: 'intermediaire', roll: 30, target: 40, sl: 1, success: true,
        enemyValue: 45, enemyRoll: 60, enemySL: -2,
      },
      massBattle: { enemy: { label: 'Orques' } } as NonNullable<Jeu['massBattle']>,
    },
    flux: ['activity'],
    oppose: true,
  },
  etalLot: { patch: { pendingEtalLot: { label: 'Étal', cible: 'land', participants: [{ id: 'q', label: 'Quantité', min: 1, max: 6, value: 4, interactive: true, result: null }] } } as Partial<Jeu>, flux: ['etalLot'] },
  corruption: { patch: { pendingCorruption: { heroId: H.id, test: { ...TEST, skill: { id: 'calme' } }, roll: 30, target: 40, sl: 1, success: true } }, flux: ['corruption'] },
};

/** Les fenêtres hors registre qui tiennent la main et déclarent un flux de jet (`HorsModalDef.flux`). */
const HORS_REGISTRE_A_JET: Record<string, Fixture> = {
  bargain: {
    patch: {
      pendingBargain: {
        playerId: H.id, playerName: H.label, contrepartie: { titre: fixtureText(H.label), kind: 'marchand', mode: 'buy' }, opposant: { label: 'Marchand', valeur: 40 },
        playerSkill: 45, playerBase: 45, negotiator: false, roll: tr(20, 45), merchantRoll: tr(50, 40),
        result: { attacker: tr(20, 45), defender: tr(50, 40), winner: 'attacker', attackerWins: true, netSL: 4, decidedBy: 'dr' },
      },
    },
    flux: ['bargain'],
    oppose: true,
  },
  appraise: { patch: { pendingAppraise: { actorId: H.id, actorName: H.label, itemName: 'Dague', truePriceBrass: 20, availability: null, skillValue: 40, difficulty: 'intermediaire', target: 40, roll: 35, success: true, sl: 0 } }, flux: ['appraise'] },
};

/** Chaque étape-JET hôte de cascade (`HostJet`) et les flux que sa fenêtre héberge. Table TOTALE. */
const ETAPES_HOTES: Record<HostJet, Fixture> = {
  attack: { patch: { pendingCascade: cascade(etapeHote('attack')), pendingAttack: ATTAQUE }, flux: ['attack'], oppose: true },
  defense: {
    patch: {
      pendingCascade: cascade(etapeHote('defense')),
      pendingDefense: { attackerId: E.id, defenderId: H.id, weapon: E.weapons[0], location: null, atk: tr(21, 45), mode: 'esquive', def: tr(60, 40), result: { ...COUP, attackerDetail: bd('Attaque', 21, 45) }, suite: { mode: 'pilotee', pa: { ...ATTAQUE, attackerId: E.id, targetId: H.id } } },
    },
    flux: ['defense'],
    oppose: true,
  },
  fumble: { patch: { pendingCascade: cascade(etapeHote('fumble', { fumble: { weapon: H.weapons[0], result: { roll: 42, kind: 'misfire', label: 'Raté' } } })) }, flux: ['fumble'] },
  cast: {
    patch: {
      pendingCascade: cascade(etapeHote('cast')),
      pendingCast: { casterId: E.id, targetId: H.id, spellId: 'alerte', missile: false, focused: false, result: { cast: true, roll: 21, target: 45, sl: 2, isCritical: false, isFumble: false, log: '' } },
      pendingCounterspell: { participants: [{ id: H.id, result: { dispelled: true, counter: tr(10, 50), casterNetSL: 0, log: '' } }] },
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', participants: [{ id: H.id, result: { oppose: tr(30, 40), resisted: true, margin: 1 } }] },
    },
    flux: ['cast', 'counterspell', 'opposition'],
    oppose: true,
  },
  test: { patch: { pendingCascade: cascade(etapeHote('test')), pendingTest: { actorId: H.id, actorName: H.label, label: 'Escalade', skillValue: 40, difficulty: 'intermediaire', requireSL: 0, target: 40, roll: 25, success: true, sl: 1 } }, flux: ['test'] },
  extended: {
    patch: {
      pendingCascade: cascade(etapeHote('extended')),
      pendingExtendedTest: { actorId: H.id, label: 'Porte', skillLabel: 'Force', target: 45, targetDR: 4, total: 0, rounds: [{ id: 'r1', result: { roll: 21, sl: 2, success: true } }] },
    },
    flux: ['extendedTest'],
  },
  disengage: {
    patch: { pendingCascade: cascade(etapeHote('disengage')), pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'esquive', atk: tr(30, 45), def: tr(20, 40), result: 'success' } },
    flux: ['disengage'],
    oppose: true,
  },
  forceDoor: {
    patch: {
      pendingCascade: cascade(etapeHote('forceDoor', { groupOwner: true })),
      pendingForceDoor: { label: 'Porte', doorBE: 3, doorB: 10, doorBmax: 10, participants: [{ id: H.id, result: { roll: 21, target: 45, sl: 2, damage: 4 } }] },
    },
    flux: ['forceDoor'],
  },
};

/** Le coup dans le dos et le Test `fuite` d'une fuite (`disengage`, phase `fuir`). */
const FUITE: Fixture = {
  patch: {
    pendingCascade: cascade(etapeHote('disengage')),
    pendingDisengage: {
      moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'fuir', atk: null, def: null, result: null,
      fuir: { participants: [{ id: E.id, kind: 'backstab', result: { ...COUP, defenderDetail: undefined } }, { id: H.id, kind: 'touche', test: TEST, jet: jet(66, 40) }] },
    },
  },
  flux: ['flee'],
};

const PART = { id: H.id, base: 40, target: 40, result: jet(25, 40) };

/** Les interactions de cascade qui lancent un dé, hors étape hôte. */
const INTERACTIONS: Record<'jet' | 'jetOppose' | 'batch' | 'batchOppose' | 'table' | 'de' | 'bilan', Fixture> = {
  jet: { patch: { pendingCascade: cascade({ id: 'j', kind: 'triggeredTest', actorId: H.id, rollLabel: 'Résistance', target: 45, base: 45, result: jet(30, 45) }) }, flux: ['cascade'] },
  jetOppose: {
    patch: { pendingCascade: cascade({ id: 'j', kind: 'triggeredTest', actorId: H.id, rollLabel: 'Résistance', target: 45, base: 45, result: { ...jet(30, 45), success: true }, meta: { opposed: { aT: tr(40, 50), attackerId: E.id, attackerName: E.label } } }) },
    flux: ['cascade'],
    oppose: true,
  },
  batch: { patch: { pendingCascade: cascade({ id: 'b', kind: 'triggeredBatchTest', groupOwner: true, aggregate: 'none', participants: [{ ...PART, label: 'Calme' }] }) }, flux: ['cascadeBatch'] },
  batchOppose: {
    patch: { pendingCascade: cascade({ id: 'b', kind: 'triggeredBatchTest', groupOwner: true, aggregate: 'none', participants: [{ ...PART, label: 'Calme' }], meta: { opposed: { aT: tr(40, 50), attackerId: E.id, attackerName: E.label } } }) },
    flux: ['cascadeBatch'],
    oppose: true,
  },
  table: { patch: () => ({ pendingCascade: cascade(tableJetee()) }), flux: ['cascade'] },
  de: { patch: { pendingCascade: cascade({ id: 'd', kind: 'triggeredTest', actorId: H.id, de: { spec: { n: 2, sides: 10 }, unite: 'm', result: { roll: 7, total: 7 } } }) }, flux: ['cascade'] },
  bilan: { patch: { pendingCascade: cascade({ id: 'j', kind: 'triggeredTest', actorId: H.id, rollLabel: 'Résistance', target: 45, base: 45, result: jet(30, 45), committed: true }, 1) }, flux: ['cascade'] },
};

function tableJetee(): CascadeStep {
  const tableId = Object.values(CRIT_TABLE_IDS)[0];
  const rangee = tableStepDef(tableId)!.rows[0];
  return { id: 't', kind: 'triggeredTest', actorId: H.id, table: { tableId, spec: { n: 1, sides: 100 }, result: { roll: 5, die: 5, id: rangee.id, lines: [rangee.label ?? rangee.id] } } };
}

/** Le dé d'une ligne est tombé et se lit en entier : d100, cible, DR et verdict ; la ligne tirée d'une table ; le
 *  total d'un dé nu. */
function ligneLue(l: LigneDeJet): boolean {
  if (l.genre === 'test') return !!l.test && l.cible != null && !!l.jet && Number.isFinite(l.jet.d100) && Number.isFinite(l.jet.dr) && typeof l.jet.reussi === 'boolean';
  if (l.genre === 'table') return !!l.table && !!l.jet && Number.isFinite(l.jet.d100) && !!l.jet.ligne;
  return !!l.de && !!l.jet && Number.isFinite(l.jet.total) && !!l.jet.lecture;
}

function verifier(nom: string, f: Fixture): Set<JetEnVue['flux']> {
  const s = { ...BASE, ...(typeof f.patch === 'function' ? f.patch() : f.patch) } as Jeu;
  expect(fenetreDuJeu(s), `${nom} : aucune fenêtre ne tient la main`).not.toBeNull();
  const vues = jetsEnVue(s);
  expect(vues.map((v) => v.flux), `${nom} : les flux rendus`).toEqual(expect.arrayContaining([...f.flux]));
  for (const v of vues) {
    expect(v.lignes.length, `${nom}/${v.flux} : aucune ligne`).toBeGreaterThan(0);
    for (const l of v.lignes) expect(ligneLue(l), `${nom}/${v.flux} : ligne incomplète ${JSON.stringify(l)}`).toBe(true);
  }
  if (f.oppose) {
    const o = vues.find((v) => v.oppose)?.oppose;
    expect(o, `${nom} : le Test opposé ne dit ni la gagnante ni le DR net`).toBeTruthy();
    expect(Number.isFinite(o!.drNet)).toBe(true);
  }
  return new Set(vues.map((v) => v.flux));
}

describe('jetsEnVue — la classe des fenêtres à jet', () => {
  const vus = new Set<JetEnVue['flux']>();
  let partie: ReturnType<typeof creerPartie>;
  beforeAll(() => { partie = creerPartie(BASE as EtatDeJeu, ENTREES); });
  afterAll(() => partie.fermer());

  it('chaque modale du registre qui déclare un flux de jet a sa fixture, et rien d’autre', () => {
    const aJet = (MODAL_DEFS as readonly ModalDef[]).filter((d) => d.flux?.length).map((d) => d.key).sort();
    expect(Object.keys(FENETRES_A_JET).sort()).toEqual(aJet);
    const horsAJet = (HORS_MODAL as readonly HorsModalDef[]).filter((d) => d.flux?.length).map((d) => d.key).sort();
    expect(Object.keys(HORS_REGISTRE_A_JET).sort()).toEqual(horsAJet);
  });

  for (const [nom, f] of Object.entries(FENETRES_A_JET)) {
    it(`modale « ${nom} » : chaque ligne lancée dit son dé`, () => { for (const x of verifier(nom, f!)) vus.add(x); });
  }
  for (const [nom, f] of Object.entries(HORS_REGISTRE_A_JET)) {
    it(`fenêtre « ${nom} » : chaque ligne lancée dit son dé`, () => { for (const x of verifier(nom, f)) vus.add(x); });
  }
  for (const [nom, f] of Object.entries(ETAPES_HOTES)) {
    it(`étape-jet « ${nom} » : chaque ligne lancée dit son dé`, () => { for (const x of verifier(nom, f)) vus.add(x); });
  }
  it('fuite : le coup dans le dos et le Test `fuite`', () => { for (const x of verifier('fuite', FUITE)) vus.add(x); });
  for (const [nom, f] of Object.entries(INTERACTIONS)) {
    it(`cascade « ${nom} » : chaque ligne lancée dit son dé`, () => { for (const x of verifier(nom, f)) vus.add(x); });
  }

  it('chaque flux de jet (`FLOW_VERBS`) est rendu par au moins une fixture', () => {
    const manquants = (Object.keys(FLOW_VERBS) as FlowKey[]).filter((k) => !vus.has(k));
    expect(manquants).toEqual([]);
  });

  it('lot d’étal : chaque dé du lot se lit avec sa valeur', () => {
    const s = { ...BASE, ...(FENETRES_A_JET.etalLot!.patch as Partial<Jeu>) } as Jeu;
    expect(jetsEnVue(s)).toEqual([{ flux: 'etalLot', oppose: null, lignes: [{ genre: 'de', qui: null, de: 'Quantité', jet: { naturel: 4, total: 4, lecture: '4' } }] }]);
  });

  it('un Test opposé dit la ligne gagnante et le DR net — égalité : aucune gagnante', () => {
    const egalite = { ...BASE, pendingGrapple: { actorId: H.id, foeId: E.id, phase: 'options', canBreak: false, atk: tr(25, 40), def: tr(25, 40), result: 'tie' } } as Jeu;
    expect(jetsEnVue(egalite)[0].oppose).toEqual({ gagnante: null, drNet: 0 });
    const attaque = jetsEnVue({ ...BASE, ...ETAPES_HOTES.attack.patch } as Jeu)[0];
    expect(attaque.oppose).toEqual({ gagnante: 0, drNet: 2 });
    expect(attaque.lignes.map((l) => l.qui)).toEqual([H.id, E.id]);
  });

  it('le jet figé d’un Test opposé n’est rendu qu’une fois la réponse jetée', () => {
    const s = { ...BASE, pendingAuContact: { moverId: H.id, foeId: E.id, phase: 'roll', atk: tr(20, 50), def: null, result: null } } as Jeu;
    expect(jetsEnVue(s)[0].lignes).toEqual([{ genre: 'test', qui: H.id, test: 'Corps à corps', cible: null, jet: null }]);
  });
});

describe('jetsEnVue — les deux témoins du dôme, par la surface de la partie', () => {
  const partieSur = (pendingCascade: PendingCascade) => creerPartie({ ...(BASE as EtatDeJeu), pendingCascade }, ENTREES);

  it('« Résistance au Sonné » : après `cascadeRoll` puis `cascadeSetForcedRoll(pid, 30)`, la ligne dit Test, cible, dé, DR et verdict', () => {
    const partie = partieSur(cascade({ id: 'sonne', kind: 'triggeredTest', actorId: H.id, rollLabel: 'Résistance', target: 45, base: 45, result: null }));
    try {
      partie.envoyer({ type: 'cascadeRoll', args: ['sonne'] });
      partie.envoyer({ type: 'cascadeSetForcedRoll', args: ['sonne', 30] });
      const { sl } = evaluateTest(30, 45);
      expect(jetsEnVue(partie.etat())).toEqual([{ flux: 'cascade', oppose: null, lignes: [{ genre: 'test', qui: H.id, test: 'Résistance', cible: 45, jet: { d100: 30, dr: sl, reussi: true } }] }]);
    } finally {
      partie.fermer();
    }
  });

  it('table : après `cascadeTableRoll`, la ligne dit la table, le dé et la ligne tirée', () => {
    const tableId = Object.values(CRIT_TABLE_IDS)[0];
    const partie = partieSur(cascade({ id: 't', kind: 'triggeredTest', actorId: H.id, table: { tableId, spec: { n: 1, sides: 100 } } }));
    try {
      expect(jetsEnVue(partie.etat())[0].lignes[0], 'avant le tirage : la table, à lancer').toMatchObject({ genre: 'table', jet: null });
      partie.envoyer({ type: 'cascadeTableRoll', args: ['t'] });
      const r = partie.etat().pendingCascade!.participants[0].table!.result!;
      expect(jetsEnVue(partie.etat())[0].lignes).toEqual([{ genre: 'table', qui: H.id, table: tableStepDef(tableId)!.label, jet: { d100: r.roll, effectif: r.die, ligne: r.lines[0] } }]);
    } finally {
      partie.fermer();
    }
  });
});
