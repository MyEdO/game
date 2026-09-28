import { describe, expect, it } from 'vitest';
import { cutawayForSection, cutawayOverhead, exteriorWallViewZ, frontFacadeCutaway, spaceCellKey, type ClearedSpace, type Lid } from './architectureVisibility';
import { occludesActor, type Dims } from '../../geometry/iso';
import { elOccluder } from './occluders';
import { buildRoofs, clearedSpace, massFootprintCells, massRoomZoneIds } from '../builders/roofs';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { emptyScene, heightAt, type BuildingMass, type Scene, type WallSeg } from '../../state/scene';
import { actorCapsuleOf } from './actorCapsule';
import { buildWalls } from '../builders/walls';
import { buildFloors } from '../builders/floors';
import { diligenceCampaign, paquetDuJeu } from '../../scenes/campaign';
import { sceneZoneTiles } from '../../state/zones';
import { computeStateVisible } from '../../state/visionState';

/** Un allié dans une PIÈCE : la pièce dégagée, et les cases qu'elle couvre. */
const piece = (id: string, cells: string[]): ClearedSpace =>
  ({ zoneIds: new Set([id]), zoneCells: new Map([[id, new Set(cells)]]), roomlessCells: new Set(), overheadCells: new Set(), seenSections: null });
/** Un allié sous un bâti SANS pièce déclarée : l'emprise du bâtiment qui l'abrite. */
const emprise = (cells: string[]): ClearedSpace =>
  ({ zoneIds: new Set(), zoneCells: new Map(), roomlessCells: new Set(cells), overheadCells: new Set(), seenSections: null });

describe('cutawayForSection', () => {
  it('masque une section dont la PIÈCE est occupée', () => {
    expect(cutawayForSection({ roomZoneIds: ['salle'], cells: ['3,3,0'] }, piece('salle', ['3,3,0']))).toBe('hidden');
    expect(cutawayForSection({ roomZoneIds: ['cuisine'], cells: ['3,3,0'] }, piece('salle', ['3,3,0']))).toBe('visible');
  });

  it('masque une section SANS pièce dont l’EMPRISE est dégagée — le bâti pas encore zoné suit la même loi', () => {
    expect(cutawayForSection({ cells: ['3,3,0'] }, emprise(['3,3,0']))).toBe('hidden');
    expect(cutawayForSection({ cells: ['9,9,0'] }, emprise(['3,3,0']))).toBe('visible');
  });
});

describe('exteriorWallViewZ', () => {
  it('rend toute l’élévation depuis l’extérieur et revient à l’étage actif dans une pièce', () => {
    expect(exteriorWallViewZ(0, false, [0, 1])).toBe(1);
    expect(exteriorWallViewZ(0, true, [0, 1])).toBe(0);
    expect(exteriorWallViewZ(1, false, [0, 1])).toBe(1);
  });
});

describe('frontFacadeCutaway', () => {
  const panel = { roomZoneIds: ['salle'], x: 3, y: 3, z: 0, side: 'E' as const };

  it.each([
    ['N', '3,3,0', [false, false, true, true]],
    ['N', '3,2,0', [true, true, false, false]],
    ['E', '3,3,0', [true, false, false, true]],
    ['E', '4,3,0', [false, true, true, false]],
  ] as const)('dérive les deux normales de %s depuis la pièce', (side, tile, expected) => {
    for (const rot of [0, 1, 2, 3] as const)
      expect(frontFacadeCutaway({ ...panel, side }, piece('salle', [tile]), { w: 8, h: 8, rot })).toBe(expected[rot]);
  });

  it.each([
    ['N', '3,3,0', [false, false, true, true]],
    ['E', '3,3,0', [true, false, false, true]],
  ] as const)('tombe pareil sur %s quand le dedans est une EMPRISE sans pièce', (side, tile, expected) => {
    for (const rot of [0, 1, 2, 3] as const)
      expect(frontFacadeCutaway({ x: 3, y: 3, z: 0, side }, emprise([tile]), { w: 8, h: 8, rot })).toBe(expected[rot]);
  });

  it('garde une façade non liée entière même si elle est frontale', () => {
    expect(frontFacadeCutaway({ ...panel, roomZoneIds: ['cuisine'] }, piece('salle', ['3,3,0']), { w: 8, h: 8, rot: 0 })).toBe(false);
  });

  it('refuse une arête diagonale non authorable', () => {
    expect(frontFacadeCutaway({ ...panel, side: '\\' }, piece('salle', ['3,3,0']), { w: 8, h: 8, rot: 0 })).toBe(false);
  });
});

