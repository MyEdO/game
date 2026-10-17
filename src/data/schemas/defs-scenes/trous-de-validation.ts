/**
 * TROUS DE VALIDATION de `defs-scenes/` (#1466 L1a T3-c) — liste NOMINATIVE datée (2026-08-24) et
 * DÉCROISSANTE des `z.custom<T>()` du module. Un `z.custom` sans refine accepte TOUT au runtime :
 * il ne tient que le type TypeScript, donc le document mal formé passe la porte. Chaque entrée
 * porte sa raison MESURÉE et son lot de mort ; aucune ne s'ajoute sans les deux, aucune ne se
 * retire autrement que par le commit qui ÉCRIT le schéma de la forme.
 *
 * Clé = `<fichier>:<symbole>` (le symbole exporté, ou le champ porteur pour un `z.custom` inline).
 * Le cliquet vit dans `trous-de-validation.test.ts` : un site hors liste, ou une entrée sans site,
 * est ROUGE et se NOMME.
 */
export const TROUS_DE_VALIDATION: Readonly<Record<string, { raison: string; lot: string }>> = {
  'scene.ts:optionalEntrySchema': {
    raison:
      'OptionalEntry (engine/statEntry.ts:137) = TraitInstance | OptionalNote — même famille que les traits d’un statbloc (TraitInstance y est déjà la brique), et sa discrimination se fait par PRÉSENCE de `note` (isOptionalNote), pas par un discriminant.',
    lot: 'L2 #1463 — concept « statblocs/créatures ». La brique `TraitInstance` est écrite UNE fois, à la grammaire (`grammaire/reference.ts:traitInstanceSchema`) : ce trou se ferme en la composant avec `OptionalWildcard`/`OptionalSwap` (union à discriminant `note`, dont `SwapGrant`), pas en la recopiant.',
  },
  'scene.ts:authoredShipPosteSchema': {
    raison:
      'AuthoredShipPoste (engine/types.ts) porte le coffre de la pièce (`ammo: ItemInstance[]`) et `WeaponEnchant[]` : l’écrire strict aujourd’hui exigerait le schéma d’ItemInstance.',
    lot: 'L3 #1463 — lot NAVAL (postes/artillerie MDG) : l’ItemInstance vient avec le lot possessions.',
  },
  'narratif.ts:objets': {
    raison:
      'TrappingData EMBARQUÉ dans un preset narratif ≠ schéma de catalogue (mesuré T3-b : `type:"divers"` sans enveloppe de dataset) — le schéma de l’objet appartient au catalogue des possessions, pas au bloc narratif.',
    lot: 'L3 #1463 — lot POSSESSIONS/trappings : le bloc narratif référencera le schéma de catalogue une fois écrit.',
  },
};
