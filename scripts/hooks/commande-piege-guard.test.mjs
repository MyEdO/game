// Tests du garde `commande-piege-guard` : `deny` sur chaque piège RÉELLEMENT exécuté (lien sur un
// `node_modules`, `git show` dont le commit suit `--`, mise à mort de processus par nom), silence sur la
// même chaîne simplement CITÉE, sur le même geste par PID, et sur toute autre commande. Lancé par
// `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluate } from './commande-piege-guard.mjs'

const silent = (cmd) => evaluate(cmd) === null
const refuse = (cmd) => evaluate(cmd)?.decision === 'deny'

// ── Liens sur node_modules (#1679 L1c) ─────────────────────────────────────────────────────

const BS = String.fromCharCode(92) // antislash Windows, sans échappement à relire
const WT = 'C:' + BS + 'w' + BS + '.wt-1679' + BS + 'node_modules'
const PRINCIPAL = 'C:' + BS + 'w' + BS + 'Game' + BS + 'node_modules'

test('DENY : les quatre graphies de lien vers un node_modules', () => {
  assert.ok(refuse(`New-Item -ItemType Junction -Path "${WT}" -Target "${PRINCIPAL}"`))
  assert.ok(refuse('New-Item -ItemType SymbolicLink -Path .wt-1679/node_modules -Target ../node_modules'))
  assert.ok(refuse(`mklink /J "${WT}" "${PRINCIPAL}"`))
  assert.ok(refuse('ln -s ../Game/node_modules ./node_modules'))
})

test('DENY : le refus dit POURQUOI et ce qu\'il faut faire à la place', () => {
  const d = evaluate('ln -s ../Game/node_modules ./node_modules')
  assert.equal(d.decision, 'deny')
  assert.match(d.reason, /node_modules/)
  assert.match(d.reason, /npm ci/)
})

test('DENY : le lien est vu en 2e maillon d\'un enchaînement', () => {
  assert.ok(refuse('cd .wt-1679 && ln -s /ailleurs/node_modules node_modules'))
})

test('PASSE : un lien qui ne touche AUCUN node_modules', () => {
  assert.ok(silent(`New-Item -ItemType Junction -Path .${BS}Source -Target ..${BS}Source`))
  assert.ok(silent('ln -s ../Game/src/data/qualities.json ./qualities.json'))
})

test('PASSE : New-Item ordinaire, et la commande simplement CITÉE', () => {
  assert.ok(silent('New-Item -ItemType Directory -Force node_modules'))
  assert.ok(silent('git commit -m "doc: jamais de junction sur node_modules (ln -s ../node_modules)"'))
  assert.ok(silent('Write-Output "mklink /J node_modules ..\\node_modules"'))
})

// Deux trous MESURÉS du deny (juge #1679 L1c) : PowerShell accepte tout préfixe NON AMBIGU d'un
// nom de paramètre, et `mklink` est un builtin de `cmd` — l'exécutable lu était alors `cmd`.

test('DENY : `-ItemType` abrégé en préfixe non ambigu (PowerShell l\'accepte)', () => {
  for (const p of ['-it', '-item', '-itemt', '-ItemTy', '-ITEMTYPE']) {
    const d = evaluate(`New-Item ${p} Junction -Path .wt-1679${BS}node_modules -Target ..${BS}node_modules`)
    assert.equal(d?.decision, 'deny', p)
    assert.match(d.reason, /node_modules/)
    assert.match(d.reason, /npm ci/)
  }
})

test('DENY : `mklink` lancé DERRIÈRE cmd /c (builtin, l\'exe lu est `cmd`)', () => {
  const cmds = [
    `cmd /c mklink /J .wt-1679${BS}node_modules ..${BS}node_modules`,
    `cmd.exe /C mklink /D .wt-1679${BS}node_modules ..${BS}node_modules`,
    `cmd /c "cd .wt-1679 & mklink /J node_modules ..${BS}node_modules"`,
    `cmd /c cd .wt-1679 & mklink /J node_modules ..${BS}node_modules`,
  ]
  for (const c of cmds) {
    const d = evaluate(c)
    assert.equal(d?.decision, 'deny', c)
    assert.match(d.reason, /node_modules/)
    assert.match(d.reason, /npm ci/)
  }
})

