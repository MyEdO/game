// L'évaluateur d'une base 3D et de ses éléments (#2972) : chargement sans DOM, manifeste de base, gabarit, échantillonnage, gardes.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  AnimationClip, AnimationMixer, Bone, BoxGeometry, InterpolateDiscrete, BufferAttribute, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh,
  Matrix4, Quaternion, QuaternionKeyframeTrack, Uint16BufferAttribute, Vector3, VectorKeyframeTrack,
} from 'three';
import { ecrireGlb, lireConteneur, lireGlb } from '../glb.ts';
import { chargerScene } from './chargement.ts';
import { peauDeLaTenue } from './corps.ts';
import { COUCHES, type Couche } from '../element.ts';
import { echantillonner, instants, poseDeRepos } from './echantillonnage.ts';
import { evaluer, monter, poidsDesFormesDe } from './evaluer.ts';
import { appliquerGabarit, bindsAuGabarit, enfantsDuGabarit, jambesDuGabarit, poserEnfantsDuGabarit, poserFormes, poserLeGabarit, reposerGabarit } from './gabarit.ts';
import { nomDeCleDuGabarit, poidsDeCarrure, poidsDeSilhouettes, poidsDuGabarit, poseDuGabarit, sensCuitsDuGabarit } from '../gabarit.ts';
import { FACTEURS_NEUTRES } from '../facteursDuGabarit.ts';
import { CARRURE_MOINS, CARRURE_PLUS, CORPULENCE, FEMININ } from '../silhouettes.ts';
import { validerManifesteDeBase, type CandidatDAppui, type CodeDEcartDeBase, type TableDeGabarit } from '../manifesteDeBase.ts';
import { mesurerAppuis, type PoseDuPied } from './gardes/appuis.ts';
import { gardeBudget, trianglesDe } from './gardes/budget.ts';
import { gardePistesDeChaine, suivreLesChaines } from './gardes/chaines.ts';
import { gardeEchelleDuRigide, rigidesTenus } from './gardes/echelleDuRigide.ts';
import { gardeEnroulement } from './gardes/enroulement.ts';
import { gardeTranchantDuRigide, TOLERANCE_TRANCHANT_M } from './gardes/tranchantDuRigide.ts';
import { aretesDe, ETIREMENT_AU_REPOS, ETIREMENT_EN_CLIP, gardeEtirement, gardeEtirementAuRepos, mesurerEtirement } from './gardes/etirement.ts';
import { libellesDesMeshes } from './ecart.ts';
import { gardePiedsAuSol, plusBas, SOL_TOLERANCE_M } from './gardes/piedsAuSol.ts';
import { gardePistesDEchelle } from './gardes/pistesDEchelle.ts';
import { gardePoids, INFLUENCES_MAX } from './gardes/poids.ts';
import { anneauLePlusEpais, anneauxArticulaires, mesurerSilhouettes, sectionsDeRepos, sousLesFormes, TOLERANCE_EPAISSEUR } from './gardes/silhouettes.ts';
import { etenduesDesSegments, gardeSegments } from './gardes/segments.ts';
import { jouet } from '../../../../scripts/personnage-3d/base/gabarit.testkit.ts';
import { BORNES } from '../gabarit.testkit.ts';
import { preparerGabarit } from '../../../../scripts/personnage-3d/base/gabarit.ts';
import { hauteurDesCandidats, peauxDesCandidats } from './candidatsDAppui.ts';
import { grilleDesAppuis } from './grilleDesAppuis.ts';
import { ANNEAU, ATTACHE, TABLE, formesAvecGabarit, glbFabrique, manifesteDe, osLibres } from './glbFabrique.testkit.ts';

/** La scène three du jouet `c` (`gabarit.testkit.ts`), ses formes `formes` en shape keys relatives, et les appuis de son pied. */
function sceneDuJouet(c: ReturnType<typeof jouet>, formes: readonly { readonly nom: string; readonly deltas: readonly Vector3[] }[]) {
  const geometrie = new BufferGeometry();
  geometrie.setAttribute('position', new Float32BufferAttribute(c.positions.flatMap((p) => p.toArray()), 3));
  geometrie.setAttribute('skinIndex', new Uint16BufferAttribute(c.poids.flatMap((ws) => [0, 1, 2, 3].map((k) => ws[k]?.[0] ?? 0)), 4));
  geometrie.setAttribute('skinWeight', new Float32BufferAttribute(c.poids.flatMap((ws) => [0, 1, 2, 3].map((k) => ws[k]?.[1] ?? 0)), 4));
  geometrie.morphAttributes.position = formes.map((f) => Object.assign(new Float32BufferAttribute(f.deltas.flatMap((d) => d.toArray()), 3), { name: f.nom }));
  geometrie.morphTargetsRelative = true;
  const mesh = new SkinnedMesh(geometrie, new MeshBasicMaterial()), scene = new Group();
  scene.add(c.squelette.bones[0], mesh); mesh.bind(c.squelette, new Matrix4());
  const manifeste = { gabarit: c.table, appuis: { pieds: ['foot'], plusBas: [{ position: [0, 0, 0] as const, os: [{ nom: 'foot', poids: 1 }], deltas: {} }], vitesseAuSol: 1 } };
  return { scene, mesh, manifeste };
}

describe('repos posé A·P (#3104)', () => {
  it.each(['repos', 'propre à chaque os'] as const)('reconstruit H5 par les clés cuites et les binds compensés, bind %s', (bind) => {
    for (const etat of [{ legs: 0.62, arms: 1.6, head: 1.9 }, { legs: 1.3, arms: 1.4, head: 1.2 },
      { legs: BORNES.legs.min }, { legs: BORNES.legs.max, arms: 1.6, head: 1.9 }, {}, { legs: 0.8 },
      { legs: 1.3, arms: 1.4, head: 1.2, sl: 1.15 }, { legs: 0.62, arms: 1.6, head: 1.9, sl: 0.85 }]) {
      const c = jouet();
      if (bind === 'propre à chaque os') c.squelette.boneInverses = c.squelette.bones.map((b, i) =>
        b.matrixWorld.clone().multiply(new Matrix4().makeRotationZ(0.1 * i).setPosition(0.01 * i, 0, 0)).invert());
      const facteurs = { ...FACTEURS_NEUTRES, ...etat }, h5 = preparerGabarit(c);
      const poidsSil = { feminin: 0.4, carrure_moins: 0.8, carrure_plus: 1, corpulence: 0.55 };
      const cles = sensCuitsDuGabarit(BORNES).flatMap(({ cle, sens }) => [h5.cuire(cle, sens), ...c.silhouettes.map((s) => h5.cuire(cle, sens, s))]);
      const repos = c.positions.map((p, i) => c.silhouettes.reduce((v, s) => v.addScaledVector(s.deltas[i], poidsSil[s.nom as keyof typeof poidsSil]), p.clone()));
      const direct = h5.resoudre(facteurs, repos);
      const peau = c.squelette.bones.map((b, i) => b.matrixWorld.clone().multiply(c.squelette.boneInverses[i]));
      const avant = c.squelette.bones[0].matrixWorld.clone();
      const { scene, mesh, manifeste } = sceneDuJouet(c, [...c.silhouettes, ...cles]);
      appliquerGabarit(scene, facteurs, manifeste);
      poserFormes(scene, { ...poidsSil, ...poidsDuGabarit(facteurs, BORNES, poidsSil) });
      scene.updateMatrixWorld(true);
      const a = c.squelette.bones[0].matrixWorld.clone().multiply(avant.invert());
      const max = Math.max(...direct.map((p, i) => {
        const reference = c.poids[i].reduce((v, [b, w]) => v.addScaledVector(p.clone().applyMatrix4(peau[b]), w), new Vector3()).applyMatrix4(a);
        return mesh.getVertexPosition(i, new Vector3()).distanceTo(reference);
      }));
      expect(max, `repos posé A·P, bind ${bind}, état ${JSON.stringify(etat)}, écart max ${max} m`).toBeLessThanOrEqual(1e-6);
    }
  });
});

describe('gardeSegments (#3097)', () => {
  it('un segment dont l’os n’a pas d’os enfant suit S_b sur ses trois axes, comme les segments à enfant', () => {
    const c = jouet();
    expect(c.squelette.bones.find((b) => b.name === 'Head')?.children.some((n) => (n as Bone).isBone)).toBe(false);
    const facteurs = { ...FACTEURS_NEUTRES, legs: 0.62, arms: 1.6, head: 1.9 };
    const pose = poseDuGabarit({ gabarit: c.table }, facteurs);
    const os = Object.keys(pose.echellesDesOs);
    for (const nom of os) {
      const b = c.squelette.bones.findIndex((o) => o.name === nom), monde = c.squelette.bones[b].matrixWorld;
      for (const colonne of [0, 1, 2]) for (const d of [-0.03, 0.05]) {
        c.positions.push(c.squelette.bones[b].getWorldPosition(new Vector3()).addScaledVector(new Vector3().setFromMatrixColumn(monde, colonne).normalize(), d));
        c.poids.push([[b, 1]]);
      }
    }
    const h5 = preparerGabarit(c);
    const { scene, mesh, manifeste } = sceneDuJouet(c, sensCuitsDuGabarit(BORNES).map(({ cle, sens }) => h5.cuire(cle, sens)));
    const sansGabarit = etenduesDesSegments(poseDeRepos(scene, [mesh]), [mesh], os);
    poserFormes(scene, poidsDuGabarit(facteurs, BORNES, {}));
    appliquerGabarit(scene, facteurs, manifeste);
    const { mesures, ecarts } = gardeSegments(sansGabarit, etenduesDesSegments(poseDeRepos(scene, [mesh]), [mesh], os), pose);
    expect(ecarts).toEqual([]);
    expect(mesures.segments.map((s) => [s.os, s.attendu, s.rapport.map((r) => +(r ?? 0).toFixed(6))])).toEqual([
      ['thigh', [1, 0.62, 1], [1, 0.62, 1]], ['calf', [1, 0.62, 1], [1, 0.62, 1]],
      ['upperarm', [1, 1.6, 1], [1, 1.6, 1]], ['lowerarm', [1, 1.6, 1], [1, 1.6, 1]], ['Head', [1.9, 1.9, 1.9], [1.9, 1.9, 1.9]]]);
  });

  it('ROUGE : une tête étirée en Y seulement, un axe sans étendue mesurable', () => {
    const { mesures, ecarts } = gardeSegments(
      new Map([['tete', [0.2, 0.2, 0.2]], ['cuisse', [0.1, 0.4, 0]]] as const),
      new Map([['tete', [0.2, 0.38, 0.2]], ['cuisse', [0.1, 0.2, 0]]] as const),
      { echellesDesOs: { tete: [1.9, 1.9, 1.9], cuisse: [1, 0.5, 1] } });
    expect(mesures.ecartALEchelle).toBeCloseTo(0.9 / 1.9, 9);
    expect(ecarts.map((e) => [e.code, e.detail.split(' ')[0]])).toEqual([
      ['segment-hors-echelle', 'tete.x'], ['segment-hors-echelle', 'tete.z'], ['segment-indetectable', 'aucune']]);
    expect(ecarts[2].valeur).toBe('cuisse.z');
  });
});

/** Le gabarit et les appuis d'un manifeste de base, pieds `pieds`. */
const gabaritEtAppuis = (gabarit: TableDeGabarit, pieds: readonly string[] = ['racine']) => ({ gabarit, appuis: { pieds, plusBas: pieds.map((nom) => ({ position: [0, nom === 'piedG' ? 0.1 : nom === 'piedD' ? 0.2 : 0, 0] as const, os: [{ nom, poids: 1 }], deltas: {} })), vitesseAuSol: 1 } });

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

/** Un libellé de test, distinct du nom three du mesh. */
const libelle = (m: Mesh): string => `«${m.name}»`;

describe('peauDeLaTenue (#3842)', () => {
  const nomme = (name: string) => Object.assign(new Mesh(), { name });
  const [tete, cou] = [nomme('tete'), nomme('cou')];
  const zones = new Map([[tete, 'tete'], [cou, 'cou']]);
  const zone = (m: Mesh) => zones.get(m);
  const rang = (couche: Couche) => COUCHES.indexOf(couche);

  it('les pièces de la couche peau qui couvrent une zone remplacent le corps de cette zone ; ni la barbe ni la robe ne changent la peau', () => {
    const [teteMontee, barbe, robe] = [nomme('tete montée'), nomme('barbe'), nomme('robe')];
    const pieces = [
      { rang: rang('peau'), couvre: ['tete'], meshes: [teteMontee] },
      { rang: rang('peau'), couvre: [], meshes: [barbe] },
      { rang: rang('tenue'), couvre: ['cou'], meshes: [robe] },
    ];
    expect(peauDeLaTenue([tete, cou], pieces, zone).map((m) => m.name)).toEqual(['cou', 'tete montée']);
  });

  it('sans pièce de la couche peau, la peau est le corps', () => {
    const corps = [tete, cou];
    const peau = peauDeLaTenue(corps, [{ rang: rang('tenue'), couvre: ['cou'], meshes: [nomme('robe')] }], zone);
    expect(peau).toHaveLength(2);
    corps.forEach((m, i) => expect(peau[i]).toBe(m));
  });
});

describe('gardePoids', () => {
  it('VERT : poids à 4 influences, somme à 1, os de la base, jumeaux de couture identiques', () => {
    const { mesh } = cylindre();
    expect(gardePoids({ meshes: [mesh], osDeLaBase: OS_DU_CYLINDRE, libelle })).toEqual([]);
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
    const ecarts = gardePoids({ meshes: [mesh], osDeLaBase: new Set(['racine']), libelle });
    expect(ecarts.map((e) => e.code).sort()).toEqual(['jumeaux-divergents', 'os-hors-base', 'somme', 'somme-nulle']);
    expect(new Set(ecarts.map((e) => e.mesh))).toEqual(new Set(['«Corps»']));
  });

  it('ROUGE : un jeu JOINTS_1 du binaire est au-delà de 4 influences, sur la seule primitive qui le porte', async () => {
    const scene = await chargerScene(glbFabrique({ jeuEtendu: true, primitives: 2 }));
    const ecarts = gardePoids({ meshes: scene.skinnes, osDeLaBase: new Set(['racine']), libelle: libellesDesMeshes([scene]) });
    expect(ecarts.map((e) => [e.code, e.mesh, e.valeur, e.seuil])).toEqual([['influences-au-dela-de-4', 'base/Corps#0', 'JOINTS_1, WEIGHTS_1', INFLUENCES_MAX]]);
  });
});

describe('gardeEnroulement', () => {
  it('VERT : un cylindre aux normales sortantes', () => {
    expect(gardeEnroulement([cylindre().mesh], libelle)).toEqual([]);
  });

  it('ROUGE : un triangle à l’enroulement inversé', () => {
    const { mesh } = cylindre();
    const index = mesh.geometry.index as BufferAttribute;
    const [a, b] = [index.getX(0), index.getX(1)];
    index.setX(0, b);
    index.setX(1, a);
    expect(gardeEnroulement([mesh], libelle).map((e) => [e.code, e.mesh, e.valeur])).toEqual([['triangle-retourne', '«Corps»', 1]]);
  });
});

describe('gardeBudget', () => {
  it('VERT au plafond, ROUGE au-delà', () => {
    const { mesh } = cylindre();
    const total = trianglesDe(mesh);
    expect(gardeBudget([mesh], libelle, total)).toEqual([]);
    expect(gardeBudget([mesh], libelle, total - 1).map((e) => [e.code, e.valeur, e.detail])).toEqual([['plafond-assemble', total, `${total} triangles («Corps» ${total})`]]);
  });
});

/** Une scène des os `noms`, que les pistes d'un clip fait main nomment. */
const sceneDesOs = (...noms: readonly string[]): Group => new Group().add(...noms.map((name) => Object.assign(new Bone(), { name })));

