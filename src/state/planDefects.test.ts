/**
 * Défauts de plan (`scenePlanDefects`) et leur remontée à l'ÉDITEUR par `validateScene`. Fixtures
 * SYNTHÉTIQUES : jamais les comptes d'une scène réelle, qui bougent dès que l'auteur corrige sa carte.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene, type SceneEffectZone, type WallSeg } from './scene';
import { auditFacade, auditStairwells, auditUnsupportedFloor, auditWallDeadEndsInside, auditZoneCoverage, groundTerrains, interiorCells, outdoorCells, PLAN_DEFECT_FAMILIES, scenePlanDefects, stairFlightCells, supportedFloorCells, zoneOutsideBuildingTiles, type PlanDefectFamily } from './planDefects';
import { perimeterWallSegs } from './sceneEdit.testkit';
import { terrainWalkable } from './terrain';
import { validateScene } from './validateScene';

function makeScene(w: number, h: number, layers: { z: number; tiles: string[]; height?: number[] }[], zones: SceneEffectZone[], walls: WallSeg[] = []): Scene {
  return {
    type: 'scene',
    reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
    id: 'fixture',
    label: 'Fixture de plan',
    dimensions: { w, h },
    layers,
    walls,
    effectZones: zones,
    entities: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}

/** Segments du PÉRIMÈTRE d'un rectangle de cases [x0..x1]×[y0..y1], en forme canonique de stockage
 *  (`N`/`E` seulement, cf. `scene.ts`) : S de (x,y) = N de (x,y+1), O de (x,y) = E de (x-1,y). */
function murs(x0: number, y0: number, x1: number, y1: number, z = 0): WallSeg[] {
  const out: WallSeg[] = [];
  for (let x = x0; x <= x1; x++) {
    out.push({ x, y: y0, side: 'N', z });
    out.push({ x, y: y1 + 1, side: 'N', z });
  }
  for (let y = y0; y <= y1; y++) {
    out.push({ x: x0 - 1, y, side: 'E', z });
    out.push({ x: x1, y, side: 'E', z });
  }
  return out;
}

/** Le même périmètre, dont le segment de rang `i` reçoit les attributs donnés (porte, porte fermée…). */
const avec = (walls: WallSeg[], i: number, seg: Partial<WallSeg>): WallSeg[] =>
  walls.map((w, k) => (k === i ? { ...w, ...seg } : w));

/** Plan de plain-pied 8×5 dont TOUT le sol est de la TERRE battue : le matériau ne peut donc, ici,
 *  distinguer une pièce d'un pré — seuls les murs le font. Corps de bâtiment enclos en x1..3 / y1..3,
 *  plein champ tout autour. */
function fermeScene(zones: SceneEffectZone[], walls: WallSeg[] = murs(1, 1, 3, 3)): Scene {
  const w = 8, h = 5;
  return makeScene(w, h, [{ z: 0, tiles: new Array(w * h).fill('terre') }], zones, walls);
}

const zoneRect = (id: string, label: string, x: number, y: number, w: number, h: number, presentation: 'interior' | 'exterior'): SceneEffectZone =>
  ({ id, label, presentation, area: { kind: 'rect', x, y, w, h }, z: 0 });

const zoneDefects = (scene: Scene) => scenePlanDefects(scene).filter((d) => d.family.startsWith('zone-'));

describe('une PIÈCE, c’est un sol ENCLOS de murs — jamais un sol d’un matériau noble (familles de ZONE)', () => {
  it('une forge au sol de TERRE BATTUE, entourée de murs, n’est signalée par aucune famille de zone', () => {
    expect(zoneDefects(fermeScene([zoneRect('forge', 'Forge', 1, 1, 3, 3, 'interior')]))).toEqual([]);
  });

  it('CONTRE-ÉPREUVE : la MÊME forge, un segment de son périmètre RETIRÉ, fuit vers le dehors et se signale — ce sont bien les murs qui tranchent', () => {
    const ouverte = fermeScene([zoneRect('forge', 'Forge', 1, 1, 3, 3, 'interior')], murs(1, 1, 3, 3).slice(1));
    expect(zoneDefects(ouverte).map((d) => d.family)).toEqual(['zone-hors-bati']);
  });

  it('une zone posée en PLEIN CHAMP, sans un mur autour d’elle, reste signalée — et le message la NOMME avec ses cases', () => {
    const defects = zoneDefects(fermeScene([zoneRect('pre', 'Salle du fond', 5, 1, 2, 2, 'interior')]));
    expect(defects).toHaveLength(1);
    expect(defects[0].family).toBe('zone-hors-bati');
    expect(defects[0].message).toContain('Salle du fond');
    expect(defects[0].at).toEqual({ kind: 'zone', zoneId: 'pre', z: 0, tiles: [{ x: 5, y: 1, z: 0 }, { x: 6, y: 1, z: 0 }, { x: 5, y: 2, z: 0 }, { x: 6, y: 2, z: 0 }] });
  });

  it('CONTRE-ÉPREUVE : la MÊME zone déclarée en extérieur (cour, jardin) n’est plus un défaut — l’exemption est bien la cause', () => {
    expect(zoneDefects(fermeScene([zoneRect('pre', 'Pré communal', 5, 1, 2, 2, 'exterior')]))).toEqual([]);
  });

  it('une zone à cheval sur le mur DÉBORDE, et le message chiffre ce qui reste enclos', () => {
    const defects = zoneDefects(fermeScene([zoneRect('salle', 'Salle commune', 3, 1, 2, 3, 'interior')]));
    expect(defects).toHaveLength(1);
    expect(defects[0].family).toBe('zone-debordante');
    expect(defects[0].message).toContain('Salle commune');
    expect(defects[0].message).toContain('3 de ses 6 cases');
  });

  it('une case SANS SOL n’est pas une pièce, même murée : la zone posée sur le trou déborde', () => {
    const w = 8, h = 5;
    const tiles = new Array(w * h).fill('terre');
    tiles[2 * w + 2] = 'vide'; // trou au cœur du corps de bâtiment
    const scene = makeScene(w, h, [{ z: 0, tiles }], [zoneRect('forge', 'Forge', 1, 1, 3, 3, 'interior')], murs(1, 1, 3, 3));
    const defects = zoneDefects(scene);
    expect(defects).toHaveLength(1);
    expect(defects[0].family).toBe('zone-debordante');
    expect(defects[0].at.kind === 'zone' && defects[0].at.tiles).toEqual([{ x: 2, y: 2, z: 0 }]);
  });
});