/** Le dégagement se lit par UNE loi partagée : ce que le toit lève, le mur le voit dedans, et la
 *  façade frontale tombe du même geste — un bâtiment décoiffé mais emmuré est la signature de deux
 *  lois divergentes. Ce que l'ESPACE dégagé contient (pièce déclarée, ou emprise d'un bâti pas encore
 *  zoné) est la seule entrée de la loi. */
const cut = (scene: Scene, allies: { x: number; y: number; z: number }[]) => {
  const cleared = clearedSpace(scene, allies);
  const z = allies[0].z;
  const dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: 0 } as const;
  const pans = buildRoofs(scene, { allies }).filter((el) => el.states.roofOccupied);
  const facades = buildWalls(scene, undefined, { activeZ: z, viewZ: z })
    .filter((panel) => frontFacadeCutaway({ ...panel, x: panel.cell.x, y: panel.cell.y, z: panel.cell.z }, cleared, dims));
  return { cleared, pans, facades, cases: new Set(pans.flatMap((el) => el.cells.map((c) => `${c.x},${c.y}`))) };
};

describe('dégagement — une seule loi pour toits et façades, sur un bâti SANS pièce déclarée', () => {
  /** Un bâti non zoné PAR CONSTRUCTION : une masse de toit, sa ceinture de murs, aucune pièce. La
   *  condition que la loi exige se bâtit ici — une carte d'auteur est une donnée vivante, elle a le
   *  droit de zoner tout son bâti du jour au lendemain. */
  const hangarSansPiece = (): Scene => {
    const scene = emptyScene(12, 12);
    const emprise = { x: 3, y: 3, w: 4, h: 4 };
    const masse: BuildingMass = {
      id: 'toit-hangar', z: 0, footprint: [emprise], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 45, material: 'tuile',
    };
    scene.architecture = [{ id: 'hangar', label: 'Hangar', style: 'maison', storeys: [], facades: [], masses: [masse] }];
    const murs: WallSeg[] = [];
    for (let x = emprise.x; x < emprise.x + emprise.w; x++) {
      murs.push({ x, y: emprise.y, side: 'N' }); // arête nord de l'emprise
      murs.push({ x, y: emprise.y + emprise.h, side: 'N' }); // arête sud (au nord de la case d'après)
    }
    for (let y = emprise.y; y < emprise.y + emprise.h; y++) {
      murs.push({ x: emprise.x - 1, y, side: 'E' }); // arête ouest (à l'est de la case d'avant)
      murs.push({ x: emprise.x + emprise.w - 1, y, side: 'E' }); // arête est
    }
    scene.walls = murs;
    return scene;
  };
  const dedans = { x: 4, y: 4, z: 0 };

  it('l’allié sans pièce dégage l’EMPRISE qui l’abrite', () => {
    const { cleared } = cut(hangarSansPiece(), [dedans]);
    expect(cleared.roomlessCells.has(`${dedans.x},${dedans.y},${dedans.z}`)).toBe(true);
  });

  it('sous un bâti non zoné, la façade frontale tombe avec la toiture', () => {
    const { pans, facades } = cut(hangarSansPiece(), [dedans]);
    expect(pans.length).toBeGreaterThan(0);
    expect(facades.length).toBeGreaterThan(0);
  });

  it('sur une case couverte non zonée, les deux lectures s’accordent : ce que le toit dégage, le mur le voit dedans', () => {
    const { cleared, pans } = cut(hangarSansPiece(), [dedans]);
    expect(pans.length).toBeGreaterThan(0);
    for (const el of pans)
      for (const cell of el.cells)
        expect(cutawayForSection({ cells: [`${cell.x},${cell.y},${dedans.z}`] }, cleared)).toBe('hidden');
  });
});

