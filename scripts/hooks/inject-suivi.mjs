// Hook SessionStart du SUIVI DE VAGUE (#2132) : après une compaction ou une reprise, le suivi
// est en contexte sans que la session ait à se souvenir de le relire.
//
// Le lien vit au journal `<dossierDesSuivis>/.journal` (`scripts/hooks/suivi-lien-guard.mjs`), indexé
// par `session_id`. Compaction et reprise gardent ce `session_id` : le `digestDuSuivi` de chaque
// épique liée (`scripts/ops/suivi.mjs`), leur total sous `PLAFOND_INJECTION` ; quand la part d'un
// digest passe sous `PART_D_UN_DIGEST`, une ligne par épique liée (`lignesParEpique`). Une session
// neuve, un `/clear` ou un fork en ont un neuf : l'index des suivis modifiés depuis moins de
// `HEURES_INDEX`, et le geste qui lie. Il ne MESURE rien (ni `gh`, ni `fetch`) et n'écrit rien hors
// de son stdout.
//
// La clôture STATIQUE s'arrête à la porte de version (`scripts/node-requis.mjs`) : `ops/suivi.mjs`
// atteint un module TypeScript, il se charge après elle, par `import()`.
import '../node-requis.mjs'
import * as FS from 'node:fs'
import { join } from 'node:path'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'

const { PLAFOND_INJECTION, digestDuSuivi, dossierDesSuivis, horodatage, listerSuivis, relire } = await import('../ops/suivi.mjs')
const { JOURNAL, epiquesLiees, lignesDuJournal, sessionPrincipale } = await import('./suivi-lien-guard.mjs')

/** Fenêtre (h) de l'index des suivis d'une session sans lien. Valeur maison. */
export const HEURES_INDEX = 72

/**
 * Part (caractères) d'un digest en deçà de laquelle l'injection passe à une ligne par épique : l'en-tête,
 * le titre et l'Objectif du suivi réel #1816 (`scripts/ops/fixtures/suivi-1816.md`) en font 363. Valeur maison.
 */
export const PART_D_UN_DIGEST = 400

/** Le titre (`# …`, sans son dièse) d'un suivi, `''` sans titre. PURE. */
const titreDuSuivi = (texte) => (texte.split(/\r?\n/).find((l) => /^# /.test(l)) ?? '').replace(/^# /, '')

/** La ligne d'un suivi lié mais absent. PURE. */
const ligneAbsente = (epique, chemin) => `[suivi #${epique}] lié à cette session, mais absent : ${chemin}`

/**
 * Une ligne par épique liée, `[suivi #N] <titre> — lire <chemin>`, chacune coupée à sa part (le titre
 * d'abord), le total fin comprise sous `PLAFOND_INJECTION`. Quand même `[suivi #N]` ne tient plus dans
 * la part, les dernières épiques sont omises et une ligne dit combien.
 * @param {{liees: number[], dossier: string, fs: typeof FS}} params
 * @returns {string}
 */
function lignesParEpique({ liees, dossier, fs }) {
  const omises = (k) => (k < liees.length ? [`[suivi] ${liees.length - k} autres épiques liées à cette session, omises : ${dossier}`] : [])
  for (let k = liees.length; k > 0; k -= 1) {
    const queue = omises(k)
    const part = Math.floor((PLAFOND_INJECTION - queue.reduce((t, l) => t + l.length + 1, 0) - k) / k)
    const gardees = liees.slice(0, k)
    if (gardees.some((epique) => `[suivi #${epique}]`.length > part)) continue
    const lignes = gardees.map((epique) => {
      const chemin = join(dossier, `${epique}.md`)
      const texte = relire(chemin, fs)
      if (texte === null) return ligneAbsente(epique, chemin).slice(0, part)
      const tete = `[suivi #${epique}]`
      const fin = ` — lire ${chemin}`
      const place = part - tete.length - 1 - fin.length
      const titre = place > 0 ? coupeAuMot(titreDuSuivi(texte), place) : ''
      const ligne = `${titre ? `${tete} ${titre}` : tete}${fin}`
      return ligne.length <= part ? ligne : ligne.slice(0, part)
    })
    return `${[...lignes, ...queue].join('\n')}\n`
  }
  return `${omises(0)[0]}\n`.slice(0, PLAFOND_INJECTION)
}

/**
 * Le texte injecté au démarrage de la session `entree` : digests des épiques liées (une ligne par
 * épique quand la part d'un digest passe sous `PART_D_UN_DIGEST`), sinon l'index des suivis récents ;
 * `''` sans session principale ou sans rien à dire. Le total ne dépasse jamais `PLAFOND_INJECTION`.
 * @param {{entree: object, dossier: string, maintenant: Date, fs?: typeof FS}} params
 * @returns {string}
 */
export function texteDInjection({ entree, dossier, maintenant, fs = FS }) {
  if (!sessionPrincipale(entree)) return ''
  const liees = epiquesLiees(lignesDuJournal(relire(join(dossier, JOURNAL), fs) ?? ''), entree.session_id)
  // Chaque digest reçoit sa part du plafond, séparateurs `\n\n` et fin `\n` déduits : le TOTAL tient.
  const plafond = Math.floor((PLAFOND_INJECTION - 2 * liees.length) / Math.max(1, liees.length))
  if (liees.length && plafond < PART_D_UN_DIGEST) return lignesParEpique({ liees, dossier, fs })
  const digests = liees.map((epique) => {
    const chemin = join(dossier, `${epique}.md`)
    const texte = relire(chemin, fs)
    if (texte === null) return ligneAbsente(epique, chemin).slice(0, plafond)
    return digestDuSuivi(texte, { epique, chemin, mtime: fs.statSync(chemin).mtime, maintenant, plafond })
  })
  if (digests.length) return `${digests.join('\n\n')}\n`
  const recents = listerSuivis({ dossier, fs }).suivis
    .filter(({ date }) => maintenant.getTime() - date.getTime() < HEURES_INDEX * 3_600_000)
  if (!recents.length) return ''
  const lignes = recents.map(({ nom, date }) =>
    `- #${nom.replace(/\.md$/, '')} — ${titreDuSuivi(relire(join(dossier, nom), fs) ?? '')} — ${horodatage(date)}`)
  return [
    `[suivi] session sans suivi lié ; suivis de vague modifiés depuis moins de ${HEURES_INDEX} h (${dossier}) :`,
    ...lignes,
    '`npm run ops:suivi -- N` lie cette session au suivi #N.',
    '',
  ].join('\n')
}

if (import.meta.main) {
  let entree
  try {
    entree = JSON.parse(await lireStdinBorne())
  } catch {
    entree = null
  }
  const vu = dossierDesSuivis(process.cwd())
  if (vu.disponible) {
    const texte = texteDInjection({ entree, dossier: vu.valeur, maintenant: new Date() })
    if (texte) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texte } }))
  }
}
