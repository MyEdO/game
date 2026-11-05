/** La bande de `glbFabrique` en fixture de la copie des appuis (#3104) : `fixture` rend ses sommets, os et deltas en repère
 *  glTF ; `valider` lit des candidats sur l'entrée standard et rend le verdict de `validerManifesteDeBase` et la distance
 *  de chaque candidat à son sommet, sous une pose et une clé du gabarit. */
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs';

const { formesAvecGabarit, glbFabrique, manifesteDe } = await chargerEvaluateur('glbFabrique.testkit.ts');
const { nomDeCleDuGabarit } = await chargerEvaluateur('../gabarit.ts');
const { FEMININ } = await chargerEvaluateur('../silhouettes.ts');
const { validerManifesteDeBase } = await chargerEvaluateur('../manifesteDeBase.ts');
const { chargerScene } = await chargerEvaluateur('chargement.ts');
const { peauxDesCandidats } = await chargerEvaluateur('candidatsDAppui.ts');

const cle = nomDeCleDuGabarit('arms', 'plus');
const formes = formesAvecGabarit({ [FEMININ]: new Array(9).fill(0) }, { [cle]: [0, 0, 0, 0, 0, 0, 0, -3, 0] });
const octets = glbFabrique({ bande: formes, clips: { Repos: [0, 0] } });
const noms = ['racine', 'pelvis'];

if (process.argv[2] === 'fixture') {
  const triplets = (d) => [0, 1, 2].map((i) => d.slice(i * 3, i * 3 + 3));
  console.log(JSON.stringify({ cle, noms, sommets: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], os: [0, 0, 1],
    deltas: Object.fromEntries(Object.entries(formes).map(([nom, d]) => [nom, triplets(d)])) }));
} else {
  const candidats = JSON.parse(readFileSync(0, 'utf8'));
  const m = manifesteDe(octets, noms);
  const verdict = validerManifesteDeBase({ ...m, silhouettes: [FEMININ], appuis: { ...m.appuis, plusBas: candidats } }, octets);
  const b = await chargerScene(octets), mesh = b.meshes[0];
  mesh.morphTargetInfluences[mesh.morphTargetDictionary[cle]] = 1;
  b.squelette.bones.find((o) => o.name === 'racine').rotation.z = 0.4;
  b.squelette.bones.find((o) => o.name === 'pelvis').position.y = 0.3;
  const peaux = peauxDesCandidats(b.scene, candidats, mesh.skeleton);
  peaux.synchroniser();
  b.scene.updateMatrixWorld(true);
  const distances = candidats.map((_, i) => peaux.courante.getVertexPosition(i, new Vector3()).distanceTo(mesh.getVertexPosition(i, new Vector3())));
  console.log(JSON.stringify({ ecarts: verdict.ok ? [] : verdict.ecarts, distances }));
}