describe('gardePistesDEchelle', () => {
  it('VERT : rotations, échelle à 1, position de la racine et d’un os à position animée', () => {
    const clips = [new AnimationClip('Marche', 1, [
      new VectorKeyframeTrack('haut.scale', [0, 1], [1, 1, 1, 1, 1, 1]),
      new VectorKeyframeTrack('racine.position', [0, 1], [0, 0, 0, 0, 0, 1]),
      new VectorKeyframeTrack('pelvis.position', [0, 1], [0, 1, 0, 0, 0.9, 0]),
    ])];
    expect(gardePistesDEchelle(sceneDesOs('haut', 'racine', 'pelvis'), clips, 'racine', ['pelvis'])).toEqual([]);
  });

  it('ROUGE : la position d’un os que la liste des os à position animée ne nomme pas', () => {
    const clips = [clip('Marche', 'pelvis.position', [0, 1, 0], [0, 0.9, 0])];
    expect(gardePistesDEchelle(sceneDesOs('pelvis'), clips, 'racine', []).map((e) => [e.code, e.detail])).toEqual([['position-animee', 'pelvis.position animée ; valeur : son amplitude en m']]);
  });

  it('ROUGE : une échelle animée et une position d’os animée', () => {
    const clips = [clip('Frappe', 'haut.scale', [1, 1, 1], [1.2, 1.2, 1.2]), clip('Tend', 'haut.position', [0, 0.5, 0], [0, 0.6, 0])];
    const ecarts = gardePistesDEchelle(sceneDesOs('haut'), clips, 'racine', []);
    expect(ecarts.map((e) => [e.code, e.clip])).toEqual([['echelle-animee', 'Frappe'], ['position-animee', 'Tend']]);
    expect(ecarts[1].valeur).toBeCloseTo(0.1, 6);
  });
});

