import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ast, typescript } from './dialecte.mjs'
import { croissanceDesStocks, estPorteurDeStock } from './stocksNominatifs.mjs'

const PORTEUR = 'scripts/guards/lib/formeDeWorkflow.mjs'
test('la table réelle de workflow est portée par la garde nominative et sa croissance est refusée', () => {
  assert.equal(estPorteurDeStock(PORTEUR), true)
  const source = readFileSync(fileURLToPath(new URL('./formeDeWorkflow.mjs', import.meta.url)), 'utf8')
  const sf = ast({ rel: PORTEUR, text: source })
  const ts = typescript()
  const regime = sf.statements.flatMap((s) => ts.isVariableStatement(s) ? s.declarationList.declarations : []).find((d) => ts.isIdentifier(d.name) && d.name.text === 'REGIMES')
  assert.ok(regime && ts.isObjectLiteralExpression(regime.initializer))
  const position = regime.initializer.getStart(sf) + 1
  const post = source.slice(0, position) + "\n  'scripts/temoin.workflow.js': { Audit: 'jugement' }," + source.slice(position)
  const diff = `--- a/${PORTEUR}\n+++ b/${PORTEUR}\n@@ -1,1 +1,1 @@\n-${source.replaceAll('\n', '\n-')}\n+${post.replaceAll('\n', '\n+')}\n`
  const refus = croissanceDesStocks(diff, { lirePreImage: (f) => f === PORTEUR ? source : null, lirePostImage: (f) => f === PORTEUR ? post : null })
  assert.equal(refus.length, 1)
  assert.equal(refus[0].fichier, PORTEUR)
  assert.equal(refus[0].net, 1)
})
