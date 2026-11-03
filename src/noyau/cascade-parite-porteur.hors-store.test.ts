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
 *
 * Ici, la FORME du pilote et la surface des jets ouverts seuls (`surfaceDeLEtape`, possession) ; la conduite sous le
 * curseur, qui lit l'affordance de pose de l'écran (`ui/forcedDieRow`), se joue en `src/state/cascade-parite-porteur.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { monoStep, worldStep, surfaceDeLEtape, surfaceOf } from './rollSeam';
import { actorIn } from './monde/combatants';
import { canFixDie, seatInfluences } from './netOwnership';
import { WORLD_STEP_OWNER } from './pendings';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureText } from '../i18n/fixtureText';
import { t } from '../i18n';
import { makePregens } from '../data/pregens';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { setCadence, resetCadence, type Cadence } from '../engine/cadence';
import type { CascadeStep } from './pendings';
import { cleDeFixture } from './noyau.testkit';
import type { GenreDEtape } from './tablesPosees';
import type { Ecrit } from './proprietaireDuJeu';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
});

const get = () => banc.getState();
const set = (e: Ecrit) => banc.setState(e);

type Porteur = 'heros' | 'monde';

/** LE jet ouvert SEUL, tel que ses ouvreurs le montent — `openRoll` (`monoStep` du héros) ou
 *  `openWorldTest` (`worldStep`) : seule la possession change. */
function etapeMono(porteur: Porteur, heroId: string, kind: GenreDEtape): CascadeStep {
  const id = `parite-mono-${kind}`;
  const actor = get().party.find((h) => h.id === heroId)!;
  return porteur === 'heros'
    ? monoStep({ id, kind, label: fixtureText('Jet'), difficulty: 'intermediaire', actor, ligne: { valeur: 40 }, stake: { key: { dataset: 'combat', kind: 'mutation' } } })!
    : worldStep({ id, kind, label: fixtureText('Jet'), cible: 40, verdict: { reussite: t('seuil.sousLeSeuil'), echec: t('seuil.auDessus') } });
}

/** La surface d'un jet ouvert seul : la couture de ses ouvreurs (`surfaceDeLEtape`, cf. `ouvrirLEtape`). */
const surfaceMono = (st: CascadeStep) => surfaceDeLEtape(get, st);

/** Groupe d'UN héros, siège local, mode solo — l'état complet du cas, jamais hérité du voisin. */
function montage(): string {
  const h = makePregens()[0];
  set({ party: [h], battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
  set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
  return h.id;
}

/** Le CORPS d'une fonction nommée par sa signature — de son `{` au premier `}` en colonne 0. */
function corpsDe(fichierRelatif: string, signature: string): string {
  const src = readFileSync(join(process.cwd(), fichierRelatif), 'utf8');
  const debut = src.indexOf(signature);
  expect(debut, `${signature} existe dans ${fichierRelatif}`).toBeGreaterThan(0);
  return src.slice(src.indexOf('{', debut), src.indexOf('\n}', debut));
}

const POLITIQUES: { nom: string; pose: boolean; cadence: Cadence }[] = [
  { nom: 'option de pose ÉTEINTE', pose: false, cadence: 'manuel' },
  { nom: 'option de pose ACTIVE', pose: true, cadence: 'manuel' },
  { nom: 'cadence déférée à un automate', pose: false, cadence: 'rapide' },
];

describe('#1426 — parité de PORTEUR : le pilote de cascade ne connaît pas « le monde »', () => {
  beforeEach(() => { resetDesFixes(); resetCadence(); });
  afterEach(() => { resetDesFixes(); resetCadence(); set({ pendingCascade: null, suspendedCascades: [] }); });

  /**
   * GARDE STRUCTURELLE — le pilote ne NOMME pas le porteur. Les deux conduites mesurées plus haut
   * coïncident tant qu'un seul siège joue : une branche « si l'étape n'a pas d'acteur, alors … »
   * rendrait donc les mêmes vecteurs tout en RÉTABLISSANT deux tables de vérité, libres de diverger
   * au premier ajout (un porteur, une cadence, un siège). Ce qui se verrouille ici est donc la FORME :
   * `tirageSansSiege` délègue au prédicat commun pour TOUT porteur, sans tester l'identité de l'étape.
   */
  it('FORME — `cascade.tirageSansSiege` délègue à `surfaceOf(porteurDe(st))`, sans brancher sur le porteur', () => {
    const corps = corpsDe(join('src', 'noyau', 'cascade.ts'), 'function tirageSansSiege');
    expect(corps, 'le porteur se dérive (`porteurDe`), il ne se teste pas').toContain('surfaceOf(get, porteurDe(st))');
    expect(corps, 'une branche par TYPE de porteur rouvre les deux tables de vérité de #1426').not.toMatch(/actorId|worldOwner/);
  });

  /**
   * MÊME FORME sur les DEUX fonctions que `tirageSansSiege` compose : `porteurDe` (l'id du porteur) et
   * `surfaceOf` (la surface de cet id). Elles ont le droit de RÉSOUDRE un id (`st.actorId ??
   * WORLD_STEP_OWNER`) — c'est leur métier ; elles n'ont pas le droit de le COMPARER : un
   * `porteurId === WORLD_STEP_OWNER` dans `surfaceOf` remet la résolution du siège du monde hors du
   * module de possession (`netOwnership`), et rouvre deux tables de vérité.
   */
  it('FORME — `porteurDe` et `rollSeam.surfaceOf` RÉSOLVENT un id, ils ne le COMPARENT pas', () => {
    const cas = [
      { corps: corpsDe(join('src', 'noyau', 'cascade.ts'), 'function porteurDe'), nom: 'cascade.porteurDe' },
      { corps: corpsDe(join('src', 'noyau', 'rollSeam.ts'), 'export function surfaceOf'), nom: 'rollSeam.surfaceOf' },
    ];
    for (const { corps, nom } of cas) {
      expect(corps, `${nom} : un marqueur de TYPE de porteur y est une branche par type`).not.toMatch(/worldOwner/);
      expect(corps, `${nom} : comparer le porteur, c'est le brancher par type`)
        .not.toMatch(/(WORLD_STEP_OWNER|actorId)\s*[=!]==?|[=!]==?\s*(WORLD_STEP_OWNER|actorId)/);
    }
  });

  /**
   * PARITÉ DU MONO — la porte des jets (`surfaceDeLEtape`) est l'AUTRE porte du même invariant : un
   * jet de MONDE (`worldStep`) et un jet de HÉROS (`monoStep`) y traversent le même prédicat de surface (`surfaceOf`,
   * keyé par le porteur). Même montage, mêmes politiques, même série attendue.
   */
  it('MONO — `surfaceDeLEtape` rend la MÊME série pour un porteur MONDE et un porteur HÉROS', () => {
    const heroId = montage();
    const serie = (porteur: Porteur) => POLITIQUES.map((pol) => {
      setDesFixes(pol.pose);
      setCadence(pol.cadence);
      return { surface: surfaceMono(etapeMono(porteur, heroId, cleDeFixture('parite'))), pose: canFixDie(get(), porteur === 'heros' ? heroId : WORLD_STEP_OWNER) };
    });
    const monde = serie('monde');
    const heros = serie('heros');
    expect(monde, 'une surface qui diverge par le PORTEUR est une branche « spéciale monde »').toEqual(heros);
    expect(monde.map((x) => x.surface), 'et la série discrimine la cadence').toEqual(['M', 'M', 'I']);
    expect(monde.map((x) => x.pose), 'comme elle discrimine l’option de pose').toEqual([false, true, false]);
  });

  /**
   * PARITÉ SUR L'AXE « CADENCE DE VOYAGE » — la route COMMANDÉE auto-résout les Tests de ROUTINE
   * (`voyageCadence.resoluSousOrdres`, liste fermée `KINDS_SOUS_ORDRES`). C'est une politique du JET,
   * pas une propriété du porteur : un dé de MONDE d'un `kind` de routine se tait comme celui d'un
   * héros, et un `kind` HORS routine garde sa fenêtre des deux côtés. Un côté monde qui ignorerait
   * `autoV` ouvrirait une fenêtre par jour de traversal commandée là où le héros se tait — la branche
   * jumelle #1426, mesurée sur l'axe que la série ci-dessus ne parcourt pas.
   */
  it('MONO/CADENCE DE VOYAGE — `autoV` (route commandée × kind de routine) traite le MONDE comme un HÉROS', () => {
    const heroId = montage();
    set({ travelPlan: { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'sea', hoursPerDay: 8, km: 0, kmDone: 0, interrupted: false, orders: { cadence: 'commande' } } as never });
    // `progression` ∈ KINDS_SOUS_ORDRES ; `tourbillon` n'y est pas (une CRISE interrompt toujours).
    const serie = (porteur: Porteur) => (['progression', 'tourbillon'] as const).map((kind) => surfaceMono(etapeMono(porteur, heroId, kind)));
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
