/**
 * IDS VIVANTS (#1686 lot 3a-2, #1463) — le SECOND régime du registre d'ids, le RÉGIME VIVANT.
 *
 * `_ids.generated.ts` déclare deux régimes : le fichier figé au commit (`npm run gen`), et le
 * recalcul sur les RACINES VIVANTES, seul régime juste dès qu'une entité est créée ou renommée
 * à l'atelier — sans lui, une entité neuve est invalide pour toute donnée qui la référence tant que
 * le générateur n'a pas tourné.
 *
 * Ce module est une FEUILLE : il n'importe rien. C'est ce qui le rend consommable par `ref.ts`, que
 * le registre généré ne peut pas atteindre (`_registry.generated.ts` importe les defs, qui appellent
 * `idDe` à l'initialisation — lire le registre depuis `ref.ts` fermerait le cycle). La couche DONNÉE
 * (`src/data/overrides.ts`, propriétaire des racines vivantes) POSE ici sa lecture, `lectureDeLEspace`
 * sur les racines vivantes ; sans lecture posée (scripts, gardes, `npm run gen` : aucun état
 * d'application), tout rend `undefined` et l'appelant retombe sur le fichier généré.
 */

/** Ce que la couche donnée pose : les ids d'un espace, par sa clé d'espace, sur les racines vivantes —
 *  `undefined` : l'espace n'existe pas. */
export type RegimeVivant = (cle: string) => ReadonlySet<string> | undefined;

let regime: RegimeVivant | undefined;

/** Pose le régime vivant — appelée UNE fois par la couche donnée au chargement de ses racines — et
 *  REND le régime précédent (`undefined` = aucun) : c'est la couture par laquelle un test repose
 *  celui qu'il a trouvé au lieu de muter le registre généré. */
export function poserRegimeVivant(r: RegimeVivant | undefined): RegimeVivant | undefined {
  const precedent = regime;
  regime = r;
  return precedent;
}

/**
 * Ids d'un espace, par sa CLÉ D'ESPACE (`grammaire/cle-d-espace.ts`), tels que les racines vivantes
 * les portent, dans l'ordre de la donnée — `undefined` si aucun régime n'est posé ou si l'espace
 * n'existe pas : l'appelant lit alors l'INDEX DES IDS généré.
 */
export function idsVivants(cle: string): ReadonlySet<string> | undefined {
  return regime?.(cle);
}
