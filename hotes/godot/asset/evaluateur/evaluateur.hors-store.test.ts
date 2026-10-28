// L'évaluateur d'une base 3D et de ses éléments (#2972) : chargement sans DOM, manifeste de base, gabarit, échantillonnage, gardes.
import { describe, expect, it } from 'vitest';
import {
  AnimationClip, Bone, BufferAttribute, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh,
  Uint16BufferAttribute, VectorKeyframeTrack,
} from 'three';
import { tableTotale } from '../../../../src/lib/tableTotale';
import { sha256 } from '../empreinte.ts';
import { ecrireGlb, lireGlb } from '../glb.ts';
import { chargerScene } from './chargement.ts';
import { echantillonner, instants, poseDeRepos } from './echantillonnage.ts';
import { evaluer } from './evaluer.ts';
import { appliquerGabarit, CARRURE_MOINS, CARRURE_PLUS, FACTEURS_NEUTRES, poidsDeCarrure, poserSilhouettes } from './gabarit.ts';
import { validerManifesteDeBase, type CodeDEcartDeBase } from '../manifesteDeBase.ts';
import { gardeBudget, trianglesDe } from './gardes/budget.ts';
import { gardeEchelleDuRigide, rigidesTenus } from './gardes/echelleDuRigide.ts';
import { gardeEnroulement } from './gardes/enroulement.ts';
import { aretesDe, ETIREMENT_MAX, ETIREMENT_MIN, gardeEtirement, mesurerEtirement } from './gardes/etirement.ts';
import { gardePiedsAuSol, plusBas, SOL_TOLERANCE_M } from './gardes/piedsAuSol.ts';
import { gardePistesDEchelle } from './gardes/pistesDEchelle.ts';
import { gardePoids, INFLUENCES_MAX } from './gardes/poids.ts';

const TABLE = { legs: ['racine'], arms: [], head: [], racine: 'racine', st: { min: 0.8, max: 1.2 } };

/** Un cylindre ouvert de 1 m posé au sol, skinné sur `racine` (pied) et `haut` (à 0,5 m), poids linéaires en hauteur. */
function cylindre() {
  const geometrie = new CylinderGeometry(0.1, 0.1, 1, 6, 2, true);
  geometrie.translate(0, 0.5, 0);
  const p = geometrie.attributes.position;
  const indices = new Uint16Array(p.count * 4);
  const poids = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    indices[i * 4 + 1] = 1;
    poids[i * 4] = 1 - p.getY(i);
    poids[i * 4 + 1] = p.getY(i);
  }
  geometrie.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
  geometrie.setAttribute('skinWeight', new Float32BufferAttribute(poids, 4));
  const racine = Object.assign(new Bone(), { name: 'racine' });
  const haut = Object.assign(new Bone(), { name: 'haut' });
  haut.position.y = 0.5;
  racine.add(haut);
  const mesh = Object.assign(new SkinnedMesh(geometrie, new MeshBasicMaterial()), { name: 'Corps' });
  const scene = new Group();
  scene.add(mesh);
  mesh.add(racine);
  scene.updateMatrixWorld(true);
  mesh.bind(new Skeleton([racine, haut]));
  return { scene, mesh, racine, haut };
}

/** Le clip `nom` d'une seconde qui mène `piste` (`<os>.<propriété>`) de `de` à `a`. */
const clip = (nom: string, piste: string, de: number[], a: number[]) => new AnimationClip(nom, 1, [new VectorKeyframeTrack(piste, [0, 1], [...de, ...a])]);

const OS_DU_CYLINDRE = new Set(['racine', 'haut']);

