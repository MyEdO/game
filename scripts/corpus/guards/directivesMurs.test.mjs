// #2724
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXTENSIONS_DE_SCRIPT } from '../../guards/lib/dialecte.mjs'
import { directivesLintCiblees, lintFixtures, porteCommentaireEslint } from '../../guards/lib/lint.testkit.mjs'
import murs, { MURS_EXEMPTABLES_AU_SITE } from '../../guards/lib/mursLint.mjs'
import configurationLint from '../../../oxlint.config.mjs'
import { estMur, fichiersSousUnMur } from '../../test/lib/bancLister.mjs'

const RACINE_DEPOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/** Les directives de `code` qu'aucun mur ne tolère : globale (sans règle nommée), ou qui nomme une
 *  restriction native, ou un mur hors de `vocabulaire`, ou un mur du vocabulaire sans viser UNE ligne
 *  (forme bloc, commentaire de configuration). */
function directivesRefusees(code, fichier, vocabulaire = MURS_EXEMPTABLES_AU_SITE) {
  return directivesLintCiblees(code, fichier, () => true).flatMap(({ ligne, cible, noms }) => {
    if (!noms.length) return [`${fichier}:${ligne}: directive globale, sans règle nommée`]
    return noms.filter(estMur).flatMap((nom) => !vocabulaire.includes(nom)
      ? [`${fichier}:${ligne}: \`${nom}\` ne s’éteint pas par directive`]
      : cible === null ? [`${fichier}:${ligne}: \`${nom}\` ne s’éteint qu’à sa ligne (\`-next-line\` ou \`-line\`)`] : [])
  })
}

// Parmi les fichiers suivis, ce filtre rend exactement ce que lit la gate lint (test IGNORES de `lister.test.mjs`) ;
// il y ajoute les non-suivis du disque.
test('DIRECTIVES DES MURS — sous un mur, une directive ne nomme qu’un mur du vocabulaire, à sa ligne, jamais une restriction native ni rien', () => {
  const corpus = fichiersSousUnMur(RACINE_DEPOT).filter((rel) => EXTENSIONS_DE_SCRIPT.some((ext) => rel.endsWith(ext)))
  for (const temoin of ['src/state/rollSeam.ts', 'scripts/docs/build-all.mjs', 'server/src/rand.ts']) {
    assert.ok(corpus.includes(temoin), `la marche des murs ne voit plus \`${temoin}\``)
  }
  const refus = corpus.flatMap((rel) => {
    const code = readFileSync(join(RACINE_DEPOT, rel), 'utf8')
    return porteCommentaireEslint(code) ? directivesRefusees(code, rel) : []
  })
  assert.deepEqual(refus, [], refus.join('\n'))
})

