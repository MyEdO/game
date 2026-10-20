import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { registerScene } from './registreDesScenes';
import { makePregens } from '../data/pregens';
import { beginShipwreck } from './shipwreck';
import { runSeaDay, buildSeaPlan } from './seaVoyageFlow';
import { checkBattleOver } from './combatFlow';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import { seedBattleRng } from '../noyau/battleRng';
import { setRule, resetRule } from '../engine/policy';
import { addCondition } from '../engine/conditions';
import type { WorldMap } from './worldMap';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from '../noyau/pendings';
import type { Possession } from '../engine/possession';
import { resetCadence, setCadence } from '../engine/cadence';

/**
 * NAUFRAGE (#244, cascade #269) — séquence de survie unique branchée aux deux sites de coulée (avarie de
 * voyage, combat naval). Chaque héros conscient à bord tente un Test de Natation (LDB 09 l.372) — une
 * ÉTAPE de cascade INFLUENÇABLE (Chance/Pacte/Résilience) par héros piloté par un humain (défaut des tests :
 * `combat-cadence` = 'manuel', héros non `aiControlled` → `humanControlled` vrai) ; un groupe SANS pilote
 * humain se résout inline. Les rescapés s'échouent, les noyés meurent (LDB 18 l.344), le navire + la
 * cargaison sombrent (`vessel` → null, IMMÉDIAT). Tous noyés → défaite.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const seaMap: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

/** Fixe la valeur de Natation d'un héros par sa Force (Natation non possédée → carac F, cf. `testValue`). */
function swim(h: Combatant, f: number): Combatant {
  return { ...h, characteristics: { ...(h.characteristics ?? {}), force: f } as never };
}

/** Héros Inconscient : ne peut PAS nager → noyade DÉTERMINISTE (chemin sans jet dans `beginShipwreck`). */
function knockedOut(h: Combatant): Combatant {
  const c = { ...h, conditions: [...(h.conditions ?? [])] };
  addCondition(c as never, 'inconscient');
  return c;
}

/** Pilote la cascade de naufrage jusqu'à sa clôture (« Lancer » puis « Continuer » étape par étape) —
 *  sert à driver les scénarios PILOTÉS PAR UN HUMAIN (défaut des tests) jusqu'au dénouement. */
function drainSwimCascade(): void {
  for (let guard = 0; guard < 20 && get().pendingCascade; guard++) {
    const casc = get().pendingCascade!;
    const cur = casc.participants[casc.cursor];
    if (cur && !cur.result) get().cascadeRoll(cur.id);
    get().cascadeNext();
  }
}

/** Étape de Natation dont le jet est POSÉ en RÉUSSITE : l'issue du Test ne dépend d'aucun dé ambiant
 *  (position du flux RNG partagé du worker, #1014) — seule la conséquence est sous mesure. */
function swimSuccess(step: CascadeStep): CascadeStep {
  return { ...step, result: { roll: 5, target: step.target!, sl: Math.floor((step.target! - 5) / 10), success: true } };
}

/** Scène de la place A (`scene: 'port-a'`) : le rivage d'échouage du naufrage. ENREGISTRÉE au
 *  `sceneRegistry` par `freshState` — sans elle `transitionTo` est un no-op et la clôture ne joue
 *  qu'un chemin dégradé absent de la partie réelle. */
function portAScene() {
  return { id: 'port-a', label: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] };
}

function freshState() {
  seedBattleRng(1);
  resetCadence();
  registerScene(portAScene() as never);
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: portAScene() as never,
    battle: null,
    worldMap: seaMap,
    travelPlan: null,
    partyWiped: false,
    document: null,
    gameTime: 8 * 60,
    lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [{ cargoId: 'bois', enc: 100, basePriceGold: 1 }] },
    journal: [],
    pendingCascade: null,
    suspendedCascades: [],
  } as never);
  // Bandes auto désactivées : les Tests de Natation sont pilotés par la seule valeur (déterminisme).
  setRule('test-auto-bands', 'off');
}

afterEach(() => { resetRule('test-auto-bands'); resetRule('sea-shipwreck-swim'); resetCadence(); });