describe('gardePoids', () => {
  it('VERT : poids à 4 influences, somme à 1, os de la base, jumeaux de couture identiques', () => {
    const { mesh } = cylindre();
    expect(gardePoids({ meshes: [mesh], osDeLaBase: OS_DU_CYLINDRE, influencesEtendues: new Map() })).toEqual([]);
  });

  it('ROUGE : somme ≠ 1, somme nulle, os hors de la base, jumeaux divergents', () => {
    const { mesh } = cylindre();
    const poids = mesh.geometry.attributes.skinWeight;
    const p = mesh.geometry.attributes.position;
    const jumeau = Array.from({ length: p.count }, (_, j) => j).find((j) => j > 0 && Math.hypot(p.getX(j) - p.getX(0), p.getY(j) - p.getY(0), p.getZ(j) - p.getZ(0)) < 1e-9);
    expect(jumeau).toBeDefined();
    poids.setXYZW(jumeau ?? 0, 0.5, 0.5, 0, 0);
    poids.setXYZW(1, 0.3, 0.3, 0, 0);
    poids.setXYZW(2, 0, 0, 0, 0);
    const codes = gardePoids({ meshes: [mesh], osDeLaBase: new Set(['racine']), influencesEtendues: new Map() }).map((e) => e.code);
    expect(codes.sort()).toEqual(['jumeaux-divergents', 'os-hors-base', 'somme', 'somme-nulle']);
  });

  it('ROUGE : un jeu JOINTS_1 du binaire est au-delà de 4 influences', async () => {
    const octets = glbFabrique({ jeuEtendu: true });
    const { skinnes } = await chargerScene(octets);
    const ecarts = gardePoids({ meshes: skinnes, osDeLaBase: new Set(['racine']), influencesEtendues: lireGlb(octets).influencesEtendues });
    expect(ecarts.map((e) => [e.code, e.mesh, e.seuil])).toEqual([['influences-au-dela-de-4', 'Corps', INFLUENCES_MAX]]);
  });
});

describe('gardeEnroulement', () => {
  it('VERT : un cylindre aux normales sortantes', () => {
    expect(gardeEnroulement([cylindre().mesh])).toEqual([]);
  });

  it('ROUGE : un triangle à l’enroulement inversé', () => {
    const { mesh } = cylindre();
    const index = mesh.geometry.index as BufferAttribute;
    const [a, b] = [index.getX(0), index.getX(1)];
    index.setX(0, b);
    index.setX(1, a);
    expect(gardeEnroulement([mesh]).map((e) => [e.code, e.valeur])).toEqual([['triangle-retourne', 1]]);
  });
});

describe('gardeBudget', () => {
  it('VERT au plafond, ROUGE au-delà', () => {
    const { mesh } = cylindre();
    const total = trianglesDe(mesh);
    expect(gardeBudget([mesh], total)).toEqual([]);
    expect(gardeBudget([mesh], total - 1).map((e) => [e.code, e.valeur])).toEqual([['plafond-assemble', total]]);
  });
});

describe('gardePistesDEchelle', () => {
  it('VERT : rotations, échelle à 1, position de la racine et d’un os à position animée', () => {
    const clips = [new AnimationClip('Marche', 1, [
      new VectorKeyframeTrack('haut.scale', [0, 1], [1, 1, 1, 1, 1, 1]),
      new VectorKeyframeTrack('racine.position', [0, 1], [0, 0, 0, 0, 0, 1]),
      new VectorKeyframeTrack('pelvis.position', [0, 1], [0, 1, 0, 0, 0.9, 0]),
    ])];
    expect(gardePistesDEchelle(clips, 'racine', ['pelvis'])).toEqual([]);
  });

  it('ROUGE : la position d’un os que la liste des os à position animée ne nomme pas', () => {
    const clips = [clip('Marche', 'pelvis.position', [0, 1, 0], [0, 0.9, 0])];
    expect(gardePistesDEchelle(clips, 'racine', []).map((e) => [e.code, e.detail])).toEqual([['position-animee', 'pelvis.position animée ; valeur : son amplitude en m']]);
  });

  it('ROUGE : une échelle animée et une position d’os animée', () => {
    const clips = [clip('Frappe', 'haut.scale', [1, 1, 1], [1.2, 1.2, 1.2]), clip('Tend', 'haut.position', [0, 0.5, 0], [0, 0.6, 0])];
    const ecarts = gardePistesDEchelle(clips, 'racine', []);
    expect(ecarts.map((e) => [e.code, e.clip])).toEqual([['echelle-animee', 'Frappe'], ['position-animee', 'Tend']]);
    expect(ecarts[1].valeur).toBeCloseTo(0.1, 6);
  });
});

