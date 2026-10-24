/**
 * LES MODÈLES 3D EN RELEASE (#2948) : un GLB
 * et sa source `.blend` ne vivent pas dans git, mais comme fichiers de la Release `TAG` du dépôt, nommés par leur
 * SHA-256. Le dépôt commite, par modèle, le manifeste (`<id>.manifeste.json`) et la provenance (`<id>.provenance.json`),
 * qui porte l'empreinte. `recupererModeles` tire de la Release le GLB qui manque dans le cache, le vérifie et le dépose
 * sous le nom que le projet Godot attend ; `publierAssets` y verse ceux qui n'y sont pas.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecrireTexteAtomique } from '../../../scripts/guards/lib/ecritureJsonAtomique.mjs';
import { sha256 } from './empreinte.ts';
import { lireGlb } from './glb.ts';
import { estObjet, ligneDErreur, validerManifeste } from './manifeste.ts';

/** Le dépôt dont la Release porte les modèles. */
export const DEPOT = 'MyEdO/game';

/** La Release unique des modèles : ses fichiers sont nommés par leur contenu, une version par tag n'ajouterait rien. */
export const TAG = 'modeles-3d';

/** Le cache des fichiers tirés de la Release, hors de l'arbre : la CI le met en cache sous ce chemin (`ci.yml`). */
export const CACHE_DES_MODELES = join(homedir(), '.cache', 'wfrp-modeles-3d');

/** Lève, au nom de `nom`, si la somme de `octets` n'est pas `attendue`. */
export function verifierSomme(nom: string, octets: Uint8Array, attendue: string): void {
  const somme = sha256(octets);
  if (somme !== attendue) throw new Error(`${nom} : SHA-256 ${somme}, ${attendue} attendue`);
}

/** La somme SHA-256 du fichier `chemin`, ou `null` s'il est absent. */
const sommeDuFichier = (chemin: string): string | null => (existsSync(chemin) ? sha256(readFileSync(chemin)) : null);

/** Le fichier `chemin` gardé s'il a la somme `attendue` ; sinon les octets de `tirer()`, vérifiés au nom de `nom`
 *  (`verifierSomme`), écrits atomiquement sous `chemin` (`ecrireTexteAtomique`). */
export async function enCacheOuTire(chemin: string, attendue: string, nom: string, tirer: () => Promise<Uint8Array>): Promise<void> {
  if (sommeDuFichier(chemin) === attendue) return;
  const octets = await tirer();
  verifierSomme(nom, octets, attendue);
  ecrireTexteAtomique(chemin, octets);
}

/** Le nom, dans la Release, du fichier d'empreinte `empreinte`. */
export const nomDAsset = (empreinte: string, extension: 'glb' | 'blend'): string => `${empreinte}.${extension}`;

/** L'URL publique du fichier `nom` de la Release. */
export const urlDAsset = (nom: string): string => `https://github.com/${DEPOT}/releases/download/${TAG}/${nom}`;

/** Le dossier des modèles du projet Godot : l'import y dépose, `recupererModeles` y tire les GLB. */
export const DOSSIER_DES_MODELES = fileURLToPath(new URL('../projet/modeles', import.meta.url));

/** Les fichiers du modèle `id` dans le projet : le GLB (tiré de la Release, ignoré de git), le manifeste et la provenance (commités). */
export const fichiersDuModele = (id: string) => ({ glb: `${id}.glb`, manifeste: `${id}.manifeste.json`, provenance: `${id}.provenance.json` });

/** La licence d'un composant, telle que la production la déclare dans `components.<id>.asset`. */
export interface LicenceDeComposant {
  /** `license_basis` : sur quoi la production fonde la licence. */
  readonly base: string;
  /** La valeur des lignes `# license` de `explicit_header`, l'en-tête du fichier source. */
  readonly en_tete: readonly string[];
  /** `packs[].announced_license` : la licence que la page du pack annonce. */
  readonly annoncees: readonly string[];
}

/** La licence d'un pack, lue sur la ligne `License:` d'un fichier `LICENSE*.txt` du dossier de production. */
export interface LicenceDePack {
  /** Le nom du texte déposé, dérivé de son identifiant SPDX et de son empreinte (`importer.ts`). */
  readonly fichier: string;
  readonly licence: string;
}

/** La provenance commitée d'un modèle (`fichiersDuModele(id).provenance`). */
export interface Provenance {
  readonly model: string;
  readonly model_sha256: string;
  /** L'empreinte de la source `.blend`, versée dans la Release à côté du GLB, si la production en livre une. */
  readonly source_sha256?: string;
  readonly importe_le: string;
  readonly licences: Readonly<Record<string, LicenceDeComposant>>;
  readonly licences_de_pack: readonly LicenceDePack[];
  readonly animation_sources: readonly { readonly fichier: string; readonly sha256: string }[];
}

const EMPREINTE = /^[0-9a-f]{64}$/;

/** Les ids des fichiers de `fichiers` qui portent le nom `nom` de `fichiersDuModele`. */
const idsPar = (fichiers: readonly string[], nom: 'manifeste' | 'provenance'): Set<string> => {
  const suffixe = fichiersDuModele('')[nom];
  return new Set(fichiers.filter((f) => f.endsWith(suffixe)).map((f) => f.slice(0, -suffixe.length)));
};

/** Le JSON du fichier `chemin`, ou l'écart qui nomme le fichier illisible. */
function lireJsonNomme(chemin: string, nom: string): { readonly valeur: unknown } | { readonly erreur: string } {
  try {
    return { valeur: JSON.parse(readFileSync(chemin, 'utf8')) };
  } catch (e) {
    return { erreur: `${nom} : JSON illisible (${(e as Error).message})` };
  }
}

