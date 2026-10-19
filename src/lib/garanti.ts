/** Une valeur que son PRODUCTEUR garantit (acteur d'une étape, siège d'une table, arme d'un set, entrée
 *  de catalogue citée par un id fixe) : absente, c'est un défaut interne, levé en NOMMANT ce qu'on
 *  cherchait (`quoi`) et sous quel id (#1906) — jamais un affichage. */
export function garanti<T>(valeur: T | undefined | null, id: string | number | undefined, quoi: string): T {
  if (valeur === undefined || valeur === null) throw new Error(`[${quoi}] « ${String(id)} » introuvable alors que son producteur le garantit (#1906)`);
  return valeur;
}