describe('échantillonnage et gardePiedsAuSol', () => {
  it('les instants vont de 0 à la durée au pas donné', () => {
    expect(instants(1, 0.5)).toEqual([0, 0.5, 1]);
  });

  it('VERT : un clip immobile garde le corps au sol ; ROUGE : un clip qui l’enfonce, la pose de repos rendue ensuite', () => {
    const { scene, mesh } = cylindre();
    const repos = poseDeRepos(scene, [mesh]).positions.get('Corps');
    const clips = [clip('Repos', 'racine.position', [0, 0, 0], [0, 0, 0]), clip('Plonge', 'racine.position', [0, 0, 0], [0, -0.1, 0])];
    const niveaux = [...echantillonner(scene, [mesh], clips, 0.5)].map((e) => ({ clip: e.clip, t: e.t, plusBas: plusBas(e.positions, ['Corps']) }));
    expect(niveaux.map((n) => [n.clip, n.t])).toEqual([['Repos', 0], ['Repos', 0.5], ['Repos', 1], ['Plonge', 0], ['Plonge', 0.5], ['Plonge', 1]]);
    const ecarts = gardePiedsAuSol(niveaux);
    expect(ecarts.map((e) => [e.code, e.clip, e.t])).toEqual([['sous-le-sol', 'Plonge', 1]]);
    expect(ecarts[0].valeur).toBeCloseTo(-0.1, 5);
    expect(poseDeRepos(scene, [mesh]).positions.get('Corps')).toEqual(repos);
  });

  it('ROUGE : un clip au sol qui décolle', () => {
    const niveaux = [{ clip: 'Marche', t: 0, plusBas: 0 }, { clip: 'Marche', t: 0.5, plusBas: 2 * SOL_TOLERANCE_M }];
    expect(gardePiedsAuSol(niveaux)).toEqual([]);
    expect(gardePiedsAuSol(niveaux, new Set(['Marche'])).map((e) => [e.code, e.t])).toEqual([['au-dessus-du-sol', 0.5]]);
  });
});

describe('gardeEtirement', () => {
  const mesurer = (c: AnimationClip) => {
    const { scene, mesh } = cylindre();
    const repos = poseDeRepos(scene, [mesh]);
    const aretes = new Map([[mesh.name, aretesDe(mesh)]]);
    return gardeEtirement([...echantillonner(scene, [mesh], [c], 1)].map((e) => mesurerEtirement(aretes, repos, e)));
  };

  it('VERT : un clip qui déplace le corps sans le déformer', () => {
    expect(mesurer(clip('Glisse', 'racine.position', [0, 0, 0], [0.3, 0, 0]))).toEqual([]);
  });

  it('ROUGE : un os qui étire, un os qui écrase', () => {
    expect(mesurer(clip('Gonfle', 'haut.scale', [1, 1, 1], [10, 10, 10])).map((e) => [e.code, e.seuil])).toEqual([['arete-etiree', ETIREMENT_MAX]]);
    expect(mesurer(clip('Ecrase', 'haut.scale', [1, 1, 1], [0.001, 0.001, 0.001])).map((e) => [e.code, e.seuil])).toEqual([['arete-ecrasee', ETIREMENT_MIN]]);
  });
});

describe('gardeEchelleDuRigide', () => {
  const tenu = (echelle: number) => {
    const { scene, haut, racine } = cylindre();
    haut.add(Object.assign(new Mesh(new CylinderGeometry(), new MeshBasicMaterial()), { name: 'Epee' }));
    racine.add(Object.assign(new Mesh(new CylinderGeometry(), new MeshBasicMaterial()), { name: 'Bouclier' }));
    haut.scale.setScalar(echelle);
    racine.scale.setScalar(echelle);
    return gardeEchelleDuRigide(rigidesTenus(scene, new Set(['haut'])));
  };

  it('VERT : le rigide sous la prise garde l’échelle 1', () => {
    expect(tenu(1)).toEqual([]);
  });

  it('ROUGE : le rigide sous la prise hérite d’une échelle ; un rigide hors prise n’est pas mesuré', () => {
    expect(tenu(1.5).map((e) => [e.code, e.mesh])).toEqual([['echelle-du-rigide', 'Epee']]);
  });
});