describe('échantillonnage et gardePiedsAuSol', () => {
  it('les instants sont la grille de 0 à la durée au pas donné et les clés de toutes les pistes, sans doublon', () => {
    const c = new AnimationClip('Pas', 1, [
      new VectorKeyframeTrack('racine.position', [0, 0.25, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0]),
      new VectorKeyframeTrack('haut.position', [0, Math.fround(0.3), Math.fround(0.7)], [0, 0.5, 0, 0, 0.5, 0, 0, 0.5, 0]),
    ]);
    expect(instants(c, 0.1).map((t) => +t.toFixed(6))).toEqual([0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });

  it('ROUGE : un clip qui ne plonge sous le sol qu’à une clé entre deux pas', () => {
    const { scene, mesh } = cylindre();
    const plongeon = new AnimationClip('Plongeon', 1, [
      new VectorKeyframeTrack('racine.position', [0, 0.2, 0.25, 0.3, 1], [0, 0, 0, 0, 0, 0, 0, -0.1, 0, 0, 0, 0, 0, 0, 0]),
    ]);
    const niveaux = [...echantillonner(scene, [mesh], [plongeon], 0.5)].map((e) => ({ clip: e.clip, t: e.t, plusBas: plusBas(e.positions, [mesh]) }));
    const ecarts = gardePiedsAuSol(niveaux);
    expect(ecarts.map((e) => [e.code, e.clip, e.t])).toEqual([['sous-le-sol', 'Plongeon', 0.25]]);
    expect(ecarts[0].valeur).toBeCloseTo(-0.1, 5);
  });

  it('deux meshes du même nom gardent chacun leurs positions', () => {
    const a = cylindre(), b = cylindre();
    b.scene.position.y = -1;
    a.scene.add(b.scene);
    const repos = poseDeRepos(a.scene, [a.mesh, b.mesh]);
    expect(repos.positions.size).toBe(2);
    expect(plusBas(repos.positions, [a.mesh, b.mesh])).toBeCloseTo(-1, 6);
  });

  it('VERT : un clip immobile garde le corps au sol ; ROUGE : un clip qui l’enfonce, la pose de repos rendue ensuite', () => {
    const { scene, mesh } = cylindre();
    const repos = poseDeRepos(scene, [mesh]).positions.get(mesh);
    const clips = [clip('Repos', 'racine.position', [0, 0, 0], [0, 0, 0]), clip('Plonge', 'racine.position', [0, 0, 0], [0, -0.1, 0])];
    const niveaux = [...echantillonner(scene, [mesh], clips, 0.5)].map((e) => ({ clip: e.clip, t: e.t, plusBas: plusBas(e.positions, [mesh]) }));
    expect(niveaux.map((n) => [n.clip, n.t])).toEqual([['Repos', 0], ['Repos', 0.5], ['Repos', 1], ['Plonge', 0], ['Plonge', 0.5], ['Plonge', 1]]);
    const ecarts = gardePiedsAuSol(niveaux);
    expect(ecarts.map((e) => [e.code, e.clip, e.t])).toEqual([['sous-le-sol', 'Plonge', 1]]);
    expect(ecarts[0].valeur).toBeCloseTo(-0.1, 5);
    expect(poseDeRepos(scene, [mesh]).positions.get(mesh)).toEqual(repos);
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
    const aretes = new Map([[mesh, aretesDe(mesh)]]);
    return gardeEtirement([...echantillonner(scene, [mesh], [c], 1)].map((e) => mesurerEtirement(aretes, repos, e)), libelle);
  };

  it('agrège par mesh : deux meshes au même libellé ont chacun leur écart, au repos comme en clip', () => {
    const a = cylindre(), b = cylindre();
    a.scene.add(b.scene);
    const meshes = [a.mesh, b.mesh];
    const aretes = new Map(meshes.map((m) => [m, aretesDe(m)]));
    const repos = poseDeRepos(a.scene, meshes);
    for (const c of [a, b]) c.haut.scale.setScalar(10);
    const gonfle = poseDeRepos(a.scene, meshes);
    const auRepos = gardeEtirementAuRepos(aretes, () => 'même', repos, gonfle);
    expect(auRepos.map((e) => [e.code, e.mesh])).toEqual([['arete-repos-enflee', 'même'], ['arete-repos-enflee', 'même']]);
    expect(auRepos[0].detail).toBe(gardeEtirementAuRepos(new Map([[a.mesh, aretes.get(a.mesh) as Uint32Array]]), () => 'même', repos, gonfle)[0].detail);
    const enClip = gardeEtirement([mesurerEtirement(aretes, repos, { clip: 'Gonfle', t: 0, ...gonfle })], () => 'même');
    expect(enClip.map((e) => [e.code, e.mesh])).toEqual([['arete-etiree', 'même'], ['arete-etiree', 'même']]);
  });

  it('VERT : un clip qui déplace le corps sans le déformer', () => {
    expect(mesurer(clip('Glisse', 'racine.position', [0, 0, 0], [0.3, 0, 0]))).toEqual([]);
  });

  it('ROUGE : un os qui étire, un os qui écrase', () => {
    expect(mesurer(clip('Gonfle', 'haut.scale', [1, 1, 1], [10, 10, 10])).map((e) => [e.code, e.seuil])).toEqual([['arete-etiree', ETIREMENT_EN_CLIP[1]]]);
    expect(mesurer(clip('Ecrase', 'haut.scale', [1, 1, 1], [0.001, 0.001, 0.001])).map((e) => [e.code, e.seuil])).toEqual([['arete-ecrasee', ETIREMENT_EN_CLIP[0]]]);
  });
});

describe('gardeEchelleDuRigide', () => {
  const tenu = (echelle: number) => {
    const { scene, haut, racine } = cylindre();
    haut.add(Object.assign(new Mesh(new CylinderGeometry(), new MeshBasicMaterial()), { name: 'Epee' }));
    racine.add(Object.assign(new Mesh(new CylinderGeometry(), new MeshBasicMaterial()), { name: 'Bouclier' }));
    haut.scale.setScalar(echelle);
    racine.scale.setScalar(echelle);
    return gardeEchelleDuRigide(rigidesTenus(scene, new Set(['haut'])), libelle);
  };

  it('VERT : le rigide sous la prise garde l’échelle 1', () => {
    expect(tenu(1)).toEqual([]);
  });

  it('ROUGE : le rigide sous la prise hérite d’une échelle ; un rigide hors prise n’est pas mesuré', () => {
    expect(tenu(1.5).map((e) => [e.code, e.mesh])).toEqual([['echelle-du-rigide', '«Epee»']]);
  });
});

describe('gardeTranchantDuRigide', () => {
  const tenue = (rotation: readonly [number, number, number], armes?: (lame: Mesh) => ReadonlySet<Mesh>) => {
    const { scene, haut, racine } = cylindre();
    const lame = Object.assign(new Mesh(new BoxGeometry(0.3, 1, 0.01), new MeshBasicMaterial()), { name: 'Lame' });
    haut.add(lame);
    haut.add(Object.assign(new Mesh(new CylinderGeometry(0.02, 0.02, 1), new MeshBasicMaterial()), { name: 'Manche' }));
    racine.add(Object.assign(new Mesh(new BoxGeometry(0.5, 0.5, 0.01), new MeshBasicMaterial()), { name: 'Bouclier' }));
    return gardeTranchantDuRigide(scene, { os: 'haut', position: [0.1, 0, 0], rotation }, libelle, armes?.(lame));
  };

  it('VERT : la lame s’étend sur le Z de la prise, le manche rond passe ; un rigide hors de la prise n’est pas mesuré', () => {
    expect(tenue([0, Math.PI / 2, 0])).toEqual([]);
  });

  it('ROUGE : la lame s’étend sur le X de la prise, l’axe de la paume', () => {
    expect(tenue([0, 0, 0]).map((e) => [e.code, e.mesh, e.seuil])).toEqual([['tranchant-vers-la-paume', '«Lame»', TOLERANCE_TRANCHANT_M]]);
    expect(tenue([0, 0, 0], (lame) => new Set([lame])).map((e) => e.mesh)).toEqual(['«Lame»']);
  });

  it('VERT : un rigide qui n’est pas une arme (un sac plat sous la prise) n’a pas de tranchant', () => {
    expect(tenue([0, 0, 0], () => new Set())).toEqual([]);
  });
});

describe('gabarit', () => {
  it('les binds compensent le déplacement des enfants, `sl` met la peau à l’échelle', () => {
    const hauteur = (facteurs: typeof FACTEURS_NEUTRES) => {
      const { scene, mesh } = cylindre();
      appliquerGabarit(scene, facteurs, gabaritEtAppuis(TABLE));
      return Math.max(...(poseDeRepos(scene, [mesh]).positions.get(mesh) ?? []).filter((_, i) => i % 3 === 1));
    };
    expect(hauteur(FACTEURS_NEUTRES)).toBeCloseTo(1, 5);
    expect(hauteur({ ...FACTEURS_NEUTRES, legs: 2 })).toBeCloseTo(1, 5);
    expect(hauteur({ ...FACTEURS_NEUTRES, sl: 2 })).toBeCloseTo(2, 5);
  });

  /** Sous une armature à l'échelle 2 et décalée de 0,1 m : racine, hanche à 0,5 m tournée vers le bas, sous elle le genou
   *  gauche à 0,25 m et son pied à 0,25 m sous lui, le pied droit à 0,45 m. */
  const jambes = () => {
    const armature = new Group();
    armature.scale.setScalar(2);
    armature.position.y = 0.1;
    const racine = Object.assign(new Bone(), { name: 'racine' });
    const hanche = Object.assign(new Bone(), { name: 'hanche' });
    hanche.position.y = 0.5;
    hanche.rotation.z = Math.PI;
    const genouG = Object.assign(new Bone(), { name: 'genouG' });
    genouG.position.y = 0.25;
    const piedG = Object.assign(new Bone(), { name: 'piedG' });
    piedG.position.y = 0.25;
    genouG.add(piedG);
    const piedD = Object.assign(new Bone(), { name: 'piedD' });
    piedD.position.y = 0.45;
    hanche.add(genouG, piedD);
    racine.add(hanche);
    armature.add(racine);
    return { scene: new Group().add(armature), racine };
  };
  const GABARIT_DES_JAMBES = gabaritEtAppuis({ ...TABLE, legs: ['hanche', 'genouG'] }, ['piedG', 'piedD']);

  it('R2 ramène le candidat le plus bas à sl fois sa hauteur sans gabarit', () => {
    const piedLePlusBas = (facteurs: typeof FACTEURS_NEUTRES) => {
      const { scene } = jambes();
      return hauteurDesCandidats(scene, appliquerGabarit(scene, facteurs, GABARIT_DES_JAMBES).candidats.courante);
    };
    const neutre = piedLePlusBas(FACTEURS_NEUTRES);
    expect(neutre).toBeCloseTo(0.1, 6);
    for (const legs of [0.7, 1.3]) expect(Math.abs(piedLePlusBas({ ...FACTEURS_NEUTRES, legs }) - neutre)).toBeLessThan(1e-6);
    expect(Math.abs(piedLePlusBas({ ...FACTEURS_NEUTRES, sl: 1.2, legs: 0.7 }) - 1.2 * neutre)).toBeLessThan(1e-6);
  });

  it('R2 compose les candidats avec la pose animée sans cumul, y compris sl', () => {
    const pli = Math.PI / 3;
    const marche = new AnimationClip('Marche', 1, [
      new VectorKeyframeTrack('racine.position', [0, 1], [0, 0, 0, 0.3, -0.05, 0]),
      new VectorKeyframeTrack('racine.scale', [0, 1], [1, 1, 1, 1.1, 1.1, 1.1]),
      new QuaternionKeyframeTrack('genouG.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, Math.sin(pli / 2), Math.cos(pli / 2)]),
    ]);
    const piedsParInstant = (scene: Group, gabarit: Parameters<typeof echantillonner>[4]) => {
      const pieds: [number, number][] = [];
      const reference = gabarit?.candidats ?? peauxDesCandidats(scene, GABARIT_DES_JAMBES.appuis.plusBas);
      for (const e of echantillonner(scene, [], [marche], 0.25, gabarit)) {
        if (gabarit) expect(gabarit.racine.scale.toArray()).toEqual([0, 1, 2].map(() => expect.closeTo((1 + 0.1 * e.t) * gabarit.echelle, 6)));
        pieds.push([e.t, hauteurDesCandidats(scene, reference.courante)]);
      }
      return pieds;
    };
    const sansGabarit = piedsParInstant(jambes().scene, null);
    expect(sansGabarit.map(([t]) => t)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(new Set(sansGabarit.map(([, y]) => y.toFixed(6))).size).toBeGreaterThan(2);
    for (const facteurs of [{ ...FACTEURS_NEUTRES, legs: 0.7 }, { ...FACTEURS_NEUTRES, sl: 0.7, legs: 0.7 }, { ...FACTEURS_NEUTRES, legs: 1.3 }]) {
      const { scene } = jambes();
      const avecGabarit = piedsParInstant(scene, appliquerGabarit(scene, facteurs, GABARIT_DES_JAMBES));
      expect(avecGabarit.map(([t]) => t)).toEqual(sansGabarit.map(([t]) => t));
      avecGabarit.forEach(([t, y], i) => expect(Math.abs(y - facteurs.sl * sansGabarit[i][1]), `t=${t}`).toBeLessThan(1e-6));
    }
  });

  it('après un clip de rotation seule, toute la pose de repos au gabarit est rendue à la fin et à l’abandon', () => {
    const pli = Math.PI / 3;
    const clip = new AnimationClip('Plie', 1, [
      new QuaternionKeyframeTrack('genouG.quaternion', [0, 1], [0, 0, 0, 1, Math.sin(pli / 2), 0, 0, Math.cos(pli / 2)]),
    ]);
    for (const sortie of ['consommation complète', 'abandon par return()']) {
      const { scene } = jambes();
      const gabarit = appliquerGabarit(scene, { ...FACTEURS_NEUTRES, sl: 0.7, legs: 1.3 }, GABARIT_DES_JAMBES);
      const repos = poseDeRepos(scene, []).os;
      const echantillons = echantillonner(scene, [], [clip], 0.25, gabarit);
      if (sortie === 'consommation complète') expect([...echantillons]).toHaveLength(5);
      else {
        echantillons.next();
        echantillons.next();
        echantillons.return(undefined);
      }
      const apres = poseDeRepos(scene, []).os;
      expect([...apres.keys()], sortie).toEqual([...repos.keys()]);
      const ecart = Math.max(...[...repos].flatMap(([nom, matrice]) => matrice.elements.map((valeur, i) =>
        Math.abs(valeur - (apres.get(nom)?.elements[i] ?? Infinity)))));
      expect.soft(ecart, sortie).toBeLessThan(1e-9);
    }
  });

  it('refuse de reposer un gabarit sans candidat avant de jouer ou de modifier la pose', () => {
    const { scene } = jambes();
    const gabarit = appliquerGabarit(scene, FACTEURS_NEUTRES, GABARIT_DES_JAMBES);
    const avant = poseDeRepos(scene, []).os;
    let joue = false;
    expect(() => reposerGabarit({ ...gabarit, candidats: { ...gabarit.candidats, courante: new SkinnedMesh(new BufferGeometry().setAttribute('position', new Float32BufferAttribute([], 3))) } }, () => { joue = true; }))
      .toThrow('reposerGabarit : candidats vides');
    expect(joue).toBe(false);
    expect(poseDeRepos(scene, []).os).toEqual(avant);
  });

  it('`st` pose une seule shape key de carrure, bornée à 1', () => {
    expect(poidsDeCarrure(0.9, TABLE.st)).toEqual({ [CARRURE_MOINS]: expect.closeTo(0.5, 9), [CARRURE_PLUS]: 0 });
    expect(poidsDeCarrure(1.5, TABLE.st)).toEqual({ [CARRURE_MOINS]: 0, [CARRURE_PLUS]: 1 });
    const { mesh } = cylindre();
    const forme = new Float32BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count * 3), 3);
    forme.name = CARRURE_PLUS;
    mesh.geometry.morphAttributes.position = [forme];
    mesh.updateMorphTargets();
    poserFormes(mesh, poidsDeCarrure(1.1, TABLE.st));
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(0.5, 9);
  });

  it('`poseDuGabarit` : chaque os porte son facteur et son échelle locale, la racine et la vitesse au sol portent `sl`, les pieds sont `appuis.pieds`, les jambes `legs`, les clips plantés les marches', () => {
    const table = { ...TABLE, legs: ['cuisse', 'bassin'], arms: ['bras'], head: ['cou'] };
    const clips = { clips: { marche: 'Marche', repos: 'Repos' }, clipsDeuxMains: { lourde2m: { marche: 'Marche_Lourde', repos: 'Repos_Lourd' }, hampe: { repos: 'Repos_Hampe' } } };
    expect(poseDuGabarit({ ...gabaritEtAppuis(table, ['piedG', 'piedD']), ...clips }, { sl: 0.74, st: 1.25, legs: 0.62, arms: 1.3, head: 0.9 })).toEqual({
      racine: { os: 'racine', echelle: 0.74 },
      enfantsDe: { cuisse: 0.62, bassin: 0.62, bras: 1.3, cou: 0.9 },
      echellesDesOs: { cuisse: [1, 0.62, 1], bassin: [1, 0.62, 1], bras: [1, 1.3, 1], cou: [0.9, 0.9, 0.9] },
      pieds: ['piedG', 'piedD'],
      jambes: ['cuisse', 'bassin'],
      clipsPlantes: ['Marche', 'Marche_Lourde'],
      echelleDeVitesse: 0.74,
    });
    expect(poseDuGabarit({ gabarit: table }, FACTEURS_NEUTRES).clipsPlantes).toEqual([]);
  });

  /** Racine au sol, bassin à 1 m, et par côté une cuisse de 0,45 m, un mollet de 0,45 m et un pied de 0,08 m vers
   *  l'avant ; `Marche` balance les cuisses, plie les genoux et fait monter et descendre le bassin. */
  const deuxJambes = () => {
    const os = (name: string, parent: Bone | Group, x: number, y: number, z = 0) => {
      const b = Object.assign(new Bone(), { name });
      b.position.set(x, y, z);
      parent.add(b);
      return b;
    };
    const scene = new Group();
    const racine = os('racine', scene, 0, 0);
    const bassin = os('bassin', racine, 0, 1);
    for (const [cote, x] of [['G', 0.1], ['D', -0.1]] as const) {
      const cuisse = os(`cuisse${cote}`, bassin, x, 0);
      cuisse.rotation.z = Math.PI;
      const mollet = os(`mollet${cote}`, cuisse, 0, 0.45);
      const pied = os(`pied${cote}`, mollet, 0, 0.45);
      pied.rotation.x = Math.PI / 2;
      os(`orteil${cote}`, pied, 0, 0.08);
    }
    scene.updateMatrixWorld(true);
    return { scene, racine };
  };
  const quaternion = (axe: Vector3, angle: number) => new Quaternion().setFromAxisAngle(axe, angle).toArray();
  const X = new Vector3(1, 0, 0);
  /** La cuisse tournée vers le bas (son repos), puis balancée de `angle` autour de x. */
  const cuisse = (angle: number) => new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI).multiply(new Quaternion().setFromAxisAngle(X, angle)).toArray();
  const MARCHE = new AnimationClip('Marche', 1, [
    new VectorKeyframeTrack('bassin.position', [0, 0.5, 1], [0, 0.97, 0, 0, 1, 0, 0, 0.97, 0]),
    new QuaternionKeyframeTrack('cuisseG.quaternion', [0, 0.5, 1], [...cuisse(0.35), ...cuisse(-0.3), ...cuisse(0.35)]),
    new QuaternionKeyframeTrack('molletG.quaternion', [0, 0.5, 1], [...quaternion(X, -0.1), ...quaternion(X, -0.6), ...quaternion(X, -0.1)]),
    new QuaternionKeyframeTrack('cuisseD.quaternion', [0, 0.5, 1], [...cuisse(-0.3), ...cuisse(0.35), ...cuisse(-0.3)]),
    new QuaternionKeyframeTrack('molletD.quaternion', [0, 0.5, 1], [...quaternion(X, -0.6), ...quaternion(X, -0.1), ...quaternion(X, -0.6)]),
  ]);
  const GABARIT_DES_DEUX_JAMBES = {
    ...gabaritEtAppuis({ ...TABLE, legs: ['cuisseG', 'molletG', 'cuisseD', 'molletD'], bornes: { ...TABLE.bornes, legs: { min: 0.6, max: 1.2 } } }, ['piedG', 'piedD']),
    clips: { marche: 'Marche' },
  };
  /** Par instant de `MARCHE` (pas 0,125 s), les matrices monde des os de `deuxJambes` jouée sans gabarit, puis posée
   *  par `poserLeGabarit` sous `facteurs`, jambes pliées si `plante`. */
  const posesDuGabarit = (facteurs: typeof FACTEURS_NEUTRES, plante: boolean) => {
    const { scene, racine } = deuxJambes();
    const pose = poseDuGabarit(GABARIT_DES_DEUX_JAMBES, facteurs);
    const trouver = (nom: string) => scene.getObjectByName(nom) as Bone;
    const [enfants, jambes] = [enfantsDuGabarit(pose, trouver), jambesDuGabarit(pose, trouver)];
    const mixer = new AnimationMixer(scene);
    mixer.clipAction(MARCHE).play();
    return instants(MARCHE, 0.125).map((t) => {
      racine.scale.setScalar(1);
      racine.position.set(0, 0, 0);
      for (const [enfant] of enfants) enfant.position.y = 0.45;
      mixer.setTime(t);
      scene.updateMatrixWorld(true);
      const neutre = new Map<string, Matrix4>();
      scene.traverse((n) => { if ((n as Bone).isBone) neutre.set(n.name, n.matrixWorld.clone()); });
      poserLeGabarit(racine, pose.racine.echelle, enfants, plante ? jambes : [], new Vector3(0, 1, 0));
      const posee = new Map<string, Matrix4>();
      scene.traverse((n) => { if ((n as Bone).isBone) posee.set(n.name, n.matrixWorld.clone()); });
      return { neutre, posee };
    });
  };
  const ecartDeMatrices = (a: Matrix4, b: Matrix4) => Math.max(...a.elements.map((v, i) => Math.abs(v - b.elements[i])));
  const echelle = (sl: number, m: Matrix4) => new Matrix4().makeScale(sl, sl, sl).multiply(m);
  const extension = (os: ReadonlyMap<string, Matrix4>, cote: string) => {
    const [h, k, a] = [`cuisse${cote}`, `mollet${cote}`, `pied${cote}`].map((nom) => new Vector3().setFromMatrixPosition(os.get(nom)!));
    return a.distanceTo(h) / (k.distanceTo(h) + a.distanceTo(k));
  };

  it('`poserLeGabarit` plié : chaque pied et ses descendants gardent la matrice monde du clip sans gabarit multipliée par `sl`', () => {
    for (const facteurs of [{ ...FACTEURS_NEUTRES, legs: 0.6 }, { ...FACTEURS_NEUTRES, legs: 1.2 }, { ...FACTEURS_NEUTRES, sl: 0.8, legs: 0.6 }]) {
      posesDuGabarit(facteurs, true).forEach(({ neutre, posee }, t) => {
        for (const pied of ['piedG', 'piedD', 'orteilG', 'orteilD']) {
          expect(ecartDeMatrices(posee.get(pied)!, echelle(facteurs.sl, neutre.get(pied)!)), `${pied} legs=${facteurs.legs} sl=${facteurs.sl} t=${t}`).toBeLessThan(1e-6);
        }
      });
    }
  });

  it('`poserLeGabarit` plié : une jambe garde l’extension du clip sans gabarit, l’autre ne la dépasse pas', () => {
    for (const legs of [0.6, 1.2]) {
      posesDuGabarit({ ...FACTEURS_NEUTRES, legs }, true).forEach(({ neutre, posee }, t) => {
        const ecarts = ['G', 'D'].map((cote) => extension(posee, cote) - extension(neutre, cote));
        expect(Math.max(...ecarts), `legs=${legs} t=${t}`).toBeCloseTo(0, 6);
      });
    }
  });

  it('`poserLeGabarit` : aux jambes neutres le plié rend la pose du clip ; sans jambes, il ne plie rien', () => {
    posesDuGabarit({ ...FACTEURS_NEUTRES, sl: 0.8 }, true).forEach(({ neutre, posee }, t) => {
      for (const [nom, matrice] of posee) expect(ecartDeMatrices(matrice, echelle(0.8, neutre.get(nom)!)), `${nom} t=${t}`).toBeLessThan(1e-6);
    });
    posesDuGabarit({ ...FACTEURS_NEUTRES, legs: 0.6 }, false).forEach(({ neutre, posee }, t) => {
      for (const cote of ['G', 'D']) expect(extension(posee, cote), `t=${t}`).toBeCloseTo(extension(neutre, cote), 9);
      expect(ecartDeMatrices(posee.get('racine')!, neutre.get('racine')!), `t=${t}`).toBe(0);
    });
  });

  it('`echantillonner` plie les jambes sur les seuls clips plantés', () => {
    const ecartsAuSol = (clip: AnimationClip) => {
      const neutre = [...echantillonner(deuxJambes().scene, [], [clip], 0.25, null)].map((e) => e.os);
      const gabarit = appliquerGabarit(deuxJambes().scene, { ...FACTEURS_NEUTRES, legs: 0.6 }, GABARIT_DES_DEUX_JAMBES);
      return [...echantillonner(gabarit.scene, [], [clip], 0.25, gabarit)].map((e, t) => Math.max(...['piedG', 'piedD'].map((pied) => {
        const [a, b] = [e.os, neutre[t]].map((os) => new Vector3().setFromMatrixPosition(os.get(pied)!));
        return Math.hypot(a.x - b.x, a.z - b.z);
      })));
    };
    for (const ecart of ecartsAuSol(MARCHE)) expect(ecart).toBeLessThan(1e-6);
    expect(Math.max(...ecartsAuSol(new AnimationClip('Libre', 1, MARCHE.tracks)))).toBeGreaterThan(0.01);
  });

  it('`poidsDuGabarit` : noms uniques, neutre nul, demi-domaines asymétriques, extrapolation et produits des silhouettes', () => {
    const bornes = { legs: { min: 0.4, max: 1.8 }, arms: { min: 0.6, max: 1.6 }, head: { min: 0.5, max: 1.9 } };
    const silhouettes = poidsDeSilhouettes({ sex: 'F', build: 0.75, st: 0.9 }, TABLE);
    const neutre = poidsDuGabarit(FACTEURS_NEUTRES, bornes, silhouettes);
    const noms = ['legs', 'arms', 'head'].flatMap((cle) => ['moins', 'plus'].flatMap((sens) =>
      [`gabarit_${cle}_${sens}`, ...Object.keys(silhouettes).map((s) => `gabarit_${cle}_${sens}_${s}`)]));
    expect(Object.keys(neutre)).toEqual(noms);
    expect(Object.values(neutre)).toEqual(noms.map(() => 0));
    expect(nomDeCleDuGabarit('head', 'plus', 'carrure_moins')).toBe('gabarit_head_plus_carrure_moins');
    for (const [facteurs, valeurs] of [
      [{ ...FACTEURS_NEUTRES, legs: 0.7, arms: 1.3, head: 1.45 }, [0.5, 0, 0, 0.5, 0, 0.5]],
      [{ ...FACTEURS_NEUTRES, legs: 1.8, arms: 0.6, head: 0.5 }, [0, 1, 1, 0, 1, 0]],
      [{ ...FACTEURS_NEUTRES, legs: 2.6, arms: 0.2, head: 2.8 }, [0, 2, 2, 0, 0, 2]],
    ] as const) {
      const poids = poidsDuGabarit(facteurs, bornes, silhouettes);
      let i = 0;
      for (const cle of ['legs', 'arms', 'head'] as const) for (const sens of ['moins', 'plus'] as const) {
        const attendu = valeurs[i++];
        expect(poids[nomDeCleDuGabarit(cle, sens)]).toBeCloseTo(attendu, 12);
        for (const [s, w] of Object.entries(silhouettes)) expect(poids[nomDeCleDuGabarit(cle, sens, s)]).toBeCloseTo(w * attendu, 12);
      }
      expect(Object.values(poids).every((p) => p >= 0)).toBe(true);
    }
    expect(() => poidsDuGabarit(FACTEURS_NEUTRES, { ...bornes, head: { min: 1.1, max: 2 } }, silhouettes)).toThrow('gabarit.head');
  });

  it('`poserEnfantsDuGabarit` multiplie le Y local seul', () => {
    const enfant = new Bone();
    enfant.position.set(2, 3, 4);
    enfant.rotation.set(0.2, 0.3, 0.4);
    enfant.scale.set(1.1, 1.2, 1.3);
    const rotation = enfant.quaternion.clone();
    const echelle = enfant.scale.clone();
    poserEnfantsDuGabarit([[enfant, 0.62]]);
    expect(enfant.position.toArray()).toEqual([2, 3 * 0.62, 4]);
    expect(enfant.quaternion.toArray()).toEqual(rotation.toArray());
    expect(enfant.scale).toEqual(echelle);
  });

  it.each([false, true])('`bindsAuGabarit` : peau conservée hors sl/R2, binds non repos=%s, scène et binds originaux rendus', (bindNonRepos) => {
    const { scene, mesh, racine, haut } = cylindre();
    const bout = Object.assign(new Bone(), { name: 'bout' });
    haut.add(bout);
    bout.position.set(0.08, 0.3, -0.1);
    haut.rotation.set(0.3, -0.2, 0.4);
    racine.rotation.set(0.1, 0.5, -0.2);
    scene.position.set(3, 0.4, -2);
    scene.rotation.set(0.2, 0.7, -0.1);
    const autre = Object.assign(new Bone(), { name: 'autre' });
    racine.add(autre);
    autre.position.set(-0.2, 0.4, 0.1);
    scene.updateMatrixWorld(true);
    const squelette = new Skeleton([racine, haut, bout, autre]);
    if (bindNonRepos) squelette.boneInverses.forEach((m, i) => m.premultiply(new Matrix4().makeRotationX(0.07 * (i + 1))));
    mesh.bind(squelette, mesh.matrixWorld);
    const indices = mesh.geometry.attributes.skinIndex;
    for (let i = 0; i < indices.count; i++) if (i % 3 === 0) { indices.setX(i, 2); indices.setY(i, 3); }
    const references = Array.from({ length: indices.count }, (_, i) => mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld));
    const inverseOriginal = squelette.boneInverses.map((m) => m.clone());
    const etat = squelette.bones.map((b) => ({ position: b.position.clone(), locale: b.matrix.clone(), monde: b.matrixWorld.clone() }));
    const pose = poseDuGabarit(gabaritEtAppuis({ ...TABLE, legs: ['haut'], arms: ['racine'] }), { ...FACTEURS_NEUTRES, sl: 0.8, legs: 0.62, arms: 1.6 });
    const binds = bindsAuGabarit(squelette, pose);
    expect(binds).toHaveLength(squelette.bones.length);
    squelette.bones.forEach((b, i) => {
      expect(b.position).toEqual(etat[i].position);
      expect(b.matrix).toEqual(etat[i].locale);
      expect(b.matrixWorld).toEqual(etat[i].monde);
      expect(squelette.boneInverses[i]).toEqual(inverseOriginal[i]);
    });
    binds[0].elements.forEach((n, i) => expect(n).toBeCloseTo(inverseOriginal[0].elements[i], 12));
    haut.position.y *= 1.6;
    autre.position.y *= 1.6;
    bout.position.y *= 0.62;
    scene.updateMatrixWorld(true);
    const mondeSansSl = racine.matrixWorld.clone();
    squelette.boneInverses = binds;
    racine.scale.multiplyScalar(0.8);
    racine.position.y += 0.05;
    scene.updateMatrixWorld(true);
    const similitude = racine.matrixWorld.clone().multiply(mondeSansSl.invert());
    const ecart = Math.max(...references.map((v, i) => mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(v.clone().applyMatrix4(similitude))));
    expect(ecart).toBeLessThan(1e-6);
  });

  it('compense les binds d’un skin partiel dont le parent déformé est présent dans la hiérarchie', () => {
    const { scene, mesh, racine, haut } = cylindre();
    const element = mesh.clone();
    element.name = 'ElementPartiel';
    element.geometry = mesh.geometry.clone();
    const indices = element.geometry.attributes.skinIndex;
    const poids = element.geometry.attributes.skinWeight;
    for (let i = 0; i < indices.count; i++) { indices.setXYZW(i, 0, 0, 0, 0); poids.setXYZW(i, 1, 0, 0, 0); }
    scene.add(element);
    element.bind(new Skeleton([haut], [mesh.skeleton.boneInverses[1].clone()]), mesh.bindMatrix);
    const pose = poseDuGabarit(gabaritEtAppuis(TABLE), { ...FACTEURS_NEUTRES, legs: 1.4 });
    const binds = bindsAuGabarit(element.skeleton, pose);
    expect(binds[0].elements[13]).toBeCloseTo(-0.7, 9);
    expect(element.skeleton.bones).toEqual([haut]);
    expect(haut.parent).toBe(racine);
    const avant = poseDeRepos(scene, [element]).positions.get(element);
    appliquerGabarit(scene, { ...FACTEURS_NEUTRES, legs: 1.4 }, gabaritEtAppuis(TABLE));
    expect(element.skeleton.boneInverses).toEqual(binds);
    const apres = poseDeRepos(scene, [element]).positions.get(element);
    expect(apres).toBeDefined();
    apres?.forEach((v, i) => expect(v).toBeCloseTo(avant?.[i] ?? Infinity, 6));
  });

  it('`poidsDeSilhouettes` : la carrure de `st`, `feminin` du sexe, `corpulence` nulle jusqu’au build neutre puis linéaire jusqu’à 1', () => {
    expect(poidsDeSilhouettes({ sex: 'F', build: 0.75, st: 0.9 }, TABLE)).toEqual({
      [CARRURE_MOINS]: expect.closeTo(0.5, 9), [CARRURE_PLUS]: 0, [FEMININ]: 1, [CORPULENCE]: expect.closeTo(0.5, 9),
    });
    expect(poidsDeSilhouettes({ sex: 'M', build: 0.2, st: 1 }, TABLE)).toEqual({ [CARRURE_MOINS]: 0, [CARRURE_PLUS]: 0, [FEMININ]: 0, [CORPULENCE]: 0 });
    expect(poidsDeSilhouettes({ sex: 'M', build: 1, st: 1 }, TABLE)[CORPULENCE]).toBe(1);
  });
});

/** Les déplacements d'une shape key de l'anneau : `f` appliquée à chaque sommet du cercle, `sol` à chaque sommet du triangle. */
const formeDeLAnneau = (f: (x: number, y: number, z: number) => readonly number[], sol: readonly number[] = [0, 0, 0]) =>
  Array.from({ length: ANNEAU.length / 3 }, (_, i) => (i < 6 ? f(ANNEAU[i * 3], ANNEAU[i * 3 + 1], ANNEAU[i * 3 + 2]) : sol)).flat();
/** L'homothétie de rapport `k` du cercle autour de l'axe Y : sa carrure exacte. */
const homothetie = (k: number) => formeDeLAnneau((x, _y, z) => [(k - 1) * x, 0, (k - 1) * z]);

const JUSTES = { feminin: homothetie(1.1), [CARRURE_MOINS]: homothetie(TABLE.st.min), [CARRURE_PLUS]: homothetie(TABLE.st.max) };

describe('candidats du corps entier', () => {
  it('refuse de poser le gabarit sans candidat d’appui', () => {
    expect(() => appliquerGabarit(cylindre().scene, FACTEURS_NEUTRES, { gabarit: TABLE })).toThrow('appuis.plusBas non vide attendu');
  });

  it('reconstitue à zéro les deltas omis dans la peau des candidats', () => {
    const { scene, mesh } = cylindre();
    const count = mesh.geometry.attributes.position.count;
    mesh.geometry.morphTargetsRelative = true;
    mesh.geometry.morphAttributes.position = [
      Object.assign(new Float32BufferAttribute(new Float32Array(count * 3), 3), { name: 'nulle' }),
      Object.assign(new Float32BufferAttribute(Array.from({ length: count }, (_, i) => [i === 0 ? 0.1 : 0, 0, 0]).flat(), 3), { name: FEMININ }),
    ];
    mesh.updateMorphTargets();
    mesh.morphTargetInfluences?.splice(0, 2, 1, 1);
    const copies: CandidatDAppui[] = [
      { position: [0, 1, 0.1] as const, os: [{ nom: 'haut', poids: 1 }], deltas: { [FEMININ]: [0.1, 0, 0] as const } },
      { position: [0.1 * Math.sin(Math.PI / 3), 1, 0.1 * Math.cos(Math.PI / 3)] as const, os: [{ nom: 'haut', poids: 1 }], deltas: {} },
    ];
    const peaux = peauxDesCandidats(scene, copies, mesh.skeleton);
    peaux.synchroniser();
    for (const i of [0, 1]) expect(peaux.courante.getVertexPosition(i, new Vector3()).distanceTo(mesh.getVertexPosition(i, new Vector3()))).toBeLessThan(1e-6);
  });

  it('R2 ramène le candidat non-pied le plus bas au niveau sans gabarit', async () => {
    const cle = nomDeCleDuGabarit('arms', 'plus');
    const formes = formesAvecGabarit({ feminin: new Array<number>(9).fill(0) }, { [cle]: [0, 0, 0, 0, 0, 0, 0, -3, 0] });
    const base = glbFabrique({ bande: formes, clips: { Descend: [0, -0.2] } });
    const m = { ...manifesteDe(base, ['racine', 'pelvis']), silhouettes: ['feminin'] };
    const grille = grilleDesAppuis(m);
    for (const cle of ['legs', 'arms', 'head'] as const) expect(new Set(grille.map((e) => e.facteurs[cle]))).toEqual(new Set([m.gabarit.bornes[cle].min, 1, m.gabarit.bornes[cle].max]));
    const b = await chargerScene(base);
    const candidats: CandidatDAppui[] = [
      { position: [0, 0, 0] as const, os: [{ nom: 'racine', poids: 1 }], deltas: {} },
      { position: [1, 0, 0] as const, os: [{ nom: 'racine', poids: 1 }], deltas: {} },
      { position: [0, 1, 0] as const, os: [{ nom: 'pelvis', poids: 1 }], deltas: { [cle]: [0, -3, 0] as const } },
    ];
    const facteurs = { ...FACTEURS_NEUTRES, arms: TABLE.bornes.arms.max, sl: 0.7 };
    poserFormes(b.scene, { feminin: 0, ...poidsDuGabarit(facteurs, TABLE.bornes, { feminin: 0 }) });
    const g = appliquerGabarit(b.scene, facteurs, { ...m, appuis: { ...m.appuis, plusBas: candidats } });
    const sans = await chargerScene(base);
    const reference = [...echantillonner(sans.scene, sans.meshes, sans.clips, 0.5)];
    const poses = [...echantillonner(b.scene, b.meshes, b.clips, 0.5, g)];
    const corpsDe = (s: typeof b) => s.meshes.filter((m) => m.name === 'Corps');
    poses.forEach((p, i) => expect(Math.abs(plusBas(p.positions, corpsDe(b)) - facteurs.sl * plusBas(reference[i].positions, corpsDe(sans)))).toBeLessThan(1e-6));
    const complet = await evaluer({ base, manifeste: { ...m, appuis: { ...m.appuis, plusBas: candidats } }, facteurs, pas: 0.5 });
    expect(complet.ecarts.filter((e) => e.garde === 'piedsAuSol')).toEqual([]);
    const incomplet = await evaluer({ base, manifeste: m, facteurs, pas: 0.5 });
    expect(incomplet.ecarts.some((e) => e.garde === 'piedsAuSol' && e.code === 'sous-le-sol')).toBe(true);
  });

  it('les binds propres à un élément monté ne changent pas les candidats de la base', () => {
    const { scene, mesh } = cylindre();
    const candidats: CandidatDAppui[] = [{ position: [0, 1, 0.1] as const, os: [{ nom: 'haut', poids: 1 }], deltas: {} }];
    const avant = hauteurDesCandidats(scene, peauxDesCandidats(scene, candidats, mesh.skeleton).courante);
    const element = new SkinnedMesh(mesh.geometry.clone());
    const inverses = mesh.skeleton.boneInverses.map((m) => m.clone().multiply(new Matrix4().makeTranslation(0, -3, 0)));
    element.bind(new Skeleton(mesh.skeleton.bones, inverses), new Matrix4());
    scene.add(element);
    expect(() => peauxDesCandidats(scene, candidats)).toThrow(/binds ambigus/);
    expect(hauteurDesCandidats(scene, peauxDesCandidats(scene, candidats, mesh.skeleton).courante)).toBe(avant);
  });
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
    expect([...charge.origines].map(([m, o]) => [m, o.objet, o.noeud, o.primitive])).toEqual([[charge.meshes[0], charge.meshes[0], 'Corps', 0]]);
  });

  it('lit les zones et les shape keys', () => {
    const contenu = lireGlb(glbFabrique({ jeuEtendu: true }));
    expect(contenu.zones).toEqual(new Map([['torse', ['Corps']]]));
    expect(contenu.formes).toEqual(new Set(['feminin']));
  });
});

