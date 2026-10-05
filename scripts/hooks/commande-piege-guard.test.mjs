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

test('PASSE : les formes que la détection ne voit pas (en-tête du garde), chacune avec sa route', () => {
  for (const cmd of [
    'Stop-Process -Name:node', // #2172
    'iex "Stop-Process -Name node"', // #2172
    'Stop-Process $p', // affectation hors de la commande
    "echo 'a'\\''b' && pkill node", // #2172
    '$x = (Stop-Process -Name node)', // #2172
    'Write-Output (Stop-Process -Name node)', // #2172
    'Start-Process taskkill -ArgumentList "/IM node.exe"', // #2172
    'Invoke-Command -ScriptBlock { Stop-Process -Name node }', // #2172
    'Start-Job { Stop-Process -Name node }', // #2172
    '. { Stop-Process -Name node }', // #2172
    'cmd /c start taskkill /im node.exe', // #2172
    'exec pkill node', // #2172
    'pwsh -co "Stop-Process -Name node"', // #2292
  ]) assert.equal(evaluate(cmd), null, cmd)
})

// ── Réfutation de fermeture #2173 (2026-10-05), sondes promues ─────────────────────────────────────
test('DENY : `wmic path win32_process`, l’autre graphie de l’alias `process` (expression de chemin WMI)', () => {
  for (const cmd of [
    "wmic path win32_process where name='node.exe' delete",
    "wmic path win32_process where \"name='node.exe'\" call terminate",
    "wmic PATH Win32_Process WHERE Name='node.exe' DELETE",
    "wmic /node:srv path win32_process where name='node.exe' call terminate",
    `wmic /namespace:${BS}${BS}root${BS}cimv2 path win32_process where name='node.exe' delete`,
    `wmic path ${BS}${BS}.${BS}root${BS}cimv2:win32_process where name='node.exe' delete`,
    'wmic path win32_process delete',
  ]) assert.ok(tue(cmd).includes('wmic path win32_process'), cmd)
  for (const cmd of [
    'wmic path win32_process.handle="1234" delete', 'wmic path win32_process.handle=1234 call terminate',
    'wmic path win32_process where processid=1234 delete', 'wmic class win32_process delete',
    'wmic path win32_process get name,processid',
  ]) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : `cmd //c` et `//k`, la graphie Git Bash de `cmd /c`', () => {
  for (const cmd of [
    'cmd //c taskkill //im node.exe', 'cmd //c "taskkill //F //IM node.exe"', 'cmd //C taskkill //IM node.exe',
    'cmd //q //c pkill node', 'cmd //k taskkill //im node.exe',
  ]) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
})

test('DENY : `fkill` par nom, direct ou par `npx` ; PASSE par PID, par port, sans cible, en aide', () => {
  for (const cmd of [
    'npx fkill node', 'npx fkill-cli node --force', 'fkill node', 'fkill -f 1234 node', 'npx -p fkill-cli fkill node',
    'fkill --force-timeout 5 node', 'fkill :8080 node',
  ]) assert.ok(/fkill/.test(tue(cmd)), cmd)
  for (const cmd of ['fkill 1234', 'fkill :8080', 'fkill', 'fkill --help', 'fkill --version', 'fkill -t 5 1234', 'fkill-cli 1234 :3000']) {
    assert.equal(evaluate(cmd), null, cmd)
  }
})

test('PASSE : `pkill`/`killall` qui ne rendent qu’une aide, une version ou la liste des signaux', () => {
  for (const cmd of [
    'pkill --help', 'pkill -h', 'pkill -V', 'pkill --version',
    'killall --help', 'killall -h', 'killall -V', 'killall --version', 'killall -l', 'killall --list',
  ]) assert.equal(evaluate(cmd), null, cmd)
  for (const cmd of ['pkill -V node', 'killall -u gauch', 'pkill -F /tmp/x.pid', 'killall -l node']) {
    assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
  }
})