describe('PORTES — une pièce reste une pièce quand on en pousse la porte', () => {
  const forge = [zoneRect('forge', 'Forge', 1, 1, 3, 3, 'interior')];

  it('un périmètre dont une arête porte une porte OUVERTE reste enclos', () => {
    expect(zoneDefects(fermeScene(forge, avec(murs(1, 1, 3, 3), 0, { door: true })))).toEqual([]);
  });

  it('la MÊME porte déclarée FERMÉE rend exactement le même verdict — l’enclosure ne dépend pas de l’état d’une porte', () => {
    expect(zoneDefects(fermeScene(forge, avec(murs(1, 1, 3, 3), 0, { door: true, closed: true })))).toEqual([]);
  });

  it('CONTRE-ÉPREUVE : la MÊME arête laissée VIDE (une brèche, pas une porte) ouvre la pièce sur le dehors', () => {
    const brèche = murs(1, 1, 3, 3).filter((_, k) => k !== 0);
    expect(zoneDefects(fermeScene(forge, brèche)).map((d) => d.family)).toEqual(['zone-hors-bati']);
  });
});

describe('COUR INTÉRIEURE — enclose par le bâtiment, à ciel ouvert, et toujours contrôlée', () => {
  /** Corps de bâtiment enclos en x1..5 / y1..3 : son aile nord (y1) est habitée, son cœur (y2) est la
   *  cour à ciel ouvert. Un étage se pose au-dessus de la cour selon `dalle`. */
  function courScene(dalle: string[]): Scene {
    const w = 7, h = 5;
    const z1 = new Array(w * h).fill('vide');
    for (const key of dalle) {
      const [x, y] = key.split(',').map(Number);
      z1[y * w + x] = 'plancher';
    }
    const zones: SceneEffectZone[] = [
      { id: 'aile', label: 'Aile nord', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 5, h: 1 }, z: 0 },
      { id: 'cour', label: 'Cour', presentation: 'exterior', area: { kind: 'rect', x: 1, y: 2, w: 5, h: 1 }, z: 0 },
      { id: 'combles', label: 'Combles', presentation: 'interior', area: { kind: 'rect', x: 1, y: 3, w: 5, h: 1 }, z: 0 },
    ];
    return makeScene(w, h, [{ z: 0, tiles: new Array(w * h).fill('terre') }, { z: 1, tiles: z1 }], zones, murs(1, 1, 5, 3));
  }

  it('la cour n’est PAS prise pour une pièce mal posée : aucune famille de zone ne la nomme, ses ailes non plus', () => {
    expect(zoneDefects(courScene([]))).toEqual([]);
  });

  it('elle reste SOUMISE aux contrôles : une dalle sans appui posée au-dessus d’elle est signalée « étage au-dessus du dehors »', () => {
    const dehors = auditZoneCoverage(courScene(['2,2', '3,2', '4,2']), 1, 0).filter((d) => d.family === 'etage-sur-exterior');
    expect(dehors.map((d) => `${d.x},${d.y}`)).toEqual(['2,2', '3,2', '4,2']);
  });
});

/** Plan 8×4 à deux étages, dessiné pour porter UN défaut de CHAQUE famille :
 *  - z0 : `plancher` sur y0-y1, `route` sur y2-y3 ;
 *  - z1 : dalle x0-x3 sur y0-y2, portée par le plancher du rez — plus une case ISOLÉE en (6,3),
 *    qui ne touche aucune autre case d'étage et ne repose que sur la route : elle FLOTTE ;
 *  - zones z0 : pièce ENCLOSE conforme, cour `exterior` sous la dalle portée, courette `exterior` sous
 *    la case flottante, rien du tout sous x0-x3/y2, pièce intérieure en plein champ, pièce intérieure
 *    à cheval sur le mur de son cellier ;
 *  - murs : périmètre de l'étage laissé OUVERT (mur manquant) sauf l'arête E de (3,0), présente à
 *    l'étage mais dont le mur du rez est décalé d'une case (façade décalée) ; au rez, la salle basse
 *    est close, et le cellier ne l'est que sur sa rangée nord. */
function scenePerFamily(): Scene {
  const w = 8, h = 4;
  const z0 = Array.from({ length: w * h }, (_, i) => (Math.floor(i / w) <= 1 ? 'plancher' : 'route'));
  const z1 = Array.from({ length: w * h }, (_, i) => (i % w <= 3 && Math.floor(i / w) <= 2 ? 'plancher' : 'vide'));
  z1[3 * w + 6] = 'plancher'; // case flottante (6,3)
  const zones: SceneEffectZone[] = [
    { id: 'piece', label: 'Salle basse', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, z: 0 },
    { id: 'cour', label: 'Cour intérieure', presentation: 'exterior', area: { kind: 'rect', x: 2, y: 0, w: 2, h: 2 }, z: 0 },
    { id: 'courette', label: 'Courette', presentation: 'exterior', area: { kind: 'rect', x: 6, y: 3, w: 1, h: 1 }, z: 0 },
    { id: 'grange', label: 'Grange', presentation: 'interior', area: { kind: 'rect', x: 4, y: 2, w: 2, h: 2 }, z: 0 },
    { id: 'cellier', label: 'Cellier', presentation: 'interior', area: { kind: 'rect', x: 6, y: 1, w: 2, h: 2 }, z: 0 },
  ];
  const walls: WallSeg[] = [
    { x: 3, y: 0, side: 'E', z: 1 },
    { x: 2, y: 0, side: 'E', z: 0 },
    ...murs(0, 0, 1, 1), // salle basse close
    ...murs(6, 1, 7, 1), // cellier clos sur sa seule rangée nord
  ];
  return makeScene(w, h, [{ z: 0, tiles: z0 }, { z: 1, tiles: z1 }], zones, walls);
}

