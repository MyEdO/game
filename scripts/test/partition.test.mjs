import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { analyserTexte } from '../guards/lib/dialecte.mjs'
import { evaluateurDuDepot, lectureDeModule } from '../guards/lib/racinesBalayees.mjs'
import { admissionNode, memoireDisponibleOctets } from './partition.mjs'

const nombres = { disponible: 100, contrainte: 200, libre: 300, totale: 400 }

test('admission node : refus sous P+M seul, objectif et cœurs bornent la concurrence sans refuser, fichier dimensionnant', () => {
  const profils = ['a', 'b', 'c'].map((fichier) => ({ fichier, picOctets: 100 }))
  const admission = (disponibleOctets, options = {}) => admissionNode(8, disponibleOctets, { profils, parentOctets: 20, ...options })
  assert.deepEqual([admission(119).refus, admission(119).minimumOctets, admission(119).concurrence], ['MEMOIRE_INSUFFISANTE', 120, 0])
  assert.deepEqual([admission(120).refus, admission(120).concurrence], [null, 1])
  assert.equal(admission(320).concurrence, 3)
  assert.equal(admission(10_000).concurrence, 3)
  assert.equal(admissionNode(2, 10_000, { profils, parentOctets: 20 }).concurrence, 2)
  assert.equal(admission(10_000, { objectifOctets: 220 }).concurrence, 2)
  assert.deepEqual([admission(10_000, { objectifOctets: 50 }).refus, admission(10_000, { objectifOctets: 50 }).concurrence], [null, 1])
  const grand = admissionNode(8, 10 * 2 ** 30, { profils: [{ fichier: 'petit', picOctets: 100 }, { fichier: 'grand', picOctets: 3 * 2 ** 30 }], parentOctets: 20 })
  assert.deepEqual([grand.refus, grand.concurrence, grand.fichierDimensionnant, grand.budgetOctets], [null, 1, 'grand', 2.5 * 2 ** 30])
  assert.equal(admissionNode(8, 3 * 2 ** 30 + 19, { profils: [{ fichier: 'grand', picOctets: 3 * 2 ** 30 }], parentOctets: 20 }).refus, 'MEMOIRE_INSUFFISANTE')
})

test('cgroup : chemins exacts, priorité v1 et suffixes opaques conservés', () => {
  const cas = [
    ['4:memory:/api/bash\n', '/sys/fs/cgroup/memory/api/bash/memory.stat'],
    ['0::/api/v2\n', '/sys/fs/cgroup/api/v2/memory.stat'],
    ['4:memory:/api/bash\n0::/api/v2\n', '/sys/fs/cgroup/memory/api/bash/memory.stat'],
    ['', null],
  ]
  for (const suffixe of ['/', '//', '', '/../../Source']) {
    for (const [ligne, base] of [['4:memory:', '/sys/fs/cgroup/memory'], ['0::', '/sys/fs/cgroup']]) {
      cas.push([`${ligne}${suffixe}\n`, `${(base + suffixe).replace(/\/$/, '')}/memory.stat`])
    }
  }
  for (const [procCgroup, chemin] of cas) {
    const lus = []
    const resultat = memoireDisponibleOctets(procCgroup, (fichier) => {
      lus.push(fichier)
      return 'total_inactive_file 20\ntotal_active_file 30\ninactive_file 20\nactive_file 30\nfile 999999\n'
    }, nombres)
    assert.deepEqual(lus, chemin === null ? [] : [chemin], procCgroup)
    assert.equal(resultat, chemin === null ? 100 : 150, procCgroup)
  }
})

test('cgroup : mémoire bornée, absence de contrainte et lectures défaillantes', () => {
  const procCgroup = '4:memory:/api/bash\n'
  const lire = () => 'total_inactive_file 20\ntotal_active_file 30\n'
  assert.equal(memoireDisponibleOctets(procCgroup, lire, { ...nombres, libre: 120 }), 120)
  assert.equal(memoireDisponibleOctets(procCgroup, () => { throw new Error('ENOENT') }, nombres), 100)
  assert.equal(memoireDisponibleOctets(procCgroup, () => 'total_active_file 30\n', nombres), 100)
  for (const contrainte of [0, 400, 500]) {
    assert.equal(memoireDisponibleOctets(procCgroup, () => assert.fail('lecture sans contrainte'), { ...nombres, contrainte }), 100)
  }
})

test('cgroup : le véritable module couvre les suffixes opaques depuis sa seule base déclarée', () => {
  const partition = 'scripts/test/partition.mjs'
  const entree = 'scripts/test/entree-cgroup.mjs'
  const modules = {
    [partition]: readFileSync(new URL('./partition.mjs', import.meta.url), 'utf8'),
    [entree]: "import { readFileSync } from 'node:fs'; import { memoireDisponibleOctets } from './partition.mjs'; memoireDisponibleOctets('0::/../../Source', chemin => readFileSync(chemin, 'utf8'), { disponible: 100, contrainte: 200, libre: 300, totale: 400 });",
  }
  const lectures = new Map()
  const evaluateur = evaluateurDuDepot({
    lecture: (rel) => {
      if (!Object.hasOwn(modules, rel)) return null
      if (!lectures.has(rel)) lectures.set(rel, lectureDeModule(rel, analyserTexte({ rel, text: modules[rel] }).sourceFile))
      return lectures.get(rel)
    },
    cible: (rel, spec) => {
      const cible = posix.join(posix.dirname(rel), spec)
      return spec.startsWith('.') && Object.hasOwn(modules, cible) ? cible : null
    },
  })
  const sites = evaluateur.sitesDe(entree).filter((site) => !site.relais)
  const valeurs = sites.flatMap((site) => site.valeurs)
  assert.ok(valeurs.some((valeur) => valeur.chemin === '' && valeur.sous?.includes(`${partition}#racineCgroupLinux:/sys/fs/cgroup`)), JSON.stringify(sites))
  assert.ok(!valeurs.some((valeur) => valeur.non && valeur.non !== 'valeur nulle'), JSON.stringify(sites))
  assert.ok(!valeurs.some((valeur) => valeur.hors), JSON.stringify(sites))
})