test('DENY : la commande en tête d’un bloc PowerShell (`%`, `ForEach-Object`, `foreach`, `for`, `try`, `catch`, `finally`, `if`)', () => {
  for (const cmd of [
    '1..3 | % { Stop-Process -Name node }', '1 | % { pkill node }', '1..3 | ForEach-Object { Stop-Process -Name node }',
    'foreach ($i in 1..3) { Stop-Process -Name node }', 'try { Stop-Process -Name node } catch {}',
    'try { 1 } catch { taskkill /IM node.exe }', 'try { 1 } finally { pkill node }',
    'for ($i=0; $i -lt 1; $i++) { Stop-Process -Name node }', 'if($true){Stop-Process -Name node}', '1..3 | %{Stop-Process -Name node}',
  ]) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
})

test('DENY : une substitution ou une sous-expression qui liste par nom, en cible d’un arrêt', () => {
  for (const [cmd, graphie] of [
    ['kill $(pgrep node)', 'kill … (pgrep …)'], ['kill -9 `pgrep node`', 'kill … (pgrep …)'],
    ['kill $(pgrep -f "vite --port")', 'kill … (pgrep …)'], ['kill "$(pgrep node)"', 'kill … (pgrep …)'],
    ["kill $(ps aux | grep node | awk '{print $2}')", 'kill … (ps …)'],
    ['Stop-Process -InputObject (Get-Process node)', 'Stop-Process … (Get-Process …)'],
    ['Stop-Process -Id (Get-Process bash).Id -Force', 'Stop-Process … (Get-Process …)'],
    ["Stop-Process -Id (Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\").ProcessId", 'Stop-Process … (Get-CimInstance …)'],
    ['taskkill /F /PID $(pidof node)', 'taskkill … (pidof …)'],
  ]) assert.ok(tue(cmd).includes(graphie), `${cmd} : le refus nomme « ${graphie} »`)
  for (const cmd of [
    'kill $(cat pid.txt)', 'Stop-Process -Id (Get-Content pid.txt)', 'Stop-Process -Id (Get-Process -Id 1234).Id',
    'kill $!', 'Stop-Process -Id $PID -WhatIf', 'echo $(pgrep node)', 'Stop-Process -Id (Get-Process node).Id -WhatIf',
    "echo 'kill $(pgrep node)'",
  ]) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : la variable affectée par un listeur, et `.Kill()` sur un listeur ; PASSE si elle est réaffectée', () => {
  for (const [cmd, graphie] of [
    ['$p = Get-Process node; Stop-Process $p', '$p = Get-Process … → Stop-Process $p'],
    ['$p = Get-Process node; $p | Stop-Process', '$p = Get-Process … → $p | Stop-Process'],
    ['$ids = (Get-Process node).Id; foreach ($i in $ids) { kill $i }', 'foreach ($i in $ids = Get-Process …) → kill $i'],
    ['(Get-Process node).Kill()', '(Get-Process …).Kill()'], ['(gps node).Kill()', '(gps …).Kill()'],
    ['Get-Process node | Stop-Process -Id {$_.Id}', 'Get-Process … | Stop-Process {$_}'],
  ]) assert.ok(tue(cmd).includes(graphie), `${cmd} : le refus nomme « ${graphie} »`)
  for (const cmd of ['(Get-Process -Id 1234).Kill()', '$p = Get-Process -Id 1234; Stop-Process $p', '$p = Get-Process node; $p = 1234; Stop-Process $p']) {
    assert.equal(evaluate(cmd), null, cmd)
  }
})

