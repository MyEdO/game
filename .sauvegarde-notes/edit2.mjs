import { readFileSync, writeFileSync } from 'node:fs'
const edit = (f, pairs) => {
  let s = readFileSync(f, 'utf8')
  for (const [a, b] of pairs) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`${f} occurrences ${n} : ${a.slice(0, 60)}`); s = s.replace(a, () => b) }
  writeFileSync(f, s)
}
edit('/home/user/game/scripts/ops/etapesDuTrain.mjs', [
  [`import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
`, ''],
  [`      const { racine, questions } = ctx
      for (const nom of ['rebase-merge', 'rebase-apply']) {
        const chemin = questions.cheminGit(nom)
        if (chemin && existsSync(resolve(racine, chemin)))
          return { ok: false, raison: \`rebase interrompu (\${nom}) : \\\`git rebase --abort\\\` ou \\\`--continue\\\` à la main, puis \\\`--reprendre\\\`\` }
      }
`, `      const { racine, questions } = ctx
      const entame = questions.rebaseEntame()
      if (entame)
        return { ok: false, raison: \`rebase interrompu (\${entame}) : \\\`git rebase --abort\\\` ou \\\`--continue\\\` à la main, puis \\\`--reprendre\\\`\` }
`],
  [`      const { racine, questions } = ctx
      const teteAvant = ctx.tete`, `      const { questions } = ctx
      const teteAvant = ctx.tete`],
  [`        const entame = ['rebase-merge', 'rebase-apply'].some((nom) => {
          const chemin = questions.cheminGit(nom)
          return Boolean(chemin) && existsSync(resolve(racine, chemin))
        })
`, `        const entame = questions.rebaseEntame() !== null
`],
])
edit('/home/user/game/scripts/ops/publier.mjs', [
  [`  cheminGit: (nom) => cheminGit(depot, nom),
`, `  rebaseEntame: () => rebaseEntame(depot),
`],
])
edit('/home/user/game/scripts/ops/publier.test.mjs', [
  [`['brancheDe', 'ceQuiChange', 'cheminGit', 'cheminsEnConflit', 'cheminsSales', 'combienDe', 'commitsDeLaPlage', 'estAncetre', 'origineDe', 'relationAuTronc', 'shaDe']`,
   `['brancheDe', 'ceQuiChange', 'cheminsEnConflit', 'cheminsSales', 'combienDe', 'commitsDeLaPlage', 'estAncetre', 'origineDe', 'rebaseEntame', 'relationAuTronc', 'shaDe']`],
  [`  assert.throws(() => ctx.questions.cheminGit('rebase-merge'), GitIndisponible)`, `  assert.throws(() => ctx.questions.rebaseEntame(), GitIndisponible)`],
])
