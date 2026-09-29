// usage: node muter.mjs <fichier> <avant-json> <apres-json> <test-fichier> <motif>
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const [f, a, b, t, motif] = process.argv.slice(2)
const hash = () => spawnSync('git', ['hash-object', f], { encoding: 'utf8' }).stdout.trim()
const orig = readFileSync(f, 'utf8'); const h0 = hash()
const avant = JSON.parse(a), apres = JSON.parse(b)
if (orig.split(avant).length !== 2) throw new Error('occurrence non unique')
writeFileSync(f, orig.replace(avant, () => apres)); const hm = hash()
const run = () => { const r = spawnSync('node', ['--test', `--test-name-pattern=${motif}`, t], { encoding: 'utf8', timeout: 300000 }); return { code: r.status, echecs: (r.stdout.match(/^not ok \d+ - .*$/gm) ?? []), sommaire: (r.stdout.match(/^# (pass|fail) \d+$/gm) ?? []).join(' ') } }
const rouge = run()
writeFileSync(f, orig); const h1 = hash()
const vert = run()
console.log(JSON.stringify({ fichier: f, avant: h0, mute: hm, apres: h1, identique: h0 === h1, rouge, vert }, null, 1))
