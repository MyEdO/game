import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { buildSeaPlan, portRepairVessel } from './seaVoyageFlow';
import { ouvrirLeTestDEquipage } from './navireOps';
import { maneuverShip } from './shipManeuver';
import { EMPTY_FLOW } from '../engine/flowCore';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { buildRiverPlan, buildRiverDayCascade } from './riverVoyageFlow';
import { applierDe, poserLeDeDEtape } from './cascade';
import { seedBattleRng } from './battleRng';
import { creditBourse } from './bourseFlow';
import { createHero, skillCharacteristicById } from '../engine/character';
import { effectiveChar } from '../engine/characteristics';
import { testValue } from '../engine/skills';
import { setRule, resetRule, rule } from '../engine/policy';
import { emptyScene } from './monde/scene';
import { fixtureText } from '../i18n/fixtureText';
import { t } from '../i18n';
import { resultLine } from './rollSeam';
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, type Combatant, type Difficulty, type SkillInstance } from '../engine/types';
import type { CascadeStep } from './pendings';
import type { BuiltCascadeStep } from './stepBrand';
import type { GenreDeCascade } from './tablesPosees';
import type { MapRoute, WorldMap } from './worldMap';
import type { Flow } from '../data/schemas/defs-scenes/effets';

/** La réparation temporaire d'un navire et son Test d'Endurance de suivi. MDG 13 l.649-651 ; MSRC 7 l.115-117 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

const etapeJouee = (kind: GenreDeCascade, extra: Partial<Pick<CascadeStep, 'actorId' | 'result' | 'chosen' | 'meta'>> = {}): CascadeStep =>
  ({ id: String(kind), kind, label: fixtureText(String(kind)), result: { roll: 50, target: 40, sl: 1, success: true }, ...extra });

/** Le Reik de Grünburg à Altdorf, route fluviale des descentes. */
const routeDuReik: MapRoute = { id: 'r-reik', a: { id: 'A' }, b: { id: 'B' }, km: 45, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0 };
const carteDuReik: WorldMap = { id: 'm', label: 'Le Reik', places: [{ id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: { id: 'quai-a' } }, { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: { id: 'quai-b' } }], routes: [routeDuReik] };

const appliquer = (st: CascadeStep, hero?: Combatant) => applierDe(st.kind)!(get, set, st, hero, { steps: [], index: 0 });

/** L'étape bâtie, jouée sur le dé `roll` (échec au-delà de la cible). */
const jouerSur = (st: CascadeStep, roll: number): CascadeStep =>
  ({ ...st, result: { roll, target: st.target!, sl: 0, success: roll <= st.target! } });

/** Le Test d'Endurance `st` joué sur `roll` ; son échec ouvre le dé des Dégâts, posé à `face` par la couture du
 *  « Fixer le dé » puis appliqué. Rend la ligne de conséquence des deux étapes. */
function jouerLeTest(st: CascadeStep, roll: number, face?: number): string {
  const issue = appliquer(jouerSur(st, roll));
  const lignes = [resultLine(issue?.consequences ?? [])];
  const de = issue?.insert?.find((x) => x.kind === 'reparation-temporaire-degats');
  if (face !== undefined) {
    const pose = poserLeDeDEtape(get(), get, de!, face)!;
    lignes.push(resultLine(appliquer(pose)?.consequences ?? []));
  }
  return lignes.join(' ');
}

