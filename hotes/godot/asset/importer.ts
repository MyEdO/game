/**
 * L'IMPORT D'UN PERSONNAGE 3D DE PRODUCTION (#2948) : un dossier dont `manifest.json` nomme le GLB (`model`) et son
 * empreinte (`model_sha256`), avec au plus une source `*.blend`, et dont la licence s'établit par au moins un composant
 * licencié (`components.<id>.asset.license_basis`) ou un texte `LICENSE*.txt`, devient, sous un id de
 * modèle, un GLB et sa source versés dans la Release des modèles sous leur empreinte (`release.ts`), puis le manifeste
 * réduit et validé (`manifeste.ts`), la provenance et les licences, déposés dans le dossier des modèles du projet Godot.
 * Les licences se comparent par leur identifiant SPDX (`licences.json`). Un modèle hors Release (`CLE_HORS_RELEASE`,
 * `dossierDeProduction.ts`) : une production qui s'y déclare, ou un élément dont la base déposée l'est (#2948,
 * arbitrages n°14 et n°19) ; il ne s'importe que sans publication, et sa provenance en reporte la raison. Tout se juge
 * avant la première publication : un dossier refusé ne publie ni n'écrit rien.
 */
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ecrireTexteAtomique } from '../../../scripts/guards/lib/ecritureJsonAtomique.mjs';
import { chargerLicences, CLE_HORS_RELEASE, FICHIER_DE_LICENCE, licenceDeclaree, MANIFESTE_DE_PRODUCTION } from './dossierDeProduction.ts';
import { EMPREINTE, sha256 } from './empreinte.ts';
import { estObjet } from '../../../src/hote/formes.ts';
import { cheminsAbsolus, ligneDErreur, type Brut } from './manifeste.ts';
import {
  estBase, estSchema3, fichiersDuModele, indexerModeles, validerModele, verdictsDesModeles,
  type BaseLivree, type EntreeDeModele, type ManifesteDeModele,
} from './modeles.ts';
import {
  DOSSIER_DES_MODELES, nomDAsset, manifestesDesModeles, modelesEpingles,
  type AssetAPublier, type LicenceDeComposant, type LicenceDePack, type ModeleEpingle, type PackSource, type Provenance,
} from './release.ts';

const ID_DE_MODELE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const IDENTIFIANT_SPDX = chargerLicences();

export type ResultatDImport =
  | { readonly ok: true; readonly ecrits: readonly string[]; readonly retires: readonly string[]; readonly publies: readonly string[]; readonly rapport: readonly string[]; readonly manifeste: ManifesteDeModele; readonly provenance: Provenance }
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

/** `packs_sources.<pack>.{path, sha256, licence}`, le chemin réduit au nom de son fichier ou dossier et `licence`, texte `LICENSE*.txt`
 *  du dossier de production, au nom de son dépôt dans `deposes` ; ou les refus : `[pack-source-mal-forme]` d'une entrée
 *  qui n'est pas un objet, sans `path` ou sans `licence` en chaîne, ou dont `sha256` n'est pas un SHA-256 (`EMPREINTE`), `[licence-de-pack-absente]` d'un pack
 *  dont la licence ne nomme aucun texte du dossier, `[packs-sources-absents]` quand `exige` (une base) et qu'aucun pack
 *  n'est déclaré. */
function packsSources(manifeste: Brut, deposes: ReadonlyMap<string, string>, exige: boolean): { readonly packs: PackSource[] } | { readonly refus: string[] } {
  if (manifeste.packs_sources !== undefined && !estObjet(manifeste.packs_sources)) return { refus: ['[pack-source-mal-forme] packs_sources : objet attendu'] };
  const sources = estObjet(manifeste.packs_sources) ? manifeste.packs_sources : {};
  const refus: string[] = [];
  const packs = Object.entries(sources).flatMap(([pack, s]): PackSource[] => {
    if (!estObjet(s)) {
      refus.push(`[pack-source-mal-forme] ${pack} : objet attendu`);
      return [];
    }
    const path = typeof s.path === 'string' ? s.path : null;
    const empreinte = typeof s.sha256 === 'string' && EMPREINTE.test(s.sha256) ? s.sha256 : null;
    const licence = typeof s.licence === 'string' ? s.licence : null;
    if (path === null || empreinte === null || licence === null) {
      const formes = [
        [path, 'path, chaîne attendue'],
        [empreinte, `sha256 « ${String(s.sha256)} » n'est pas un SHA-256`],
        [licence, 'licence, nom d\'un texte LICENSE*.txt du dossier attendu'],
      ] as const;
      refus.push(...formes.flatMap(([valeur, f]) => (valeur === null ? [`[pack-source-mal-forme] ${pack} : ${f}`] : [])));
      return [];
    }
    const depose = deposes.get(licence);
    if (depose === undefined) {
      refus.push(`[licence-de-pack-absente] ${pack} : ${licence}`);
      return [];
    }
    return [{ pack, fichier: nomDeFichier(path), sha256: empreinte, licence: depose }];
  });
  if (exige && !refus.length && !packs.length) refus.push(`[packs-sources-absents] ${MANIFESTE_DE_PRODUCTION} : packs_sources, au moins un pack attendu pour une base`);
  return refus.length ? { refus } : { packs };
}