test('DENY : les trous de la réfutation de fermeture, et la seconde occurrence du ticket', () => {
  for (const cmd of [
    'Get-Process node | ForEach-Object { Stop-Process -Id $_.Id }', 'Get-Process node | % { kill $_.Id }',
    'Get-Process -Name node | Select-Object -ExpandProperty Id | ForEach-Object { taskkill /PID $_ /F }',
    'pgrep node | while read p; do kill $p; done', 'Get-Process node | % Kill', 'Get-Process node | ForEach-Object { $_.Kill() }',
    'Get-WmiObject Win32_Process | ? Name -eq node.exe | % { $_.Terminate() }', 'npx fkill-cli node',
    '$p = Get-Process node; $p | Stop-Process', 'Get-Process node | Stop-Process -Id {$_.Id}',
    "Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { $_.CommandLine -match 'grep -noE' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
    "Get-CimInstance Win32_Process | Where-Object CommandLine -match 'seq 1 20' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
    'Get-Process bash | Where-Object { $_.Id -ne $PID } | Stop-Process -Force',
    "Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object CommandLine -match 'grep' | Select-Object -ExpandProperty ProcessId | Stop-Process -Force",
    'foreach ($p in Get-Process bash) { Stop-Process -Id $p.Id -Force }',
  ]) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
})

test('PASSE : les faux positifs de la sonde de fermeture', () => {
  for (const cmd of [
    'grep killall README', 'echo pkill', 'git log --grep=taskkill', 'ps aux', 'tasklist', 'Get-Process -Id 1234', 'Get-Process node',
    'tasklist | findstr node', 'tasklist /FI "IMAGENAME eq node.exe"',
    "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine", 'pgrep -fl vite', 'man pkill',
    'pkill --help', 'killall --help', 'pkill -V', 'Get-Help Stop-Process', 'Get-Command Stop-Process', 'which taskkill', 'taskkill /?',
    `git grep -n -i "taskkill${BS}|Stop-Process${BS}|pkill${BS}|killall" -- scripts/hooks`, "rg -n 'Stop-Process -Name' scripts",
    'git commit -m "fix: pkill node interdit"', 'gh issue comment 2173 --body "taskkill //IM grep.exe refusé"',
    'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5', 'ps -W | grep node', 'kill -l', 'kill -l 9', 'kill -0 1234',
    'kill -1 1234', 'Stop-Process -Id $PID', 'kill $!', 'taskkill //PID $pid //F //T', 'Get-Process node | Stop-Process -WhatIf',
    'npm run dev -- --port 5180', 'node scripts/x.mjs --name node', 'Get-Process node | Format-Table Id,ProcessName',
    'taskkill /PID 1234 /PID 5678 /F', 'wmic process where processid=1234 get commandline', 'wmic process list brief',
  ]) assert.equal(evaluate(cmd), null, cmd)
})