test('PASSE : le préfixe abrégé ne vise QUE les liens, et cmd sans mklink ne dit rien', () => {
  assert.ok(silent('New-Item -it Directory node_modules'))
  assert.ok(silent(`cmd /c rmdir .wt-1679${BS}node_modules`))
})

// ── `git show` dont le commit passe APRÈS `--` : une MESURE fausse, silencieuse ────────────────────
test('DENY : le commit placé après `--` devient un pathspec (mesuré 2026-08-26)', () => {
  const d = evaluate('git show --stat --format= -- src/data src/scenes 951d6b1fd')
  assert.equal(d?.decision, 'deny')
  assert.match(d.reason, /951d6b1fd/)
  assert.match(d.reason, /pathspec/i)
  assert.match(d.reason, /git show <commit> -- <paths>/)
  assert.equal(evaluate('git show --stat -- 21d0153b7')?.decision, 'deny')
})

test('PASSE : la forme correcte, et un `git show` sans séparateur', () => {
  assert.ok(silent('git show --stat --format= 951d6b1fd -- src/data src/scenes'))
  assert.ok(silent('git show 951d6b1fd'))
  assert.ok(silent('git show HEAD -- src/ui'))
  assert.ok(silent('git show --stat -- src/data'), 'un pathspec ordinaire ne ressemble pas à un sha')
})

// ── Mise à mort de processus PAR NOM (#2173) : elle atteint les processus des autres sessions ─────
const tue = (cmd) => evaluate(cmd)?.reason ?? ''

test('DENY : chaque graphie de mise à mort par nom, et le refus nomme la graphie vue', () => {
  const cas = [
    ['taskkill /F /IM grep.exe', 'taskkill /IM'],
    ['taskkill //F //IM grep.exe', 'taskkill /IM'],
    ['taskkill.exe /im node.exe', 'taskkill /IM'],
    ['taskkill /FI "IMAGENAME eq node.exe" /F', 'taskkill /FI'],
    ['taskkill //FI "PID ne 1234"', 'taskkill /FI'],
    ['Stop-Process -Name node', 'Stop-Process -Name'],
    ['Stop-Process -ProcessName node -Force', 'Stop-Process -Name'],
    ['Stop-Process -n node', 'Stop-Process -Name'],
    ['spps -Name node', 'spps -Name'],
    ['kill -Name node', 'kill -Name'],
    ['Get-Process node | Stop-Process', 'Get-Process … | Stop-Process'],
    ['Get-Process | Where-Object Name -eq node | Stop-Process -Force', 'Get-Process … | Stop-Process'],
    ['gps node | kill', 'gps … | kill'],
    ['pgrep -f vitest | xargs kill', 'pgrep … | kill'],
    ["ps aux | grep node | awk '{print $2}' | xargs kill -9", 'ps … | kill'],
    ['pkill node', 'pkill'],
    ['pkill -f vitest', 'pkill'],
    ['killall node', 'killall'],
    ['wmic process where name="node.exe" delete', 'wmic process'],
    ["wmic process where \"name='node.exe'\" call terminate", 'wmic process'],
    ['wmic process call terminate', 'wmic process'],
  ]
  for (const [cmd, graphie] of cas) {
    assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
    assert.ok(tue(cmd).includes(graphie), `${cmd} : le refus nomme « ${graphie} »`)
  }
})

