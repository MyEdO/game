import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, type Scene, type SceneEntity } from './scene';
import type { Flow } from './flow';
import { aPorteeDe, exploreMoveDest, exploreMovePlan, exploreSeatPlan, exploreStepDest, spawnFacing } from './exploreNav';
import { chebyshev } from '../engine/grid';
import { seatSlotsOf } from './seating';

const emptyFlow: Flow = { kind: 'seq', steps: [] };

function sceneWith(entities: SceneEntity[]): Scene {
  const sc = emptyScene(10, 10); // grille entièrement 'herbe' (marchable)
  sc.entities = entities;
  return sc;
}

describe('exploreMoveDest — case d’arrivée partagée survol/clic (exploration)', () => {
  it('case libre : renvoie la case elle-même', () => {
    expect(exploreMoveDest(sceneWith([]), { x: 1, y: 1 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });

  it('objet interactif (case bloquée) : vise une case adjacente marchable, pas la case de l’objet', () => {
    // RÉGRESSION : « au survol d’un objet avec interaction, le chemin ne s’affiche pas ». La case de
    // l’objet est non marchable (entityBlockedAt), donc l’aperçu doit viser la case adjacente — celle
    // où le clic emmène le groupe avant la fouille — au lieu de ne rien afficher.
    const prop: SceneEntity = { id: 'coffre', kind: 'prop', pos: { x: 5, y: 5 }, usable: { actions: [{ id: 'fouiller', flow: emptyFlow, unique: true }] } };
    const sc = sceneWith([prop]);
    expect(isWalkable(sc, 5, 5)).toBe(false); // précondition : la case de l’objet est bloquée
    const dest = exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(dest).not.toBeNull();
    expect(dest).not.toEqual({ x: 5, y: 5 });
    expect(chebyshev(dest!, { x: 5, y: 5 })).toBe(1);
    expect(isWalkable(sc, dest!.x, dest!.y, dest!.z ?? 0)).toBe(true);
  });

  /**
   * SONDE G1 de la revue (#1443, round 3) : « on s'approche, jamais dessus » se lit sur la RÈGLE DE
   * BLOCAGE (`sceneRules.entityBlockedAt` : empreinte déclarée, solidité de type, décor interactif),
   * jamais sur le `kind`. Un décor PASSABLE — ni empreinte, ni `solid`, ni `interact` — est du SOL
   * habillé : `tas-foin` (posé quatre fois dans l'arène) devenait inatteignable au clic, et le geste
   * y journalisait un refus au-dessus d'une case libre.
   */
  it('décor PASSABLE (ni empreinte, ni solide, ni interactif) : on marche DESSUS, comme sur la case nue', () => {
    const foin: SceneEntity = { id: 'foin', kind: 'prop', pos: { x: 5, y: 5 }, ref: 'tas-foin' };
    const sc = sceneWith([foin]);
    expect(isWalkable(sc, 5, 5), 'précondition : sa case reste marchable').toBe(true);
    expect(exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
    expect(exploreMoveDest(sc, { x: 5, y: 6 }, { x: 5, y: 5 }), 'à portée non plus : on y va').toEqual({ x: 5, y: 5 });
  });

  it('décor SOLIDE sans autre affordance : sa case est occupée, on s’en approche', () => {
    const tonneau: SceneEntity = { id: 'tonneau-1', kind: 'prop', pos: { x: 5, y: 5 }, ref: 'tonneau' };
    const sc = sceneWith([tonneau]);
    expect(isWalkable(sc, 5, 5), 'précondition : la case est bloquée').toBe(false);
    const dest = exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(dest).not.toEqual({ x: 5, y: 5 });
    expect(chebyshev(dest!, { x: 5, y: 5 })).toBe(1);
  });

  it('objet interactif, groupe déjà adjacent : aucune marche (fouille sur place)', () => {
    const prop: SceneEntity = { id: 'coffre', kind: 'prop', pos: { x: 5, y: 5 }, usable: { actions: [{ id: 'fouiller', flow: emptyFlow, unique: true }] } };
    expect(exploreMoveDest(sceneWith([prop]), { x: 5, y: 6 }, { x: 5, y: 5 })).toBeNull();
  });

  it('PNJ à dialogue (case marchable) : on s’arrête à une case adjacente, pas sur le PNJ', () => {
    const npc: SceneEntity = { id: 'garde', kind: 'personnage', ref: 'humain', pos: { x: 5, y: 5 }, dialogueId: 'd1' };
    const sc = sceneWith([npc]);
    expect(isWalkable(sc, 5, 5)).toBe(true); // un personnage ne bloque pas sa case…
    const dest = exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(dest).not.toEqual({ x: 5, y: 5 }); // …mais on ne marche pas dessus (cohérent avec le clic)
    expect(chebyshev(dest!, { x: 5, y: 5 })).toBe(1);
  });

  it('figurant (sans dialogue) à distance : on s’approche d’une case adjacente', () => {
    const fig: SceneEntity = { id: 'badaud', kind: 'personnage', ref: 'humain', pos: { x: 5, y: 5 } };
    const dest = exploreMoveDest(sceneWith([fig]), { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(chebyshev(dest!, { x: 5, y: 5 })).toBe(1);
  });

  it('figurant déjà adjacent : aucune marche', () => {
    const fig: SceneEntity = { id: 'badaud', kind: 'personnage', ref: 'humain', pos: { x: 5, y: 5 } };
    expect(exploreMoveDest(sceneWith([fig]), { x: 4, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });

  it('case d’une couche haute (tablier z1) sans entité : renvoie la case telle quelle, avec son z', () => {
    // Plus d'escaliers : le franchissement vertical s'auto-dérive du relief le long du chemin
    // (`pathTo`/`moveAlong`). exploreMoveDest se contente de renvoyer la case cliquée (z compris).
    const sc = emptyScene(10, 10);
    sc.layers.push({ z: 1, tiles: new Array(100).fill('plancher'), height: new Array(100).fill(4) });
    expect(exploreMoveDest(sc, { x: 1, y: 1 }, { x: 3, y: 2, z: 1 })).toEqual({ x: 3, y: 2, z: 1 });
    expect(exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 }); // sol : sans z
  });
});

describe('exploreSeatPlan — marcher vers l’ABORD d’une place libre', () => {
  const TABLE = 'table-ronde-4-tabourets';
  /** Table en (10,10) au cap N : abords nord (10,9), est (11,10), sud (10,11), ouest (9,10). */
  const table = (over: Partial<SceneEntity> = {}): SceneEntity =>
    ({ id: 'table-1', kind: 'prop', pos: { x: 10, y: 10 }, ref: TABLE, facing: 'N', usable: { assise: true }, ...over }) as SceneEntity;
  const scèneTable = (assignments?: Scene['seatAssignments']): Scene => {
    const sc = emptyScene(16, 16);
    sc.entities = [table()];
    if (assignments) sc.seatAssignments = assignments;
    return sc;
  };

  it('planifie vers l’approche du premier slot libre et atteignable', () => {
    const scene = scèneTable({ 'table-1': { 'place-1': { kind: 'entity', entityId: 'pnj-1' } } });
    const plan = exploreSeatPlan(scene, { x: 8, y: 8 }, 'table-1');
    expect(plan).toMatchObject({ slotId: 'place-2', approach: { x: 11, y: 10 } });
    expect(plan!.path[plan!.path.length - 1]).toEqual(plan!.approach);
    expect(plan!.path[0]).toEqual({ x: 8, y: 8 });
  });

  it('ordre du CATALOGUE : sans place prise, c’est la première déclarée qui gagne', () => {
    const plan = exploreSeatPlan(scèneTable(), { x: 8, y: 8 }, 'table-1');
    expect(plan!.slotId).toBe(seatSlotsOf(scèneTable(), 'table-1')[0].slotId);
    expect(plan!.slotId).toBe('place-1');
  });

  it('déjà SUR un abord libre : chemin d’un seul point (rien à marcher)', () => {
    const plan = exploreSeatPlan(scèneTable(), { x: 10, y: 11 }, 'table-1');
    expect(plan).toMatchObject({ slotId: 'place-3', approach: { x: 10, y: 11 } });
    expect(plan!.path).toEqual([{ x: 10, y: 11 }]);
  });

  it('toutes les places prises → null (rien à planifier)', () => {
    const prises = Object.fromEntries(seatSlotsOf(scèneTable(), 'table-1').map((s) => [s.slotId, { kind: 'entity' as const, entityId: `pnj-${s.slotId}` }]));
    expect(exploreSeatPlan(scèneTable({ 'table-1': prises }), { x: 8, y: 8 }, 'table-1')).toBeNull();
  });

  it('meuble sans place → null ; meuble absent → null', () => {
    const sc = emptyScene(16, 16);
    sc.entities = [{ id: 'caisse', kind: 'prop', pos: { x: 10, y: 10 }, ref: 'comptoir-droit' }];
    expect(exploreSeatPlan(sc, { x: 8, y: 8 }, 'caisse')).toBeNull();
    expect(exploreSeatPlan(sc, { x: 8, y: 8 }, 'fantome')).toBeNull();
  });

  it('aucun abord ATTEIGNABLE (table emmurée) → null', () => {
    const sc = scèneTable();
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        if (chebyshev({ x: dx, y: dy }, { x: 0, y: 0 }) !== 2) continue;
        sc.entities.push({ id: `mur-${dx}-${dy}`, kind: 'prop', pos: { x: 10 + dx, y: 10 + dy }, ref: 'comptoir-droit' });
      }
    expect(exploreSeatPlan(sc, { x: 5, y: 5 }, 'table-1')).toBeNull();
  });

  /**
   * SONDE promue de la revue (2026-08-21) : un meuble PLEIN qui porte une fouille NON épuisée gardait
   * son halo allumé pendant que la seule route de marche rendait `null` — le clic répondait « aucune
   * place accessible » et la fouille n'était JAMAIS servie. Les places AJOUTENT une destination,
   * elles n'en retirent aucune : sans place servable, la marche générique reprend la main.
   */
  it('table PLEINE mais FOUILLABLE : le plan retombe sur une case adjacente, jamais sur null', () => {
    const prises = Object.fromEntries(seatSlotsOf(scèneTable(), 'table-1')
      .map((s) => [s.slotId, { kind: 'entity' as const, entityId: `pnj-${s.slotId}` }]));
    const sc = scèneTable({ 'table-1': prises });
    (sc.entities[0] as SceneEntity).usable = { assise: true, actions: [{ id: 'fouiller', flow: emptyFlow, unique: true }] };

    expect(exploreSeatPlan(sc, { x: 5, y: 5 }, 'table-1'), 'précondition : plus une seule place').toBeNull();
    for (const depart of [{ x: 5, y: 5 }, { x: 12, y: 12 }]) { // au loin, et adjacent HORS abord
      const plan = exploreMovePlan(sc, depart, { x: 10, y: 10 }, { blocked: new Set() });
      expect(plan, `depuis (${depart.x},${depart.y}) : la fouille reste joignable`).not.toBeNull();
      expect(plan!.dest, 'jamais la case du meuble').not.toEqual({ x: 10, y: 10 });
      expect(chebyshev(plan!.dest, { x: 10, y: 10 }), 'une case ADJACENTE, d’où l’on fouille').toBe(1);
      expect(plan!.path[plan!.path.length - 1]).toEqual(plan!.dest);
    }
  });

  /** Un meuble sans rien à offrir reste du SOL OCCUPÉ : on ne monte pas dessus, mais le clic mène à
   *  lui comme il mène au sol nu — c'est la parité que le geste avalé rompait (#1443, round 2). */
  it('table PLEINE et SANS fouille : on ne monte pas dessus, on s’en APPROCHE', () => {
    const prises = Object.fromEntries(seatSlotsOf(scèneTable(), 'table-1')
      .map((s) => [s.slotId, { kind: 'entity' as const, entityId: `pnj-${s.slotId}` }]));
    const sc = scèneTable({ 'table-1': prises });
    const plan = exploreMovePlan(sc, { x: 5, y: 5 }, { x: 10, y: 10 }, { blocked: new Set() });
    expect(plan, 'le clic mène quelque part').not.toBeNull();
    expect(plan!.dest, 'jamais la case du meuble').not.toEqual({ x: 10, y: 10 });
    expect(chebyshev(plan!.dest, { x: 10, y: 10 }), 'une case ADJACENTE').toBe(1);
    // Déjà à portée : plus rien à marcher — c'est à l'appelant de le DIRE (`useStagePointer`).
    expect(exploreMovePlan(sc, { x: 10, y: 11 }, { x: 10, y: 10 }, { blocked: new Set() })).toBeNull();
  });

  /** L'assise est un opt-in d'AUTEUR (#1687) : sur un meuble NON activé, la destination du clic est
   *  celle du sol occupé — jamais l'abord d'une place. La destination du clic est une lecture
   *  d'INTERACTION, au même titre que le halo et le curseur. */
  it('meuble à places NON activé : le clic vise la marche GÉNÉRIQUE, jamais l’abord d’une place', () => {
    const sc = emptyScene(16, 16);
    sc.entities = [table({ usable: undefined })];
    expect(seatSlotsOf(sc, 'table-1'), 'précondition : le TYPE porte bien ses places').toHaveLength(4);

    const plan = exploreMovePlan(sc, { x: 8, y: 8 }, { x: 10, y: 10 }, { blocked: new Set() });
    expect(plan, 'le clic mène quelque part').not.toBeNull();
    expect(plan!.dest).toEqual(exploreMoveDest(sc, { x: 8, y: 8 }, { x: 10, y: 10 }));

    // …et c'est bien l'ACTIVATION qui décide : le même meuble activé route vers l'abord d'une place.
    const active = scèneTable();
    const seat = exploreSeatPlan(active, { x: 8, y: 8 }, 'table-1')!;
    expect(exploreMovePlan(active, { x: 8, y: 8 }, { x: 10, y: 10 }, { blocked: new Set() })!.dest).toEqual(seat.approach);
    expect(plan!.dest, 'les deux destinations diffèrent — sans quoi la sonde ne mesure rien').not.toEqual(seat.approach);
  });

  it('exploreMovePlan route le clic d’un meuble à places vers CE plan (survol et clic, une seule source)', () => {
    const scene = scèneTable({ 'table-1': { 'place-1': { kind: 'entity', entityId: 'pnj-1' } } });
    const seat = exploreSeatPlan(scene, { x: 8, y: 8 }, 'table-1')!;
    const plan = exploreMovePlan(scene, { x: 8, y: 8 }, { x: 10, y: 10 }, { blocked: new Set() });
    expect(plan).toMatchObject({ dest: seat.approach });
    expect(plan!.path).toEqual(seat.path);
    // …et jamais la case du meuble, ni un simple « à côté ».
    expect(plan!.dest).not.toEqual({ x: 10, y: 10 });
  });
});

describe('exploreMovePlan — destination et chemin uniques', () => {
  it('compose le chemin depuis la destination choisie par exploreMoveDest', () => {
    const prop: SceneEntity = { id: 'coffre', kind: 'prop', pos: { x: 5, y: 5 }, usable: { actions: [{ id: 'fouiller', flow: emptyFlow, unique: true }] } };
    const scene = sceneWith([prop]);
    const partyPos = { x: 1, y: 1 };
    const plan = exploreMovePlan(scene, partyPos, { x: 5, y: 5 }, { blocked: new Set() });

    expect(plan).not.toBeNull();
    expect(plan!.dest).not.toEqual({ x: 5, y: 5 });
    expect(plan!.path[0]).toEqual(partyPos);
    expect(plan!.path[plan!.path.length - 1]).toEqual(plan!.dest);
  });

  it('associe le portail au même plan sans modifier sa destination mécanique', () => {
    const scene = sceneWith([]);
    scene.effectZones = [
      {
        id: 'room-a',
        label: 'Pièce A',
        presentation: 'interior',
        area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
      },
      {
        id: 'room-b',
        label: 'Pièce B',
        presentation: 'interior',
        area: { kind: 'rect', x: 2, y: 1, w: 1, h: 1 },
      },
    ];
    const plan = exploreMovePlan(
      scene,
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { blocked: new Set() },
    );

    expect(plan).toEqual({
      dest: { x: 2, y: 1 },
      path: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
      portalId: '0:1,1:E:room-a:room-b',
    });
  });

  it('associe le portail extérieur réorienté au trajet vers la pièce', () => {
    const scene = emptyScene(4, 3);
    scene.effectZones = [{
      id: 'room-a',
      label: 'Pièce A',
      presentation: 'interior',
      area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
    }];
    scene.walls = [{ x: 0, y: 1, side: 'E', door: true, closed: false }];

    expect(exploreMovePlan(
      scene,
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { blocked: new Set() },
    )).toEqual({
      dest: { x: 1, y: 1 },
      path: [{ x: 0, y: 1 }, { x: 1, y: 1 }],
      portalId: '0:0,1:E:exterior:room-a',
    });
  });
});

describe('exploreStepDest — pas clavier, seuil d’alignement (#792 refuse le snap latéral/zigzag)', () => {
  // Mesuré empiriquement (losange iso par défaut, camRot=0) depuis le centre d'une scène plate ouverte :
  // le voisin IDÉAL de chaque cardinal (pas DIAGONAL de grille) colle à dot=1.0 ; le repêchage hors-axe
  // (pas SIMPLE-axe de grille) tombe soit à ~0.4472 (up/down — quasi perpendiculaire, ratio TW/TH 2:1),
  // soit à ~0.8944 (left/right — encore bien aligné). ALIGN_MIN=0.6 sépare exactement ces deux paliers.
  const IDEAL: Record<'up' | 'down' | 'left' | 'right', { x: number; y: number }> = {
    up: { x: 4, y: 4 },
    down: { x: 6, y: 6 },
    left: { x: 4, y: 6 },
    right: { x: 6, y: 4 },
  };
  const dims = { w: 10, h: 10 };
  const from = { x: 5, y: 5 };

  it('champ libre : chaque cardinal renvoie son voisin idéal (diagonal de grille, dot≈1.0)', () => {
    const sc = emptyScene(10, 10);
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      expect(exploreStepDest(sc, from, dir, dims)).toEqual(IDEAL[dir]);
    }
  });

  it('8-connectivité en champ libre préservée : les 4 voisins idéaux (un par cardinal) restent tous atteignables après le seuil', () => {
    const sc = emptyScene(10, 10);
    const reached = (['up', 'down', 'left', 'right'] as const).map((dir) => exploreStepDest(sc, from, dir, dims));
    expect(reached.every((d) => d !== null)).toBe(true);
    // 4 destinations distinctes (les 4 diagonales de grille autour du départ) — aucune collision.
    const keys = new Set(reached.map((d) => `${d!.x},${d!.y}`));
    expect(keys.size).toBe(4);
  });

  it('idéal bloqué (up), seuls des voisins hors-axe (~0.45, < ALIGN_MIN) ouverts → bloqué (null), pas de rabattement latéral', () => {
    const sc = emptyScene(10, 10);
    const idx = (x: number, y: number) => y * 10 + x;
    sc.layers[0].tiles[idx(4, 4)] = 'mur'; // voisin idéal de 'up' (dot=1.0) : mur
    // Les hors-axe (0,-1)=(5,4) et (-1,0)=(4,5) restent marchables (dot≈0.4472 < 0.6) — SANS le seuil,
    // l'ancien code s'y rabattait silencieusement (le zigzag #792). Avec le seuil : bloqué.
    expect(isWalkable(sc, 5, 4)).toBe(true);
    expect(isWalkable(sc, 4, 5)).toBe(true);
    expect(exploreStepDest(sc, from, 'up', dims)).toBeNull();
  });

  it('idéal bloqué (down), même garde symétrique', () => {
    const sc = emptyScene(10, 10);
    const idx = (x: number, y: number) => y * 10 + x;
    sc.layers[0].tiles[idx(6, 6)] = 'mur'; // voisin idéal de 'down'
    expect(exploreStepDest(sc, from, 'down', dims)).toBeNull();
  });

  it('idéal bloqué (left/right) : le voisin hors-axe reste bien ALIGNÉ (~0.89 ≥ ALIGN_MIN) et est accepté — pas un zigzag, un vrai second chemin', () => {
    const sc = emptyScene(10, 10);
    const idx = (x: number, y: number) => y * 10 + x;
    sc.layers[0].tiles[idx(4, 6)] = 'mur'; // voisin idéal de 'left' (4,6)
    const dest = exploreStepDest(sc, from, 'left', dims);
    expect(dest).not.toBeNull();
    expect(dest).not.toEqual({ x: 4, y: 6 });
  });
});

describe('spawnFacing — orientation d’entrée vers le CONTENU de la carte', () => {
  it('bord sud → N (le défaut S regarderait le vide hors-carte en POV)', () => {
    expect(spawnFacing({ x: 10, y: 19 }, { w: 21, h: 20 })).toBe('N');
  });

  it('quantification par secteurs de 45° (atan2), PAS par signe : bord sud légèrement décalé → toujours N', () => {
    // dx=+2, dy=−9.5 : ~12° du plein nord → N (par signe, ce serait NE dès 1 case d'écart).
    expect(spawnFacing({ x: 8, y: 19 }, { w: 21, h: 20 })).toBe('N');
  });

  it('bord nord → S, bord ouest → E, bord est → O', () => {
    expect(spawnFacing({ x: 10, y: 0 }, { w: 21, h: 20 })).toBe('S');
    expect(spawnFacing({ x: 0, y: 5 }, { w: 11, h: 11 })).toBe('E');
    expect(spawnFacing({ x: 10, y: 5 }, { w: 11, h: 11 })).toBe('O');
  });

  it('coins → diagonale vers le centre (NO→SE, SE→NO)', () => {
    expect(spawnFacing({ x: 0, y: 0 }, { w: 7, h: 7 })).toBe('SE');
    expect(spawnFacing({ x: 6, y: 6 }, { w: 7, h: 7 })).toBe('NO');
  });

  it("entrée déjà au centre → 'S' (aucune direction vers le contenu ne domine)", () => {
    expect(spawnFacing({ x: 3, y: 3 }, { w: 7, h: 7 })).toBe('S');
  });
});

describe('aPorteeDe — la portée d’un geste d’exploration, étage COMPRIS', () => {
  const coffre = (pos: { x: number; y: number; z?: number }): SceneEntity =>
    ({ id: 'coffre', kind: 'prop', pos: { x: pos.x, y: pos.y }, ...(pos.z ? { z: pos.z } : null),
       usable: { actions: [{ id: 'fouiller', flow: emptyFlow, unique: true }] } }) as SceneEntity;

  it('8-adjacent de plain-pied : à portée ; une case de plus : hors de portée', () => {
    expect(aPorteeDe({ x: 4, y: 4 }, coffre({ x: 4, y: 3 })), 'orthogonal').toBe(true);
    expect(aPorteeDe({ x: 4, y: 4 }, coffre({ x: 3, y: 3 })), 'diagonale : le 8-voisinage compte').toBe(true);
    expect(aPorteeDe({ x: 4, y: 4 }, coffre({ x: 4, y: 4 })), 'sous les pieds').toBe(true);
    expect(aPorteeDe({ x: 4, y: 4 }, coffre({ x: 4, y: 2 })), 'deux cases : le clic marche, il ne joue pas').toBe(false);
  });

  it('l’ÉTAGE fait partie de la portée : superposé n’est pas adjacent', () => {
    // Chebyshev 1 dans le plan, un plancher entre les deux : le geste ne s’ouvre pas à travers.
    expect(aPorteeDe({ x: 4, y: 4, z: 0 }, coffre({ x: 4, y: 3, z: 1 })), 'un étage au-dessus').toBe(false);
    expect(aPorteeDe({ x: 4, y: 4, z: 1 }, coffre({ x: 4, y: 3 })), 'le groupe en haut, la chose en bas').toBe(false);
    // Chebyshev 0 — la superposition exacte, cas que le seul plan ne peut PAS distinguer.
    expect(aPorteeDe({ x: 4, y: 4, z: 0 }, coffre({ x: 4, y: 4, z: 1 })), 'pile au-dessus de la tête').toBe(false);
    expect(aPorteeDe({ x: 4, y: 4, z: 1 }, coffre({ x: 4, y: 3, z: 1 })), 'même étage, adjacent : à portée').toBe(true);
  });

  it('`exploreMoveDest` s’en sert : un décor de l’étage se REJOINT au lieu d’être servi sur place', () => {
    const sc = sceneWith([coffre({ x: 4, y: 3 })]);
    expect(exploreMoveDest(sc, { x: 4, y: 4 }, { x: 4, y: 3 }), 'de plain-pied et adjacent : rien à marcher').toBeNull();
  });
});
