import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { startCascade, pushStep, suspendActiveCascade, resumeSuspendedCascade, stepInteraction, stepReady } from '../noyau/cascade';
import { tableStep, displayStep } from '../noyau/rollSeam';
import { stepForcedDie } from '../ui/forcedDieRow';
import { fixtureText } from '../i18n/fixtureText';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { seedBattleRng, battleRng } from '../noyau/battleRng';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { setCadence, resetCadence, type Cadence } from '../engine/cadence';
import type { CascadeStep } from '../noyau/pendings';
import { avecLesTables, type FixtureDeTables, cleDeFixture } from '../noyau/noyau.testkit';
import type { GenreDeCascade } from '../noyau/tablesPosees';
import { deDeLaTableTiree } from '../engine/tables';

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
 * quel que soit le sens de la divergence. La pose sous le curseur se lit à l'affordance de l'écran
 * (`ui/forcedDieRow.stepForcedDie`, liée au store) ; la FORME du pilote et la surface des jets ouverts seuls se jouent au
 * banc du noyau (`src/noyau/cascade-parite-porteur.hors-store.test.ts`).
 */

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const TABLE = 'table-parite-porteur';
/** La table et les genres SYNTHÉTIQUES de la suite, posés par `avecLesTables`. */
const FIXTURE: FixtureDeTables = {
  tablesTirables: {
    [TABLE]: {
      label: fixtureText('Table de parité'),
      die: deDeLaTableTiree({ die: 'd100' }),
      rows: [{ id: 'basse', min: 1, max: 50 }, { id: 'haute', min: 51, max: 100 }],
      lines: () => ['ligne de parité'],
    },
  },
  appliers: {
    /** Applier muet : l'étape a un dénouement (elle est FRANCHISSABLE), sans conséquence à observer. */
    'parite-table': () => undefined,
    'parite-suspend': (g, s) => { suspendActiveCascade(g, s); },
  },
};

type Porteur = 'heros' | 'monde';

/** LA MÊME déclaration d'étape, montée pour l'un ou l'autre porteur — seule la possession change. */
function etapeTable(porteur: Porteur, heroId: string, id = 'parite-1'): CascadeStep {
  const commun = {
    id, kind: cleDeFixture('parite-table'), label: fixtureText('Table de parité'),
    table: { tableId: TABLE },
    stake: { key: { dataset: 'combat' as const, kind: 'mutation' } },
  };
  return (porteur === 'heros' ? tableStep({ ...commun, actorId: heroId }) : tableStep({ ...commun, worldOwner: true }))!;
}

const etapeMuette = (porteur: Porteur, heroId: string, id: string, kind: GenreDeCascade = cleDeFixture('parite-affichage')): CascadeStep =>
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
  const h = tousLesHerosDeScenario(idsDeTest)[0];
  set({ party: [h], battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
  set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
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
    steps: [etapeMuette(porteur, heroId, 'parite-sus', cleDeFixture('parite-suspend')), etapeTable(porteur, heroId)],
  });
  get().jetValider('cascade');               // l'applier suspend en plein vol
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
  get().jetValider('cascade');
  const obs: Observation = {
    interaction: st ? stepInteraction(st) : 'aucune',
    prete: !!st && stepReady(st, useGame.getState()),
    tiree: !!st?.table?.result,
    pose,
    curseurAvant: avant,
    curseurApres: curseur(),
    desConsommes: trace.length,
  };
  set({ pendingCascade: null, suspendedCascades: [] });
  return obs;
}

const PORTES = { ouverture: observeOuverture, append: observeAppend, reprise: observeReprise } as const;
const POLITIQUES: { nom: string; pose: boolean; cadence: Cadence }[] = [
  { nom: 'option de pose ÉTEINTE', pose: false, cadence: 'manuel' },
  { nom: 'option de pose ACTIVE', pose: true, cadence: 'manuel' },
  { nom: 'cadence déférée à un automate', pose: false, cadence: 'rapide' },
];

describe('#1426 — parité de PORTEUR : le pilote de cascade ne connaît pas « le monde »', () => {
  beforeEach(() => { resetDesFixes(); resetCadence(); avecLesTables(FIXTURE); });
  afterEach(() => { resetDesFixes(); resetCadence(); set({ pendingCascade: null, suspendedCascades: [] }); });

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
});
