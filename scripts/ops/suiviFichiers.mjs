// LES FICHIERS du suivi de vague (#2460) : noms, relecture, écriture atomique sous verrou, listage et lecture
// d'un suivi avec sa mesure. Importé par le CLI `scripts/ops/suivi.mjs` comme par la mesure
// `scripts/ops/suiviMesure.mjs`, sans cycle : il n'importe ni l'un ni l'autre.
//
// L'ÉCRITURE. Suivi comme mesure : `ecrireSuivi`, sous le verrou exclusif `.<nom>.verrou` voisin
// (`prendreVerrou`, scripts/test/verrou.mjs), par un temporaire `.<nom>.<pid>.tmp`, texte relu juste avant
// le `rename` (refus s'il a changé).
import * as FS from 'node:fs'
import { join } from 'node:path'
import { listerDossier } from '../guards/lib/lister.mjs'
import { prendreVerrou } from '../test/verrou.mjs'
import { lireMesure, lireSuivi } from './suiviDonnee.mjs'

const SUIVI = /^\d+\.json$/
const ORPHELIN = /^\.\d+\.(?:mesure\.)?json\.\d+\.tmp$/
const TENU = new Set(['EPERM', 'EACCES', 'EBUSY'])

/** Le fichier du suivi de l'épique `n`. PURE. */
export const nomDuSuivi = (n) => `${n}.json`
/** Le fichier de la mesure du suivi de l'épique `n`. PURE. */
export const nomDeLaMesure = (n) => `${n}.mesure.json`

/** Le texte de `cible`, ou `null` si elle n'existe plus (`ENOENT`) ; toute autre erreur est relancée. */
export function relire(cible, fs) {
  try {
    return fs.readFileSync(cible, 'utf8')
  } catch (e) {
    if (e?.code === 'ENOENT') return null
    throw e
  }
}

/**
 * Écrit `contenu` sur `cible` par un temporaire `.<nom>.<pid>.tmp` voisin, APRÈS avoir relu `cible`
 * et vérifié qu'elle vaut encore `attendu` (`null` : qu'elle n'existe pas). Temporaire non écrit, cible
 * disparue ou apparue, texte changé, ou `rename` en EPERM/EACCES/EBUSY → refus nommé, temporaire supprimé,
 * cible intacte ; toute autre erreur est relancée, temporaire supprimé. Un temporaire que le nettoyage ne
 * peut pas supprimer est NOMMÉ dans le refus (`listerSuivis` le retrouve en orphelin), sans jamais masquer
 * l'erreur d'origine. La relecture, la comparaison et le `rename` se font sous le verrou EXCLUSIF
 * `.<nom>.verrou` voisin (`prendreVerrou`) ; un verrou tenu par un processus vivant est un refus.
 * `rejouable` dit qu'un refus tient à un autre écrivain (verrou pris, texte changé ou apparu) : le même
 * geste, rejoué sur le texte frais, peut passer. `geste` nomme ce pendant quoi le texte a changé.
 * @param {{cible: string, contenu: string, attendu: string|null, geste: string, fs?: typeof FS, pid?: number}} params
 * @returns {{ok: true} | {ok: false, refus: string, rejouable: boolean}}
 */
export function ecrireSuivi({ cible, contenu, attendu, geste, fs = FS, pid = process.pid }) {
  const dossier = join(cible, '..')
  const nom = cible.replace(/\\/g, '/').split('/').pop()
  const verrou = prendreVerrou({ chemin: join(dossier, `.${nom}.verrou`), libelle: `suivi ${nom} en cours d'écriture`, pid, commande: 'scripts/ops/suivi.mjs', cwd: dossier })
  if (verrou.etat !== 'pris') return { ok: false, refus: `${cible} est en cours d'écriture par un autre processus : rien n'est écrit`, rejouable: true }
  try {
    return ecrireSousVerrou({ cible, contenu, attendu, geste, fs, pid, dossier, nom })
  } finally {
    verrou.liberer()
  }
}