test('DENY : la mise à mort par nom derrière cmd /c, powershell -Command, bash -c, un enrobeur de tête', () => {
  for (const cmd of [
    'cmd /c taskkill /F /IM grep.exe',
    'cmd /c taskkill /IM node.exe',
    'cmd /c "taskkill /F /IM node.exe & echo ok"',
    'powershell -Command "Stop-Process -Name node"',
    'powershell -NoProfile -Command "Get-Process node | Stop-Process"',
    'bash -c "pkill node"',
    'bash -c "taskkill //F //IM grep.exe"',
    'timeout 10 pkill node',
    'cd .wt-2173 && taskkill //F //IM grep.exe',
  ]) assert.ok(refuse(cmd), cmd)
})

test('DENY : le refus dit que le geste touche les autres sessions, et comment arrêter SA tâche', () => {
  const raison = tue('taskkill //F //IM grep.exe')
  assert.match(raison, /autres sessions/)
  for (const geste of ['taskkill //PID <pid>', 'kill <pid>', 'Stop-Process -Id <pid>', 'TaskStop']) {
    assert.ok(raison.includes(geste), geste)
  }
})

test('PASSE : le même geste par PID, et la mise à mort simplement CITÉE', () => {
  for (const cmd of [
    'taskkill //PID 1234', 'taskkill /F /PID 1234 /T', 'taskkill //FI "PID eq 1234"',
    'kill 1234', 'kill -9 1234', 'kill -n 9 1234', 'kill -s TERM 1234', 'kill %1', 'kill -- -1234',
    'Stop-Process -Id 1234', 'Stop-Process -Id 1234 -Force', 'Stop-Process $p', 'spps -Id 1234',
    'Get-Process -Id 1234 | Stop-Process', 'Get-Process -PID 1234 | Stop-Process',
    'wmic process where processid=1234 delete', 'wmic process 1234 call terminate',
    'Get-Process node', 'pgrep -f vitest', 'tasklist | findstr node', 'ps aux | grep node',
    'echo "taskkill //F //IM grep.exe"',
    'Write-Output "Stop-Process -Name node"',
    'git commit -m "fix: jamais taskkill //IM grep.exe ni pkill node"',
  ]) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : un listeur CIM/WMI de Win32_Process en amont, un arrêt sans cible en aval', () => {
  const cas = [
    ["Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Invoke-CimMethod -MethodName Terminate", 'Get-CimInstance … | Invoke-CimMethod'],
    ['gcim -ClassName Win32_Process | icim -MethodName Terminate', 'gcim … | icim'],
    ["Get-WmiObject Win32_Process -Filter \"Name='node.exe'\" | Remove-WmiObject", 'Get-WmiObject … | Remove-WmiObject'],
    ["gwmi Win32_Process -Filter \"Name='node.exe'\" | Invoke-WmiMethod -Name Terminate", 'gwmi … | Invoke-WmiMethod'],
  ]
  for (const [cmd, graphie] of cas) {
    assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
    assert.ok(tue(cmd).includes(graphie), `${cmd} : le refus nomme « ${graphie} »`)
  }
})

test('PASSE : le listeur CIM/WMI borné à un PID, une autre méthode, une autre classe, une simulation', () => {
  for (const cmd of [
    'Get-CimInstance Win32_Process -Filter "ProcessId=1234" | Invoke-CimMethod -MethodName Terminate',
    'Get-WmiObject Win32_Process -Filter "ProcessId = 1234" | Remove-WmiObject',
    'Get-CimInstance Win32_Process | Invoke-CimMethod -MethodName GetOwner',
    'Get-CimInstance Win32_Service | Invoke-CimMethod -MethodName Terminate',
    "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Invoke-CimMethod -MethodName Terminate -WhatIf",
    'Get-CimInstance Win32_Process', "Get-WmiObject Win32_Process -Filter \"Name='node.exe'\"",
  ]) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : taskkill à tiret, comme à barre', () => {
  for (const cmd of ['taskkill -im node.exe', 'taskkill -F -IM node.exe', 'taskkill -fi "IMAGENAME eq node.exe"']) {
    assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
  }
  assert.equal(evaluate('taskkill -pid 1234 -f'), null)
})

