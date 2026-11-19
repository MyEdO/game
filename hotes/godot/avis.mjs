// LES AVIS DE LICENCE D'UNE FABRICATION (#4063) : ce que `--export` et `--bureau` (`construire.mjs`) embarquent, chaque
// œuvre tierce avec le texte que sa licence demande de joindre à toute copie, tiré de sa source : le moteur Godot par
// lui-même (`projet/outils/avis_du_moteur.gd`), chaque paquet npm fondu dans un bundle par les textes de son dossier, lu
// aux modules que le bundle porte réellement, runtime injecté par le bundler compris, le Node du noyau embarqué par le
// `LICENSE` de sa distribution, chaque asset du projet par le texte que sa provenance nomme, CC0-1.0 exceptée.
// `deposerLesAvis` les écrit sous `AVIS`, à côté de ce que la fabrication écrit, ou rend une erreur par avis qui
// manque, l'œuvre et le chemin cherché nommés.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { listerDossier } from '../../scripts/guards/lib/lister.mjs'

/** Le dossier des avis, à côté de ce que la fabrication écrit. */
export const AVIS = 'licences'

/** Un avis : l'œuvre qu'il couvre, le fichier où il se dépose sous `AVIS`, son texte (`null` s'il manque) et la source
 *  où il est cherché. */
const avis = (oeuvre, fichier, source, texte) => ({ oeuvre, fichier, source, texte })

/** Le texte d'un fichier, ou `null` s'il n'existe pas. */
const lu = (chemin) => (existsSync(chemin) ? readFileSync(chemin, 'utf8') : null)

/** Le dossier du paquet npm d'un module d'un bundle : son id jusqu'au nom qui suit le dernier `node_modules`. */
const DOSSIER_DE_PAQUET = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/

/** Le préfixe des modules virtuels que le bundler injecte dans un bundle (`\0rolldown/runtime.js`) : leur code vient du
 *  paquet `rolldown`. */
const VIRTUEL_DU_BUNDLER = '\0rolldown/'

/** Le dossier du paquet npm d'où vient le code du module `id` d'un bundle, ou `undefined` pour le code du projet. */
const paquetDe = (id) => (id.startsWith(VIRTUEL_DU_BUNDLER)
  ? dirname(createRequire(import.meta.url).resolve('rolldown/package.json'))
  : DOSSIER_DE_PAQUET.exec(id)?.[1])

/** Un texte de licence d'un paquet npm : chaque fichier de son dossier nommé `LICENSE`, `LICENCE` ou `COPYING`, toute
 *  casse, seul, en `.md` ou `.txt`, ou en fin de nom (`THIRD-PARTY-LICENSE`). */
const TEXTE_DE_PAQUET = /(^|[-_])(licen[cs]e|copying)(\.(md|txt))?$/i

/** L'avis de chaque paquet npm d'où vient le code d'un module parmi `modules`, les ids des modules d'un bundle : ses
 *  textes de licence mis bout à bout. */
export function avisDesPaquets(modules) {
  const dossiers = [...new Set(modules.flatMap((id) => paquetDe(id) ?? []))].sort()
  return dossiers.map((dossier) => {
    const { name, version } = JSON.parse(readFileSync(join(dossier, 'package.json'), 'utf8'))
    const textes = listerDossier(dossier).filter((f) => TEXTE_DE_PAQUET.test(f)).map((f) => join(dossier, f))
    const source = textes.length ? textes.join(', ') : join(dossier, 'LICENSE')
    return avis(`${name}@${version}`, `npm-${name.replace('/', '+')}.txt`, source, textes.length ? textes.map((t) => readFileSync(t, 'utf8')).join('\n\n') : null)
  })
}

/** L'avis du Node `executable`, son texte au chemin `licence` relatif au dossier de l'exécutable. */
export function avisDeNode(executable, licence, version) {
  const source = join(executable, '..', licence)
  return avis(`Node.js ${version}`, 'node.txt', source, lu(source))
}

/** La licence que les assets épinglés portent sans avis à joindre. */
const SANS_AVIS = /^CC0-1\.0\b/

/** Le texte de licence que nomme la licence d'une provenance : `<SPDX> (<texte>.txt)`. */
const TEXTE_NOMME = /\((LICENSE[^()]*\.txt)\)/

/** L'avis de chaque asset du projet `projet` dont la licence en demande un : chaque entrée de la provenance
 *  (`provenance.json`) de chacun de ses dossiers, hors CC0-1.0, avec le texte qu'elle nomme dans son dossier. */
export function avisDesAssets(projet) {
  return listerDossier(projet).flatMap((nom) => {
    const provenance = lu(join(projet, nom, 'provenance.json'))
    if (provenance === null) return []
    return Object.entries(JSON.parse(provenance)).flatMap(([fichier, { licence }]) => {
      if (SANS_AVIS.test(licence)) return []
      const texte = TEXTE_NOMME.exec(licence)?.[1]
      const source = join(projet, nom, texte ?? 'LICENSE*.txt')
      return [avis(`${nom}/${fichier} (${licence})`, `${nom}-${texte ?? basename(fichier)}`, source, texte ? lu(source) : null)]
    })
  })
}

/** La source des avis du moteur, que dit une erreur. */
const SOURCE_DE_GODOT = 'Engine.get_license_text(), Engine.get_copyright_info(), Engine.get_license_info() (projet/outils/avis_du_moteur.gd)'

/** L'avis du moteur Godot depuis ce qu'il rend de lui-même (`moteur` : `{ texte, composants, licences }` écrit par
 *  `projet/outils/avis_du_moteur.gd`, `null` s'il n'a rien écrit) : sa licence, chaque composant tiers avec ses
 *  fichiers, ses titulaires et sa licence, puis le texte de chaque licence nommée. Muet (un texte vide, aucun
 *  composant, une licence nommée sans texte), l'avis manque. */
export function avisDeGodot(moteur) {
  const nommees = [...new Set((moteur?.composants ?? []).flatMap((c) => c.parts.flatMap((p) => p.license.split(/\s+(?:and|or)\s+/))))].sort()
  const muet = !moteur?.texte || !moteur.composants.length || nommees.some((l) => !moteur.licences[l])
  if (muet) return avis('Godot Engine', 'godot.txt', SOURCE_DE_GODOT, null)
  const composants = moteur.composants.map(({ name, parts }) => [
    `- ${name}`,
    ...parts.flatMap((p) => [`  Fichiers : ${p.files.join(', ')}`, ...p.copyright.map((c) => `  © ${c}`), `  Licence : ${p.license}`]),
  ].join('\n'))
  const licences = nommees.map((l) => `----- ${l} -----\n\n${moteur.licences[l]}`)
  return avis('Godot Engine', 'godot.txt', SOURCE_DE_GODOT, [moteur.texte, 'Composants tiers :', ...composants, ...licences].join('\n\n'))
}

/** Les avis `liste` écrits sous `AVIS` de `sortie` : rend une erreur par avis qui manque, sans rien écrire, sinon
 *  aucune. */
export function deposerLesAvis(sortie, liste) {
  const manquants = liste.filter((a) => a.texte === null).map((a) => `avis de licence absent : ${a.oeuvre}, cherché à ${a.source}`)
  if (manquants.length) return manquants
  mkdirSync(join(sortie, AVIS), { recursive: true })
  for (const a of liste) writeFileSync(join(sortie, AVIS, a.fichier), a.texte)
  console.log(`[avis] ${liste.length} avis de licence sous ${join(sortie, AVIS)} : ${liste.map((a) => a.oeuvre).join(', ')}`)
  return []
}
