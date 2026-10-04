// PAQUET AUTOSUFFISANT d'un système de règles (#1887, lot 7) : le relevé de ses termes (`releve.mjs`)
// rendu en Markdown DÉTERMINISTE, que l'agent de tri reçoit dans sa consigne sans relire le livre.
//  - `regle` : chaque section, dédupliquée par adresse, en-tête `NNN l.X — titre [origines]`, puis le
//    texte RÉSOLU de son adresse (`resoudreAdresse`), verbatim, sans troncature ;
//  - `entite` : la liste des déclencheurs, titre et réf, sans texte ;
//  - `ambigus` et `introuvables`, nommés.
//
// Lancer : node scripts/raw/paquet.mjs <id du livre> [--sans-mention] <terme>…
//          (paquet sur la sortie standard, tailles par origine sur la sortie d'erreur)
import { ORIGINES, cleDAdresse, livreDuReleve, releve } from './releve.mjs'
import { estErreur, resoudreAdresse } from '../../src/data/source/decoupe.ts'
import { parUnitesDeCode } from '../../src/lib/ordre.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

/** Les sections relevées de plusieurs termes, fusionnées par adresse, origines marquées du terme. */
function fusion(liste) {
  const parAdresse = new Map()
  for (const { terme, it } of liste) {
    const k = cleDAdresse(it.adresse)
    if (!parAdresse.has(k)) parAdresse.set(k, { ...it, origines: [] })
    const fu = parAdresse.get(k)
    for (const o of it.origines) fu.origines.push({ origine: o, terme })
  }
  return [...parAdresse.values()]
}

/** Ordre du livre : rang du fichier, puis ligne. */
function trier(livre, items) {
  const rangs = new Map([...livre.indexe.chapitres.keys()].map((f, i) => [f, i]))
  return [...items].sort((a, b) => rangs.get(a.fichier) - rangs.get(b.fichier) || a.ligne - b.ligne || parUnitesDeCode(cleDAdresse(a.adresse), cleDAdresse(b.adresse)))
}

/** Une adresse de blocs INCLUSE dans une autre de la même section se replie sur elle, origines
 *  comprises : le paquet ne porte jamais deux fois le même texte. */
function replier(items) {
  const bornes = (it) => {
    const [f] = it.adresse.parts
    return it.adresse.parts.length === 1 && f.kind === 'blocs' ? { cle: `${it.fichier}\u0000${f.sec}#${f.secOcc}`, b0: f.b0, b1: f.b1 } : null
  }
  const contient = (o, b) => {
    const c = bornes(o)
    return c != null && c.cle === b.cle && c.b0 <= b.b0 && b.b1 <= c.b1
  }
  const hoteDe = (it) => {
    const b = bornes(it)
    return b ? items.find((o) => o !== it && contient(o, b)) : undefined
  }
  const gardes = items.filter((it) => !hoteDe(it))
  for (const it of items) {
    let hote = hoteDe(it)
    while (hote && hoteDe(hote)) hote = hoteDe(hote)
    if (hote) hote.origines.push(...it.origines.filter((o) => !hote.origines.some((h) => h.origine === o.origine && h.terme === o.terme)))
  }
  return gardes
}

const etiquettes = (it) => it.origines.map(({ origine, terme }) => `${origine} « ${terme} »`).join(', ')

/** Texte verbatim d'une adresse ; une adresse qui ne résout pas est une ERREUR. */
function texteDe(livre, it) {
  const r = resoudreAdresse(livre.indexe.chapitres.get(it.fichier), it.adresse)
  if (estErreur(r)) throw new Error(`paquet : ${it.ref} ne résout pas — ${r.error} : ${r.detail}`)
  return r.md
}

/** Le relevé fusionné de plusieurs termes : sections de règle et d'entité, ambigus, introuvables. */
export function releveDesTermes(livre, termes, options = {}) {
  const releves = termes.map((t) => releve(livre, t, options))
  const de = (cle) => releves.flatMap((r) => r[cle].map((it) => ({ terme: r.terme, it })))
  return {
    regle: trier(livre, fusion(de('regle'))),
    entite: trier(livre, fusion(de('entite'))),
    ambigus: releves.flatMap((r) => r.ambigus.map((a) => ({ terme: r.terme, ...a }))),
    introuvables: releves.flatMap((r) => r.introuvables.map((i) => ({ terme: r.terme, ...i }))),
  }
}

/** Paquet Markdown d'un système : ses termes relevés, avec `options.origines` (`releve`). */
export function paquet(livre, termes, options = {}) {
  const { ambigus, introuvables, ...r } = releveDesTermes(livre, termes, options)
  const [regle, entite] = [replier(r.regle), replier(r.entite)]
  const out = [`# Paquet — ${livre.book} — ${termes.map((t) => `« ${t} »`).join(', ')}`, '', `## Règle (${regle.length})`, '']
  for (const it of regle) out.push(`### ${it.ref} — ${it.titre} [${etiquettes(it)}]`, '', texteDe(livre, it), '')
  out.push(`## Entités (${entite.length})`, '')
  for (const it of entite) out.push(`- ${it.ref} — ${it.titre} [${etiquettes(it)}]`)
  out.push('', `## Ambigus (${ambigus.length})`, '')
  for (const a of ambigus) out.push(`- « ${a.entree.terme} » p.${a.page} (${a.niveau}, terme « ${a.terme} ») : ${a.candidats.join(' ; ')}`)
  out.push('', `## Introuvables (${introuvables.length})`, '')
  for (const i of introuvables) out.push(`- ${i.section ?? `« ${i.entree.terme} » p.${i.page}`} (${i.origine}, terme « ${i.terme} ») : ${i.erreur}${i.detail ? ` — ${i.detail}` : ''}`)
  return `${out.join('\n')}\n`
}

/** Tailles en caractères : le paquet entier, et le texte des sections de règle par origine (une
 *  section à plusieurs origines compte dans chacune). */
export function taillesDuPaquet(livre, termes, options = {}) {
  const regle = replier(releveDesTermes(livre, termes, options).regle)
  const parOrigine = tableTotale(ORIGINES, () => 0)
  for (const it of regle) {
    const n = texteDe(livre, it).length
    for (const o of new Set(it.origines.map((x) => x.origine))) parOrigine[o] += n
  }
  return { paquet: paquet(livre, termes, options).length, sections: regle.length, parOrigine }
}

function main() {
  const args = process.argv.slice(2)
  const sansMention = args.includes('--sans-mention')
  const [bookId, ...termes] = args.filter((a) => a !== '--sans-mention')
  if (!bookId || !termes.length) {
    console.error('Usage : node scripts/raw/paquet.mjs <id du livre> [--sans-mention] <terme>…')
    process.exitCode = 2
    return
  }
  const livre = livreDuReleve(bookId)
  const options = sansMention ? { origines: ORIGINES.filter((o) => o !== 'mention') } : {}
  process.stdout.write(paquet(livre, termes, options))
  console.error(JSON.stringify(taillesDuPaquet(livre, termes, options)))
}

if (import.meta.main) main()
