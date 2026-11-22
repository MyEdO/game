import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ecrireGlb } from './glb.ts';
import { empreinte, sha256 } from './empreinte.ts';
import { MANIFESTE_DE_PRODUCTION } from './dossierDeProduction.ts';
import { estBase } from './modeles.ts';

export const GLB_DE_BASE = ecrireGlb({ asset: { version: '2.0' }, nodes: [{ name: 'root' }], skins: [{ joints: [0] }], animations: [{ name: 'walk' }] }, null);
/** Une primitive d'un GLB de test : son matériau, et si elle est dépliée en `TEXCOORD_0`. */
interface PrimitiveDeTest { readonly materiau: string; readonly uv: boolean }
/** Le GLB d'un élément rigide : le mesh `lame` pend à l'articulation `os` d'un skin, ou reste à la racine (`null`) ; une
 *  primitive par matériau de `materiaux`, chacune dépliée en `TEXCOORD_0` sauf celles des matériaux de `sansUv`, plus une
 *  primitive sans `TEXCOORD_0` par matériau de `mixtes` ; les primitives de `garde` forment un second mesh, sous le nœud
 *  `garde` à la racine, skinné par le skin de `os` si `skinne` ; le premier mesh porte les shape keys `shapeKeys`
 *  (`extras.targetNames`). */
export const glbDElement = (
  os: string | null, materiaux: readonly string[] = ['metal'], sansUv: readonly string[] = [],
  { mixtes = [], garde = [], skinne = false, shapeKeys = [] }: { readonly mixtes?: readonly string[]; readonly garde?: readonly PrimitiveDeTest[]; readonly skinne?: boolean; readonly shapeKeys?: readonly string[] } = {},
) => {
  const noms = [...new Set([...materiaux, ...garde.map(p => p.materiau)])];
  const primitive = ({ materiau, uv }: PrimitiveDeTest) => ({ material: noms.indexOf(materiau), ...(uv ? { attributes: { TEXCOORD_0: 0 } } : {}) });
  const lame = [...materiaux.map(materiau => ({ materiau, uv: !sansUv.includes(materiau) })), ...mixtes.map(materiau => ({ materiau, uv: false }))];
  const noeuds = os === null ? [{ name: 'lame', mesh: 0 }] : [{ name: os, children: [1] }, { name: 'lame', mesh: 0 }];
  return ecrireGlb({
    asset: { version: '2.0' }, nodes: garde.length ? [...noeuds, { name: 'garde', mesh: 1, ...(skinne ? { skin: 0 } : {}) }] : noeuds,
    ...(os === null ? {} : { skins: [{ joints: [0] }] }),
    meshes: [{ primitives: lame.map(primitive), ...(shapeKeys.length ? { extras: { targetNames: shapeKeys } } : {}) }, ...(garde.length ? [{ primitives: garde.map(primitive) }] : [])],
    materials: noms.map(name => ({ name })),
  }, null);
};
export const GLB_D_ELEMENT = glbDElement('root');
const attache = { os: 'root', position: [0, 0, 0], rotation: [0, 0, 0] };
export const baseDeTest = (base = 'humanoide') => ({
  schema: 7, base, os: ['root'], bornesArticulaires: { root: { x: [-180, 180], y: [-180, 180], z: [-180, 180] } }, chaines: {}, zones: [], emplacements: {}, prises: { main: attache, secondaire: attache }, silhouettes: [],
  gabarit: { legs: [], arms: [], head: [], racine: 'root', st: { min: 0.8, max: 1.2 }, bornes: { legs: { min: 0.7, max: 1.3 }, arms: { min: 1, max: 1.5 }, head: { min: 1, max: 2 } }, osDesSilhouettes: {} },
  porteur: { espece: 'humain', gabarit: 'moyen', taille: 'moyenne', echelleDArt: 1 },
  clips: { marche: 'walk' },
  appuis: { pieds: ['root'], plusBas: [{ position: [0, 0, 0], os: [{ nom: 'root', poids: 1 }], deltas: {} }], vitesseAuSol: 1 }, osAPositionAnimee: [], glb: empreinte(GLB_DE_BASE),
});
export const elementSchema3 = (base = 'humanoide') => ({
  schema: 3, base, categorie: 'rigide', cle: { apparence: 'epee' }, liaison: { mode: 'rigide' },
  surfaces: [{ nom: 'metal', palette: 'metal' }], glb: empreinte(GLB_D_ELEMENT),
});
/** Le GLB d'un élément sans base (#2987) : son mesh reste à la racine de la scène. */
export const GLB_SANS_BASE = glbDElement(null);
/** Le GLB d'un élément sans base (#2987) dont chaque nom de `noms` est un nœud à mesh, à la racine de la scène, de
 *  matériau `metal`, et qui porte les clips `clips`. */
