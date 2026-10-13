// Contrat du LECTEUR de commande shell (`commandeShell.mjs`) : grammaire des paramètres PowerShell et de
// l'hôte `powershell`/`pwsh` (#2292).
//   node --test scripts/guards/lib/commandeShell.test.mjs   (chaîné dans `npm run test:hooks`)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { CAS_HOTE_POWERSHELL, argumentsDuCas } from '../../hooks/hote-powershell-cas.mjs'
import { GRAMMAIRES_HOTE_POWERSHELL, argumentChaine, valeurParametre, pipelinesDeJetons, texteDuSegment, cibleDeLaCommande, ciblesDeRedirectionAvecProvenance, nouveauBudget } from './commandeShell.mjs'
import { ciblesDEcritureDeCommande } from './ecrituresShell.mjs'

test('redirections : provenance de la cible séparée ou collée', () => {
  const [segment] = pipelinesDeJetons('echo \'$P/x\' > "$P/x" 2>$P/y').flat()
  const cibles = ciblesDeRedirectionAvecProvenance(segment.jetons)
  assert.deepEqual(cibles.map((j) => [j.text, j.raw]), [['$P/x', '"$P/x"'], ['$P/y', '$P/y']])
  assert.ok(cibles[0].quote)
})

test('#2537 — un opérateur échappé hors quote reste dans le mot, un `\\` de chemin Windows reste littéral', () => {
  const textes = (commande) => pipelinesDeJetons(commande).flat().map((s) => s.jetons.map((j) => j.text))
  assert.deepEqual(textes('find . -exec rm {} \\; -print'), [['find', '.', '-exec', 'rm', '{}', ';', '-print']])
  assert.deepEqual(textes('echo a\\|b \\> c'), [['echo', 'a|b', '>', 'c']])
  assert.deepEqual(textes('dir depot\\src\\x'), [['dir', 'depot\\src\\x']])
  const powershell = (commande) => pipelinesDeJetons(commande, 0, { powershell: true }).flat().map((s) => s.jetons.map((j) => j.text))
  assert.deepEqual(powershell('cd depot\\; echo a \\> c'), [['cd', 'depot\\'], ['echo', 'a', '\\', '>', 'c']], 'sous PowerShell, `\\` est littéral (about_Special_Characters)')
  assert.deepEqual(powershell('echo "a\\" b'), [['echo', 'a\\', 'b']])
  assert.deepEqual(powershell('Get-Date `\n-Format o'), [['Get-Date', '-Format', 'o']])
})

test('cibleDeLaCommande : paramètres de cwd, base inconnue et restauration absolue', () => {
  const cwd = resolve('depart')
  const cible = resolve(cwd, 'avec espace')
  const options = { existe: () => true }
  for (const commande of [
    'cd -- "avec espace"',
    'cmd /c cd /d "avec espace"',
    'Set-Location -Path "avec espace"',
    'Set-Location -LiteralPath "avec espace"',
  ]) assert.equal(cibleDeLaCommande(commande, cwd, process.platform, options).dir, cible, commande)
  assert.equal(cibleDeLaCommande('cmd /c cd /d cible', cwd, process.platform, options).dir, resolve(cwd, 'cible'))
  for (const commande of ['cd relatif', 'cd -- relatif', 'Set-Location -Path relatif']) {
    const resultat = cibleDeLaCommande(commande, null, process.platform, options)
    assert.equal(resultat.dir, null, commande)
    assert.equal(resultat.ignore.raison, 'répertoire de départ indéterminé', commande)
  }
  assert.equal(cibleDeLaCommande(`cd "${cible}"`, null, process.platform, options).dir, cible)
  assert.equal(cibleDeLaCommande('cd -inconnu cible && cd relatif', cwd, process.platform, options).dir, null)
  assert.equal(cibleDeLaCommande(`cd -inconnu cible && cd "${cible}"`, cwd, process.platform, options).dir, cible)
})

test('texteDuSegment : raw quotés, affectation autonome et grammaires non enrichies', () => {
  for (const [commande, attendu, valeurs] of [
    ["nohup cp 'source avec espace' \"destination avec espace\"", "cp 'source avec espace' \"destination avec espace\"", 0],
    ["env P='avec espace'", "P='avec espace'", 1],
    ["P='avec espace' cp x y", 'cp x y', 0],
    ["$p = 'avec espace'", "$p = 'avec espace'", 0],
    ['set P=avec', 'set P=avec', 0],
  ]) {
    const [segment] = pipelinesDeJetons(commande, 0, { scripts: {} }).flat()
    assert.equal(texteDuSegment(segment), attendu)
    assert.equal(segment.valeurs.length, valeurs)
  }
})

