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
 *  primitive sans `TEXCOORD_0` par matériau de `mixtes` ; les primitives d'`anonyme` forment un second mesh, sous un nœud
 *  sans nom à la racine, skinné par le skin de `os` si `skinne`. */
export const glbDElement = (
  os: string | null, materiaux: readonly string[] = ['metal'], sansUv: readonly string[] = [],
  { mixtes = [], anonyme = [], skinne = false }: { readonly mixtes?: readonly string[]; readonly anonyme?: readonly PrimitiveDeTest[]; readonly skinne?: boolean } = {},
) => {
  const noms = [...new Set([...materiaux, ...anonyme.map(p => p.materiau)])];
  const primitive = ({ materiau, uv }: PrimitiveDeTest) => ({ material: noms.indexOf(materiau), ...(uv ? { attributes: { TEXCOORD_0: 0 } } : {}) });
  const lame = [...materiaux.map(materiau => ({ materiau, uv: !sansUv.includes(materiau) })), ...mixtes.map(materiau => ({ materiau, uv: false }))];
  const noeuds = os === null ? [{ name: 'lame', mesh: 0 }] : [{ name: os, children: [1] }, { name: 'lame', mesh: 0 }];
  return ecrireGlb({
    asset: { version: '2.0' }, nodes: anonyme.length ? [...noeuds, { mesh: 1, ...(skinne ? { skin: 0 } : {}) }] : noeuds,
    ...(os === null ? {} : { skins: [{ joints: [0] }] }),
    meshes: [{ primitives: lame.map(primitive) }, ...(anonyme.length ? [{ primitives: anonyme.map(primitive) }] : [])],
    materials: noms.map(name => ({ name })),
  }, null);
};
export const GLB_D_ELEMENT = glbDElement('root');
const attache = { os: 'root', position: [0, 0, 0], rotation: [0, 0, 0] };
export const baseSchema3 = (base = 'humanoide') => ({
  schema: 3, base, os: ['root'], chaines: {}, zones: [], emplacements: {}, prises: { main: attache, off: attache }, silhouettes: [],
  gabarit: { legs: [], arms: [], head: [], racine: 'root', st: { min: 0.8, max: 1.2 } },
  porteur: { race: 'humain', gabarit: 'moyen', taille: 'moyenne', echelleDArt: 1 },
  appuis: { pieds: ['root'], vitessesAuSol: { walk: 1 } }, osAPositionAnimee: [], glb: empreinte(GLB_DE_BASE),
});
export const elementSchema3 = (base = 'humanoide') => ({
  schema: 3, base, categorie: 'rigide', cle: { apparence: 'epee' }, liaison: { mode: 'rigide' },
  surfaces: [{ nom: 'metal', teinte: true }], glb: empreinte(GLB_D_ELEMENT),
});

/** Le texte de licence de pack que `productionSchema3` dépose : une production importable établit sa licence. */
export const LICENCE_DE_PRODUCTION = 'LICENSE-Pack.txt';
/** Le contenu de `LICENCE_DE_PRODUCTION`. */
export const TEXTE_DE_LICENCE_DE_PRODUCTION = 'Pack\nLicense: CC0\n';

/** Le dossier de production de `manifeste` dans `dossier`, et pour une base le pack source qu'elle déclare, qui porte
 *  `LICENCE_DE_PRODUCTION` (`ecrireProduction`). */
export function productionSchema3(dossier: string, manifeste: unknown, octets: Uint8Array): string {
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, 'asset.glb'), octets);
  writeFileSync(join(dossier, LICENCE_DE_PRODUCTION), TEXTE_DE_LICENCE_DE_PRODUCTION);
  const packs = estBase(manifeste) ? { packs_sources: { corps: { path: 'corps.gltf', sha256: sha256(octets), licence: LICENCE_DE_PRODUCTION } } } : {};
  writeFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), JSON.stringify({ model: 'asset.glb', model_sha256: sha256(octets), manifeste, ...packs }));
  return dossier;
}

export function deposerSchema3(dossier: string, id: string, manifeste: unknown, octets: Uint8Array): void {
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, `${id}.manifeste.json`), JSON.stringify(manifeste));
  writeFileSync(join(dossier, `${id}.provenance.json`), JSON.stringify({ model: `${id}.glb`, model_sha256: sha256(octets) }));
  writeFileSync(join(dossier, `${id}.glb`), octets);
}