// Table du juge de design #2173 (2026-10-05, `cas-d3.json`, 76 cas) et ses cas de bord : l'arrêt PAR
// ÉLÉMENT d'une liste par nom.
const TABLE_D3 = {
  deny: [
    'Get-Process node | ForEach-Object { Stop-Process -Id $_.Id }',
    'Get-Process node | % { kill $_.Id }',
    'Get-Process node | % Kill',
    'Get-Process node | ForEach-Object -MemberName Kill',
    "Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { $_.CommandLine -match 'grep -noE' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
    "Get-CimInstance Win32_Process | Where-Object CommandLine -match 'seq 1 20' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
    'pgrep node | while read p; do kill $p; done',
    'for p in $(pgrep node); do kill $p; done',
    'foreach ($p in Get-Process bash) { Stop-Process -Id $p.Id -Force }',
    'Get-Process node | % { Stop-Process -Id $PSItem.Id }',
    'Get-Process node | % { Stop-Process -Id ${_}.Id }',
    'Get-Process node | % -Process { kill $_.Id }',
    'Get-Process node | ForEach-Object -Process { Stop-Process -InputObject $_ }',
    'Get-Process node | Where-Object { $_.Id -ne $PID } | % { kill $_.Id }',
    'Get-Process -Name node | Select-Object -ExpandProperty Id | ForEach-Object { taskkill /PID $_ /F }',
    'Get-Process node | Select-Object -ExpandProperty Id | % { kill $_ }',
    'Get-Process node | ForEach-Object { $_.Kill() }',
    'Get-WmiObject Win32_Process | ? Name -eq node.exe | % { $_.Terminate() }',
    'gps node | %{ kill $_.Id }',
    'gps node | %{kill $_.Id}',
    'gps node | ForEach-Object{Stop-Process -Id $_.Id}',
    'gps node | % { if ($_.Id -ne $PID) { kill $_.Id } }',
    'gps node | % { Stop-Process $_ }',
    "gcim Win32_Process -Filter \"Name='node.exe'\" | % { Invoke-CimMethod -InputObject $_ -MethodName Terminate }",
    "gcim Win32_Process -Filter \"Name='node.exe'\" | % { Remove-CimInstance $_ }",
    'Get-Process node | % { $_ | Stop-Process }',
    'Get-Process node | Stop-Process -Id {$_.Id}',
    'Get-Process node | % { $x = $_; kill $x.Id }',
    'Get-Process node | % { $id = $_.Id; Stop-Process -Id $id }',
    'Get-Process node | % -m Kill',
    'Get-Process node | foreach { kill $_.Id }',
    'pgrep node | while IFS= read -r p; do kill "$p"; done',
    'pgrep node | while read -r p; do kill -9 ${p}; done',
    'pgrep -f vite | while read p; do taskkill //PID $p //F; done',
    'for p in `pgrep node`; do kill $p; done',
    'for p in $(pgrep -f "vite --port"); do kill -9 $p; done',
    'for p in $(pidof node); do kill "$p"; done',
    'foreach ($p in (Get-Process -Name bash)) { $p.Kill() }',
    'foreach ($p in gps node) { kill $p.Id }',
    "foreach ($p in Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\") { Invoke-CimMethod -InputObject $p -MethodName Terminate }",
    'foreach ($P in Get-Process bash) { Stop-Process -Id $p.Id }',
    'bash -c "pgrep node | while read p; do kill $p; done"',
    'pgrep node | xargs -I{} kill {}',
    'foreach($p in Get-Process bash){Stop-Process -Id $p.Id}',
    'foreach ($p in $(Get-Process bash)) { kill $p.Id }',
    'pgrep node | { read p; kill $p; }',
    '$p = Get-Process node; Stop-Process $p',
    '$p = Get-Process node; $p | Stop-Process',
    '$ids = (Get-Process node).Id; foreach ($i in $ids) { kill $i }',
    'for p in $(pgrep node); do echo $p; done; kill $p',
    'Get-Process node | % { cmd /c taskkill /PID $_.Id /F }',
    'gps node | % { $x = $_.Id; }; Stop-Process -Id $x',
    'Get-Process node | % { $x = $_; Write-Output $x; kill $x.Id }',
  ],
  pass: [
    'Get-Process -Id 1234 | % { Stop-Process -Id $_.Id }',
    'Get-Process node | % { $_.Id }',
    'for p in 1234 5678; do kill $p; done',
    'kill $!',
    'Stop-Process -Id $pid',
    'pgrep node | while read p; do echo $p; done',
    'pgrep -f vite | while read p; do ps -p $p -o args=; done',
    'Get-Process node | % { "$($_.Id) $($_.Name)" }',
    'Get-Process node | % { echo kill $_.Id }',
    'Get-Process node | % { Write-Output "kill $_" }',
    'Get-Process node | % { Stop-Process -Id $_.Id -WhatIf }',
    'Get-ChildItem | % { Remove-Item $_ }',
    'Get-Content pids.txt | % { Stop-Process -Id $_ }',
    'while read p; do kill $p; done < pids.txt',
    'foreach ($p in Get-Process bash) { Write-Output $p.Id }',
    'foreach ($p in 1234, 5678) { Stop-Process -Id $p }',
    'foreach ($p in Get-Process bash) { Stop-Process -Id $PID -WhatIf }',
    'for f in $(git ls-files); do echo $f; done',
    'Get-Process node | % { $_.Id }; Stop-Process -Id $PID',
    'pgrep node | while read p; do echo $p; done; kill $$',
    'Get-Process node | Select-Object Id; foreach ($p in 1,2) { kill $p }',
    'Get-Process node | % { $_.Name }; kill $x',
    'for p in $(pgrep node); do echo $p; done; for q in 1 2; do kill $q; done',
    "Get-Process node | % { Write-Output '$_.Kill()' }",
    'pgrep node | while read pp; do kill $p; done',
    'gps node | % { $n = $_.Name; }; Stop-Process -Id $PID',
    'gps node | % { $x = $_.Id; }; $x = 1234; kill $x',
    'gps node | % { $_.Id }; $x = 5; kill $x',
  ],
}

