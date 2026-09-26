/**
 * Type du registre des Traits de créature (LDB 85 l.3-446). Le registre `TRAITS` est DÉRIVÉ de la
 * DONNÉE (`src/data/traits.json`, via `data.traits`) dans `registry.ts` — il n'existe plus de `defs/`
 * mécaniques. Toute la mécanique (capacités, modificateurs de profil, effets déclenchés, manœuvres
 * octroyées) vit dans `traits.json` :
 *  - capacités booléennes/à seuil (Endurant, Démoniaque, Bestial, Nuée, Stupide…) → `TraitData.capabilities`,
 *    lues PAR ID par les helpers de `dispatch.ts` (traitCapability/wardSaves/…) ;
 *  - modificateurs de Caractéristiques/Mouvement (Élite +20 CC…, Brutal −1 M) → `TraitData.passive: GameOp[]`,
 *    lus par le collecteur passif ;
 *  - effets déclenchés / manœuvres → `TraitData.effects` / `TraitData.grantsManeuvers`.
 * Le `TraitDef` du registre porte donc seulement le libellé d'AFFICHAGE.
 */
export interface TraitDef {
  /** Libellé FR canonique (clé de correspondance, casse/Indice/parenthèse ignorés). */
  key: string;
}
