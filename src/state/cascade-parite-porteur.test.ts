import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { startCascade, pushStep, registerTableStep, registerCascadeApplier, suspendActiveCascade, resumeSuspendedCascade, stepInteraction, stepReady } from './cascade';
import { tableStep, displayStep, resolveSurface, surfaceOf, type RollRequest } from './rollSeam';
import { stepForcedDie } from '../ui/forcedDieRow';
import { actorIn } from './combatants';
import { WORLD_STEP_OWNER, MJ_STEP_OWNER, canFixDie, seatInfluences } from './netOwnership';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureText } from '../i18n/fixtureText';
import { makePregens } from '../data/pregens';
import { seedBattleRng, battleRng } from './battleRng';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { setCadence, resetCadence, type Cadence } from '../engine/cadence';
import type { CascadeStep } from './pendings';

/**
 * GARDE DE PARITÉ DE PORTEUR (#1426) — le pilote de cascade traite une table de MONDE exactement
 * comme la table d'un HÉROS.
 *
 * L'invariant : la surface d'une étape se décide au SOCLE, sur le prédicat de surface des jets
 * (`rollSeam.surfaceOf`), jamais sur l'identité de son porteur. Une branche « spéciale monde » (ou
 * « spéciale héros ») rouvrirait la classe de défauts #1426 : un dé qu'un siège possède et ne voit
 * jamais, ou une séquence qui bloque sur une table que personne ne joue.
 *
 * Ce que le cas MESURE, sans rien coder en dur : pour chaque politique (option de pose éteinte,
 * option active, cadence déférée à un automate) et chaque PORTE du curseur (ouverture, append,
 * reprise d'une séquence parquée), on observe le pilote — interaction sous le curseur, étape prête
 * ou non, table tirée ou non, effet de « Suivant », dés consommés — pour la MÊME déclaration d'étape
 * montée deux fois : une fois portée par un héros du groupe, une fois par le monde. L'assertion est
 * l'ÉGALITÉ des deux séries : elle rougit quelle que soit la branche qu'un auteur ajouterait, et
 * quel que soit le sens de la divergence.
 */

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const TABLE = 'table-parite-porteur';
registerTableStep(TABLE, {
  label: fixtureText('Table de parité'),
  die: 100,
  rows: [{ id: 'basse', min: 1, max: 50 }, { id: 'haute', min: 51, max: 100 }],
  lines: () => ['ligne de parité'],
});
/** Applier muet : l'étape a un dénouement (elle est FRANCHISSABLE), sans conséquence à observer. */
registerCascadeApplier('parite-table', () => undefined);
registerCascadeApplier('parite-suspend', (g, s) => { suspendActiveCascade(g, s); });

/** `'mj'` (#2164) : le porteur DÉCLARÉ du dé que le RAW fait lancer par le MJ — se mesure SOUS un
 *  siège MJ (`siegeMJ`), où sa conduite doit être celle du monde. */
type Porteur = 'heros' | 'monde' | 'mj';

/** Siège MJ posé par le montage — `undefined` : aucun (mode solo sans rôle MJ). */
let siegeMJ: number | undefined;

/** LA MÊME déclaration d'étape, montée pour l'un ou l'autre porteur — seule la possession change. */
function etapeTable(porteur: Porteur, heroId: string, id = 'parite-1'): CascadeStep {
  const commun = {
    id, kind: 'parite-table', label: fixtureText('Table de parité'),
    table: { tableId: TABLE, spec: { n: 1, sides: 100 } },
    stake: { key: { dataset: 'combat' as const, kind: 'mutation' } },
  };
  if (porteur === 'heros') return tableStep({ ...commun, actorId: heroId })!;
  return tableStep({ ...commun, worldOwner: true, ...(porteur === 'mj' ? { porteur: MJ_STEP_OWNER } : {}) })!;
}

const etapeMuette = (porteur: Porteur, heroId: string, id: string, kind = 'parite-affichage'): CascadeStep =>
  porteur === 'heros'
    ? displayStep({ id, kind, label: fixtureText('Muette'), actorId: heroId })
    : displayStep({ id, kind, label: fixtureText('Muette'), worldOwner: true });