describe('mer — réparation temporaire de l’Entretien du soir (MDG 13 l.651, MDG 14 l.120)', () => {
  const seaMap: WorldMap = {
    id: 'm', label: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: { id: 'port-b' } },
    ],
    routes: [{ id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
  };

  beforeEach(() => {
    seedBattleRng(1);
    set({
      party: tousLesHerosDeScenario(idsDeTest).slice(0, 3),
      scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null, worldMap: seaMap, lieu: 'A', travelPlan: null, travelRecap: null, pendingRest: null, pendingCascade: null,
      suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0, journal: [],
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, wounds: { current: 30, max: 50 } },
    } as never);
  });
  afterEach(() => { resetRule('mer-reparation-temporaire-difficulte'); resetRule('mer-reparation-temporaire-reparation-difficulte'); });

  const prendreLaMer = () => set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])! });
  /** Le reste de la journée que la Progression insère. */
  const journee = (): readonly BuiltCascadeStep[] => appliquer(etapeJouee('equipage-progression', { result: { roll: 10, target: 60, sl: 2, success: true } }))?.insert ?? [];
  const testsDeReparation = (steps: readonly BuiltCascadeStep[]) => steps.filter((s) => s.kind === 'mer-reparation-temporaire');
  const reparerAuSoir = () => appliquer(etapeJouee('equipage-entretien', { result: { roll: 10, target: 60, sl: 5, success: true } }));

  it('sans réparation temporaire, la journée ne joue aucun Test d’Endurance du navire', () => {
    prendreLaMer();
    expect(testsDeReparation(journee())).toEqual([]);
  });

  it('l’Entretien réussi restaure 1d10 Blessures puis, chaque jour suivant, le navire teste son Endurance (défaut maison Accessible)', () => {
    prendreLaMer();
    reparerAuSoir();
    expect(get().vessel!.wounds!.current).toBeGreaterThan(30);
    const [st, ...autres] = testsDeReparation(journee());
    expect(autres).toEqual([]);
    expect(st.worldOwner).toBe(true);
    expect(st.difficulty).toBe(rule('mer-reparation-temporaire-difficulte'));
    expect(st.base).toBe(effectiveChar(get().travelPlan!.vehicle!, 'endurance'));
    setRule('mer-reparation-temporaire-difficulte', 'difficile');
    expect(testsDeReparation(journee())[0].difficulty).toBe('difficile');
  });

  it('l’Entretien du soir, qui remplace le Test de réparation temporaire, se joue à sa Difficulté (MDG 13 l.649, MDG 14 l.120)', () => {
    prendreLaMer();
    const drDeLEntretien = () => Number(journee().find((s) => s.kind === 'equipage-entretien')!.meta?.aggregateFlatDR ?? 0);
    const parDefaut = drDeLEntretien();
    const defaut = rule('mer-reparation-temporaire-reparation-difficulte') as Difficulty;
    setRule('mer-reparation-temporaire-reparation-difficulte', 'tresDifficile');
    expect(drDeLEntretien() - parDefaut).toBe((DIFFICULTY_MODIFIERS.tresDifficile - DIFFICULTY_MODIFIERS[defaut]) / 10);
    expect(DIFFICULTY_MODIFIERS[defaut], 'le défaut est dans la fourchette Complexe à Très Difficile').toBeLessThanOrEqual(DIFFICULTY_MODIFIERS.complexe);
  });

  it('un échec inflige 1d10−4 Dégâts à la coque, planchés à 0 ; une réussite n’en inflige aucun', () => {
    prendreLaMer();
    reparerAuSoir();
    const st = testsDeReparation(journee())[0];
    const coque = () => get().vessel!.wounds!.current;
    const avant = coque();
    expect(appliquer(jouerSur(st, 1))?.insert).toBeUndefined();
    expect(coque()).toBe(avant);
    expect(jouerLeTest(st, 99, 9)).toContain(t('sv.reparationTemporaireCoque', { n: 5 }));
    expect(coque()).toBe(avant - 5);
    expect(jouerLeTest(st, 99, 2)).toContain(t('sv.reparationTemporaireCoque', { n: 0 }));
    expect(coque()).toBe(avant - 5);
  });

  it('un Test de Manœuvre du navire réparé (Évasion du Tourbillon) est suivi du Test d’Endurance', () => {
    prendreLaMer();
    reparerAuSoir();
    const plan = get().travelPlan!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, crisis: { kind: 'tourbillon', whirlpoolId: 'maelstrom', need: 999, progress: 0, label: 'Maelström' } } } });
    const steps = journee();
    const i = steps.findIndex((s) => s.kind === 'equipage-tourbillon');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(steps[i + 1]?.kind).toBe('mer-reparation-temporaire');
  });

  it('la réparation au port lève la réparation temporaire : plus aucun Test', () => {
    prendreLaMer();
    reparerAuSoir();
    expect(testsDeReparation(journee())).toHaveLength(1);
    set({ travelPlan: null });
    creditBourse(get, set, get().party[0].id, { gold: 50, silver: 0, brass: 0 });
    portRepairVessel(get, set);
    prendreLaMer();
    expect(testsDeReparation(journee())).toEqual([]);
  });

  it('une coque que l’Entretien a remplie se répare encore au port, à 0 CO, et le Test cesse (MDG 13 l.643)', () => {
    set({ vessel: { ...get().vessel!, wounds: { current: 49, max: 50 } } });
    prendreLaMer();
    reparerAuSoir();
    expect(get().vessel!.wounds).toEqual({ current: 50, max: 50 });
    set({ travelPlan: null });
    const lignes = portRepairVessel(get, set);
    expect(lignes).toHaveLength(1);
    expect(get().vessel!.reparationTemporaire).toBeUndefined();
    prendreLaMer();
    expect(testsDeReparation(journee())).toEqual([]);
  });

  it('le Test de Manœuvre d’un nœud de Flow est suivi du Test d’Endurance', () => {
    prendreLaMer();
    reparerAuSoir();
    const noeud = {
      kind: 'test', reussite: EMPTY_FLOW, echec: EMPTY_FLOW,
      test: { crewTestType: 'manoeuvre', difficulty: 'difficile', stake: { key: { dataset: 'voyage', kind: 'equipage-affaler-ouragan', entryId: 'ouragan', entryCategory: 'seaBoardEvents' } } },
    } as unknown as Extract<Flow, { kind: 'test' }>;
    expect(ouvrirLeTestDEquipage(get, set, noeud, EMPTY_FLOW, 'Manœuvre')).toBe(true);
    expect(get().pendingCascade!.participants.map((s) => s.kind)).toEqual(['testDEquipage', 'mer-reparation-temporaire']);
  });
});