/** La carte authorée « La Diligence » est une donnée VIVANTE : on n'y mesure que des RELATIONS —
 *  aucun compte ni aucune pièce nommée en dur, tout se re-dérive de la carte à la lecture. */
describe('dégagement — chemin réel (La Diligence)', () => {
  const scene = paquetDuJeu(diligenceCampaign).scenes[0];
  const masses = effectiveArchitecture(scene)
    .flatMap((corps) => corps.masses.map((masse) => ({ masse, cells: massFootprintCells(masse.footprint) })));
  const travees = (pieceId: string) =>
    masses.filter(({ masse, cells }) => massRoomZoneIds(scene, masse, cells).includes(pieceId));

  it('entrer dans une pièce ouvre l’espace ENTIER de la pièce, pas la travée où l’on pose le pied', () => {
    // La pièce que le plus de travées de charpente traversent : c'est là que la confusion « travée
    // piétinée » vs « espace habité » se voit. Le découpage en travées est une vérité de SILHOUETTE.
    const pieces = (scene.effectZones ?? []).filter((zone) => zone.presentation === 'interior');
    const [piece] = [...pieces].sort((a, b) => travees(b.id).length - travees(a.id).length);
    const couverture = new Set(travees(piece.id).flatMap(({ cells }) => [...cells]));
    const [tuile] = sceneZoneTiles(piece);
    const { cases } = cut(scene, [{ x: tuile.x, y: tuile.y, z: tuile.z ?? piece.z ?? 0 }]);
    const couvertes = sceneZoneTiles(piece).filter((t) => couverture.has(`${t.x},${t.y}`));
    expect(couvertes.length).toBeGreaterThan(0);
    for (const tile of couvertes) expect(cases.has(`${tile.x},${tile.y}`)).toBe(true);
  });
});

/** LE COUVERCLE (#907). Un passage couvert, une halle, un porche : le groupe s'y tient SOUS une masse
 *  dont il n'occupe aucun niveau. Ce qui la porte — nappe, dalle d'étage, murs de cet étage — doit
 *  être RETIRÉ d'un bloc, à l'échelle de la masse. La condition se DÉRIVE de la carte (une case de
 *  rez couverte par une masse qui ne descend pas jusqu'à elle), jamais d'un id écrit en dur. */