test('DIRECTIVES DES MURS — le vocabulaire ne nomme que des murs du greffon', () => {
  for (const nom of MURS_EXEMPTABLES_AU_SITE) assert.ok(murs.rules[nom.replace(/^murs\//, '')], `\`${nom}\` n’est pas un mur de mursLint.mjs`)
})

/** Un code qui déclenche le mur, dans un fichier qu'il arme. `natif` est armé par le banc seul. */
const DECLENCHEURS = {
  'murs/console-sans-title': ['src/ui/console', 'tsx', 'export const A = () => <b title="r">x</b>'],
  'murs/minuteries': ['src/state', 'ts', 'export const a = setTimeout'],
  'murs/minuteries-hote': ['src/state', 'ts', 'export const a = globalThis.setTimeout'],
  'murs/stockage-web': ['src', 'ts', 'export const a = window.localStorage'],
  'murs/stockage-web-global': ['src', 'ts', 'export const a = localStorage'],
  'murs/alea-serveur': ['server/src', 'ts', 'export const a = Math.random()'],
  'murs/marques': ['src', 'ts', 'export const a = (0 as unknown) as PlayerText'],
  'no-restricted-globals': ['src', 'ts', 'export const a = sessionStorage'],
}

/** [forme, mur visé, directive (`@` = la ligne du déclencheur), refusée, éteint le mur sous oxlint]. */
const BANC = [
  ['next-line oxlint', 'murs/console-sans-title', '// oxlint-disable-next-line murs/console-sans-title -- r\n@', true, true],
  ['next-line eslint', 'murs/minuteries', '// eslint-disable-next-line murs/minuteries\n@', true, true],
  ['line', 'murs/stockage-web', '@ // eslint-disable-line murs/stockage-web -- r', true, true],
  ['bloc nommé', 'murs/alea-serveur', '/* oxlint-disable murs/alea-serveur */\n@', true, true],
  ['globale bloc', 'murs/stockage-web-global', '/* eslint-disable */\n@', true, true],
  ['globale next-line', 'murs/stockage-web-global', '// oxlint-disable-next-line -- r\n@', true, true],
  ['natif restreint', 'no-restricted-globals', '// eslint-disable-next-line no-restricted-globals\n@', true, true],
  ['natif restreint préfixé', 'no-restricted-globals', '// eslint-disable-next-line eslint/no-restricted-globals\n@', true, true],
  ['blanc après un natif', 'murs/console-sans-title', '// oxlint-disable-next-line no-debugger murs/console-sans-title\n@', true, true],
  ['tabulation', 'murs/minuteries', '// oxlint-disable-next-line no-debugger\tmurs/minuteries\n@', true, true],
  ['bloc multiligne', 'murs/stockage-web-global', '/* oxlint-disable no-debugger\n   murs/stockage-web-global */\n@', true, true],
  ['justification collée', 'murs/minuteries-hote', '// oxlint-disable-next-line murs/minuteries-hote--r\n@', true, true],
  ['mur du vocabulaire mêlé', 'murs/minuteries', '// eslint-disable-next-line murs/marques, murs/minuteries\n@', true, true],
  ['mur du vocabulaire en bloc oxlint', 'murs/marques', '/* oxlint-disable murs/marques */\n@', true, true],
  ['mur du vocabulaire en bloc eslint', 'murs/marques', '/* eslint-disable murs/marques */\n@', true, true],
  ['mur du vocabulaire en configuration eslint', 'murs/marques', '/* eslint murs/marques: off */\n@', true, false],
  ['mur en configuration oxlint', 'murs/minuteries', '/* oxlint "murs/minuteries": "off" */\n@', true, false],
  ['mur du vocabulaire', 'murs/marques', '// oxlint-disable-next-line murs/marques -- r\n@', false, true],
  ['mur du vocabulaire en -line', 'murs/marques', '@ // eslint-disable-line murs/marques -- r', false, true],
  ['natif ordinaire', 'murs/stockage-web-global', '/* eslint-disable no-irregular-whitespace */\n@', false, false],
  ['natif préfixé ordinaire', 'murs/minuteries', '// eslint-disable-next-line typescript/no-empty-object-type -- r\n@', false, false],
  ['mur dans la justification collée', 'murs/stockage-web-global', '// oxlint-disable-next-line no-debugger--r murs/stockage-web-global\n@', false, false],
  ['réactivation', 'murs/minuteries', '/* eslint-enable */\n@', false, false],
  ['chaîne', 'murs/stockage-web-global', 'export const s = "/* eslint-disable */"\n@', false, false],
]

test('DIRECTIVES DES MURS — banc : la garde refuse ce qui éteint un mur sous oxlint, hors vocabulaire à sa ligne', () => {
  const fixtures = BANC.map(([, mur, directive], i) => {
    const [dossier, ext, ligne] = DECLENCHEURS[mur]
    return { filePath: `${dossier}/zz-banc-directive-${i}.${ext}`, code: `${directive.replace('@', ligne)}\n` }
  })
  const resultats = lintFixtures(fixtures, { overrides: [...configurationLint.overrides,
    { files: ['src/zz-banc-directive-*.ts'], rules: { 'no-restricted-globals': ['error', 'sessionStorage'] } }] })
  BANC.forEach(([forme, mur, , refusee, eteint], i) => {
    assert.equal(directivesRefusees(fixtures[i].code, fixtures[i].filePath).length > 0, refusee, `forme « ${forme} » : refus de la garde`)
    assert.equal(!resultats[i].messages.some((m) => m.ruleId === mur), eteint, `forme « ${forme} » : effet sous oxlint`)
    if (!refusee) assert.ok(!eteint || MURS_EXEMPTABLES_AU_SITE.includes(mur), `forme « ${forme} » admise alors qu’elle éteint \`${mur}\``)
  })
  const temoins = lintFixtures(Object.entries(DECLENCHEURS).map(([, [dossier, ext, ligne]], i) => ({ filePath: `${dossier}/zz-banc-directive-${100 + i}.${ext}`, code: `${ligne}\n` })),
    { overrides: [...configurationLint.overrides, { files: ['src/zz-banc-directive-*.ts'], rules: { 'no-restricted-globals': ['error', 'sessionStorage'] } }] })
  Object.keys(DECLENCHEURS).forEach((mur, i) => assert.ok(temoins[i].messages.some((m) => m.ruleId === mur), `le déclencheur de \`${mur}\` ne le déclenche plus`))
  assert.deepEqual(directivesRefusees(fixtures[0].code, fixtures[0].filePath, [...MURS_EXEMPTABLES_AU_SITE, 'murs/console-sans-title']), [], 'le vocabulaire décide seul')
})
