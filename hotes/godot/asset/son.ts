/**
 * L'ÉPINGLAGE D'UN SON (#3805) : un fichier audio sous licence CC0, converti par `ffmpeg` au format des sons du projet
 * (Ogg Vorbis mono, 44,1 kHz, qualité 4), déposé dans le dossier épinglé des sons (`epingles.ts`) et inscrit à sa
 * provenance avec son empreinte, sa source, sa licence et son traitement. Le versement à la Release suit par une branche
 * `transfert/<x>` (`.github/workflows/transfert.yml`).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from './empreinte.ts';
import { DOSSIER_DES_SONS } from './epingles.ts';

/** Ce que la provenance d'un son consigne de son origine, et ce que sa conversion en garde. */
export interface DemandeDeSon {
  /** La page d'où le fichier vient, l'archive et le fichier pris, l'auteur. */
  readonly source: string;
  /** Sa licence, CC0 seulement (`CC0-1.0`, suivie au besoin d'une précision). */
  readonly licence: string;
  /** Les filtres audio de `ffmpeg` (`-af`) appliqués avant la mise au format, par exemple `asetrate=33075,aresample=44100`. */
  readonly filtre?: string;
  /** Le début de l'extrait gardé, en secondes. */
  readonly debut?: number;
  /** La durée de l'extrait gardé, en secondes. */
  readonly duree?: number;
}

/** L'entrée de provenance d'un son épinglé. */
export interface ProvenanceDeSon {
  readonly sha256: string;
  readonly source: string;
  readonly licence: string;
  readonly traitement: string;
}

/** Les arguments de `ffmpeg` qui convertissent `entree` en `sortie` au format des sons, selon `demande`. */
export function argumentsDeConversion(entree: string, sortie: string, demande: DemandeDeSon): string[] {
  return [
    '-y', '-loglevel', 'error',
    ...(demande.debut === undefined ? [] : ['-ss', String(demande.debut)]),
    '-i', entree,
    ...(demande.duree === undefined ? [] : ['-t', String(demande.duree)]),
    ...(demande.filtre === undefined ? [] : ['-af', demande.filtre]),
    '-ac', '1', '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '4', sortie,
  ];
}

/** Le traitement que la provenance consigne pour `demande`. */
export function traitementDe(demande: DemandeDeSon): string {
  const extrait = demande.debut === undefined && demande.duree === undefined ? [] : [`extrait${demande.debut === undefined ? '' : ` dès ${demande.debut} s`}${demande.duree === undefined ? '' : ` sur ${demande.duree} s`}`];
  const filtre = demande.filtre === undefined ? [] : [demande.filtre];
  return `ffmpeg : ${[...extrait, ...filtre, 'mono, 44,1 kHz, Vorbis q4'].join(', ')}`;
}

/** Le refus d'épingler le son `nom` de `demande` dans la provenance `provenance`, ou `null` : un nom qui n'est pas un
 *  `.ogg` en minuscules, un nom déjà épinglé (la Release ne remplace rien), une licence autre que CC0, une source vide. */
export function refusDuSon(nom: string, demande: DemandeDeSon, provenance: Readonly<Record<string, unknown>>): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.ogg$/.test(nom)) return `${nom} : un nom en minuscules, chiffres et tirets, fini par .ogg, attendu`;
  if (Object.prototype.hasOwnProperty.call(provenance, nom)) return `${nom} est déjà épinglé : la Release ne remplace rien, choisir un autre nom`;
  if (!/^CC0-1\.0\b/.test(demande.licence)) return `licence « ${demande.licence} » : seuls les sons CC0-1.0 entrent au projet`;
  if (demande.source.trim() === '') return 'la source du son est vide';
  return null;
}

/** Épingle sous `nom` le fichier audio `entree` selon `demande` dans le dossier `dossier` : converti, déposé et inscrit
 *  à sa provenance, clés rangées. Rend son entrée de provenance, ou lève sur un refus (`refusDuSon`) ou un échec de
 *  `ffmpeg`, sans rien écrire. */
export function epinglerUnSon(entree: string, nom: string, demande: DemandeDeSon, dossier = DOSSIER_DES_SONS): ProvenanceDeSon {
  if (!existsSync(entree)) throw new Error(`${entree} : fichier introuvable`);
  const chemin = join(dossier, 'provenance.json');
  const provenance = JSON.parse(readFileSync(chemin, 'utf8')) as Record<string, ProvenanceDeSon>;
  const refus = refusDuSon(nom, demande, provenance);
  if (refus) throw new Error(refus);
  const sortie = join(dossier, nom);
  const conversion = spawnSync('ffmpeg', argumentsDeConversion(entree, sortie, demande), { encoding: 'utf8' });
  if (conversion.error) throw new Error(`ffmpeg : ${conversion.error.message}`);
  if (conversion.status !== 0) throw new Error(`ffmpeg : code de sortie ${conversion.status}\n${conversion.stderr}`);
  const inscrite: ProvenanceDeSon = { sha256: sha256(readFileSync(sortie)), source: demande.source, licence: demande.licence, traitement: traitementDe(demande) };
  const rangee = Object.fromEntries(Object.entries({ ...provenance, [nom]: inscrite }).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(chemin, `${JSON.stringify(rangee, null, 2)}\n`);
  return inscrite;
}