test('valeurParametre : le nom EXACT gagne, un préfixe strict ambigu est refusé, la casse est libre', () => {
  const noms = ['Query', 'QueryDialect', 'Filter']
  const args = (p) => [p, 'v']
  assert.equal(valeurParametre(args('-Query'), 'Query', noms), 'v')
  assert.equal(valeurParametre(args('-QUERY'), 'Query', noms), 'v')
  assert.equal(valeurParametre(args('-query'), 'Query', noms), 'v')
  assert.equal(valeurParametre(args('-Quer'), 'Query', noms), '')
  assert.equal(valeurParametre(args('-Quer'), 'QueryDialect', noms), '')
  assert.equal(valeurParametre(args('-QueryD'), 'QueryDialect', noms), 'v')
  assert.equal(valeurParametre(args('-QueryD'), 'Query', noms), '')
  assert.equal(valeurParametre(args('-querydialect'), 'QueryDialect', noms), 'v')
  assert.equal(valeurParametre(args('-Fil'), 'Filter', noms), 'v')
})

test('valeurParametre : le lieur de cmdlet ouvre un paramètre par tout tiret de PowerShell, jamais par « / » (#2292)', () => {
  const noms = ['Name', 'Id']
  for (const tiret of ['-', '\u2013', '\u2014', '\u2015']) assert.equal(valeurParametre([`${tiret}Name`, 'node'], 'Name', noms), 'node', tiret)
  assert.equal(valeurParametre(['/Name', 'node'], 'Name', noms), '')
})

// ── #2292 : l'HÔTE PowerShell lit sa ligne de commande selon SA grammaire ─────────────────────────────
test('argumentChaine : chaque cas de l\'hôte PowerShell rend ce que l\'hôte exécute (hote-powershell-cas.mjs)', () => {
  const commande = 'Stop-Process -Name node'
  for (const cas of CAS_HOTE_POWERSHELL) {
    const lu = argumentChaine([cas.exe, ...argumentsDuCas(cas, commande)])
    const libelle = `${cas.exe} ${JSON.stringify(cas.args)} (${cas.classe})`
    if (cas.classe === 'execute' || cas.surApproximation) assert.ok(lu?.includes(commande), `${libelle} → ${JSON.stringify(lu)}`)
    else if (cas.classe === 'stdin') assert.ok(!lu?.includes(commande), libelle)
    else assert.equal(lu, null, libelle)
  }
})

// Aucune clé n'est reconnue par deux entrées d'une même table : l'ordre de la table n'y est donc pas observable. Une
// entrée qui en rompt une rendrait l'ordre porteur, à prouver à l'hôte réel (`scripts/ops/sondes/hote-powershell.mjs`).
test('GRAMMAIRES_HOTE_POWERSHELL : chaque clé reconnue l\'est par UNE seule entrée de sa table (#2292)', () => {
  for (const [exe, { parametres }] of Object.entries(GRAMMAIRES_HOTE_POWERSHELL)) {
    for (const { alias } of parametres) {
      for (const [nom, min] of alias) {
        for (let n = min.length; n <= nom.length; n++) {
          const cle = nom.slice(0, n)
          const entrees = parametres.filter((p) => p.alias.some(([m, mi]) => cle.length >= mi.length && m.startsWith(cle)))
          assert.equal(entrees.length, 1, `${exe} : « ${cle} » reconnue par ${entrees.map((p) => p.alias[0][0]).join(', ')}`)
        }
      }
    }
  }
})

test('argumentChaine : l\'hôte lit sa commande ENTIÈRE, jointe, après ses paramètres ordonnés', () => {
  assert.equal(argumentChaine(['pwsh', '-NoProfile', '-co', 'Get-Date', '-x']), 'Get-Date -x')
  assert.equal(argumentChaine(['powershell', '-NoProfile', 'Get-Date', '-x']), 'Get-Date -x')
  assert.equal(argumentChaine(['powershell', '-NoProfile', '-zz;', 'Get-Date']), '-zz; Get-Date')
  assert.equal(argumentChaine(['pwsh', '-cwa', 'Write-Output $args', 'a', 'b']), 'Write-Output $args a b')
  assert.equal(argumentChaine(['pwsh', '-NoProfile', '-c']), null)
})