describe('gabarit', () => {
  it('les jambes allongent l’os enfant, `sl` met la racine à l’échelle', () => {
    const hauteur = (facteurs: typeof FACTEURS_NEUTRES) => {
      const { scene, mesh } = cylindre();
      appliquerGabarit(scene, facteurs, TABLE);
      return Math.max(...(poseDeRepos(scene, [mesh]).positions.get('Corps') ?? []).filter((_, i) => i % 3 === 1));
    };
    expect(hauteur(FACTEURS_NEUTRES)).toBeCloseTo(1, 5);
    expect(hauteur({ ...FACTEURS_NEUTRES, legs: 2 })).toBeCloseTo(1.5, 5);
    expect(hauteur({ ...FACTEURS_NEUTRES, sl: 2 })).toBeCloseTo(2, 5);
  });

  it('`st` pose une seule shape key de carrure, bornée à 1', () => {
    expect(poidsDeCarrure(0.9, TABLE.st)).toEqual({ [CARRURE_MOINS]: expect.closeTo(0.5, 9), [CARRURE_PLUS]: 0 });
    expect(poidsDeCarrure(1.5, TABLE.st)).toEqual({ [CARRURE_MOINS]: 0, [CARRURE_PLUS]: 1 });
    const { mesh } = cylindre();
    const forme = new Float32BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count * 3), 3);
    forme.name = CARRURE_PLUS;
    mesh.geometry.morphAttributes.position = [forme];
    mesh.updateMorphTargets();
    poserSilhouettes(mesh, poidsDeCarrure(1.1, TABLE.st));
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(0.5, 9);
  });
});

const TAILLE = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 } as const;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Un GLB fabriqué (chunks JSON et BIN) : un triangle `Corps` (zone `torse`, shape key `feminin`) skinné sur l'os `racine`,
 *  avec au choix une texture d'image, un jeu d'influence `JOINTS_1`, un os `pelvis` enfant de `racine`, et des clips de
 *  translation de `racine`, ou de `pelvis` s'il est là ; en marche, deux triangles de pied et leur cycle appui/vol. */
interface MarcheFabriquee { racine?: number; decolle?: number; lateral?: number; bloque?: boolean; vitesseDroite?: number; nom?: string; sens?: number; vitesse?: number }