describe('beginShipwreck — cascade de survie (héros pilotés par un humain, défaut des tests)', () => {
  beforeEach(freshState);

  it('mélange rescapés / noyés : navire + cargaison perdus, dénouement à l’écran, morts morts', () => {
    setRule('sea-shipwreck-swim', 'intermediaire'); // cible = valeur (Natation)
    // party[0]/[2] bons nageurs (F 200) → rescapés ; party[1] Inconscient → noyade déterministe (pas de jet).
    set({ party: [swim(get().party[0], 200), knockedOut(get().party[1]), swim(get().party[2], 200)] } as never);
    set({ travelPlan: { routeId: 'r1', fromPlaceId: 'A', toPlaceId: 'B', mode: 'mer', km: 550, kmDone: 500, hoursPerDay: 24, interrupted: false } as never });

    beginShipwreck(get, set);

    // Vessel/travelPlan purgés IMMÉDIATEMENT (indépendant de l'issue des jets, à l'ouverture de la cascade).
    expect(get().vessel).toBeNull();
    expect(get().travelPlan).toBeNull();
    // Une étape de Natation par nageur CONSCIENT — l'Inconscient n'en porte aucune (déjà noyé).
    const casc = get().pendingCascade!;
    expect(casc).toBeTruthy();
    expect(casc.participants).toHaveLength(2);
    expect(casc.participants.every((s) => s.kind === 'shipwreckSwim' && s.rollLabel === 'Natation')).toBe(true);
    expect(get().party[1].dead).toBe(true); // Inconscient → noyé d'office, avant même la cascade

    drainSwimCascade();

    expect(get().pendingCascade).toBeNull();
    expect(get().party[0].dead).toBeFalsy();          // F 200 → rejoint la côte
    expect(get().party[2].dead).toBeFalsy();
    expect(get().document?.title).toBe('Naufrage');   // dénouement à l’écran (modale document)
    // Le rapport est du Markdown (`Prose`) : chaque ligne du journal est un PARAGRAPHE, jamais un saut simple.
    const rapport = get().document?.text ?? '';
    expect(rapport.split('\n\n').length).toBeGreaterThan(1);
    expect(rapport).not.toMatch(/[^\n]\n[^\n]/);
    expect(get().journal.join('\n')).toContain('— NAUFRAGE —');
    expect(get().partyWiped).toBeFalsy();             // au moins un rescapé
  });

  it('la Chance est dépensable sur un échec de Natation et TRANSFORME le résultat (survie)', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    const h = swim(get().party[0], 200);
    h.fortune = 1;
    h.resilience = 1;
    set({ party: [h] } as never);

    beginShipwreck(get, set);
    const casc = get().pendingCascade!;
    expect(casc.participants).toHaveLength(1);
    const stepId = casc.participants[0].id;
    // Force un ÉCHEC sur l'étape courante (comme `cascade.test.ts`) puis dépense la Chance : succès forcé.
    set({ pendingCascade: { ...casc, participants: [{ ...casc.participants[0], result: { roll: 88, target: casc.participants[0].target!, sl: -5, success: false } }] } });
    get().cascadeReroll(stepId); // 1 Point de Chance dépensé (relance simple)
    expect(get().party[0].fortune).toBe(0);
    get().cascadeForceSuccess(stepId); // Résilience — ici on force directement le succès pour clore le test
    expect(get().pendingCascade!.participants[0].result!.success).toBe(true);
    get().cascadeNext();

    expect(get().pendingCascade).toBeNull();
    expect(get().party[0].dead).toBeFalsy(); // la Chance a transformé la noyade en survie
    // Chemin RÉEL de clôture (rivage enregistré) : échouage joué, dénouement à l'écran, rien de parqué.
    expect(get().scene!.id).toBe('port-a');
    expect(get().document?.title).toBe('Naufrage');
    expect(get().suspendedCascades).toHaveLength(0);
  });

  it('la clôture TRANSITIONNE vers le rivage : la cascade se FERME et joue son dénouement, jamais ressuscitée en bilan', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    set({ party: [swim(get().party[0], 200)] } as never);

    beginShipwreck(get, set);
    const casc = get().pendingCascade!;
    expect(casc.participants).toHaveLength(1);
    // Jet POSÉ (aucun dé ambiant : l'issue du Test ne doit rien à la position du flux RNG du worker,
    // #1014) — succès : le rescapé s'échoue, donc la clôture TRANSITIONNE.
    set({ pendingCascade: { ...casc, participants: [swimSuccess(casc.participants[0])] } });
    get().cascadeNext(); // UN SEUL geste : la dernière étape se valide et clôt la séquence

    // La DERNIÈRE étape transitionne (`finishShipwreck` → `transitionTo`), ce qui SUSPEND la cascade en
    // pleine exécution de son propre applier : sans étape restante il n'y a rien à préserver.
    expect(get().suspendedCascades).toHaveLength(0); // pas de séquence parquée…
    expect(get().pendingCascade).toBeNull();         // …donc aucune résurrection en BILAN
    expect(get().scene!.id).toBe('port-a');
    expect(get().document?.title).toBe('Naufrage');
    expect(get().party[0].dead).toBeFalsy();
  });

  it('« Tout résoudre » sur la dernière étape qui TRANSITIONNE : même clôture (pas de bilan ressuscité)', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    set({ party: [swim(get().party[0], 200)] } as never);

    beginShipwreck(get, set);
    const casc = get().pendingCascade!;
    expect(casc.participants).toHaveLength(1);
    set({ pendingCascade: { ...casc, participants: [swimSuccess(casc.participants[0])] } }); // jet POSé (cf. ci-dessus)
    get().cascadeResolveAll(); // pilote « Tout résoudre » : committe la dernière étape déjà résolue

    // Le BILAN n'est pas montrable (le slot est passé à la scène d'arrivée) et il ne reste aucune étape :
    // la séquence se FINALISE, elle ne se parque pas.
    expect(get().suspendedCascades).toHaveLength(0);
    expect(get().pendingCascade).toBeNull();
    expect(get().scene!.id).toBe('port-a');
    expect(get().document?.title).toBe('Naufrage');
    expect(get().party[0].dead).toBeFalsy();
  });

  it('tous noyés → défaite hors combat (checkPartyWiped) — aucun nageur conscient, pas de cascade', () => {
    // Tout le groupe Inconscient : nul ne peut nager → noyade totale déterministe → défaite, SANS cascade
    // (aucun nageur conscient à mettre en étape).
    set({ party: get().party.map((h) => knockedOut(h)) } as never);
    beginShipwreck(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().party.every((h) => h.dead)).toBe(true);
    expect(get().vessel).toBeNull();
    expect(get().partyWiped).toBe(true);
  });

  it('n’intervient que sur l’équipage désigné (aboardIds) — aucun nageur conscient, pas de cascade', () => {
    set({ party: get().party.map((h) => knockedOut(h)) } as never);
    beginShipwreck(get, set, { aboardIds: [get().party[0].id] });
    expect(get().pendingCascade).toBeNull();
    expect(get().party[0].dead).toBe(true);   // à bord, noyé
    expect(get().party[1].dead).toBeFalsy();  // hors de l'équipage désigné → non testé
    expect(get().party[2].dead).toBeFalsy();
  });
});

