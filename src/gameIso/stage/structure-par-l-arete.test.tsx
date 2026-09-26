// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tileEdge, type Dims } from '../../geometry/iso';
import { emptyScene, type Scene } from '../../state/scene';
import { aretesUtilisables } from '../../state/aretes';
import { combatantAtTile } from '../../state/combatGeometry';
import { useGame, type BattleState } from '../../state/store';
import type { Combatant } from '../../engine/types';
import { structureCombatant } from '../../engine/structures';
import { findStructureById } from '../../data';
import { makePregens } from '../../data/pregens';
import type { RoomPortal } from '../../state/roomPortals';
import type { Pt } from '../../state/path';
import { poseFromDims } from './projection';
import { projeterAretes, type AreteProjetee } from './aretesProjetees';
import { resoudrePixel, type CadreDePick, type EtatDePick } from './pickResolve';
import { VH, VW } from './useStageCamera';
import { useStagePointer, type StagePointer } from './useStagePointer';
import { AreteOverlay } from './AreteOverlay';

/**
 * FORTIFICATION D'ARÊTE PAR L'ÉTAGE `arete` (#1687, lot 1b-4 ; AA 10 l.94-102) — la structure abattable
 * ne porte plus son overlay à handlers : elle est une capacité d'arête comme les trois autres, dérivée
 * (`state/aretes.ts`), projetée (`stage/aretesProjetees.ts`), résolue par le pixel
 * (`stage/pickResolve.ts`) et peinte par le peintre unique (`stage/AreteOverlay.tsx`).
 *
 * LE CONTRAT QUE CE BANC TIENT : le geste d'une structure EST le clic de son jeton (la Structure est
 * un Combattant, c44ea0d86) — `battleClickEntity(cid, { confirm: hoverClickCommits() })`, l'aperçu et
 * le commit étant ceux du flux de combat (`state/targetingModes.ts`, `samePreview`) —, et le clic est
 * CONSOMMÉ : rien ne redescend au clic-sol, qui réécrit `preview` à chaque sortie de déplacement
 * (`state/combatSlice.ts:battleClickTile`). L'étage d'arête n'apporte que la GÉOMÉTRIE de prise que le
 * rayon ne rend pas : l'ancrage est la case du MUR, donc la prise se projette à SON lift et le survol
 * tombe sur le jeton visé. Le FRAPPEUR (héros actif) n'ouvre que l'OFFRE : hors de mon tour, rien.
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn() });
// jsdom n'a pas de layout : le hit-test natif de la voie AFFINE (`stage/spritePicker.ts`) n'existe pas.
// On le pose NUL — aucun corps peint sous le pixel —, l'état que la chaîne traite en tombant sur ses
// étages suivants, dont l'arête. En combat, `tireLeRayon` l'interroge à chaque pixel.
Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
// `matches: true` = pointeur FIN (souris), défaut de ce banc. `restoreMocks: true` (vite.config.ts)
// rend le `vi.fn()` nu entre deux tests.
beforeEach(() => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as unknown as MediaQueryList);
});

const dims: Dims = { w: 5, h: 4, rot: 0, view: 'iso' };
const CID = 'structure-1-1-E-0';
const VU = ['1,1,0', '2,1,0'];
/** La case du MUR : ce que le geste vise, donc l'ancrage de l'arête (`Combatant.pos` de la Structure,
 *  `state/combatSlice.ts`). */
const MUR: Pt = { x: 1, y: 1, z: 0 };
/** Le FRAPPEUR : le héros actif, LOIN du mur — on pilonne à distance, et sa case n'entre dans aucune
 *  géométrie du geste. */
const FRAPPEUR: Pt = { x: 0, y: 3, z: 0 };

/** Scène 5×4 : une fortification d'arête en (1,1,E) — la scène du banc 1b-0. */
function scèneFortifiée(): Scene {
  const s = emptyScene(5, 4);
  s.walls = [{ x: 1, y: 1, side: 'E', structure: 'mur-a-ossature-en-bois' }];
  return s;
}

