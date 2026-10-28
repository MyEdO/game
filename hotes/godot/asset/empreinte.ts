/** L'EMPREINTE D'UN FICHIER DE MODÈLE (#2948) : la somme que la Release (`release.ts`), l'import (`importer.ts`) et le
 *  manifeste de base (`manifesteDeBase.ts`) comparent. */
import { createHash } from 'node:crypto';

/** La somme SHA-256 de `octets`, hexadécimale. */
export const sha256 = (octets: Uint8Array): string => createHash('sha256').update(octets).digest('hex');
