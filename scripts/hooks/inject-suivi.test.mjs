// Hook SessionStart du suivi de vague (surface Codex) : lancé POUR DE VRAI sur un dépôt forgé, il injecte
// le `contexte` de `etatDeSession`. Les suivis sont posés par l'outil (`poserSuivi`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as FS from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { JOURNAL, PART_D_UN_DIGEST, ligneDeJournal } from '../ops/suivi.mjs'
import { PLAFOND_INJECTION, appliquer, texteDuSuivi } from '../ops/suiviDonnee.mjs'
import { poserSuivi } from '../test/suiviDeBanc.mjs'
import { texteDInjection } from './inject-suivi.mjs'

const HOOK = fileURLToPath(new URL('./inject-suivi.mjs', import.meta.url))

/**
 * Le suivi neuf `epique` titré `titre`, produit par l'évaluateur commité (`appliquer`) et écrit tel quel : par
 * l'outil, chaque lot relit le dossier entier pour sa confrontation, et des centaines de suivis coûteraient
 * un temps quadratique au banc.
 */
function creerParLEvaluateur(dossier, epique, titre) {
  const { suivi } = appliquer(null, [{ geste: 'creer', titre }], { maintenant: new Date(), epique })
  FS.writeFileSync(join(dossier, `${epique}.json`), texteDuSuivi(suivi))
}

/** Le hook lancé dans `racine` sur l'entrée `entree` : son code et son stdout. */
function lancer(racine, entree) {
  const vu = spawnSync(process.execPath, [HOOK], { cwd: racine, input: JSON.stringify(entree), encoding: 'utf8', timeout: 30_000 })
  return { code: vu.status, stdout: vu.stdout, stderr: vu.stderr }
}