/** Enceinte posée AU RAS du bord d'une grille de plain-pied : le seul plan de ce fichier où plus
 *  aucune case n'est à l'air libre. Il ne peut PAS cohabiter avec `scenePerFamily` — un plan dont le
 *  dehors est vide n'a, par construction, plus de dehors à opposer aux autres familles. */
function sceneEnceinteAuRas(): Scene {
  const w = 6, h = 4;
  return makeScene(w, h, [{ z: 0, tiles: new Array(w * h).fill('plancher') }], [], perimeterWallSegs([{ x: 0, y: 0, w, h }]));
}

/** Plain-pied 8×8 entier de plancher dont le SEUL segment de mur est une porte, plantée loin de tout :
 *  ni enceinte, ni extrémité sur le bord. L'arête est isolée EN PLEIN PLANCHER : elle rend la porte
 *  orpheline (famille 10) et, par ses deux coins libres, le mur en impasse (famille 11). */
function scenePorteOrpheline(): Scene {
  const w = 8, h = 8;
  return makeScene(w, h, [{ z: 0, tiles: new Array(w * h).fill('plancher') }], [], [{ x: 5, y: 5, side: 'N', door: true }]);
}

/** Plain-pied 8×8 de plancher, une croisée franchissable ISOLÉE qui porte une hauteur de suspension
 *  (`WallSeg.suspendu`, EDO 01 l.231) : de plain-pied, on l'enjambe, aucun saut ne l'offre. */
function sceneSuspensionHorsSaut(): Scene {
  const w = 8, h = 8;
  return makeScene(w, h, [{ z: 0, tiles: new Array(w * h).fill('plancher') }], [], [{ x: 5, y: 5, side: 'N', window: true, crossable: true, suspendu: 2 }]);
}

/** Plain-pied 9×9 entier de plancher, une pièce 5×5 CLOSE en (1,1), et dedans un refend qui part du
 *  mur ouest et s'arrête en plein plancher au coin (4,3) : l'impasse, et rien d'autre. */
function sceneCloisonEnImpasse(): Scene {
  const w = 9, h = 9;
  const refend: WallSeg[] = [1, 2, 3].map((x) => ({ x, y: 3, side: 'N' as const }));
  return makeScene(w, h, [{ z: 0, tiles: new Array(w * h).fill('plancher') }], [], [...perimeterWallSegs([{ x: 1, y: 1, w: 5, h: 5 }]), ...refend]);
}

describe('validateScene — AUCUNE famille ne peut cesser d’atteindre l’éditeur', () => {
  const warnings = [scenePerFamily(), sceneEnceinteAuRas(), scenePorteOrpheline(), sceneCloisonEnImpasse(), sceneSuspensionHorsSaut()]
    .flatMap((scene) => validateScene([scene]))
    .filter((wa) => wa.scope === 'plan');

  it.each(PLAN_DEFECT_FAMILIES.map((f) => [f.id, f.title] as [PlanDefectFamily, string]))(
    'la famille « %s » (%s) remonte au moins un Warning de plan',
    (family) => {
      expect(warnings.filter((wa) => wa.plan?.family === family).length).toBeGreaterThan(0);
    },
  );

  it('les familles de PIÈCE nomment le GESTE de correction, pas seulement le symptôme', () => {
    const message = (family: PlanDefectFamily) => warnings.find((wa) => wa.plan?.family === family)!.message;
    expect(message('case-sans-zone')).toContain("peignant l'emprise");
    expect(message('zone-debordante')).toContain('retire de son emprise');
    expect(message('zone-hors-bati')).toContain("Ferme le périmètre de murs autour d'elle");
  });

  it('chaque Warning de plan porte un endroit exploitable, cohérent avec sa famille', () => {
    expect(warnings.length).toBeGreaterThan(0);
    for (const wa of warnings) {
      const at = wa.plan!.at;
      expect(wa.level).toBe('warn');
      expect(wa.message.length).toBeGreaterThan(0);
      if (at.kind === 'zone') {
        expect(wa.plan!.family.startsWith('zone-')).toBe(true);
        expect(at.zoneId.length).toBeGreaterThan(0);
        expect(wa.refId).toBe(at.zoneId); // clic → sélection de la zone fautive
      } else {
        expect(wa.plan!.family.startsWith('zone-')).toBe(false);
        expect(Number.isInteger(at.x) && Number.isInteger(at.y)).toBe(true);
        if (at.kind === 'edge') expect(['N', 'E', 'S', 'O']).toContain(at.side);
      }
      expect(Number.isInteger(at.z)).toBe(true);
    }
  });

  it('un plan SANS défaut ne remonte aucun Warning de plan (le scope ne bruite pas la validation)', () => {
    const clean = fermeScene([zoneRect('forge', 'Forge', 1, 1, 3, 3, 'interior'), zoneRect('pre', 'Pré communal', 5, 1, 2, 2, 'exterior')]);
    expect(validateScene([clean]).filter((wa) => wa.scope === 'plan')).toEqual([]);
  });
});

/** Plan 6×3 à deux étages, dessiné pour isoler la seule question de la COTE :
 *  - z0 : `plancher` partout ; ses cotes sont le SEUL paramètre que les épreuves font varier ;
 *  - z1 : dalle x0-x1 (toute la hauteur), vide de x2 à x5 — vide qui rejoint le bord, donc le dehors ;
 *  - murs z1 : périmètre de la dalle FERMÉ, sauf l'arête E de (1,1) — l'unique ouverture sur le vide ;
 *  - zone descriptive obligatoire (sans elle `auditFacade` refuse tout verdict). */