/**
 * SLOT PASSIF (#1262 V2 L4) — sonde du juge promue. Une étape dont le jet est NÉ ROULÉ chez un porteur
 * qu'aucun siège ne surface ne se retouche pas : ni Résilience (LDB 17 l.68), ni Résistance (Menace),
 * ni renversement. Le naufrage est le SEUL producteur d'un tel mélange (un nageur piloté à la main, un
 * autre conduit par l'IA, dans la MÊME cascade).
 *
 * La passivité est DÉRIVÉE (`rollFlowFactory.passive` : jet posé + porteur non surfacé), plus déclarée
 * par un drapeau d'étape : ces deux cas sont donc la mesure du contrat, pas celle d'un booléen.
 */
describe('#1262 V2 L4 — un jet NÉ ROULÉ sans pilote ne se force pas ; un jet VIVANT, si', () => {
  beforeEach(freshState);

  /** Nageur conduit par l'IA : son jet naît roulé (`beginShipwreck`), et il a de quoi payer. */
  function mixte(): { humain: string; ia: string } {
    const [a, b] = get().party;
    const humain = { ...swim(a, 200), resilience: 2 };
    const ia = { ...swim(b, 1), aiControlled: true, resilience: 2 } as Combatant;
    set({ party: [humain, ia] } as never);
    return { humain: humain.id, ia: ia.id };
  }

  it('étape NÉE-ROULÉE d’un porteur non surfacé : la Résilience ne la retouche pas, aucun point dépensé', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    const { ia } = mixte();

    beginShipwreck(get, set);

    const etape = get().pendingCascade!.participants.find((s) => s.actorId === ia)!;
    expect(etape.result, 'le jet de l’IA naît ROULÉ (aucune fenêtre ne le lui demandera)').toBeTruthy();
    expect(etape.result!.success, 'et il est RATÉ (Natation 1) — il y aurait donc de quoi forcer').toBe(false);
    const avant = { ...etape.result! };

    get().cascadeForceSuccess(etape.id);

    const apres = get().pendingCascade!.participants.find((s) => s.actorId === ia)!;
    expect(apres.result, 'le jet d’un slot PASSIF ne se force pas').toEqual(avant);
    expect(get().party.find((h) => h.id === ia)!.resilience, 'et aucun point n’est débité').toBe(2);
  });

  it('étape VIVANTE d’un porteur surfacé : la Résilience la force et débite SON point', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    const { humain } = mixte();

    beginShipwreck(get, set);

    const casc = get().pendingCascade!;
    const etape = casc.participants.find((s) => s.actorId === humain)!;
    expect(etape.result, 'le porteur surfacé garde SON jet à jouer').toBeNull();
    // Échec POSÉ (aucun dé ambiant) : c'est l'état nominal où la Résilience se dépense (LDB 17 l.68).
    set({ pendingCascade: { ...casc, participants: casc.participants.map((s) => (s.id === etape.id
      ? { ...s, result: { roll: 88, target: s.target!, sl: -5, success: false } } : s)) } });

    get().cascadeForceSuccess(etape.id);

    const apres = get().pendingCascade!.participants.find((s) => s.actorId === humain)!;
    expect(apres.result!.success, 'le verbe reste OUVERT sur un jet vivant').toBe(true);
    expect(get().party.find((h) => h.id === humain)!.resilience).toBe(1);
  });

  /**
   * CONTRAT FIGÉ, dit (#1262 V2 L4) — la passivité inclut la CADENCE, que l'ancien drapeau ignorait :
   * `surfaceOf` = `!cadenceAuto() && jetSurfaced(...)`. En cadence AUTO, le jet posé d'un héros même
   * surfacé devient donc PASSIF : « en cadence auto, on ne joue pas », y compris on ne dépense pas.
   *
   * Défense en PROFONDEUR : mesuré, le cas n'est atteignable par AUCUN écran (en cadence auto la modale
   * de cascade ne s'ouvre pas). Ce test fige le verbe lui-même, pas l'affordance qui n'existe pas.
   */
  it('CADENCE : verbe OUVERT en cadence normale, FERMÉ en cadence auto (même étape, même porteur)', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    const { humain } = mixte();
    beginShipwreck(get, set);

    const casc = get().pendingCascade!;
    const etape = casc.participants.find((s) => s.actorId === humain)!;
    /** Échec POSÉ, identique dans les deux régimes : seule la cadence change entre les deux mesures. */
    const rate = () => set({ pendingCascade: { ...get().pendingCascade!, participants: get().pendingCascade!.participants
      .map((s) => (s.id === etape.id ? { ...s, result: { roll: 97, target: 40, sl: -6, success: false }, forced: false } : s)) } });
    const resultOf = () => get().pendingCascade!.participants.find((s) => s.id === etape.id)!.result!;

    rate();
    setCadence('auto');
    get().cascadeForceSuccess(etape.id);
    expect(resultOf(), 'cadence AUTO : le jet posé est PASSIF — rien n’est retouché').toEqual({ roll: 97, target: 40, sl: -6, success: false });
    expect(get().party.find((h) => h.id === humain)!.resilience, 'et aucun point n’est débité').toBe(2);

    resetCadence();
    rate();
    get().cascadeForceSuccess(etape.id);
    expect(resultOf().success, 'cadence NORMALE : le même verbe, sur la même étape, force la réussite').toBe(true);
    expect(get().party.find((h) => h.id === humain)!.resilience, 'et débite SON point').toBe(1);
  });
});
describe('beginShipwreck — repli IA/rafale (aucun pilote humain à bord) : inline VISIBLE', () => {
  beforeEach(freshState);

  it('cadence auto (rafale) → résolution inline, aucune modale de cascade', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    setCadence('auto'); // héros non remontés en modale (cf. state/netOwnership.humanControlled)
    set({ party: [swim(get().party[0], 200)] } as never);

    beginShipwreck(get, set);

    expect(get().pendingCascade).toBeNull(); // pas de cascade : résolu inline, comme aujourd'hui
    expect(get().party[0].dead).toBeFalsy();
    expect(get().document?.title).toBe('Naufrage');
    expect(get().journal.join('\n')).toContain('— NAUFRAGE —');
  });
});