// Le mur EN COMBATTANT, à sa case (`state/combatSlice.ts` : `c.pos = { x: w.x, y: w.y }`) — c'est lui
// que le réticule de visée trouve sous le survol de l'arête. MÊME fabrique que l'enrôlement réel
// (`engine/structures.ts:structureCombatant`) : le geste passe par la porte partagée
// (`state/combatOrParty.ts:combatantClickActs`), qui dérive l'affordance d'ATTAQUE — une coquille
// sans Traits ni Blessures de la donnée mentirait sur ce que le clic fait.
const mur = (() => {
  const c = structureCombatant(findStructureById('mur-a-ossature-en-bois')!, CID);
  c.pos = { x: MUR.x, y: MUR.y };
  c.structureEdge = { x: 1, y: 1, side: 'E', z: 0 };
  return c;
})();
/** Le frappeur est un HÉROS RÉEL (pregen) : ses armes et ses Compétences sont ce que la porte lit. */
const heros = (() => {
  const h = makePregens()[0];
  h.id = 'h1';
  h.pos = { x: FRAPPEUR.x, y: FRAPPEUR.y };
  return h;
})();
/** La file de combat telle que le store la pose (`state/combatSlice.ts`) — la porte partagée dérive
 *  l'affordance d'attaque du MODE courant, qui lit `action`/`acted`/`movementUsed`/`reachable`. */
const bataille = (combatants: Combatant[], preview: unknown = null): BattleState =>
  ({
    combatants, order: ['h1'], baseOrder: ['h1'], turn: 0, round: 1,
    action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, preview,
  } as unknown as BattleState);

/** L'offre de l'hôte pour cette scène : le dériveur puis la projection, comme `MondeDeCampagne`. */
const offre = (
  battle: BattleState | null,
  controleur: Pt | null = FRAPPEUR,
  scene: Scene = scèneFortifiée(),
  portails: readonly RoomPortal[] = [],
  lift: (p: Pt) => number = () => 0,
): readonly AreteProjetee[] => projeterAretes(
  aretesUtilisables({ scene, visible: new Set(VU), controleur, activeZ: 0, battle, portails }),
  dims,
  lift,
);

const milieuPt = (a: AreteProjetee) => ({ x: (a.a.cx + a.b.cx) / 2, y: (a.a.cy + a.b.cy) / 2 });

function stageEl(): SVGSVGElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }) as DOMRect,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  } as unknown as SVGSVGElement;
}

function pointerEvent(x: number, y: number) {
  return {
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: { style: {} },
  } as unknown as React.PointerEvent;
}

const CLICK_ENTITY_VRAI = useGame.getState().battleClickEntity;
const CLICK_TILE_VRAI = useGame.getState().battleClickTile;
const BATTLE_VRAI = useGame.getState().battle;
const MODE_VRAI = useGame.getState().mode;
const SCENE_VRAIE = useGame.getState().scene;
const SET_INSPECT_VRAI = useGame.getState().setInspectId;