function glbFabrique(options: { image?: boolean; jeuEtendu?: boolean; pelvis?: boolean; clips?: Record<string, readonly [number, number]>; marche?: MarcheFabriquee; autresMarches?: readonly MarcheFabriquee[] } = {}): Uint8Array {
  const morceaux: Uint8Array[] = [];
  const vues: object[] = [];
  const accesseurs: object[] = [];
  let decalage = 0;
  const vue = (octets: Uint8Array): number => {
    vues.push({ buffer: 0, byteOffset: decalage, byteLength: octets.byteLength });
    const bourrage = (4 - (octets.byteLength % 4)) % 4;
    morceaux.push(octets, new Uint8Array(bourrage));
    decalage += octets.byteLength + bourrage;
    return vues.length - 1;
  };
  const accesseur = (donnees: Float32Array | Uint16Array, type: keyof typeof TAILLE, bornes: object = {}): number => {
    accesseurs.push({ bufferView: vue(new Uint8Array(donnees.buffer)), componentType: donnees instanceof Float32Array ? 5126 : 5123, count: donnees.length / TAILLE[type], type, ...bornes });
    return accesseurs.length - 1;
  };
  const attributes: Record<string, number> = {
    POSITION: accesseur(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]), 'VEC3', { min: [0, 0, 0], max: [1, 1, 0] }),
    NORMAL: accesseur(Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]), 'VEC3'),
    JOINTS_0: accesseur(new Uint16Array(12), 'VEC4'),
    WEIGHTS_0: accesseur(Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 'VEC4'),
    ...(options.jeuEtendu ? { JOINTS_1: accesseur(new Uint16Array(12), 'VEC4'), WEIGHTS_1: accesseur(new Float32Array(12), 'VEC4') } : {}),
  };
  if (options.marche) {
    attributes.POSITION = accesseur(Float32Array.from([-0.3, 0, 0, -0.1, 0, 0, -0.2, 0, 0.2, 0.1, 0, 0, 0.3, 0, 0, 0.2, 0, 0.2]), 'VEC3', { min: [-0.3, 0, 0], max: [0.3, 0, 0.2] });
    attributes.NORMAL = accesseur(Float32Array.from(Array.from({ length: 6 }, () => [0, 1, 0]).flat()), 'VEC3');
    attributes.JOINTS_0 = accesseur(Uint16Array.from([1, 1, 1, 2, 2, 2].flatMap((i) => [i, 0, 0, 0])), 'VEC4');
    attributes.WEIGHTS_0 = accesseur(Float32Array.from(Array.from({ length: 6 }, () => [1, 0, 0, 0]).flat()), 'VEC4');
  }
  const identite = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const joints = options.marche ? [1, 2, 3] : options.pelvis ? [1, 2] : [1];
  const inverseBindMatrices = accesseur(Float32Array.from(joints.flatMap(() => identite)), 'MAT4');
  const animations = Object.entries(options.clips ?? {}).map(([name, [de, a]]) => ({
    name,
    channels: [{ sampler: 0, target: { node: joints[joints.length - 1], path: 'translation' } }],
    samplers: [{ input: accesseur(Float32Array.from([0, 1]), 'SCALAR', { min: [0], max: [1] }), output: accesseur(Float32Array.from([0, de, 0, 0, a, 0]), 'VEC3'), interpolation: 'LINEAR' }],
  }));
  for (const m of options.marche ? [options.marche, ...(options.autresMarches ?? [])] : []) {
    const temps = [0, 0.25, 0.5, 0.75, 1];
    const poses = [1, 2, 3].map((node) => temps.flatMap((t) => {
      if (node === 1) return [0, 0, (m.racine ?? 0) * t * (m.sens ?? 1)];
      const phase = node === 2 ? t : (t + 0.5) % 1;
      const z = m.bloque ? 0 : (phase <= 0.5 ? 0.5 - 2 * phase : -0.5 + 2 * (phase - 0.5));
      const vol = phase <= 0.5 ? 0 : 0.2 * (1 - Math.abs(phase - 0.75) * 4);
      return [node === 2 ? (m.lateral ?? 0) * t : 0, vol + (node === 2 ? (m.decolle ?? 0) : 0), z * (node === 3 ? (m.vitesseDroite ?? 1) : 1) * (m.sens ?? 1) * (m.vitesse ?? 1)];
    }));
    animations.push({ name: m.nom ?? 'Walk_Loop', channels: [1, 2, 3].map((node, sampler) => ({ sampler, target: { node, path: 'translation' } })), samplers: poses.map((p) => ({ input: accesseur(Float32Array.from(temps), 'SCALAR', { min: [0], max: [1] }), output: accesseur(Float32Array.from(p), 'VEC3'), interpolation: 'LINEAR' })) });
  }
  const image = options.image ? { images: [{ bufferView: vue(PNG), mimeType: 'image/png' }], textures: [{ source: 0, sampler: 0 }], samplers: [{}] } : {};
  const bin = new Uint8Array(decalage);
  morceaux.reduce((n, m) => (bin.set(m, n), n + m.byteLength), 0);
  return ecrireGlb({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [{ name: 'Corps', mesh: 0, skin: 0, extras: { zone: 'torse' } }, { name: 'racine', ...(options.marche ? { children: [2, 3] } : options.pelvis ? { children: [2] } : {}) }, ...(options.marche ? [{ name: 'piedG' }, { name: 'piedD' }] : options.pelvis ? [{ name: 'pelvis' }] : [])],
    meshes: [{ primitives: [{ attributes, material: 0 }], extras: { targetNames: ['feminin'] } }],
    materials: [{ name: 'peau', pbrMetallicRoughness: options.image ? { baseColorTexture: { index: 0 } } : {} }],
    skins: [{ joints, inverseBindMatrices }],
    ...(animations.length ? { animations } : {}),
    ...image,
    accessors: accesseurs,
    bufferViews: vues,
    buffers: [{ byteLength: decalage }],
  }, bin);
}

const ATTACHE = { os: 'racine', position: [0, 0, 0], rotation: [0, 0, 0] };

/** Le manifeste qui décrit le GLB `octets` de `glbFabrique`, d'os `os`. */
const manifesteDe = (octets: Uint8Array, os = ['racine']) => ({
  schema: 3, base: 'fabrique', os, chaines: { jambe: ['racine'] }, zones: ['torse'], emplacements: { dos: { ...ATTACHE } },
  prises: { main: { ...ATTACHE }, off: { ...ATTACHE } }, silhouettes: ['feminin'], gabarit: { ...TABLE, legs: [] },
  porteur: { race: 'humain', gabarit: 'moyen', taille: 'moyenne', echelleDArt: 1 },
  appuis: { pieds: ['racine'], vitessesAuSol: tableTotale([...lireGlb(octets).animations], () => 1.4) },
  osAPositionAnimee: os.filter((o) => o !== 'racine'),
  glb: { sha256: sha256(octets), octets: octets.byteLength },
});

