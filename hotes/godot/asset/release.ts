/**
 * LES MODÈLES 3D EN RELEASE (#2948) : un GLB
 * et sa source `.blend` ne vivent pas dans git, mais comme fichiers de la Release `TAG` du dépôt, nommés par leur
 * SHA-256. Le dépôt commite, par modèle, le manifeste (`<id>.manifeste.json`) et la provenance (`<id>.provenance.json`),
 * qui porte l'empreinte. `recupererModeles` tire de la Release le GLB qui manque dans le cache, le vérifie et le dépose
 * sous le nom que le projet Godot attend ; `publierAssets` y verse ceux qui n'y sont pas.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { lireGlb } from './glb.ts';
import { ligneDErreur, validerManifeste } from './manifeste.ts';

/** Le dépôt dont la Release porte les modèles. */
export const DEPOT = 'MyEdO/game';

/** La Release unique des modèles : ses fichiers sont nommés par leur contenu, une version par tag n'ajouterait rien. */
export const TAG = 'modeles-3d';

/** Le cache des fichiers tirés de la Release, hors de l'arbre : la CI le met en cache sous ce chemin (`ci.yml`). */
export const CACHE_DES_MODELES = join(homedir(), '.cache', 'wfrp-modeles-3d');

/** La somme SHA-256 de `octets`, hexadécimale. */
export const sha256 = (octets: Uint8Array): string => createHash('sha256').update(octets).digest('hex');

/** Le nom, dans la Release, du fichier d'empreinte `empreinte`. */
export const nomDAsset = (empreinte: string, extension: 'glb' | 'blend'): string => `${empreinte}.${extension}`;

/** L'URL publique du fichier `nom` de la Release. */
export const urlDAsset = (nom: string): string => `https://github.com/${DEPOT}/releases/download/${TAG}/${nom}`;

const SUFFIXE_MANIFESTE = '.manifeste.json';
const SUFFIXE_PROVENANCE = '.provenance.json';
const EMPREINTE = /^[0-9a-f]{64}$/;

/** Un modèle que sa provenance épingle : le nom de son GLB dans le projet, son empreinte. */
export interface ModeleEpingle {
  readonly id: string;
  readonly model: string;
  readonly empreinte: string;
}

/** Les modèles du dossier `dossier`, épinglés par leur provenance, ou les écarts : un manifeste sans provenance, une
 *  provenance sans manifeste, un `model` autre que `<id>.glb`, une empreinte qui n'est pas un SHA-256. */
export function modelesEpingles(dossier: string): { readonly modeles: readonly ModeleEpingle[]; readonly erreurs: readonly string[] } {
  const fichiers = readdirSync(dossier).sort();
  const ids = (suffixe: string) => new Set(fichiers.filter((f) => f.endsWith(suffixe)).map((f) => f.slice(0, -suffixe.length)));
  const manifestes = ids(SUFFIXE_MANIFESTE);
  const provenances = ids(SUFFIXE_PROVENANCE);
  const erreurs = [
    ...[...manifestes].filter((id) => !provenances.has(id)).map((id) => `${id}${SUFFIXE_MANIFESTE} : provenance ${id}${SUFFIXE_PROVENANCE} absente`),
    ...[...provenances].filter((id) => !manifestes.has(id)).map((id) => `${id}${SUFFIXE_PROVENANCE} : manifeste ${id}${SUFFIXE_MANIFESTE} absent`),
  ];
  const modeles: ModeleEpingle[] = [];
  for (const id of provenances) {
    const p = JSON.parse(readFileSync(join(dossier, `${id}${SUFFIXE_PROVENANCE}`), 'utf8')) as { model?: unknown; model_sha256?: unknown };
    if (p.model !== `${id}.glb`) erreurs.push(`${id}${SUFFIXE_PROVENANCE} : model « ${String(p.model)} », ${id}.glb attendu`);
    else if (typeof p.model_sha256 !== 'string' || !EMPREINTE.test(p.model_sha256)) erreurs.push(`${id}${SUFFIXE_PROVENANCE} : model_sha256 « ${String(p.model_sha256)} » n'est pas un SHA-256`);
    else modeles.push({ id, model: p.model, empreinte: p.model_sha256 });
  }
  return { modeles, erreurs };
}

/** Un modèle absent de la Release, ou dont la Release ne répond pas. */
export class ModeleIntrouvable extends Error {
  constructor(modele: ModeleEpingle, raison: string) {
    super(`${modele.model} (${modele.empreinte}) : ${raison}, absent de la Release ${TAG} de ${DEPOT}`);
    this.name = 'ModeleIntrouvable';
  }
}

