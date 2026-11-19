/**
 * LE REJEU DES TEXTURES ÉPINGLÉES (#4527) : chaque texture du catalogue (`projet/textures/`, `epingles.ts`) se
 * refabrique depuis sa source CC0 par le traitement que sa provenance consigne. La provenance est la seule recette :
 * `source` nomme la page, l'archive et le fichier pris, ou la texture du catalogue dont elle dérive (« ; dérivée de
 * <fichier> ») ; `traitement` porte les arguments d'ImageMagick, entre l'image lue et l'image écrite. Les octets
 * rendus dépendent de la version d'ImageMagick et de sa libjpeg, que `versionDImageMagick` dit à chaque rejeu : une
 * texture est reproduite quand ses pixels sont ceux de l'épinglée (`verdictDuRejeu`).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './empreinte.ts';
import type { Telecharger } from './release.ts';

/** Le dossier épinglé des textures du projet Godot (`res://textures/`). */
export const DOSSIER_DES_TEXTURES = fileURLToPath(new URL('../projet/textures', import.meta.url));

/** Le cache des sources téléchargées, hors de l'arbre. */
export const CACHE_DES_SOURCES = join(homedir(), '.cache', 'wfrp-sources-de-textures');

/** L'entrée de provenance d'une texture épinglée. */
export interface ProvenanceDeTexture {
  readonly sha256: string;
  readonly source: string;
  readonly licence: string;
  readonly traitement: string;
}

/** D'où vient l'image que le traitement lit : une texture du catalogue, ou un fichier téléchargé, seul ou pris dans
 *  une archive. */
export type Origine =
  | { readonly deriveeDe: string }
  | { readonly url: string; readonly fichier: string; readonly archive?: string };

const DERIVEE = / ; dérivée de ([\w.-]+\.jpg)$/;
const AMBIENTCG = /^https:\/\/ambientcg\.com\/view\?id=\w+ \(([\w-]+\.zip) : ([\w-]+\.jpg)\)$/;
const POLYHAVEN = /^https:\/\/polyhaven\.com\/a\/(\w+) \((\w+_1k\.jpg), [^()]+\)$/;