function flightScene(heights: Record<string, number>): Scene {
  const w = 6, h = 3;
  const z0 = new Array(w * h).fill('plancher');
  const z1 = Array.from({ length: w * h }, (_, i) => (i % w <= 1 ? 'plancher' : 'vide'));
  const height = new Array<number>(w * h).fill(0);
  for (const [key, m] of Object.entries(heights)) {
    const [x, y] = key.split(',').map(Number);
    height[y * w + x] = m;
  }
  const zones: SceneEffectZone[] = [
    { id: 'corps', label: 'Corps de logis', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w, h }, z: 0 },
  ];
  // Forme canonique de stockage (`N`/`E` seulement, cf. `scene.ts`) : S de (x,y) = N de (x,y+1), O de (x,y) = E de (x-1,y).
  const walls: WallSeg[] = [
    { x: 0, y: 0, side: 'N', z: 1 }, { x: 1, y: 0, side: 'N', z: 1 },
    { x: 0, y: 3, side: 'N', z: 1 }, { x: 1, y: 3, side: 'N', z: 1 },
    { x: -1, y: 0, side: 'E', z: 1 }, { x: -1, y: 1, side: 'E', z: 1 }, { x: -1, y: 2, side: 'E', z: 1 },
    { x: 1, y: 0, side: 'E', z: 1 }, { x: 1, y: 2, side: 'E', z: 1 },
  ];
  return makeScene(w, h, [{ z: 0, tiles: z0, height }, { z: 1, tiles: z1 }], zones, walls);
}

/** Rampe complète : quatre marches de 1 m en 1 m jusqu'au plancher de z1 (4 m). */
const RAMPE = { '2,1': 1, '3,1': 2, '4,1': 3, '5,1': 4 };

describe('trémie de VOLÉE — le vide qui surplombe une rampe cotée n’est pas un périmètre ouvert', () => {
  it('un VRAI trou de périmètre (sol plat sous le vide) reste un mur manquant', () => {
    const defects = auditFacade(flightScene({}), 1, 0).filter((d) => d.family === 'mur-manquant');
    expect(defects.map((d) => `${d.x},${d.y}${d.side}`)).toEqual(['1,1E']);
  });

  it('la MÊME dalle, le vide coté en volée jusqu’au plancher de z1 : aucun mur manquant (seule la cote a changé)', () => {
    expect(auditFacade(flightScene(RAMPE), 1, 0).filter((d) => d.family === 'mur-manquant')).toEqual([]);
  });

  it('un simple ressaut, coté au-dessus du sol mais qui n’atteint jamais le plancher du dessus, reste signalé', () => {
    const estrade = { '2,1': 1, '3,1': 2, '4,1': 3, '5,1': 3 };
    const defects = auditFacade(flightScene(estrade), 1, 0).filter((d) => d.family === 'mur-manquant');
    expect(defects.map((d) => `${d.x},${d.y}${d.side}`)).toEqual(['1,1E']);
    expect(stairFlightCells(flightScene(estrade), 0, 1).size).toBe(0);
  });

  it('la volée retenue est la file de marches, jamais le plan de base : sur un sol plat coté 0 m, l’ensemble est vide', () => {
    expect(stairFlightCells(flightScene({}), 0, 1)).toEqual(new Set());
    expect([...stairFlightCells(flightScene(RAMPE), 0, 1)].sort()).toEqual(['2,1', '3,1', '4,1', '5,1']);
  });

  it('auditStairwells — un trou de plancher au-dessus d’une marche est LÉGITIME sans aucune recette ASCII', () => {
    const w = 5, h = 3;
    const z0 = new Array(w * h).fill('plancher');
    const z1 = Array.from({ length: w * h }, (_, i) => (i === 1 * w + 2 ? 'vide' : 'plancher'));
    const height = new Array<number>(w * h).fill(0);
    height[1 * w + 2] = 4; // marche affleurant le plancher de z1
    const scene = makeScene(w, h, [{ z: 0, tiles: z0, height }, { z: 1, tiles: z1 }], []);

    const tremies = auditStairwells(scene, 1, 0, undefined, () => 'plancher');
    expect(tremies).toHaveLength(1);
    expect(tremies[0]).toMatchObject({ x: 2, y: 1, z: 1, legitimate: true });

    // CONTRE-ÉPREUVE : sans la cote, le même trou redevient SUSPECT — c'est bien le relief qui l'explique.
    const plat = makeScene(w, h, [{ z: 0, tiles: z0 }, { z: 1, tiles: z1 }], []);
    expect(auditStairwells(plat, 1, 0, undefined, () => 'plancher')[0].legitimate).toBe(false);
  });
});

/** Plan 6×3 à deux étages où la dalle d'étage est une bande x1-x3 sur y1. Seul `builtAt` (les cases du
 *  rez posées en `plancher`, le reste en `route`) change d'une épreuve à l'autre : l'APPUI est donc la
 *  seule variable. */
function slabScene(builtAt: string[], slab: string[] = ['1,1', '2,1', '3,1'], zones: SceneEffectZone[] = []): Scene {
  const w = 6, h = 3;
  const z0 = new Array(w * h).fill('route');
  for (const key of builtAt) {
    const [x, y] = key.split(',').map(Number);
    z0[y * w + x] = 'plancher';
  }
  const z1 = new Array(w * h).fill('vide');
  for (const key of slab) {
    const [x, y] = key.split(',').map(Number);
    z1[y * w + x] = 'plancher';
  }
  return makeScene(w, h, [{ z: 0, tiles: z0 }, { z: 1, tiles: z1 }], zones);
}