function injection(racine, entree, dossier) {
  const execution = lancer(racine, entree)
  assert.equal(execution.code, 0, execution.stderr)
  const sortie = JSON.parse(execution.stdout)
  assert.equal(sortie.hookSpecificOutput.hookEventName, 'SessionStart')
  const texte = sortie.hookSpecificOutput.additionalContext
  assert.equal(texte, texteDInjection({ entree, dossier, maintenant: new Date() }))
  assert.ok(texte.length <= PLAFOND_INJECTION, `${texte.length} > ${PLAFOND_INJECTION}`)
  assert.match(texte, /^\[/)
  return { ...execution, stdout: texte }
}

/** Les lots d'un suivi titré `titre`, son objectif, un item #2400 à deux étapes dont la première cochée, un item clos. */
const VAGUE = (titre) => [[
  { geste: 'creer', titre, objectif: 'livrer le tome 1' },
  { geste: 'ajouter-item', ticket: 2400, libelle: 'périmètre de tests' },
  { geste: 'ajouter-etape', ticket: 2400, texte: 'juge du brief' },
  { geste: 'ajouter-etape', ticket: 2400, texte: 'juge du diff' },
  { geste: 'cocher', ticket: 2400, n: 1 },
  { geste: 'ajouter-item', ticket: 2001, libelle: 'fini', etat: 'clos' },
]]

test('compaction d’une session LIÉE : le digest JSON (objectif, étape ouverte NUMÉROTÉE, rien de fait ni de clos) ; sans lien, l’index', () => {
  const { racine } = instanceDeDepot({ commit: false })
  const dossier = join(racine, '.git', 'suivi')
  try {
    FS.mkdirSync(dossier, { recursive: true })
    poserSuivi({ dossier, epique: 665, lots: VAGUE('Vague du tome 1') })
    FS.writeFileSync(join(dossier, JOURNAL), ligneDeJournal({ iso: new Date().toISOString(), session: 's', epique: 665 }))

    const lie = injection(racine, { hook_event_name: 'SessionStart', source: 'compact', session_id: 's' }, dossier)
    assert.match(lie.stdout, /^\[suivi #665\] .*665\.json — écrit le /)
    assert.ok(lie.stdout.includes('# Vague du tome 1\n\nObjectif : livrer le tome 1'), lie.stdout.slice(0, 600))
    assert.ok(lie.stdout.includes('  - [ ] #2400.2 juge du diff'), 'l’étape ouverte, numérotée')
    assert.doesNotMatch(lie.stdout, /#2400\.1|#2001|lie cette session/)

    const seul = injection(racine, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'autre' }, dossier)
    assert.match(seul.stdout, /^\[suivi\] session sans suivi lié ; suivis de vague modifiés depuis moins de 72 h/)
    assert.match(seul.stdout, /\n- #665 — Vague du tome 1 — \d{4}-\d{2}-\d{2} \d{2}:\d{2}\n/)
    assert.match(seul.stdout, /`npm run ops:suivi -- N` lie cette session au suivi #N\.\n$/)

    const agent = lancer(racine, { hook_event_name: 'SessionStart', session_id: 's', agent_id: 'agent' })
    assert.deepEqual([agent.code, agent.stdout], [0, ''])

    FS.utimesSync(join(dossier, '665.json'), new Date(), new Date(Date.now() - 73 * 3_600_000))
    assert.equal(lancer(racine, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'autre' }).stdout, '', 'rien de récent : silence')
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})

test('#2266 — session SANS lien, 200 suivis aux titres de 80 caractères : le hook RÉEL injecte l’index sous PLAFOND_INJECTION, dit la troncature, garde le geste qui lie', () => {
  const { racine } = instanceDeDepot({ commit: false })
  const dossier = join(racine, '.git', 'suivi')
  try {
    FS.mkdirSync(dossier, { recursive: true })
    const titre = (epique) => `Vague ${String(epique).padStart(4, '0')} ${'t'.repeat(69)}`
    for (let epique = 1; epique <= 200; epique += 1) creerParLEvaluateur(dossier, epique, titre(epique))
    assert.equal(titre(1).length, 80)
    const { stdout: texte } = injection(racine, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'sans-lien' }, dossier)
    const lignes = texte.split('\n')
    assert.match(lignes[0], /^\[suivi\] session sans suivi lié ; suivis de vague modifiés depuis moins de 72 h/)
    const indexees = lignes.filter((l) => /^- #\d+ — Vague \d{4} t+ — /.test(l)).length
    assert.ok(indexees > 0 && indexees < 200, `${indexees}`)
    assert.equal(lignes.at(-3), `… ${200 - indexees} autre(s) suivi(s) omis sous le plafond de ${PLAFOND_INJECTION} caractères : \`npm run ops:suivi\` les liste tous`)
    assert.equal(lignes.at(-2), '`npm run ops:suivi -- N` lie cette session au suivi #N.')
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})

test('un suivi ILLISIBLE ou écrit HORS DE L’OUTIL se dit EN TÊTE du contexte ; un `<N>.md` abandonné est nommé, jamais lu', () => {
  const dossier = FS.mkdtempSync(join(tmpdir(), 'inject-suivi-'))
  try {
    poserSuivi({ dossier, epique: 1, lots: VAGUE('Un') })
    FS.writeFileSync(join(dossier, '1.json'), FS.readFileSync(join(dossier, '1.json'), 'utf8').replace('juge du diff', 'juge du diff édité à la main'))
    FS.writeFileSync(join(dossier, '2.json'), '{ pas du JSON')
    FS.writeFileSync(join(dossier, '3.md'), '# ancien format\n## En cours\n1. #3 secret jamais lu\n')
    FS.writeFileSync(join(dossier, JOURNAL), [1, 2, 3].map((epique) => ligneDeJournal({ iso: 'x', session: 's', epique })).join(''))
    const texte = texteDInjection({ entree: { session_id: 's' }, dossier, maintenant: new Date() })
    const [un, deux, trois] = texte.trimEnd().split('\n\n').filter((b) => b.startsWith('[suivi #'))
    assert.match(un.split('\n')[1], /^\[suivi #1\] ⚠ écrit hors de l'outil/)
    assert.match(deux, /^\[suivi #2\] ⚠ illisible, JSON invalide/)
    assert.equal(trois, `[suivi #3] format .md abandonné : ${join(dossier, '3.md')}`)
    assert.doesNotMatch(texte, /secret jamais lu/)
  } finally {
    FS.rmSync(dossier, { recursive: true, force: true })
  }
})

test('deux épiques liées : le TOTAL injecté tient sous PLAFOND_INJECTION, chaque digest coupé à sa part', () => {
  const { racine } = instanceDeDepot({ commit: false })
  const dossier = join(racine, '.git', 'suivi')
  try {
    FS.mkdirSync(dossier, { recursive: true })
    const long = 'étape ouverte du plan, assez longue pour remplir sa part du plafond '.repeat(2)
    const items = Array.from({ length: 6 }, (_, k) => [
      { geste: 'ajouter-item', ticket: 100 + k, libelle: `item ${k}` },
      ...Array.from({ length: 5 }, () => ({ geste: 'ajouter-etape', ticket: 100 + k, texte: long })),
    ])
    for (const epique of [1, 2]) poserSuivi({ dossier, epique, lots: [[{ geste: 'creer', titre: `Suivi ${epique}` }], ...items] })
    FS.writeFileSync(join(dossier, JOURNAL), [1, 2].map((epique) => ligneDeJournal({ iso: new Date().toISOString(), session: 's', epique })).join(''))
    const texte = injection(racine, { hook_event_name: 'SessionStart', session_id: 's' }, dossier).stdout
    for (const epique of [1, 2]) assert.match(texte, new RegExp(`^\\[suivi #${epique}\\] `, 'm'))
    assert.equal(texte.match(/… tronqué, `npm run ops:suivi -- \d --rendu` le rend entier/g)?.length, 2, 'chaque digest coupé à sa part')
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})

/** Un dossier jetable dont le journal lie la session `s` aux `epiques` ; `ecrits` y ont un suivi titré. */
function dossierLie(epiques, ecrits = epiques) {
  const dossier = FS.mkdtempSync(join(tmpdir(), 'inject-suivi-'))
  for (const epique of ecrits) creerParLEvaluateur(dossier, epique, `Suivi de vague — épique #${epique}`)
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
    assert.equal(premiere, `[suivi #1] Suivi de vague — épique #1 — lire ${join(dossier, '1.json')}`)
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

test('un lien vers un suivi ABSENT se dit tel quel, sans digest', () => {
  const dossier = dossierLie([7], [])
  try {
    assert.equal(texteDInjection({ entree: { session_id: 's' }, dossier, maintenant: new Date() }),
      `[suivi #7] lié à cette session, mais absent : ${join(dossier, '7.json')}\n`)
  } finally {
    FS.rmSync(dossier, { recursive: true, force: true })
  }
})