/** L'origine que nomme la `source` d'une provenance, ou lève sur une forme qu'aucun site connu ne porte. */
export function origineDe(source: string): Origine {
  const derivee = DERIVEE.exec(source);
  if (derivee) return { deriveeDe: derivee[1] as string };
  const ambientcg = AMBIENTCG.exec(source);
  if (ambientcg) return { url: `https://ambientcg.com/get?file=${ambientcg[1]}`, archive: ambientcg[1] as string, fichier: ambientcg[2] as string };
  const polyhaven = POLYHAVEN.exec(source);
  if (polyhaven) return { url: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${polyhaven[1]}/${polyhaven[2]}`, fichier: polyhaven[2] as string };
  throw new Error(`source « ${source} » : ni ambientCG « <page> (<archive>.zip : <fichier>.jpg) », ni Poly Haven « <page> (<fichier>_1k.jpg, <auteur>) », ni « … ; dérivée de <fichier>.jpg »`);
}

const IMAGEMAGICK = 'ImageMagick : ';

/** Les arguments d'ImageMagick que consigne `traitement`, ou lève s'il n'en est pas un. */
export function argumentsDeTraitement(traitement: string): string[] {
  if (!traitement.startsWith(IMAGEMAGICK)) throw new Error(`traitement « ${traitement} » : « ${IMAGEMAGICK}<arguments> » attendu`);
  return traitement.slice(IMAGEMAGICK.length).split(' ');
}

/** La sortie de `commande args`, ou lève sur son échec. */
function executer(commande: string, args: readonly string[]): string {
  const execution = spawnSync(commande, args, { encoding: 'utf8' });
  if (execution.error) throw new Error(`${commande} : ${execution.error.message}`);
  if (execution.status !== 0) throw new Error(`${commande} ${args.join(' ')} : code de sortie ${execution.status}\n${execution.stderr}`);
  return execution.stdout;
}

/** La version de l'ImageMagick du poste, première ligne de `convert -version`. */
export const versionDImageMagick = (): string => executer('convert', ['-version']).split('\n')[0] as string;

/** Vrai si les images `a` et `b` décodent aux mêmes pixels (`compare -metric AE` : 0 égales, 1 différentes). */
export function memesPixels(a: string, b: string): boolean {
  const comparaison = spawnSync('compare', ['-metric', 'AE', a, b, 'null:'], { encoding: 'utf8' });
  if (comparaison.error) throw new Error(`compare : ${comparaison.error.message}`);
  if (comparaison.status !== 0 && comparaison.status !== 1) throw new Error(`compare ${a} ${b} : code de sortie ${comparaison.status}\n${comparaison.stderr}`);
  return comparaison.status === 0;
}

/** Ce qu'un rejeu dit d'une texture : ses octets sont ceux de l'épinglée, ses pixels seuls le sont (un autre encodeur
 *  JPEG), ou elle en diffère. */
export type VerdictDuRejeu = 'octets' | 'pixels' | 'differente';

/** Le verdict de la texture rejouée dans `rejouee`, de somme `somme`, contre l'épinglée de somme `epinglee` déposée
 *  dans `deposee` : sans les mêmes octets, ses pixels se comparent (`pixels`) à ceux du fichier déposé, s'il a la somme
 *  épinglée. */
export function verdictDuRejeu(somme: string, epinglee: string, rejouee: string, deposee: string, pixels: (a: string, b: string) => boolean = memesPixels): VerdictDuRejeu {
  if (somme === epinglee) return 'octets';
  const depose = existsSync(deposee) && sha256(readFileSync(deposee)) === epinglee;
  return depose && pixels(rejouee, deposee) ? 'pixels' : 'differente';
}

/** Le chemin, dans le cache `cache`, du fichier source d'`origine` : téléchargé s'il y manque, sorti de son archive. */
async function sourceEnCache(origine: Exclude<Origine, { deriveeDe: string }>, cache: string, telecharger: Telecharger): Promise<string> {
  const fichier = join(cache, origine.fichier);
  if (existsSync(fichier)) return fichier;
  mkdirSync(cache, { recursive: true });
  const reponse = await telecharger(origine.url);
  if (!reponse.ok) throw new Error(`${origine.url} : HTTP ${reponse.status}`);
  const tire = join(cache, origine.archive ?? `${origine.fichier}.partiel`);
  writeFileSync(tire, new Uint8Array(await reponse.arrayBuffer()));
  if (origine.archive) executer('unzip', ['-o', '-q', tire, origine.fichier, '-d', cache]);
  else renameSync(tire, fichier);
  return fichier;
}

/** Refabrique dans `sortie` les textures `noms` de `provenance`, et celles dont elles dérivent, chacune après celle
 *  qu'elle lit ; rend la somme SHA-256 de chaque fichier écrit. Lève sur un nom que la provenance n'épingle pas. */
export async function rejouerLesTextures(noms: readonly string[], provenance: Readonly<Record<string, ProvenanceDeTexture>>, sortie: string, { cache = CACHE_DES_SOURCES, telecharger = fetch }: { cache?: string; telecharger?: Telecharger } = {}): Promise<Map<string, string>> {
  const sommes = new Map<string, string>();
  const rejouer = async (nom: string): Promise<string> => {
    const ecrit = join(sortie, nom);
    if (sommes.has(nom)) return ecrit;
    const entree = provenance[nom];
    if (!entree) throw new Error(`${nom} : absent de la provenance des textures`);
    const origine = origineDe(entree.source);
    const lu = 'deriveeDe' in origine ? await rejouer(origine.deriveeDe) : await sourceEnCache(origine, cache, telecharger);
    executer('convert', [lu, ...argumentsDeTraitement(entree.traitement), ecrit]);
    sommes.set(nom, sha256(readFileSync(ecrit)));
    return ecrit;
  };
  for (const nom of noms) await rejouer(nom);
  return sommes;
}

/** Inscrit à la provenance du dossier `dossier` la somme de chaque texture de `sommes`, l'ordre des entrées gardé. */
export function epinglerLesSommes(sommes: ReadonlyMap<string, string>, dossier = DOSSIER_DES_TEXTURES): void {
  const chemin = join(dossier, 'provenance.json');
  const provenance = JSON.parse(readFileSync(chemin, 'utf8')) as Record<string, ProvenanceDeTexture>;
  for (const [nom, somme] of sommes) provenance[nom] = { ...(provenance[nom] as ProvenanceDeTexture), sha256: somme };
  writeFileSync(chemin, `${JSON.stringify(provenance, null, 2)}\n`);
}