/** Les refus `[remplacement-casse]` de la base `candidat` (octets `octets`, hors Release `horsRelease`) qui remplace le
 *  modèle `id` : chaque élément de `entrees` qui la référence se revalide contre elle (`verdictsDesModeles`) sur son
 *  GLB déposé dans `destination`, et garde l'état hors Release que la base remplacée, épinglée dans `epingles`, lui a
 *  transmis à son import. */
function refusDeRemplacement({ destination, id, candidat, octets, horsRelease, entrees, epingles }: {
  destination: string;
  id: string;
  candidat: Record<string, unknown>;
  octets: Uint8Array;
  horsRelease: string | undefined;
  entrees: readonly EntreeDeModele[];
  epingles: readonly ModeleEpingle[];
}): string[] {
  const elements = entrees.filter((e) => e.id !== id && estSchema3(e.brut) && !estBase(e.brut) && e.brut.base === candidat.base);
  const avant = epingles.find((m) => m.id === id)?.hors_release;
  const refus = avant === horsRelease ? [] : elements.map((e) => `[remplacement-casse] ${e.id} : hors Release de la base « ${avant ?? 'aucun'} », remplacé par « ${horsRelease ?? 'aucun'} »`);
  const octetsParId = new Map<string, Uint8Array>([[id, octets]]);
  for (const { id: element } of elements) {
    const chemin = join(destination, fichiersDuModele(element).glb);
    if (existsSync(chemin)) octetsParId.set(element, readFileSync(chemin));
    else refus.push(`[remplacement-casse] ${element} : GLB absent, ${chemin}`);
  }
  for (const { id: element, verdict } of verdictsDesModeles([{ id, brut: candidat }, ...elements], octetsParId)) {
    if (element !== id && !verdict.ok) refus.push(`[remplacement-casse] ${element} : ${verdict.refus.join(' ; ')}`);
  }
  return refus;
}

/** Le nom sous lequel se dépose le texte de licence `octets` d'identifiant SPDX `spdx` : deux textes distincts d'une
 *  même licence (deux packs CC0) ne se disputent pas un nom. */
const nomDeLicence = (spdx: string, octets: Uint8Array): string => `LICENSE-${spdx}-${sha256(octets).slice(0, 16)}.txt`;

const lireJson = (chemin: string): unknown => JSON.parse(readFileSync(chemin, 'utf8'));
const enJson = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** Importe le dossier de production `dossier` sous l'id `id` dans `destination`, daté `date` (AAAA-MM-JJ). `publier`
 *  verse le GLB et la source dans la Release (`publierAssets`) et rend les noms versés ; `null` ne publie rien
 *  (`--sans-publier`, tests et sondes). `remplacer` (`--remplacer`) remplace un modèle schéma 3 déjà importé sous
 *  `id` : une base ne se remplace que si chaque élément qui la référence passe contre elle (`refusDeRemplacement`), et
 *  les textes de licence que l'ancienne provenance était seule à nommer se retirent (`retires`) ; sur une production
 *  schéma 2, il se refuse (`[remplacer-hors-schema-3]`). Un import réussi rend le `rapport` de l'index (`indexerModeles`)
 *  des modèles déposés et du candidat, qui ne bloque rien. */