export const glbANoeuds = (noms: readonly string[], clips: readonly string[] = []) => ecrireGlb({
  asset: { version: '2.0' }, nodes: noms.map((name) => ({ name, mesh: 0 })),
  meshes: [{ primitives: [{ material: 0 }] }], materials: [{ name: 'metal' }],
  ...(clips.length ? { animations: clips.map((name) => ({ name })) } : {}),
}, null);
/** Le GLB d'une pièce montée aux postes (#2987) : un nœud à mesh par état (`ETATS_AU_POSTE`). */
export const GLB_AU_POSTE = glbANoeuds(['ouvert', 'ferme']);
/** Le manifeste d'un véhicule, élément sans base, de la coque `definition`, pour `GLB_SANS_BASE`. */
export const vehiculeDeTest = (definition = 'caraque') => ({
  schema: 3, categorie: 'vehicule', cle: { definition }, liaison: { mode: 'rigide' }, surfaces: [{ nom: 'metal', palette: 'metal' }], glb: empreinte(GLB_SANS_BASE),
});

/** Le manifeste d'un décor, élément sans base, du type de décor `prop` (`props.json`), pour `GLB_SANS_BASE`. */
export const decorDeTest = (prop: string) => ({
  schema: 3, categorie: 'decor', cle: { prop }, liaison: { mode: 'rigide' }, surfaces: [{ nom: 'metal', palette: 'metal' }], glb: empreinte(GLB_SANS_BASE),
});

/** Le GLB d'un décor qui change selon la saison (#4335) : un même triangle sous trois nœuds à mesh,
 *  `tronc` et `avec-hiver` du matériau `bois`, `sans-hiver` du matériau `feuillage`. */
export const GLB_SAISONNIER = ecrireGlb({
  asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, 1, 2] }],
  nodes: [{ name: 'tronc', mesh: 0 }, { name: 'sans-hiver', mesh: 1 }, { name: 'avec-hiver', mesh: 0 }],
  meshes: [0, 1].map((material) => ({ primitives: [{ attributes: { POSITION: 0 }, material }] })),
  materials: [{ name: 'bois' }, { name: 'feuillage' }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }], buffers: [{ byteLength: 36 }],
}, new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer));
/** La teinte d'automne de l'emplacement `vegetal` du décor saisonnier de test. */
export const TEINTE_D_AUTOMNE = '#b5651d';
/** Le manifeste d'un décor du type `prop` (`props.json`) pour `GLB_SAISONNIER`, qui change selon la saison : son
 *  feuillage (`sans-hiver`) caché en hiver, ses branches nues (`avec-hiver`) montrées, et son emplacement `vegetal`
 *  teint en automne. */
export const decorSaisonnierDeTest = (prop: string) => ({
  schema: 3, categorie: 'decor', cle: { prop }, liaison: { mode: 'rigide' },
  surfaces: [{ nom: 'bois', palette: 'bois' }, { nom: 'feuillage', palette: 'vegetal' }],
  selon: { automne: { palette: { vegetal: TEINTE_D_AUTOMNE } }, hiver: {} }, glb: empreinte(GLB_SAISONNIER),
});

/** Le texte de licence de pack que `productionDeTest` dépose : une production importable établit sa licence. */
export const LICENCE_DE_PRODUCTION = 'LICENSE-Pack.txt';
/** Le contenu de `LICENCE_DE_PRODUCTION`. */
export const TEXTE_DE_LICENCE_DE_PRODUCTION = 'Pack\nLicense: CC0\n';

/** Le dossier de production de `manifeste` dans `dossier`, et pour une base le pack source qu'elle déclare, qui porte
 *  `LICENCE_DE_PRODUCTION` (`ecrireProduction`). */
export function productionDeTest(dossier: string, manifeste: unknown, octets: Uint8Array): string {
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, 'asset.glb'), octets);
  writeFileSync(join(dossier, LICENCE_DE_PRODUCTION), TEXTE_DE_LICENCE_DE_PRODUCTION);
  const packs = estBase(manifeste) ? { packs_sources: { corps: { path: 'corps.gltf', sha256: sha256(octets), licence: LICENCE_DE_PRODUCTION } } } : {};
  writeFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), JSON.stringify({ model: 'asset.glb', model_sha256: sha256(octets), manifeste, ...packs }));
  return dossier;
}

export function deposerModeleDeTest(dossier: string, id: string, manifeste: unknown, octets: Uint8Array): void {
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, `${id}.manifeste.json`), JSON.stringify(manifeste));
  writeFileSync(join(dossier, `${id}.provenance.json`), JSON.stringify({ model: `${id}.glb`, model_sha256: sha256(octets) }));
  writeFileSync(join(dossier, `${id}.glb`), octets);
}
