import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene } from './scene';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { buildSeaPlan, runSeaDay } from './seaVoyageFlow';
import { buildRiverPlan, runRiverDays } from './riverVoyageFlow';
import { seedBattleRng } from './battleRng';
import { skills as SKILLS, crewRoles as CREW_ROLES, refLabel } from '../data';
import { seaAutoResolves, riverAutoResolves, SEA_KINDS_SOUS_ORDRES, RIVER_ROUTINE_KINDS, DEFAULT_VOYAGE_ORDERS } from './voyageCadence';
import { createHero } from '../engine/character';
import { buildScene } from './mapSpec';
import type { Combatant, SkillInstance } from '../engine/types';
import type { WorldMap } from './worldMap';

/**
 * CADENCE DE VOYAGE (#232) — la couche PARTAGÉE mer ⇄ fluvial : ordres COMMANDÉE (routine auto-résolue,
 * PV du jour) vs JOUR-PAR-JOUR (modale par jet). « Aucun jet silencieux » : chaque jet auto-résolu laisse
 * sa ligne au procès-verbal — on compte les lignes vs les jets. Les crises interrompent quand même.
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

function freshSea() {
  seedBattleRng(1);
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene(2, 2), id: 'port-a', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, worldMap: seaMap, travelPlan: null, travelRecap: null,
    pendingCrewTest: null, pendingRest: null, pendingSteamSave: null,
    gameTime: 8 * 60, lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    journal: [], net: { ...useGame.getState().net, mode: 'local' },
  } as never);
}

describe('couche voyageCadence — prédicats de routine', () => {
  it('SEA_KINDS_SOUS_ORDRES est la liste FERMÉE auto-résolue ; crises/embuscade/rapide restent hors liste', () => {
    for (const k of ['progression', 'affaler', 'phare', 'orientation', 'entretien']) expect(SEA_KINDS_SOUS_ORDRES.has(k)).toBe(true);
    for (const k of ['poursuite', 'tourbillon', 'embuscade', 'extermination', 'ouragan', 'voyage-rapide']) expect(SEA_KINDS_SOUS_ORDRES.has(k)).toBe(false);
    expect(seaAutoResolves({ cadence: 'commande' }, 'progression')).toBe(true);
    expect(seaAutoResolves({ cadence: 'commande' }, 'poursuite')).toBe(false);
    expect(seaAutoResolves({ cadence: 'jour-par-jour' }, 'progression')).toBe(false);
    expect(riverAutoResolves({ cadence: 'commande' }, [])).toBe(true);
    expect(riverAutoResolves({ cadence: 'jour-par-jour' }, [])).toBe(false);
  });

  it('RIVER_ROUTINE_KINDS exclut `riverPerilCheck` (peut escalader en CHOIX, #351) — un péril bascule le jour en interactif', () => {
    for (const k of ['riverControlRepair', 'riverAgility', 'riverNav', 'riverTack', 'riverCapsize', 'riverRigging']) expect(RIVER_ROUTINE_KINDS.has(k)).toBe(true);
    expect(RIVER_ROUTINE_KINDS.has('riverPerilCheck')).toBe(false);
    const routine = [{ id: 's1', kind: 'riverAgility' }, { id: 's2', kind: 'riverNav' }] as never;
    const withPeril = [{ id: 's1', kind: 'riverAgility' }, { id: 'p1', kind: 'riverPerilCheck' }] as never;
    expect(riverAutoResolves({ cadence: 'commande' }, routine)).toBe(true);
    expect(riverAutoResolves({ cadence: 'commande' }, withPeril)).toBe(false);
  });
});

describe('traversée COMMANDÉE (mer) — routine auto-résolue, PV du jour, aucun jet silencieux', () => {
  beforeEach(freshSea);

  it('une journée commandée n’ouvre AUCUNE cascade de Test de routine ; les jets tombent au PV du jour', () => {
    get().startTravel('r1', 'mer', { cadence: 'commande' });
    // La boucle a déroulé toute la journée sans s’arrêter sur un Test de routine → halte de nuit atteinte.
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
    expect(get().travelPlan!.sea!.daysAtSea).toBe(1);
    const day = get().pendingRest!.travelDay!;
    // PV structuré : une ligne de JET par contributeur des Tests de routine (chaque jet a sa trace).
    expect((day.entries?.length ?? 0)).toBeGreaterThan(0);
    for (const e of day.entries!) expect(e.d).toBeTruthy(); // anatomie de jet (RollRow), pas du texte muet
    // Progression ET Orientation quotidiennes se sont jouées AU PV (ids `sea-<kind>-…`).
    const ids = day.entries!.map((e) => e.id ?? '');
    expect(ids.some((i) => i.startsWith('sea-progression'))).toBe(true);
    expect(ids.some((i) => i.startsWith('sea-orientation'))).toBe(true);
    // Instantané pour l’écran de traversée (rose des vents + distance restante) ; la coque n'y est
    // qu'en DELTA du jour (l'état courant se lit sur `vessel.wounds`).
    expect(day.sea).toBeTruthy();
    expect(day.sea!.milesLeft).toBeGreaterThan(0);
    expect(typeof day.sea!.hullDelta).toBe('number');
  });

  it('chaque ligne du PV NOMME la Compétence lancée (Z5), DIT sa Difficulté, et porte le rôle en PROVENANCE (#1112 G5)', () => {
    get().startTravel('r1', 'mer', { cadence: 'commande' });
    const day = get().pendingRest!.travelDay!;
    const crewLines = day.entries!.filter((e) => (e.id ?? '').startsWith('sea-progression'));
    expect(crewLines.length).toBeGreaterThan(0);
    const skillLabels = new Set(SKILLS.map((s) => s.label));
    const roleLabels = new Set(CREW_ROLES.map((r) => r.label));
    for (const e of crewLines) {
      // Z5 : le libellé de la LIGNE est une Compétence du catalogue — jamais un libellé de rôle.
      expect(skillLabels.has(e.d!.label.replace(/ \(.*\)$/, ''))).toBe(true);
      expect(roleLabels.has(e.d!.label)).toBe(false);
      // La Difficulté posée à la construction de l'étape voyage jusqu'à la ligne.
      expect(e.d!.difficulty).toBe('intermediaire');
      // Le RÔLE tenu est la provenance (libellé d'entrée), et la rubrique groupe les contributeurs.
      expect(roleLabels.has((e.label ?? '').replace(' ★', ''))).toBe(true);
      expect(e.group).toBeTruthy();
    }
    expect(new Set(crewLines.map((e) => e.group)).size).toBe(1); // un seul Test → une seule rubrique
  });

  it('aucun jet silencieux : chaque Test de routine du jour a au moins une ligne au PV (lignes ≥ jets)', () => {
    get().startTravel('r1', 'mer', { cadence: 'commande' });
    const day = get().pendingRest!.travelDay!;
    // Un RÉSUMÉ DR par Test (ligne « … : DR … → succès/échec ») au journal du jour, + les entrées.
    const drLines = day.lines.filter((l) => /DR .* → (succès|échec)/.test(l.text)).length;
    const kinds = new Set(day.entries!.map((e) => (e.id ?? '').split('-')[1]));
    expect(drLines).toBeGreaterThanOrEqual(kinds.size); // au moins une trace par nature de Test joué
  });

  /**
   * #1291 — UNE surface par dé. Le PV structuré du jour montre déjà, rangée par rangée, le dé de chaque
   * contributeur d'une BANDE : le journal ne le redit plus (le pilote déclare `rowSurface: 'pv'`). Les
   * étapes MONO du MÊME tableau (Forcer le rythme) n'ont AUCUNE rangée au PV — leur ligne de dé reste au
   * journal, sinon le jet deviendrait silencieux (aucun dé perdu : chaque jet sur EXACTEMENT une surface).
   */
  it('bande à surface PV : son dé est AU PV et PLUS au journal ; le MONO du même tableau garde SA ligne', () => {
    // Rythme FORCÉ à +1 M (MDG 13 l.95-107 : à la voile, seul +1 est jouable) → un mono `sea-force-pace`
    // rejoint le tableau du jour, aux côtés des bandes Progression/Orientation.
    get().startTravel('r1', 'mer', { cadence: 'commande', seaPace: 1 });
    const day = get().pendingRest!.travelDay!;
    const journal = get().journal;
    const rows = (day.entries ?? []).filter((e) => e.d);
    expect(rows.length).toBeGreaterThan(0);
    for (const e of rows) {
      const de = `${e.d!.roll}/${e.d!.target}`;
      expect(journal.filter((l) => l.includes(de)), `dé de bande RE-dit au journal (${e.id} — ${de}) :\n${journal.join('\n')}`).toEqual([]);
    }
    // Forcer le rythme (MDG 13 l.95-107) : étape MONO du tableau auto-résolu — le journal EST sa seule surface.
    const monos = journal.filter((l) => /^.+ — (Voile|Ramer) : \d+\/\d+ → (réussi|échec) \(DR [+-]\d+\)\.$/.test(l));
    expect(monos.length, `ligne de dé du MONO attendue au journal :\n${journal.join('\n')}`).toBe(1);
  });
});

