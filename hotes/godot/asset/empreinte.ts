/** L'EMPREINTE D'UN FICHIER DE MODÈLE (#2948) : la somme que la Release (`release.ts`), l'import (`importer.ts`) et le
 *  manifeste de base (`manifesteDeBase.ts`) comparent. */
import { createHash } from 'node:crypto';

/** La somme SHA-256 de `octets`, hexadécimale. */
export const sha256 = (octets: Uint8Array): string => createHash('sha256').update(octets).digest('hex');

/** L'empreinte `glb` d'un manifeste de modèle : la somme SHA-256 et la taille des octets `octets`. */
export const empreinte = (octets: Uint8Array) => ({ sha256: sha256(octets), octets: octets.byteLength });

/** Une empreinte SHA-256 en hexadécimal minuscule, la forme que rend `sha256`. */
export const EMPREINTE = /^[0-9a-f]{64}$/;
