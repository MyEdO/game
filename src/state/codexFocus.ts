/**
 * `CodexFocus` — cible d'une ouverture de Codex, FOYER UNIQUE du type partagé.
 *
 * Vit dans `src/state` (et non dans `src/ui/compendium/registry`) car le store (`compendiumFocus`/
 * `codexOverlay`, `store.ts`) ET la persistance (`saves.ts`) le manipulent : la couche `state` ne
 * peut pas importer `src/ui` (règle 3, police de pureté d'`oxlint.config.mjs`). L'UI (`CompendiumScreen`) le consomme
 * en aval (ui → state, autorisé).
 *
 * `id` = identité STABLE de l'entrée (la clé de navigation, `codexItemKey`) ; `label` = affichage/
 * repli optionnel ; `instance` = libellé paramétré porté par le lien (« 8 Tentacules +8 ») affiché
 * en tête de fiche.
 */
export interface CodexFocus {
  category: string;
  id: string;
  label?: string;
  instance?: string;
}