describe('voyage — une coque à 0 Blessure navigue (MDG 13 l.656, l.674)', () => {
  beforeEach(freshState);

  it('runSeaDay déroule la journée sur une coque à 0 : ni naufrage ni perte du navire', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    set({ party: get().party.map((h) => swim(h, 200)) } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    plan.vehicle!.wounds.current = 0;
    set({ travelPlan: plan });
    runSeaDay(get, set);
    expect(get().vessel).not.toBeNull();
    expect(get().document?.title).not.toBe('Naufrage');
    expect(get().journal.join('\n')).not.toContain('— NAUFRAGE —');
    expect(get().travelPlan, 'la traversée continue').not.toBeNull();
  });

  it('buildSeaPlan arme une traversée sur un navire de campagne à 0 Blessure', () => {
    set({ vessel: { ...get().vessel!, wounds: { current: 0, max: 30 } } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0]);
    expect(plan).not.toBeNull();
    expect(plan!.vehicle!.wounds.current).toBe(0);
  });
});

describe('beginShipwreck — cascade Possession (#618 SOCLE POSSESSIONS, dernier item DoD)', () => {
  beforeEach(freshState);

  it('navire coulé (vehicleId=cogue) → possessions EMBARQUÉES dessus toutes destroyed ; avec-le-groupe intacte', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    set({ party: [swim(get().party[0], 200)] } as never);
    const navire: Possession = {
      uid: 'pos-navire', nature: 'navire', ownerId: get().party[0].id, location: { kind: 'avec-le-groupe' },
      items: [], vehicleId: 'cogue', naval: { morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    };
    const embarquee1: Possession = {
      uid: 'pos-1', nature: 'bete', ownerId: get().party[0].id, location: { kind: 'embarquee', hostUid: 'pos-navire' },
      items: [], ref: { creatureId: 'mule' },
    };
    const embarquee2: Possession = {
      uid: 'pos-2', nature: 'vehicule', ownerId: get().party[0].id, location: { kind: 'embarquee', hostUid: 'pos-navire' },
      items: [], vehicleId: 'charrette',
    };
    const surLaTerreFerme: Possession = {
      uid: 'pos-3', nature: 'bete', ownerId: get().party[0].id, location: { kind: 'avec-le-groupe' },
      items: [], ref: { creatureId: 'mule' },
    };
    set({ possessions: [navire, embarquee1, embarquee2, surLaTerreFerme] });

    beginShipwreck(get, set);
    drainSwimCascade();

    const byUid = (uid: string) => get().possessions.find((p) => p.uid === uid);
    expect(byUid('pos-navire')?.destroyed).toBe(true);
    expect(byUid('pos-1')?.destroyed).toBe(true);
    expect(byUid('pos-2')?.destroyed).toBe(true);
    expect(byUid('pos-3')?.destroyed).toBeFalsy(); // avec-le-groupe, PAS embarquée sur le navire coulé → intacte
  });
});