describe('APPUI d’une dalle d’étage — porter, ce n’est pas avoir du bâti sous chaque case', () => {
  it('une dalle qui ne repose NULLE PART flotte : toutes ses cases sont signalées', () => {
    const defects = auditUnsupportedFloor(slabScene([]), 1, 0, groundTerrains());
    expect(defects.map((d) => `${d.x},${d.y}`)).toEqual(['1,1', '2,1', '3,1']);
  });

  it('CONTRE-ÉPREUVE appariée : la MÊME dalle, avec du bâti sous sa case CENTRALE, n’est plus signalée — ses deux rives touchent l’appui', () => {
    expect(auditUnsupportedFloor(slabScene(['2,1']), 1, 0, groundTerrains())).toEqual([]);
  });

  it('le MÊME appui unique, reporté à un BOUT de la dalle, ne la tient plus : sa case du fond pend derrière l’autre', () => {
    const defects = auditUnsupportedFloor(slabScene(['3,1']), 1, 0, groundTerrains());
    expect(defects.map((d) => `${d.x},${d.y}`)).toEqual(['1,1', '2,1']);
  });

  it('une dalle VOISINE mais déconnectée ne prête pas son appui : elle est jugée sur sa propre composante', () => {
    const scene = slabScene(['5,1'], ['1,1', '2,1', '3,1', '5,1']); // (4,1) reste vide : deux composantes
    const defects = auditUnsupportedFloor(scene, 1, 0, groundTerrains());
    expect(defects.map((d) => `${d.x},${d.y}`)).toEqual(['1,1', '2,1', '3,1']);
  });

  it('PORTE COCHÈRE : une travée qui enjambe la voie des calèches, portée de part et d’autre, ne produit aucun défaut', () => {
    // z0 : `route` en x2 (la voie), `plancher` partout ailleurs sur la bande — l'aile enjambe le passage.
    const scene = slabScene(['0,1', '1,1', '3,1', '4,1'], ['0,1', '1,1', '2,1', '3,1', '4,1']);
    expect(auditUnsupportedFloor(scene, 1, 0, groundTerrains())).toEqual([]);
  });

  it('ENCORBELLEMENT : une dalle qui déborde au-dessus d’une cour, portée par le bâti, n’est pas « au-dessus du dehors »', () => {
    const zones: SceneEffectZone[] = [
      { id: 'corps', label: 'Corps de logis', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 3 }, z: 0 },
      { id: 'cour', label: 'Cour', presentation: 'exterior', area: { kind: 'rect', x: 2, y: 0, w: 4, h: 3 }, z: 0 },
    ];
    const porte = slabScene(['1,1'], ['1,1', '2,1'], zones);
    expect(auditZoneCoverage(porte, 1, 0).filter((d) => d.family === 'etage-sur-exterior')).toEqual([]);

    // CONTRE-ÉPREUVE appariée : la MÊME dalle au-dessus de la MÊME cour, sans aucun appui, est signalée.
    const flottante = slabScene([], ['1,1', '2,1', '3,1'], zones);
    const dehors = auditZoneCoverage(flottante, 1, 0).filter((d) => d.family === 'etage-sur-exterior');
    expect(dehors.map((d) => `${d.x},${d.y}`)).toEqual(['2,1', '3,1']);
  });

  /** Dalle PLEINE 8×8 posée sur un rez de `route`, sauf aux cases `builtAt` qui restent `plancher` :
   *  la seule variable est le NOMBRE et la place des appuis sous une dalle d'un seul tenant. */
  function wideSlabScene(builtAt: string[]): Scene {
    const w = 8, h = 8;
    const z0 = new Array(w * h).fill('route');
    for (const key of builtAt) {
      const [x, y] = key.split(',').map(Number);
      z0[y * w + x] = 'plancher';
    }
    return makeScene(w, h, [{ z: 0, tiles: z0 }, { z: 1, tiles: new Array(w * h).fill('plancher') }], []);
  }

  it('UN SEUL point d’appui sous une grande dalle ne la porte PAS : tout ce qui pend derrière lui est un porte-à-faux', () => {
    const scene = wideSlabScene(['0,0']);
    const porte = supportedFloorCells(scene, 1, 0);
    expect([...porte]).toEqual(['0,0']); // l'appui porte sa propre case, et rien d'autre ne reprend la charge

    const defects = auditUnsupportedFloor(scene, 1, 0, groundTerrains());
    expect(defects).toHaveLength(8 * 8 - 1);
    expect(defects.some((d) => d.x === 7 && d.y === 7)).toBe(true); // le coin opposé, à l'autre bout de la dalle
  });

  it('CONTRE-ÉPREUVE appariée : la MÊME dalle sur une GRILLE de piliers ne produit AUCUN défaut — chaque travée est reprise de part et d’autre, et sa rive touche le pilier d’angle', () => {
    const builtAt: string[] = [];
    for (let y = 0; y < 8; y += 3) for (let x = 0; x < 8; x += 3) builtAt.push(`${x},${y}`);
    expect(auditUnsupportedFloor(wideSlabScene(builtAt), 1, 0, groundTerrains())).toEqual([]);
  });

  /** Bande d'étage continue (y=1) au-dessus d'un rez `plancher` percé d'une VOIE de `route` large de
   *  `voie` cases (x=1..voie) : la seule variable est la travée à franchir entre les deux appuis. */
  function traveeScene(voie: number, zones: SceneEffectZone[] = []): Scene {
    const w = voie + 3, h = 3;
    const z0 = new Array(w * h).fill('plancher');
    for (let x = 1; x <= voie; x++) for (let y = 0; y < h; y++) z0[y * w + x] = 'route';
    const z1 = new Array(w * h).fill('vide');
    for (let x = 0; x < w; x++) z1[1 * w + x] = 'plancher';
    return makeScene(w, h, [{ z: 0, tiles: z0 }, { z: 1, tiles: z1 }], zones);
  }

  /** Bande d'étage (y=1) en SURPLOMB : le rez n'est bâti que sur sa colonne x=0, la dalle continue
   *  au-dessus de la `route` sur `debord` cases, et RIEN ne la reprend de l'autre côté. */
  function porteAFauxScene(debord: number, zones: SceneEffectZone[] = []): Scene {
    const w = debord + 1, h = 3;
    const z0 = new Array(w * h).fill('route');
    for (let y = 0; y < h; y++) z0[y * w] = 'plancher';
    const z1 = new Array(w * h).fill('vide');
    for (let x = 0; x < w; x++) z1[1 * w + x] = 'plancher';
    return makeScene(w, h, [{ z: 0, tiles: z0 }, { z: 1, tiles: z1 }], zones);
  }

  it('PORTE COCHÈRE : une voie large de 2 cases, portée des deux côtés, s’enjambe sans défaut', () => {
    expect(auditUnsupportedFloor(traveeScene(2), 1, 0, groundTerrains())).toEqual([]);
  });

  it('une travée reprise des DEUX côtés ne flotte à AUCUNE largeur — le verdict est structurel, jamais une distance comparée à un seuil (qu’il vaille 3, 10 ou 100)', () => {
    for (const voie of [2, 4, 7, 20, 41, 201]) {
      expect(auditUnsupportedFloor(traveeScene(voie), 1, 0, groundTerrains()), `voie de ${voie} cases`).toEqual([]);
    }
  });

  it('ENCORBELLEMENT : une case de débord, au contact du bâti, tient toute seule', () => {
    expect(auditUnsupportedFloor(porteAFauxScene(1), 1, 0, groundTerrains())).toEqual([]);
  });

  it('PORTE-À-FAUX : dès qu’une case pend derrière une autre, le surplomb ENTIER est signalé, sa case au contact du bâti comprise', () => {
    const deux = auditUnsupportedFloor(porteAFauxScene(2), 1, 0, groundTerrains());
    expect(deux.map((d) => `${d.x},${d.y}`)).toEqual(['1,1', '2,1']);

    const galerie = auditUnsupportedFloor(porteAFauxScene(4), 1, 0, groundTerrains());
    expect(galerie.map((d) => `${d.x},${d.y}`)).toEqual(['1,1', '2,1', '3,1', '4,1']);
  });

  it('le verdict ne dépend d’AUCUNE échelle métrique de Scène : mêmes cases signalées à 0,5 m/case comme à 10 m/case (Scène MER)', () => {
    const flottantes = (scene: Scene) => auditUnsupportedFloor(scene, 1, 0, groundTerrains()).map((d) => `${d.x},${d.y}`);
    for (const metresPerTile of [0.5, 2, 10]) {
      expect(flottantes({ ...porteAFauxScene(2), metresPerTile }), `à ${metresPerTile} m/case`).toEqual(['1,1', '2,1']);
      expect(flottantes({ ...porteAFauxScene(1), metresPerTile }), `à ${metresPerTile} m/case`).toEqual([]);
      expect(flottantes({ ...traveeScene(20), metresPerTile }), `à ${metresPerTile} m/case`).toEqual([]);
    }
  });

  it('le message d’auteur nomme les deux façons de reprendre la charge, et le GESTE de correction', () => {
    const [flottante] = auditUnsupportedFloor(porteAFauxScene(2), 1, 0, groundTerrains());
    expect(flottante.message).toContain('linteau, arche, porte cochère');
    expect(flottante.message).toContain('encorbellement');
    expect(flottante.message).toContain('Pose un appui bâti sous ce surplomb');
  });

  it('SURPLOMB au-dessus d’une cour : repris des deux côtés il ne dit rien, en porte-à-faux il est signalé', () => {
    const zonesDe = (w: number, voie: number): SceneEffectZone[] => [
      { id: 'corps-o', label: 'Corps ouest', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 1, h: 3 }, z: 0 },
      { id: 'cour', label: 'Cour', presentation: 'exterior', area: { kind: 'rect', x: 1, y: 0, w: voie, h: 3 }, z: 0 },
      { id: 'corps-e', label: 'Corps est', presentation: 'interior', area: { kind: 'rect', x: voie + 1, y: 0, w: w - voie - 1, h: 3 }, z: 0 },
    ];
    const porte = auditZoneCoverage(traveeScene(6, zonesDe(9, 6)), 1, 0);
    expect(porte.filter((d) => d.family === 'etage-sur-exterior')).toEqual([]);

    const cour: SceneEffectZone[] = [
      { id: 'corps', label: 'Corps de logis', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 1, h: 3 }, z: 0 },
      { id: 'cour', label: 'Cour', presentation: 'exterior', area: { kind: 'rect', x: 1, y: 0, w: 3, h: 3 }, z: 0 },
    ];
    const surplomb = auditZoneCoverage(porteAFauxScene(3, cour), 1, 0);
    expect(surplomb.filter((d) => d.family === 'etage-sur-exterior').map((d) => `${d.x},${d.y}`)).toEqual(['1,1', '2,1', '3,1']);
  });
});

