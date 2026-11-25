// Tests de la porte de PLAGE (`plageStock.mjs`) : le solde d'une fusion du tronc sur le cumul (#3050).
// Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { lectureDeLaPlage, refusDeLaPlage, croissancesDeLaPlage } from './plageStock.mjs'
import { sousGitFeint } from './depotGabarit.mjs'
import { PORTEUR, lireEtJugerLaPlage, CHANTIER, refusDe, depotDeChantier, cliquet, auHook } from './plageStock.testkit.mjs'

// ── #2223 : le hook de commit juge une fusion EN COURS sur son apport, comme la plage ──────────────

const clesDuSolde = ['k1', 'k2', 'k3', 'k4', 'k6', 'k7']
const stockDuSolde = (cles) => clesDuSolde.map((cle) => [
  `export const stock_${cle} = [`,
  ...(cles.includes(cle) ? [`  { fichier: 'src/${cle}.ts', ref: 'r' },`] : []),
  ']\n',
].join('\n')).join('\n')

for (const { nom, socle, amont, avant, branche, resolution, apres, projection, net, incrementale, soldeEteint, renomme, avantDeclare = true, cleNeuve = 'k2', journalIllisible } of [
  {
    nom: 'un retrait commun ne paie pas k2',
    socle: ['k1', 'k3'], amont: ['k1'], branche: ['k1', 'k2'],
    projection: { k2: 1 }, net: 1, incrementale: true, journalIllisible: true,
  },
  {
    nom: 'le retrait commun ne paie pas k2 après renommage du porteur',
    socle: ['k1', 'k3'], amont: ['k1'], branche: ['k1', 'k2'], renomme: 'avant',
    projection: { k2: 1 }, net: 1, incrementale: true,
  },
  {
    nom: 'le renommage après la fusion conserve le refus d’origine',
    socle: ['k1', 'k3'], amont: ['k1'], branche: ['k1', 'k2'], renomme: 'apres',
    projection: { k2: 1 }, net: 1,
  },
  {
    nom: 'le retrait effectif de k4 paie k2',
    socle: ['k1', 'k3', 'k4'], amont: ['k1', 'k4'], branche: ['k1', 'k2'],
    projection: { k2: 1, k4: -1 }, net: 0,
  },
  {
    nom: 'la résolution identique au tronc ne porte pas k2',
    socle: ['k1', 'k3'], amont: ['k1'], branche: ['k1', 'k2'], resolution: ['k1'],
    projection: {}, net: 0,
  },
  {
    nom: 'le cliquet antérieur qui a introduit k2 reste acquis',
    socle: ['k1', 'k3'], amont: ['k1'], avant: ['k1', 'k2', 'k3'], branche: ['k1', 'k2'],
    projection: { k2: 1 }, net: 0,
  },
  {
    nom: 'le double solde suit le remplacement muet de k2 par k4',
    socle: ['k1', 'k3'], amont: ['k1'], avant: ['k1', 'k2'], avantDeclare: false, branche: ['k1', 'k4'],
    projection: { k4: 1 }, net: 1, cleNeuve: 'k4',
  },
  {
    nom: 'le crédit autorisé suit le remplacement de k2 par k4',
    socle: ['k1', 'k3'], amont: ['k1'], avant: ['k1', 'k2', 'k3'], branche: ['k1', 'k4'],
    projection: { k4: 1 }, net: 0,
  },
  {
    nom: 'le cliquet de k6 écartée de la fusion ne paie pas k2',
    socle: ['k1', 'k3'], amont: ['k1'], avant: ['k1', 'k3', 'k6'], branche: ['k1', 'k2', 'k6'], resolution: ['k1', 'k2'],
    projection: { k2: 1 }, net: 1,
  },
  {
    nom: 'un retrait ultérieur sous k4 ne filtre pas la dette visible sous k2',
    socle: ['k1', 'k3', 'k4'], amont: ['k1', 'k4'], branche: ['k1', 'k2', 'k4'], apres: ['k1', 'k2'],
    projection: { k2: 1, k4: -1 }, net: 1,
  },
  {
    nom: 'une hausse ultérieure autorisée ne réveille pas k2 retirée',
    socle: ['k1', 'k3'], amont: ['k1'], branche: ['k1', 'k2'], apres: ['k1', 'k6', 'k7'],
    projection: { k6: 1, k7: 1 }, net: 1, soldeEteint: true,
  },
]) {
  test(`#3050 : ${nom}`, async () => {
    const d = depotDeChantier({ [PORTEUR]: stockDuSolde(socle), 'scripts/hooks/registres-porteurs.json': '[]' })
    const { repo, git, poser } = d
    try {
      git('checkout', '-q', '-b', 'tronc', d.debut)
      const tronc = poser({ [PORTEUR]: stockDuSolde(amont) }, 'le tronc retire k3')
      git('update-ref', 'refs/remotes/origin/main', tronc)
      git('checkout', '-q', 'chantier')
      if (avant) poser({ [PORTEUR]: stockDuSolde(avant) }, `le chantier introduit une entrée${avantDeclare ? cliquet(PORTEUR, 1) : ''}`)
      writeFileSync(join(repo, PORTEUR), stockDuSolde(branche))
      git('add', PORTEUR)
      const messageDuChantier = 'refs #3050 — solde du chantier'
      assert.equal(await auHook(repo, messageDuChantier), null, 'le commit ordinaire est admis')
      let cote = poser({}, messageDuChantier)
      const porteurFinal = renomme ? 'scripts/y.test.mjs' : PORTEUR
      const porteurDansLaFusion = renomme === 'avant' ? porteurFinal : PORTEUR
      const renommerLePorteur = () => {
        git('mv', PORTEUR, porteurFinal)
        const sha = poser({}, 'renomme le porteur')
        assert.equal(git('diff', '--name-status', '-M', `${sha}^`, sha).trim(), `R100	${PORTEUR}	${porteurFinal}`)
        return sha
      }
      if (renomme === 'avant') cote = renommerLePorteur()
      git('merge', '-q', '--no-ff', '--no-commit', 'tronc')
      assert.equal(git('show', `:${porteurDansLaFusion}`), stockDuSolde(branche), 'la fusion automatique emporte le porteur de la branche')
      if (resolution) {
        writeFileSync(join(repo, porteurDansLaFusion), stockDuSolde(resolution))
        git('add', porteurDansLaFusion)
      }
      const message = 'merge: refs #3050 — intègre le tronc'
      const auCommit = await auHook(repo, message)
      if (incrementale) assert.equal(await auHook(repo, message + cliquet(porteurDansLaFusion, 1)), null, 'un cliquet exact autorise la croissance')
      const fusion = poser({}, message)
      let fin = fusion
      if (apres) fin = poser(
        { [PORTEUR]: stockDuSolde(apres) },
        `le chantier modifie le stock après la fusion${soldeEteint ? cliquet(PORTEUR, 1) : ''}`,
      )
      if (renomme === 'apres') fin = renommerLePorteur()
      const prePush = { cwd: repo, debut: tronc, fin, vers: CHANTIER }
      const projeter = (bilan) => Object.fromEntries(bilan.find((b) => b.fichier === porteurFinal)?.parCle ?? [])
      const clesAttendues = Object.fromEntries(Object.entries(projection).map(([cle, n]) => [`src/${cle}.ts`, n]))
      const { lue: luePrePush, verdict: verdictPrePush } = await lireEtJugerLaPlage(prePush)
      assert.deepEqual(projeter(luePrePush.projectionDuTronc), clesAttendues, 'projection des clés réelles depuis le tronc')
      const refusPrePush = refusDe(verdictPrePush)
      const refusCI = refusDe(await croissancesDeLaPlage({ cwd: repo, fin }))
      const attendu = net && !soldeEteint ? [[fusion, porteurDansLaFusion, net]] : []
      assert.deepEqual({
        commit: auCommit?.reason.includes(`${porteurDansLaFusion} : +1`) && auCommit.reason.includes(`src/${cleNeuve}.ts`) ? 1 : auCommit,
        prePush: refusPrePush,
        ci: refusCI,
      }, { commit: net || null, prePush: attendu, ci: attendu })
      if (incrementale) {
        const options = { ...prePush, debut: cote }
        const { lue, verdict } = await lireEtJugerLaPlage(options)
        if (!renomme) assert.deepEqual(projeter(lue.cumul), { 'src/k3.ts': 1 }, 'témoin du filtre incrémental par différence')
        assert.deepEqual(projeter(lue.projectionDuTronc), clesAttendues)
        assert.deepEqual(refusDe(verdict), attendu)
        if (journalIllisible) {
          // Les feintes sondent la première lecture du journal de la fusion.
          const lueSansJugement = lectureDeLaPlage(options)
          const avecPanne = (feinte) => () => sousGitFeint([feinte], () => refusDeLaPlage(lueSansJugement))
          assert.throws(
            avecPanne({ si: ['--format=%H %T %P'], absent: true }),
            { name: 'GitIndisponible', message: /journal des stocks.*graphe illisible/ },
          )
          assert.throws(
            avecPanne({ si: ['--format=%H%x1f%cd%x1f%B%x00'], status: 0 }),
            { name: 'GitIndisponible', message: /journal des stocks.*message du commit.*absent/ },
          )
          assert.throws(
            avecPanne({ si: ['--format=%H %T %P'], status: 0 }),
            { name: 'GitIndisponible', message: /journal des stocks.*graphe et messages discordants/ },
          )
        }
      }
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
}