describe('Frapper une enceinte, c’est cliquer son jeton — l’arête n’en donne que la prise', () => {
  let root: Root | null = null;
  let pointer: StagePointer | undefined;

  const monter = (aretes: readonly AreteProjetee[], hoverTracking = false) => {
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({ svgRef, dims, zoom: 1, camRef, hoverTracking, partyLeader: undefined, activeZ: 0, aretes });
      return null;
    };
    root = createRoot(document.createElement('div'));
    act(() => root!.render(<Probe />));
  };

  /** Un clic COMPLET du stage : l'action est différée au relâchement (un glisser panoterait). */
  const cliquer = (a: AreteProjetee) => {
    const { x, y } = milieuPt(a);
    act(() => pointer!.handlers.onPointerDown(pointerEvent(x, y)));
    act(() => pointer!.handlers.onPointerUp(pointerEvent(x, y)));
  };

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    pointer = undefined;
    document.body.replaceChildren();
    useGame.setState({
      battle: BATTLE_VRAI, mode: MODE_VRAI, scene: SCENE_VRAIE, inspectEnabled: false,
      battleClickEntity: CLICK_ENTITY_VRAI, battleClickTile: CLICK_TILE_VRAI, setInspectId: SET_INSPECT_VRAI,
    });
  });

  it('la structure ENRÔLÉE est offerte en capacité `structure`, avec le `cid` du Combattant, sa largeur de prise et la case du MUR', () => {
    const aretes = offre(bataille([heros, mur]));

    expect(aretes).toHaveLength(1);
    expect(aretes[0].arete.capacite).toBe('structure');
    expect(aretes[0].arete.cid).toBe(CID);
    expect(aretes[0].arete.libelle).toBe('Mur à ossature en bois');
    expect(aretes[0].arete.ancrage, 'l’ancrage est la case du MUR, celle de son Combattant').toEqual(MUR);
    const [a, b] = tileEdge(1, 1, 'E', dims, 0);
    expect([aretes[0].a, aretes[0].b]).toEqual([{ cx: a.cx, cy: a.cy }, { cx: b.cx, cy: b.cy }]);
  });

  it('sur une couche haute, la prise colle au MUR : elle se projette à SON lift, jamais à celui du frappeur', () => {
    const LIFT_MUR = 48;
    const lift = (p: Pt) => (p.x === MUR.x && p.y === MUR.y ? LIFT_MUR : 0);
    const aretes = offre(bataille([heros, mur]), FRAPPEUR, scèneFortifiée(), [], lift);
    const [a, b] = tileEdge(1, 1, 'E', dims, LIFT_MUR);

    expect([aretes[0].a, aretes[0].b]).toEqual([{ cx: a.cx, cy: a.cy }, { cx: b.cx, cy: b.cy }]);
  });

  it('aucune arête pour une structure qu’aucun Combattant ne tient, ni pour un frappeur hors de son tour', () => {
    expect(offre(bataille([heros])), 'structure non enrôlée').toEqual([]);
    expect(offre(bataille([heros, mur]), null), 'hors de mon tour : pas de frappe offerte').toEqual([]);
    expect(offre(null), 'hors combat, une enceinte n’est pas une cible').toEqual([]);
  });

  it('le clic passe la main au FLUX DE COMBAT — `battleClickEntity` au régime du pointeur — et il est CONSOMMÉ', () => {
    const battleClickEntity = vi.fn();
    const battleClickTile = vi.fn();
    const battle = bataille([heros, mur]);
    useGame.setState({ scene: scèneFortifiée(), mode: 'battle', dialogue: null, battle, battleClickEntity, battleClickTile });
    const aretes = offre(battle);
    monter(aretes);

    cliquer(aretes[0]);

    // Souris (pointeur FIN) : `hoverClickCommits()` vaut `true` — la visée a déjà tout montré, le clic
    // COMMET, exactement comme sur un jeton ennemi sous le rayon (`useStagePointer.performClick`).
    expect(battleClickEntity).toHaveBeenCalledWith(CID, { confirm: true });
    expect(battleClickEntity).toHaveBeenCalledTimes(1);
    // Rien ne redescend à la case : un clic-sol réécrirait `preview` (`state/combatSlice.ts`).
    expect(battleClickTile).not.toHaveBeenCalled();
  });

  it('le clic de l’arête passe par LA MÊME porte qu’un jeton : Inspection ON, l’enceinte s’INSPECTE au lieu de frapper', () => {
    // `combatantClickActs` (`state/combatOrParty.ts`) est la source UNIQUE des 3 surfaces : sous
    // Inspection ON un jeton ennemi s'inspecte (`useStagePointer.performClick`), donc l'arête aussi —
    // sinon on ne pourrait pas REGARDER le profil d'un mur sans le pilonner.
    const battleClickEntity = vi.fn();
    const battleClickTile = vi.fn();
    const setInspectId = vi.fn();
    const battle = bataille([heros, mur]);
    useGame.setState({
      scene: scèneFortifiée(), mode: 'battle', dialogue: null, battle,
      battleClickEntity, battleClickTile, setInspectId, inspectEnabled: true,
    });
    const aretes = offre(battle);
    monter(aretes);

    cliquer(aretes[0]);

    expect(setInspectId).toHaveBeenCalledWith(CID);
    expect(battleClickEntity, 'la porte a refusé : aucune action de combat').not.toHaveBeenCalled();
    expect(battleClickTile).not.toHaveBeenCalled();

    // Inspection OFF (le défaut) : la porte laisse passer, le geste redevient la frappe.
    act(() => { useGame.setState({ inspectEnabled: false }); });
    cliquer(aretes[0]);

    expect(battleClickEntity).toHaveBeenCalledWith(CID, { confirm: true });
    expect(setInspectId).toHaveBeenCalledTimes(1);
  });

  it('la touche du peintre suit le MÊME chemin que le pixel', () => {
    const battleClickEntity = vi.fn();
    const battle = bataille([heros, mur]);
    useGame.setState({ scene: scèneFortifiée(), mode: 'battle', dialogue: null, battle, battleClickEntity });
    const aretes = offre(battle);
    monter(aretes);

    act(() => { pointer!.activerArete(aretes[0].arete); });

    expect(battleClickEntity).toHaveBeenCalledWith(CID, { confirm: true });
  });

  it('sans survol (tactile), le régime est celui de TOUT jeton : deux taps identiques, aperçu puis commit par `samePreview`', () => {
    // L'arête n'arme rien en propre (`armeParSurvol: false`, `stage/geste.ts`) : c'est le flux de combat
    // qui distingue l'aperçu du commit (`state/targetingModes.ts`). Un armement d'arête empilé par
    // dessus aurait demandé un tap de plus qu'un ennemi.
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as unknown as MediaQueryList);
    const battleClickEntity = vi.fn();
    const battleClickTile = vi.fn();
    const battle = bataille([heros, mur]);
    useGame.setState({ scene: scèneFortifiée(), mode: 'battle', dialogue: null, battle, battleClickEntity, battleClickTile });
    const aretes = offre(battle);
    monter(aretes);

    cliquer(aretes[0]);
    // L'aperçu que le flux vient de poser — le 2e tap y retombe par `samePreview`.
    act(() => { useGame.setState({ battle: bataille([heros, mur], { kind: 'attack', targetId: CID }) }); });
    cliquer(aretes[0]);

    expect(battleClickEntity.mock.calls).toEqual([[CID, { confirm: false }], [CID, { confirm: false }]]);
    expect(battleClickTile).not.toHaveBeenCalled();
  });

  it('le SURVOL de l’arête pose la case du MUR : le réticule de visée y trouve le Combattant-structure', () => {
    const battle = bataille([heros, mur]);
    useGame.setState({ scene: scèneFortifiée(), mode: 'battle', dialogue: null, battle });
    const aretes = offre(battle);
    monter(aretes, true);

    const { x, y } = milieuPt(aretes[0]);
    act(() => pointer!.handlers.onPointerMove(pointerEvent(x, y)));

    // `tuileDe` ne porte le `z` que hors couche 0 : on compare à couche égale.
    expect({ ...pointer!.hover!, z: pointer!.hover!.z ?? 0 }).toEqual(MUR);
    expect(combatantAtTile(battle.combatants, MUR.x, MUR.y, 0)?.id, 'ce que le réticule lit sous ce survol').toBe(CID);
    expect(pointer!.areteSurvolee?.cid).toBe(CID);
  });

  it('le peintre pose le `data-cid` du Combattant-mur et le curseur d’une CIBLE, sans rien peindre de plus', () => {
    const aretes = offre(bataille([heros, mur]));
    const container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root!.render(
      <svg>
        <AreteOverlay aretes={aretes} areteSurvolee={null} activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined} />
      </svg>,
    ));

    const cible = container.querySelector(`[data-cid="${CID}"]`)!;
    const [a, b] = tileEdge(1, 1, 'E', dims, 0);
    expect(cible.getAttribute('x1')).toBe(String(a.cx));
    expect(cible.getAttribute('y1')).toBe(String(a.cy));
    expect(cible.getAttribute('x2')).toBe(String(b.cx));
    expect(cible.getAttribute('y2')).toBe(String(b.cy));
    expect(cible.getAttribute('stroke')).toBe('transparent');
    expect(cible.getAttribute('stroke-width')).toBe('16');
    expect(cible.getAttribute('style'), 'réticule : c’est une cible de combat').toContain('crosshair');
    expect(cible.getAttribute('aria-label'), 'atteignable au clavier, et nommée').toBe('Mur à ossature en bois');
    expect(cible.querySelector('title')?.textContent).toBe('Mur à ossature en bois');
    // La capacité n'ajoute AUCUNE marque : le mur a déjà son trait, la visée son réticule.
    expect(container.querySelectorAll('line')).toHaveLength(1);
    expect(container.querySelector('[data-arete-trait]')).toBeNull();
  });

  describe('SONDE D’INVARIANCE — ce que le PIXEL du centre de l’arête rend', () => {
    /** La MÊME arête, percée d'une porte : en combat l'enceinte prime (`PRIORITE_ARETES`). */
    const porte: RoomPortal = {
      id: '0:1,1:E:a:b', z: 0, edge: { x: 1, y: 1, side: 'E' },
      fromZoneId: 'a', toZoneId: 'b', kind: 'door-closed', exterior: false,
      from: { x: 1, y: 1 }, to: { x: 2, y: 1 },
    };
    const scene = scèneFortifiée();
    const pose = poseFromDims(dims);
    const etat = (battle: BattleState | null): EtatDePick =>
      ({ scene, mode: battle ? 'battle' : 'exploration', battle, partyPos: FRAPPEUR }) as EtatDePick;
    const verdictAu = (aretes: readonly AreteProjetee[], point: { x: number; y: number }, battle: BattleState | null) =>
      resoudrePixel(etat(battle), null, () => point, { pose, dims, activeZ: 0, aretes } as CadreDePick);

    it('en combat : `structure` et le `cid` ; hors combat, la même arête rend `porte`', () => {
      const battle = bataille([heros, mur]);
      const enCombat = offre(battle, FRAPPEUR, scene, [porte]);
      const horsCombat = offre(null, FRAPPEUR, scene, [porte]);

      const vCombat = verdictAu(enCombat, milieuPt(enCombat[0]), battle);
      expect(vCombat.nature).toBe('arete');
      if (vCombat.nature !== 'arete') return;
      expect(vCombat.arete.capacite).toBe('structure');
      expect(vCombat.cid).toBe(CID);
      expect(vCombat.tile, 'la case visée est celle du mur, jamais celle du frappeur').toEqual(MUR);

      const vPaix = verdictAu(horsCombat, milieuPt(horsCombat[0]), null);
      expect(vPaix.nature).toBe('arete');
      if (vPaix.nature !== 'arete') return;
      expect(vPaix.arete.capacite).toBe('porte');
      expect(vPaix.cid).toBeNull();
    });

    it('sans portail ni combat, le même pixel n’est plus qu’une CASE', () => {
      const v = verdictAu(offre(null), milieuPt(offre(bataille([heros, mur]))[0]), null);
      expect(v.nature).toBe('case');
      expect(v.cid).toBeNull();
    });
  });
});