describe('dégagement — le couvercle au-dessus du groupe (La Diligence)', () => {
  const scene = paquetDuJeu(diligenceCampaign).scenes[0];
  const masses = effectiveArchitecture(scene)
    .flatMap((corps) => corps.masses.map((masse) => ({ masse, cells: massFootprintCells(masse.footprint) })));
  /** Masse en SURPLOMB d'un niveau qu'elle ne couvre pas : l'étage porté au-dessus d'un passage. */
  const surplomb = masses.find(({ masse }) => masse.z - masse.levels + 1 > 0)!;
  const [dessousKey] = [...surplomb.cells];
  const [dx, dy] = dessousKey.split(',').map(Number);
  const dessous = { x: dx, y: dy, z: 0 };

  it('la carte porte bien un étage en surplomb d’un niveau inférieur — sinon le cas ne serait pas mesuré', () => {
    expect(surplomb.masse.z).toBeGreaterThan(0);
    expect(surplomb.masse.z - surplomb.masse.levels + 1).toBeGreaterThan(dessous.z);
  });

  it('le groupe SOUS la masse dégage son couvercle : nappes levées, dalles et murs de l’étage retirés', () => {
    const cleared = clearedSpace(scene, [dessous]);
    // Le couvercle = l'emprise de la masse, à ses niveaux, tous au-dessus du groupe.
    for (const key of surplomb.cells) expect(cutawayOverhead({ x: Number(key.split(',')[0]), y: Number(key.split(',')[1]), z: surplomb.masse.z }, cleared)).toBe(true);
    // La nappe qui coiffe ce passage est levée, et par la MASSE entière (tous ses pans).
    const pans = buildRoofs(scene, { allies: [dessous] }).filter((el) => el.states.roofOccupied);
    const levees = new Set(pans.map((el) => el.sectionId));
    expect(levees.has(surplomb.masse.id)).toBe(true);
    const tous = buildRoofs(scene, { allies: [dessous] }).filter((el) => el.sectionId === surplomb.masse.id);
    expect(tous.every((el) => el.states.roofOccupied)).toBe(true);
    // Dalles et murs de l'étage porté : retirés, comme la nappe.
    const dalles = buildFloors(scene, undefined, { activeZ: dessous.z, viewZ: null })
      .filter((el) => surplomb.cells.has(`${el.cell.x},${el.cell.y}`) && el.cell.z === surplomb.masse.z);
    expect(dalles.length).toBeGreaterThan(0);
    for (const el of dalles) expect(cutawayOverhead(el.cell, cleared)).toBe(true);
    const murs = buildWalls(scene, undefined, { activeZ: surplomb.masse.z, viewZ: null })
      .filter((el) => surplomb.cells.has(`${el.cell.x},${el.cell.y}`) && el.cell.z === surplomb.masse.z);
    expect(murs.length).toBeGreaterThan(0);
    for (const el of murs) expect(cutawayOverhead(el.cell, cleared)).toBe(true);
  });

  it('le sol où le groupe POSE LE PIED n’est jamais retiré — seul ce qui est au-dessus de lui tombe', () => {
    const cleared = clearedSpace(scene, [dessous]);
    for (const key of surplomb.cells) {
      const [x, y] = key.split(',').map(Number);
      expect(cutawayOverhead({ x, y, z: dessous.z }, cleared)).toBe(false);
    }
  });

  it('à l’étage, le groupe ne dégage plus rien au-dessus de lui — le couvercle est SOUS ses pieds', () => {
    const cleared = clearedSpace(scene, [{ ...dessous, z: surplomb.masse.z }]);
    for (const key of surplomb.cells) {
      const [x, y] = key.split(',').map(Number);
      expect(cutawayOverhead({ x, y, z: surplomb.masse.z }, cleared)).toBe(false);
    }
  });
});

/** #950 — une nappe ne se dessine QUE si le groupe peut la voir. La vue est prise du moteur de vision
 *  (`computeStateVisible`, jamais un ensemble forgé à la main) : sous un toit, la nappe du corps
 *  voisin n'est pas dessinée ; à ciel ouvert, le corps dont on voit le pied garde la sienne. */