describe('traversée JOUR-PAR-JOUR (mer) — cadence manuelle inchangée', () => {
  beforeEach(freshSea);

  it('chaque Test de Navigation ouvre sa cascade (pendingCascade), rien n’est auto-résolu', () => {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const p = get().pendingCascade;
    expect(p?.purpose).toBe('travelDay');
    expect(get().travelPlan!.sea!.entries ?? []).toHaveLength(0); // pas de PV auto en cadence manuelle
  });

  it('l’API sans cadence explicite reste JOUR-PAR-JOUR (rétro-compat)', () => {
    get().startTravel('r1', 'mer');
    expect(get().pendingCascade?.purpose).toBe('travelDay');
  });
});

describe('interruptions (mer) — la route commandée NE muselle PAS les crises', () => {
  beforeEach(freshSea);

  it('une Poursuite en cours force la cascade INTERACTIVE même en route COMMANDÉE (jamais auto-résolue)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'commande' })!;
    plan.sea!.crisis = { kind: 'poursuite', label: 'Nef corsaire', distance: 5, escapeAt: 100, foeM: 5, foeSkill: 50, desc: 'x' };
    set({ travelPlan: plan } as never);
    runSeaDay(get, set);
    // Une crise en cours bascule la journée ENTIÈRE en cascade interactive (`seaDayAllRoutine`,
    // #275 Ronde 2 cran 3) — décision requise → PAS le PV silencieux.
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('travelDay');
  });
});