describe('chargerScene et lireGlb', () => {
  it('charge sans DOM un GLB qui embarque une image', async () => {
    const octets = glbFabrique({ image: true, clips: { Repos: [0, 0] } });
    expect(lireGlb(octets).images).toBe(1);
    const charge = await chargerScene(octets);
    expect(charge.meshes.map((m) => m.name)).toEqual(['Corps']);
    expect(charge.skinnes).toHaveLength(1);
    expect(charge.squelette?.bones.map((b) => b.name)).toEqual(['racine']);
    expect(charge.clips.map((c) => c.name)).toEqual(['Repos']);
    expect(charge.userData.get('Corps')).toMatchObject({ zone: 'torse' });
  });

  it('lit les jeux d’influence étendus, les zones et les shape keys', () => {
    const contenu = lireGlb(glbFabrique({ jeuEtendu: true }));
    expect(contenu.influencesEtendues).toEqual(new Map([['Corps', ['JOINTS_1', 'WEIGHTS_1']]]));
    expect(contenu.zones).toEqual(new Map([['torse', ['Corps']]]));
    expect(contenu.formes).toEqual(new Set(['feminin']));
  });
});

describe('validerManifesteDeBase', () => {
  const octets = glbFabrique({ clips: { Repos: [0, 0] } });
  const attache = ATTACHE;
  const valide = () => manifesteDe(octets);
  const codes = (brut: unknown): CodeDEcartDeBase[] => {
    const verdict = validerManifesteDeBase(brut, octets);
    return verdict.ok ? [] : verdict.ecarts.map((e) => e.code);
  };

  it('accepte le manifeste qui décrit le GLB', () => {
    expect(validerManifesteDeBase(valide(), octets).ok).toBe(true);
  });

  it.each<[CodeDEcartDeBase, (m: ReturnType<typeof valide>) => unknown]>([
    ['forme', (m) => ({ ...m, base: 3 })],
    ['version-inconnue', (m) => ({ ...m, schema: 2 })],
    ['os-inconnu', (m) => ({ ...m, os: ['racine', 'fantome'] })],
    ['chaine-sur-os-absent', (m) => ({ ...m, chaines: { jambe: ['fantome'] } })],
    ['zone-sans-mesh', (m) => ({ ...m, zones: ['torse', 'bras'] })],
    ['emplacement-sur-os-absent', (m) => ({ ...m, emplacements: { dos: { ...attache, os: 'fantome' } } })],
    ['prise-absente', (m) => ({ ...m, prises: { main: m.prises.main } })],
    ['silhouette-absente', (m) => ({ ...m, silhouettes: ['masculin'] })],
    ['glb-different', (m) => ({ ...m, glb: { ...m.glb, octets: m.glb.octets + 1 } })],
  ])('refuse par le code %s', (code, alterer) => {
    expect(codes(alterer(valide()))).toEqual([code]);
  });

  it.each<[string, CodeDEcartDeBase, (m: ReturnType<typeof valide>) => unknown]>([
    ['porteur absent', 'forme', ({ porteur: _, ...m }) => m],
    ['race vide', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, race: '' } })],
    ['gabarit absent', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, gabarit: undefined } })],
    ['taille non chaîne', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, taille: 3 } })],
    ['échelle d’art nulle', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, echelleDArt: 0 } })],
    ['échelle d’art infinie', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, echelleDArt: Infinity } })],
    ['appuis absents', 'forme', ({ appuis: _, ...m }) => m],
    ['aucun pied', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, pieds: [] } })],
    ['pied hors des os', 'os-inconnu', (m) => ({ ...m, appuis: { ...m.appuis, pieds: ['fantome'] } })],
    ['vitesse au sol négative', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitessesAuSol: { Repos: -1.4 } } })],
    ['vitesse au sol nulle', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitessesAuSol: { Repos: 0 } } })],
    ['vitesse au sol infinie', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitessesAuSol: { Repos: Infinity } } })],
    ['vitesse au sol non numérique', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitessesAuSol: { Repos: '1.4' } } })],
    ['vitesses au sol absentes', 'forme', (m) => ({ ...m, appuis: { pieds: m.appuis.pieds } })],
    ['aucun clip déclaré', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitessesAuSol: {} } })],
    ['table de vitesses non objet', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitessesAuSol: 1.4 } })],
    ['os à position animée absents', 'forme', ({ osAPositionAnimee: _, ...m }) => m],
    ['os à position animée hors des os', 'os-inconnu', (m) => ({ ...m, osAPositionAnimee: ['fantome'] })],
  ])('refuse %s par le code %s', (_cas, code, alterer) => {
    expect(new Set(codes(alterer(valide())))).toEqual(new Set([code]));
  });

  it('nomme le clip déclaré absent du GLB', () => {
    const m = valide();
    expect(validerManifesteDeBase({ ...m, appuis: { ...m.appuis, vitessesAuSol: { Inconnu: 1 } } }, octets)).toEqual({
      ok: false, ecarts: [{ code: 'clip-absent', ou: 'appuis.vitessesAuSol.Inconnu', detail: 'Inconnu n’est pas un clip du GLB' }],
    });
  });
});