describe('cases FAUTIVES d’un défaut de zone — l’éditeur les allume toutes, l’auteur ne les recompte pas', () => {
  const aCheval = () => zoneRect('salle', 'Salle commune', 3, 1, 2, 3, 'interior');

  it('zoneOutsideBuildingTiles rend EXACTEMENT les cases hors des murs d’une zone à cheval sur le périmètre', () => {
    const zone = aCheval();
    expect(zoneOutsideBuildingTiles(fermeScene([zone]), zone)).toEqual([{ x: 4, y: 1, z: 0 }, { x: 4, y: 2, z: 0 }, { x: 4, y: 3, z: 0 }]);
  });

  it('une zone entièrement close n’a aucune case fautive', () => {
    const zone = zoneRect('forge', 'Forge', 1, 1, 3, 3, 'interior');
    expect(zoneOutsideBuildingTiles(fermeScene([zone]), zone)).toEqual([]);
  });

  it('un défaut « zone débordante » porte ses cases fautives, autant que la zone en a hors des murs', () => {
    const zone = aCheval();
    const scene = fermeScene([zone]);
    const [debordante] = scenePlanDefects(scene).filter((d) => d.family === 'zone-debordante');
    expect(debordante.at.kind).toBe('zone');
    if (debordante.at.kind !== 'zone') return;
    expect(debordante.at.tiles).toEqual(zoneOutsideBuildingTiles(scene, zone));
    expect(debordante.at.tiles).toHaveLength(3);
  });
});

