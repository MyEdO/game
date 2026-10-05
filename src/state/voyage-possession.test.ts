/**
 * #1262 V2 lot 2 — POSSESSION des flux de VOYAGE (mer, fleuve, route) et de l'Embrigadement. Même
 * défaut de fond que les lots V1, sur les quatre feuilles hors combat :
 *  - la BANDE d'équipage de mer (`contributors.map`) ne déclarait AUCUNE possession → `modalOwnerOf`
 *    `undefined`, c'est-à-dire fenêtre à l'HÔTE SEUL, qui jouait le Test du héros d'un invité
 *    (classe #1268) ;
 *  - les CHOIX collectifs (Progression du jour, interpellation pirate, décision d'Embrigadement)
 *    n'avaient pas de porteur → même fenêtre hôte-seul, et l'hôte tranchait pour autrui ;
 *  - les GATES d'insertion lisaient l'affordance LOCALE (`humanControlled` — « qui a la main devant
 *    CET écran ») au lieu de la SURFACE (`surfaceOf` — « un siège humain QUELCONQUE tient ce
 *    porteur ») : le conducteur d'un invité repartait sur le chemin synchrone, jet roulé en silence.
 *
 * En SOLO les deux prédicats coïncident (tout est à l'hôte) : ces régressions y sont INVISIBLES —
 * d'où le harnais à deux sièges (#1262 B7).
 *
 * LOT 3 y ajoute les POSTES d'Étape (voyage terrestre, `travelPostes`) : la bande des Activités et la
 * bande de Résistance de traversée naissaient de littéraux SANS possession — même fenêtre hôte-seul.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { emptyScene } from './scene';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { buildSeaPlan, runSeaDay, resolvePortArrival } from './seaVoyageFlow';
import { buildRiverDayCascade } from './riverVoyageFlow';
import { buildStageSteps, buildWeatherResistanceSteps } from './travelPostes';
import { startCascade } from './cascade';
import { creditBourse } from './bourseFlow';
import { seedBattleRng } from './battleRng';
import { createHero, skillCharacteristicById } from '../engine/character';
import { type RNG } from '../engine/dice';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns, humanControlled, WORLD_STEP_OWNER } from './netOwnership';
import { surfaceOf } from './rollSeam';
import { partyAssisted } from '../engine/skills';
import { buildScene } from './mapSpec';
import { setRule, resetRule } from '../engine/policy';
import { setCadence, resetCadence, cadenceAuto } from '../engine/cadence';
import type { Combatant, SkillInstance } from '../engine/types';
import type { WorldMap, MapRouteTrace } from './worldMap';

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);
const NET0 = useGame.getState().net;
const ones: RNG = { int: (min) => min };
const etapes = () => get().pendingCascade?.participants ?? [];
const parKind = (k: string) => etapes().find((s) => s.kind === k);

/** Deux sièges : l'hôte (0) et un invité (1) qui possède les héros nommés. */
function deuxSieges(...idsInvite: string[]): void {
  const ownership: Record<string, number> = {};
  for (const id of idsInvite) ownership[id] = 1;
  useGame.setState({ net: { ...NET0, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership } } as never);
}

function skill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const ex = c.skills.find((s) => s.id === skillId && (s.spec ?? null) === (spec ?? null));
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, spec, characteristic: skillCharacteristicById(skillId), advances } as SkillInstance);
}

afterEach(() => {
  useGame.setState({ net: NET0, pendingCascade: null, suspendedCascades: [], travelPlan: null } as never);
});

// ── MER ──────────────────────────────────────────────────────────────────────────────────────────

const seaMap: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b' },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function fraisMer(): void {
  seedBattleRng(1);
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene(2, 2), id: 'port-a', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, worldMap: seaMap, travelPlan: null, travelRecap: null,
    pendingCrewTest: null, pendingRest: null, pendingCascade: null, suspendedCascades: [],
    gameTime: 8 * 60, lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    journal: [],
  } as never);
}

