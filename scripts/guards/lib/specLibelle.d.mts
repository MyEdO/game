/** Sites d'un littéral objet dont la `spec` est le LIBELLÉ d'une spécialisation de son catalogue au lieu
 *  de son id. Contrat : en-tête de `specLibelle.mjs`. */
export function sitesSpecLibelle(
  fichiers: { rel: string; text: string }[],
  catalogue: Map<string, { id: string; label: string }[]>,
): { rel: string; ligne: number; id: string; spec: string; specId: string }[];
