/** Arrêt `indetermine` de l'`operation` sur `pid` : `code` et `message` de sa `cause`, gardée entière pour sa chaîne ;
 *  sans cause, le seul `message` (#2586). */
export function arretIndetermine({ operation, pid, cause, message = cause?.message ?? String(cause) }) {
  const erreur = { operation, pid, code: cause?.code, message }
  if (cause !== undefined) erreur.cause = cause
  return { pid, etat: 'indetermine', erreurs: [erreur] }
}

/** L'unique `fin` native de `controle`, continuée par `puis` quand elle se résout ; REJETÉE, une cible sans résultat
 *  et un arrêt `indetermine` nommé par la cause du rejet, jamais un rejet ni la continuation (#2586). */
export function finNative(controle, puis = (fin) => fin) {
  return controle.fin.then(puis, (cause) => {
    const arret = arretIndetermine({ operation: 'fin', pid: controle.pid ?? undefined, cause })
    return { resultatCible: { status: null, signal: null, error: arret.erreurs[0] }, arret }
  })
}
