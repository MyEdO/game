// GARDE du dépôt (#1993) : sous `scripts/docs/` et `scripts/gates/`, aucun NUMÉRO DE LIGNE vers un
// AUTRE fichier — en commentaire, en chaîne ou dans une prose émise vers un doc généré. Un numéro de
// ligne périme au premier geste dans le fichier visé, sans que rien ne le voie ; la réf porte une
// ANCRE STABLE (symbole, nom de test, titre de section).
// Deux formes : `fichier.ext:NN`, et `l.NN` — derrière un nom de fichier (fin de ligne et marques de
// commentaire comprises entre les deux), derrière un symbole ou seul. Une réf vers le fichier LUI-MÊME
// (même nom de base) est permise ; une citation RAW (`LDB 09 l.294` : abréviation d'un livre du
// registre, lue par `refReDe` de `scripts/raw/_lib.mjs`, suites MULTI-CHAPITRES `/NN l.` comprises) et
// une chaîne qui COMMENCE par `l.NN` (étiquette de ligne émise, donnée) ne sont pas des réfs de fichier.
// Ce que `refReDe` n'admet pas (`l.157/l.170`) n'est pas une citation : son `l.NN` reste vu.
// Banc et balayage : `refsDeLigne.test.mjs`, joué par `test:hooks`.
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRAVAIL, depotDe, listerImage } from './gitPorte.mjs'
import { alternationDuRegistre, refReDe } from '../../raw/_lib.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/** Dossiers balayés, relatifs POSIX. */
export const RACINES_BALAYEES = ['scripts/docs/', 'scripts/gates/']

/** Un chemin (ou un nom nu, point initial compris : `.gitignore`) dont l'extension commence par une
 *  lettre. Jamais précédé d'un caractère de chemin ni d'un `\` — `\.md:9` est une expression régulière. */
const FICHIER = String.raw`(?<![\w./\\-])((?:[\w.-]+\/)*[\w.-]*\.[A-Za-z]\w*)`
/** `fichier.ext:NN`. */
const REF = new RegExp(`${FICHIER}:(\\d+)`, 'g')
/** `l.NN[-MM|+NN…|/NN…]`, numéro de ligne dit en toutes lettres. */
const L_NN = /(?<![\w.])l\.\d+(?:[-+/]\d+)*/g
/** Nom de fichier en fin de texte, suivi de blancs, marques de commentaire ou ponctuation d'encadrement. */
const FICHIER_EN_FIN = new RegExp(`${FICHIER}[\\s\`'"*/#(),;]*$`)
/** Fenêtre lue avant un `l.NN` pour y trouver le fichier nommé. */
const FENETRE = 200

/** Étendues `[début, fin[` des citations RAW du texte. Une suite `/NN l.…` que `refReDe` refuse à la
 *  citation (réf MULTI-CHAPITRES, `scripts/raw/_lib.test.mjs`) se relit par la MÊME grammaire, le
 *  livre de la citation restitué devant elle ; une suite sans chapitre n'en est pas une. */
function citationsRaw(t) {
  const alt = alternationDuRegistre()
  const suiteRe = new RegExp(refReDe(alt).source, 'y')
  return [...t.matchAll(refReDe(alt))].map((m) => {
    let fin = m.index + m[0].length
    for (let suite; t[fin] === '/'; fin += suite[0].length - m[1].length) {
      suiteRe.lastIndex = 0
      suite = suiteRe.exec(`${m[1]} ${t.slice(fin + 1)}`)
      if (suite?.[2] === undefined) break
    }
    return [m.index, fin]
  })
}

/** Numéros de ligne vers un autre fichier que `fichier` : `[{ ligne, ref }]`, ligne 1-indexée, dans l'ordre
 *  du texte. PURE. */
export function sitesFautifs(texte, fichier) {
  const soi = basename(fichier)
  const t = String(texte).replace(/\r\n/g, '\n')
  const ligneDe = (i) => t.slice(0, i).split('\n').length
  const raw = citationsRaw(t)
  const sites = [...t.matchAll(REF)]
    .filter((m) => basename(m[1]) !== soi)
    .map((m) => ({ i: m.index, ref: m[0] }))
  for (const m of t.matchAll(L_NN)) {
    if (raw.some(([a, b]) => m.index >= a && m.index < b) || `'"`.includes(t[m.index - 1])) continue
    const nomme = FICHIER_EN_FIN.exec(t.slice(Math.max(0, m.index - FENETRE), m.index))?.[1]
    if (nomme && basename(nomme) === soi) continue
    sites.push({ i: m.index, ref: nomme ? `${nomme} ${m[0]}` : m[0] })
  }
  return sites.sort((a, b) => a.i - b.i).map((s) => ({ ligne: ligneDe(s.i), ref: s.ref }))
}

/** Fichiers balayés, relatifs POSIX, triés : l'image `TRAVAIL` de l'hôte (`listerImage`). LÈVE si
 *  elle est vide. */
export function fichiersBalayes(racine = RACINE) {
  const fichiers = listerImage(depotDe(racine), TRAVAIL, ...RACINES_BALAYEES)
  if (!fichiers.length) throw new Error(`refsDeLigne : git ne rend aucun fichier de ${racine} — le balayage ne se devine pas`)
  return [...new Set(fichiers)].sort()
}
