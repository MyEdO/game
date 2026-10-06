// Ce qu'on PASSE à une porte lancée en sous-processus, et comment on LIT son échec (#1699 Lot G).
// Mécanique PARTAGÉE des portes du pre-commit (`scripts/git-hooks/pre-commit.mjs`), jamais recopiée.
//
// CLASSE 1 — 32 k caractères d'argv sous Windows : un gros renommage dépasse. `CreateProcess` plafonne
// la ligne de commande à ~32 767 caractères ; dérouler la liste STAGÉE entière en arguments part en
// `spawnSync ENAMETOOLONG` dès quelques centaines de chemins (mesuré #1699 : 467 chemins = 33 181
// caractères). Un garde ne reçoit donc QUE les chemins qui le concernent — sa propre sélection, pas
// le diff complet.
//
// CLASSE 2 — une panne de spawn n'est pas un verdict. `execFileSync` lève pour DEUX raisons qui n'ont
// rien à voir : le processus a tourné et a rendu un code (`e.status`) — c'est le VERDICT du garde —, ou
// il n'a même pas démarré (`e.code` = `ENAMETOOLONG`, `ENOENT`, `E2BIG`…) — c'est une porte EN PANNE.
// Les confondre fait mentir la porte : elle accuse le doc alors que le garde ne s'est jamais exécuté.

/** Marge sous le plafond Windows (~32 767) : l'exécutable, le script et les autres arguments comptent aussi. */
export const PLAFOND_SUR_ARGV = 30000

/** Découpe une liste de chemins en paquets dont l'argv tient sous le plafond, quand le consommateur
 *  EXIGE les chemins en arguments et qu'aucune sélection ne les borne (il est alors rejoué par paquet). */
export function paquetsDArgv(chemins, plafond = PLAFOND_SUR_ARGV) {
  const paquets = []
  let courant = []
  let taille = 0
  for (const c of chemins) {
    const cout = String(c).length + 1
    if (courant.length && taille + cout > plafond) {
      paquets.push(courant)
      courant = []
      taille = 0
    }
    courant.push(c)
    taille += cout
  }
  if (courant.length) paquets.push(courant)
  return paquets
}

/** Le code SYSTÈME si le sous-processus n'a pas démarré (porte en panne), `null` s'il a rendu un verdict. */
export function codeDePanne(e) {
  return typeof e?.status === 'number' ? null : (e?.code ?? null)
}
