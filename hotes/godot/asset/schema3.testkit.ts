import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ecrireGlb } from './glb.ts';
import { sha256 } from './empreinte.ts';

export const GLB_DE_BASE = ecrireGlb({ asset: { version: '2.0' }, nodes: [{ name: 'root' }], skins: [{ joints: [0] }], animations: [{ name: 'walk' }] }, null);
/** Le GLB d'un élément rigide : le mesh `lame` pend à l'articulation `os` d'un skin, ou reste à la racine (`null`). */
export const glbDElement = (os: string | null) => ecrireGlb({
  asset: { version: '2.0' }, nodes: os === null ? [{ name: 'lame', mesh: 0 }] : [{ name: os, children: [1] }, { name: 'lame', mesh: 0 }],
  ...(os === null ? {} : { skins: [{ joints: [0] }] }), meshes: [{ primitives: [{ material: 0 }] }], materials: [{ name: 'metal' }],
}, null);
export const GLB_D_ELEMENT = glbDElement('root');
const empreinte = (octets: Uint8Array) => ({ sha256: sha256(octets), octets: octets.byteLength });
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

export function productionSchema3(dossier: string, manifeste: unknown, octets: Uint8Array): string {
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, 'asset.glb'), octets);
  writeFileSync(join(dossier, LICENCE_DE_PRODUCTION), 'Pack\nLicense: CC0\n');
  writeFileSync(join(dossier, 'manifest.json'), JSON.stringify({ model: 'asset.glb', model_sha256: sha256(octets), manifeste }));
  return dossier;
}

export function deposerSchema3(dossier: string, id: string, manifeste: unknown, octets: Uint8Array): void {
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, `${id}.manifeste.json`), JSON.stringify(manifeste));
  writeFileSync(join(dossier, `${id}.provenance.json`), JSON.stringify({ model: `${id}.glb`, model_sha256: sha256(octets) }));
  writeFileSync(join(dossier, `${id}.glb`), octets);
}