// ── FLUVIAL (#91) : la journée de descente de ROUTINE s’auto-résout SANS modale par jet ───────────────

function riverSkill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const ex = c.skills.find((s) => s.id === skillId && (s.spec ?? null) === (spec ?? null));
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, spec, advances } as SkillInstance);
}

function riverCrew(): Combatant[] {
  const gunnar = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Gunnar', motivation: 'x', seed: 11, id: 'r-gunnar' });
  riverSkill(gunnar, 'ramer', 50);
  riverSkill(gunnar, 'voile', 45);
  riverSkill(gunnar, 'metier', 40, 'Construction de bateaux');
  return [gunnar];
}

const quai = (id: string, label: string) => buildScene({ id, label, desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

function riverMap(km: number): WorldMap {
  return {
    id: 'm', label: 'Le Reik',
    places: [
      { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'quai-a' },
      { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: 'quai-b' },
    ],
    routes: [{ id: 'r-reik', a: 'A', b: 'B', km, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0 }],
  };
}

describe('descente FLUVIALE COMMANDÉE (#91) — routine sans modale par jet', () => {
  beforeEach(() => {
    seedBattleRng(7);
    const g = get();
    g.setParty(riverCrew());
    g.loadProject([quai('quai-a', 'Grünburg'), quai('quai-b', 'Altdorf')], 'quai-a', riverMap(45));
    set({ money: { gold: 500, silver: 0, brass: 0 }, travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [], net: { ...get().net, mode: 'local' } } as never);
  });

  it('une journée de routine s’auto-résout d’un bloc (aucun pendingCascade) et enchaîne la halte', () => {
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0], { cadence: 'commande' })!;
    expect(plan.orders!.cadence).toBe('commande');
    set({ travelPlan: plan } as never);
    runRiverDays(get, set);
    expect(get().pendingCascade).toBeNull(); // #91 : plus de modale par jet en route commandée
    expect(get().pendingRest).toBeTruthy(); // la journée s’est jouée puis la halte de nuit s’ouvre
    expect(get().journal.some((l) => /Progression du jour/.test(l))).toBe(true); // trace du jour au PV
  });

  it('en JOUR-PAR-JOUR la même journée ouvre la cascade influençable (comportement historique)', () => {
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: plan } as never);
    runRiverDays(get, set);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('travelDay');
  });

  it('#351 : un péril-à-choix (Barrage) injecté en cadence COMMANDÉE bascule le jour en INTERACTIF (pas de résolution silencieuse)', () => {
    const routeWithPeril = { ...get().worldMap!.routes[0], riverPerils: [{ perilId: 'barrage', chancePct: 100 }] };
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', routeWithPeril, { cadence: 'commande' })!;
    set({ travelPlan: plan, worldMap: { ...get().worldMap!, routes: [routeWithPeril] } } as never);
    runRiverDays(get, set);
    // Le jour n'est PLUS de pure routine (route.riverPerils non vide) : la cascade s'ouvre et ATTEND,
    // au lieu de se dérouler d'un bloc (aucun jet/choix silencieux).
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('travelDay');
  });
});