describe('BORD DE LA CARTE — le dehors s’amorce PAR le bord, et un plan qui s’appuie dessus se DIT', () => {
  /** Grille de plain-pied entièrement plancheiée : SEULS les murs varient d'une épreuve à l'autre. */
  const grille = (walls: WallSeg[], w = 8, h = 8): Scene =>
    makeScene(w, h, [{ z: 0, tiles: new Array(w * h).fill('plancher') }], [], walls);

  /** Pièce 3×3 adossée au coin (0,0) dont l'auteur n'a tracé que les murs INTERNES (E de x=2, S de y=2) :
   *  il compte sur le bord de la carte pour fermer les deux autres côtés. */
  const adosseeAuCoin = (): WallSeg[] => {
    const walls: WallSeg[] = [];
    for (let y = 0; y <= 2; y++) walls.push({ x: 2, y, side: 'E' });
    for (let x = 0; x <= 2; x++) walls.push({ x, y: 3, side: 'N' });
    return walls;
  };

  it('la pièce adossée au coin ne se devine pas : rien n’y est clos, et ses DEUX extrémités libres sont nommées', () => {
    const scene = grille(adosseeAuCoin());
    expect(interiorCells(scene, 0).size).toBe(0); // le dehors entre par le bord : la pièce n'existe pas
    const defects = scenePlanDefects(scene).filter((d) => d.family === 'mur-arrete-au-bord');
    expect(defects.map((d) => (d.at.kind === 'edge' ? `${d.at.x},${d.at.y}${d.at.side}` : d.at.kind))).toEqual(['2,0E', '0,3N']);
    expect(defects[0].message).toContain('Prolonge les murs le long du bord');
  });

  it('CONTRE-ÉPREUVE : la MÊME pièce mise EN RETRAIT d’une case referme sa boucle — 9 cases intérieures, plus un mot', () => {
    const scene = grille(perimeterWallSegs([{ x: 1, y: 1, w: 3, h: 3 }]));
    expect(interiorCells(scene, 0).size).toBe(9);
    expect(scenePlanDefects(scene)).toEqual([]);
  });

  it('CONTRE-ÉPREUVE : la boucle FERMÉE LE LONG DU BORD (l’autre geste que le message propose) clôt aussi la pièce, et une cloison plantée dedans ne crée aucune extrémité', () => {
    const contreLeBord = perimeterWallSegs([{ x: 0, y: 0, w: 4, h: 4 }]);
    expect(interiorCells(grille(contreLeBord), 0).size).toBe(16);
    expect(scenePlanDefects(grille(contreLeBord))).toEqual([]);
    const cloison: WallSeg[] = [0, 1, 2, 3].map((y) => ({ x: 1, y, side: 'E' as const }));
    expect(scenePlanDefects(grille([...contreLeBord, ...cloison]))).toEqual([]); // jonctions en T aux deux bouts
  });

  it('une enceinte AU RAS du bord ne laisse plus aucune case à l’air libre : la carte entière basculerait en intérieur, et le défaut le dit — UNE fois pour l’étage', () => {
    const scene = grille(perimeterWallSegs([{ x: 0, y: 0, w: 8, h: 8 }]));
    expect(outdoorCells(scene, 0).size).toBe(0);
    expect(interiorCells(scene, 0).size).toBe(64); // toute la grille, toiture comprise
    const defects = scenePlanDefects(scene).filter((d) => d.family === 'enceinte-au-bord');
    expect(defects).toHaveLength(1); // un défaut par étage, jamais un par arête de bord
    expect(defects[0].at).toEqual({ kind: 'edge', x: 0, y: 0, side: 'N', z: 0 });
    expect(defects[0].message).toContain('en retrait');
  });

  it('CONTRE-ÉPREUVE : la MÊME enceinte reculée d’une case rend son pourtour au dehors et se tait', () => {
    const scene = grille(perimeterWallSegs([{ x: 1, y: 1, w: 6, h: 6 }]));
    expect(outdoorCells(scene, 0).size).toBe(64 - 36);
    expect(scenePlanDefects(scene)).toEqual([]);
  });

  it('un plan SANS aucun mur ne se signale pas : ces familles jugent une grille de murs, jamais une absence de murs', () => {
    expect(scenePlanDefects(grille([]))).toEqual([]);
  });

  it('une PORTE plantée seule, sans mur à ses coins, se dit — nommée par son arête', () => {
    const defects = scenePlanDefects(scenePorteOrpheline()).filter((d) => d.family === 'porte-orpheline');
    expect(defects).toHaveLength(1);
    expect(defects[0].at).toEqual({ kind: 'edge', x: 5, y: 5, side: 'N', z: 0 });
    expect(defects[0].message).toContain('la porte N de (5,5)');
  });

  it('CONTRE-ÉPREUVE : la MÊME porte PERCÉE dans le périmètre d’une pièce se tait — c’est la jonction aux coins qui tranche, jamais la porte elle-même', () => {
    const perimetre = perimeterWallSegs([{ x: 1, y: 1, w: 3, h: 3 }]);
    const percee = perimetre.map((seg, i) => (i === 0 ? { ...seg, door: true } : seg));
    expect(percee.some((seg) => seg.door)).toBe(true);
    expect(scenePlanDefects(grille(percee))).toEqual([]);
  });

  it('une porte posée sur une DIAGONALE n’est pas jugée ici : une diagonale ne s’accroche à aucun coin de la trame', () => {
    const scene = grille([{ x: 5, y: 5, side: '\\', door: true } as WallSeg]);
    expect(scenePlanDefects(scene).filter((d) => d.family === 'porte-orpheline')).toEqual([]);
  });

  describe('le POINT D’ENTRÉE se mémoïse par identité de Scène — l’éditeur revalide à chaque frappe', () => {
    it('deux appels sur la MÊME réf rendent le MÊME tableau ; une réf neuve le recalcule, à l’identique', () => {
      const scene = scenePorteOrpheline();
      const premier = scenePlanDefects(scene);
      expect(scenePlanDefects(scene)).toBe(premier);
      const copie: Scene = { ...scene };
      const recalcule = scenePlanDefects(copie);
      expect(recalcule).not.toBe(premier);
      expect(recalcule).toEqual(premier);
    });

    it('une scène ÉDITÉE (nouvelle réf, comme toute mutation d’état) rend le verdict de sa NOUVELLE forme', () => {
      const avec = scenePorteOrpheline();
      expect(scenePlanDefects(avec).filter((d) => d.family === 'porte-orpheline')).toHaveLength(1);
      const corrigee: Scene = { ...avec, walls: [] };
      expect(scenePlanDefects(corrigee)).toEqual([]);
    });
  });
});