test('DENY : `kill -1` vise TOUS les processus de l\'utilisateur, avec sa propre raison', () => {
  for (const cmd of ['kill -1', 'kill -9 -1', 'kill -- -1', 'kill -s TERM -1', 'bash -c "kill -9 -1"']) {
    const raison = tue(cmd)
    assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
    assert.match(raison, /kill -1/, cmd)
    assert.match(raison, /TOUS les processus/, cmd)
    assert.ok(raison.includes('TaskStop'), cmd)
  }
  for (const cmd of ['kill -1 1234', 'kill -9 1234', 'kill -- -1234']) assert.equal(evaluate(cmd), null, cmd)
})

test('PASSE : `kill -n <signal>`, `pkill -P <pid>` sans motif, et toute simulation `-WhatIf`', () => {
  for (const cmd of [
    'kill -n TERM 1234', 'kill -n SIGTERM 1234', 'kill -n hup 1234', 'kill -n KILL $pid', 'kill -n RTMIN+2 1234',
    'kill -n EMT 1234', 'kill -n SIGEMT 1234',
    'pkill -P $$', 'pkill -P 1234', 'pkill -9 -P 1234',
    'Get-Process node | Stop-Process -WhatIf', 'Get-Process node | spps -wh', 'Stop-Process -Name node -WhatIf',
    'ps -p 1234 | xargs kill',
  ]) assert.equal(evaluate(cmd), null, cmd)
  for (const [cmd, graphie] of [
    ['kill -n node', 'kill -Name'], ['Stop-Process -Name TERM', 'Stop-Process -Name'],
    ['pkill -P $$ node', 'pkill'], ['pkill -u gauch', 'pkill'],
    ['Get-Process node | Stop-Process -WhatIf:$false', 'Get-Process … | Stop-Process'],
  ]) assert.ok(tue(cmd).includes(graphie), `${cmd} : le refus nomme « ${graphie} »`)
})

// Seconde sonde du juge de diff #2173, promue (D1 à D4).
test('DENY : Remove-CimInstance en aval d\'un listeur, et l\'arrêt CIM qui porte sa propre requête Win32_Process', () => {
  for (const [cmd, graphie] of [
    ["Get-CimInstance -ClassName Win32_Process -Filter \"Name='node.exe'\" | Remove-CimInstance", 'Get-CimInstance … | Remove-CimInstance'],
    ['gcim Win32_Process | ? Name -eq node.exe | rcim', 'gcim … | rcim'],
    ["Remove-CimInstance -Query \"SELECT * FROM Win32_Process WHERE Name='node.exe'\"", 'Remove-CimInstance Win32_Process'],
    ["rcim -Query \"SELECT * FROM Win32_Process\"", 'rcim Win32_Process'],
    ["Invoke-CimMethod -Query \"SELECT * FROM Win32_Process WHERE Name='node.exe'\" -MethodName Terminate", 'Invoke-CimMethod Win32_Process'],
    ["Get-CimInstance -Query \"SELECT * FROM Win32_Process WHERE Name='node.exe'\" | Invoke-CimMethod -MethodName Terminate", 'Get-CimInstance … | Invoke-CimMethod'],
    ["Get-WmiObject -Query \"SELECT * FROM Win32_Process WHERE Name='node.exe'\" | Remove-WmiObject", 'Get-WmiObject … | Remove-WmiObject'],
  ]) assert.ok(tue(cmd).includes(graphie), `${cmd} : le refus nomme « ${graphie} »`)
})