test('table D3 : l’arrêt qui cible une variable liée à une liste par nom est refusé, le témoin silencieux passe', () => {
  for (const cmd of TABLE_D3.deny) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
  for (const cmd of TABLE_D3.pass) assert.equal(evaluate(cmd), null, cmd)
})

// Juge de diff #2173 (2026-10-05, `cas5.json` à `cas8.json`), sondes promues.
const TABLE_JUGE_DE_DIFF = {
  deny: [
    'Get-Process node | % { $x = $_.Id; kill $x }',
    'Get-Process node | % { $x = $_; Stop-Process -Id $x.Id }',
    'Get-Process node | %{kill $_.Id}',
    'foreach($p in Get-Process bash){Stop-Process -Id $p.Id}',
    'Get-Process node | % { Stop-Process -Id $PSItem.Id }',
    'Get-Process node | % { kill ${_}.Id }',
    'Get-Process node | ForEach-Object -MemberName Kill',
    'Get-Process node | % -MemberName Terminate',
    '(Get-Process node).Kill()',
    '1..3 | % { Stop-Process -Name node }',
    'try { Stop-Process -Name node } catch {}',
    'for ($i = 0; $i -lt 1; $i++) { Stop-Process -Name node }',
    'if ($true) { Stop-Process -Name node }',
    'for p in $(pgrep node); do kill $p; done',
    'for p in `pgrep node`; do kill $p; done',
    'kill `pgrep node`',
    'taskkill /F /PID $(pidof node)',
    '$ids = (Get-Process node).Id; foreach ($i in $ids) { kill $i }',
    '$p = Get-Process node; Stop-Process $p',
    'Get-Process node | % { if ($_.CPU -gt 1) { Stop-Process -Id $_.Id } }',
    'Get-Process node | % { Write-Output $_.Id; Stop-Process -Id $_.Id }',
    'pgrep node | while read -r p; do kill -9 "$p"; done',
    'pgrep node | while read p; do kill ${p}; done',
    'npx fkill node', 'npx fkill-cli node --force', 'fkill -t 5 node',
    "wmic /node:localhost path Win32_Process where name='node.exe' delete",
    `wmic path ${BS}${BS}.${BS}root${BS}cimv2:Win32_Process where name='x' delete`,
    "wmic PROCESS where name='node.exe' call terminate",
    "Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | % { Invoke-CimMethod -InputObject $_ -MethodName Terminate }",
    "Get-WmiObject Win32_Process -Filter \"Name='x'\" | % { $_.Terminate() }",
    'Get-Process node | % { Stop-Process -Id $_.Id }; Get-Content p',
    'Get-Process node | % { & { Stop-Process -Id $_.Id } }',
    'Get-Process node | % { cmd /c taskkill /PID $_.Id /F }',
    'gps node | % { $_.Id; }; gps node | % { kill $_ }',
    'Get-Process node | % { Start-Sleep 1; Stop-Process -Id $_.Id }',
    // persistance après le bloc
    'Get-Process node | % { $x = $_.Id }; kill $x',
    'Get-Process node | % { $x = $_.Id; }; kill $x',
    'Get-Process node | % { $x = $_.Id; 1 }; kill $x',
    'foreach ($p in Get-Process node) { 1 }; kill $p.Id',
    'for p in $(pgrep node); do echo $p; done; kill $p',
    // têtes de bloc
    'if ($false) { 1 } elseif ($true) { Stop-Process -Name node }',
    'if ($false) { 1 } else { Stop-Process -Name node }',
    'if ($x) { 1 } else { Stop-Process -Name node }',
    'do { Stop-Process -Name node } while ($false)',
    'do { Stop-Process -Name node } until ($true)',
    'while ($true) { Stop-Process -Name node; break }',
    'switch (1) { 1 { Stop-Process -Name node } }',
    '1 | Where-Object { Stop-Process -Name node }',
    '1 | ? { Stop-Process -Name node }',
    '1 | ForEach-Object -Begin { Stop-Process -Name node } -Process { 1 }',
    '1 | ForEach-Object -Begin { 1 } -Process { Stop-Process -Name node }',
    '1 | ForEach-Object -Parallel { Stop-Process -Name node }',
    'trap { Stop-Process -Name node }',
    'try { 1 } catch [System.Exception] { Stop-Process -Name node }',
    'Get-Process node | Where-Object { $_.Kill() }',
    'Get-Process node | ? { $_.Kill(); $true }',
    'Get-Process node | ForEach-Object -Begin { 1 } -Process { Stop-Process -Id $_.Id }',
    // affectation POSIX par substitution
    'p=$(pgrep node); kill $p',
  ],
  pass: [
    'gps node | % { $_.Id; }; Get-Content p | % { kill $_ }',
    'Get-Process node | % { $_.Id }; Get-Content pids.txt | % { Stop-Process -Id $_ }',
    'Get-Process node | Format-Table; Get-Content pids.txt | % { Stop-Process -Id $_ }',
    'Get-Process node | % { Write-Output $_.Id; }; foreach ($l in Get-Content p) { kill $l }',
    'Get-Process node | % { if ($_.Id -eq 1) { $_.Id } }; Get-Content p | % { kill $_ }',
    'gps node | % { 1; 2 }; Get-Content p | % { kill $_ }',
    'gps node | % { $_.Id }; Get-Content p | % { kill $_ }',
    'Get-ChildItem *.json | % { Get-Content $_ | Select-Object -First 3 }',
    'foreach ($w in git worktree list) { $w }',
    "git worktree list | % { ($_ -split ' ')[0] } | % { git -C $_ status --short }",
    'foreach ($f in Get-ChildItem src -Recurse -Filter *.ts) { Select-String -Path $f -Pattern kill }',
    "Get-Process node | % { Write-Output 'Stop-Process -Id $_.Id' }",
    'pgrep node | while read p; do echo $p; done; kill 1234',
    'pgrep -f vite | while read p; do ps -p $p; done',
    'for p in $(pgrep node); do echo $p; done; for p in 1 2; do kill $p; done',
    '$p = Get-Process node; $p = 1234; Stop-Process -Id $p',
    '$procs = Get-Process node; $procs | Format-Table',
    '(Get-Process -Id 1234).Id',
    'npx fkill-cli', 'npx fkill-cli --help', 'npx fkill-cli 1234', 'npx fkill-cli :5173', 'fkill -t 1000 1234',
    'wmic path win32_process.Handle=1234 delete', 'wmic class win32_process',
    '$x = Get-Process node | % { $_.Id }; $x = 5; kill $x',
    'Get-Process node | % { $id = $_.Id }; $id = 99; kill $id',
    "Get-Process node | Select-Object -First 1 | % { $_.Id } ; 'Stop-Process -Id 3'",
    'Get-Process node | % { "kill $($_.Id)" }',
    'Get-Process node | % { Write-Host "kill $($_.Id)" }',
    'Get-Process node | % { $x = $_.Id; }; $x = 1234; kill $x',
    'for p in $(pgrep node); do echo $p; done; p=1234; kill $p',
    'pgrep node | while read p; do echo $p; done; p=1; kill $p',
  ],
}