test('#2537 — fonction shell : la définition LIE son corps, l’appel l’exécute dans le shell de l’appel', () => {
  const executes = (commande, options) => pipelinesDeJetons(commande, 0, options).flat().filter((s) => s.jetons.length > 0).map((s) => s.jetons.map((j) => j.text))
  const powershell = { powershell: true }
  assert.deepEqual(executes('f(){ rm x; }'), [], 'définie, jamais appelée')
  assert.deepEqual(executes('f(){ rm x; }; f'), [['rm', 'x']], '`nom()`')
  assert.deepEqual(executes('f () { rm x; }; f'), [['rm', 'x']], '`nom ()`')
  assert.deepEqual(executes('function f { rm x; }; f'), [['rm', 'x']], '`function nom`')
  assert.deepEqual(executes('function f() { rm x; }; f > o.txt'), [['rm', 'x'], ['>', 'o.txt']], '`function nom()`, l’appel garde ses redirections')
  assert.deepEqual(executes('f() ( rm x ); f'), [['rm', 'x']], 'corps `( … )`')
  assert.deepEqual(executes('f() if true; then rm x; fi; f'), [['true'], ['rm', 'x'], ['fi']], 'corps `if`')
  assert.deepEqual(executes('f() for i in a; do rm $i; done; f'), [['for', 'i', 'in', 'a'], ['rm', '$i'], ['done']], 'corps `for`')
  assert.deepEqual(executes('function Nettoie { Remove-Item x }; nettoie', powershell), [['Remove-Item', 'x']], '`function` PowerShell, nom sans casse')
  assert.deepEqual(executes('function f($a, $b) { Remove-Item $a }; f y z', powershell), [['Remove-Item', '$a']], 'paramètres PowerShell')
  assert.deepEqual(executes('filter script:g { rm x }; & g', powershell), [['rm', 'x']], '`filter` à portée, opérateur d’appel')
  assert.deepEqual(executes('f(){ rm x }; f', powershell), [['f(){', 'rm', 'x', '}'], ['f']], '`nom()` n’est pas une définition PowerShell')
  assert.deepEqual(executes('f(){ rm x; }; command f; builtin f'), [['f'], ['f']], '`command`/`builtin` ne résolvent pas la fonction')
  assert.deepEqual(executes('f(){ rm x; }; bash -c f'), [['f'], ['bash', '-c', 'f']], 'processus neuf : aucune fonction héritée')
  assert.deepEqual(executes('( f(){ rm x; } ); f'), [['f']], 'définie dans un sous-shell : perdue à sa sortie')
  assert.deepEqual(executes('f(){ rm x; }; (f); echo $(f)'), [['rm', 'x'], ['rm', 'x'], ['echo', '$(f)']], 'sous-shell et substitution héritent')
  assert.deepEqual(executes('f(){ rm x; } | cat; f'), [['cat'], ['f']], 'définie dans un membre de tube : perdue')
  assert.deepEqual(executes('( a(b) )'), [['a(b)']], 'la `)` d’un mot ferme sa propre parenthèse, pas le sous-shell')
  const appel = pipelinesDeJetons('f(){ cd a; }; f').flat()
  assert.equal(appel.find((s) => s.jetons[0]?.text === 'cd').shell, appel.at(-1).shell, 'le corps s’exécute dans le shell de l’appel')
  const budget = nouveauBudget()
  pipelinesDeJetons('f(){ f; }; f', 0, { budget })
  assert.equal(budget.sature, true, 'récursion bornée par `PROFONDEUR_MAX_ENROBEURS`')
})

test('#2537 — fonction shell : son corps se juge au cwd de l’appel, sa tête n’est pas un exécutable', () => {
  const volume = 'C:'
  const cibles = (commande) => ciblesDEcritureDeCommande(commande, { base: `${volume}/repo`, platform: 'win32' }).map((c) => [c.operation, c.chemin, c.inconnue])
  assert.deepEqual(cibles(`f(){ rm x; }; cd ${volume}/hors; f`), [['rm', `${volume}\\hors\\x`, false]])
  assert.deepEqual(cibles('strip(){ sed -i s/a/b/ "$1"; }; strip githooks.html'), [['sed', null, true]], '`$1` est un mot inconnu ; `strip` n’est plus l’écrivain binutils')
})