describe('#1262 V2 — la journée en MER se possède (classe #1268)', () => {
  beforeEach(fraisMer);

  it('Progression : le CHOIX porte le barreur, et la bande d’équipage est PARTAGÉE (plus de fenêtre hôte-seul)', () => {
    const equipage = get().party;
    deuxSieges(equipage[0].id, equipage[1].id, equipage[2].id); // TOUT l'équipage est à l'invité
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])! });
    runSeaDay(get, set);

    const choix = parKind('sea-progression-choice')!;
    expect(choix, 'la journée s’ouvre sur le choix de Progression').toBeTruthy();
    expect(choix.actorId, 'le choix a un PORTEUR : le barreur que la voie Navigation ferait jouer').toBeTruthy();
    expect(seatOwns(get(), 1, modalOwnerOf(get()) as string), 'la fenêtre est au siège qui tient ce barreur').toBe(true);
    expect(seatOwns(get(), 0, modalOwnerOf(get()) as string), 'et plus à l’hôte').toBe(false);

    get().cascadeChoose(choix.id, 'crew');
    get().cascadeNext();
    const bande = parKind('progression')!;
    expect(bande, 'la voie ÉQUIPAGE insère sa bande').toBeTruthy();
    // La possession se DÉDUIT du nombre de porteurs (`bandStep`) : `groupOwner` à plusieurs, le porteur
    // à un seul. Ce qui est verrouillé ici, c'est qu'elle ne soit JAMAIS absente — l'owner `undefined`
    // rendait la fenêtre à l'hôte SEUL, qui jouait le Test du héros d'un invité (#1268).
    const porteurs = new Set(bande.participants!.map((p) => p.id));
    expect(porteurs.size, 'la bande a au moins un contributeur').toBeGreaterThan(0);
    if (porteurs.size > 1) {
      expect(bande.groupOwner, 'plusieurs porteurs : fenêtre partagée').toBe(true);
      expect(modalOwnerOf(get()), 'owner « * » — chaque siège voit la fenêtre où se tient SA rangée').toBe('*');
    } else {
      expect(bande.actorId, 'un seul porteur : la bande EST la sienne').toBe([...porteurs][0]);
      expect(modalOwnerOf(get())).toBe([...porteurs][0]);
      expect(seatOwns(get(), 1, modalOwnerOf(get()) as string), 'la fenêtre est au siège du porteur').toBe(true);
      expect(seatOwns(get(), 0, modalOwnerOf(get()) as string), 'et plus à l’hôte').toBe(false);
    }
    expect(modalOwnerOf(get()), 'jamais anonyme (c’était la fenêtre hôte-seul)').not.toBeUndefined();
  });
});

// ── EMBRIGADEMENT ────────────────────────────────────────────────────────────────────────────────

function fraisPort(): void {
  seedBattleRng(1);
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene(2, 2), id: 'port', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, pendingCascade: null, suspendedCascades: [],
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, manann: { score: -1, applied: [] } },
    journal: [],
  } as never);
  creditBourse(get, set, get().party[0].id, { gold: 100, silver: 0, brass: 0 });
}

describe('#1262 V2 — la décision d’Embrigadement est au siège du MENEUR', () => {
  beforeEach(fraisPort);

  it('le meneur du Ragot porte la décision — la détourner DÉPLACE la fenêtre de siège', () => {
    const [a, b] = get().party;
    skill(a, 'ragot', 60); // meneur incontesté
    deuxSieges(a.id); // A est à l'invité, B reste à l'hôte
    resolvePortArrival(get, set, undefined, ones);

    const decision = parKind('embrigadementDecision')!;
    const meneur = partyAssisted(get().party.filter((h) => !h.dead), 'ragot')!;
    expect(meneur.actor.id, 'le meneur mesuré est bien A').toBe(a.id);
    expect(decision.actorId, 'la décision porte le meneur de la tentative').toBe(a.id);
    expect(modalOwnerOf(get())).toBe(a.id);
    expect(seatOwns(get(), 1, a.id), 'la fenêtre s’ouvre au siège de l’invité, qui tient le meneur').toBe(true);
    expect(seatOwns(get(), 0, a.id), 'et pas chez l’hôte').toBe(false);

    // MENEUR DÉTOURNÉ : B devient le plus compétent → la même décision change de siège.
    fraisPort();
    const [a2, b2] = get().party;
    skill(b2, 'ragot', 80);
    deuxSieges(a2.id);
    resolvePortArrival(get, set, undefined, ones);
    expect(parKind('embrigadementDecision')!.actorId).toBe(b2.id);
    expect(seatOwns(get(), 0, b2.id), 'B est à l’hôte : la fenêtre y revient').toBe(true);
    expect(seatOwns(get(), 1, b2.id), 'et quitte le siège de l’invité').toBe(false);
    void b;
  });
});