test('table du juge de diff : portée des blocs, têtes de bloc, persistance et déliaison', () => {
  for (const cmd of TABLE_JUGE_DE_DIFF.deny) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
  for (const cmd of TABLE_JUGE_DE_DIFF.pass) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : la variable affectée dans un bloc persiste après lui, `$_` se délie à sa fermeture', () => {
  assert.ok(tue('gps node | % { $x = $_.Id; }; Stop-Process -Id $x').includes('$x = gps … | % → Stop-Process $x'))
  assert.equal(evaluate('gps node | % { $_.Id; }; Get-Content p | % { kill $_ }'), null)
})

test('PASSE : un filtre `Where-Object` par PID rend son aval « par PID » ; DENY pour tout autre filtre', () => {
  for (const cmd of [
    'Get-Process | Where-Object { $_.Id -eq 1234 } | Stop-Process', 'gps | ? Id -eq 1234 | kill',
    'Get-CimInstance Win32_Process | ? ProcessId -eq 1234 | Remove-CimInstance', 'gps | ? { $PSItem.Id -eq 1234 } | % { kill $_.Id }',
  ]) assert.equal(evaluate(cmd), null, cmd)
  for (const cmd of [
    'Get-Process bash | Where-Object { $_.Id -ne $PID } | Stop-Process -Force',
    "Get-Process | Where-Object { $_.Id -eq 1 -or $_.Name -eq 'node' } | Stop-Process",
    'Get-Process | Where-Object { $_.Id -eq 1234 } | Select-Object -First 1; Get-Process node | Stop-Process',
  ]) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
})