describe('evaluer', () => {
  it('VERT : une base au sol, sans écart, et sa fiche de mesures', async () => {
    const fiche = await evaluer({ base: glbFabrique({ image: true, clips: { Repos: [0, 0] } }), pas: 0.5 });
    expect(fiche.ecarts).toEqual([]);
    expect(fiche.mesures).toMatchObject({ triangles: { total: 1, parMesh: { Corps: 1 } }, sommets: 3, os: 1, images: 1, corps: ['Corps'] });
    expect(fiche.mesures.clips).toEqual([{ nom: 'Repos', duree: 1, echantillons: 3, plusBas: { min: 0, max: 0 } }]);
  });

  it('ROUGE : le binaire et l’animation composent leurs écarts, le manifeste invalide est un écart', async () => {
    const fiche = await evaluer({ base: glbFabrique({ jeuEtendu: true, clips: { Plonge: [0, -0.1] } }), manifeste: { schema: 2 }, pas: 0.5 });
    expect(fiche.ecarts.map((e) => `${e.garde}/${e.code}`)).toEqual(expect.arrayContaining(['manifeste/version-inconnue', 'poids/influences-au-dela-de-4', 'piedsAuSol/sous-le-sol']));
  });

  it('les os à position animée viennent du manifeste ; sans lui, seule la racine', async () => {
    const base = glbFabrique({ pelvis: true, clips: { Marche: [0, 0.1] } });
    const positionsAnimees = (fiche: Awaited<ReturnType<typeof evaluer>>) => fiche.ecarts.filter((e) => e.garde === 'pistesDEchelle').map((e) => e.detail);
    expect(positionsAnimees(await evaluer({ base, pas: 0.5 }))).toEqual(['pelvis.position animée ; valeur : son amplitude en m']);
    const fiche = await evaluer({ base, manifeste: manifesteDe(base, ['racine', 'pelvis']), pas: 0.5 });
    expect(fiche.ecarts.filter((e) => e.garde === 'manifeste')).toEqual([]);
    expect(positionsAnimees(fiche)).toEqual([]);
  });

  it('refuse des facteurs de gabarit sans manifeste valide, et un clip absent', async () => {
    await expect(evaluer({ base: glbFabrique(), facteurs: { legs: 1.1 } })).rejects.toThrow(/sans manifeste/);
    await expect(evaluer({ base: glbFabrique(), clips: ['Absent'] })).rejects.toThrow(/Absent/);
  });

  it('refuse une silhouette ou une carrure que la base ne porte pas', async () => {
    const base = glbFabrique({ clips: { Repos: [0, 0] } });
    expect((await evaluer({ base, silhouettes: { feminin: 1 }, pas: 0.5 })).ecarts).toEqual([]);
    await expect(evaluer({ base, silhouettes: { feminin: 1, masculin: 1 }, pas: 0.5 })).rejects.toThrow(/\[silhouette-absente\] masculin /);
    await expect(evaluer({ base, manifeste: manifesteDe(base), facteurs: { st: 1.1 }, pas: 0.5 })).rejects.toThrow(/\[carrure-absente\] st=1\.1 .*carrure_plus/);
  });
});