/** Compte les tirages du RNG PARTAGÉ à partir de maintenant (le FLUX, pas les valeurs). */
function traceDesTirages(): number[] {
  const rng = battleRng() as { int: (min: number, max: number) => number };
  const brut = rng.int.bind(rng);
  const trace: number[] = [];
  rng.int = (min, max) => { const v = brut(min, max); trace.push(v); return v; };
  return trace;
}

interface Observation {
  interaction: string;
  prete: boolean;
  tiree: boolean;
  /** L'affordance de POSE offerte sous le curseur (`forcedDieRow.stepForcedDie`, gate `canFixDie`)
   *  — sans elle, « option de pose ÉTEINTE » et « ACTIVE » rendraient le MÊME vecteur et l'égalité
   *  monde⇄héros ne dirait rien de la pose. */
  pose: boolean;
  curseurAvant: number | null;
  curseurApres: number | null;
  desConsommes: number;
}

/** Groupe d'UN héros, siège local, mode solo — l'état complet du cas, jamais hérité du voisin. */
function montage(): string {
  const h = makePregens()[0];
  set({ party: [h], battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
  set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: siegeMJ } });
  return h.id;
}

const curseur = (): number | null => get().pendingCascade?.cursor ?? null;

/** OUVERTURE (`startCascade`) : le curseur se pose sur la table. */
function observeOuverture(porteur: Porteur): Observation {
  seedBattleRng(17);
  const heroId = montage();
  const trace = traceDesTirages();
  startCascade(get, set, { title: 'Parité', purpose: 'test', steps: [etapeTable(porteur, heroId)] });
  return mesure(trace);
}

/** APPEND (`pushStep`) : l'étape atterrit SOUS le curseur d'une séquence fraîche. */
function observeAppend(porteur: Porteur): Observation {
  seedBattleRng(17);
  const heroId = montage();
  const trace = traceDesTirages();
  pushStep(set, etapeTable(porteur, heroId), 'test');
  return mesure(trace);
}

/** REPRISE : l'applier de la 1ʳᵉ étape SUSPEND la séquence ; elle revient SUR la table. */
function observeReprise(porteur: Porteur): Observation {
  seedBattleRng(17);
  const heroId = montage();
  const trace = traceDesTirages();
  startCascade(get, set, {
    title: 'Parité', purpose: 'test',
    steps: [etapeMuette(porteur, heroId, 'parite-sus', 'parite-suspend'), etapeTable(porteur, heroId)],
  });
  get().cascadeNext();               // l'applier suspend en plein vol
  if (get().pendingCascade) suspendActiveCascade(get, set); // (le store peut déjà l'avoir reprise)
  resumeSuspendedCascade(get, set);
  return mesure(trace);
}

/** Observation COMMUNE : ce que le pilote offre sous le curseur, et ce que « Suivant » en fait. */
function mesure(trace: number[]): Observation {
  const p = get().pendingCascade;
  const st = p ? p.participants[p.cursor] : undefined;
  const avant = curseur();
  const pose = !!st && !!stepForcedDie(get(), st, () => {}).forcedRoll;
  get().cascadeNext();
  const obs: Observation = {
    interaction: st ? stepInteraction(st) : 'aucune',
    prete: !!st && stepReady(st),
    tiree: !!st?.table?.result,
    pose,
    curseurAvant: avant,
    curseurApres: curseur(),
    desConsommes: trace.length,
  };
  set({ pendingCascade: null, suspendedCascades: [] });
  return obs;
}

/** Le CORPS d'une fonction nommée par sa signature — de son `{` au premier `}` en colonne 0. */
function corpsDe(fichierRelatif: string, signature: string): string {
  const src = readFileSync(join(process.cwd(), fichierRelatif), 'utf8');
  const debut = src.indexOf(signature);
  expect(debut, `${signature} existe dans ${fichierRelatif}`).toBeGreaterThan(0);
  return src.slice(src.indexOf('{', debut), src.indexOf('\n}', debut));
}

const PORTES = { ouverture: observeOuverture, append: observeAppend, reprise: observeReprise } as const;
const POLITIQUES: { nom: string; pose: boolean; cadence: Cadence }[] = [
  { nom: 'option de pose ÉTEINTE', pose: false, cadence: 'manuel' },
  { nom: 'option de pose ACTIVE', pose: true, cadence: 'manuel' },
  { nom: 'cadence déférée à un automate', pose: false, cadence: 'rapide' },
];