describe('combat naval — la Manœuvre du navire réparé est suivie du Test d’Endurance (MDG 13 l.651)', () => {
  const helm = (): Combatant =>
    combattantDeTest({ id: 'helm', label: 'Timonier', kind: 'heros',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: blessuresDeBase(10), advantage: 0, conditions: [], fortune: 2, resilience: 1,
      skills: [{ id: 'voile', spec: 'chaland', characteristic: 'agilite', advances: 40 }], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } });
  const ship = (): Combatant =>
    combattantDeTest({ id: 'ship', label: 'Barge', kind: 'pnj', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', crewIds: ['helm'], pos: { x: 5, y: 5 }, conditions: [], weapons: [], wounds: blessuresDeBase(40, 30) });
  const coqueDuCombat = () => get().battle!.combatants.find((c) => c.id === 'ship')!;

  afterEach(() => { resetRule('fleuve-reparation-temporaire-navigation'); resetRule('mer-reparation-temporaire-difficulte'); });

  /** Le combat du navire de campagne, réparé ou non, en mer ou, `fluvial`, pendant une descente du Reik. */
  function poser(reparationTemporaire: boolean, fluvial = false): void {
    seedBattleRng(7);
    set({
      battle: { combatants: [ship(), helm()], order: ['helm'], turn: 0, acted: false } as never, party: [helm()], facing: { ship: 'N' },
      pendingShipManeuver: null, pendingCascade: null, suspendedCascades: [], scene: null as never, travelPlan: null, worldMap: carteDuReik,
      vessel: { vehicleId: 'bateau-de-patrouille', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, wounds: { current: 30, max: 40 }, ...(reparationTemporaire ? { reparationTemporaire: true } : {}) },
    } as never);
    if (fluvial) set({ travelPlan: buildRiverPlan(get, 'r-reik', 'A', 'B', routeDuReik)! });
  }
  /** La Manœuvre jouée par la modale du joueur. */
  function manoeuvrer(reparationTemporaire: boolean, fluvial = false): void {
    poser(reparationTemporaire, fluvial);
    get().manoeuvrerLeNavire('helm');
    get().jetLancer('manoeuvreDuNavire', 'helm');
    get().jetValider('manoeuvreDuNavire');
  }
  const testsJoues = () => (get().pendingCascade?.participants ?? [])
    .filter((s) => s.kind === 'mer-reparation-temporaire' || s.kind === 'fleuve-reparation-temporaire').map((s) => `${s.kind}:${s.difficulty}`);
  const testsDeReparation = () => (get().pendingCascade?.participants ?? []).filter((s) => s.kind === 'mer-reparation-temporaire');

  it('sans réparation temporaire, aucun Test', () => {
    manoeuvrer(false);
    expect(testsDeReparation()).toEqual([]);
  });

  it('le Test se joue sur la coque du combat, et ses Dégâts la frappent', () => {
    manoeuvrer(true);
    const [st, ...autres] = testsDeReparation();
    expect(autres).toEqual([]);
    expect(st.meta?.hullId).toBe('ship');
    const avant = coqueDuCombat().wounds.current;
    expect(jouerLeTest(st, 99, 10)).toContain(t('sv.reparationTemporaireCoque', { n: 6 }));
    expect(coqueDuCombat().wounds.current).toBe(avant - 6);
  });

  it('la Manœuvre de l’IA et de l’Auto-combat (maneuverShip) est suivie du Test ; sans réparation, aucun', () => {
    poser(true);
    expect(maneuverShip(get, set, 'ship', 0)).not.toBeNull();
    expect(testsJoues()).toEqual([`mer-reparation-temporaire:${rule('mer-reparation-temporaire-difficulte')}`]);
    poser(false);
    expect(maneuverShip(get, set, 'ship', 0)).not.toBeNull();
    expect(testsJoues()).toEqual([]);
  });

  it('pendant une descente du fleuve, le Test est celui du fleuve (Accessible) ; règle maison de Navigation désactivée : aucun (MSRC 7 l.117)', () => {
    setRule('mer-reparation-temporaire-difficulte', 'difficile');
    manoeuvrer(true, true);
    expect(testsJoues()).toEqual(['fleuve-reparation-temporaire:accessible']);
    setRule('fleuve-reparation-temporaire-navigation', false);
    manoeuvrer(true, true);
    expect(testsJoues()).toEqual([]);
  });
});

describe('fleuve — réparation temporaire d’une coque percée (MSRC 7 l.115-117)', () => {
  function batelier(): Combatant {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Gunnar', motivation: 'x', seed: 11, id: 'r-gunnar' });
    for (const [id, advances, spec] of [['ramer', 50], ['voile', 45, 'chaland'], ['metier', 40, 'construction-de-bateaux']] as const) {
      h.skills.push({ id, spec, characteristic: skillCharacteristicById(id), advances } as SkillInstance);
    }
    return h;
  }
  const route = routeDuReik;

  beforeEach(() => {
    seedBattleRng(7);
    set({
      party: [batelier()], battle: null, lieu: 'A', travelRecap: null, pendingRest: null, pendingCascade: null, suspendedCascades: [], journal: [],
      worldMap: carteDuReik,
      vessel: null,
    } as never);
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', route)!;
    plan.vehicle!.wounds.current = 30;
    set({ travelPlan: { ...plan, river: { ...plan.river!, holed: true } } });
  });
  afterEach(() => { resetRule('fleuve-reparation-temporaire-navigation'); resetRule('fleuve-reparation-temporaire-degats'); resetRule('fleuve-reparation-temporaire-reparation-difficulte'); });

  const testsDeReparation = (steps: readonly BuiltCascadeStep[]) => steps.filter((s) => s.kind === 'fleuve-reparation-temporaire');
  const journee = () => buildRiverDayCascade(get, set, route).steps;
  const colmater = () => appliquer(etapeJouee('fleuveReparationDeBreche', { actorId: 'r-gunnar' }), get().party[0]);
  const naviguer = () => appliquer(etapeJouee('fleuveNavigation', { actorId: 'r-gunnar' }), get().party[0])?.insert ?? [];

  it('sans réparation temporaire, ni le jour ni la Navigation ne jouent de Test d’Endurance', () => {
    expect(testsDeReparation(journee())).toEqual([]);
    expect(testsDeReparation(naviguer())).toEqual([]);
  });

  it('le calfatage réussi impose, chaque jour de voyage, un Test d’Endurance Accessible (+20) du bateau', () => {
    colmater();
    const [st, ...autres] = testsDeReparation(journee());
    expect(autres).toEqual([]);
    expect(st.worldOwner).toBe(true);
    expect(st.difficulty).toBe('accessible');
    expect(st.base).toBe(effectiveChar(get().travelPlan!.vehicle!, 'endurance'));
  });

  it('un échec inflige 1d10−4 Dégâts à la coque, planchés à 0, sans relancer de Test sur ses propres Dégâts', () => {
    colmater();
    const st = testsDeReparation(journee())[0];
    const coque = () => get().travelPlan!.vehicle!.wounds.current;
    const avant = coque();
    const issue = appliquer(jouerSur(st, 99));
    const de = issue!.insert!.find((x) => x.kind === 'reparation-temporaire-degats')!;
    expect(testsDeReparation(issue!.insert!)).toEqual([]);
    const degats = appliquer(poserLeDeDEtape(get(), get, de, 10)!);
    expect(coque()).toBe(avant - 6);
    expect(testsDeReparation(degats?.insert ?? [])).toEqual([]);
    expect(jouerLeTest(st, 99, 4)).toContain(t('sv.reparationTemporaireCoque', { n: 0 }));
    expect(coque()).toBe(avant - 6);
  });

  it('règle maison active (défaut) : le Test de Navigation du barreur est suivi du Test d’Endurance ; désactivée : non', () => {
    colmater();
    expect(testsDeReparation(naviguer())).toHaveLength(1);
    setRule('fleuve-reparation-temporaire-navigation', false);
    expect(testsDeReparation(naviguer())).toEqual([]);
  });

  it('règle maison active (défaut) : une étape qui inflige des Dégâts à la coque est suivie du Test ; désactivée : non', () => {
    colmater();
    const heurter = () => appliquer(etapeJouee('fleuveChoixDObstacle', { result: null, chosen: 'forcer', meta: { perilId: 'barrage' } }));
    const coque = () => get().travelPlan!.vehicle!.wounds.current;
    let avant = coque();
    const issue = heurter();
    expect(coque()).toBeLessThan(avant);
    expect(testsDeReparation(issue?.insert ?? [])).toHaveLength(1);
    setRule('fleuve-reparation-temporaire-degats', false);
    avant = coque();
    const sans = heurter();
    expect(coque()).toBeLessThan(avant);
    expect(testsDeReparation(sans?.insert ?? [])).toEqual([]);
  });

  it('une étape qui heurte la coque puis la calfate d’office ne joue pas le Test : la réparation ne tenait pas avant', () => {
    set({ party: [{ ...get().party[0], aiControlled: true }] });
    seedBattleRng(8);
    const issue = appliquer(etapeJouee('fleuveDetectionDePeril', { result: { roll: 99, target: 40, sl: -5, success: false }, meta: { perilId: 'rochers' } }));
    expect(get().travelPlan!.river!.reparationTemporaire).toBe(true);
    expect(get().travelPlan!.vehicle!.wounds.current).toBeLessThan(30);
    expect(testsDeReparation(issue?.insert ?? [])).toEqual([]);
  });

  it('le calfatage d’une coque percée se joue à la Difficulté de la règle maison, surfacé comme en ligne (MSRC 7 l.115)', () => {
    setRule('fleuve-reparation-temporaire-reparation-difficulte', 'tresDifficile');
    const percer = () => { seedBattleRng(8); set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, holed: false } } }); return appliquer(etapeJouee('fleuveDetectionDePeril', { result: { roll: 99, target: 40, sl: -5, success: false }, meta: { perilId: 'rochers' } })); };
    const breche = percer()?.insert?.find((s) => s.kind === 'fleuveReparationDeBreche');
    expect(breche?.difficulty).toBe('tresDifficile');
    set({ party: [{ ...get().party[0], aiControlled: true }] });
    expect(resultLine(percer()?.consequences ?? [])).toContain(`(Métier ${DIFFICULTY_LABELS.tresDifficile})`);
  });

  it('sur le navire de campagne, le marqueur vit au navire : une nouvelle descente joue encore le Test', () => {
    set({ vessel: { vehicleId: 'barge', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, wounds: { current: 10, max: 30 } } } as never);
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', route)!;
    set({ travelPlan: { ...plan, river: { ...plan.river!, holed: true } } });
    colmater();
    expect(get().vessel!.reparationTemporaire).toBe(true);
    expect(get().travelPlan!.river!.reparationTemporaire).toBeUndefined();
    set({ travelPlan: null });
    set({ travelPlan: buildRiverPlan(get, 'r-reik', 'A', 'B', route)! });
    expect(testsDeReparation(journee())).toHaveLength(1);
  });
});

