import { describe, it, expect } from 'vitest';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity, type WallSeg } from '../../state/scene';
import { buildProps, capDuFaite } from './props';
import { buildWalls } from './walls';
import { buildPropVolumes } from './propVolumes';
import { findPropById, props } from '../../data';
import { capVolumique } from '../../data/props.types';
import { missingPropSvg, propSvg } from '../catalog/decor';
import { estPropVolumique, type BillboardPropEl, type PropEl, type VolumePropEl } from './types';
import type { Dir8 } from '../../state/dir8';
import { buildRoofs, fieldHeightAt, nappeKey, resolveNappes, ROOF_SLOPE_M } from './roofs';

/** Le décor BILLBOARD d'une sortie de builder : un décor VOLUMIQUE n'a ni empreinte de billboard, ni
 *  surélévation, ni feature de façade à juger — il porte des faces. */
const buildBillboardProps = (...args: Parameters<typeof buildProps>): BillboardPropEl[] =>
  buildProps(...args).filter((el): el is BillboardPropEl => !estPropVolumique(el));

/** Un décor encore BILLBOARD, DÉRIVÉ du catalogue : la vague volumique (#1343) convertit les refs lot
 *  par lot — une ref écrite en dur ferait rougir ces gardes le jour de SA recette. */
const REF_BILLBOARD = props.find((p) => !p.volume)!.id;

const volume = (el: PropEl): VolumePropEl => {
  if (!estPropVolumique(el)) throw new Error(`${el.ref} : attendu en volume`);
  return el;
};
/** Altitude du PIED d'un décor volumique : le `h` le plus bas de ses faces. Les recettes du
 *  catalogue ancré s'écrivent depuis `h = 0`, donc ce plancher vaut `solM + liftM` du site d'émission. */
const socleM = (el: PropEl) => Math.min(...volume(el).faces.flatMap((f) => f.poly.map((p) => p.h)));
/** L'échelle des scènes de ce fichier — LUE sur une scène : toutes sortent d'`emptyScene`, qui ne pose
 *  pas de `metresPerTile`, donc c'est le défaut du monde (`LDB 15 l.12`). */
const MPT = sceneMetresPerTile(emptyScene(1, 1));
/** Le décor est-il posé à CETTE ancre, à ce cap ? Comparé à la recette compilée à son propre pied. */
const poseA = (el: PropEl, ancre: { x: number; y: number }, facing: Dir8) =>
  volume(el).faces.every((face, i) =>
    face.poly.every((p, k) => {
      const attendu = buildPropVolumes(findPropById(el.ref)!, { ancre, facing: capVolumique(facing, volume(el).ref), baseHeightM: socleM(el) }, MPT)[i].poly[k];
      return Math.abs(p.x - attendu.x) < 1e-9 && Math.abs(p.y - attendu.y) < 1e-9 && Math.abs(p.h - attendu.h) < 1e-9;
    }));

/**
 * DÉCOR VOLUMIQUE — un type qui porte une recette (`PropData.volume`) sort en FACES monde, jamais en
 * sujet de billboard, et se pose sur la surface de sa case (relief et couche compris).
 */
describe('buildProps — un décor à recette sort en faces monde', () => {
  const sceneWithReliefAndUpperLayer = ({ x, y, z, heightM }: { x: number; y: number; z: number; heightM: number }) => {
    const s = emptyScene(8, 8);
    s.layers.push({ z, tiles: new Array(8 * 8).fill('pierre') });
    const étage = s.layers.find((l) => l.z === z)!;
    étage.height = new Array(8 * 8).fill(0);
    étage.height[y * 8 + x] = heightM;
    return s;
  };
  const propEntity = ({ id, pos, z, facing }: { id: string; pos: { x: number; y: number }; z?: number; facing: Dir8 }): SceneEntity =>
    ({ id, kind: 'prop', pos, ref: 'table-ronde-4-tabourets', facing, ...(z !== undefined ? { z } : {}) }) as SceneEntity;

  it('pose le volume à la hauteur métrique fournie par le relief et la couche', () => {
    const scene = sceneWithReliefAndUpperLayer({ x: 4, y: 6, z: 1, heightM: 7.25 });
    const ent = propEntity({ id: 'meuble-haut', pos: { x: 4, y: 6 }, z: 1, facing: 'S' });
    const [el] = buildProps({ ...scene, entities: [ent] }).filter(estPropVolumique);
    expect(Math.min(...el.faces.map((face) => Math.min(...face.poly.map((p) => p.h))))).toBeCloseTo(7.25);
  });

  it('un décor à recette n’a plus de billboard : il porte ses faces, son entId et son cap', () => {
    const scene = emptyScene(8, 8);
    scene.entities = [propEntity({ id: 'table-1', pos: { x: 2, y: 3 }, facing: 'E' })];
    const els = buildProps(scene);
    expect(els.filter(estPropVolumique)).toHaveLength(1);
    expect(els.filter((el) => !estPropVolumique(el) && el.source === 'entity')).toEqual([]);
    const [el] = els.filter(estPropVolumique);
    expect(el).toMatchObject({ entId: 'table-1', ref: 'table-ronde-4-tabourets', facing: 'E', source: 'entity' });
    expect(el.faces.every((f) => f.entId === 'table-1' && f.material.domain === 'prop')).toBe(true);
  });

  it('un décor SANS recette reste un billboard (le décor historique ne bouge pas)', () => {
    const scene = emptyScene(8, 8);
    scene.entities = [{ id: 't1', kind: 'prop', pos: { x: 2, y: 3 }, ref: REF_BILLBOARD }] as SceneEntity[];
    expect(buildProps(scene).filter(estPropVolumique)).toEqual([]);
    expect(buildBillboardProps(scene).map((el) => el.entId)).toEqual(['t1']);
  });

  it('le filet des fixtures billboard tient encore : au moins deux refs SANS recette au catalogue', () => {
    expect(
      props.filter((p) => !p.volume).length,
      'la phase 4 de #1343 (mort du chemin billboard des props) fera tomber ce filet EXPRÈS : ces fixtures '
      + 'devront alors être reformulées — il n’y aura plus de décor billboard à témoin.',
    ).toBeGreaterThanOrEqual(2);
  });
});