describe('#1426 — parité de PORTEUR : le pilote de cascade ne connaît pas « le monde »', () => {
  beforeEach(() => { resetDesFixes(); resetCadence(); });
  afterEach(() => { siegeMJ = undefined; resetDesFixes(); resetCadence(); set({ pendingCascade: null, suspendedCascades: [] }); });

  for (const pol of POLITIQUES) {
    for (const [nomPorte, porte] of Object.entries(PORTES)) {
      it(`${pol.nom} — porte « ${nomPorte} » : sous siège MJ, le porteur MJ a LA conduite du monde (#2164)`, () => {
        setDesFixes(pol.pose);
        setCadence(pol.cadence);
        siegeMJ = 0;
        const monde = porte('monde');
        const mj = porte('mj');
        expect(mj, `porte « ${nomPorte} » : une conduite qui diverge pour le porteur MJ est une branche « spéciale MJ »`).toEqual(monde);
      });
    }
  }

  for (const pol of POLITIQUES) {
    for (const [nomPorte, porte] of Object.entries(PORTES)) {
      it(`${pol.nom} — porte « ${nomPorte} » : monde et héros donnent LA MÊME conduite`, () => {
        setDesFixes(pol.pose);
        setCadence(pol.cadence);
        const heros = porte('heros');
        const monde = porte('monde');
        expect(monde, `porte « ${nomPorte} » : une conduite qui diverge par le PORTEUR est une branche « spéciale monde »`).toEqual(heros);
      });
    }
  }

  /**
   * GARDE STRUCTURELLE — le pilote ne NOMME pas le porteur. Les deux conduites mesurées plus haut
   * coïncident tant qu'un seul siège joue : une branche « si l'étape n'a pas d'acteur, alors … »
   * rendrait donc les mêmes vecteurs tout en RÉTABLISSANT deux tables de vérité, libres de diverger
   * au premier ajout (un porteur, une cadence, un siège). Ce qui se verrouille ici est donc la FORME :
   * `tirageSansSiege` délègue au prédicat commun pour TOUT porteur, sans tester l'identité de l'étape.
   */
  it('FORME — `cascade.tirageSansSiege` délègue à `surfaceOf(porteurResolu(st))`, sans brancher sur le porteur', () => {
    const corps = corpsDe(join('src', 'state', 'cascade.ts'), 'function tirageSansSiege');
    expect(corps, 'le porteur se dérive (`pendings.porteurResolu`), il ne se teste pas').toContain('surfaceOf(get, porteurResolu(st))');
    expect(corps, 'une branche par TYPE de porteur rouvre les deux tables de vérité de #1426').not.toMatch(/actorId|worldOwner/);
  });

  /**
   * MÊME FORME sur les DEUX fonctions que `tirageSansSiege` compose : `porteurResolu` (l'id du porteur) et
   * `surfaceOf` (la surface de cet id). Elles ont le droit de RÉSOUDRE un id (`st.actorId ??
   * WORLD_STEP_OWNER`) — c'est leur métier ; elles n'ont pas le droit de le COMPARER : un
   * `porteurId === WORLD_STEP_OWNER` dans `surfaceOf` remet la résolution du siège du monde hors du
   * module de possession (`netOwnership`), et rouvre deux tables de vérité.
   */
  it('FORME — `porteurResolu` et `rollSeam.surfaceOf` RÉSOLVENT un id, ils ne le COMPARENT pas', () => {
    const cas = [
      { corps: corpsDe(join('src', 'state', 'pendings.ts'), 'function porteurResolu'), nom: 'pendings.porteurResolu' },
      { corps: corpsDe(join('src', 'state', 'rollSeam.ts'), 'export function surfaceOf'), nom: 'rollSeam.surfaceOf' },
    ];
    for (const { corps, nom } of cas) {
      expect(corps, `${nom} : un marqueur de TYPE de porteur y est une branche par type`).not.toMatch(/worldOwner/);
      expect(corps, `${nom} : comparer le porteur, c'est le brancher par type`)
        .not.toMatch(/(WORLD_STEP_OWNER|MJ_STEP_OWNER|actorId|porteurId)\s*[=!]==?|[=!]==?\s*(WORLD_STEP_OWNER|MJ_STEP_OWNER|actorId|porteurId)/);
    }
  });

  it('CONTRÔLE POSITIF — les trois politiques rendent TROIS conduites DISTINCTES (la sonde discrimine)', () => {
    const conduites = POLITIQUES.map((pol) => {
      setDesFixes(pol.pose);
      setCadence(pol.cadence);
      return observeOuverture('monde');
    });
    // Sans cet écart, l'égalité monde⇄héros ci-dessus ne prouverait rien : trois politiques qui
    // rendraient le même vecteur rendraient l'assertion vraie quoi qu'on code.
    const vus = conduites.map((c) => JSON.stringify(c));
    expect(new Set(vus).size, 'chaque politique a SA conduite (pose OFF ≠ pose ON ≠ cadence déférée)').toBe(3);
    expect(conduites[2].tiree, 'cadence déférée : le socle a tiré').toBe(true);
    expect(conduites[0].tiree, 'cadence manuelle : la fenêtre lance').toBe(false);
    expect(conduites[0].pose, 'option de pose éteinte : rien à poser').toBe(false);
    expect(conduites[1].pose, 'option de pose active + siège possesseur : la pose est offerte').toBe(true);
    expect(conduites[0].curseurApres, 'et « Suivant » ne franchit pas une table non tirée').toBe(0);
  });

  /**
   * PARITÉ DU MONO — la porte des jets (`resolveSurface`) est l'AUTRE porte du même invariant : un jet
   * de MONDE et un jet de HÉROS y traversent le même prédicat de surface (`surfaceOf`, keyé par le
   * porteur). Même montage, mêmes politiques, même série attendue.
   */
  it('MONO — `resolveSurface` rend la MÊME série pour un porteur MONDE et un porteur HÉROS', () => {
    const heroId = montage();
    const requetes: Record<Porteur, () => RollRequest> = {
      heros: () => ({ side: { actorId: heroId }, actionLabel: 'Jet', test: {}, difficulty: 'intermediaire' }),
      monde: () => ({ side: { worldSide: 'world' }, actionLabel: 'Jet', test: {}, difficulty: 'intermediaire' }),
      mj: () => ({ side: { worldSide: 'world' }, actionLabel: 'Jet', test: {}, difficulty: 'intermediaire', porteur: MJ_STEP_OWNER }),
    };
    const serie = (porteur: Porteur) => POLITIQUES.map((pol) => {
      setDesFixes(pol.pose);
      setCadence(pol.cadence);
      return { surface: resolveSurface(get, requetes[porteur](), 'parite'), pose: canFixDie(get(), porteur === 'heros' ? heroId : WORLD_STEP_OWNER) };
    });
    const monde = serie('monde');
    const heros = serie('heros');
    expect(monde, 'une surface qui diverge par le PORTEUR est une branche « spéciale monde »').toEqual(heros);
    expect(monde.map((x) => x.surface), 'et la série discrimine la cadence').toEqual(['M', 'M', 'I']);
    expect(monde.map((x) => x.pose), 'comme elle discrimine l’option de pose').toEqual([false, true, false]);
  });

  it('MONO — sous siège MJ, `resolveSurface`/`canFixDie` rendent la MÊME série pour le porteur MJ et le MONDE (#2164)', () => {
    siegeMJ = 0;
    montage();
    const requetes = {
      monde: (): RollRequest => ({ side: { worldSide: 'world' }, actionLabel: 'Jet', test: {}, difficulty: 'intermediaire' }),
      mj: (): RollRequest => ({ side: { worldSide: 'world' }, actionLabel: 'Jet', test: {}, difficulty: 'intermediaire', porteur: MJ_STEP_OWNER }),
    };
    const serie = (porteur: 'monde' | 'mj') => POLITIQUES.map((pol) => {
      setDesFixes(pol.pose);
      setCadence(pol.cadence);
      return { surface: resolveSurface(get, requetes[porteur](), 'parite'), pose: canFixDie(get(), porteur === 'mj' ? MJ_STEP_OWNER : WORLD_STEP_OWNER) };
    });
    const monde = serie('monde');
    expect(serie('mj'), 'une surface qui diverge pour le porteur MJ est une branche « spéciale MJ »').toEqual(monde);
    expect(monde.map((x) => x.surface), 'la série discrimine la cadence (V : le siège MJ voit et lance)').toEqual(['V', 'V', 'I']);
    expect(monde.map((x) => x.pose), 'et l’option de pose').toEqual([false, true, false]);
  });

  /**
   * PARITÉ SUR L'AXE « CADENCE DE VOYAGE » — la route COMMANDÉE auto-résout les Tests de ROUTINE
   * (`voyageCadence.seaAutoResolves`, liste fermée `SEA_KINDS_SOUS_ORDRES`). C'est une politique du JET,
   * pas une propriété du porteur : un dé de MONDE d'un `kind` de routine se tait comme celui d'un
   * héros, et un `kind` HORS routine garde sa fenêtre des deux côtés. Un côté monde qui ignorerait
   * `autoV` ouvrirait une fenêtre par jour de traversal commandée là où le héros se tait — la branche
   * jumelle #1426, mesurée sur l'axe que la série ci-dessus ne parcourt pas.
   */
  it('MONO/CADENCE DE VOYAGE — `autoV` (route commandée × kind de routine) traite le MONDE comme un HÉROS', () => {
    const heroId = montage();
    set({ travelPlan: { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'sea', hoursPerDay: 8, km: 0, kmDone: 0, interrupted: false, orders: { cadence: 'commande' } } as never });
    const requetes: Record<Porteur, () => RollRequest> = {
      heros: () => ({ side: { actorId: heroId }, actionLabel: 'Jet', test: {}, difficulty: 'intermediaire' }),
      monde: () => ({ side: { worldSide: 'world' }, actionLabel: 'Jet', test: {}, difficulty: 'intermediaire' }),
      mj: () => ({ side: { worldSide: 'world' }, actionLabel: 'Jet', test: {}, difficulty: 'intermediaire', porteur: MJ_STEP_OWNER }),
    };
    // `progression` ∈ SEA_KINDS_SOUS_ORDRES ; `tourbillon` n'y est pas (une CRISE interrompt toujours).
    const serie = (porteur: Porteur) => ['progression', 'tourbillon'].map((kind) => resolveSurface(get, requetes[porteur](), kind));
    const monde = serie('monde');
    expect(monde, 'une surface qui diverge par le PORTEUR est une branche « spéciale monde »').toEqual(serie('heros'));
    expect(monde, 'et la série discrimine la routine de voyage').toEqual(['I', 'M']);
    set({ travelPlan: null });
  });

  /**
   * PARITÉ « EN COMBAT » / « HORS FILE » (#1426) — la possession d'un dé ne connaît pas la frontière du
   * combat : `net.ownership` est keyée par id. Un héros du GROUPE resté hors de la file d'un combat
   * ouvert (allié en réserve, héros non engagé) reste tenu par son siège — donc son dé se VOIT
   * (`surfaceOf`), s'INFLUENCE (`seatInfluences`) et se POSE (`canFixDie`). Une résolution « file de
   * combat OU groupe » (`actorIn`) ne le trouve pas et rendrait NON aux trois : le siège possède un
   * porteur sur lequel il n'a plus aucune prise.
   */
  it('POSSESSION — héros du groupe HORS de la file d’un combat ouvert : vu, influençable, posable', () => {
    const [h1, h2] = makePregens();
    set({ party: [h1!, h2!], battle: null, pendingCascade: null, suspendedCascades: [] });
    set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
    set({ battle: { combatants: [h1!], order: [h1!.id], turn: 0, round: 1, log: [], over: null } as never });
    setDesFixes(true);
    expect(actorIn(get(), h2!.id), 'précondition : la recherche « file OU groupe » ne le trouve pas').toBeUndefined();
    expect(surfaceOf(get, h2!.id), 'son siège le tient : son dé se VOIT').toBe(true);
    expect(seatInfluences(get(), 0, h2!.id), 'et s’INFLUENCE').toBe(true);
    expect(canFixDie(get(), h2!.id), 'et se POSE (option active)').toBe(true);
    // CONTRÔLE : le même siège n'a aucune prise sur un porteur qui n'existe nulle part.
    expect(seatInfluences(get(), 0, 'porteur-fantome')).toBe(false);
    set({ battle: null });
  });
});
