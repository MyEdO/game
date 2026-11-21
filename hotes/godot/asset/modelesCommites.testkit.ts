import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fichiersDuModele } from './modeles.ts';
import { CACHE_DES_MODELES, DOSSIER_DES_MODELES, recupererModeles, type ModeleEpingle } from './release.ts';

/** Prépare les modèles épinglés du projet sous un dossier de test, disponible jusqu'au retour de `lire`. */
export async function avecModelesCommites<T>(
  lire: (dossier: string, modeles: readonly ModeleEpingle[]) => T | Promise<T>,
  { source = DOSSIER_DES_MODELES, cache = CACHE_DES_MODELES } = {},
): Promise<T> {
  const dossier = mkdtempSync(join(tmpdir(), 'modeles-commites-'));
  try {
    const { manifeste, provenance, glb } = fichiersDuModele('');
    const noms = new Set(readdirSync(source));
    for (const nom of noms) {
      const estMetadata = nom.endsWith(manifeste) || nom.endsWith(provenance);
      const glbDuManifeste = nom.endsWith(glb) && noms.has(fichiersDuModele(nom.slice(0, -glb.length)).manifeste);
      if (estMetadata || glbDuManifeste) copyFileSync(join(source, nom), join(dossier, nom));
    }
    const modeles = await recupererModeles({ dossier, cache, journal: () => {} });
    return await lire(dossier, modeles);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}