test('PASSE : l\'arrêt CIM/WMI borné à un PID par -Filter ou -Query, une autre méthode, une simulation', () => {
  for (const cmd of [
    'Get-CimInstance Win32_Process -Filter "ProcessId=1234" | Remove-CimInstance',
    'Get-WmiObject -Query "SELECT * FROM Win32_Process WHERE ProcessId = 1234" | Remove-WmiObject',
    'Remove-CimInstance -Query "SELECT * FROM Win32_Process WHERE ProcessId=1234"',
    'Invoke-CimMethod -Query "SELECT * FROM Win32_Process WHERE ProcessId=1234" -MethodName Terminate',
    'Get-CimInstance -Query "SELECT * FROM Win32_Process WHERE ProcessId=1234" | Invoke-CimMethod -MethodName Terminate',
    "Invoke-CimMethod -Query \"SELECT * FROM Win32_Process WHERE Name='node.exe'\" -MethodName GetOwner",
    "Remove-CimInstance -Query \"SELECT * FROM Win32_Process WHERE Name='node.exe'\" -WhatIf",
  ]) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : un arrêt sans PID littéral alimenté par un tube (ps -W, tasklist, Get-Process), et `kill -n <nom>`', () => {
  for (const [cmd, graphie] of [
    ["ps -W | grep node | awk '{print $1}' | xargs -I{} taskkill //F //PID {}", 'ps … | taskkill'],
    ['tasklist //FO CSV | grep node | cut -d, -f2 | xargs -n1 taskkill //F //PID', 'tasklist … | taskkill'],
    ['tasklist | findstr node | xargs taskkill //F //PID $p', 'tasklist … | taskkill'],
    ["ps -W | grep node | awk '{print $1}' | xargs kill -f", 'ps … | kill'],
    ['Get-Process node | Select-Object -ExpandProperty Id | Stop-Process', 'Get-Process … | Stop-Process'],
    ['kill -n TERMINATOR 1', 'kill -Name'],
  ]) assert.ok(tue(cmd).includes(graphie), `${cmd} : le refus nomme « ${graphie} »`)
})

test('PASSE : taskkill à PID littéral derrière un tube, tasklist borné à un PID, un listeur seul', () => {
  for (const cmd of [
    "ps -W | grep node | awk '{print $1}' | xargs -I{} taskkill //F //PID 1234",
    'tasklist //FI "PID eq 1234" | xargs -n1 taskkill //F //PID',
    'tasklist //FO CSV | grep node', 'ps -W | grep node', 'taskkill //PID $pid //F',
    'tasklist //FI "IMAGENAME eq node.exe" //FI "PID eq 1234" | xargs taskkill //F //PID',
  ]) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : pkill par parent quand le parent est le PID 1 ; PASSE pour tout autre parent', () => {
  for (const cmd of ['pkill -P 1', 'pkill -P1', 'pkill --parent=1', 'pkill --parent 1', 'pkill -9 -P 1234,1']) {
    assert.ok(tue(cmd).includes('pkill'), cmd)
  }
  for (const cmd of ['pkill -P1234', 'pkill --parent=1234', 'pkill --parent 1234', 'pkill -P 1234,5678']) {
    assert.equal(evaluate(cmd), null, cmd)
  }
})

test('DENY : wmic dont la clause where, lue en entier, ne se réduit pas à un PID ; PASSE sinon', () => {
  for (const cmd of [
    "wmic process where processid=1234 or name='node.exe' delete",
    "wmic process where \"processid=1234 or name='node.exe'\" call terminate",
  ]) assert.ok(tue(cmd).includes('wmic process'), cmd)
  for (const cmd of [
    'wmic process where processid=1234 delete', 'wmic process where "processid = 1234" call terminate',
    'wmic process where (processid=1234) delete', 'wmic process 1234 delete',
  ]) assert.equal(evaluate(cmd), null, cmd)
})