describe('détection en combat — coque de campagne coulée → naufrage (pas défaite)', () => {
  beforeEach(freshState);

  const coqueDeCampagne = (heroes: Combatant[], coulee: boolean): Combatant => {
    const hull = vehicleCombatant(findVehicleById('cogue')!)!;
    hull.id = 'hull-campagne'; hull.kind = 'enemy';
    hull.crewIds = heroes.map((h) => h.id);
    hull.wounds = { current: 0, max: hull.wounds.max };
    if (coulee) addCondition(hull, 'naufrage'); // MDG 13 l.674
    return hull;
  };

  it('coque à 0 Blessure sans État naufrage : le combat continue, le navire reste (MDG 13 l.656)', () => {
    const heroes = get().party.slice(0, 2).map((h) => swim(h, 200));
    const hull = coqueDeCampagne(heroes, false);
    const battle = {
      combatants: [hull, ...heroes], order: [], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    set({ party: heroes, battle } as never);
    checkBattleOver(get, set);
    expect(get().vessel).not.toBeNull();
    expect(get().document?.title).not.toBe('Naufrage');
    expect(heroes.every((h) => !h.outOfRencontre)).toBe(true);
  });

  it('checkBattleOver route l’équipage par-dessus bord vers la survie', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    const heroes = get().party.slice(0, 2).map((h) => swim(h, 200)); // bons nageurs → rescapés
    const hull = coqueDeCampagne(heroes, true);
    const battle = {
      combatants: [hull, ...heroes], order: [], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    set({ party: heroes, battle } as never);

    const over = checkBattleOver(get, set);
    drainSwimCascade();

    expect(over).toBe(true);
    expect(get().battle).toBeNull();               // combat clos par le naufrage, pas par la défaite
    expect(get().vessel).toBeNull();               // navire de campagne perdu
    expect(get().document?.title).toBe('Naufrage'); // dénouement à l’écran
    expect(get().party.every((h) => !h.dead)).toBe(true); // rescapés (F 200)
  });
});