/**
 * UNE seule définition du défaut de cadence. `DEFAULT_VOYAGE_ORDERS` est la SOURCE : les deux
 * constructeurs de plan et la bascule du store la consomment — un plan bâti sans cadence explicite
 * porte donc exactement ces ordres, quel que soit le mode de voyage.
 */
describe('DEFAULT_VOYAGE_ORDERS — source unique du défaut de cadence (mer ⇄ fleuve ⇄ store)', () => {
  beforeEach(() => {
    seedBattleRng(7);
    const g = get();
    g.setParty(riverCrew());
    g.loadProject([quai('quai-a', 'Grünburg'), quai('quai-b', 'Altdorf')], 'quai-a', riverMap(45));
    set({ money: { gold: 500, silver: 0, brass: 0 }, travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [], net: { ...get().net, mode: 'local' } } as never);
  });

  it('buildRiverPlan sans cadence → DEFAULT_VOYAGE_ORDERS (aucun littéral en dur)', () => {
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])!;
    expect(plan.orders).toEqual(DEFAULT_VOYAGE_ORDERS);
  });

  it('setVoyageCadence rebâtit les ordres depuis DEFAULT_VOYAGE_ORDERS quand le plan n’en portait pas', () => {
    const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])!;
    set({ travelPlan: { ...plan, orders: undefined } } as never);
    get().setVoyageCadence('commande');
    expect(get().travelPlan!.orders).toEqual({ ...DEFAULT_VOYAGE_ORDERS, cadence: 'commande' });
  });
});

/**
 * #1117 G1 — DURCISSEMENT Z5 des rangées d'équipage : le producteur ne fournit plus de libellé de
 * ligne, il fournit la PAIRE `{skillId, spec}` (+ le rôle en id, provenance). Le libellé se DÉRIVE au
 * fabricant par le résolveur canonique — « Voile (Chaland) », jamais « Timonier ».
 */
describe('rangées d’équipage — le libellé de ligne est DÉRIVÉ de {skillId, spec} (#1117 G1)', () => {
  beforeEach(freshSea);

  it('chaque contributeur porte sa paire Compétence + son rôle en ID (provenance)', () => {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    let guard = 0;
    while (guard++ < 30 && get().pendingCascade) {
      const p = get().pendingCascade!;
      const cur = p.participants[p.cursor];
      if (cur?.participants?.length) {
        for (const part of cur.participants) {
          expect(part.skillId, 'la Compétence lancée est une DONNÉE (id), pas un texte').toBeTruthy();
          expect(part.roleId, 'le rôle tenu voyage en id — provenance').toBeTruthy();
          // Le libellé RENDU vient du catalogue, spécialisation comprise.
          const attendu = refLabel('skills', { id: part.skillId!, spec: part.spec });
          expect(attendu.length).toBeGreaterThan(0);
          expect(CREW_ROLES.some((r) => r.label === attendu), 'jamais un libellé de RÔLE').toBe(false);
        }
        return;
      }
      const c = p.participants[p.cursor];
      if (c && c.target != null && !c.result) get().cascadeRoll(c.id);
      else get().cascadeNext();
    }
  });
});
