/**
 * LES DOSSIERS ÉPINGLÉS DU PROJET GODOT (#3476) : les textures du sol (`projet/textures/`, lot E), le kit des arêtes
 * (`projet/kit/`, lot C) et les sons (`projet/sons/`, #3771) vivent, comme les modèles (`./release.ts`, #2948), dans la Release `TAG`, chaque fichier
 * nommé par son SHA-256. Le dépôt commite la provenance de chaque dossier (`provenance.json`) : par fichier, son
 * empreinte (`sha256`), sa source et sa licence. `recupererEpingles` dépose au projet chaque fichier qui y manque, du
 * cache ou de la Release ; `epinglesAPublier` nomme ce que `publierAssets` y verse.
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMPREINTE, sha256 } from './empreinte.ts';
import { estObjet } from '../../../src/lib/objet.mjs';
import { DOSSIER_DU_KIT } from './kit.ts';
import {
  CACHE_DES_MODELES,
  EXTENSIONS_D_ASSET,
  enCacheOuTire,
  nomDAsset,
  tirerDeLaRelease,
  type AssetAPublier,
  type FichierEpingle,
  type Telecharger,
} from './release.ts';

/** Le dossier épinglé des sons du projet Godot (`res://sons/`). */
export const DOSSIER_DES_SONS = fileURLToPath(new URL('../projet/sons', import.meta.url));

/** Les dossiers épinglés du projet Godot : ses textures (`res://textures/`), son kit des arêtes (`res://kit/`) et ses
 *  sons. */
const DOSSIERS_EPINGLES = [fileURLToPath(new URL('../projet/textures', import.meta.url)), DOSSIER_DU_KIT, DOSSIER_DES_SONS];

/** Un fichier épinglé et l'extension de son asset dans la Release. */
type Epingle = FichierEpingle & { readonly extension: (typeof EXTENSIONS_D_ASSET)[number] };

/** Les fichiers que la provenance de `dossier` épingle, ou lève sur la première entrée sans SHA-256 ou d'une extension
 *  que la Release ne porte pas (`EXTENSIONS_D_ASSET`). */
export function fichiersEpingles(dossier: string): Epingle[] {
  const provenance: unknown = JSON.parse(readFileSync(join(dossier, 'provenance.json'), 'utf8'));
  if (!estObjet(provenance)) throw new Error(`${dossier}/provenance.json : objet attendu`);
  return Object.entries(provenance).map(([fichier, entree]) => {
    const empreinte = estObjet(entree) ? entree.sha256 : undefined;
    if (typeof empreinte !== 'string' || !EMPREINTE.test(empreinte)) throw new Error(`${dossier}/provenance.json : ${fichier}.sha256 « ${String(empreinte)} » n'est pas un SHA-256`);
    const extension = EXTENSIONS_D_ASSET.find((e) => `.${e}` === extname(fichier));
    if (!extension) throw new Error(`${dossier}/provenance.json : ${fichier} n'a pas une extension de la Release (${EXTENSIONS_D_ASSET.join(', ')})`);
    return { fichier, empreinte, extension };
  });
}

/** Dépose dans chacun des `dossiers` chaque fichier épinglé et le garde dans le cache `cache` : celui du dossier s'il a
 *  la somme épinglée, sinon celui du cache, sinon tiré de la Release ; vérifié par sa somme, écrit au cache
 *  atomiquement (`enCacheOuTire`), d'où il se copie : une copie coupée n'a pas la somme, et se refait à l'appel
 *  suivant. */
export async function recupererEpingles({ dossiers = DOSSIERS_EPINGLES, cache = CACHE_DES_MODELES, telecharger = fetch, journal = console.log }: {
  dossiers?: readonly string[];
  cache?: string;
  telecharger?: Telecharger;
  journal?: (ligne: string) => void;
}): Promise<void> {
  for (const dossier of dossiers) {
    const epingles = fichiersEpingles(dossier);
    for (const epingle of epingles) {
      const enCache = join(cache, nomDAsset(epingle.empreinte, epingle.extension));
      const auProjet = join(dossier, epingle.fichier);
      const duProjet = existsSync(auProjet) && sha256(readFileSync(auProjet)) === epingle.empreinte;
      await enCacheOuTire(enCache, epingle.empreinte, epingle.fichier, async () => (duProjet ? readFileSync(auProjet) : tirerDeLaRelease(epingle, epingle.extension, telecharger, journal)));
      if (!duProjet) copyFileSync(enCache, auProjet);
    }
    journal(`[épinglés] ${dossier} : ${epingles.length} fichier(s) vérifiés (SHA-256), cache ${cache}`);
  }
}

/** Les fichiers des `dossiers` à verser dans la Release, chacun sous le nom de son empreinte. */
export const epinglesAPublier = (dossiers: readonly string[] = DOSSIERS_EPINGLES): AssetAPublier[] =>
  dossiers.flatMap((dossier) => fichiersEpingles(dossier).map((e) => ({ chemin: join(dossier, e.fichier), nom: nomDAsset(e.empreinte, e.extension) })));
