// Hook SessionStart du suivi de vague (#2132) : le point d'entrée RÉEL, rejoué par `node` sur
// un dépôt forgé dont le `.git/suivi` porte la fixture et un journal forgé ; puis `texteDInjection` sur
// un dossier jetable, pour la borne du total.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as FS from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { PLAFOND_INJECTION } from '../ops/suivi.mjs'
import { PART_D_UN_DIGEST, texteDInjection } from './inject-suivi.mjs'
import { JOURNAL, ligneDeJournal } from './suivi-lien-guard.mjs'

const REEL = FS.readFileSync(new URL('../ops/fixtures/suivi-1816.md', import.meta.url), 'utf8')
const HOOK = fileURLToPath(new URL('./inject-suivi.mjs', import.meta.url))

/** Le hook lancé dans `racine` sur l'entrée `entree` : son code et son stdout. */
function lancer(racine, entree) {
  const vu = spawnSync(process.execPath, [HOOK], { cwd: racine, input: JSON.stringify(entree), encoding: 'utf8', timeout: 30_000 })
  return { code: vu.status, stdout: vu.stdout, stderr: vu.stderr }
}

test('T4 — compaction d’une session LIÉE : le digest du suivi, Objectif et prochaine étape `[ ]` ; sans lien, l’index', () => {
  const { racine } = instanceDeDepot({ commit: false })
  const dossier = join(racine, '.git', 'suivi')
  try {
    FS.mkdirSync(dossier, { recursive: true })
    FS.writeFileSync(join(dossier, '1816.md'), REEL)
    FS.writeFileSync(join(dossier, JOURNAL), ligneDeJournal({ iso: new Date().toISOString(), session: 's', epique: 1816 }))

    const lie = lancer(racine, { hook_event_name: 'SessionStart', source: 'compact', session_id: 's' })
    assert.equal(lie.code, 0, lie.stderr)
    assert.match(lie.stdout, /^\[suivi #1816\] .*1816\.md — écrit le /)
    assert.ok(lie.stdout.includes('## Objectif\nÉpique #1816, « Tout le plan, dans l\'ordre »'), lie.stdout.slice(0, 600))
    assert.ok(lie.stdout.includes(REEL.split('\n').find((l) => l.includes('[ ]'))), 'la prochaine étape ouverte')
    assert.doesNotMatch(lie.stdout, /\[x\]|lie cette session/)

    const seul = lancer(racine, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'autre' })
    assert.equal(seul.code, 0, seul.stderr)
    assert.match(seul.stdout, /^\[suivi\] session sans suivi lié ; suivis de vague modifiés depuis moins de 72 h/)
    assert.match(seul.stdout, /\n- #1816 — Suivi de vague — épique #1816 \(5e sélectionnable\), session 60c2b9c9 — \d{4}-\d{2}-\d{2} \d{2}:\d{2}\n/)
    assert.match(seul.stdout, /`npm run ops:suivi -- N` lie cette session au suivi #N\.\n$/)
    assert.doesNotMatch(seul.stdout, /## Objectif/)

    FS.utimesSync(join(dossier, '1816.md'), new Date(), new Date(Date.now() - 73 * 3_600_000))
    assert.equal(lancer(racine, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'autre' }).stdout, '', 'rien de récent : silence')
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})

test('deux épiques liées : le TOTAL injecté tient sous PLAFOND_INJECTION, chaque digest coupé à sa part', () => {
  const dossier = FS.mkdtempSync(join(tmpdir(), 'inject-suivi-'))
  try {
    const etapes = Array.from({ length: 300 }, (_, i) => `   - [ ] étape ouverte numéro ${i} du plan`)
    for (const epique of [1, 2]) {
      FS.writeFileSync(join(dossier, `${epique}.md`), ['# Suivi', '', '## Objectif', 'x', '', '## En cours', `1. #${epique} item`, ...etapes, ''].join('\n'))
    }
    FS.writeFileSync(join(dossier, JOURNAL), [1, 2].map((epique) => ligneDeJournal({ iso: new Date().toISOString(), session: 's', epique })).join(''))
    const texte = texteDInjection({ entree: { session_id: 's' }, dossier, maintenant: new Date() })
    assert.ok(texte.length <= PLAFOND_INJECTION, `${texte.length} > ${PLAFOND_INJECTION}`)
    for (const epique of [1, 2]) assert.match(texte, new RegExp(`^\\[suivi #${epique}\\] `, 'm'))
    assert.equal(texte.match(/… tronqué, lire /g)?.length, 2, 'chaque digest coupé à sa part')
  } finally {
    FS.rmSync(dossier, { recursive: true, force: true })
  }
})

/** Un dossier jetable dont le journal lie la session `s` aux `epiques` ; `ecrits` y ont un suivi titré. */
function dossierLie(epiques, ecrits = epiques) {
  const dossier = FS.mkdtempSync(join(tmpdir(), 'inject-suivi-'))
  for (const epique of ecrits) FS.writeFileSync(join(dossier, `${epique}.md`), [`# Suivi de vague — épique #${epique}`, '', '## Objectif', 'x', ''].join('\n'))
  FS.writeFileSync(join(dossier, JOURNAL), epiques.map((epique) => ligneDeJournal({ iso: new Date().toISOString(), session: 's', epique })).join(''))
  return dossier
}

test('150 épiques liées : une ligne par épique, chaque `#N` présent, le TOTAL sous PLAFOND_INJECTION', () => {
  const epiques = Array.from({ length: 150 }, (_, i) => i + 1)
  const dossier = dossierLie(epiques)
  try {
    const texte = texteDInjection({ entree: { session_id: 's' }, dossier, maintenant: new Date() })
    assert.ok(texte.length <= PLAFOND_INJECTION, `${texte.length} > ${PLAFOND_INJECTION}`)
    const lignes = texte.split('\n').filter(Boolean)
    assert.equal(lignes.length, texte.split('\n').length - 1, 'aucune ligne vide : pas de digests')
    assert.deepEqual(lignes.map((l) => /^\[suivi #(\d+)\] (?:.+ )?— lire /.exec(l)?.[1]), epiques.map(String), 'une ligne par épique, dans l’ordre')
    assert.ok(Math.floor((PLAFOND_INJECTION - 2 * epiques.length) / epiques.length) < PART_D_UN_DIGEST, 'la part d’un digest est sous le seuil')
  } finally {
    FS.rmSync(dossier, { recursive: true, force: true })
  }
})

test('peu d’épiques : la ligne dit le titre et le chemin ; au-delà de ce que tient `[suivi #N]`, le compte des omises', () => {
  const peu = Array.from({ length: 40 }, (_, i) => i + 1)
  const dossier = dossierLie(peu, [1])
  try {
    const texte = texteDInjection({ entree: { session_id: 's' }, dossier, maintenant: new Date() })
    const [premiere, seconde] = texte.split('\n')
    assert.equal(premiere, `[suivi #1] Suivi de vague — épique #1 — lire ${join(dossier, '1.md')}`)
    assert.ok(seconde.startsWith('[suivi #2] lié à cette session, mais absent'), seconde)
  } finally {
    FS.rmSync(dossier, { recursive: true, force: true })
  }
  const trop = Array.from({ length: 2000 }, (_, i) => i + 1)
  const vaste = dossierLie(trop, [])
  try {
    const texte = texteDInjection({ entree: { session_id: 's' }, dossier: vaste, maintenant: new Date() })
    assert.ok(texte.length <= PLAFOND_INJECTION, `${texte.length} > ${PLAFOND_INJECTION}`)
    const lignes = texte.split('\n').filter(Boolean)
    const presentes = lignes.filter((l) => /^\[suivi #\d+\]/.test(l)).length
    assert.ok(presentes > 0 && presentes < trop.length, `${presentes}`)
    assert.equal(lignes.at(-1), `[suivi] ${trop.length - presentes} autres épiques liées à cette session, omises : ${vaste}`)
  } finally {
    FS.rmSync(vaste, { recursive: true, force: true })
  }
})

test('un lien vers un suivi ABSENT (`--creer` en échec) se dit tel quel, sans digest', () => {
  const dossier = dossierLie([7], [])
  try {
    assert.equal(texteDInjection({ entree: { session_id: 's' }, dossier, maintenant: new Date() }),
      `[suivi #7] lié à cette session, mais absent : ${join(dossier, '7.md')}\n`)
  } finally {
    FS.rmSync(dossier, { recursive: true, force: true })
  }
})