describe('MUR EN IMPASSE — une cloison qui ne rejoint rien ne ferme rien (famille 11)', () => {
  /** Grille 9×9 entièrement plancheiée, sauf les cases citées, mises au `terrain` donné : SEULS les
   *  murs et l'obstacle varient d'une épreuve à l'autre. */
  const grille = (walls: WallSeg[], obstacles: string[] = [], terrain = 'vide'): Scene => {
    const w = 9, h = 9;
    const tiles = new Array(w * h).fill('plancher');
    for (const key of obstacles) { const [x, y] = key.split(',').map(Number); tiles[y * w + x] = terrain; }
    return makeScene(w, h, [{ z: 0, tiles }], [], walls);
  };
  const impasses = (scene: Scene) =>
    auditWallDeadEndsInside(scene, 0).map((d) => (d.at.kind === 'edge' ? `${d.at.x},${d.at.y}${d.at.side}` : d.at.kind));
  const close = perimeterWallSegs([{ x: 1, y: 1, w: 5, h: 5 }]);
  /** Refend parti du mur ouest de la pièce close, arrêté au coin (x+1,3). */
  const refend = (jusqua: number): WallSeg[] =>
    Array.from({ length: jusqua }, (_, i) => ({ x: 1 + i, y: 3, side: 'N' as const }));

  it('une cloison qui s’arrête AU MILIEU de la pièce nomme son seul bout libre, et le geste de correction', () => {
    const defects = auditWallDeadEndsInside(grille([...close, ...refend(3)]), 0);
    expect(defects.map((d) => (d.at.kind === 'edge' ? `${d.at.x},${d.at.y}${d.at.side}` : d.at.kind))).toEqual(['3,3N']);
    expect(defects[0].message).toContain('finit au coin (4,3)');
    expect(defects[0].message).toContain("Prolonge-la jusqu'au mur qu'elle devait rejoindre");
  });

  it('CONTRE-ÉPREUVE : la MÊME cloison PROLONGÉE jusqu’au mur d’en face fait une jonction en T à chaque bout — plus un mot', () => {
    expect(impasses(grille([...close, ...refend(5)]))).toEqual([]);
  });

  it('un segment dont les DEUX coins sont libres est ISOLÉ — deux défauts, un par bout, et le message le dit', () => {
    const defects = auditWallDeadEndsInside(grille([{ x: 4, y: 4, side: 'N' }]), 0);
    expect(defects).toHaveLength(2);
    expect(defects.every((d) => d.message.includes('est ISOLÉ'))).toBe(true);
    expect(defects[0].at).toEqual({ kind: 'edge', x: 4, y: 4, side: 'N', z: 0 });
  });

  it('un bout libre posé sur le BORD de la carte n’est PAS une impasse : c’est l’amorce du dehors, et la famille 9 le dit déjà', () => {
    const adossee: WallSeg[] = [
      ...[0, 1, 2].map((y) => ({ x: 2, y, side: 'E' as const })),
      ...[0, 1, 2].map((x) => ({ x, y: 3, side: 'N' as const })),
    ];
    const scene = grille(adossee);
    expect(impasses(scene)).toEqual([]);
    expect(scenePlanDefects(scene).filter((d) => d.family === 'mur-arrete-au-bord')).toHaveLength(2);
  });

  it('un refend qui meurt sur un quadrant que le pas ne FOULE PAS n’est pas une impasse — le vide comme l’eau, et quel que soit le quadrant', () => {
    for (const terrain of ['vide', 'eau']) {
      expect(terrainWalkable(terrain), `${terrain} doit être infranchissable au dataset`).toBe(false);
      for (const quadrant of ['4,3', '4,2', '3,3', '3,2']) // les quatre cases qui touchent le coin (4,3)
        expect(impasses(grille([...close, ...refend(3)], [quadrant], terrain)), `${terrain} en ${quadrant}`).toEqual([]);
    }
  });

  it('CONTRE-ÉPREUVE : le MÊME obstacle déplacé HORS des quadrants du coin rend l’impasse — c’est bien le quadrant infranchissable qui exempte, pas sa présence sur la carte', () => {
    for (const terrain of ['vide', 'eau'])
      expect(impasses(grille([...close, ...refend(3)], ['5,4'], terrain)), terrain).toEqual(['3,3N']);
  });

  it('un terrain bâti mais FRANCHISSABLE ne dispense de rien : seul le pas tranche, jamais la matière', () => {
    expect(terrainWalkable('dalle')).toBe(true);
    expect(impasses(grille([...close, ...refend(3)], ['4,3'], 'dalle'))).toEqual(['3,3N']);
  });

  it('une porte percée dans une cloison CLOSE ne crée aucune impasse — c’est la jonction aux coins qui tranche', () => {
    const percee = close.map((seg, i) => (i === 0 ? { ...seg, door: true } : seg));
    expect(impasses(grille(percee))).toEqual([]);
  });

  it('une DIAGONALE n’est pas jugée ici : elle ne s’accroche à aucun coin de la trame', () => {
    expect(impasses(grille([{ x: 5, y: 5, side: '\\' } as WallSeg]))).toEqual([]);
  });
});
