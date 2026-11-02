/**
 * Diagnostics du pipeline de rendu (pool de marques dynamiques saturé, `stage/dynamicMarkPose`) — dits
 * UNE FOIS PAR CLÉ, jamais par frame. Ces marques se réécrivent à chaque frame : sans mémoïsation, un
 * pool saturé noie la console.
 *
 * Clé = site du défaut. Pas de fenêtre temporelle : le même défaut ne se redit pas, un défaut à un AUTRE
 * site se dit toujours.
 */
const said = new Set<string>();

/** Exécute `say` au PREMIER appel portant `key` ; les appels suivants de la session sont muets. */
export function diagOnce(key: string, say: () => void): void {
  if (said.has(key)) return;
  said.add(key);
  say();
}

/** Vide la mémoire des diagnostics (tests : chaque cas repart d'une console vierge). */
export function resetDiagOnce(): void {
  said.clear();
}