describe('libellesDesMeshes (#3229)', () => {
  it('un nœud glTF à deux primitives, instancié par deux nœuds : quatre meshes, quatre libellés', async () => {
    const scene = await chargerScene(glbFabrique({ primitives: 2, instances: ['Bis'] }));
    expect(new Set(scene.meshes.map((m) => m.name)).size).toBe(2);
    expect(scene.meshes.map(libellesDesMeshes([scene]))).toEqual(['base/Corps#0', 'base/Corps#1', 'base/Bis#0', 'base/Bis#1']);
  });

  it('des noms glTF distincts que three.js confond gardent leur nom glTF', async () => {
    const scene = await chargerScene(glbFabrique({ nom: 'a b', instances: ['a_b', 'a_b_1'] }));
    expect(scene.meshes.map((m) => m.name)).toEqual(['a_b', 'a_b_1', 'a_b_1']);
    expect(scene.meshes.map(libellesDesMeshes([scene]))).toEqual(['base/a b#0', 'base/a_b#0', 'base/a_b_1#0']);
  });

  it('le même GLB en base et en élément : chaque mesh sous son fichier ; un mesh hors des scènes est refusé', async () => {
    const octets = glbFabrique();
    const [base, element] = [await chargerScene(octets), await chargerScene(octets)];
    const libelle = libellesDesMeshes([base, element]);
    expect([...base.meshes, ...element.meshes].map(libelle)).toEqual(['base/Corps#0', 'élément 1/Corps#0']);
    expect(() => libelle(cylindre().mesh)).toThrow('hors des scènes évaluées');
  });

  it('evaluer compte chaque mesh d’un nœud instancié à plusieurs primitives, sous son libellé', async () => {
    const fiche = await evaluer({ base: glbFabrique({ primitives: 2, instances: ['Bis'], clips: { Repos: [0, 0] } }), pas: 0.5, plafond: 1 });
    const libelles = ['base/Corps#0', 'base/Corps#1', 'base/Bis#0', 'base/Bis#1'];
    expect(fiche.mesures.triangles.parMesh).toEqual(libelles.map((mesh) => ({ mesh, triangles: 1 })));
    expect(fiche.mesures.corps).toEqual(libelles);
    expect(fiche.ecarts.find((e) => e.garde === 'budget')?.detail).toBe(`4 triangles (${libelles.map((l) => `${l} 1`).join(', ')})`);
  });

  it('le plafond assemblé ne compte que la base visible : la zone que couvre un élément sort du compte (#3743)', async () => {
    const octets = glbFabrique({ clips: { Repos: [0, 0] } });
    const budget = async (couches: Parameters<typeof evaluer>[0]['couches']) =>
      (await evaluer({ base: octets, elements: [octets], couches, pas: 0.5, plafond: 1 })).ecarts.filter((e) => e.garde === 'budget').map((e) => e.valeur);
    expect(await budget([null])).toEqual([2]);
    expect(await budget([{ couche: 'tenue', couvre: ['torse'] }])).toEqual([]);
  });
});

describe('les os sous leur nom glTF (#3233)', () => {
  const OS = ['a:b', 'handslot.l'];
  const octets = glbFabrique({ pelvis: true, os: OS, clips: { Leve: [0, 1] } });

  it('un os chargé porte son nom glTF, que réécrit GLTFLoader ; le clip le mène encore', async () => {
    expect([...lireGlb(octets).os]).toEqual(OS);
    const scene = await chargerScene(octets);
    expect(scene.squelette?.bones.map((b) => b.name)).toEqual(OS);
    const [debut, fin] = [...echantillonner(scene.scene, scene.meshes, scene.clips, 1)];
    expect([...fin.os.keys()]).toEqual(OS);
    expect((fin.os.get('handslot.l')?.elements[13] ?? 0) - (debut.os.get('handslot.l')?.elements[13] ?? 0)).toBeCloseTo(1, 6);
    expect(() => appliquerGabarit(scene.scene, FACTEURS_NEUTRES, gabaritEtAppuis({ ...TABLE, legs: ['a:b'], racine: 'a:b' }, ['a:b']))).not.toThrow();
  });

  it('les gardes nomment l’os par son nom glTF', async () => {
    const fiche = await evaluer({ base: octets, pas: 1 });
    expect(fiche.ecarts.filter((e) => e.garde === 'poids' || e.garde === 'pistesDEchelle').map((e) => [e.code, e.detail]))
      .toEqual([['position-animee', 'handslot.l.position animée ; valeur : son amplitude en m']]);
  });
});

