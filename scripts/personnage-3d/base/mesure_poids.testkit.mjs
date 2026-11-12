import { Bone, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Matrix4, Scene, Skeleton, SkinnedMesh } from 'three';
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs';

const { etatsDuGabarit } = await chargerEvaluateur('../etatsDuGabarit.ts');
const { matricesDePeauDuGabarit } = await chargerEvaluateur('../../../../scripts/personnage-3d/base/gabarit.ts');
const { nomDeCleDuGabarit } = await chargerEvaluateur('../gabarit.ts');
const { CARRURE_PLUS } = await chargerEvaluateur('../silhouettes.ts');
const { tableTotale } = await chargerEvaluateur('../../../../src/lib/tableTotale.ts');
const { appliquerGabarit, poserFormes, reposerGabarit } = await chargerEvaluateur('gabarit.ts');
const { poseDeRepos } = await chargerEvaluateur('echantillonnage.ts');
const { mesurerEtirement, gardeEtirementAuRepos } = await chargerEvaluateur('gardes/etirement.ts');

const scene = new Scene(), root = new Bone(), leg = new Bone(), tip = new Bone();
root.name = 'root'; leg.name = 'leg'; tip.name = 'tip';
leg.position.y = 1; tip.position.y = 1; root.add(leg); leg.add(tip); scene.add(root);
scene.updateMatrixWorld(true);
const bones = [root, leg, tip];
const affine = new Matrix4().makeScale(1.2, 0.8, 1.1).setPosition(0.1, -0.2, 0.05);
const skeleton = new Skeleton(bones, bones.map((b, i) => b.matrixWorld.clone().invert().multiply(affine)
  .multiply(new Matrix4().makeScale(1 + 0.2 * i, 1 - 0.1 * i, 1))));
const table = { racine: 'root', legs: ['leg'], arms: [], head: [], st: { min: 0.8, max: 1.2 },
  bornes: { legs: { min: 0.7, max: 1 }, arms: { min: 1, max: 1 }, head: { min: 1, max: 1 } } };
const emis = etatsDuGabarit(table, [CARRURE_PLUS]).find((e) => e.nom === `legs_moins__${CARRURE_PLUS}`);
const etat = { ...emis, facteurs: { ...emis.facteurs, sl: 1.7 } };
const propre = nomDeCleDuGabarit('legs', 'moins');
const croisee = nomDeCleDuGabarit('legs', 'moins', CARRURE_PLUS);
const x = [[0.1, 1.1, 0, 1], [0.4, 1.4, 0.1, 1], [0.2, 1.5, 0, 1], [0.2, 1.5, 0, 1]];
const w = process.argv[2] === 'modifie' ? [[0, 0.2, 0.8], [0, 0.7, 0.3], [0, 0.5, 0.5], [0, 0.5, 0.5]] :
  [[0, 0.8, 0.2], [0, 0.3, 0.7], [0, 0.5, 0.5], [0, 0.5, 0.5]];
const deltas = {
  [propre]: [[0.02, 0.08, 0], [0.07, -0.05, 0.02], [0.03, 0.04, 0], [0.03, 0.04, 0]],
  [CARRURE_PLUS]: [[-0.08, 0.03, 0], [0.12, -0.04, 0.05], [0, 0, 0], [0.1, 0.05, 0]],
  [croisee]: [[0.04, -0.01, 0], [-0.03, 0.06, 0], [0, 0, 0], [0, 0, 0]],
};
const geometry = new BufferGeometry();
geometry.setAttribute('position', new Float32BufferAttribute(x.flatMap((p) => p.slice(0, 3)), 3));
geometry.setAttribute('skinIndex', new Uint16BufferAttribute(w.flatMap(() => [0, 1, 2, 0]), 4));
geometry.setAttribute('skinWeight', new Float32BufferAttribute(w.flatMap((p) => [...p, 0]), 4));
geometry.morphTargetsRelative = true;
geometry.morphAttributes.position = Object.entries(deltas).map(([nom, d]) => {
  const a = new Float32BufferAttribute(d.flat(), 3); a.name = nom; return a;
});
const mesh = new SkinnedMesh(geometry); mesh.name = 'fixture'; mesh.updateMorphTargets();
scene.add(mesh); mesh.bind(skeleton, new Matrix4());
const originales = bones.map((b) => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
const restaurer = (angle) => {
  bones.forEach((b, i) => { b.position.copy(originales[i].p); b.quaternion.copy(originales[i].q); b.scale.copy(originales[i].s); });
  leg.rotation.z = angle; tip.rotation.z = -0.8 * angle; scene.updateMatrixWorld(true);
};
const poses = [];
for (const angle of [0, 0, 0.6]) {
  restaurer(angle);
  for (const b of bones) poses.push(...b.matrixWorld.clone().transpose().elements);
}
restaurer(0);
const peau = matricesDePeauDuGabarit(skeleton, table, etat.facteurs, new Float32Array(poses), [false, false, false]);
const matrices = Array.from({ length: 3 }, (_, t) => bones.map((_, o) => Array.from({ length: 4 }, (_, r) =>
  Array.from({ length: 4 }, (_, c) => peau[(t * bones.length + o) * 16 + r * 4 + c]))));
const appuis = { pieds: ['root'], plusBas: [{ position: [0, 0, 0], os: [{ nom: 'root', poids: 1 }], deltas: {} }], vitesseAuSol: 1 };
const gabarit = appliquerGabarit(scene, etat.facteurs, { gabarit: table, appuis }, {}, skeleton);
const nuls = tableTotale(Object.keys(deltas), () => 0);
poserFormes(scene, { ...nuls, ...etat.poidsReference });
reposerGabarit(gabarit, () => restaurer(0));
const reference = poseDeRepos(scene, [mesh]);
poserFormes(scene, { ...nuls, ...etat.poidsSilhouettes, ...etat.poidsGabarit });
const poseRepos = poseDeRepos(scene, [mesh]);
const mesures = [0, 0.6].map((angle, t) => {
  reposerGabarit(gabarit, () => restaurer(angle));
  return mesurerEtirement(new Map([[mesh, new Uint32Array([0, 1, 2, 3])]]), reference,
    { ...poseDeRepos(scene, [mesh]), clip: 'fixture', t });
});
process.stdout.write(JSON.stringify({ x, w, deltas, etat, matrices, aretes: [[0, 1], [2, 3]],
  reference: Array.from(reference.positions.get(mesh)),
  garde: { repos: { ecarts: gardeEtirementAuRepos(new Map([[mesh, new Uint32Array([0, 1, 2, 3])]]), (m) => m.name, reference, poseRepos),
      reference: Array.from(reference.positions.get(mesh)), positions: Array.from(poseRepos.positions.get(mesh)) }, minimum: Math.min(...mesures.flatMap((m) => m.pires.map((p) => p.rapport))),
    maximum: Math.max(...mesures.flatMap((m) => m.pires.map((p) => p.rapport))),
    aretesMesurees: mesures.map((m) => m.pires.map((p) => [p.a, p.b])) } }));
