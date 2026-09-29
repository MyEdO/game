import { readFileSync, writeFileSync } from 'node:fs'
const f = '/home/user/game/scripts/guards/lib/gitPorte.test.mjs'
let s = readFileSync(f, 'utf8')
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`occurrences ${n} : ${a.slice(0, 60)}`); s = s.replace(a, () => b) }
rep(`  racineDe, raisonCourte, rebaser, reglerDepot,`, `  racineDe, raisonCourte, rebaseEntame, rebaser, reglerDepot,`)
rep(`const depotFeint = (cwd, repondre) => depotDe(cwd, { spawn: (_git, args) => repondre(args.slice(OPTIONS_DE_L_HOTE.length)) })`,
    `const depotFeint = (cwd, repondre, enPanne) => depotDe(cwd, { enPanne, spawn: (_git, args) => repondre(args.slice(OPTIONS_DE_L_HOTE.length)) })`)
rep(`    const pannes = []
    assert.deepEqual(fusionnesEnCours(depotDe(racine, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) })), [])
    assert.match(pannes.join('\\n'), /^MERGE_HEAD illisible : EISDIR/)
  } finally { jeter(racine) }
})
`, `    const pannes = []
    assert.deepEqual(fusionnesEnCours(depotDe(racine, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) })), [])
    assert.equal(pannes.length, 1, JSON.stringify(pannes))
    assert.match(pannes[0], /^MERGE_HEAD illisible : EISDIR/)
  } finally { jeter(racine) }
})

test('fusionnesEnCours : git EN PANNE sur les lignes de \`MERGE_HEAD\` — UNE requête, UNE panne, la sienne', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'merge-head-panne-'))
  try {
    writeFileSync(join(cwd, 'MERGE_HEAD'), \`\${'a'.repeat(40)}\\n\${'b'.repeat(40)}\\n\`)
    const requetes = []
    const repondre = (args) => {
      requetes.push(args.slice(0, 2))
      return args[1] === '--git-path' ? { status: 0, stdout: \`\${args[2]}\\n\`, stderr: '' } : { status: 128, stdout: '', stderr: 'fatal: boum\\n' }
    }
    assert.throws(() => fusionnesEnCours(depotFeint(cwd, repondre)), (e) => e instanceof GitIndisponible && e.raison === 'fatal: boum')
    const pannes = []
    requetes.length = 0
    assert.deepEqual(fusionnesEnCours(depotFeint(cwd, repondre, (r) => pannes.push(r))), [])
    assert.deepEqual(pannes, ['fatal: boum'])
    assert.deepEqual(requetes, [['rev-parse', '--git-path'], ['cat-file', '--batch-check']])
  } finally { jeter(cwd) }
})

test('rebaseEntame : \`null\` hors rebase, puis le NOM du chemin d’état présent sous le répertoire git', () => {
  const { racine } = depot()
  try {
    const d = forge(racine)
    assert.equal(rebaseEntame(d), null)
    for (const nom of ['rebase-merge', 'rebase-apply']) {
      mkdirSync(join(racine, '.git', nom))
      assert.equal(rebaseEntame(d), nom)
      rmSync(join(racine, '.git', nom), { recursive: true })
    }
  } finally { jeter(racine) }
})

test('rebaseEntame : git en panne ou chemin d’état ILLISIBLE — INDISPONIBLE, une panne, jamais « hors rebase »', () => {
  const panne = () => ({ status: 128, stdout: '', stderr: 'fatal: boum\\n' })
  const illisible = (args) => ({ status: 0, stdout: \`\${'x'.repeat(8192)}/\${args[2]}\\n\`, stderr: '' })
  for (const [repondre, raison] of [[panne, /^fatal: boum$/], [illisible, /^rebase-merge illisible : ENAMETOOLONG/]]) {
    assert.throws(() => rebaseEntame(depotFeint(tmpdir(), repondre)), (e) => e instanceof GitIndisponible && raison.test(e.raison), String(raison))
    const pannes = []
    assert.equal(rebaseEntame(depotFeint(tmpdir(), repondre, (r) => pannes.push(r))), null)
    assert.equal(pannes.length, 1, JSON.stringify(pannes))
    assert.match(pannes[0], raison)
  }
})
`)
writeFileSync(f, s)
