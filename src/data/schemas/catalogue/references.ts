/**
 * Le parse sous un CATALOGUE passé (#5070, `docs/plans/2026-11-25-composition-d-un-jeu.md` § 5.1, point 2) : le schéma
 * garde la forme, et chaque id et chaque faute croisée se juge contre les documents de `cat` (`sousLeCatalogue`,
 * `grammaire/ref.ts`).
 */
import type { z } from 'zod';
import type { Catalogue } from './catalogue';
import { SCHEMA_DEFS } from '../_registry.generated';
import { idsDeLEspace, lectureDeLEspace, type AccesAuxDocuments, type LectureDEspace } from '../grammaire/collection-cle';
import { lireCleDEspace, vocabulaireDuFichier } from '../grammaire/cle-d-espace';
import { lectureDuVocabulaire } from '../grammaire/vocabulaires';
import { sousLeCatalogue, type LecteurDIds } from '../grammaire/ref';
import { memoParIdentite } from '../../../lib/memoParIdentite';

/** Schéma de chaque document de la bibliothèque : ses marques de collection guident la lecture d'un espace. */
const SCHEMA_DU_FICHIER = new Map(SCHEMA_DEFS.map((d) => [d.file, d.schema] as const));

/** Les documents de `cat`, tels qu'un lecteur d'espace les reçoit ; `undefined` : `cat` ne porte pas ce document. */
const accesAuxDocumentsDe = (cat: Catalogue): AccesAuxDocuments => (fichier) => {
  const racine: unknown = Reflect.get(cat, fichier);
  return racine === undefined ? undefined : { schema: SCHEMA_DU_FICHIER.get(fichier), racine };
};

const AUCUN: ReadonlySet<string> = new Set();

type LectureEnEnsemble = { readonly ids: ReadonlySet<string> } | Exclude<LectureDEspace, { readonly ids: unknown }> | undefined;

/** La lecture des ids de chaque espace de `cat`, mémoïsée par son identité : un vocabulaire du moteur, sinon le document
 *  de `cat`, l'univers d'une `specsSource` suivi (`idsDeLEspace`). Un document que `cat` ne porte pas se lit vide. */
const lecteurDe = memoParIdentite((cat: Catalogue): LecteurDIds => {
  const acces = accesAuxDocumentsDe(cat);
  const lues = new Map<string, LectureEnEnsemble>();
  const lire = (cle: string): LectureEnEnsemble => {
    if (!lues.has(cle)) {
      const lecture = lectureDuVocabulaire(cle) ?? lectureDeLEspace(cle, acces);
      lues.set(cle, lecture && ('ids' in lecture ? { ids: new Set(lecture.ids) } : lecture));
    }
    return lues.get(cle);
  };
  return (cle, site) => {
    const ids = idsDeLEspace(cle, lire);
    if (ids) return ids;
    const { fichier } = lireCleDEspace(cle);
    if (vocabulaireDuFichier(fichier) === undefined && acces(fichier) === undefined) return AUCUN;
    throw new Error(`${site} : « ${cle} » n'est aucun espace du catalogue.`);
  };
});

/** Le parse de `valeur` par `schema`, chaque id et chaque faute croisée jugés contre `cat` : le résultat de `safeParse`. */
export const parserSousCatalogue = <S extends z.ZodType>(schema: S, valeur: unknown, cat: Catalogue): z.ZodSafeParseResult<z.output<S>> =>
  sousLeCatalogue(lecteurDe(cat), cat, () => schema.safeParse(valeur));
