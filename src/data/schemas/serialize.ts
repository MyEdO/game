/**
 * Sérialisation des datasets app-owned, FIDÈLE au format sur disque — pour l'écriture par l'éditeur
 * de données in-app (File System Access API). Un round-trip (lire → parser → sérialiser) doit être
 * byte-identique au fichier d'origine, sinon chaque sauvegarde reformaterait tout le dataset.
 * Voir `serialize.test.ts` (garde-fou sur les vrais fichiers `src/data/*.json`).
 */

/** Indentation et fin de fichier du format canonique sur disque des datasets app-owned
 *  (`JSON.stringify(data, null, 2)`, sans newline final). */
export function serializeDataset(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
