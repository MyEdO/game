// #2603
import { isAbsolute, resolve } from 'node:path'

/** Un texte qui porte un caractère de CONTRÔLE (C0 ou DEL) : il ne tient pas sur UNE ligne d'un lot
 *  `cat-file --batch`/`--batch-check`, une requête par ligne (`git help cat-file`, « BATCH OUTPUT »). */
export const porteUnControle = (texte) => [...texte].some((c) => c < ' ' || c === '\x7f')

export const MARQUE_RACINE_MESUREE = '<RACINE>'

export function normaliserRequeteMesuree(racine, requete) {
  const base = resolve(racine).replace(/\\/g, '/').replace(/\/$/, '')
  const motif = new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=/|$|[\\s\'"\\x00])', process.platform === 'win32' ? 'gi' : 'g')
  const normaliser = (s) => String(s ?? '').replace(/\\/g, '/').replace(motif, MARQUE_RACINE_MESUREE)
  return { args: requete.args.map(normaliser), cwd: requete.cwd, ...(requete.canal === 'stdout' ? { canal: 'stdout' } : {}), status: requete.status ?? null,
    stdout: normaliser(requete.stdout), stderr: normaliser(requete.stderr) }
}

export function verifierRequeteMesuree(requete) {
  const refus = (raison) => { throw new TypeError(`requête Git mesurée non certifiable : ${raison}`) }
  if (requete?.canal !== undefined && requete.canal !== 'stdout') refus('canal inconnu')
  if (!Array.isArray(requete?.args) || !requete.args.length || requete.args.some((a) => typeof a !== 'string' || porteUnControle(a))) refus('arguments invalides')
  if (typeof requete.cwd !== 'string' || requete.cwd.includes('\\') || isAbsolute(requete.cwd) || requete.cwd.split('/').includes('..') || porteUnControle(requete.cwd)) refus('cwd hors racine')
  const args = [...requete.args]
  while (args[0] === '-c') {
    args.shift()
    if (!['core.quotepath=false', 'merge.conflictstyle=merge', 'i18n.logoutputencoding=utf-8'].includes(String(args.shift()).toLowerCase())) refus('configuration non autorisée')
  }
  if (args[0] === '--literal-pathspecs') args.shift()
  const commande = args.shift()
  const drapeaux = {
    'ls-files': /^(?:-z|--cached|--stage|--others|--ignored|--exclude-standard|--directory|--full-name)$/,
    'log': /^(?:-1|--no-renames|--name-only|--diff-filter=[ACDMRTUXB*]+|--format=(?:%[a-zA-Z]|[^%\r\n])*)$/,
    'rev-parse': /^(?:--show-toplevel|--verify|--quiet|--short(?:=\d+)?|--is-shallow-repository)$/,
  }[commande]
  if (!drapeaux) refus(`commande ${commande ?? '<absente>'}`)
  let chemins = false
  for (const a of args) {
    if (a === '--') { chemins = true; continue }
    if (!chemins && a.startsWith('-')) { if (!drapeaux.test(a)) refus(`drapeau ${a}`); continue }
    const p = a.replaceAll(MARQUE_RACINE_MESUREE, '')
    if (p.split(/[\\/]/).includes('..') || (!a.startsWith(MARQUE_RACINE_MESUREE) && (isAbsolute(a) || /^[A-Za-z]:/.test(a)))) refus(`chemin hors racine ${a}`)
  }
  return true
}