type Telecharger = (url: string) => Promise<{ readonly ok: boolean; readonly status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

/** Dépose dans `dossier` le GLB de chaque modèle épinglé : celui du cache `cache` si sa somme est l'épinglée, sinon tiré
 *  de la Release et vérifié. Chaque manifeste se valide ensuite contre son GLB. Lève à la première provenance fausse,
 *  au premier fichier introuvable ou de somme fausse, au premier manifeste refusé. */
export async function recupererModeles({ dossier, cache = CACHE_DES_MODELES, telecharger = fetch, journal = console.log }: {
  dossier: string;
  cache?: string;
  telecharger?: Telecharger;
  journal?: (ligne: string) => void;
}): Promise<readonly ModeleEpingle[]> {
  const { modeles, erreurs } = modelesEpingles(dossier);
  if (erreurs.length) throw new Error(`modèles mal épinglés :\n  ${erreurs.join('\n  ')}`);
  for (const modele of modeles) {
    const enCache = join(cache, nomDAsset(modele.empreinte, 'glb'));
    if (!existsSync(enCache) || sha256(readFileSync(enCache)) !== modele.empreinte) {
      const url = urlDAsset(nomDAsset(modele.empreinte, 'glb'));
      journal(`[modèles] ${modele.model} : téléchargement de ${url}`);
      const reponse = await telecharger(url);
      if (!reponse.ok) throw new ModeleIntrouvable(modele, `HTTP ${reponse.status} sur ${url}`);
      const octets = new Uint8Array(await reponse.arrayBuffer());
      const somme = sha256(octets);
      if (somme !== modele.empreinte) throw new ModeleIntrouvable(modele, `le fichier reçu a la somme ${somme}`);
      mkdirSync(cache, { recursive: true });
      writeFileSync(enCache, octets);
    }
    const dansLeProjet = join(dossier, modele.model);
    if (!existsSync(dansLeProjet) || sha256(readFileSync(dansLeProjet)) !== modele.empreinte) copyFileSync(enCache, dansLeProjet);
    const verdict = validerManifeste(JSON.parse(readFileSync(join(dossier, `${modele.id}${SUFFIXE_MANIFESTE}`), 'utf8')), lireGlb(readFileSync(dansLeProjet)));
    if (!verdict.ok) throw new Error(`${modele.id}${SUFFIXE_MANIFESTE} refusé contre ${modele.model} :\n  ${verdict.erreurs.map(ligneDErreur).join('\n  ')}`);
  }
  journal(`[modèles] ${modeles.map((m) => m.model).join(', ')} : vérifiés (SHA-256), manifestes validés, cache ${cache}`);
  return modeles;
}

/** Un fichier à verser dans la Release : son chemin local, son nom d'asset (`nomDAsset`). */
export interface AssetAPublier {
  readonly chemin: string;
  readonly nom: string;
}

/** Lance `gh` avec `args` : son code de sortie et ses sorties. */
export type Gh = (args: readonly string[]) => { readonly status: number | null; readonly stdout: string; readonly stderr: string };

const ghReel: Gh = (args) => {
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: 600_000 });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? '', stderr: r.error ? r.error.message : (r.stderr ?? '') };
};

/** Verse dans la Release `TAG` (créée au premier appel, en préversion) les `assets` qu'elle ne porte pas encore. Rend les
 *  noms versés ; lève, avec la sortie de `gh`, à son premier échec. */
export function publierAssets(assets: readonly AssetAPublier[], gh: Gh = ghReel): readonly string[] {
  const appeler = (args: readonly string[]) => {
    const r = gh(args);
    if (r.status !== 0) throw new Error(`gh ${args.join(' ')} : code ${String(r.status)}\n${r.stderr.trim()}`);
    return r.stdout;
  };
  const vue = gh(['release', 'view', TAG, '--repo', DEPOT, '--json', 'assets']);
  let presents: Set<string>;
  if (vue.status === 0) presents = new Set((JSON.parse(vue.stdout) as { assets: { name: string }[] }).assets.map((a) => a.name));
  else if (/release not found/i.test(vue.stderr)) {
    appeler(['release', 'create', TAG, '--repo', DEPOT, '--prerelease', '--latest=false', '--title', 'Modèles 3D', '--notes', 'Modèles 3D du projet Godot, nommés par leur SHA-256 (#2948). Chaque fichier est épinglé par la provenance commitée hotes/godot/projet/modeles/<id>.provenance.json.']);
    presents = new Set();
  } else throw new Error(`gh release view ${TAG} : code ${String(vue.status)}\n${vue.stderr.trim()}`);
  const aVerser = assets.filter((a) => !presents.has(a.nom));
  if (!aVerser.length) return [];
  const etape = mkdtempSync(join(tmpdir(), 'wfrp-modeles-3d-'));
  try {
    const chemins = aVerser.map((a) => {
      const copie = join(etape, a.nom);
      copyFileSync(a.chemin, copie);
      return copie;
    });
    appeler(['release', 'upload', TAG, '--repo', DEPOT, ...chemins]);
  } finally {
    rmSync(etape, { recursive: true, force: true });
  }
  return aVerser.map((a) => a.nom);
}
