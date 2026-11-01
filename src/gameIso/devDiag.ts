/**
 * Diagnostics de DONNÉE du pipeline de rendu (espèce/réf manquante, propulsion sans gabarit) — dits
 * UNE FOIS PAR SUJET, jamais par rendu. Les sujets se redérivent à chaque commit de l'hôte du monde
 * (`stage/MondeDeCampagne` → `builders/tokens` → `actorPoses`) : un pas, un tour de vue, un survol en
 * repassent la population entière. Sans mémoïsation, un défaut de donnée noie la console.
 *
 * Clé = site + identité STABLE du sujet. Un sujet SANS réf n'a aucune identité à ce niveau : l'appelant
 * qui la connaît (scène + id d'entité) la POSE via `withDiagSubject`, sinon tous ces sujets partagent une
 * clé vide et un seul parle. Pas de fenêtre temporelle : le même défaut ne se redit pas, un défaut sur
 * un AUTRE sujet se dit toujours.
 */
const said = new Set<string>();

let sujet = '';

/** Nomme le SUJET rendu pendant `run` (forme `<scène>/<idEntité>`) : les diagnostics émis dessous s'y
 *  rattachent — clé ET message — quand la donnée manquante ne porte aucune réf. */
export function withDiagSubject<T>(id: string, run: () => T): T {
  const prev = sujet;
  sujet = id;
  try {
    return run();
  } finally {
    sujet = prev;
  }
}

/** Sujet posé par l'appelant ; `''` hors de tout `withDiagSubject`. */
export function diagSubject(): string {
  return sujet;
}

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