describe('validerManifesteDeBase', () => {
  const octets = glbFabrique({ clips: { Repos: [0, 0] } });
  const attache = ATTACHE;
  const valide = () => manifesteDe(octets);
  it.each([
    ['absent', undefined, [['forme', 'appuis.plusBas']]],
    ['vide', [], [['forme', 'appuis.plusBas']]],
    ['position', [{ position: [0, Infinity, 0], os: [{ nom: 'racine', poids: 1 }], deltas: {} }], [['forme', 'appuis.plusBas.0.position']]],
    ['os', [{ position: [0, 0, 0], os: [{ nom: 'fantome', poids: 1 }], deltas: {} }], [['os-inconnu', 'appuis.plusBas.0.os.0.nom']]],
    ['poids', [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: 0.5 }], deltas: {} }], [['forme', 'appuis.plusBas.0.os']]],
    ['delta', [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: 1 }], deltas: { feminin: [0, NaN, 0] } }], [['forme', 'appuis.plusBas.0.deltas.feminin']]],
    ['clé', [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: 1 }], deltas: { inconnue: [0, 0, 0] } }], [['forme', 'appuis.plusBas.0.deltas.inconnue']]],
    ['champ', [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: 1 }], deltas: {}, indice: 1 }], [['forme', 'appuis.plusBas.0.indice']]],
    ['os non liste', [{ position: [0, 0, 0], os: {}, deltas: {} }], [['forme', 'appuis.plusBas.0.os'], ['forme', 'appuis.plusBas.0.os']]],
    ['os vide', [{ position: [0, 0, 0], os: [], deltas: {} }], [['forme', 'appuis.plusBas.0.os'], ['forme', 'appuis.plusBas.0.os']]],
    ['plus de quatre influences', [{ position: [0, 0, 0], os: Array.from({ length: 5 }, (_, i) => ({ nom: `os${i}`, poids: 0.2 })), deltas: {} }], [['forme', 'appuis.plusBas.0.os']]],
    ['champ inconnu influence', [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: 1, inconnu: true }], deltas: {} }], [['forme', 'appuis.plusBas.0.os.0.inconnu']]],
    ['nom vide', [{ position: [0, 0, 0], os: [{ nom: '', poids: 1 }], deltas: {} }], [['forme', 'appuis.plusBas.0.os.0.nom']]],
    ['nom non chaîne', [{ position: [0, 0, 0], os: [{ nom: 3, poids: 1 }], deltas: {} }], [['forme', 'appuis.plusBas.0.os.0.nom']]],
    ['poids nul', [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: 0 }], deltas: {} }], [['forme', 'appuis.plusBas.0.os.0.poids'], ['forme', 'appuis.plusBas.0.os']]],
    ['poids négatif', [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: -1 }], deltas: {} }], [['forme', 'appuis.plusBas.0.os.0.poids'], ['forme', 'appuis.plusBas.0.os']]],
    ['os en double', [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: 0.5 }, { nom: 'racine', poids: 0.5 }], deltas: {} }], [['forme', 'appuis.plusBas.0.os']]],
    ['deltas non objet', [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: 1 }], deltas: [] }], [['forme', 'appuis.plusBas.0.deltas']]],
    ['candidat non objet', [null], [['forme', 'appuis.plusBas.0'], ['forme', 'appuis.plusBas.0.os'], ['forme', 'appuis.plusBas.0.os'], ['forme', 'appuis.plusBas.0.deltas'], ['forme', 'appuis.plusBas.0.position']]],
  ])('refuse appuis.plusBas %s par son code et son chemin exacts', (_nom, plusBas, attendus) => {
    const m = valide(), v = validerManifesteDeBase({ ...m, appuis: { ...m.appuis, plusBas } }, octets);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.ecarts.map(({ code, ou }) => [code, ou])).toEqual(attendus);
  });
  it('refuse une base de version 3 par version-inconnue au champ schema', () => {
    const v = validerManifesteDeBase({ ...valide(), schema: 3 }, octets);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.ecarts.map(({ code, ou }) => [code, ou])).toEqual([['version-inconnue', 'schema']]);
  });
  it('refuse le delta d’une forme présente dans le GLB hors silhouettes et gabarit', () => {
    const base = glbFabrique({ bande: { feminin: new Array<number>(9).fill(0), expression: new Array<number>(9).fill(0) }, clips: { Repos: [0, 0] } });
    const m = manifesteDe(base, ['racine', 'pelvis']);
    const v = validerManifesteDeBase({ ...m, appuis: { ...m.appuis, plusBas: [{ position: [0, 0, 0], os: [{ nom: 'racine', poids: 1 }], deltas: { expression: [0, 0, 0] } }] } }, base);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.ecarts.map(({ code, ou }) => [code, ou])).toEqual([['forme', 'appuis.plusBas.0.deltas.expression']]);
  });
  const codes = (brut: unknown): CodeDEcartDeBase[] => {
    const verdict = validerManifesteDeBase(brut, octets);
    return verdict.ok ? [] : verdict.ecarts.map((e) => e.code);
  };

  it('accepte un corps sans prises ni table de gabarit, au porteur sans gabarit, que l’évaluateur juge sans facteurs (#2991)', async () => {
    const { prises: _prises, gabarit: _gabarit, ...corps } = valide();
    const m = { ...corps, silhouettes: [], porteur: { espece: 'loup', taille: 'moyenne', echelleDArt: 0.82 } };
    expect(validerManifesteDeBase(m, octets)).toEqual({ ok: true, manifeste: m });
    expect((await evaluer({ base: octets, manifeste: m, pas: 1 })).ecarts.filter((e) => e.garde === 'manifeste')).toEqual([]);
    await expect(evaluer({ base: octets, manifeste: m, facteurs: { legs: 1.2 } })).rejects.toThrow('des facteurs de gabarit sans table de gabarit');
  });

  it('accepte des surfaces qui nomment un matériau du GLB et son emplacement de palette ; sans `surfaces`, aucune', () => {
    const m = { ...valide(), surfaces: [{ nom: 'peau', palette: 'peau' }] };
    expect(validerManifesteDeBase(m, octets)).toEqual({ ok: true, manifeste: m });
    expect(validerManifesteDeBase(valide(), octets)).toEqual({ ok: true, manifeste: valide() });
  });

  describe('parSexe (#3188) : le matériau d’un sexe est, sur chaque primitive de la surface, sa variante `KHR_materials_variants` du nom du sexe', () => {
    /** Le GLB de `glbFabrique` à deux primitives `peau`, plus le matériau `peau_f`, variante `variante` des primitives
     *  de rang `portees`. */
    const avecVariante = (portees: readonly number[], variante = 'F') => {
      const { json: lu, bin } = lireConteneur(glbFabrique({ clips: { Repos: [0, 0] }, primitives: 2 }));
      const json = lu as { meshes: { primitives: Record<string, unknown>[] }[]; materials: { name: string }[]; [cle: string]: unknown };
      json.materials.push({ name: 'peau_f' });
      json.extensions = { KHR_materials_variants: { variants: [{ name: variante }] } };
      json.extensionsUsed = ['KHR_materials_variants'];
      portees.forEach((j) => { json.meshes[0].primitives[j].extensions = { KHR_materials_variants: { mappings: [{ material: 1, variants: [0] }] } }; });
      return ecrireGlb(json, bin);
    };
    const parSexe = (octets: Uint8Array, surface: Record<string, unknown>) => {
      const v = validerManifesteDeBase({ ...manifesteDe(octets), surfaces: [surface] }, octets);
      return v.ok ? [] : v.ecarts.map(({ code, ou }) => [code, ou]);
    };
    it('accepte la variante portée par chaque primitive ; `lireGlb` la lit', () => {
      const octets = avecVariante([0, 1]);
      expect(lireGlb(octets).variantes).toEqual(new Map([['peau', new Map([['F', 'peau_f']])]]));
      expect(parSexe(octets, { nom: 'peau', palette: 'peau', parSexe: { F: 'peau_f' } })).toEqual([]);
    });
    it.each<[string, Uint8Array, Record<string, unknown>, string[][]]>([
      ['une primitive sans la variante', avecVariante([0]), { nom: 'peau', palette: 'peau', parSexe: { F: 'peau_f' } }, [['surface-absente', 'surfaces.0.parSexe.F']]],
      ['une variante d’un autre nom', avecVariante([0, 1], 'M'), { nom: 'peau', palette: 'peau', parSexe: { F: 'peau_f' } }, [['surface-absente', 'surfaces.0.parSexe.F']]],
      ['un autre matériau', avecVariante([0, 1]), { nom: 'peau', palette: 'peau', parSexe: { F: 'peau' } }, [['surface-absente', 'surfaces.0.parSexe.F']]],
      ['un sexe inconnu', avecVariante([0, 1]), { nom: 'peau', palette: 'peau', parSexe: { X: 'peau_f' } }, [['forme', 'surfaces.0.parSexe']]],
      ['un nom vide', avecVariante([0, 1]), { nom: 'peau', palette: 'peau', parSexe: { F: '' } }, [['forme', 'surfaces.0.parSexe']]],
      ['une table vide', avecVariante([0, 1]), { nom: 'peau', palette: 'peau', parSexe: {} }, [['forme', 'surfaces.0.parSexe']]],
    ])('refuse %s', (_cas, octets, surface, attendus) => expect(parSexe(octets, surface)).toEqual(attendus));
  });

  it('accepte une enveloppe avec un demi-domaine neutre', () => {
    const m = valide();
    const bornes = { legs: { min: 0.7, max: 1.3 }, arms: { min: 1, max: 1.5 }, head: { min: 1, max: 2 } };
    expect(validerManifesteDeBase({ ...m, gabarit: { ...m.gabarit, bornes } }, octets).ok).toBe(true);
  });

  it('omet exactement les sens non cuits, y compris leurs clés croisées', () => {
    const poids = poidsDuGabarit({ ...FACTEURS_NEUTRES, arms: 1.2, head: 1.4 }, { legs: { min: 0.7, max: 1.3 }, arms: { min: 1, max: 1.5 }, head: { min: 1, max: 2 } }, { feminin: 0.5 });
    expect(Object.keys(poids)).toEqual([
      'gabarit_legs_moins', 'gabarit_legs_moins_feminin', 'gabarit_legs_plus', 'gabarit_legs_plus_feminin',
      'gabarit_arms_plus', 'gabarit_arms_plus_feminin', 'gabarit_head_plus', 'gabarit_head_plus_feminin',
    ]);
    expect(Object.values(poids).every(Number.isFinite)).toBe(true);
  });

  it.each([
    ['arms', 0.9, { min: 1, max: 1.5 }],
    ['head', 0.8, { min: 1, max: 2 }],
    ['legs', 1.1, { min: 0.7, max: 1 }],
  ] as const)('refuse %s=%s du côté sans clé', (cle, facteur, plage) => {
    const bornes = { ...TABLE.bornes, [cle]: plage };
    expect(() => poidsDuGabarit({ ...FACTEURS_NEUTRES, [cle]: facteur }, bornes, {}))
      .toThrow(`gabarit.${cle} : facteur ${facteur} refusé pour les bornes [${plage.min}, ${plage.max}]`);
  });

  it('extrapole un sens cuit sans plafonner son poids', () => {
    const poids = poidsDuGabarit({ ...FACTEURS_NEUTRES, arms: 2.5 }, { ...TABLE.bornes, arms: { min: 1, max: 1.5 } }, { feminin: 0.5 });
    expect(poids.gabarit_arms_plus).toBe(3);
    expect(poids.gabarit_arms_plus_feminin).toBe(1.5);
  });

  it.each([
    [{ legs: TABLE.bornes.legs, arms: TABLE.bornes.arms }, 'gabarit.bornes.head', 'objet attendu'],
    [{ ...TABLE.bornes, st: { min: 0.5, max: 2 } }, 'gabarit.bornes.st', 'champ inconnu'],
  ])('refuse une clé absente ou supplémentaire une seule fois (%j)', (bornes, ou, detail) => {
    const m = valide();
    const verdict = validerManifesteDeBase({ ...m, gabarit: { ...m.gabarit, bornes } }, octets);
    expect(verdict).toEqual({ ok: false, ecarts: [{ code: 'forme', ou, detail }] });
  });

  it.each([
    { min: 0.7, max: Infinity }, { min: -Infinity, max: 1.3 },
    { min: Number.NaN, max: 1.3 }, { min: 0.7, max: Number.NaN },
    { min: -Infinity, max: Infinity },
  ])('refuse une plage non finie avec un seul écart (%j)', (plage) => {
    const m = valide();
    const bornes = { ...TABLE.bornes, legs: plage };
    expect(validerManifesteDeBase({ ...m, gabarit: { ...m.gabarit, bornes } }, octets)).toEqual({
      ok: false, ecarts: [{ code: 'forme', ou: 'gabarit.bornes.legs', detail: 'min et max : nombres finis attendus' }],
    });
  });

  it.each([
    undefined, {},
    { legs: { min: 0, max: 1.3 }, arms: TABLE.bornes.arms, head: TABLE.bornes.head },
    { legs: { min: 1.1, max: 1.3 }, arms: TABLE.bornes.arms, head: TABLE.bornes.head },
    { legs: { min: 0.7, max: 0.9 }, arms: TABLE.bornes.arms, head: TABLE.bornes.head },
    { legs: { min: 0.7, max: Infinity }, arms: TABLE.bornes.arms, head: TABLE.bornes.head },
    { legs: { min: '0.7', max: 1.3 }, arms: TABLE.bornes.arms, head: TABLE.bornes.head },
    { ...TABLE.bornes, arms: { min: 1.2, max: 1.5 } },
    { ...TABLE.bornes, head: { min: 0.7, max: 0.9 } },
  ])('refuse des bornes de gabarit absentes ou invalides (%j)', (bornes) => {
    const m = valide();
    const verdict = validerManifesteDeBase({ ...m, gabarit: { ...m.gabarit, bornes } }, octets);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.ecarts.some((e) => e.ou.startsWith('gabarit.bornes'))).toBe(true);
  });

  it('accepte le manifeste qui décrit le GLB', () => {
    expect(validerManifesteDeBase(valide(), octets).ok).toBe(true);
  });

  it('refuse une forme indépendante comme silhouette même présente dans le GLB', () => {
    const nom = 'expression';
    const base = glbFabrique({ bande: { [FEMININ]: new Array<number>(9).fill(0), [nom]: new Array<number>(9).fill(0) }, clips: { Repos: [0, 0] } });
    const manifeste = { ...manifesteDe(base, ['racine', 'pelvis']), silhouettes: [FEMININ, nom] };
    expect(validerManifesteDeBase(manifeste, base)).toEqual({
      ok: false, ecarts: [{ code: 'silhouette-inconnue', ou: 'silhouettes', detail: `${nom} n’est pas une silhouette du gabarit` }],
    });
  });

  it.each([undefined, FEMININ])('refuse une clé de gabarit comme silhouette (%s), même présente dans le GLB', (silhouette) => {
    const nom = nomDeCleDuGabarit('legs', 'moins', silhouette);
    const base = glbFabrique({ bande: { [FEMININ]: new Array<number>(9).fill(0), [nom]: new Array<number>(9).fill(0) }, clips: { Repos: [0, 0] } });
    const manifeste = { ...manifesteDe(base, ['racine', 'pelvis']), silhouettes: [FEMININ, nom] };
    expect(validerManifesteDeBase(manifeste, base)).toEqual({
      ok: false, ecarts: [{ code: 'forme', ou: 'silhouettes', detail: `${nom} est une clé de gabarit, pas une silhouette` }],
    });
    expect(validerManifesteDeBase({ ...manifeste, silhouettes: [FEMININ] }, base).ok).toBe(true);
  });

  it.each([['legs', 'arms'], ['legs', 'head'], ['arms', 'head']] as const)('refuse un os sous %s et %s en nommant les deux clés', (a, b) => {
    const m = valide();
    const gabarit = { ...m.gabarit, [a]: ['racine'], [b]: ['racine'] };
    expect(validerManifesteDeBase({ ...m, gabarit }, octets)).toEqual({
      ok: false, ecarts: [{ code: 'forme', ou: `gabarit.${b}`, detail: `racine figure sous ${a} et ${b}` }],
    });
    expect(validerManifesteDeBase({ ...m, gabarit: { ...m.gabarit, [a]: ['racine'] } }, octets).ok).toBe(true);
  });

  it('refuse un os sous les trois clés en nommant les deux conflits successifs', () => {
    const m = valide();
    const gabarit = { ...m.gabarit, legs: ['racine'], arms: ['racine'], head: ['racine'] };
    expect(validerManifesteDeBase({ ...m, gabarit }, octets)).toEqual({
      ok: false, ecarts: [
        { code: 'forme', ou: 'gabarit.arms', detail: 'racine figure sous legs et arms' },
        { code: 'forme', ou: 'gabarit.head', detail: 'racine figure sous arms et head' },
      ],
    });
  });

  it.each(['legs', 'arms', 'head'] as const)('accepte un doublon sous la seule clé %s', (cle) => {
    const m = valide();
    const gabarit = { ...m.gabarit, [cle]: ['racine', 'racine'] };
    expect(validerManifesteDeBase({ ...m, gabarit }, octets)).toEqual({ ok: true, manifeste: { ...m, gabarit } });
  });

  it.each<[CodeDEcartDeBase, (m: ReturnType<typeof valide>) => unknown]>([
    ['forme', (m) => ({ ...m, base: 3 })],
    ['version-inconnue', (m) => ({ ...m, schema: 2 })],
    ['os-inconnu', (m) => ({ ...m, os: ['racine', 'fantome'], bornesArticulaires: osLibres(['racine', 'fantome']) })],
    ['chaine-sur-os-absent', (m) => ({ ...m, chaines: { jambe: ['fantome'] } })],
    ['zone-sans-mesh', (m) => ({ ...m, zones: ['torse', 'bras'] })],
    ['emplacement-sur-os-absent', (m) => ({ ...m, emplacements: { dos: { ...attache, os: 'fantome' } } })],
    ['prise-absente', (m) => ({ ...m, prises: { main: m.prises.main } })],
    ['silhouette-absente', (m) => ({ ...m, silhouettes: ['corpulence'] })],
    ['glb-different', (m) => ({ ...m, glb: { ...m.glb, octets: m.glb.octets + 1 } })],
    ['palette-inconnue', (m) => ({ ...m, surfaces: [{ nom: 'peau', palette: 'or' }] })],
    ['surface-absente', (m) => ({ ...m, surfaces: [{ nom: 'cuir', palette: 'cuir' }] })],
    ['forme', (m) => ({ ...m, surfaces: [{ nom: 'peau', palette: 'peau', blason: true }] })],
    ['forme', (m) => ({ ...m, surfaces: [{ nom: 'peau', palette: 'peau', matiere: 'prop--os' }] })],
  ])('refuse par le code %s', (code, alterer) => {
    expect(codes(alterer(valide()))).toEqual([code]);
  });

  it.each<[string, CodeDEcartDeBase, (m: ReturnType<typeof valide>) => unknown]>([
    ['porteur absent', 'forme', ({ porteur: _, ...m }) => m],
    ['espèce vide', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, espece: '' } })],
    ['gabarit absent', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, gabarit: undefined } })],
    ['gabarit de porteur sans table de gabarit', 'forme', ({ gabarit: _, ...m }) => m],
    ['taille non chaîne', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, taille: 3 } })],
    ['échelle d’art nulle', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, echelleDArt: 0 } })],
    ['échelle d’art infinie', 'forme', (m) => ({ ...m, porteur: { ...m.porteur, echelleDArt: Infinity } })],
    ['appuis absents', 'forme', ({ appuis: _, ...m }) => m],
    ['aucun pied', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, pieds: [] } })],
    ['pied hors des os', 'os-inconnu', (m) => ({ ...m, appuis: { ...m.appuis, pieds: ['fantome'] } })],
    ['vitesse au sol négative', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitesseAuSol: -1.4 } })],
    ['vitesse au sol nulle', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitesseAuSol: 0 } })],
    ['vitesse au sol infinie', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitesseAuSol: Infinity } })],
    ['vitesse au sol non numérique', 'forme', (m) => ({ ...m, appuis: { ...m.appuis, vitesseAuSol: '1.4' } })],
    ['vitesse au sol absente', 'forme', ({ appuis: { vitesseAuSol: _, ...appuis }, ...m }) => ({ ...m, appuis })],
    ['table de clips absente', 'forme', ({ clips: _, ...m }) => m],
    ['table de clips non objet', 'forme', (m) => ({ ...m, clips: 'Repos' })],
    ['clip du rôle marche absent', 'forme', (m) => ({ ...m, clips: { repos: m.clips.marche } })],
    ['clip du rôle marche non chaîne', 'forme', (m) => ({ ...m, clips: { marche: 1 } })],
    ['os à position animée absents', 'forme', ({ osAPositionAnimee: _, ...m }) => m],
    ['os à position animée hors des os', 'os-inconnu', (m) => ({ ...m, osAPositionAnimee: ['fantome'] })],
  ])('refuse %s par le code %s', (_cas, code, alterer) => {
    expect(new Set(codes(alterer(valide())))).toEqual(new Set([code]));
  });
});