test('DENY : le call-operator `&` devant un exécutable cité, dans un bloc ou dans la chaîne d’un porteur, exécute', () => {
  for (const cmd of [
    "1 | % { & 'pkill' node }", '1 | % { & "taskkill" /IM node.exe }', `1 | % { bash -c "'pkill' node" }`,
    `1 | % { sh -c '"pkill" node' }`, "1 | % { 'x' | Stop-Process -Name node }",
  ]) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
  for (const cmd of ["1 | % { 'pkill node' }", '1 | % { "PATH=$_" }', "1 | % { 5; 'pkill node' }"]) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : la commande d’une substitution `$(…)`, `` `…` `` ou `@(…)` s’exécute', () => {
  for (const cmd of [
    'echo $(pkill node)', 'x=$(pkill node)', 'y=`pkill node`', '$x = $(Stop-Process -Name node)', 'echo "$(pkill node)"',
    'FOO=$(taskkill /IM node.exe) git status', '$a = @(Stop-Process -Name node)', '1 | % { "$(Stop-Process -Name node)" }',
  ]) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
  assert.equal(evaluate("echo '$(pkill node)'"), null, 'sous quote simple, rien ne se substitue')
})

test('DENY : la variable posée par une substitution qui liste par nom, valeur citée ou déclarée', () => {
  for (const cmd of [
    'p="$(pgrep node)"; kill $p', 'export p=$(pgrep node); kill $p', 'local p=$(pgrep node); kill $p',
    'declare p=$(pgrep node); kill $p', 'typeset p=$(pgrep node); kill $p', 'readonly p=$(pgrep node); kill $p',
  ]) assert.ok(tue(cmd).includes('p=$(pgrep …) → kill $p'), cmd)
  assert.ok(tue('kill "$(pgrep node)"').includes('kill … (pgrep …)'))
  for (const cmd of ['export p=1234; kill $p', 'p=$(pgrep node); p=1234; kill $p', 'p=$(cat pid); kill $p']) assert.equal(evaluate(cmd), null, cmd)
})

test('PASSE : une here-string ne se ferme qu’à la marque qui ouvre sa ligne ; DENY sur l’arrêt qui la suit', () => {
  assert.equal(evaluate("$j = @'\nx 'a'@ | % { Stop-Process -Name node }\n'@\necho fin"), null)
  assert.equal(evaluate("$j = @'\nx 'a'@\n'@\nStop-Process -Name node")?.decision, 'deny')
})

