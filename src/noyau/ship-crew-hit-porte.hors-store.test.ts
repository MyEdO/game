import { describe, it, expect, beforeEach } from 'vitest';
import { fixtureText } from '../i18n/fixtureText';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applierDe } from './cascade';
import { seedBattleRng } from './battleRng';
import { runSeaDay, buildSeaPlan } from './seaVoyageFlow';
import { applyCriticalToTarget } from './combatFlow';
import { makePregens } from '../data/pregens';
import { emptyScene } from './monde/scene';
import { resolveStake, voyageStakeRef } from '../data';
import { monoStep } from './rollSeam';
import { type BuiltCascadeStep } from './stepBrand';
import { bandeTriggeredTest } from './combat/triggeredTest';
import { rollShipCritical, applyCrewHit } from '../engine/shipCritical';
import { RIVER_CRIT_SET, SHIP_CRIT_SET } from '../data/shipCriticals';
import { makeRNG } from '../engine/dice';
import { stacks } from '../engine/conditions';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';
import type { WorldMap } from './worldMap';
import { desDuTest } from '../engine/dice.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #1657 B3-2 — LE COUP À L'ÉQUIPAGE D'UN CRITIQUE DE COQUE PASSE PAR LA PORTE.
 *
 * Doctrine des jets (utilisateur 2026-08-24, `user-doctrine-forme-canonique-unique-jets`) : « A partir
 * du moment ou je dois faire un jet, il doit apparaitre. Y'a pas de "classe spéciale" si je suis a
 * l'initiative, que je le subit, face a un adversaire ou face a ... une maladie ».
 *
 * Le Test que la rangée exige (MSRC 07 l.78 « Toute personne présente sur le pont doit faire un Test
 * d'Initiative ou subir +5 Dégâts, et gagner un État *Empêtré* » ; MDG 13 l.763) était joué DANS
 * `applyCrewHit`, avec le RNG du combat, marin par marin. Il naît désormais comme UNE BANDE — une
 * fenêtre, une rangée par siège — et c'est le socle qui décide de la surface.
 */
const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

const seaMap: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b' },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

/** Trois PJ à bord, tenus par le siège local (cadence manuelle) — la condition de surfaçage — et
 *  ÉPINGLÉS sur le PONT : `greement-fluvial` vise la station (MSRC 07 l.78), pas « tout le monde ». */
function equipage(): Combatant[] {
  return makePregens().slice(0, 3).map((h) => ({ ...h, shipStation: 'pont' }));
}

function baseState(party: Combatant[]): void {
  banc.setState({
    party,
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, worldMap: seaMap, travelRecap: null, pendingRest: null,
    pendingCascade: null, suspendedCascades: [], pendingLogQueue: [], journal: [],
    gameTime: 8 * 60, lastUpkeepDay: 0,
    net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
}

/** Voyage FLUVIAL minimal : une barge, l'équipage à bord, le vent posé. */
function fleuve(party: Combatant[]): void {
  baseState(party);
  const coque = vehicleCombatant(findVehicleById('barge')!)!;
  set({
    travelPlan: {
      routeId: 'r1', km: 45, mode: 'barge', vehicle: coque,
      river: { windForce: 'modere', windDir: 'cote', daysAfloat: 1 },
    },
  } as never);
}

/** L'étape de BANDE que l'applier `riverRigging` insère (le coup à l'équipage). */
const bandeDe = (steps: readonly BuiltCascadeStep[] | undefined): BuiltCascadeStep | undefined =>
  steps?.find((s) => s.kind === 'triggeredBatchTest');

/** Joue l'applier RÉEL du gréement en péril (note 5, l.41) sur un Test RATÉ — c'est lui qui déclenche
 *  le Coup Critique au gréement, donc le coup à l'équipage de la rangée `greement-fluvial`. L'étape
 *  qui le porte est MINTÉE par la porte (`monoStep`), jamais un littéral blanchi par un cast. */
function greementEnPeril(): readonly BuiltCascadeStep[] | undefined {
  const barreur = get().party[0];
  const minte = monoStep({
    id: 'river-rigging', kind: 'riverRigging', actor: barreur, label: fixtureText('Gréement'),
    difficulty: 'accessible', ligne: { test: { skill: 'voile' } },
    stake: voyageStakeRef('riverRigging', { outOfControlPenalty: -20 }),
  })!;
  const step = { ...minte, result: { roll: 95, target: minte.target!, success: false, sl: -5, crit: false, fumble: false } };
  return applierDe('riverRigging')!(get, set, step, barreur, { steps: [step], index: 0 })?.insert;
}

describe('#1657 B3-2 — le coup à l’équipage naît comme UNE BANDE, une rangée par siège', () => {
  beforeEach(() => seedBattleRng(1));

  it('(i) 3 personnes TENUES sur le pont → UNE bande de 3 rangées, possédée par le groupe, enjeu à SA rangée', () => {
    const party = equipage();
    fleuve(party);

    const bande = bandeDe(greementEnPeril());
    expect(bande, 'aucune bande : le jet d’Initiative de la rangée est resté silencieux').toBeTruthy();
    expect(bande!.participants!.map((p) => p.id), 'une rangée par personne exposée sur le pont (MSRC 07 l.78)')
      .toEqual(party.map((h) => h.id));
    expect(bande!.groupOwner, 'plusieurs sièges concernés : la bande appartient au groupe').toBe(true);
    for (const row of bande!.participants!) {
      expect(row.interactive, `${row.id} : rangée non influençable`).toBe(true);
      expect(row.result, `${row.id} : un dé est déjà tombé`).toBeFalsy();
      expect(row.target, `${row.id} : cible non calculée par le monteur canonique`).toBeGreaterThan(0);
    }
    // L'enjeu descend à la RANGÉE tirée, dans la catégorie Codex de la Localisation touchée.
    expect(resolveStake(bande!.stake!).rule).toEqual({ category: 'riverCriticalsGreement', id: 'greement-fluvial' });
    // Personne n'a encore rien encaissé : l'issue n'est pas tranchée avant le jet.
    for (const h of get().party) expect(stacks(h, 'empetre'), `${h.id}`).toBe(0);
  });

  it('(ii) la branche `fail` s’applique PAR RANGÉE, sur des résultats INJECTÉS (jamais tirés au moteur)', () => {
    const party = equipage();
    fleuve(party);
    const bande = bandeDe(greementEnPeril())!;
    const [rate, reussi, rate2] = bande.participants!;
    const pvAvant = new Map(get().party.map((h) => [h.id, h.wounds.current]));

    const avecResultats: CascadeStep = {
      ...bande,
      participants: bande.participants!.map((p) => ({
        ...p,
        result: p.id === reussi.id
          ? { roll: 5, target: p.target!, success: true, sl: 3, crit: false, fumble: false }
          : { roll: 98, target: p.target!, success: false, sl: -5, crit: false, fumble: false },
      })),
    };
    applierDe('triggeredBatchTest')!(get, set, avecResultats, undefined, { steps: [avecResultats], index: 0 });

    const de = (id: string) => get().party.find((h) => h.id === id)!;
    for (const id of [rate.id, rate2.id]) {
      // MSRC 07 l.78 : « subir +5 Dégâts, et gagner un État *Empêtré* » — les 5 Dégâts sont mitigés
      // (`ignoreTB:false` en donnée), donc c'est l'État qui marque l'échec sur un porteur à BE ≥ 5.
      expect(stacks(de(id), 'empetre'), `${id} : la branche fail n’a pas joué`).toBe(1);
      expect(de(id).wounds.current, `${id} : les Dégâts ont échappé à la mitigation`).toBeLessThanOrEqual(pvAvant.get(id)!);
    }
    expect(stacks(de(reussi.id), 'empetre'), 'la rangée RÉUSSIE a encaissé quand même').toBe(0);
    expect(de(reussi.id).wounds.current).toBe(pvAvant.get(reussi.id));
  });

  it('(iii) aucune fenêtre FANTÔME : une rangée sans coup à l’équipage n’insère aucune bande', () => {
    // « Coque » (MSRC 07 l.90) ne touche personne : le bateau prend l'eau, la rangée ne porte pas de
    // `crewHit`. La porte ne doit pas ouvrir de fenêtre sur zéro jet.
    const party = equipage();
    fleuve(party);
    const inserees = greementEnPeril()!;
    // Contrôle POSITIF de la sonde : la rangée du GRÉEMENT porte bien un coup, donc UNE bande…
    expect(inserees.filter((s) => s.kind === 'triggeredBatchTest')).toHaveLength(1);
    // …et aucune AUTRE fenêtre n'est ouverte au passage (la Coque percée n'appelle personne).
    expect(inserees.filter((s) => s.kind === 'triggeredBatchTest' || s.kind === 'triggeredTest')).toHaveLength(1);
  });
});

describe('#1657 B3-2 — COMBAT NAVAL : le coup à l’équipage part par la porte depuis la coque touchée', () => {
  it('« Canon détaché » encaissé par une coque en combat → bande poussée dans la cascade, enjeu à SA rangée', () => {
    let bande: CascadeStep | undefined;
    // La Localisation de coque est TIRÉE par `shipHitLocation` (MDG 13) : on balaie les seeds jusqu'aux
    // Équipements, seule table navale à porter un coup à l'équipage.
    for (let seed = 1; seed <= 200 && !bande; seed++) {
      seedBattleRng(seed);
      const party = equipage();
      baseState(party);
      const coque = vehicleCombatant(findVehicleById('cogue')!)!;
      coque.crewIds = [party[0].id];
      (coque as unknown as { postes: unknown[] }).postes = [{ item: { uid: 'p1', name: 'Canon' }, side: 'tribord', crewIds: [party[0].id] }];
      banc.setState({ battle: { combatants: [coque, ...party], order: [], log: [], over: null } } as never);
      applyCriticalToTarget(coque, 'corps', 0, [], set, { get });
      bande = get().pendingCascade?.participants.find((s) => s.kind === 'triggeredBatchTest');
    }
    expect(bande, 'aucune fenêtre en 200 seeds : le coup à l’équipage reste roulé en silence').toBeTruthy();
    expect(resolveStake(bande!.stake!).rule).toEqual({ category: 'shipCriticalsEquipements', id: 'canon-detache' });
  });
});

describe('#1657 B3-2 — voyage MARITIME : le coup à l’équipage s’applique enfin (avant : jamais)', () => {
  /** Le servant du canon, tenu par le siège local — MDG 13 l.763 « L'équipage du canon doit réussir
   *  un Test d'Athlétisme Intermédiaire (+0) sous peine de subir un coup infligeant 12 Dégâts ». */
  function mer(party: Combatant[]): void {
    baseState(party);
    set({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    // Un navire ARMÉ : `vehicleCombatant` ne pose aucun poste (les postes viennent de la scène de
    // combat, `combatSlice.ts`) — sans poste, « Canon détaché » ne désigne personne (dit au rendu).
    (plan.vehicle as unknown as { postes: unknown[] }).postes = [{ item: { uid: 'p1', name: 'Canon' }, side: 'tribord', crewIds: [party[0].id] }];
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'bateau-endommage' } } } as never);
  }

  it('« Canon détaché » (MDG 13 l.763) : une fenêtre s’ouvre pour le servant — le nœud n’est plus perdu', () => {
    let bande: CascadeStep | undefined;
    // La Localisation du Critique d'événement est TIRÉE (l'événement dit « une localisation
    // aléatoire ») : on balaie les seeds jusqu'aux Équipements, seule table navale à porter un coup.
    // Depuis B3-2b-a, PLUSIEURS rangées navales portent un coup à l'équipage : on ne retient que la
    // fenêtre de `canon-detache`, sinon le balayage rendrait la première rangée venue.
    for (let seed = 1; seed <= 80 && !bande; seed++) {
      seedBattleRng(seed);
      const party = equipage();
      mer(party);
      runSeaDay(get, set);
      const trouvee = get().pendingCascade?.participants.find((s) => s.kind === 'triggeredBatchTest');
      if (trouvee && resolveStake(trouvee.stake!).rule?.id === 'canon-detache') bande = trouvee;
    }
    expect(bande, 'aucune fenêtre en 80 seeds : le coup à l’équipage reste perdu en mer').toBeTruthy();
    expect(bande!.participants!.map((p) => p.id)).toEqual([get().party[0].id]);
    expect(resolveStake(bande!.stake!).rule).toEqual({ category: 'shipCriticalsEquipements', id: 'canon-detache' });
  });
});

/**
 * SÉPARATION bande / inline, et JOURNALISATION du porteur sans siège — le socle décide seul de la
 * surface (`surfaceOf`), et la voie inline n'est pas un silence : elle PORTE le jet au journal.
 */
describe('#1657 B3-2 — la porte SÉPARE : bande pour les sièges, inline JOURNALISÉ pour le reste', () => {
  /** Un marin PNJ : aucun siège ne le tient (il n'est pas du groupe) → voie inline. */
  const marin = (): Combatant => ({
    id: 'marin', name: 'Marin', label: 'Marin', kind: 'npc',
    characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 31, agilite: 31, dexterite: 31, intelligence: 31, 'force-mentale': 31, sociabilite: 31 },
    skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    wounds: { current: 13, max: 13 }, advantage: 0, movement: 4, bodyShape: 'humanoide',
  }) as unknown as Combatant;

  /** Le nœud RÉEL de `greement-fluvial` (`crewTarget:{stations:['pont']}`), enjeu posé par le producteur. */
  const noeudGreement = () => rollShipCritical('greement', makeRNG(1), 1, RIVER_CRIT_SET).crewHit!.test!;

  it('2 porteurs TENUS + 1 PNJ : DEUX rangées en bande, le PNJ résolu inline et DIT au journal', () => {
    seedBattleRng(1);
    const party = makePregens().slice(0, 2);
    baseState(party);
    const pnj = marin();

    const bande = bandeTriggeredTest(get, set, [...party, pnj], noeudGreement(), 'sonde-separation', { rng: desDuTest, label: 'Gréement' });
    expect(bande, 'aucune bande pour les porteurs tenus').toBeTruthy();
    expect(bande!.kind).toBe('triggeredBatchTest');
    expect(bande!.groupOwner, 'deux sièges concernés → possession de GROUPE').toBe(true);
    expect(bande!.participants!.map((p) => p.id), 'le PNJ ne prend PAS de rangée').toEqual(party.map((h) => h.id));

    // Le PNJ n'a AUCUNE rangée nulle part : le journal est sa seule surface, il PORTE le jet.
    expect(get().pendingLogQueue.map((l) => l.line)).toEqual([
      'Marin — Test d’Initiative Intermédiaire (+0) : 63/31 → échec (DR -3).',
      'Marin subit 2 Blessure(s) (PA, BE déduit).',
      'Marin reçoit 1 État Empêtré.',
    ]);
  });

  it('`crewTarget:{poste:true}` (MDG 13 l.763) : la victime est le SERVANT tiré au sort — 30 seeds, deux postes', () => {
    const party = makePregens().slice(0, 1);
    const equipage = [party[0], marin()];
    const coque = { id: 'hull', postes: [
      { item: { uid: 'p1', name: 'Canon' }, side: 'tribord', crewIds: ['marin'] },
      { item: { uid: 'p2', name: 'Pierrier' }, side: 'babord', crewIds: [party[0].id] },
    ] } as unknown as Combatant;
    const canon = rollShipCritical('equipements', makeRNG(1), 3, SHIP_CRIT_SET).crewHit!;
    const compte: Record<string, number> = {};
    for (let seed = 1; seed <= 30; seed++) {
      for (const id of applyCrewHit(coque, equipage, canon, makeRNG(seed)).victims) compte[id] = (compte[id] ?? 0) + 1;
    }
    expect(compte, 'le tirage du poste doit rester DÉTERMINISTE par seed et couvrir les deux postes')
      .toEqual({ [party[0].id]: 16, marin: 14 });

    // Sans poste, « Canon détaché » ne désigne personne : aucune fenêtre fantôme.
    expect(applyCrewHit({ id: 'hull' } as unknown as Combatant, equipage, canon, makeRNG(1)).victims).toEqual([]);
  });
});