describe('evaluer', () => {
  it('une base et un élément aux mêmes noms comptent chacun leurs triangles et leurs influences', async () => {
    const g = glbFabrique({ jeuEtendu: true, clips: { Repos: [0, 0] } });
    const seul = await evaluer({ base: g, pas: 0.5 });
    const double = await evaluer({ base: g, elements: [g], pas: 0.5 });
    expect(double.mesures.triangles.parMesh).toEqual([...seul.mesures.triangles.parMesh, ...seul.mesures.triangles.parMesh.map((m) => ({ ...m, mesh: 'élément 1/Corps#0' }))]);
    expect(double.mesures.triangles.total).toBe(2 * seul.mesures.triangles.total);
    expect(double.ecarts.filter((e) => e.code === 'influences-au-dela-de-4').map((e) => e.mesh)).toEqual(['base/Corps#0', 'élément 1/Corps#0']);
  });
  it('mesure une base au sol sans aucun écart, silhouettes comprises', async () => {
    const base = glbFabrique({ image: true, anneau: JUSTES, clips: { Repos: [0, 0] }, cibleDuClip: 'racine' });
    const fiche = await evaluer({ base, pas: 0.5 });
    expect(fiche.ecarts).toEqual([]);
    expect(fiche.mesures).toMatchObject({ triangles: { total: 3, parMesh: [{ mesh: 'base/Corps#0', triangles: 3 }] }, sommets: 9, os: 2, images: 1, corps: ['base/Corps#0'] });
    expect(fiche.mesures.silhouettes.anneaux).toBe(1);
    expect(fiche.mesures.silhouettes.silhouettes.map((s) => s.nom)).toEqual(Object.keys(JUSTES));
    expect(fiche.mesures.silhouettes.carrure).toBeNull();
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

  it('refuse des facteurs de gabarit sans table de gabarit valide, et un clip absent, demandé ou plafonné', async () => {
    await expect(evaluer({ base: glbFabrique(), facteurs: { legs: 1.1 } })).rejects.toThrow(/sans table de gabarit/);
    await expect(evaluer({ base: glbFabrique(), clips: ['Absent'] })).rejects.toThrow(/Absent/);
    await expect(evaluer({ base: glbFabrique(), plafondsDesMembres: { Absent: 1 } })).rejects.toThrow(/Absent/);
  });

  it('refuse une silhouette ou une carrure que la base ne porte pas', async () => {
    const base = glbFabrique({ clips: { Repos: [0, 0] } });
    expect((await evaluer({ base, silhouettes: { feminin: 1 }, pas: 0.5 })).mesures.silhouettes.silhouettes.map((s) => s.nom)).toEqual(['feminin']);
    await expect(evaluer({ base, silhouettes: { feminin: 1, masculin: 1 }, pas: 0.5 })).rejects.toThrow(/\[silhouette-absente\] masculin /);
    await expect(evaluer({ base, manifeste: manifesteDe(base), facteurs: { st: 1.1 }, pas: 0.5 })).rejects.toThrow(/\[carrure-absente\] st=1\.1 .*carrure_plus/);
  });
});

describe('evaluer : clés cuites du gabarit', () => {
  const deplacement = (y: number) => [0, y, 0, 0, y, 0, 0, y, 0];
  const propre = nomDeCleDuGabarit('arms', 'plus');
  const croisee = nomDeCleDuGabarit('arms', 'plus', FEMININ);

  it('pose les poids propres et croisés feminin + arms sur la base et les éléments qui les portent', async () => {
    const formes = formesAvecGabarit({ feminin: deplacement(-0.01) }, { [propre]: deplacement(-0.1), [croisee]: deplacement(-0.2) });
    const base = glbFabrique({ bande: formes, clips: { Repos: [0, 0] } });
    const manifeste = manifesteDe(base, ['racine', 'pelvis']);
    const f = await evaluer({ base, manifeste, facteurs: { arms: 1.25 }, silhouettes: { feminin: 0.4 }, pas: 0.5 });
    expect(f.mesures.clips[0].plusBas.min).toBeCloseTo(-0.094, 6);
    expect(f.mesures.silhouettes.silhouettes[0].deplacementMax).toBeCloseTo(0.11, 6);
    const element = glbFabrique({ nom: 'Element', bande: { [croisee]: [0, 0, 0, 0, 0, 0, 0, 40, 0] } });
    const avecElement = await evaluer({ base, manifeste, elements: [element], facteurs: { arms: 1.25 }, silhouettes: { feminin: 0.4 }, pas: 0.5 });
    expect(avecElement.ecarts.find((e) => e.mesh === 'élément 1/Element#0' && e.code === 'arete-repos-enflee')?.valeur).toBeCloseTo(9, 6);
  });

  it('calcule la référence d’étirement avec les clés propres et les croisées nulles', async () => {
    const sommet = (y: number) => [0, 0, 0, 0, 0, 0, 0, y, 0];
    const base = glbFabrique({ bande: formesAvecGabarit({ feminin: sommet(0.2) }, { [propre]: sommet(1), [croisee]: sommet(8) }), clips: { Repos: [0, 0] } });
    const f = await evaluer({ base, manifeste: manifesteDe(base, ['racine', 'pelvis']), facteurs: { arms: 1.5 }, silhouettes: { feminin: 1 }, pas: 0.5 });
    expect(f.ecarts.find((e) => e.code === 'arete-repos-enflee')?.valeur).toBeCloseTo(5.1, 6);
  });

  it.each([propre, nomDeCleDuGabarit('legs', 'moins', FEMININ)])('refuse la clé absente %s, même à poids nul', async (absente) => {
    const formes = formesAvecGabarit({ feminin: deplacement(0) });
    delete formes[absente];
    const base = glbFabrique({ bande: formes, clips: { Repos: [0, 0] } });
    await expect(evaluer({ base, manifeste: manifesteDe(base, ['racine', 'pelvis']), facteurs: { arms: 1.25 }, pas: 0.5 })).rejects.toThrow(new RegExp('\\[gabarit-absent\\].*' + absente));
  });

  it('mesure le segment d’un os du gabarit à S_b sur ses trois axes, contre le repos sans les clés gabarit_* (#3097)', async () => {
    const tete = nomDeCleDuGabarit('head', 'plus'), teteFeminin = nomDeCleDuGabarit('head', 'plus', FEMININ);
    const feminin = [0, 0, 0, 0, 0.3, 0.4, 0, 0, 0];
    const base = glbFabrique({ bande: formesAvecGabarit({ feminin }, { [tete]: [0, 0, 0, 1, 0, 0, 0, 0, 0], [teteFeminin]: feminin }), clips: { Repos: [0, 0] } });
    const manifeste = { ...manifesteDe(base, ['racine', 'pelvis']), gabarit: { ...TABLE, legs: [], head: ['racine'] } };
    const f = await evaluer({ base, manifeste, facteurs: { head: 1.5 }, silhouettes: { feminin: 1 }, pas: 0.5 });
    expect(f.ecarts.filter((e) => e.garde === 'segments' || e.garde === 'manifeste')).toEqual([]);
    expect(f.mesures.segments?.segments.map((s) => [s.os, s.attendu, s.rapport.map((r) => +(r ?? 0).toFixed(6))])).toEqual([['racine', [1.5, 1.5, 1.5], [1.5, 1.5, 1.5]]]);
  });

  it('les poids explicites de carrure priment sur st avant le calcul des croisées', async () => {
    const silhouettes = { feminin: deplacement(0), [CARRURE_MOINS]: deplacement(0), [CARRURE_PLUS]: deplacement(-0.1) };
    const croiseeDeCarrure = nomDeCleDuGabarit('arms', 'plus', CARRURE_PLUS);
    const base = glbFabrique({ bande: formesAvecGabarit(silhouettes, { [croiseeDeCarrure]: deplacement(-0.4) }), clips: { Repos: [0, 0] } });
    const manifeste = { ...manifesteDe(base, ['racine', 'pelvis']), silhouettes: Object.keys(silhouettes) };
    const f = await evaluer({ base, manifeste, facteurs: { arms: 1.25, st: 1.2 }, silhouettes: { [CARRURE_PLUS]: 0.3 }, pas: 0.5 });
    expect(f.mesures.clips[0].plusBas.min).toBeCloseTo(-0.09, 6);
  });
});

describe('evaluer : étirement contre la longueur de repos sous gabarit, silhouettes à 0', () => {
  /** Le déplacement du seul sommet (0, 1, 0) de la bande, en shape key. */
  const auSommet = (dy: number) => [0, 0, 0, 0, 0, 0, 0, dy, 0];
  const etirement = async (entree: Omit<Parameters<typeof evaluer>[0], 'pas'>) =>
    (await evaluer({ ...entree, pas: 0.5 })).ecarts.filter((e) => e.garde === 'etirement').map((e) => [e.code, e.clip, e.seuil]);

  it('ROUGE : un repos posé effondré, signalé une fois par mesh quel que soit le nombre de clips', async () => {
    const base = glbFabrique({ bande: { effondree: auSommet(-0.95) }, clips: { Repos: [0, 0], Immobile: [0, 0] } });
    expect(await etirement({ base, silhouettes: { effondree: 1 } })).toEqual([['arete-repos-effondree', undefined, ETIREMENT_AU_REPOS[0]]]);
  });

  it('ROUGE : un repos posé enflé', async () => {
    const base = glbFabrique({ bande: { enflee: auSommet(4) }, clips: { Repos: [0, 0] } });
    expect(await etirement({ base, silhouettes: { enflee: 1 } })).toEqual([['arete-repos-enflee', undefined, ETIREMENT_AU_REPOS[1]], ['arete-etiree', 'Repos', ETIREMENT_EN_CLIP[1]]]);
  });

  it('ROUGE : un clip qui étire, un clip qui écrase, contre la longueur de repos', async () => {
    const base = glbFabrique({ bande: { inerte: auSommet(0) }, clips: { Tire: [0, 4], Ecrase: [0, -0.995] } });
    expect(await etirement({ base })).toEqual([['arete-etiree', 'Tire', ETIREMENT_EN_CLIP[1]], ['arete-ecrasee', 'Ecrase', ETIREMENT_EN_CLIP[0]]]);
  });

  it('refuse une forme indépendante comme silhouette, même avec ses clés croisées présentes', async () => {
    const nom = 'autre_forme';
    const base = glbFabrique({ bande: formesAvecGabarit({ [FEMININ]: auSommet(0), [nom]: auSommet(4) }), clips: { Repos: [0, 0] } });
    const manifeste = { ...manifesteDe(base, ['racine', 'pelvis']), silhouettes: [FEMININ] };
    await expect(etirement({ base, manifeste, facteurs: { arms: 1.25 }, silhouettes: { [nom]: 1 } })).rejects.toThrow('[silhouette-absente] autre_forme : nom(s) absent(s) des silhouettes déclarées');
  });

  it('refuse la carrure physique non déclarée comme silhouette', async () => {
    const base = glbFabrique({ bande: formesAvecGabarit({ feminin: auSommet(0), [CARRURE_PLUS]: auSommet(1) }), clips: { Repos: [0, 0] } });
    await expect(etirement({ base, manifeste: manifesteDe(base, ['racine', 'pelvis']), facteurs: { st: 1.1 } })).rejects.toThrow('[carrure-absente] st=1.1 : carrure_plus est absente des silhouettes déclarées');
  });

  it('VERT : `sl` seul garde les clés du gabarit nulles et ne rapporte aucun écart', async () => {
    const base = glbFabrique({ bande: formesAvecGabarit({ feminin: auSommet(0) }), clips: { Repos: [0, 0] } });
    expect(await etirement({ base, manifeste: manifesteDe(base), facteurs: { sl: 5 } })).toEqual([]);
  });

  it('VERT : une shape key qui raccourcit le repos, un clip qui ne double pas la longueur de repos sans clé', async () => {
    const base = glbFabrique({ bande: { hanche: auSommet(-0.7) }, clips: { Hanche: [0, 1.7] } });
    expect(await etirement({ base, silhouettes: { hanche: 1 } })).toEqual([]);
  });
});

// Capture Godot de Walk_Loop au corps neutre, pied gauche (#3086).
const CAPTURE_MARCHE_GAUCHE = [
  [0.0707085, 0, 0, -0.11246191, -0.11284936, 0.09574059, -0.26655561, -0.12011719, 0.00010814, -0.25937098, -0.09849565, 0.0435616, -0.43306649],
  [0.10256667, 0, 0, -0.14569519, -0.11304501, 0.09497812, -0.27678993, -0.12012406, 0.00045212, -0.25902572, -0.09876552, 0.02206329, -0.43532777],
  [0.13737517, 0, 0, -0.18200615, -0.11321594, 0.09360695, -0.2855407, -0.12014006, 0.00078346, -0.25938869, -0.0989795, 0.00369915, -0.43510276],
  [0.16904183, 0, 0, -0.21503967, -0.1132801, 0.09594563, -0.28921235, -0.1201072, 0.00381556, -0.26036453, -0.09904663, -0.0001147, -0.43489996],
  [0.20098628, 0, 0, -0.24836296, -0.11330403, 0.09605509, -0.28905168, -0.12004607, 0.00380718, -0.2605024, -0.09905297, 0.00000163, -0.43474269],
  [0.23709739, 0, 0, -0.28603277, -0.11332093, 0.0959456, -0.28897357, -0.11994945, 0.0038756, -0.2599414, -0.09903658, -0.00009974, -0.43466729],
  [0.26886822, 0, 0, -0.31917495, -0.11336192, 0.09606364, -0.2888993, -0.11989119, 0.00406108, -0.2596719, -0.09904499, -0.00005632, -0.43455142],
  [0.30404183, 0, 0, -0.35586679, -0.11348814, 0.0975756, -0.28964216, -0.11982051, 0.00579298, -0.25963464, -0.0990366, -0.00008873, -0.43444914],
  [0.33564167, 0, 0, -0.3888306, -0.11375353, 0.10092899, -0.29140389, -0.11979483, 0.00968969, -0.25964186, -0.09904699, -0.00002052, -0.43434024],
  [0.36705833, 0, 0, -0.42160332, -0.11416374, 0.10565892, -0.29415828, -0.1198386, 0.01539009, -0.25961536, -0.09905694, 0.00001853, -0.43423784],
  [0.40024167, 0, 0, -0.45621896, -0.11476545, 0.11169714, -0.29807839, -0.12001293, 0.0230553, -0.2594837, -0.09905757, 0.00001921, -0.43413609],
  [0.4345, 0, 0, -0.491956, -0.11557055, 0.11850277, -0.30303222, -0.12038515, 0.03218829, -0.25946522, -0.09905209, -0.00000624, -0.43402526],
] as const;

describe('mesurerAppuis sur les poses de marche', () => {
  const poses = (): PoseDuPied[] => CAPTURE_MARCHE_GAUCHE.map((v) => ({
    clip: 'Walk_Loop', pied: 'foot_l', t: v[0], racine: [v[1], v[2], v[3]], os: [v[4], v[5], v[6]],
    sommets: [[v[7], v[8], v[9]], [v[10], v[11], v[12]]],
  }));
  const mesurer = (images: readonly PoseDuPied[]) => mesurerAppuis(images, { Walk_Loop: 1.04315 });

  it.each([1, 2])('mesure la capture avec une image sur %s, sans contact ni dérive au-delà de 5 mm', (cadence) => {
    const r = mesurer(poses().filter((_, n) => n % cadence === 0));
    expect(r.ecarts).toEqual([]);
    const pied = r.mesures[0].pieds[0];
    expect(pied.intervalles).toBeGreaterThanOrEqual(4);
    expect(pied.duree).toBeGreaterThanOrEqual(0.2);
    expect(pied.contactMax).toBeLessThanOrEqual(SOL_TOLERANCE_M);
    expect(pied.glissementMax).toBeLessThanOrEqual(SOL_TOLERANCE_M);
  });

  it.each([0.001, 0.0025, 0.005, 0.01])('refuse la dérive injectée de %s m/image dans les sommets', (pente) => {
    const images = poses().map((p, n): PoseDuPied => ({ ...p, sommets: p.sommets.map((v) => [v[0] + pente * n, v[1], v[2]]) }));
    expect(mesurer(images).ecarts.map((e) => e.code)).toContain('glissement');
  });

  it('signale un pied sans surface', () => {
    const sansSurface = mesurer(poses().map((p) => ({ ...p, sommets: [] })));
    expect(sansSurface.ecarts.map((e) => e.code)).toEqual(['pied-sans-surface']);
    expect(sansSurface.mesures[0].pieds[0].intervalles).toBe(0);
  });
});

describe('appuis des clips marche', () => {
  const mesurer = async (marche: NonNullable<Parameters<typeof glbFabrique>[0]>['marche'] = {}, vitesseAuSol = 2, pas = 0.125, sl = 1) => {
    const base = glbFabrique({ marche, formes: formesAvecGabarit({ [FEMININ]: new Array<number>(18).fill(0) }) });
    const manifeste = { ...manifesteDe(base, ['racine', 'piedG', 'piedD']), appuis: { pieds: ['piedG', 'piedD'], plusBas: [{ position: [0, 0, 0], os: [{ nom: 'piedG', poids: 1 }], deltas: {} }], vitesseAuSol } };
    return evaluer({ base, manifeste, pas, facteurs: { sl } });
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

  it.each([0.5, 1.5])('déclare au gabarit sl=%s la vitesse au sol multipliée par `sl`', async (sl) => {
    const f = await mesurer({}, 2, 0.125, sl);
    expect(ecarts(f)).toEqual([]);
    expect(f.mesures.clips[0].appuis?.vitesseDeclaree).toBeCloseTo(2 * sl, 9);
    expect(f.mesures.clips[0].appuis?.vitesseAuSol).toBeCloseTo(2 * sl, 6);
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

  it('mesure le seul clip du rôle `marche`, à sa vitesse déclarée, indépendamment de son nom', async () => {
    const base = glbFabrique({ marche: { nom: 'Allure_lente' }, autresMarches: [{ nom: 'Allure_rapide', vitesse: 2 }, { nom: 'Walk_Loop' }] });
    const manifeste = { ...manifesteDe(base, ['racine', 'piedG', 'piedD']), clips: { marche: 'Allure_rapide' }, appuis: { pieds: ['piedG', 'piedD'], plusBas: [{ position: [0, 0, 0], os: [{ nom: 'piedG', poids: 1 }], deltas: {} }], vitesseAuSol: 4 } };
    const f = await evaluer({ base, manifeste, pas: 0.125 });
    expect(ecarts(f)).toEqual([]);
    expect(f.mesures.clips.map((c) => [c.nom, c.appuis?.vitesseDeclaree, c.appuis?.vitesseAuSol])).toEqual([
      ['Allure_lente', undefined, undefined], ['Allure_rapide', 4, expect.closeTo(4, 6)], ['Walk_Loop', undefined, undefined],
    ]);
  });
});

describe('gardeSilhouettes', () => {
  it('conserve les formes hors silhouettes dans la pose mesurée et restaure toute influence à la sortie', () => {
    const { scene, mesh } = cylindre();
    const nom = nomDeCleDuGabarit('legs', 'moins');
    mesh.geometry.morphTargetsRelative = true;
    mesh.geometry.morphAttributes.position = [FEMININ, nom].map((nom, i) => {
      const forme = new Float32BufferAttribute(Array.from({ length: mesh.geometry.attributes.position.count }, () => [i ? 2 : 0, 0, 0]).flat(), 3);
      forme.name = nom;
      return forme;
    });
    mesh.updateMorphTargets();
    mesh.morphTargetInfluences?.splice(0, 2, 0.7, 0.5);
    const x = mesh.geometry.attributes.position.getX(0);
    for (const interrompre of [false, true]) {
      const mesurer = () => sousLesFormes(scene, [FEMININ], (poser) => {
        const repos = poser({}, [mesh]);
        expect(mesh.morphTargetInfluences).toEqual([0, 0.5]);
        expect(repos.positions.get(mesh)?.[0]).toBeCloseTo(x + 1, 6);
        expect(() => poser({ [FEMININ]: 1, [nom]: 0 }, [mesh])).toThrow(nom);
        expect(mesh.morphTargetInfluences).toEqual([0, 0.5]);
        poser({ [FEMININ]: 1 }, [mesh]);
        expect(mesh.morphTargetInfluences).toEqual([1, 0.5]);
        if (interrompre) throw new Error('mesure interrompue');
      }, poidsDesFormesDe(null, FACTEURS_NEUTRES));
      if (interrompre) expect(mesurer).toThrow('mesure interrompue');
      else mesurer();
      expect(mesh.morphTargetInfluences).toEqual([0.7, 0.5]);
    }
  });

  const evaluerAnneau = async (formes: Record<string, readonly number[]>, entree: Partial<Parameters<typeof evaluer>[0]> = {}) => {
    const base = glbFabrique({ anneau: formes, clips: { Repos: [0, 0] } });
    return evaluer({ base, manifeste: { ...manifesteDe(base, ['racine', 'pelvis']), silhouettes: Object.keys(formes) }, pas: 0.5, ...entree });
  };
  const ecarts = (f: Awaited<ReturnType<typeof evaluer>>) => f.ecarts.filter((e) => e.garde === 'silhouettes');

  it.each([undefined, { schema: 2 }])('mesure toutes les formes du GLB sans manifeste valide (%j)', async (manifeste) => {
    const formes = { ...JUSTES, [nomDeCleDuGabarit('legs', 'moins')]: homothetie(1.3) };
    const base = glbFabrique({ anneau: formes, clips: { Repos: [0, 0] } });
    const f = await evaluer({ base, manifeste, pas: 0.5 });
    expect(f.mesures.silhouettes.silhouettes.map((s) => [s.nom, s.poids])).toEqual(Object.keys(JUSTES).map((nom) => [nom, { [nom]: 1 }]));
    expect(f.mesures.silhouettes.carrure).toBeNull();
  });

  it('VERT : silhouette homothétique, carrure exacte ; épaisseur, extrêmes et linéarité mesurés', async () => {
    const f = await evaluerAnneau(JUSTES);
    expect(f.ecarts.filter((e) => e.garde === 'manifeste')).toEqual([]);
    expect(ecarts(f)).toEqual([]);
    const m = f.mesures.silhouettes;
    expect(m?.anneaux).toBe(1);
    expect(m?.silhouettes.map((s) => [s.nom, s.centrePire?.os])).toEqual([['feminin', 'pelvis'], ['st=0.8', 'pelvis'], ['st=1.2', 'pelvis']]);
    expect(m?.carrure?.os).toBe('pelvis');
    expect(m?.carrure?.rayonDeRepos).toBeCloseTo(0.1, 6);
    expect(m?.carrure?.points.map((p) => p.st)).toEqual([0.8, 0.9, 1, 1.1, 1.2]);
    for (const p of m?.carrure?.points ?? []) expect(p.rapport).toBeCloseTo(p.st, 6);
    expect(m?.carrure?.ecartAuSegment).toBeLessThan(1e-6);
  });

  it('ROUGE : une clé qui décale l’anneau', async () => {
    const decale = await evaluerAnneau({ ...JUSTES, feminin: formeDeLAnneau(() => [0.05, 0, 0]) });
    expect(ecarts(decale).map((e) => [e.code, e.valeur])).toEqual([['centre-deplace', expect.closeTo(0.5, 5)]]);
  });

  it('ROUGE : une clé nulle', async () => {
    const nulle = await evaluerAnneau({ ...JUSTES, feminin: formeDeLAnneau(() => [0, 0, 0]) });
    expect(ecarts(nulle).map((e) => e.code)).toEqual(['silhouette-inerte']);
  });

  it('ROUGE : une carrure qui n’atteint pas `st`', async () => {
    const courte = await evaluerAnneau({ ...JUSTES, [CARRURE_PLUS]: homothetie(1.1) });
    expect(ecarts(courte).map((e) => [e.code, e.valeur])).toEqual([['epaisseur-hors-st', expect.closeTo(0.1 / 1.2, 5)]]);
    expect(courte.mesures.silhouettes.carrure?.ecartAuSegment).toBeCloseTo(0.05, 5);
  });

  it('ROUGE : un corps sans anneau articulaire ne se déclare pas mesuré', async () => {
    const base = glbFabrique({ clips: { Repos: [0, 0] } });
    const f = await evaluer({ base, manifeste: manifesteDe(base), pas: 0.5 });
    expect(ecarts(f).map((e) => e.code)).toContain('anneau-indetectable');
  });

  /** Une bande cylindrique de rayon 0,1 m couchée sur X : trois cercles de huit sommets, sans couture dupliquée, en
   *  x = 0,4, 0,5 et 0,6 m, mi-`racine` mi-`haut` ; `racine` tourné pour que l'axe Y de `haut` (en x = 0,5 m) suive X.
   *  Par shape key, l'homothétie radiale de rapport k autour de X. */
  function bandeCouchee(formes: Record<string, number>) {
    const geometrie = new BufferGeometry();
    geometrie.setAttribute('position', new Float32BufferAttribute([0.4, 0.5, 0.6].flatMap((x) =>
      Array.from({ length: 8 }, (_, k) => [x, 0.1 * Math.cos(k * Math.PI / 4), 0.1 * Math.sin(k * Math.PI / 4)]).flat()), 3));
    const p = geometrie.attributes.position;
    geometrie.setAttribute('skinIndex', new Uint16BufferAttribute(Array.from({ length: p.count }, () => [0, 1, 0, 0]).flat(), 4));
    geometrie.setAttribute('skinWeight', new Float32BufferAttribute(Array.from({ length: p.count }, () => [0.5, 0.5, 0, 0]).flat(), 4));
    geometrie.morphAttributes.position = Object.entries(formes).map(([nom, k]) => Object.assign(
      new Float32BufferAttribute(Array.from({ length: p.count }, (_, i) => [0, (k - 1) * p.getY(i), (k - 1) * p.getZ(i)]).flat(), 3), { name: nom }));
    geometrie.morphTargetsRelative = true;
    const racine = Object.assign(new Bone(), { name: 'racine' });
    racine.rotation.z = -Math.PI / 2;
    const haut = Object.assign(new Bone(), { name: 'haut' });
    haut.position.y = 0.5;
    racine.add(haut);
    const mesh = Object.assign(new SkinnedMesh(geometrie, new MeshBasicMaterial()), { name: 'Corps' });
    mesh.updateMorphTargets();
    const scene = new Group();
    scene.add(mesh);
    mesh.add(racine);
    scene.updateMatrixWorld(true);
    mesh.bind(new Skeleton([racine, haut]));
    return mesurerSilhouettes({ scene, corps: [mesh], silhouettes: Object.keys(formes), st: ST_DE_LA_BASE, poidsDesFormes: poidsDesFormesDe(null, FACTEURS_NEUTRES) });
  }
  const ST_DE_LA_BASE = { min: 0.72, max: 1.7 };

  it('le rayon d’un anneau d’étendue axiale non nulle se mesure perpendiculairement à son os : homothétie radiale k, rapport k', () => {
    const { mesures, ecarts: e } = bandeCouchee({ [CARRURE_MOINS]: ST_DE_LA_BASE.min, [CARRURE_PLUS]: ST_DE_LA_BASE.max });
    expect(e).toEqual([]);
    expect(mesures.carrure?.os).toBe('haut');
    expect(mesures.carrure?.rayonDeRepos).toBeCloseTo(0.1, 6);
    expect(mesures.carrure?.points.map((q) => q.st)).toEqual([0.72, 0.86, 1, 1.35, 1.7]);
    for (const q of mesures.carrure?.points ?? []) expect(q.rapport).toBeCloseTo(q.st, 6);
  });

  /** Deux anneaux sur une chaîne `racine` → `haut` → `bout` : un cercle de rayon 0,1 m en x = 0,5 m, mi-`racine`
   *  mi-`haut`, puis un cercle de rayon 0,15 m en x = 0,8 m, 0,6 `haut` et 0,4 `bout`. `racine` tourné sur Z, `haut`
   *  sur X : les matrices monde des os ne sont pas symétriques. */
  function deuxAnneaux() {
    const cercle = (x: number, r: number) => Array.from({ length: 8 }, (_, k) => [x, r * Math.cos(k * Math.PI / 4), r * Math.sin(k * Math.PI / 4)]).flat();
    const geometrie = new BufferGeometry();
    geometrie.setAttribute('position', new Float32BufferAttribute([...cercle(0.5, 0.1), ...cercle(0.8, 0.15)], 3));
    geometrie.setAttribute('skinIndex', new Uint16BufferAttribute([...Array(8).fill([0, 1, 0, 0]), ...Array(8).fill([2, 1, 0, 0])].flat(), 4));
    geometrie.setAttribute('skinWeight', new Float32BufferAttribute([...Array(8).fill([0.5, 0.5, 0, 0]), ...Array(8).fill([0.4, 0.6, 0, 0])].flat(), 4));
    const [racine, haut, bout] = ['racine', 'haut', 'bout'].map((name) => Object.assign(new Bone(), { name }));
    racine.rotation.z = -Math.PI / 2;
    haut.position.y = 0.5;
    haut.rotation.x = 0.4;
    bout.position.y = 0.3;
    racine.add(haut);
    haut.add(bout);
    const mesh = Object.assign(new SkinnedMesh(geometrie, new MeshBasicMaterial()), { name: 'Corps' });
    const scene = new Group();
    scene.add(mesh);
    mesh.add(racine);
    scene.updateMatrixWorld(true);
    mesh.bind(new Skeleton([racine, haut, bout]));
    return { scene, mesh };
  }

  it('anneaux.mjs rend, sur le vidage d’un corps (matrices par colonnes, influences), les anneaux, sections de repos et anneau le plus épais de la garde', () => {
    const { scene, mesh } = deuxAnneaux();
    const repos = poseDeRepos(scene, [mesh]);
    const vidage = {
      os: mesh.skeleton.bones.map((b) => ({ nom: b.name, parent: b.parent instanceof Bone ? b.parent.name : null, matrice: b.matrixWorld.toArray() })),
      corps: [{
        nom: mesh.name, positions: Array.from(repos.positions.get(mesh) ?? []),
        indices: Array.from(mesh.geometry.attributes.skinIndex.array), poids: Array.from(mesh.geometry.attributes.skinWeight.array),
      }],
    };
    const r = spawnSync(process.execPath, ['scripts/personnage-3d/base/anneaux.mjs'], { input: JSON.stringify(vidage), encoding: 'utf8', timeout: 60000 });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    const anneaux = anneauxArticulaires([mesh]);
    const sections = sectionsDeRepos(anneaux, repos);
    expect(anneaux.map((a) => a.os)).toEqual(['haut', 'bout']);
    expect(anneauLePlusEpais(sections)).toBe(1);
    expect(JSON.parse(r.stdout)).toEqual({ anneaux: anneaux.map((a, i) => ({ ...a, sommets: a.sommets.map(({ mesh: m, indice }) => ({ mesh: m.name, indice })), ...sections[i] })), lePlusEpais: anneauLePlusEpais(sections) });
  });

  it('l’épaisseur suit st en écart relatif : 1,5 % de 1,7 passe, 2,5 % non', () => {
    const passe = bandeCouchee({ [CARRURE_MOINS]: ST_DE_LA_BASE.min, [CARRURE_PLUS]: ST_DE_LA_BASE.max * 1.015 });
    expect(passe.ecarts).toEqual([]);
    expect(passe.mesures.carrure?.ecartASt).toBeCloseTo(0.015, 6);
    const hors = bandeCouchee({ [CARRURE_MOINS]: ST_DE_LA_BASE.min, [CARRURE_PLUS]: ST_DE_LA_BASE.max * 1.025 });
    expect(hors.ecarts.map((x) => [x.code, x.valeur, x.seuil])).toEqual([['epaisseur-hors-st', expect.closeTo(0.025, 6), TOLERANCE_EPAISSEUR]]);
  });

  it('restaure les silhouettes demandées avant l’échantillonnage des clips', async () => {
    const formes = { ...JUSTES, feminin: formeDeLAnneau((x, _y, z) => [0.1 * x, 0, 0.1 * z], [0, -0.05, 0]) };
    const plusBasDuRepos = async (entree: Partial<Parameters<typeof evaluer>[0]>) => (await evaluerAnneau(formes, entree)).mesures.clips[0].plusBas.min;
    expect(await plusBasDuRepos({})).toBeCloseTo(0, 6);
    expect(await plusBasDuRepos({ silhouettes: { feminin: 1 } })).toBeCloseTo(-0.05, 6);
  });
});

/** Un élément dont le nœud `lame`, mesh rigide de `primitives` primitives, pend à l'articulation `racine` de son skin. */
function glbRigide(primitives: number): Uint8Array {
  const bin = new Uint8Array(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  return ecrireGlb({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'racine', children: [1] }, { name: 'lame', mesh: 0, translation: [0, 0.1, 0] }], skins: [{ joints: [0] }],
    meshes: [{ primitives: Array.from({ length: primitives }, () => ({ attributes: { POSITION: 0 }, material: 0 })) }], materials: [{ name: 'metal' }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
    bufferViews: [{ buffer: 0, byteLength: bin.byteLength }], buffers: [{ byteLength: bin.byteLength }],
  }, bin);
}

describe('monter', () => {
  it.each([1, 2])('un rigide à %i primitive(s) passe, nœud entier, sous l’os de la base de même nom, à sa position locale', async (primitives) => {
    const base = await chargerScene(glbFabrique());
    monter(base, await chargerScene(glbRigide(primitives)));
    const os = base.scene.getObjectByName('racine');
    const lame = base.scene.getObjectByName('lame');
    expect(lame?.parent === os && os !== undefined).toBe(true);
    expect(lame?.position.toArray()).toEqual([0, 0.1, 0]);
    expect(os?.getObjectsByProperty('isMesh', true).length).toBe(primitives);
  });
});

describe('pistes de chaîne (#3102)', () => {
  const brin = () => {
    const racine = new Bone();
    racine.name = 'pelvis';
    const os = new Bone();
    os.name = 'jupe_01';
    os.position.set(0, -0.2, 0);
    racine.add(os);
    const scene = new Group();
    scene.add(racine);
    scene.updateMatrixWorld(true);
    return scene;
  };
  const QUART_DE_TOUR_X = [0, 0, 0, 1, Math.SQRT1_2, 0, 0, Math.SQRT1_2];
  const JUPE = { jupe: ['jupe_01'] };

  it('rejoue la piste LINEAR d’un os de chaîne et mesure sa rotation locale la plus forte depuis son repos', () => {
    const scene = brin();
    const clip = new AnimationClip('Walk_Loop', 1, [new QuaternionKeyframeTrack('jupe_01.quaternion', [0, 1], QUART_DE_TOUR_X)]);
    const { ecarts, clipsPistes } = gardePistesDeChaine(scene, [clip], JUPE);
    expect(ecarts).toEqual([]);
    const suivi = suivreLesChaines(scene, JUPE, poseDeRepos(scene, []));
    for (const e of echantillonner(scene, [], [clip], 0.5)) suivi.echantillon(e);
    const [mesure] = suivi.mesures(clipsPistes);
    expect(mesure).toMatchObject({ chaine: 'jupe', os: 1, clipsPistes: 1, rotationMax: { os: 'jupe_01', clip: 'Walk_Loop', t: 1 } });
    expect(mesure.rotationMax?.degres).toBeCloseTo(90, 3);
  });

  it('refuse un clip sans piste de rotation pour un os de chaîne, et une piste de rotation non LINEAR', () => {
    const scene = brin();
    const sans = new AnimationClip('Idle_Loop', 1, [new VectorKeyframeTrack('jupe_01.position', [0, 1], [0, -0.2, 0, 0, -0.3, 0])]);
    const marche = new QuaternionKeyframeTrack('jupe_01.quaternion', [0, 1], QUART_DE_TOUR_X);
    marche.setInterpolation(InterpolateDiscrete);
    const { ecarts, clipsPistes } = gardePistesDeChaine(scene, [sans, new AnimationClip('Walk_Loop', 1, [marche])], JUPE);
    expect(ecarts.map(({ code, clip, detail }) => [code, clip, detail])).toEqual([
      ['piste-de-chaine-absente', 'Idle_Loop', 'jupe : sans piste de rotation : jupe_01'],
      ['piste-de-chaine-non-lineaire', 'Walk_Loop', 'jupe : piste de rotation non LINEAR : jupe_01'],
    ]);
    expect(clipsPistes).toEqual({ jupe: 0 });
  });

  it('l’évaluateur juge les chaînes du manifeste : un clip de la base sans leurs pistes est un écart, chaque chaîne mesurée', async () => {
    const base = glbFabrique({ pelvis: true, clips: { Repos: [0, 0] } });
    const fiche = await evaluer({ base, manifeste: manifesteDe(base, ['racine', 'pelvis']), pas: 1 });
    expect(fiche.ecarts.filter((e) => e.garde === 'chaines').map(({ code, clip }) => [code, clip])).toEqual([['piste-de-chaine-absente', 'Repos']]);
    expect(fiche.mesures.chaines).toMatchObject([{ chaine: 'jambe', os: 1, clipsPistes: 0, rotationMax: { os: 'racine', degres: 0 } }]);
  });
});

describe('amplitude articulaire (#2992)', () => {
  /** Un GLB dont le clip `Flexion` tourne `pelvis` de `degres` autour de x. */
  const flechi = (degres: number) => glbFabrique({ pelvis: true, rotations: { Flexion: [Math.sin((degres * Math.PI) / 360), 0, 0, Math.cos((degres * Math.PI) / 360)] } });
  const base = flechi(90);
  const bornesArticulaires = { ...osLibres(['racine']), pelvis: { x: [-10, 45], y: [0, 0], z: [0, 0] } };
  const amplitudes = async (glb: Uint8Array) => (await evaluer({ base: glb, manifeste: { ...manifesteDe(glb, ['racine', 'pelvis']), bornesArticulaires }, pas: 0.25 })).ecarts.filter((e) => e.garde === 'amplitude');

  it('ROUGE : un clip tourne un os au-delà de sa borne, le pire dépassement de l’axe est rapporté', async () => {
    const ecarts = await amplitudes(base);
    expect(ecarts.map((e) => [e.garde, e.code, e.clip, e.t, e.seuil])).toEqual([['amplitude', 'amplitude-hors-bornes', 'Flexion', 1, 45]]);
    expect(ecarts[0].valeur).toBeCloseTo(90, 4);
  });

  it('VERT : le même clip corrigé, sa rotation dans les bornes', async () => {
    expect(await amplitudes(flechi(40))).toEqual([]);
  });

  it('ROUGE : sous la borne basse, en sens inverse', async () => {
    expect((await amplitudes(flechi(-30))).map((e) => [e.seuil, Math.round(e.valeur as number)])).toEqual([[-10, -30]]);
  });

  it('un os déclaré libre ne se juge pas', async () => {
    expect((await evaluer({ base, manifeste: manifesteDe(base, ['racine', 'pelvis']), pas: 0.25 })).ecarts.filter((e) => e.garde === 'amplitude')).toEqual([]);
  });

  it.each([
    ['un os non déclaré', { fantome: { x: [0, 0], y: [0, 0], z: [0, 0] } }, [['os-inconnu', 'bornesArticulaires.fantome']]],
    ['des bornes qui excluent le repos', { pelvis: { x: [10, 20], y: [0, 0], z: [0, 0] } }, [['forme', 'bornesArticulaires.pelvis.x']]],
    ['un axe absent', { pelvis: { x: [0, 0], y: [0, 0] } }, [['forme', 'bornesArticulaires.pelvis.z']]],
    ['un axe inconnu', { pelvis: { x: [0, 0], y: [0, 0], z: [0, 0], w: [0, 0] } }, [['forme', 'bornesArticulaires.pelvis.w']]],
    ['une borne au-delà de 180°', { pelvis: { x: [-190, 0], y: [0, 0], z: [0, 0] } }, [['forme', 'bornesArticulaires.pelvis.x']]],
    ['un os déclaré sans bornes', { pelvis: undefined }, [['forme', 'bornesArticulaires.pelvis']]],
  ])('refuse %s', (_nom, bornes, attendus) => {
    const bornesArticulaires = JSON.parse(JSON.stringify({ ...osLibres(['racine', 'pelvis']), ...bornes }));
    const v = validerManifesteDeBase({ ...manifesteDe(base, ['racine', 'pelvis']), bornesArticulaires }, base);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.ecarts.map(({ code, ou }) => [code, ou])).toEqual(attendus);
  });

  it('refuse un manifeste sans bornes articulaires', () => {
    const { bornesArticulaires: _bornes, ...sans } = manifesteDe(base, ['racine', 'pelvis']);
    const v = validerManifesteDeBase(sans, base);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.ecarts.map(({ code, ou }) => [code, ou])).toEqual([['forme', 'bornesArticulaires']]);
  });
});
