/**
 * LES TEXTURES DU SOL EN RELEASE (#3476, lot E) : chaque JPG du dossier des textures du projet Godot vit, comme les
 * modèles (`./release.ts`, #2948), dans la Release `TAG`, nommé par son SHA-256. Le dépôt commite la provenance du
 * dossier (`provenance.json`) : par matière, sa source, sa licence, et l'empreinte de sa couleur (`<matière>.jpg`) et de
 * son relief (`<matière>.normale.jpg`). `recupererTextures` dépose au projet chaque fichier qui y manque, du cache ou de
 * la Release ; `texturesAPublier` nomme ce que `publierAssets` y verse.
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMPREINTE, sha256 } from './empreinte.ts';
import { estObjet } from '../../../src/hote/formes';
import { CACHE_DES_MODELES, enCacheOuTire, nomDAsset, tirerDeLaRelease, type AssetAPublier, type FichierEpingle, type Telecharger } from './release.ts';

/** Le dossier des textures du projet Godot (`res://textures/`, `projet/scripts/monde.gd`). */
const DOSSIER_DES_TEXTURES = fileURLToPath(new URL('../projet/textures', import.meta.url));

/** Le fichier de chaque face d'une matière : sa couleur et son relief. */
const FACES = { couleur: '.jpg', normale: '.normale.jpg' } as const;

/** Les fichiers que la provenance de `dossier` épingle, ou lève sur la première entrée qui n'épingle pas ses deux faces. */
export function texturesEpinglees(dossier: string): FichierEpingle[] {
  const provenance: unknown = JSON.parse(readFileSync(join(dossier, 'provenance.json'), 'utf8'));
  if (!estObjet(provenance)) throw new Error('provenance.json : objet attendu');
  return Object.entries(provenance).flatMap(([matiere, entree]) =>
    Object.entries(FACES).map(([face, suffixe]) => {
      const empreinte = estObjet(entree) && estObjet(entree[face]) ? entree[face].sha256 : undefined;
      if (typeof empreinte !== 'string' || !EMPREINTE.test(empreinte)) throw new Error(`provenance.json : ${matiere}.${face}.sha256 « ${String(empreinte)} » n'est pas un SHA-256`);
      return { fichier: `${matiere}${suffixe}`, empreinte };
    }),
  );
}

/** Dépose dans `dossier` chaque texture épinglée et la garde dans le cache `cache` : celle du dossier si elle a la somme
 *  épinglée, sinon celle du cache, sinon tirée de la Release ; vérifiée par sa somme, écrite au cache atomiquement
 *  (`enCacheOuTire`), d'où elle se copie : une copie coupée n'a pas la somme, et se refait à l'appel suivant. */
export async function recupererTextures({ dossier = DOSSIER_DES_TEXTURES, cache = CACHE_DES_MODELES, telecharger = fetch, journal = console.log }: {
  dossier?: string;
  cache?: string;
  telecharger?: Telecharger;
  journal?: (ligne: string) => void;
}): Promise<void> {
  const textures = texturesEpinglees(dossier);
  for (const texture of textures) {
    const enCache = join(cache, nomDAsset(texture.empreinte, 'jpg'));
    const auProjet = join(dossier, texture.fichier);
    const duProjet = existsSync(auProjet) && sha256(readFileSync(auProjet)) === texture.empreinte;
    await enCacheOuTire(enCache, texture.empreinte, texture.fichier, async () => (duProjet ? readFileSync(auProjet) : tirerDeLaRelease(texture, 'jpg', telecharger, journal)));
    if (!duProjet) copyFileSync(enCache, auProjet);
  }
  journal(`[textures] ${textures.length} fichier(s) vérifiés (SHA-256), cache ${cache}`);
}

/** Les textures de `dossier` (défaut : celui du projet) à verser dans la Release, chacune sous le nom de son empreinte. */
export const texturesAPublier = (dossier = DOSSIER_DES_TEXTURES): AssetAPublier[] =>
  texturesEpinglees(dossier).map((t) => ({ chemin: join(dossier, t.fichier), nom: nomDAsset(t.empreinte, 'jpg') }));