/** Le corps de `ecrireSuivi`, verrou tenu. */
function ecrireSousVerrou({ cible, contenu, attendu, geste, fs, pid, dossier, nom }) {
  const temporaire = join(dossier, `.${nom}.${pid}.tmp`)
  const refuser = (refus, rejouable = false) => {
    try {
      fs.rmSync(temporaire, { force: true })
      return { ok: false, refus, rejouable }
    } catch (nettoyage) {
      return { ok: false, refus: `${refus} ; temporaire RESTANT, non supprimé (${nettoyage?.code ?? nettoyage?.message}) : ${temporaire}`, rejouable: false }
    }
  }
  const relancee = (e) => {
    const reste = refuser('').refus
    if (reste && e instanceof Error) e.message += reste
    return e
  }
  try {
    fs.writeFileSync(temporaire, contenu)
  } catch (e) {
    return refuser(`temporaire ${temporaire} non écrit (${e?.code ?? e?.message}) : rien n'est écrit, relancer`)
  }
  let actuel
  try {
    actuel = relire(cible, fs)
  } catch (e) {
    throw relancee(e)
  }
  if (attendu === null && actuel !== null) return refuser(`${cible} est apparu pendant ${geste} : rien n'est écrit, relancer`, true)
  if (attendu !== null && actuel === null) return refuser(`${cible} a disparu pendant ${geste} : rien n'est écrit`)
  if (attendu !== null && actuel !== attendu) return refuser(`${cible} a changé pendant ${geste} : rien n'est écrit, relancer`, true)
  try {
    fs.renameSync(temporaire, cible)
    return { ok: true }
  } catch (e) {
    if (!TENU.has(e?.code)) throw relancee(e)
    return refuser(`suivi tenu par un autre processus (${e.code} au rename de ${cible}), relancer`, true)
  }
}

/**
 * Les suivis d'un dossier (`^\d+\.json$`, avec leur date) et les temporaires ORPHELINS
 * (`^\.\d+\.(mesure\.)?json\.\d+\.tmp$`) d'une écriture interrompue — nommés, jamais supprimés ici.
 * @param {{dossier: string, fs?: typeof FS}} params
 * @returns {{suivis: {nom: string, date: Date}[], orphelins: string[]}}
 */
export function listerSuivis({ dossier, fs = FS }) {
  const noms = listerDossier(dossier, { absent: 'vide' })
  return {
    suivis: noms.filter((n) => SUIVI.test(n)).map((nom) => ({ nom, date: fs.statSync(join(dossier, nom)).mtime })),
    orphelins: noms.filter((n) => ORPHELIN.test(n)),
  }
}

/** Les suivis LISIBLES de `dossier` (scellés par l'outil ou non), lus UNE fois pour toutes les confrontations. */
export function suivisLisibles({ dossier, fs }) {
  return listerDossier(dossier, { absent: 'vide' }).filter((nom) => SUIVI.test(nom))
    .map((nom) => lireSuivi(relire(join(dossier, nom), fs) ?? '').suivi).filter(Boolean)
}

/**
 * Le suivi de l'épique `epique` LU dans `dossier`, avec sa mesure : `suivi` (`null` s'il est absent ou
 * illisible ; le suivi lu s'il est valide mais écrit hors de l'outil), `alerte` (`null` s'il est lu et
 * scellé par l'outil ; hors outil, elle nomme `--reconnaitre`), `mesure` (`lireMesure`) et `autres`, les
 * autres suivis lisibles du dossier, que lit la confrontation : pris dans `lisibles` quand l'appelant les a
 * déjà lus (`suivisLisibles`), lus sinon. Un `<N>.md` sans `<N>.json` est nommé, jamais lu.
 * @param {{dossier: string, epique: number, lisibles?: object[]|null, fs?: typeof FS}} params
 * @returns {{epique: number, chemin: string, suivi: object|null, alerte: string|null, mesure: ReturnType<typeof lireMesure>, autres: object[]}}
 */
export function lireLeSuivi({ dossier, epique, lisibles = null, fs = FS }) {
  const chemin = join(dossier, nomDuSuivi(epique))
  const texte = relire(chemin, fs)
  const mesure = lireMesure(relire(join(dossier, nomDeLaMesure(epique)), fs))
  if (texte === null) {
    const md = join(dossier, `${epique}.md`)
    return { epique, chemin, suivi: null, mesure, autres: [], alerte: fs.existsSync(md) ? `format .md abandonné : ${md}` : `lié à cette session, mais absent : ${chemin}` }
  }
  const vu = lireSuivi(texte)
  const autres = vu.suivi ? (lisibles ?? suivisLisibles({ dossier, fs })).filter((s) => s.epique !== epique) : []
  const lus = { epique, chemin, suivi: vu.suivi ?? null, mesure, autres }
  if (vu.ok) return { ...lus, alerte: null }
  if (vu.genre === 'empreinte') return { ...lus, alerte: `⚠ ${vu.refus} — ${chemin} ; \`npm run ops:suivi -- ${epique} --reconnaitre <motif>\` le re-scelle en le signalant` }
  return { ...lus, alerte: `⚠ illisible, ${vu.refus} — ${chemin}` }
}