describe('appuis des clips walk', () => {
  const mesurer = async (marche: NonNullable<Parameters<typeof glbFabrique>[0]>['marche'] = {}, vitesseAuSol = 2, pas = 0.125) => {
    const base = glbFabrique({ marche });
    const manifeste = { ...manifesteDe(base, ['racine', 'piedG', 'piedD']), appuis: { pieds: ['piedG', 'piedD'], vitessesAuSol: { [marche?.nom ?? 'Walk_Loop']: vitesseAuSol } } };
    return evaluer({ base, manifeste, pas });
  };
  const ecarts = (f: Awaited<ReturnType<typeof evaluer>>) => f.ecarts.filter((e) => e.garde === 'appuis');

  it.each([0, 2])('mesure 2 m/s par pied et clip avec une translation de racine de %s m/s, sans la doubler', async (racine) => {
    const f = await mesurer({ racine });
    expect(ecarts(f)).toEqual([]);
    expect(f.mesures.clips[0].appuis?.vitesseAuSol).toBeCloseTo(2, 6);
    expect(f.mesures.clips[0].appuis?.pieds).toHaveLength(2);
    for (const p of f.mesures.clips[0].appuis?.pieds ?? []) {
      expect(p.vitesseAuSol).toBeCloseTo(2, 6);
      expect(p.contactMax).toBe(0);
      expect(p.glissementMax).toBeLessThan(1e-6);
      expect(p.intervalles).toBeGreaterThan(0);
    }
  });

  it('refuse une vitesse déclarée fausse et mesure le glissement dans le monde', async () => {
    const f = await mesurer({}, 1);
    expect(ecarts(f).map((e) => e.code)).toEqual(['vitesse-declaree', 'glissement', 'vitesse-declaree', 'glissement']);
    expect(f.mesures.clips[0].appuis?.pieds[0].glissementMax).toBeCloseTo(0.5, 6);
  });

  it('oriente la marche sur place et conserve la phase de vol hors de l’appui', async () => {
    const f = await mesurer({ sens: -1 });
    expect(ecarts(f)).toEqual([]);
    expect(f.mesures.clips[0].appuis?.direction[1]).toBeCloseTo(-1, 6);
    expect(f.mesures.clips[0].appuis?.vitesseAuSol).toBeCloseTo(2, 6);
  });

  it('mesure le contact par pied même si l’autre pied garde le corps au sol', async () => {
    const f = await mesurer({ decolle: 0.03 });
    expect(ecarts(f).map((e) => [e.code, e.detail.split(' : ')[0]])).toEqual([['contact', 'piedG']]);
    expect(f.mesures.clips[0].appuis?.pieds[0].contactMax).toBeCloseTo(0.03, 6);
  });

  it('ne laisse pas deux vitesses de pied se compenser dans la moyenne du clip', async () => {
    const f = await mesurer({ vitesseDroite: 0.5 });
    expect(ecarts(f).map((e) => e.code)).toContain('vitesse-declaree');
    expect(f.mesures.clips[0].appuis?.pieds[1].vitesseAuSol).toBeCloseTo(1, 6);
  });

  it('refuse un appui indétectable plutôt que de déclarer une mesure verte', async () => {
    expect(ecarts(await mesurer({ bloque: true })).map((e) => e.code)).toEqual(['appui-indetectable', 'appui-indetectable']);
  });

  it('cumule une dérive latérale inférieure à 5 mm par intervalle', async () => {
    const f = await mesurer({ lateral: 0.04 }, 2, 0.05);
    expect(ecarts(f).map((e) => e.code)).toContain('glissement');
  });

  it('mesure les clips déclarés à leur vitesse propre, indépendamment de leur nom', async () => {
    const base = glbFabrique({ marche: { nom: 'Allure_lente' }, autresMarches: [{ nom: 'Allure_rapide', vitesse: 2 }, { nom: 'Walk_Loop' }] });
    const manifeste = { ...manifesteDe(base, ['racine', 'piedG', 'piedD']), appuis: { pieds: ['piedG', 'piedD'], vitessesAuSol: { Allure_lente: 2, Allure_rapide: 4 } } };
    const f = await evaluer({ base, manifeste, pas: 0.125 });
    expect(ecarts(f)).toEqual([]);
    expect(f.mesures.clips.map((c) => [c.nom, c.appuis?.vitesseDeclaree, c.appuis?.vitesseAuSol])).toEqual([
      ['Allure_lente', 2, expect.closeTo(2, 6)], ['Allure_rapide', 4, expect.closeTo(4, 6)], ['Walk_Loop', undefined, undefined],
    ]);
  });
});
