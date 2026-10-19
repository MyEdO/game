import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { correspondGlob, listerArbre, parUnitesDeCode } from '../../guards/lib/lister.mjs'
import { lancerLint } from '../../guards/lib/lintStage.mjs'
import { GENERATORS, NON_GENERATOR_CHECKS } from '../../docs/build-all.mjs'
import { BLOCS_LINT as configEslint, REGLES_ORDRE_TOTAL } from '../../../oxlint.config.mjs'
/** Le bloc de la config réelle qui déclare cette règle du mur — UN seul (volet UNICITÉ). */
function blocDe(regle) {
  const bloc = configEslint.find((c) => c?.rules && regle in c.rules)
  assert.ok(bloc, `\`${regle}\` n’est déclarée par aucun bloc d’oxlint.config.mjs`)
  return bloc
}
/** Les blocs du mur de l'ordre total, un par règle de `REGLES_ORDRE_TOTAL`. */
const blocsDuMur = () => Object.keys(REGLES_ORDRE_TOTAL).map(blocDe)
const couvre = (bloc, rel) => bloc.files.some((g) => correspondGlob(rel, g))
const exempte = (bloc, rel) => (bloc.excludeFiles ?? []).some((g) => correspondGlob(rel, g))
const racinesDuRegistre = () => [...new Set([...GENERATORS.map((g) => g.script), ...NON_GENERATOR_CHECKS])].sort()

const RESTRICTION_NATIVE = /^(?:[\w-]+\/)?no-restricted-(?:syntax|imports|properties|globals)$/
/** Un mur : règle du greffon `murs`, ou restriction native. @param {string} nom */
const estMur = (nom) => nom.startsWith('murs/') || RESTRICTION_NATIVE.test(nom)

/** Ce fichier est-il armé par au moins un mur de la config réelle ? @param {string} rel */
const armeParUnMur = (rel) => configEslint.some((b) => Object.keys(b.rules ?? {}).some(estMur) && couvre(b, rel) && !exempte(b, rel))

/** Les fichiers du DISQUE, toutes extensions, qu'arme au moins un mur, marchés depuis les racines que ses globs nomment. */
function fichiersSousUnMur(racine) {
  const blocs = configEslint.filter((b) => Object.keys(b.rules ?? {}).some(estMur))
  const racines = [...new Set(blocs.flatMap((b) => b.files.map((g) => g.split('/')[0])))].sort(parUnitesDeCode)
  for (const r of racines) assert.doesNotMatch(r, /[*?{]/, `un mur vise \`${r}\` : la marche ne sait pas nommer cette racine`)
  return racines
    .flatMap((r) => listerArbre(join(racine, r), { descendre: (rel) => !/(^|\/)(node_modules|\.git)$/.test(rel) }).map((rel) => `${r}/${rel}`))
    .filter(armeParUnMur)
}

/** Ceux des `fichiers` (leurs `.gitignore` compris) que la gate `npm run lint` lit : copiés dans un dossier
 *  neuf, puis UN lancement de sa commande (`lancerLint`, `appelDuLint`) qui DÉCOUVRE `.`, sous la config
 *  réelle dont les murs sont remplacés par le seul témoin `murs/dialecte` sur `Program`.
 *  `textes` substitue le contenu d'un fichier (banc). @param {string} racine @param {string[]} fichiers
 *  @param {Map<string, string>} [textes] @returns {Set<string>} */
function fichiersLus(racine, fichiers, textes = new Map()) {
  const dossier = mkdtempSync(join(tmpdir(), 'lint-lus-'))
  try {
    for (const rel of fichiers) {
      mkdirSync(dirname(join(dossier, rel)), { recursive: true })
      if (textes.has(rel)) writeFileSync(join(dossier, rel), textes.get(rel))
      else copyFileSync(join(racine, rel), join(dossier, rel))
    }
    const temoin = 'murs/dialecte'
    const { defauts } = lancerLint(racine, ['.'], { cwd: dossier, configuration: {
      overrides: [{ files: ['**/*'], rules: { [temoin]: ['error', { selector: 'Program', message: 'lu' }] } }],
      rules: {}, options: { reportUnusedDisableDirectives: 'off' },
    } })
    assert.deepEqual(defauts.filter((d) => d.regle !== temoin), [], 'oxlint rapporte autre chose que le témoin de lecture')
    return new Set(defauts.map((d) => d.site.replace(/:\d+:\d+$/, '')))
  } finally { rmSync(dossier, { recursive: true, force: true }) }
}

export { armeParUnMur, blocDe, blocsDuMur, couvre, estMur, exempte, fichiersLus, fichiersSousUnMur, racinesDuRegistre }