export function importerPersonnage({ dossier, id, destination = DOSSIER_DES_MODELES, date, publier, remplacer = false }: {
  dossier: string;
  id: string;
  destination?: string;
  date: string;
  publier: ((assets: readonly AssetAPublier[]) => readonly string[]) | null;
  remplacer?: boolean;
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
  const horsReleaseDeclare = brut[CLE_HORS_RELEASE];
  if (horsReleaseDeclare !== undefined && !(typeof horsReleaseDeclare === 'string' && horsReleaseDeclare.trim())) return { ok: false, refus: [`[hors-release] ${MANIFESTE_DE_PRODUCTION} : ${CLE_HORS_RELEASE}, raison non vide attendue`] };
  const { model, model_sha256: declaree } = brut;
  const entrees = readdirSync(dossier, { withFileTypes: true });
  if (typeof model !== 'string' || !entrees.some((e) => e.isFile() && e.name === model)) return { ok: false, refus: [`${MANIFESTE_DE_PRODUCTION} : model « ${String(model)} », fichier du dossier de production attendu`] };
  const cheminDuGlb = join(dossier, model);
  const octets = readFileSync(cheminDuGlb);
  const empreinte = sha256(octets);
  if (declaree !== empreinte) return { ok: false, refus: [`empreinte SHA-256 du GLB ${empreinte}, ${MANIFESTE_DE_PRODUCTION} déclare ${String(declaree)}`] };

  const contenu = entrees.filter((e) => e.isFile()).map((e) => e.name).sort();
  const sources = contenu.filter((f) => f.endsWith('.blend'));
  if (sources.length > 1) return { ok: false, refus: [`plusieurs sources .blend (${sources.join(', ')}) : une seule attendue`] };
  const licences = new Map<string, Buffer>();
  const licencesDePack = new Map<string, LicenceDePack>();
  const deposes = new Map<string, string>();
  for (const source of contenu.filter((f) => FICHIER_DE_LICENCE.test(f))) {
    const octetsDeLicence = readFileSync(join(dossier, source));
    const licence = licenceDeclaree(octetsDeLicence.toString('utf8'));
    if (!licence) return { ok: false, refus: [`${source} : texte vide, ni ligne « License: » ni titre`] };
    const spdx = IDENTIFIANT_SPDX.get(licence);
    if (!spdx) return { ok: false, refus: licencesInconnues([licence], source) };
    const fichier = nomDeLicence(spdx, octetsDeLicence);
    licences.set(fichier, octetsDeLicence);
    licencesDePack.set(fichier, { fichier, licence });
    deposes.set(source, fichier);
  }
  const fichiers = fichiersDuModele(id);
  const candidat = Object.prototype.hasOwnProperty.call(brut, 'manifeste') ? brut.manifeste : { ...brut, model: fichiers.glb };
  if (remplacer && !estSchema3(candidat)) return { ok: false, refus: [`[remplacer-hors-schema-3] ${id} : --remplacer ne remplace qu'un modèle schéma 3`] };
  const packs = packsSources(brut, deposes, estBase(candidat));
  if ('refus' in packs) return { ok: false, refus: packs.refus };

  const bases = new Map<string, BaseLivree>();
  let horsReleaseDeLaBase: string | undefined;
  let remplacement: Omit<Parameters<typeof refusDeRemplacement>[0], 'horsRelease'> | null = null;
  let licencesRemplacees: readonly string[] = [];
  let rapport: readonly string[] = [];
  if (estSchema3(candidat)) {
    const lus = manifestesDesModeles(destination);
    const conserves = remplacer ? lus.entrees.filter((e) => e.id !== id) : lus.entrees;
    const index = indexerModeles([...conserves, { id, brut: candidat }]);
    rapport = index.rapport;
    const refus = [...lus.erreurs, ...index.refus];
    if (!remplacer && existsSync(join(destination, fichiers.manifeste))) refus.push(`[id-deja-present] ${id} : --remplacer remplace le modèle importé`);
    const epingles = existsSync(destination) ? modelesEpingles(destination) : { modeles: [], erreurs: [] };
    refus.push(...epingles.erreurs);
    if (refus.length) return { ok: false, refus };
    if (remplacer) {
      const nommees = new Set(epingles.modeles.filter((m) => m.id !== id).flatMap((m) => m.licences));
      licencesRemplacees = (epingles.modeles.find((m) => m.id === id)?.licences ?? []).filter((l) => !nommees.has(l));
      if (estBase(candidat)) remplacement = { destination, id, candidat, octets, entrees: conserves, epingles: epingles.modeles };
    }
    for (const [base, entree] of index.bases) {
      if (estBase(candidat) || base !== candidat.base) continue;
      const chemin = join(destination, fichiersDuModele(entree.id).glb);
      if (!existsSync(chemin)) return { ok: false, refus: [`[glb-de-base-absent] ${base} : ${chemin}`] };
      const octetsDeBase = readFileSync(chemin);
      const epingle = epingles.modeles.find(m => m.id === entree.id);
      if (!epingle || sha256(octetsDeBase) !== epingle.empreinte) return { ok: false, refus: [`[provenance-de-base-differente] ${base} : ${entree.id}`] };
      bases.set(base, { brut: entree.brut, octets: octetsDeBase });
      if (epingle.hors_release !== undefined) horsReleaseDeLaBase = `base ${entree.id} : ${epingle.hors_release}`;
    }
  }
  const horsRelease = typeof horsReleaseDeclare === 'string' ? horsReleaseDeclare : horsReleaseDeLaBase;
  if (publier && horsRelease !== undefined) return { ok: false, refus: [`[hors-release] ${horsRelease} : import sans publication seulement (--sans-publier)`] };
  const verdict = validerModele(candidat, octets, bases);
  if (!verdict.ok) return verdict;
  const casses = remplacement ? refusDeRemplacement({ ...remplacement, horsRelease }) : [];
  if (casses.length) return { ok: false, refus: casses };

  const provenance: Provenance = {
    model: fichiers.glb,
    model_sha256: empreinte,
    ...(sources[0] ? { source_sha256: sha256(readFileSync(join(dossier, sources[0]))) } : {}),
    importe_le: date,
    licences: licencesDe(brut),
    licences_de_pack: [...licencesDePack.values()],
    packs_sources: packs.packs,
    ...(horsRelease !== undefined ? { hors_release: horsRelease } : {}),
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
  for (const [fichier, octets] of licences) ecrireTexteAtomique(join(destination, fichier), octets);
  const retires = licencesRemplacees.filter((l) => !licences.has(l)).map((l) => join(destination, l));
  for (const chemin of retires) rmSync(chemin, { force: true });
  const ecrits = [...glbEcrits, ...[fichiers.manifeste, fichiers.provenance, ...licences.keys()].map((f) => join(destination, f))];
  return { ok: true, ecrits, retires, publies, rapport, manifeste: verdict.manifeste, provenance };
}