describe('vue — une nappe se peint quand le groupe la VOIT (#950)', () => {
  it('la loi ignore la vision quand personne n’observe (éditeur, QC, POV)', () => {
    const sans: ClearedSpace = { ...piece('salle', []), seenSections: null };
    expect(cutawayForSection({ sectionId: 'grange', cells: [] }, sans)).toBe('visible');
  });

  it('la loi retire une section que le groupe ne voit pas, et garde celle qu’il voit', () => {
    const vue: ClearedSpace = { ...piece('salle', []), seenSections: new Set(['grange']) };
    expect(cutawayForSection({ sectionId: 'grange', cells: [] }, vue)).toBe('visible');
    expect(cutawayForSection({ sectionId: 'ecurie', cells: [] }, vue)).toBe('hidden');
  });

  /** Deux corps VOISINS, chacun sa ceinture de murs : celui qu'on habite, et celui d'à côté. */
  const hameau = (): Scene => {
    const scene = emptyScene(14, 14);
    scene.ambientLight = 'jour';
    const corps = (id: string, emprise: { x: number; y: number; w: number; h: number }) => {
      const masse: BuildingMass = {
        id: `toit-${id}`, z: 0, footprint: [emprise], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 45, material: 'tuile',
      };
      const murs: WallSeg[] = [];
      for (let x = emprise.x; x < emprise.x + emprise.w; x++) {
        murs.push({ x, y: emprise.y, side: 'N' });
        murs.push({ x, y: emprise.y + emprise.h, side: 'N' });
      }
      for (let y = emprise.y; y < emprise.y + emprise.h; y++) {
        murs.push({ x: emprise.x - 1, y, side: 'E' });
        murs.push({ x: emprise.x + emprise.w - 1, y, side: 'E' });
      }
      scene.architecture = [...(scene.architecture ?? []), { id, style: 'maison', storeys: [], facades: [], masses: [masse] }];
      scene.walls = [...(scene.walls ?? []), ...murs];
      return masse;
    };
    corps('logis', { x: 2, y: 2, w: 4, h: 4 });
    corps('grange', { x: 9, y: 2, w: 3, h: 3 });
    return scene;
  };
  const vueDepuis = (scene: Scene, pos: { x: number; y: number; z?: number }) =>
    computeStateVisible({ scene, battle: null, party: [], partyPos: { x: pos.x, y: pos.y, z: pos.z ?? 0 }, gameTime: 12 * 60, lightLevel: null });
  const nappesDe = (scene: Scene, corpsId: string, pos: { x: number; y: number; z?: number }) => {
    const allies = [{ x: pos.x, y: pos.y, z: pos.z ?? 0 }];
    return buildRoofs(scene, { allies, sight: vueDepuis(scene, pos) })
      .filter((el) => el.sectionId === `toit-${corpsId}`);
  };

  it('sous le toit du logis, la nappe de la grange voisine n’est pas dessinée', () => {
    const scene = hameau();
    const pans = nappesDe(scene, 'grange', { x: 3, y: 3 }); // au cœur du logis
    expect(pans.length).toBeGreaterThan(0);
    expect(pans.every((el) => el.states.roofOccupied)).toBe(true);
  });

  it('à ciel ouvert entre les deux corps, la grange dont on voit le pied garde sa nappe', () => {
    const scene = hameau();
    const pans = nappesDe(scene, 'grange', { x: 7, y: 3 }); // dehors, entre logis et grange
    expect(pans.length).toBeGreaterThan(0);
    expect(pans.every((el) => !el.states.roofOccupied)).toBe(true);
  });

  it('c’est bien le PIED du corps qui décide : sa nappe tombe quand rien de son emprise élargie n’est vu', () => {
    const scene = hameau();
    const allies = [{ x: 7, y: 3, z: 0 }];
    const dehors = vueDepuis(scene, allies[0]);
    const grange = effectiveArchitecture(scene).flatMap((corps) => corps.masses).find((masse) => masse.id === 'toit-grange')!;
    const pied = new Set([...massFootprintCells(grange.footprint)].flatMap((key) => {
      const [x, y] = key.split(',').map(Number);
      const autour: string[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) autour.push(`${x + dx},${y + dy},0`);
      return autour;
    }));
    const aveugle = new Set([...dehors].filter((key) => !pied.has(key)));
    expect(clearedSpace(scene, allies, dehors).seenSections?.has('toit-grange')).toBe(true);
    expect(clearedSpace(scene, allies, aveugle).seenSections?.has('toit-grange')).toBe(false);
  });

  /** Carte VIVANTE : aucune valeur absolue — seule la RELATION est mesurée. Le groupe sous un toit
   *  voit STRICTEMENT moins de nappes que le même groupe sorti à l'air libre. */
  it('sur la carte réelle, être dessous montre STRICTEMENT moins de nappes qu’être dehors', () => {
    const scene = paquetDuJeu(diligenceCampaign).scenes[0];
    const masses = effectiveArchitecture(scene)
      .flatMap((corps) => corps.masses.map((masse) => ({ masse, cells: massFootprintCells(masse.footprint) })));
    const couvertes = new Set(masses.flatMap(({ masse, cells }) => (masse.z === 0 ? [...cells] : [])));
    const dedansKey = [...couvertes][0];
    const [dx, dy] = dedansKey.split(',').map(Number);
    const dehors = (() => {
      const { w, h } = scene.dimensions;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (!masses.some(({ cells }) => cells.has(`${x},${y}`))) return { x, y, z: 0 };
      throw new Error('carte entièrement bâtie : le cas ne peut pas être mesuré');
    })();
    const dessinees = (pos: { x: number; y: number; z: number }) => {
      const allies = [pos];
      const sight = computeStateVisible({ scene, battle: null, party: [], partyPos: pos, gameTime: 12 * 60, lightLevel: null });
      return new Set(buildRoofs(scene, { allies, sight }).filter((el) => !el.states.roofOccupied).map((el) => el.sectionId));
    };
    expect(dessinees({ x: dx, y: dy, z: 0 }).size).toBe(0);
    expect(dessinees(dehors).size).toBeGreaterThan(0);
  });
});

