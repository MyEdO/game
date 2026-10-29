/**
 * L'IMPORT D'UN PERSONNAGE 3D DE PRODUCTION (#2948) : un dossier dont `manifest.json` nomme le GLB (`model`) et son
 * empreinte (`model_sha256`), avec au plus une source `*.blend`, et dont la licence s'établit par au moins un composant
 * licencié (`components.<id>.asset.license_basis`) ou un texte `LICENSE*.txt`, devient, sous un id de
 * modèle, un GLB et sa source versés dans la Release des modèles sous leur empreinte (`release.ts`), puis le manifeste
 * réduit et validé (`manifeste.ts`), la provenance et les licences, déposés dans le dossier des modèles du projet Godot.
 * Les licences se comparent par leur identifiant SPDX (`licences.json`). Une production qui se déclare hors Release
 * (`CLE_HORS_RELEASE`, `dossierDeProduction.ts`) ne s'importe que sans publication. Tout se juge avant la première publication : un
 * dossier refusé ne publie ni n'écrit rien.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecrireTexteAtomique } from '../../../scripts/guards/lib/ecritureJsonAtomique.mjs';
import { CLE_HORS_RELEASE, FICHIER_DE_LICENCE, MANIFESTE_DE_PRODUCTION } from './dossierDeProduction.ts';
import { sha256 } from './empreinte.ts';
import { lireGlb, GlbIllisible } from './glb.ts';
import { cheminsAbsolus, estObjet, ligneDErreur, type Brut } from './manifeste.ts';
import { estBase, estSchema3, indexerModeles, validerModele, type BaseLivree, type ManifesteDeModele } from './modeles.ts';
import {
  DOSSIER_DES_MODELES, fichiersDuModele, nomDAsset, manifestesDesModeles, modelesEpingles,
  type AssetAPublier, type LicenceDeComposant, type LicenceDePack, type Provenance,
} from './release.ts';

const ID_DE_MODELE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** La table des licences : chaque texte qu'une production déclare (en-tête d'un fichier source, page d'un pack, ligne
 *  `License:` d'un `LICENSE*.txt`), vers son identifiant SPDX (https://spdx.org/licenses/). */
export const TABLE_DES_LICENCES = fileURLToPath(new URL('./licences.json', import.meta.url));

export class TableDesLicencesInvalide extends Error {
  constructor(chemin: string, raison: string) {
    super(`table des licences invalide (${chemin}) : ${raison}`);
    this.name = 'TableDesLicencesInvalide';
  }
}

