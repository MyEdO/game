// Le banc partagé des tests de la porte de PLAGE (`plageStock*.test.mjs`) : le porteur, ses entrées, les dépôts
// jetables forgés sur la porte du disque et la lecture jugée de la plage (#5037).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PORTE_DE_PLAGE, croissancesDeLaPlage } from './plageStock.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'
import { fermetureSurDisque } from './porteDEre.mjs'
import { gitDe } from '../../test/gitDeBanc.mjs'

export const PORTEUR = 'scripts/x.test.mjs'

/** Un dépôt forgé dont le socle porte la porte de plage du disque : son tronc la juge par elle (#2503). */
export const PORTE_SUR_DISQUE = Object.fromEntries(fermetureSurDisque(PORTE_DE_PLAGE.module))
export const depotForge = (params) => instanceDeDepot({ ...params, fichiers: { ...PORTE_SUR_DISQUE, ...params.fichiers } })

export const A = "  'src/a.ts',"
export const B = "  'src/b.ts',"
export const C = "  'src/c.ts',"
export const D = "  'src/d.ts',"

export const sourceStock = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`

export async function lireEtJugerLaPlage(options) {
  let lue
  const verdict = await croissancesDeLaPlage(options, (lecture) => { lue = lecture })
  return { lue, verdict }
}

export const MANIFESTE = 'src/data/primitives.manifest.json'
export const CONSOLE = 'src/ui/styles/console.css'
export const COMPOSANT = 'src/ui/Console.tsx'
export const ECRAN1 = 'src/ui/Ecran1.tsx'
export const manifesteAvec = (...entrees) => `${JSON.stringify([{ id: 'a' }, ...entrees])}\n`
export const PRIMITIVE_CONSOLE = { id: 'console', fichier: COMPOSANT, css: CONSOLE }
export const RECLASSE = `refactor: console réutilisée\n\nRECLASSEMENT: ${CONSOLE} +3 — la console devient une primitive, refs #1806`
export const importeur = (nom) => `import { Console } from './Console'\nexport const ${nom} = Console\n`

/** Dépôt jetable : la console est revendiquée au manifeste, mais UN seul écran l'importe — son
 *  module est au stock (#1806 L1). */
export function depotCss() {
  const { racine, sha } = depotForge({
    fichiers: {
      [MANIFESTE]: manifesteAvec(PRIMITIVE_CONSOLE),
      [CONSOLE]: '.c { color: red; border: 0; gap: 3px }\n',
      [COMPOSANT]: 'export const Console = 1\n',
      [ECRAN1]: importeur('Ecran1'),
    },
    message: 'socle',
  })
  const git = gitDe(racine)
  const commettre = (fichiers, message) => {
    for (const [f, texte] of Object.entries(fichiers)) {
      if (texte === null) git('rm', '-q', f)
      else writeFileSync(join(racine, f), texte, 'utf8')
    }
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', message)
    return git('rev-parse', 'HEAD').trim()
  }
  return { racine, base: sha, git, commettre }
}

/** Dépôt jetable dont `main` fusionne une branche `cote`. La branche fait grandir le stock sous son
 *  CLIQUET ; `retouche` (texte du porteur posé DANS la fusion, ou `null`) rend la fusion maléfique. */
export function depotAFusion(retouche) {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A]), 'autre.txt': 'o\n' }, message: 'socle' })
  const git = gitDe(repo)
  git('checkout', '-q', '-b', 'cote')
  writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'cote\n\nCLIQUET: scripts/x.test.mjs +1 — fixture du test neuf, motif assez long')
  git('checkout', '-q', 'main')
  writeFileSync(join(repo, 'autre.txt'), 'o\np\n', 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'main')
  git('merge', '-q', '--no-ff', '--no-commit', 'cote')
  if (retouche !== null) {
    writeFileSync(join(repo, PORTEUR), retouche, 'utf8')
    git('add', PORTEUR)
  }
  git('commit', '-q', '--no-verify', '-m', 'fusion de cote')
  return { repo, socle, fusion: git('rev-parse', 'HEAD').trim() }
}

export const CHANTIER = 'refs/heads/chantier'

export const refusDe = (vu) => vu.refus.map((r) => [r.sha, r.fichier, r.net])

/** Dépôt jetable dont `origin/main` reste au socle ; `poser(fichiers, message)` écrit (`null` =
 *  supprime) puis commet, et rend le sha. */
export function depotDeChantier(fichiers) {
  const { racine: repo, sha: debut } = depotForge({ fichiers, message: 'socle' })
  const git = gitDe(repo)
  git('update-ref', 'refs/remotes/origin/main', debut)
  git('checkout', '-q', '-b', 'chantier')
  const poser = (aPoser, message) => {
    for (const [rel, texte] of Object.entries(aPoser)) {
      if (texte === null) git('rm', '-q', rel)
      else {
        mkdirSync(dirname(join(repo, rel)), { recursive: true })
        writeFileSync(join(repo, rel), texte, 'utf8')
        git('add', rel)
      }
    }
    git('commit', '-q', '--no-verify', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD').trim()
  }
  const optionsDePlage = (fin) => ({ cwd: repo, debut, fin, vers: CHANTIER })
  return { repo, debut, git, poser, optionsDePlage, plage: (fin) => croissancesDeLaPlage(optionsDePlage(fin)) }
}

const MOTIF_LONG = 'motif assez long pour la porte'
export const cliquet = (fichier, n) => `\n\nCLIQUET: ${fichier} +${n} — ${MOTIF_LONG}`
export const ent = (f, c = '') => `  '${f}',${c ? ` // ${c}` : ''}`
export const SIX = ['src/k1.ts', 'src/k2.ts', 'src/k3.ts', 'src/k4.ts', 'src/k5.ts', 'src/k6.ts'].map((f) => ent(f))

/** `depotDeChantier` d'un porteur de six entrées ; `fusionner(...cotes)` laisse la fusion EN COURS,
 *  conflit compris, et `poser` la conclut. */
export function depotConstruit(fichiers = {}) {
  const d = depotDeChantier({ [PORTEUR]: sourceStock(SIX), ...fichiers })
  const fusionner = (...cotes) => {
    try {
      d.git('merge', '-q', '--no-ff', '--no-verify', '--no-commit', ...cotes)
    } catch {
      // conflit : la résolution est posée par `poser`
    }
  }
  return { ...d, fusionner, juger: async (debut, fin, vers = CHANTIER) => refusDe(await croissancesDeLaPlage({ cwd: d.repo, debut, fin, vers })) }
}

export const messageDeFusion = (lignes = '') => `chore(merge): refs #2223 — fusion de main${lignes}`
/** Le verdict de la porte du commit (`jugerLeCommit`) sur l'index de `repo`, sous le message `message`. */
export const auHook = async (repo, message) => {
  const { jugerLeCommit } = await import('../../git-hooks/porte-du-commit.mjs')
  return jugerLeCommit({ message, dir: repo, today: '2026-10-01' })
}
