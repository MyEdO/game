import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

if (import.meta.main) {
  const fichier = new URL('../../src/sonde-collision-2226.ts', import.meta.url)
  const source = 'export const migrations = {\n  1: () => 1,\n  1: () => 2,\n}\n'
  console.log(`${fileURLToPath(fichier)} — sonde temporaire #2226 : deux migrations de clé 1, TS1117 attendu du typecheck`)
  if (process.argv.includes('--dry-run')) console.log(source)
  else writeFileSync(fichier, source, { encoding: 'utf8', flag: 'wx' })
}