/** La table des licences de `chemin`, validée : un objet JSON de chaînes vers des chaînes. */
export function chargerLicences(chemin: string = TABLE_DES_LICENCES): ReadonlyMap<string, string> {
  let brut: unknown;
  try {
    brut = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (e) {
    throw new TableDesLicencesInvalide(chemin, e instanceof Error ? e.message : String(e));
  }
  if (!estObjet(brut)) throw new TableDesLicencesInvalide(chemin, 'un objet attendu');
  const horsForme = Object.entries(brut).filter(([, v]) => typeof v !== 'string').map(([k]) => `« ${k} »`);
  if (horsForme.length) throw new TableDesLicencesInvalide(chemin, `identifiant non textuel pour ${horsForme.join(', ')}`);
  return new Map(Object.entries(brut as Record<string, string>));
}

const IDENTIFIANT_SPDX = chargerLicences();

export type ResultatDImport =
  | { readonly ok: true; readonly ecrits: readonly string[]; readonly publies: readonly string[]; readonly manifeste: ManifesteDeModele; readonly provenance: Provenance }
  | { readonly ok: false; readonly refus: readonly string[] };

const chaines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string') : []);

const LIGNE_DE_LICENCE = /^#\s*license\s+(.+)$/;

/** Les licences déclarées par composant : `components.<id>.asset.{license_basis, explicit_header, packs[].announced_license}`. */
function licencesDe(manifeste: Brut): Record<string, LicenceDeComposant> {
  const composants = estObjet(manifeste.components) ? manifeste.components : {};
  return Object.fromEntries(Object.entries(composants).flatMap(([id, c]) => {
    const asset = estObjet(c) && estObjet(c.asset) ? c.asset : null;
    if (!asset || typeof asset.license_basis !== 'string') return [];
    const en_tete = chaines(asset.explicit_header).flatMap((l) => LIGNE_DE_LICENCE.exec(l.trim())?.[1] ?? []);
    const annoncees = (Array.isArray(asset.packs) ? asset.packs : []).flatMap((p) => (estObjet(p) && typeof p.announced_license === 'string' ? [p.announced_license] : []));
    return [[id, { base: asset.license_basis, en_tete, annoncees }]];
  }));
}

/** Les textes de licence de `textes` absents de la table `IDENTIFIANT_SPDX`, chacun en refus `licence-inconnue`. */
const licencesInconnues = (textes: readonly string[], ou: string): string[] =>
  [...new Set(textes)].filter((t) => !IDENTIFIANT_SPDX.has(t)).map((t) => `[licence-inconnue] ${ou} : « ${t} »`);

/** Les refus de licence de la provenance : aucune licence établie (ni composant licencié, ni texte `LICENSE*.txt`), puis,
 *  par composant, un texte inconnu de la table, ou un en-tête et un pack tous deux déclarés dont les identifiants SPDX
 *  diffèrent. */
function refusDeLicence({ licences, licences_de_pack }: Pick<Provenance, 'licences' | 'licences_de_pack'>): string[] {
  if (!Object.keys(licences).length && !licences_de_pack.length) {
    return ['[licence-absente] ni composant licencié (components.<id>.asset.license_basis), ni texte LICENSE*.txt dans le dossier de production'];
  }
  const identifiants = (l: readonly string[]) => [...new Set(l.map((t) => IDENTIFIANT_SPDX.get(t)))].sort().join(' | ');
  return Object.entries(licences).flatMap(([id, l]) => {
    const inconnues = licencesInconnues([...l.en_tete, ...l.annoncees], `licence du composant ${id}`);
    if (inconnues.length) return inconnues;
    return l.en_tete.length && l.annoncees.length && identifiants(l.en_tete) !== identifiants(l.annoncees)
      ? [`licence du composant ${id} : l'en-tête déclare « ${identifiants(l.en_tete)} », le pack annonce « ${identifiants(l.annoncees)} »`]
      : [];
  });
}

const nomDeFichier = (chemin: string): string => chemin.split(/[\\/]/).pop() ?? '';

/** `animation_sources.<n>.{path, sha256}`, le chemin réduit au nom de fichier. */
function sourcesDAnimation(manifeste: Brut): { fichier: string; sha256: string }[] {
  const sources = estObjet(manifeste.animation_sources) ? manifeste.animation_sources : {};
  return Object.values(sources).flatMap((s) =>
    estObjet(s) && typeof s.path === 'string' && typeof s.sha256 === 'string' ? [{ fichier: nomDeFichier(s.path), sha256: s.sha256 }] : []);
}

/** Le nom sous lequel se dépose le texte de licence `octets` d'identifiant SPDX `spdx` : deux textes distincts d'une
 *  même licence (deux packs CC0) ne se disputent pas un nom. */
const nomDeLicence = (spdx: string, octets: Uint8Array): string => `LICENSE-${spdx}-${sha256(octets).slice(0, 16)}.txt`;
const LIGNE_LICENSE = /^\s*License:\s*(.+?)\s*$/m;

const lireJson = (chemin: string): unknown => JSON.parse(readFileSync(chemin, 'utf8'));
const enJson = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** Importe le dossier de production `dossier` sous l'id `id` dans `destination`, daté `date` (AAAA-MM-JJ). `publier`
 *  verse le GLB et la source dans la Release (`publierAssets`) et rend les noms versés ; `null` ne publie rien
 *  (`--sans-publier`, tests et sondes). */
export function importerPersonnage({ dossier, id, destination = DOSSIER_DES_MODELES, date, publier }: {
  dossier: string;
  id: string;
  destination?: string;
  date: string;
  publier: ((assets: readonly AssetAPublier[]) => readonly string[]) | null;
}): ResultatDImport {
  if (!ID_DE_MODELE.test(id)) return { ok: false, refus: [`id de modèle « ${id} » : lettres, chiffres, _ et - seulement`] };
  if (!existsSync(join(dossier, MANIFESTE_DE_PRODUCTION))) return { ok: false, refus: [`fichier de production absent : ${MANIFESTE_DE_PRODUCTION}`] };

  let brut: unknown;
  try {
    brut = lireJson(join(dossier, MANIFESTE_DE_PRODUCTION));
  } catch (e) {
    return { ok: false, refus: [`${MANIFESTE_DE_PRODUCTION} : JSON illisible (${(e as Error).message})`] };
  }
  if (!estObjet(brut)) return { ok: false, refus: [`${MANIFESTE_DE_PRODUCTION} : objet JSON attendu`] };
  const horsRelease = brut[CLE_HORS_RELEASE];
  if (horsRelease !== undefined && !(typeof horsRelease === 'string' && horsRelease.trim())) return { ok: false, refus: [`[hors-release] ${MANIFESTE_DE_PRODUCTION} : ${CLE_HORS_RELEASE}, raison non vide attendue`] };
  if (publier && horsRelease !== undefined) return { ok: false, refus: [`[hors-release] ${horsRelease} : import sans publication seulement (--sans-publier)`] };
  const { model, model_sha256: declaree } = brut;
  const entrees = readdirSync(dossier, { withFileTypes: true });
  if (typeof model !== 'string' || !entrees.some((e) => e.isFile() && e.name === model)) return { ok: false, refus: [`${MANIFESTE_DE_PRODUCTION} : model « ${String(model)} », fichier du dossier de production attendu`] };
  const cheminDuGlb = join(dossier, model);
  const octets = readFileSync(cheminDuGlb);
  const empreinte = sha256(octets);
  if (declaree !== empreinte) return { ok: false, refus: [`empreinte SHA-256 du GLB ${empreinte}, ${MANIFESTE_DE_PRODUCTION} déclare ${String(declaree)}`] };

  try {
    lireGlb(octets);
  } catch (e) {
    if (e instanceof GlbIllisible) return { ok: false, refus: [e.message] };
    throw e;
  }
  const contenu = entrees.filter((e) => e.isFile()).map((e) => e.name).sort();
  const sources = contenu.filter((f) => f.endsWith('.blend'));
  if (sources.length > 1) return { ok: false, refus: [`plusieurs sources .blend (${sources.join(', ')}) : une seule attendue`] };
  const licences: { fichier: string; octets: Buffer }[] = [];
  const licencesDePack: LicenceDePack[] = [];
  for (const source of contenu.filter((f) => FICHIER_DE_LICENCE.test(f))) {
    const octetsDeLicence = readFileSync(join(dossier, source));
    const licence = LIGNE_LICENSE.exec(octetsDeLicence.toString('utf8'))?.[1];
    if (!licence) return { ok: false, refus: [`${source} : aucune ligne « License: »`] };
    const spdx = IDENTIFIANT_SPDX.get(licence);
    if (!spdx) return { ok: false, refus: licencesInconnues([licence], source) };
    const fichier = nomDeLicence(spdx, octetsDeLicence);
    licences.push({ fichier, octets: octetsDeLicence });
    licencesDePack.push({ fichier, licence });
  }

  const fichiers = fichiersDuModele(id);
  const candidat = Object.prototype.hasOwnProperty.call(brut, 'manifeste') ? brut.manifeste : { ...brut, model: fichiers.glb };
  const bases = new Map<string, BaseLivree>();
  if (estSchema3(candidat)) {
    const lus = manifestesDesModeles(destination);
    const index = indexerModeles([...lus.entrees, { id, brut: candidat }]);
    const refus = [...lus.erreurs, ...index.refus];
    if (existsSync(join(destination, fichiers.manifeste))) refus.push(`[id-deja-present] ${id}`);
    const epingles = existsSync(destination) ? modelesEpingles(destination) : { modeles: [], erreurs: [] };
    refus.push(...epingles.erreurs);
    if (refus.length) return { ok: false, refus };
    for (const [base, entree] of index.bases) {
      if (estBase(candidat) || base !== candidat.base) continue;
      const chemin = join(destination, fichiersDuModele(entree.id).glb);
      if (!existsSync(chemin)) return { ok: false, refus: [`[glb-de-base-absent] ${base} : ${chemin}`] };
      const octetsDeBase = readFileSync(chemin);
      const epingle = epingles.modeles.find(m => m.id === entree.id);
      if (!epingle || sha256(octetsDeBase) !== epingle.empreinte) return { ok: false, refus: [`[provenance-de-base-differente] ${base} : ${entree.id}`] };
      bases.set(base, { brut: entree.brut, octets: octetsDeBase });
    }
  }
  const verdict = validerModele(candidat, octets, bases);
  if (!verdict.ok) return verdict;

  const provenance: Provenance = {
    model: fichiers.glb,
    model_sha256: empreinte,
    ...(sources[0] ? { source_sha256: sha256(readFileSync(join(dossier, sources[0]))) } : {}),
    importe_le: date,
    licences: licencesDe(brut),
    licences_de_pack: licencesDePack,
    animation_sources: sourcesDAnimation(brut),
  };
  const fuites = cheminsAbsolus(provenance, 'provenance');
  if (fuites.length) return { ok: false, refus: fuites.map(ligneDErreur) };
  const refus = refusDeLicence(provenance);
  if (refus.length) return { ok: false, refus };

  const assets: AssetAPublier[] = [
    { chemin: cheminDuGlb, nom: nomDAsset(empreinte, 'glb') },
    ...(sources[0] && provenance.source_sha256 ? [{ chemin: join(dossier, sources[0]), nom: nomDAsset(provenance.source_sha256, 'blend') }] : []),
  ];
  const publies = publier ? publier(assets) : [];
  const glbEcrits: string[] = [];
  if (estSchema3(candidat)) {
    ecrireTexteAtomique(join(destination, fichiers.glb), octets);
    glbEcrits.push(join(destination, fichiers.glb));
  }
  ecrireTexteAtomique(join(destination, fichiers.manifeste), enJson(verdict.manifeste));
  ecrireTexteAtomique(join(destination, fichiers.provenance), enJson(provenance));
  for (const { fichier, octets } of licences) ecrireTexteAtomique(join(destination, fichier), octets);
  const ecrits = [...glbEcrits, ...[fichiers.manifeste, fichiers.provenance, ...licences.map((l) => l.fichier)].map((f) => join(destination, f))];
  return { ok: true, ecrits, publies, manifeste: verdict.manifeste, provenance };
}
