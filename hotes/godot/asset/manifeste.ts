/**
 * CE QUE TOUT MANIFESTE COMMITÉ RESPECTE (#2948) : aucune chaîne, clé comprise, ne fuit un chemin absolu du poste qui l'a
 * produit : le manifeste d'une base ou d'un élément s'y juge (`validerModele`, `modeles.ts`), la provenance aussi
 * (`importerPersonnage`, `importer.ts`).
 */

export interface ErreurDeManifeste {
  readonly code: 'chemin-absolu';
  readonly ou: string;
  readonly detail: string;
}

/** Un lecteur Windows, un partage UNC ou `~` après un séparateur ; une racine POSIX en tête de chaîne, ou après un
 *  séparateur suivie d'au moins un segment et d'une barre : « Épée / bouclier » n'en est pas une. */
const CHEMIN_ABSOLU = /(?:^|[\s"'(=,;])(?:[A-Za-z]:[\\/]|\\\\|~[\\/])|^\/(?!\/)\S|[\s"'(=,;]\/[^\s/]+\//;

/** Les chaînes (clés comprises) de `valeur` qui ressemblent à un chemin absolu Windows ou POSIX. */
export function cheminsAbsolus(valeur: unknown, ou = ''): ErreurDeManifeste[] {
  if (typeof valeur === 'string') return CHEMIN_ABSOLU.test(valeur) ? [{ code: 'chemin-absolu', ou, detail: valeur }] : [];
  if (!valeur || typeof valeur !== 'object') return [];
  return Object.entries(valeur).flatMap(([cle, v]) => {
    const ici = ou ? `${ou}.${cle}` : cle;
    return [...(Array.isArray(valeur) ? [] : cheminsAbsolus(cle, ici)), ...cheminsAbsolus(v, ici)];
  });
}

/** Un objet JSON brut, avant réduction. */
export type Brut = Record<string, unknown>;

/** Une erreur de manifeste en une ligne. */
export const ligneDErreur = (e: ErreurDeManifeste): string => `[${e.code}] ${e.ou || '(racine)'} : ${e.detail}`;