// Sonde du juge de diff #2173, promue.
test('PASSE : les faux positifs de la sonde du juge', () => {
  for (const cmd of [
    'git log --oneline -1', 'npm test', 'grep -rn pkill scripts', 'rg "taskkill //IM"', 'gh issue view 2173',
    'git commit -m "taskkill //IM grep.exe"', "git commit -F - <<'EOF'\nfix: refus\n\ntaskkill //F //IM grep.exe\npkill node\nEOF",
    "cat > /tmp/x.md <<'EOF'\nStop-Process -Name node\nEOF",
    'node scripts/x.mjs kill', 'ps', 'ps aux', 'Get-Process', 'Get-Process node', 'kill %1', 'kill -0 1234', 'kill -0 $pid',
    'kill "$PID"', 'kill $!', 'Stop-Process -Id $PID', 'taskkill /PID 1234', 'taskkill //PID $pid //F',
    'echo kill', 'docker kill abc', 'tmux kill-session -t x', 'npx kill-port 5173', 'kill -n TERM 1234',
    'kill -s KILL %1', 'Get-Process -Id 1234,5678 | Stop-Process', 'Get-Process node | Select-Object Id',
    'pkill -P $$', 'ps -p 1234 | xargs kill', 'Get-Process node | Stop-Process -WhatIf',
    'npm run kill', 'git grep -n "Stop-Process -Name"',
    'taskkill /F /FI "PID eq 1234" /FI "IMAGENAME eq x"',
    'xargs -r kill < pids.txt',
  ]) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : les faux négatifs de la sonde du juge', () => {
  for (const cmd of [
    'STOP-PROCESS -NAME node', 'stop-process -na node', 'TASKKILL.EXE /IM node.exe',
    'taskkill -im node.exe', 'taskkill /f /t /im node.exe', 'C:/Windows/System32/taskkill.exe /IM node.exe',
    '& taskkill /IM node.exe', 'sudo pkill node', 'nohup pkill node', 'env pkill node',
    'pgrep node | xargs -r kill', 'pgrep node | xargs -n1 kill -9', 'pgrep node | xargs -I{} kill {}',
    'pidof node | xargs kill', 'killall -9 node', '/usr/bin/pkill -f vitest', 'pwsh -c "spps -n node"',
    'powershell.exe -NoProfile -Command "Get-Process -Name node | Stop-Process -Force"',
    'Invoke-Expression "taskkill /IM node.exe"', 'eval "pkill node"',
    'sh -c \'taskkill //F //IM grep.exe\'', 'cmd.exe /C "taskkill /IM node.exe"',
    "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Invoke-CimMethod -MethodName Terminate",
    "Get-WmiObject Win32_Process -Filter \"Name='node.exe'\" | Remove-WmiObject",
    'kill -9 -1', 'kill -- -1', 'wmic process where "name like \'%node%\'" delete',
    'Get-Process | ? ProcessName -eq node | spps', 'ps -W | grep grep | awk \'{print $1}\' | xargs kill -f',
    'wmic process where name="node.exe" call terminate',
    'bash -lc "pkill node"', 'timeout 5 taskkill //IM grep.exe //F', 'npx --yes pkill node',
  ]) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
})

test('PASSE : les formes que la détection par segments ne voit pas (en-tête du garde)', () => {
  for (const cmd of [
    'Stop-Process -Name:node', // #2172
    'iex "Stop-Process -Name node"', // #2172
    'kill $(pgrep node)', // #2172
    'kill `pgrep node`', // #2172
    'Stop-Process -InputObject (Get-Process node)', // #2172
    '(Get-Process node).Kill()',
    'Get-Process node | ForEach-Object { $_.Kill() }',
    '$p = Get-Process node; Stop-Process $p',
    'Start-Process taskkill -ArgumentList "/IM node.exe"', // #2172
  ]) assert.equal(evaluate(cmd), null, cmd)
})

// ── Contrat : le garde ne juge que ses pièges, toute autre commande rend `null` ───────────────────
test('PASSE : toute commande hors des pièges rend null', () => {
  for (const cmd of ['npm test', 'git log --oneline -5', 'git commit -m "x"', 'git reset --hard origin/main',
    'rm -rf dist', 'Remove-Item -Recurse -Force public/qc', 'New-Item -ItemType Directory tmp',
    'ln -s ../Source ./Source', 'cmd /c dir', 'Get-ChildItem src', 'node scripts/x.mjs && git status']) {
    assert.equal(evaluate(cmd), null, cmd)
  }
})