test('DENY : un filtre `awk` n’est pas lu, sa substitution passe pour une liste par nom (limite de l’en-tête)', () => {
  assert.equal(evaluate("kill -9 $(ps -W | awk '$4==10372 {print $1}')")?.decision, 'deny')
})

test('DENY : le refus d’un arrêt par élément nomme le listeur, l’arrêt et la variable', () => {
  for (const [cmd, graphie] of [
    ['Get-Process node | % { kill $_.Id }', 'Get-Process … | % { kill $_ }'],
    ['Get-Process node | % Kill', 'Get-Process … | % Kill'],
    ['pgrep node | while read p; do kill $p; done', 'pgrep … | while read p → kill $p'],
    ['for p in $(pgrep node); do kill $p; done', 'for p in $(pgrep …) → kill $p'],
    ['foreach ($p in Get-Process bash) { Stop-Process -Id $p.Id }', 'foreach ($p in Get-Process …) → Stop-Process $p'],
    ['Get-Process node | ForEach-Object { $_.Kill() }', 'Get-Process … | ForEach-Object { $_.Kill() }'],
    ['$p = Get-Process node; $p | Stop-Process', '$p = Get-Process … → $p | Stop-Process'],
    ['p=$(pgrep node); kill $p', 'p=$(pgrep …) → kill $p'],
  ]) assert.ok(tue(cmd).includes(graphie), `${cmd} : le refus nomme « ${graphie} »`)
})

// ── Contrat : le garde ne juge que ses pièges, toute autre commande rend `null` ───────────────────
test('PASSE : toute commande hors des pièges rend null', () => {
  for (const cmd of ['npm test', 'git log --oneline -5', 'git commit -m "x"', 'git reset --hard origin/main',
    'rm -rf dist', 'Remove-Item -Recurse -Force public/qc', 'New-Item -ItemType Directory tmp',
    'ln -s ../Source ./Source', 'cmd /c dir', 'Get-ChildItem src', 'node scripts/x.mjs && git status']) {
    assert.equal(evaluate(cmd), null, cmd)
  }
})

// ── Juge de diff, 3e passe (2026-10-05), sondes promues ────────────────────────────────────────────
test('DENY : la substitution de processus `<(…)`, `>(…)` exécute sa commande, et son listeur lie la variable de `read`', () => {
  for (const cmd of [
    'cat <(pkill node)', 'diff <(pkill node) x', 'tee >(pkill node) < x',
    'while read p; do kill $p; done < <(pgrep node)', 'read p < <(pgrep node); kill $p',
  ]) assert.equal(evaluate(cmd)?.decision, 'deny', cmd)
  for (const cmd of ['while read p; do kill $p; done < pids.txt', 'diff <(sort a) <(sort b)', 'arr=(pkill node)']) {
    assert.equal(evaluate(cmd), null, cmd)
  }
})

test('une here-string double déplie ses `$(…)` ; un littéral entre apostrophes ne déplie rien', () => {
  assert.equal(evaluate('$t = @"\nfoo $(pkill node)\n"@')?.decision, 'deny')
  for (const cmd of [
    '$t = @"\nfoo `$(pkill node)\n"@', "Write-Output @'\n$(pkill node) `pkill node`\n'@",
    "echo 'foo `pkill node` $(pkill node)'",
  ]) assert.equal(evaluate(cmd), null, cmd)
})

test('DENY : une commande trop imbriquée pour être jugée est refusée, en deçà de la borne elle est lue', () => {
  const decision = evaluate('echo $($($($($(pkill node)))))')
  assert.equal(decision?.decision, 'deny')
  assert.match(decision.reason, /commande trop imbriquée pour être jugée/)
  assert.match(evaluate('echo $($($(pkill node)))')?.reason ?? '', /PAR NOM/)
})
