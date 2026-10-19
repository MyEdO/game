/** Le texte d'une `cause` quelconque, sans jamais lever : son `message` texte, sinon la marque d'un objet, sinon la
 *  conversion d'une primitive (#2586). */
export function texteDeCause(cause) {
  if (typeof cause?.message === 'string') return cause.message
  return cause !== null && (typeof cause === 'object' || typeof cause === 'function') ? Object.prototype.toString.call(cause) : String(cause)
}

/** Arrêt `indetermine` de l'`operation` sur `pid` : le `code` de sa `cause`, gardée entière pour sa chaîne, et le
 *  `message` donné, sinon le texte de la cause (`texteDeCause`) ; ne lève jamais, quelle que soit la cause (#2586). */
export function arretIndetermine({ operation, pid, cause, message = texteDeCause(cause) }) {
  const erreur = { operation, pid, code: cause?.code, message }
  if (cause !== undefined) erreur.cause = cause
  return { pid, etat: 'indetermine', erreurs: [erreur] }
}