/** BUILDER de props : clés stables, overlays de terrain, géométrie d'empreinte, vérités de scène. */
describe('buildProps — éléments prop du pivot', () => {
  const scene = () => {
    const s = emptyScene(6, 6);
    s.layers[0].tiles[1 * 6 + 2] = 'mur'; // (2,1) : BLOC PLEIN — géré par le relief (solidHeightM), PAS un prop
    s.layers[0].tiles[3 * 6 + 4] = 'bois'; // (4,3) : overlay à DÉCOR (overlayProp → 'arbre')
    s.entities = [
      { id: 'p1', kind: 'prop', pos: { x: 1, y: 1 }, ref: REF_BILLBOARD },
      { id: 'p2', kind: 'prop', pos: { x: 3, y: 2 }, ref: 'tente', facing: 'SE', usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] } }, // tente 2×2 au catalogue
      { id: 'npc', kind: 'personnage', ref: 'humain', pos: { x: 5, y: 5 } }, // pas un prop → ignoré
    ] as SceneEntity[];
    return s;
  };

  it('émet un billboard de DÉCOR pour un terrain à overlayProp (bois→arbre) ; le mur PLEIN est un bloc de relief, pas un prop', () => {
    const els = buildBillboardProps(scene());
    const terrain = els.filter((e) => e.source === 'terrain');
    expect(terrain.map((e) => e.key)).toEqual(['ov:4,3,0']); // seul `bois` a un overlayProp
    expect(terrain.map((e) => e.ref)).toEqual(['arbre']);  // rendu comme un prop d'entité (billboard partagé)
    expect(terrain[0].foot).toEqual({ offX: 0, offY: 0, scale: 1 });
    expect(terrain[0].entId, 'un overlay de terrain n’est l’instance de personne').toBeUndefined();
    for (const t of terrain) expect(t.states.visible).toBe(true); // `visible` absent (éditeur/QC) → tout visible
    const props = els.filter((e) => e.source === 'entity');
    expect(props.map((e) => e.key)).toEqual(['prop:p1', 'prop:p2']);
  });

  it('un overlay de terrain suit le brouillard comme un prop (en vue → au-dessus du voile, cull LdV en POV sinon)', () => {
    const seen = buildBillboardProps(scene(), new Set(['4,3,0'])).find((e) => e.key === 'ov:4,3,0')!;
    expect(seen.states.visible).toBe(true); // sa tuile est en vue
    const hidden = buildBillboardProps(scene(), new Set(['0,0,0'])).find((e) => e.key === 'ov:4,3,0')!;
    expect(hidden.states.visible).toBe(false); // mémorisé → sous le voile / culé en POV
  });

  it('une ref ABSENTE n’est JAMAIS remplacée : l’élément la porte telle quelle, et le dessin est le repli d’ERREUR (#877)', () => {
    const s = scene();
    s.entities = [{ id: 'sans-ref', kind: 'prop', pos: { x: 0, y: 0 } }] as SceneEntity[];
    const [el] = buildProps(s).filter((e) => e.source === 'entity');
    expect(el.ref).toBeUndefined(); // aucun id en dur ne s'est substitué à l'absence
    expect(propSvg(el.ref)).toBe(missingPropSvg(undefined)); // ce que la case MONTRE : la silhouette d'erreur
  });

  it('porte ref/facing/empreinte, et l’ID D’ENTITÉ — l’OFFRE, elle, n’est pas recopiée sur l’élément', () => {
    const [p1, p2] = buildBillboardProps(scene()).filter((e) => e.source === 'entity');
    expect(p1.ref).toBe(REF_BILLBOARD);
    expect(p1.foot).toEqual({ offX: 0, offY: 0, scale: 1 });
    expect(p2.ref).toBe('tente');
    expect(p2.facing).toBe('SE');
    expect(p2.foot).toEqual({ offX: 0.5, offY: 0.5, scale: 2 }); // décalage vers le centre + côté max
    expect(p2.span).toEqual({ w: 2, h: 2 });
    // L'élément de rendu porte l'IDENTITÉ de l'entité, et rien de son offre : c'est `actionsDe` qui
    // dit ce qu'elle offre, au moment du rendu, drapeaux en main (`estUtilisable`, `state/usable.ts`).
    expect(p2.entId).toBe('p2');
    expect(Object.keys(p2)).not.toContain('interact');
  });

  it('tague `visible` un prop en vue, mémorisé sinon', () => {
    const els = buildBillboardProps(scene(), new Set(['1,1,0']));
    const p1 = els.find((e) => e.key === 'prop:p1')!;
    const p2 = els.find((e) => e.key === 'prop:p2')!;
    expect(p1.states.visible).toBe(true);
    expect(p2.states.visible).toBe(false);
  });

  it('émet le décor de TOUTES les couches ; seul `viewZ` isole un étage, et `activeZ` ne coupe RIEN', () => {
    const s = scene();
    s.layers.push({ z: 1, tiles: new Array(36).fill('vide') });
    (s.entities[1] as SceneEntity).z = 1; // p2 à l'étage
    const cles = (view?: Parameters<typeof buildProps>[2]) =>
      buildBillboardProps(s, undefined, view).filter((e) => e.source === 'entity').map((e) => e.key);
    // La visibilité d'étage est la loi d'un ÉCRAN, appliquée APRÈS le builder (#1317) : le rez comme
    // l'étage sortent d'ici, et `activeZ` — que les sols et les jetons lisent encore — n'a AUCUN
    // lecteur dans ce builder.
    expect(cles()).toEqual(['prop:p1', 'prop:p2']);
    expect(cles({ activeZ: 0, viewZ: null })).toEqual(['prop:p1', 'prop:p2']);
    // ISOLEMENT : demande EXPLICITE de l'appelant (vue du dessus, minimap, `state/viewLevel`).
    expect(cles({ viewZ: 1 })).toEqual(['prop:p2']);
    expect(cles({ viewZ: 0 })).toEqual(['prop:p1']);
  });

  it('overlay de terrain à l’étage : “bois” sur z1 émet un `ov:x,y,1` à SA hauteur, quel que soit l’étage actif', () => {
    const s = scene();
    s.layers.push({ z: 1, tiles: new Array(36).fill('vide') });
    s.layers[1].tiles[3 * 6 + 4] = 'bois'; // (4,3) à l'étage 1
    const ovs = (view?: Parameters<typeof buildProps>[2]) =>
      buildBillboardProps(s, undefined, view).filter((e) => e.source === 'terrain');
    expect(ovs().map((e) => e.key)).toEqual(['ov:4,3,0', 'ov:4,3,1']); // sans `view` : toutes les couches
    // L'étage actif ne retranche AUCUN overlay : l'écran juge, pas le builder (#1317).
    expect(ovs({ activeZ: 0, viewZ: null }).map((e) => e.key)).toEqual(['ov:4,3,0', 'ov:4,3,1']);
    expect(ovs({ viewZ: 1 }).map((e) => e.key)).toEqual(['ov:4,3,1']); // isolement demandé
    expect(ovs({ activeZ: 1, viewZ: null }).find((e) => e.key === 'ov:4,3,1')!.cell).toEqual({ x: 4, y: 3, z: 1 });
  });
});

