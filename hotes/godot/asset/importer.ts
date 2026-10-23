/**
 * L'IMPORT D'UN PERSONNAGE 3D DE PRODUCTION (#2948) : un dossier `animated.glb`, `manifest.json`, `report.json` (et au
 * plus une source `*.blend`, des licences `LICENSE*.txt`) devient, sous un id de modèle, un GLB et sa source versés dans
 * la Release des modèles sous leur empreinte (`release.ts`), puis le manifeste réduit et validé (`manifeste.ts`), la
 * provenance et les licences, déposés dans le dossier des modèles du projet Godot. Tout se juge avant la première
 * publication : un dossier refusé ne publie ni n'écrit rien.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ecrireTexteAtomique } from '../../../scripts/guards/lib/ecritureJsonAtomique.mjs';
import { lireGlb, GlbIllisible, type ContenuGlb } from './glb.ts';
import { cheminsAbsolus, estObjet, ligneDErreur, validerManifeste, type Brut, type ManifesteDePersonnage } from './manifeste.ts';
import {
  DOSSIER_DES_MODELES, fichiersDuModele, nomDAsset, sha256,
  type AssetAPublier, type LicenceDeComposant, type LicenceDePack, type Provenance,
} from './release.ts';

/** Les trois fichiers d'un dossier de production. */
export const FICHIERS_DE_PRODUCTION = Object.freeze({ glb: 'animated.glb', manifeste: 'manifest.json', rapport: 'report.json' });

const ID_DE_MODELE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export type ResultatDImport =
  | { readonly ok: true; readonly ecrits: readonly string[]; readonly publies: readonly string[]; readonly manifeste: ManifesteDePersonnage; readonly provenance: Provenance }
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

/** Les composants dont la licence de l'en-tête et celle que le pack annonce sont toutes deux déclarées et diffèrent. */
function conflitsDeLicence(licences: Readonly<Record<string, LicenceDeComposant>>): string[] {
  const valeurs = (l: readonly string[]) => [...new Set(l)].sort().join(' | ');
  return Object.entries(licences).flatMap(([id, l]) => (l.en_tete.length && l.annoncees.length && valeurs(l.en_tete) !== valeurs(l.annoncees)
    ? [`licence du composant ${id} : l'en-tête déclare « ${valeurs(l.en_tete)} », le pack annonce « ${valeurs(l.annoncees)} »`]
    : []));
}

const nomDeFichier = (chemin: string): string => chemin.split(/[\\/]/).pop() ?? '';

/** `animation_sources.<n>.{path, sha256}`, le chemin réduit au nom de fichier. */
function sourcesDAnimation(manifeste: Brut): { fichier: string; sha256: string }[] {
  const sources = estObjet(manifeste.animation_sources) ? manifeste.animation_sources : {};
  return Object.values(sources).flatMap((s) =>
    estObjet(s) && typeof s.path === 'string' && typeof s.sha256 === 'string' ? [{ fichier: nomDeFichier(s.path), sha256: s.sha256 }] : []);
}

const FICHIER_DE_LICENCE = /^LICENSE.*\.txt$/;
const LIGNE_LICENSE = /^\s*License:\s*(.+?)\s*$/m;

const memesOctets = (a: Uint8Array, b: Uint8Array): boolean => Buffer.compare(a, b) === 0;
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
  const absents = Object.values(FICHIERS_DE_PRODUCTION).filter((f) => !existsSync(join(dossier, f)));
  if (absents.length) return { ok: false, refus: absents.map((f) => `fichier de production absent : ${f}`) };

  let brut: unknown;
  let rapport: unknown;
  try {
    brut = lireJson(join(dossier, FICHIERS_DE_PRODUCTION.manifeste));
    rapport = lireJson(join(dossier, FICHIERS_DE_PRODUCTION.rapport));
  } catch (e) {
    return { ok: false, refus: [`JSON illisible : ${(e as Error).message}`] };
  }
  if (!estObjet(brut) || !estObjet(rapport)) return { ok: false, refus: ['le manifeste et le rapport doivent être des objets JSON'] };
  const octets = readFileSync(join(dossier, FICHIERS_DE_PRODUCTION.glb));
  const empreinte = sha256(octets);
  const ecartsDEmpreinte = ([['manifeste', brut], ['rapport', rapport]] as const).flatMap(([nom, doc]) =>
    doc.model_sha256 === empreinte ? [] : [`empreinte SHA-256 du GLB ${empreinte}, le ${nom} déclare ${String(doc.model_sha256)}`]);
  if (ecartsDEmpreinte.length) return { ok: false, refus: ecartsDEmpreinte };

  let glb: ContenuGlb;
  try {
    glb = lireGlb(octets);
  } catch (e) {
    if (e instanceof GlbIllisible) return { ok: false, refus: [e.message] };
    throw e;
  }
  const contenu = readdirSync(dossier).sort();
  const sources = contenu.filter((f) => f.endsWith('.blend'));
  if (sources.length > 1) return { ok: false, refus: [`plusieurs sources .blend (${sources.join(', ')}) : une seule attendue`] };
  const licencesDePack: LicenceDePack[] = [];
  for (const fichier of contenu.filter((f) => FICHIER_DE_LICENCE.test(f))) {
    const licence = LIGNE_LICENSE.exec(readFileSync(join(dossier, fichier), 'utf8'))?.[1];
    if (!licence) return { ok: false, refus: [`${fichier} : aucune ligne « License: »`] };
    licencesDePack.push({ fichier, licence });
  }

  const fichiers = fichiersDuModele(id);
  const verdict = validerManifeste({ ...brut, model: fichiers.glb }, glb);
  if (!verdict.ok) return { ok: false, refus: verdict.erreurs.map(ligneDErreur) };

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
  const conflits = conflitsDeLicence(provenance.licences);
  if (conflits.length) return { ok: false, refus: conflits };
  const licences = licencesDePack.map(({ fichier }) => ({ fichier, octets: readFileSync(join(dossier, fichier)) }));
  const collisions = licences.flatMap(({ fichier, octets }) => {
    const deja = join(destination, fichier);
    return existsSync(deja) && !memesOctets(readFileSync(deja), octets) ? [`${fichier} : un autre texte porte déjà ce nom dans ${destination}`] : [];
  });
  if (collisions.length) return { ok: false, refus: collisions };

  const assets: AssetAPublier[] = [
    { chemin: join(dossier, FICHIERS_DE_PRODUCTION.glb), nom: nomDAsset(empreinte, 'glb') },
    ...(sources[0] && provenance.source_sha256 ? [{ chemin: join(dossier, sources[0]), nom: nomDAsset(provenance.source_sha256, 'blend') }] : []),
  ];
  const publies = publier ? publier(assets) : [];
  ecrireTexteAtomique(join(destination, fichiers.manifeste), enJson(verdict.manifeste));
  ecrireTexteAtomique(join(destination, fichiers.provenance), enJson(provenance));
  for (const { fichier, octets } of licences) ecrireTexteAtomique(join(destination, fichier), octets);
  const ecrits = [fichiers.manifeste, fichiers.provenance, ...licences.map((l) => l.fichier)].map((f) => join(destination, f));
  return { ok: true, ecrits, publies, manifeste: verdict.manifeste, provenance };
}