/** #1176, M3 — L'OCCLUSION D'ÉCRAN NE RETIRE RIEN. Le groupe se tient DEHORS (cour de La Diligence :
 *  aucune pièce, aucune emprise, aucun surplomb au-dessus de sa tête) et la nappe d'un corps le
 *  recouvre à l'écran : cette masse reste PEINTE, toit et murs compris — la riposte à cette
 *  occlusion-là est le TROU local (`stage/percage.ts`, `verdictPercage` sur la MÊME géométrie).
 *  L'ABRI RÉEL, lui, retire toujours.
 *
 *  Le montage est celui de l'hôte du monde (`stage/MondeDeCampagne`), pas une reconstruction : vision réelle, `clearedSpace`,
 *  nappes projetées et capsule d'acteur. */
describe('occlusion d’écran — une masse qui CACHE sans abriter reste peinte (La Diligence)', () => {
  const scene = paquetDuJeu(diligenceCampaign).scenes[0];
  const dims: Dims = { ...scene.dimensions, rot: 0, view: 'iso' };
  const lids: Lid[] = buildRoofs(scene).map((el) => ({
    sectionId: el.sectionId ?? el.key, z: el.cell.z, cells: el.cells, occluder: elOccluder(el, dims),
  }));
  const roofs = buildRoofs(scene);
  /** Les nappes qui recouvrent RÉELLEMENT la capsule du héros posé là — la géométrie d'écran seule. */
  const cacheursAu = (x: number, y: number, z: number) => {
    const capsule = actorCapsuleOf({ x, y, h: heightAt(scene, x, y, z) }, dims);
    return lids.filter((lid) => lid.z >= z && occludesActor(lid.occluder, capsule));
  };
  /** Le dégagement du stage à ce poste, et ses cacheurs. */
  const posteAu = (x: number, y: number, z: number) => {
    const sight = computeStateVisible({ scene, battle: null, party: [], partyPos: { x, y, z }, gameTime: 12 * 60, lightLevel: null });
    return { cleared: clearedSpace(scene, [{ x, y, z }], sight), cacheurs: cacheursAu(x, y, z) };
  };

  /** LA POPULATION DE LA LOI, dérivée de la carte et jamais énumérée à la main : toute case du rez
   *  où des nappes recouvrent le héros à l'écran, où RIEN ne l'abrite, et où ces nappes sont VUES —
   *  une section hors de vue se retire par une AUTRE loi (#950), elle ne dit rien de celle-ci. */
  const postesDeCour = (() => {
    const trouves: { x: number; y: number; cleared: ClearedSpace; cacheurs: Lid[] }[] = [];
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) {
        if (!cacheursAu(x, y, 0).length) continue;
        const { cleared, cacheurs } = posteAu(x, y, 0);
        if (cleared.zoneIds.size + cleared.roomlessCells.size + cleared.overheadCells.size !== 0) continue;
        if (!cacheurs.every((lid) => cleared.seenSections?.has(lid.sectionId))) continue;
        trouves.push({ x, y, cleared, cacheurs });
      }
    return trouves;
  })();
  /** Les deux postes de la cour d'où le cas a été mesuré pour la première fois : ils ancrent la
   *  population, et leurs prémisses se re-mesurent une à une ci-dessous. */
  const ancres = [[17, 2], [12, 3]] as const;

  it('la cour porte la population que la loi balaye : caché à l’écran, abrité par rien, nappes vues', () => {
    expect(postesDeCour.length, 'postes de cour cachés sans abri').toBeGreaterThan(50);
    for (const [x, y] of ancres) {
      const { cleared, cacheurs } = posteAu(x, y, 0);
      expect(cacheurs.length, `(${x},${y}) est bien recouvert à l’écran`).toBeGreaterThan(0);
      expect(cleared.zoneIds.size + cleared.roomlessCells.size + cleared.overheadCells.size, `(${x},${y}) n’est abrité par rien`).toBe(0);
      for (const lid of cacheurs) expect(cleared.seenSections?.has(lid.sectionId), `${lid.sectionId} est vue depuis (${x},${y})`).toBe(true);
      expect(postesDeCour.some((p) => p.x === x && p.y === y), `(${x},${y}) est dans la population balayée`).toBe(true);
    }
  });

  it('LOI — sur TOUS ces postes, la masse qui cache garde ses nappes entières et ses cases couvertes', () => {
    const fautes: string[] = [];
    for (const { x, y, cleared, cacheurs } of postesDeCour) {
      const cachees = new Set(cacheurs.map((lid) => lid.sectionId));
      for (const el of roofs) {
        const sectionId = el.sectionId ?? el.key;
        if (!cachees.has(sectionId)) continue;
        const verdict = cutawayForSection({
          sectionId, roomZoneIds: el.roomZoneIds, cells: el.cells.map((c) => spaceCellKey(c.x, c.y, el.cell.z)),
        }, cleared);
        if (verdict !== 'visible') fautes.push(`(${x},${y}) nappe ${el.key} de ${sectionId} : ${verdict}`);
      }
      // Ce qui se dresse ou se pose sur ses cases reste là lui aussi — murs d'étage, dalles, décors.
      for (const lid of cacheurs)
        for (const cell of lid.cells)
          if (cutawayOverhead({ ...cell, z: lid.z }, cleared)) fautes.push(`(${x},${y}) case ${cell.x},${cell.y} de ${lid.sectionId} dégagée`);
    }
    expect(fautes).toEqual([]);
  });

  it.each(ancres)('depuis la cour (%i,%i), les dalles de l’étage porté restent posées', (x, y) => {
    const { cleared } = posteAu(x, y, 0);
    const dalles = buildFloors(scene, undefined, { activeZ: 0, viewZ: null }).filter((el) => el.cell.z === 1);
    expect(dalles.length).toBeGreaterThan(0);
    expect(dalles.filter((el) => cutawayOverhead(el.cell, cleared)).length).toBe(0);
  });

  it('ABRI RÉEL (20,12) : le couvercle au-dessus de la tête part, nappe comprise', () => {
    const { cleared, cacheurs } = posteAu(20, 12, 0);
    expect(cleared.overheadCells.size, 'une masse coiffe bien ce poste').toBeGreaterThan(0);
    expect(cacheurs.length, 'et elle le cache aussi à l’écran').toBeGreaterThan(0);
    const couvrantes = buildRoofs(scene).filter((el) => el.cells.some((c) => c.x === 20 && c.y === 12));
    expect(couvrantes.length, 'la carte porte bien une nappe sur cette case').toBeGreaterThan(0);
    for (const el of couvrantes)
      expect(cutawayForSection({
        sectionId: el.sectionId ?? el.key,
        roomZoneIds: el.roomZoneIds,
        cells: el.cells.map((c) => spaceCellKey(c.x, c.y, el.cell.z)),
      }, cleared)).toBe('hidden');
  });
});
