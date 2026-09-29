/**
 * Pont composant↔clavier de la console : la `CombatConsole` (UI) publie ICI ses cases PAR ADRESSE
 * (une entrée par POSITION de zone, `null` pour une case vide) à chaque rendu du tour d'un héros ; le
 * registre de raccourcis (state) lit `hotbar.capacites[n-1]` et appelle son `run` (s'il est présent et
 * non désactivé). La touche suit la CASE, pas l'action : une case vide ne décale pas ses voisines.
 * State-clean : ne porte QUE l'IDENTITÉ de l'action (`actionId` du registre `src/data/actions.json`),
 * son dispatcher et son état désactivé — aucun ReactNode, aucune closure anonyme (spec HUD zone 12).
 *
 * `run` absent = case DESSINÉE mais non branchée (restriction de site) : elle garde son rang, sa
 * touche ne déclenche rien. En forme spectatrice la console ne publie AUCUN rang
 * (`CombatConsole.tsx`, `hotbar.capacites = []`).
 */
export type SlotHotbar = { actionId: string; run?: () => void; disabled?: boolean } | null;

export const hotbar: { capacites: SlotHotbar[] } = { capacites: [] };