/** ORNEMENTS d'identité par TYPE de bâtiment : dérivés de `buildingFeatures(body.style)`, posés
 *  sur/devant le bâtiment (ancres ridge/facade/front). 100 % donnée, aucun cas en dur. Les quatre
 *  ornements du catalogue portent une recette (#1624) : leur ANCRAGE se relit donc sur la géométrie
 *  monde qu'ils rendent, jamais sur un `foot` de billboard. */
describe('buildProps — ornements de bâtiment (data-driven par ArchitectureBody.style)', () => {
  const withRoof = (style: string, foot: { x: number; y: number; w: number; h: number }, walls: WallSeg[] = []) => {
    const s = emptyScene(10, 10);
    s.architecture = [{
      id: `body-${style}`,
      style,
      storeys: [{ id: 'z0', z: 0, parts: [], roomZoneIds: [] }],
      facades: [],
      masses: [{ id: 'mass-0', z: 0, footprint: [foot], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 30, material: 'tuile' }],
    }];
    s.walls = walls;
    return s;
  };
  const orns = (s: ReturnType<typeof withRoof>, visible?: Set<string>) =>
    buildProps(s, visible).filter((e) => e.source === 'ornament');

  it("chapelle → clocheton au FAÎTE : centré sur l'empreinte du toit, surélevé", () => {
    const [o] = orns(withRoof('chapelle', { x: 1, y: 1, w: 4, h: 5 }));
    expect(o.ref).toBe('clocheton');
    expect(o.key).toBe('orn:body-chapelle:mass-0:0');
    expect(o.cell).toEqual({ x: 1, y: 1, z: 0 }); // origine → même coin caméra-proche que le toit
    expect(o.facing).toBe('E'); // cap du faîtage résolu (ridge 'x' authoré par la fixture)
    expect(poseA(o, { x: 2.5, y: 3 }, 'E')).toBe(true); // recentré sur l'empreinte 4×5
    expect(socleM(o)).toBeGreaterThan(2); // posé haut sur la pente (≈ égout + 0.6·flèche), pas au sol
    expect(o.states.visible).toBe(true); // `visible` absent (éditeur/QC) → visible
  });

  it('forge → cheminée au FAÎTE : centrée sur la masse et posée haut sur la pente', () => {
    const [o] = orns(withRoof('forge', { x: 0, y: 0, w: 3, h: 2 }));
    expect(o.ref).toBe('cheminee');
    expect(poseA(o, { x: 1, y: 0.5 }, 'E')).toBe(true); // recentré sur l'empreinte 3×2
    expect(socleM(o)).toBeGreaterThan(0);
  });

  it("taverne → enseigne en FAÇADE : JUSTE devant la porte (hors mur), surélevée, tournée vers l'extérieur", () => {
    // Porte côté S de la rangée basse (y=3) → arête canonisée (2,4,N) ; case sortante (2,4).
    const s = withRoof('taverne', { x: 1, y: 1, w: 3, h: 3 }, [{ x: 2, y: 4, side: 'N', door: true }]);
    const [o] = orns(s);
    expect(o.ref).toBe('enseigne');
    expect(o.cell).toEqual({ x: 2, y: 4, z: 0 }); // case JUSTE À L'EXTÉRIEUR (le mur plein masquerait l'intérieur)
    expect(o.facing).toBe('S'); // normale sortante
    expect(o.span).toBeUndefined(); // 1×1 (pas la profondeur du toit)
    expect(socleM(o)).toBeGreaterThan(0); // en haut du mur (potence saillante)
    expect(poseA(o, { x: 2, y: 4.5 }, 'S')).toBe(true); // saillie de ½ case vers l'extérieur (dégage la face du mur)
  });

  it("échoppe → étal au SOL DEVANT la porte (case sortante), non surélevé, tourné vers l'extérieur", () => {
    const s = withRoof('echoppe', { x: 1, y: 1, w: 2, h: 2 }, [{ x: 1, y: 3, side: 'N', door: true }]);
    const [o] = orns(s);
    expect(o.ref).toBe('etal-marche');
    expect(o.cell).toEqual({ x: 1, y: 3, z: 0 }); // case JUSTE À L'EXTÉRIEUR de la porte S
    expect(o.facing).toBe('S');
    expect(socleM(o)).toBe(0); // au sol
    expect(poseA(o, { x: 1, y: 3 }, 'S')).toBe(true); // plaqué sur la case sortante, sans saillie
  });

  it('repli sans porte : façade SUD sous le centre bas de l’empreinte', () => {
    const s = withRoof('taverne', { x: 2, y: 2, w: 4, h: 2 }); // aucun mur → repli
    const [o] = orns(s);
    expect(o.cell).toEqual({ x: 4, y: 4, z: 0 }); // x = 2+floor(4/2)=4, y = case sortante sous le bas (y1+1=4)
    expect(o.facing).toBe('S');
  });

  /**
   * CAP DU FAÎTE (#1624) : il se lit sur la nappe RÉSOLUE, où le `ridge` authoré PRIME. Une masse 4×2
   * authorée `ridge:'y'` réfuterait toute lecture par boîte englobante (son long axe est x, la boîte
   * dirait 'E') : le cap est 'S'. Un profil sans faîte franc (croupe, toit plat) n'oriente rien.
   */
  it('le cap d’un ornement de FAÎTE suit le `ridge` AUTHORÉ, jamais la boîte englobante', () => {
    const long = withRoof('chapelle', { x: 1, y: 1, w: 4, h: 2 }); // fixture : ridge 'x'
    expect(orns(long)[0].facing).toBe('E');
    const travers = withRoof('chapelle', { x: 1, y: 1, w: 4, h: 2 });
    travers.architecture![0].masses[0].ridge = 'y';
    expect(orns(travers)[0].facing).toBe('S');
    expect(capDuFaite({ profile: 'hip', ridge: 'x', pitch: 1, eaveHeightM: 3 })).toBe('S');
    expect(capDuFaite({ profile: 'flat', ridge: 'x', pitch: 1, eaveHeightM: 3 })).toBe('S');
  });

  it('maison/tour (sans features) : AUCUN ornement', () => {
    expect(orns(withRoof('maison', { x: 1, y: 1, w: 3, h: 3 }))).toHaveLength(0);
    expect(orns(withRoof('tour', { x: 1, y: 1, w: 2, h: 2 }))).toHaveLength(0);
  });

  it('visibilité IDENTIQUE au toit : visible dès qu’une case de l’empreinte élargie d’1 est en vue', () => {
    const foot = { x: 3, y: 3, w: 2, h: 2 };
    const seen = orns(withRoof('chapelle', foot), new Set(['2,3,0']))[0]; // (2,3) = bord élargi
    expect(seen.states.visible).toBe(true);
    const hidden = orns(withRoof('chapelle', foot), new Set(['0,0,0']))[0]; // loin de l'empreinte
    expect(hidden.states.visible).toBe(false);
  });

  it("cutaway : un allié sous l’empreinte MASQUE le faîteau (toit levé), pas la façade/l’étal au sol", () => {
    const foot = { x: 1, y: 1, w: 4, h: 4 }; // allié (2,2) DANS l'empreinte → roofHidden
    const ally = [{ x: 2, y: 2 }];
    // Faîte : sauté avec le toit en cutaway ; présent sans allié.
    expect(buildProps(withRoof('chapelle', foot), undefined, { allies: ally }).filter((e) => e.source === 'ornament')).toHaveLength(0);
    expect(orns(withRoof('chapelle', foot))).toHaveLength(1);
    // Façade (au sol devant la porte) : le toit levé ne l'occulte pas → reste.
    const tav = buildProps(withRoof('taverne', foot, [{ x: 2, y: 5, side: 'N', door: true }]), undefined, { allies: ally }).filter((e) => e.source === 'ornament');
    expect(tav.map((e) => e.ref)).toEqual(['enseigne']);
  });

  it('le faîteau se pose sur le FAÎTE MESURÉ de la nappe (le champ), jamais sur une boîte englobante (#1186)', () => {
    // Corps 8×4 à deux pentes (fixture : 30°, 2 m/case) : la flèche vaut 2 cases de demi-portée ×
    // la pente de la nappe. L'ornement se pose à 60 % de cette flèche au-dessus de l'égout.
    const s = withRoof('chapelle', { x: 1, y: 1, w: 8, h: 4 });
    const { field } = resolveNappes(s).get(nappeKey('body-chapelle', 'mass-0'))!;
    let faite = -Infinity;
    for (const key of field.domain) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const)
        faite = Math.max(faite, fieldHeightAt(field, { x: x + dx, y: y + dy }));
    }
    const fleche = faite - field.shape.eaveHeightM;
    expect(fleche).toBeCloseTo(2 * field.shape.pitch, 9);
    const [o] = orns(s);
    expect(socleM(o)).toBeCloseTo(field.shape.eaveHeightM + 0.6 * fleche, 9);
    // RÉFUTATION de la lecture par boîte englobante (`min(w,h)/2 × ROOF_SLOPE_M`) : elle rendait une
    // flèche étrangère à la pente de la nappe.
    expect(socleM(o)).not.toBeCloseTo(field.shape.eaveHeightM + 0.6 * 2 * ROOF_SLOPE_M, 3);
  });

  it("masse dont la nappe MANQUE à la carte : son ornement est omis, le reste des props se construit (aucune levée)", () => {
    // La carte des nappes est mémoïsée par IDENTITÉ de scène : amorcée alors que la réf ne porte
    // encore aucun corps, elle ne contient la nappe d'aucune masse posée ensuite sur cette réf.
    const s = withRoof('chapelle', { x: 1, y: 1, w: 4, h: 4 });
    const bodies = s.architecture!;
    s.architecture = [];
    s.entities = [{ id: 'p1', kind: 'prop', pos: { x: 8, y: 8 }, ref: REF_BILLBOARD }] as SceneEntity[];
    s.layers[0].tiles[7 * 10 + 7] = 'bois'; // (7,7) : overlay à décor
    expect(resolveNappes(s).size).toBe(0);
    s.architecture = bodies;
    expect(resolveNappes(s).get(nappeKey('body-chapelle', 'mass-0'))).toBeUndefined();
    const els = buildBillboardProps(s);
    expect(buildProps(s).filter((e) => e.source === 'ornament')).toHaveLength(0);
    expect(els.filter((e) => e.source === 'entity').map((e) => e.key)).toEqual(['prop:p1']);
    expect(els.filter((e) => e.source === 'terrain').map((e) => e.key)).toEqual(['ov:7,7,0']);
  });
});

