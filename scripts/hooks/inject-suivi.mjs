// Hook SessionStart du SUIVI DE VAGUE (#2132, lot 2) : après une compaction ou une reprise, le suivi
// est en contexte sans que la session ait à se souvenir de le relire.
//
// Le lien vit au journal `<dossierDesSuivis>/.journal` (`scripts/hooks/suivi-lien-guard.mjs`), indexé
// par `session_id`. Compaction et reprise gardent ce `session_id` : le `digestDuSuivi` de chaque
// épique liée (`scripts/ops/suivi.mjs`), leur total sous `PLAFOND_INJECTION`. Une session neuve, un
// `/clear` ou un fork en ont un neuf : l'index des suivis modifiés depuis moins de `HEURES_INDEX`, et
// le geste qui lie. Il ne MESURE rien (ni `gh`, ni `fetch`) et n'écrit rien hors de son stdout.
//
// La clôture STATIQUE s'arrête à la porte de version (`scripts/node-requis.mjs`) : `ops/suivi.mjs`
// atteint un module TypeScript, il se charge après elle, par `import()`.
import '../node-requis.mjs'
import * as FS from 'node:fs'
import { join } from 'node:path'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'

const { PLAFOND_INJECTION, digestDuSuivi, dossierDesSuivis, horodatage, listerSuivis, relire } = await import('../ops/suivi.mjs')
const { JOURNAL, epiquesLiees, lignesDuJournal, sessionPrincipale } = await import('./suivi-lien-guard.mjs')

/** Fenêtre (h) de l'index des suivis d'une session sans lien. Valeur maison. */
export const HEURES_INDEX = 72

/**
 * Le texte injecté au démarrage de la session `entree` : digests des épiques liées, sinon l'index
 * des suivis récents ; `''` sans session principale ou sans rien à dire.
 * @param {{entree: object, dossier: string, maintenant: Date, fs?: typeof FS}} params
 * @returns {string}
 */
export function texteDInjection({ entree, dossier, maintenant, fs = FS }) {
  if (!sessionPrincipale(entree)) return ''
  const liees = epiquesLiees(lignesDuJournal(relire(join(dossier, JOURNAL), fs) ?? ''), entree.session_id)
  // Chaque digest reçoit sa part du plafond, séparateurs `\n\n` et fin `\n` déduits : le TOTAL tient.
  const plafond = Math.floor((PLAFOND_INJECTION - 2 * liees.length) / Math.max(1, liees.length))
  const digests = liees.flatMap((epique) => {
    const chemin = join(dossier, `${epique}.md`)
    const texte = relire(chemin, fs)
    if (texte === null) return [`[suivi #${epique}] lié à cette session, mais absent : ${chemin}`.slice(0, plafond)]
    return [digestDuSuivi(texte, { epique, chemin, mtime: fs.statSync(chemin).mtime, maintenant, plafond })]
  })
  if (digests.length) return `${digests.join('\n\n')}\n`
  const recents = listerSuivis({ dossier, fs }).suivis
    .filter(({ date }) => maintenant.getTime() - date.getTime() < HEURES_INDEX * 3_600_000)
  if (!recents.length) return ''
  const lignes = recents.map(({ nom, date }) => {
    const titre = (relire(join(dossier, nom), fs) ?? '').split(/\r?\n/).find((l) => /^# /.test(l)) ?? ''
    return `- #${nom.replace(/\.md$/, '')} — ${titre.replace(/^# /, '')} — ${horodatage(date)}`
  })
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
  if (vu.disponible) process.stdout.write(texteDInjection({ entree, dossier: vu.valeur, maintenant: new Date() }))
}