describe('fleuve — le Test de réparation temporaire du gréement (MSRC 7 l.115)', () => {
  /** Un batelier dont le seul Métier de réparation est `spec`. */
  function reparateur(id: string, seed: number, spec: string, advances: number): Combatant {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'batelier', label: id, motivation: 'x', seed, id });
    h.skills = h.skills.filter((s) => s.id !== 'metier');
    for (const [sid, adv, sp] of [['ramer', 50], ['voile', 45, 'chaland'], ['metier', advances, spec]] as const) {
      h.skills.push({ id: sid, spec: sp, characteristic: skillCharacteristicById(sid), advances: adv } as SkillInstance);
    }
    return h;
  }
  const charpentier = () => reparateur('r-bran', 21, 'charpentier', 30);

  beforeEach(() => {
    seedBattleRng(7);
    set({
      party: [charpentier()], battle: null, lieu: 'A', travelRecap: null, pendingRest: null, pendingCascade: null, suspendedCascades: [], journal: [],
      worldMap: carteDuReik, vessel: null,
    } as never);
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', routeDuReik)!;
    set({ travelPlan: { ...plan, river: { ...plan.river!, broken: true } } });
  });
  afterEach(() => resetRule('fleuve-reparation-temporaire-reparation-difficulte'));

  const reparation = () => buildRiverDayCascade(get, set, routeDuReik).steps.find((s) => s.kind === 'fleuveReparationDeCommande')!;
  const cible = (d: Difficulty) => testValue(get().party[0], { skill: { id: 'metier', spec: 'charpentier' } }) + DIFFICULTY_MODIFIERS[d];

  it('le meilleur des deux Métiers répare, Charpentier compris (MSRC 7 l.115)', () => {
    set({ party: [reparateur('r-cb', 21, 'construction-de-bateaux', 10), reparateur('r-ch', 22, 'charpentier', 60)] });
    const metier = (spec: string, i: number) => testValue(get().party[i], { skill: { id: 'metier', spec } });
    expect(metier('construction-de-bateaux', 0)).toBeLessThan(metier('charpentier', 1));
    expect(reparation().actorId).toBe('r-ch');
  });

  it('le Charpentier jette la réparation temporaire sans malus, à la Difficulté de la règle maison', () => {
    const defaut = rule('fleuve-reparation-temporaire-reparation-difficulte') as Difficulty;
    expect(reparation().difficulty).toBe(defaut);
    expect(reparation().target).toBe(cible(defaut));
    setRule('fleuve-reparation-temporaire-reparation-difficulte', 'tresDifficile');
    expect(reparation().difficulty).toBe('tresDifficile');
    expect(reparation().target).toBe(cible('tresDifficile'));
  });
});