describe('buildProps — features de façade authorées', () => {
  const authoredFacade = () => {
    const s = emptyScene(10, 10);
    s.walls = [
      { x: 2, y: 5, side: 'N', door: true },
      { x: 3, y: 5, side: 'N' },
      { x: 4, y: 5, side: 'N' },
      { x: 5, y: 5, side: 'N' },
    ];
    s.architecture = [{
      id: 'corps-auberge',
      style: 'maison',
      storeys: [],
      facades: [{
        id: 'facade-rue',
        z: 0,
        edges: s.walls.map(({ x, y, side }) => ({ x, y, side })),
        appearance: 'auberge-relais-imperiale',
        roomZoneIds: ['salle'],
        features: [
          { id: 'entree-centrale', kind: 'stone-entry', edge: { x: 2, y: 5, side: 'N' } },
          { id: 'pignon-central', kind: 'gable', edge: { x: 3, y: 5, side: 'N' }, offset: 0.5, width: 2 },
          { id: 'cheminee-ouest', kind: 'chimney', edge: { x: 4, y: 5, side: 'N' }, offset: 0.25 },
          { id: 'cheminee-est', kind: 'chimney', edge: { x: 5, y: 5, side: 'N' }, offset: 0.75 },
        ],
      }],
      masses: [],
    }];
    return s;
  };

  /** La MÊME façade, mais le corps porte enfin sa MASSE couverte : les features à `base: 'toit'`
   *  (cheminée, clocheton) y trouvent une couverture à l'aplomb de leur ancre. L'emprise s'arrête à
   *  la rangée y=4 : les arêtes murales de la rangée y=5 la bordent par le SUD, comme au réel. */
  const facadeCouverte = () => {
    const s = authoredFacade();
    s.architecture![0].masses = [{
      id: 'corps', z: 0, footprint: [{ x: 2, y: 1, w: 4, h: 4 }], levels: 1,
      profile: 'gable', ridge: 'x', pitchDeg: 30, material: 'tuile',
    }];
    return s;
  };

  /** Hauteur de la COUVERTURE à l'aplomb d'un point, lue sur les faces de toit que le builder ÉMET :
   *  le PLAN du pan qui enjambe le point, évalué en ce point. Un pan n'a de sommets qu'à ses coins —
   *  chercher un sommet proche ne mesurerait rien. Aucune arithmétique de nappe n'est rejouée ici :
   *  seules les faces rendues parlent. */
  const couvertureAu = (scene: Scene, p: { x: number; y: number }): number => {
    let haut = Number.NEGATIVE_INFINITY;
    for (const el of buildRoofs(scene))
      for (const face of el.faces) {
        const xs = face.poly.map((q) => q.x), ys = face.poly.map((q) => q.y);
        if (p.x < Math.min(...xs) || p.x > Math.max(...xs) || p.y < Math.min(...ys) || p.y > Math.max(...ys)) continue;
        const [a, b, c] = face.poly;
        if (!c) continue;
        // Plan par trois sommets : h(p) = a.h + (∇h · (p − a)), ∇h résolu sur (b−a, c−a).
        const det = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
        if (Math.abs(det) < 1e-9) continue; // face verticale (pignon, fascia) : elle ne couvre rien
        const dhx = ((b.h - a.h) * (c.y - a.y) - (c.h - a.h) * (b.y - a.y)) / det;
        const dhy = ((c.h - a.h) * (b.x - a.x) - (b.h - a.h) * (c.x - a.x)) / det;
        haut = Math.max(haut, a.h + dhx * (p.x - a.x) + dhy * (p.y - a.y));
      }
    return haut;
  };

  /** Clés d'émission des features de façade — l'identité que volume et billboard partagent. */
  const clesDeFeature = (...args: Parameters<typeof buildProps>) =>
    buildProps(...args).filter((prop) => prop.source === 'architecture').map((prop) => prop.key);

  it('émet chaque feature exactement une fois, dans l’ordre d’auteur', () => {
    const out = buildProps(authoredFacade()).filter((prop) => prop.source === 'architecture');
    expect(out.map((prop) => prop.key)).toEqual([
      'arch:corps-auberge:facade-rue:cheminee-ouest',
      'arch:corps-auberge:facade-rue:cheminee-est',
    ]);
    expect(new Set(out.map((prop) => prop.key)).size).toBe(2);
  });

  it('n’émet pas une feature dont l’arête ne porte aucun mur physique', () => {
    const scene = authoredFacade();
    scene.architecture![0].facades[0].features!.push({
      id: 'enseigne-sans-mur',
      kind: 'sign',
      edge: { x: 8, y: 8, side: 'N' },
    });
    expect(clesDeFeature(scene).some((cle) => cle.endsWith(':enseigne-sans-mur'))).toBe(false);
  });

  it('respecte z, offset, visibilité et filtrage d’étage sans dupliquer les ancres', () => {
    const scene = authoredFacade();
    const chimney = buildProps(scene, new Set(['4,5,0'])).find((prop) => prop.key.endsWith(':cheminee-ouest'))!;
    expect(chimney.cell).toEqual({ x: 4, y: 5, z: 0 });
    // Arête N de (4,5) parcourue à 25 % → (3.75, 4.5).
    expect(poseA(chimney, { x: 3.75, y: 4.5 }, 'N')).toBe(true);
    // Cette fixture n'a AUCUNE masse : la cheminée, déclarée `base: 'toit'`, retombe sur le sol SANS
    // son décalage — un décalage relatif à une couverture ne se lit pas sans couverture.
    expect(socleM(chimney)).toBe(0);
    expect(chimney.states.visible).toBe(true);
    // La feature vit au z 0 : un ISOLEMENT sur un autre étage la retire, l'étage ACTIF jamais (#1317).
    expect(clesDeFeature(scene, undefined, { activeZ: -1, viewZ: null })).toEqual(clesDeFeature(scene));
    expect(clesDeFeature(scene, undefined, { viewZ: 1 })).toEqual([]);
  });

  it('qualifie les ids homonymes par corps et section', () => {
    const scene = authoredFacade();
    scene.walls!.push({ x: 6, y: 5, side: 'N' });
    scene.architecture![0].facades.push({
      id: 'facade-cour',
      z: 0,
      edges: [{ x: 6, y: 5, side: 'N' }],
      appearance: 'auberge-relais-imperiale',
      features: [{ id: 'cheminee-ouest', kind: 'chimney', edge: { x: 6, y: 5, side: 'N' } }],
    });
    expect(clesDeFeature(scene)).toEqual([
      'arch:corps-auberge:facade-rue:cheminee-ouest',
      'arch:corps-auberge:facade-rue:cheminee-est',
      'arch:corps-auberge:facade-cour:cheminee-ouest',
    ]);
  });

  /**
   * FEATURE VOLUMIQUE (#1624) : une feature dont l'apparence porte une recette suit la MÊME règle que
   * tout décor (`refEstVolumique`) — elle sort en faces monde, ancrée au point FRACTIONNAIRE de son
   * arête, tournée vers le DEHORS (`outwardSide`, l'unique lecture du dehors), posée sur le sol + la
   * surélévation de sa vignette. Elle reste PICKING-INERTE : aucune face ne nomme d'entité.
   */
  it('une feature dont l’apparence porte une recette sort en VOLUME, sur l’arête et vers le DEHORS', () => {
    const scene = authoredFacade();
    scene.architecture![0].facades[0].features!.push({
      id: 'placard-de-facade', kind: 'sign', edge: { x: 3, y: 5, side: 'N' }, offset: 0.25, appearance: 'armoire',
    });
    const volumes = buildProps(scene).filter(estPropVolumique);
    expect(volumes.filter((v) => v.ref === 'armoire').map((v) => v.key)).toEqual(['arch:corps-auberge:facade-rue:placard-de-facade']);
    const [el] = volumes.filter((v) => v.ref === 'armoire');
    expect(el.source).toBe('architecture');
    expect(el.entId).toBeUndefined(); // rien à désigner au pointeur
    expect(el.facing).toBe('N'); // côté sortant de l'arête (2,5)-(3,5) côté N
    expect(el.faces.every((f) => f.entId === undefined)).toBe(true);
    // Ancre = l'arête N de la case (3,5) parcourue à 25 % → (2.75, 4.5) ; base = sol + `liftM` de la
    // vignette d'enseigne (2.2 m, `facades/defs/auberge-relais-imperiale`).
    expect(el.faces).toEqual(buildPropVolumes(findPropById('armoire')!, {
      ancre: { x: 2.75, y: 4.5 }, facing: 'N', baseHeightM: 2.2,
    }, MPT));
  });

  /**
   * ARÊTE DIAGONALE : elle n'a pas de case « d'en face » (`WALL_NB` rend [0,0]), donc aucun dehors à
   * lire — une recette y sortirait mal tournée. Repli BILLBOARD explicite. Population authorée mesurée
   * au 2026-08-31 : 148 features de façade dans `src/scenes`, 78 en N, 70 en E, ZÉRO diagonale.
   */
  it('une feature sur arête DIAGONALE reste un billboard, même avec une apparence à recette', () => {
    const scene = authoredFacade();
    scene.walls!.push({ x: 7, y: 5, side: '\\' });
    scene.architecture![0].facades[0].edges.push({ x: 7, y: 5, side: '\\' });
    scene.architecture![0].facades[0].features!.push({
      id: 'placard-diagonal', kind: 'sign', edge: { x: 7, y: 5, side: '\\' }, appearance: 'armoire',
    });
    const el = buildProps(scene).find((prop) => prop.key.endsWith(':placard-diagonal'))!;
    expect(estPropVolumique(el)).toBe(false);
    expect((el as BillboardPropEl).ref).toBe('armoire');
    expect(el.facing).toBeUndefined(); // aucun cap : l'arête n'a pas de dehors
  });

  /**
   * UNE SEULE REPRÉSENTATION DE L'ENSEIGNE (#1624) : la même feature `sign` sortait à DEUX endroits —
   * un décor ancré à la façade (`features.sign` du catalogue de façades) ET un panneau plaqué dans le
   * plan du mur (`wallFeatures.sign`, `buildWalls`). Le catalogue ne lie plus `sign` qu'à son décor,
   * dont la recette porte la potence et le panneau : la scène rend UN volume et AUCUNE face de mur
   * de ce kind.
   */
  it('une enseigne authorée rend UN décor volumique et ZÉRO face de mur `sign`', () => {
    const scene = authoredFacade();
    scene.architecture![0].facades[0].features!.push({
      id: 'enseigne-de-rue', kind: 'sign', edge: { x: 3, y: 5, side: 'N' }, offset: 0.5,
    });
    const enseignes = buildProps(scene).filter((prop) => prop.ref === 'enseigne');
    expect(enseignes.map((el) => el.key)).toEqual(['arch:corps-auberge:facade-rue:enseigne-de-rue']);
    expect(volume(enseignes[0]).faces.length).toBeGreaterThan(0);
    expect(poseA(enseignes[0], { x: 3, y: 4.5 }, 'N')).toBe(true);
    expect(socleM(enseignes[0])).toBe(2.2); // `features.sign.liftM` de l'auberge
    expect(buildWalls(scene).flatMap((wall) => wall.faces)
      .filter((face) => face.architectureFeatureKind === 'sign')).toEqual([]);
  });

  /**
   * L'`appearance` d'une feature est AUTHORABLE (`data/schemas/defs-scenes/scene.ts`) et servait DEUX
   * lecteurs : le nom d'un décor pour `buildProps`, celui d'une apparence de MUR pour `buildWalls`.
   * Une enseigne à apparence authorée sortait donc en double. Le verrou est par CONSTRUCTION
   * (`KINDS_DE_DECOR`, `builders/walls.ts`) : quoi que l'auteur pose, le plan du mur reste muet.
   */
  it.each([
    ['sans apparence authorée', undefined],
    ['apparence de MUR authorée', 'mur-en-bois'],
    ['apparence de DÉCOR à recette authorée', 'armoire'],
  ])('enseigne, %s : le plan du mur ne porte AUCUNE face', (_cas, appearance) => {
    const scene = authoredFacade();
    scene.architecture![0].facades[0].features!.push({
      id: 'enseigne-de-rue', kind: 'sign', edge: { x: 3, y: 5, side: 'N' }, offset: 0.5,
      ...(appearance ? { appearance } : {}),
    });
    expect(buildWalls(scene).flatMap((wall) => wall.faces)
      .filter((face) => face.architectureFeatureKind === 'sign')).toEqual([]);
    // ... et le décor, lui, sort bien UNE fois — le verrou ne doit pas avaler la représentation qui reste.
    expect(clesDeFeature(scene).filter((cle) => cle.endsWith(':enseigne-de-rue'))).toHaveLength(1);
  });

  /**
   * ANCRAGE À LA COUVERTURE (#1624) : une souche posée au sol + 2,25 m sortait à 3,73 m sous des toits
   * dont la couverture atteint 4 m et plus — une cheminée NOYÉE dans son propre toit. La vignette
   * déclare `base: 'toit'` et son `liftM` est un DELTA : la souche s'encastre dans la nappe
   * à l'aplomb de son ancre et la PERCE. Une seule machinerie de hauteur de toit
   * (`resolveNappes`/`fieldHeightAt`), celle des faîteaux.
   */
  it('cheminée à `base: toit` : la souche s’ENCASTRE dans la couverture à son aplomb et la PERCE', () => {
    const scene = facadeCouverte();
    const chimney = buildProps(scene).find((prop) => prop.key.endsWith(':cheminee-ouest'))!;
    const couverture = couvertureAu(scene, { x: 3.75, y: 4.5 });
    expect(couverture).toBeGreaterThan(0);
    const faces = volume(chimney).faces.flatMap((f) => f.poly.map((p) => p.h));
    expect(socleM(chimney)).toBeCloseTo(couverture - 0.3, 9); // `liftM` = delta d'encastrement
    expect(Math.min(...faces)).toBeLessThan(couverture); // pied SOUS la couverture : encastrée
    expect(Math.max(...faces)).toBeGreaterThan(couverture); // sommet AU-DESSUS : elle perce
  });

  it('clocheton à `base: toit` : son pied ne FLOTTE pas au-dessus de la couverture', () => {
    const scene = facadeCouverte();
    scene.architecture![0].facades[0].appearance = 'chapelle';
    scene.architecture![0].facades[0].features = [
      { id: 'clocheton-nef', kind: 'belfry', edge: { x: 3, y: 5, side: 'N' }, offset: 0.5 },
    ];
    const belfry = buildProps(scene).find((prop) => prop.key.endsWith(':clocheton-nef'))!;
    const couverture = couvertureAu(scene, { x: 3, y: 4.5 });
    expect(socleM(belfry)).toBeCloseTo(couverture - 0.15, 9);
    expect(socleM(belfry)).toBeLessThanOrEqual(couverture); // aucun vide entre le toit et le fût
    expect(couverture - socleM(belfry)).toBeLessThan(0.5); // ... ni enfoui
  });

  it('`base: toit` vaut pour les DEUX représentations : le BILLBOARD porte la même surélévation', () => {
    const scene = facadeCouverte();
    scene.architecture![0].facades[0].features!.push({
      // Apparence SANS recette : la même feature, servie par l'autre voie de rendu.
      id: 'souche-dessinee', kind: 'chimney', edge: { x: 4, y: 5, side: 'N' }, offset: 0.25, appearance: REF_BILLBOARD,
    });
    const props = buildProps(scene);
    const dessinee = props.find((prop) => prop.key.endsWith(':souche-dessinee'))!;
    const volumique = props.find((prop) => prop.key.endsWith(':cheminee-ouest'))!;
    expect(estPropVolumique(dessinee)).toBe(false);
    expect((dessinee as BillboardPropEl).liftM).toBeCloseTo(socleM(volumique), 9);
  });

  it('`base: toit` sans AUCUNE couverture à l’aplomb : repli DÉCLARÉ sur le sol, sans décalage', () => {
    const chimney = buildProps(authoredFacade()).find((prop) => prop.key.endsWith(':cheminee-est'))!;
    expect((chimney as { liftM?: number }).liftM).toBeUndefined();
    expect(socleM(chimney)).toBe(0);
  });
});