/** Un modèle que sa provenance épingle : le nom de son GLB dans le projet, son empreinte. */
export interface ModeleEpingle {
  readonly id: string;
  readonly model: string;
  readonly empreinte: string;
}

/** Les modèles du dossier `dossier`, épinglés par leur provenance, ou les écarts : un manifeste sans provenance, une
 *  provenance sans manifeste, une provenance illisible, un `model` autre que `<id>.glb`, une empreinte qui n'est pas
 *  un SHA-256. */
export function modelesEpingles(dossier: string): { readonly modeles: readonly ModeleEpingle[]; readonly erreurs: readonly string[] } {
  const fichiers = readdirSync(dossier).sort();
  const manifestes = idsPar(fichiers, 'manifeste');
  const provenances = idsPar(fichiers, 'provenance');
  const erreurs = [
    ...[...manifestes].filter((id) => !provenances.has(id)).map((id) => `${fichiersDuModele(id).manifeste} : provenance ${fichiersDuModele(id).provenance} absente`),
    ...[...provenances].filter((id) => !manifestes.has(id)).map((id) => `${fichiersDuModele(id).provenance} : manifeste ${fichiersDuModele(id).manifeste} absent`),
  ];
  const modeles: ModeleEpingle[] = [];
  for (const id of provenances) {
    const f = fichiersDuModele(id);
    const lu = lireJsonNomme(join(dossier, f.provenance), f.provenance);
    if ('erreur' in lu) {
      erreurs.push(lu.erreur);
      continue;
    }
    const p = estObjet(lu.valeur) ? lu.valeur : {};
    if (p.model !== f.glb) erreurs.push(`${f.provenance} : model « ${String(p.model)} », ${f.glb} attendu`);
    else if (typeof p.model_sha256 !== 'string' || !EMPREINTE.test(p.model_sha256)) erreurs.push(`${f.provenance} : model_sha256 « ${String(p.model_sha256)} » n'est pas un SHA-256`);
    else modeles.push({ id, model: f.glb, empreinte: p.model_sha256 });
  }
  return { modeles, erreurs };
}

/** Un modèle absent de la Release : elle répond 404 sur son empreinte. */
export class ModeleIntrouvable extends Error {
  constructor(modele: ModeleEpingle, url: string) {
    super(`${modele.model} (${modele.empreinte}) : HTTP 404 sur ${url}, absent de la Release ${TAG} de ${DEPOT}`);
    this.name = 'ModeleIntrouvable';
  }
}

/** Une Release qui ne répond pas : réseau coupé, ou tout statut HTTP autre que 404. */
export class ReleaseInjoignable extends Error {
  constructor(modele: ModeleEpingle, url: string, raison: string) {
    super(`${modele.model} (${modele.empreinte}) : Release ${TAG} de ${DEPOT} injoignable sur ${url} (${raison})`);
    this.name = 'ReleaseInjoignable';
  }
}

type Telecharger = (url: string) => Promise<{ readonly ok: boolean; readonly status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

/** Les octets du GLB de `modele` tirés de la Release : `ModeleIntrouvable` sur un 404, `ReleaseInjoignable` sur une
 *  erreur réseau, avant ou pendant le corps de la réponse, ou tout autre statut. */
async function tirerDeLaRelease(modele: ModeleEpingle, telecharger: Telecharger, journal: (ligne: string) => void): Promise<Uint8Array> {
  const url = urlDAsset(nomDAsset(modele.empreinte, 'glb'));
  journal(`[modèles] ${modele.model} : téléchargement de ${url}`);
  let reponse: Awaited<ReturnType<Telecharger>>;
  try {
    reponse = await telecharger(url);
  } catch (e) {
    throw new ReleaseInjoignable(modele, url, (e as Error).message);
  }
  if (reponse.status === 404) throw new ModeleIntrouvable(modele, url);
  if (!reponse.ok) throw new ReleaseInjoignable(modele, url, `HTTP ${reponse.status}`);
  try {
    return new Uint8Array(await reponse.arrayBuffer());
  } catch (e) {
    throw new ReleaseInjoignable(modele, url, `corps de la réponse interrompu : ${(e as Error).message}`);
  }
}

/** Dépose dans `dossier` le GLB de chaque modèle épinglé et le garde dans le cache `cache` : le GLB du projet s'il a
 *  la somme épinglée (le cache s'en amorce), sinon celui du cache, sinon tiré de la Release ; tout fichier se vérifie
 *  par sa somme et s'écrit atomiquement. Chaque manifeste se valide ensuite contre son GLB. Lève à la première
 *  provenance fausse, au premier fichier introuvable ou de somme fausse, au premier manifeste refusé. */
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
    const dansLeProjet = join(dossier, modele.model);
    const duProjet = sommeDuFichier(dansLeProjet) === modele.empreinte;
    await enCacheOuTire(enCache, modele.empreinte, modele.model, async () => (duProjet ? readFileSync(dansLeProjet) : tirerDeLaRelease(modele, telecharger, journal)));
    if (!duProjet) ecrireTexteAtomique(dansLeProjet, readFileSync(enCache));
    const manifeste = fichiersDuModele(modele.id).manifeste;
    const lu = lireJsonNomme(join(dossier, manifeste), manifeste);
    if ('erreur' in lu) throw new Error(lu.erreur);
    const verdict = validerManifeste(lu.valeur, lireGlb(readFileSync(dansLeProjet)));
    if (!verdict.ok) throw new Error(`${manifeste} refusé contre ${modele.model} :\n  ${verdict.erreurs.map(ligneDErreur).join('\n  ')}`);
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