// ── FLEUVE ───────────────────────────────────────────────────────────────────────────────────────

const quai = (id: string, label: string) => buildScene({ id, label, desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

function riverMap(extra: Partial<MapRouteTrace> = {}): WorldMap {
  return {
    id: 'm', label: 'Le Reik',
    places: [
      { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'quai-a' },
      { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: 'quai-b' },
    ],
    routes: [{ id: 'r-reik', a: 'A', b: 'B', km: 45, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0, ...extra }],
  };
}

describe('#1262 V2 — la descente FLUVIALE : le barreur garde sa fenêtre, le péril sans barreur est au MONDE', () => {
  it('barreur de l’invité : les étapes du jour lui appartiennent (jamais à l’hôte)', () => {
    seedBattleRng(7);
    const gunnar = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Gunnar', motivation: 'x', seed: 11, id: 'r-gunnar' });
    skill(gunnar, 'ramer', 50);
    skill(gunnar, 'voile', 45);
    const otto = createHero({ speciesId: 'humains-reiklander', careerId: 'garde', label: 'Otto', motivation: 'x', seed: 12, id: 'r-otto' });
    get().setParty([gunnar, otto]);
    get().loadProject([quai('quai-a', 'Grünburg'), quai('quai-b', 'Altdorf')], 'quai-a', riverMap());
    set({ travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
    deuxSieges(gunnar.id, otto.id); // tout le bord est à l'invité
    expect(humanControlled(get(), gunnar), 'chez l’hôte, il ne pilote pas le batelier de l’invité…').toBe(false);
    expect(surfaceOf(get, gunnar.id), '…mais un siège humain le tient').toBe(true);

    get().startTravel('r-reik', 'barge');
    const jour = etapes().filter((s) => s.target != null);
    expect(jour.length, 'la journée porte ses jets').toBeGreaterThan(0);
    // Chaque étape NOMME son jeteur (le mint le dérive de l'acteur déclaré) et la fenêtre suit son siège.
    for (const st of jour) {
      expect(st.actorId, `l’étape ${st.kind} nomme son jeteur`).toBeTruthy();
      expect(seatOwns(get(), 1, st.actorId!), `${st.kind} : au siège de l’invité`).toBe(true);
      expect(seatOwns(get(), 0, st.actorId!), `${st.kind} : plus à l’hôte`).toBe(false);
    }
    expect(seatOwns(get(), 1, modalOwnerOf(get()) as string), 'la fenêtre du jour est au siège du bord').toBe(true);
  });

  it('péril SANS barreur : le pas de vérification est une étape MONDE (siège MJ), pas un pas anonyme', () => {
    seedBattleRng(7);
    const gunnar = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Gunnar', motivation: 'x', seed: 11, id: 'r-gunnar' });
    skill(gunnar, 'ramer', 50);
    get().setParty([gunnar]);
    get().loadProject([quai('quai-a', 'Grünburg'), quai('quai-b', 'Altdorf')], 'quai-a', riverMap({ riverPerils: [{ perilId: 'debris', chancePct: 100 }] }));
    set({ travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
    get().startTravel('r-reik', 'barge');
    set({ pendingCascade: null });
    // Plus personne à bord pour tenir la barre : `riverPilot` (le meilleur du groupe, Soutien compris)
    // ne rend PERSONNE — le fleuve vérifie seul son péril, et ce pas n'est le pas de personne.
    // Branche ÉTROITE, et c'est mesuré ici : un passager sans la moindre avance en Voile/Ramer reste un
    // barreur pour `partyAssisted`. Elle préexiste à la porte (`actorId: pilot?.actor.id`, sans porteur).
    set({ party: [] });
    const route = (get().worldMap as WorldMap).routes[0];
    const { steps } = buildRiverDayCascade(get, set, route, { scene: 'quai-b', label: 'Altdorf' });
    const check = steps.find((s) => s.kind === 'riverPerilCheck')!;
    expect(check, 'le pas de vérification du péril existe').toBeTruthy();
    expect(check.actorId, 'aucun héros ne le porte').toBeUndefined();
    expect(check.worldOwner, 'c’est une étape MONDE (porte : `displayStep worldOwner`)').toBe(true);
    startCascade(get, set, { title: 'Journée de descente', purpose: 'travelDay', steps: [check] });
    expect(modalOwnerOf(get()), 'routée au sentinel MONDE, jamais `undefined` (= hôte seul)').toBe(WORLD_STEP_OWNER);
  });
});

// ── ROUTE ────────────────────────────────────────────────────────────────────────────────────────

describe('#1262 V2 — l’allure FORCÉE ouvre sa cascade pour le conducteur d’un INVITÉ', () => {
  afterEach(() => resetRule('travel-allures'));

  it('conducteur d’un autre siège : la journée devient influençable au lieu de se rouler en silence', () => {
    setRule('travel-allures', true);
    seedBattleRng(1);
    const lead = createHero({ speciesId: 'humains-reiklander', careerId: 'cocher', label: 'Lead', motivation: 'x', seed: 21, id: 't-lead' });
    skill(lead, 'conduite-d-attelage', 40);
    const aide = createHero({ speciesId: 'humains-reiklander', careerId: 'garde', label: 'Aide', motivation: 'x', seed: 22, id: 't-aide' });
    skill(aide, 'conduite-d-attelage', 5);
    useGame.setState({ party: [lead, aide], travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] } as never);
    get().loadProject(
      [buildScene({ id: 'lieu-a', label: 'A', desc: '.', size: [8, 6], terrain: 'herbe', heroStart: [2, 3] }),
        buildScene({ id: 'lieu-b', label: 'B', desc: '.', size: [8, 6], terrain: 'herbe', heroStart: [2, 3] })],
      'lieu-a',
      { id: 'c', label: 'c', places: [
        { id: 'pa', label: 'A', pos: { x: 0, y: 0 }, scene: 'lieu-a' },
        { id: 'pb', label: 'B', pos: { x: 70, y: 0 }, scene: 'lieu-b' },
      ], routes: [{ id: 'r1', a: 'pa', b: 'pb', km: 20, modes: ['diligence', 'pied'], perilDie: 0 }] } as WorldMap,
    );
    creditBourse(get, set, lead.id, { gold: 500, silver: 0, brass: 0 });
    deuxSieges(lead.id, aide.id); // l'attelage entier est conduit depuis le siège de l'invité
    expect(humanControlled(get(), lead), 'chez l’hôte, le conducteur de l’invité n’est pas « à la main »').toBe(false);

    get().startTravel('r1', 'diligence', { allure: 'galop' });

    const km = parKind('landForcedPace');
    expect(km, 'le Test de Conduite d’attelage s’OUVRE (le chemin synchrone le roulait sans fenêtre)').toBeTruthy();
    expect(km!.actorId).toBe(lead.id);
    expect(km!.result, 'rien n’a été roulé à sa place').toBeNull();
    expect(seatOwns(get(), 1, modalOwnerOf(get()) as string), 'la fenêtre est au siège du conducteur').toBe(true);
    expect(seatOwns(get(), 0, modalOwnerOf(get()) as string), 'et plus à l’hôte').toBe(false);
  });

  /**
   * TABLE DE VÉRITÉ du gate (#1262 V2 lot 2) — ce que le remplacement `humanControlled` → `surfaceOf`
   * change, et ce qu'il NE change pas. Le seul écart de comportement est la COLONNE COOP ; l'écart de
   * cadence, lui, est INATTEIGNABLE par construction sur ce site : `surfaceOf` est faux en cadence
   * non-manuelle, mais `humanControlled` l'est aussi dès qu'aucun siège humain local ne tient l'acteur —
   * et quand l'hôte le tient, les deux prédicats sont vrais en solo. La ligne « rapide/auto » ci-dessous
   * fige ce fait : les deux tombent ENSEMBLE, il n'y a pas de journée qui basculerait du différé au
   * synchrone par la seule cadence.
   */
  it('table de vérité : solo identique · cadence identique · COOP = le seul écart', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'cocher', label: 'D', motivation: 'x', seed: 31, id: 'tv-d' });
    useGame.setState({ party: [h] } as never);

    // 1. SOLO (aucun siège invité) : les deux prédicats disent VRAI.
    useGame.setState({ net: { ...NET0, mode: 'local', mySeat: 0, ownership: {} } } as never);
    expect(humanControlled(get(), h)).toBe(true);
    expect(surfaceOf(get, h.id)).toBe(true);

    // 2. CADENCE non manuelle : les deux tombent ENSEMBLE (aucun écart à exploiter).
    for (const c of ['rapide', 'auto'] as const) {
      setCadence(c);
      expect(surfaceOf(get, h.id), `cadence ${c} : rien à surfacer`).toBe(false);
      expect(humanControlled(get(), h) && !cadenceAuto(), `cadence ${c} : le gate d’avant ne surfaçait pas non plus`).toBe(false);
    }
    resetCadence();

    // 3. COOP — le héros est à l'INVITÉ : c'est LÀ que les deux divergent (le bug de la classe).
    useGame.setState({ net: { ...NET0, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership: { [h.id]: 1 } } } as never);
    expect(humanControlled(get(), h), 'l’ancien gate : « pas ma main » → jet roulé en silence').toBe(false);
    expect(surfaceOf(get, h.id), 'le nouveau : un siège humain le tient → sa fenêtre lui revient').toBe(true);

    // 4. ACTEUR CONDUIT PAR L'IA (aucun siège) : les deux disent FAUX — le repli inline reste le bon.
    const pnj = { ...h, id: 'tv-ia', aiControlled: true } as Combatant;
    useGame.setState({ party: [pnj], net: { ...NET0, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership: {} } } as never);
    expect(humanControlled(get(), pnj)).toBe(false);
    expect(surfaceOf(get, pnj.id)).toBe(false);
  });
});

// ── POSTES D'ÉTAPE (voyage terrestre) ────────────────────────────────────────────────────────────

describe('#1262 V2 lot 3 — les BANDES de l’Étape se possèdent (classe #1268)', () => {
  it('bande des Postes et bande de Résistance de traversée : jamais une fenêtre sans propriétaire', () => {
    seedBattleRng(3);
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'garde', label: 'Poste A', motivation: 'x', seed: 41, id: 'p-a' });
    const b = createHero({ speciesId: 'humains-reiklander', careerId: 'garde', label: 'Poste B', motivation: 'x', seed: 42, id: 'p-b' });
    useGame.setState({
      party: [a, b], battle: null, pendingCascade: null, suspendedCascades: [],
      travelPlan: { routeId: 'r', km: 24, postes: { [a.id]: { activityId: 'plein-air' }, [b.id]: { activityId: 'plein-air' } } },
    } as never);
    deuxSieges(b.id); // A à l'hôte, B à l'invité

    const postes = buildStageSteps(get, set, 'beau', 'ete').find((s) => s.kind === 'stagePosteBatch')!;
    expect(postes.participants!.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
    expect(postes.groupOwner, 'deux héros postés : fenêtre PARTAGÉE').toBe(true);
    startCascade(get, set, { title: 'Étape', purpose: 'travelDay', steps: [postes] });
    // Owner « * » : chaque siège voit la fenêtre où se tient SA rangée — jamais `undefined`, qui la
    // rendait à l'hôte SEUL (`netOwnership.ownsLocally`), lequel jouait alors le poste de l'invité.
    expect(modalOwnerOf(get())).toBe('*');

    // Résistance de traversée (Neige, l.86) : même bande, même possession.
    set({ pendingCascade: null });
    const trav = buildWeatherResistanceSteps(get, 'neige')[0];
    expect(trav.groupOwner).toBe(true);
    startCascade(get, set, { title: 'Traversée', purpose: 'travelDay', steps: [trav] });
    expect(modalOwnerOf(get())).toBe('*');

    // UN SEUL voyageur : la bande EST la sienne (le porteur, jamais l'hôte par défaut).
    set({ party: [b], pendingCascade: null });
    const seul = buildWeatherResistanceSteps(get, 'neige')[0];
    expect(seul.groupOwner).toBeUndefined();
    expect(seul.actorId).toBe(b.id);
    startCascade(get, set, { title: 'Traversée', purpose: 'travelDay', steps: [seul] });
    expect(seatOwns(get(), 1, modalOwnerOf(get()) as string), 'la fenêtre suit le siège du seul porteur').toBe(true);
    expect(seatOwns(get(), 0, modalOwnerOf(get()) as string), 'et pas l’hôte').toBe(false);
  });
});
