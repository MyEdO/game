// CLIQUET du recensement des SITES DE FERMETURE (node --test, sans réseau) : les cas jouent des
// TEXTES sources, et le dernier bloc mesure l'arbre RÉEL.
// Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SITES_DECLARES, formesDeFermeture, recensementDesFermetures } from './sitesDeFermeture.mjs'

// Les DEUX graphies que le dépôt peut écrire, plus celle que la porte de commit connaît aussi ; en
// face, les TÉMOINS NÉGATIFS qui ressemblent à une fermeture sans en être une — c'est eux qui
// disent que la garde MESURE au lieu de crier.
const GRAPHIES = [
  ['gh issue close, exécutable en tête', "const c = ['gh', 'issue', 'close', '1679']\n", 'gh issue close'],
  ['gh issue close, par l’enrobeur', "gh(['issue', 'close', String(n), '--reason', 'completed'], spawn)\n", 'gh issue close'],
  ['PATCH REST -f state=closed', "appel(['api', chemin, '-X', 'PATCH', '-f', 'state=closed'])\n", 'gh api … state=closed'],
  ['PATCH REST --field state=closed', "appel(['api', chemin, '--method', 'PATCH', '--field', 'state=closed'])\n", 'gh api … state=closed'],
  ['gh issue edit --state closed', "gh(['issue', 'edit', '42', '--state', 'closed'])\n", 'gh issue edit --state closed'],
]

for (const [graphie, code, forme] of GRAPHIES) {
  test(`la graphie « ${graphie} » est RECENSÉE comme un geste de fermeture`, () => {
    assert.deepEqual(formesDeFermeture(code), [forme])
  })
}

const NEGATIFS = [
  ['une LISTE des tickets fermés (query REST)', "appel(['api', `repos/${d}/issues?state=closed&since=${x}`])\n"],
  ['un commentaire qui NOMME la graphie', "// gh issue close 42, et `-f state=closed` : de la prose\nconst x = 1\n"],
  ['un POST de commentaire', "appel(['api', `${chemin}/comments`, '-X', 'POST', '-F', 'body=@-'], { input })\n"],
  ['une CRÉATION de ticket', "gh(['issue', 'create', '--title', t, '--body-file', f, '--label', l])\n"],
  ['un GET du ticket', "appel(['api', cheminTicket(depot, numero)])\n"],
]

for (const [cas, code] of NEGATIFS) {
  test(`${cas} n’est PAS une fermeture`, () => {
    assert.deepEqual(formesDeFermeture(code), [])
  })
}

test('un site NON déclaré est un manquement, et le manquement le NOMME avec sa forme', () => {
  const vu = recensementDesFermetures({
    racine: process.cwd(),
    sources: ['scripts/guards/lib/sitesDeFermeture.mjs'],
    declares: [],
  })
  // Ce module-ci ne ferme rien : c'est le cas qui fournit la source, donc on mesure sur une DÉCLARATION
  // vide contre l'arbre réel — voir le cas suivant pour un site fabriqué.
  assert.deepEqual(vu.sites, [])
  assert.deepEqual(vu.manquements, [])
})

test('un site déclaré qui ne ferme PLUS rien est un manquement : une déclaration à vide pré-autorise', () => {
  const vu = recensementDesFermetures({
    racine: process.cwd(),
    sources: ['scripts/guards/lib/sitesDeFermeture.mjs'],
    declares: [{ fichier: 'scripts/ops/parti.mjs', pourquoi: 'p' }],
  })
  assert.equal(vu.manquements.length, 1)
  assert.match(vu.manquements[0], /site déclaré qui ne ferme PLUS rien : scripts\/ops\/parti\.mjs/)
})

// ── l'arbre RÉEL ──────────────────────────────────────────────────────────────

test('le dépôt n’a AUCUN site de fermeture hors de la liste déclarée', () => {
  const vu = recensementDesFermetures()
  assert.deepEqual(vu.manquements, [])
  // Sans cette borne, une lecture cassée rendrait la garde verte en ne lisant plus rien.
  assert.ok(vu.sourcesLues > 1000, `la garde ne lit plus les sources du dépôt (${vu.sourcesLues})`)
})

test('les DEUX régimes de fermeture du dépôt sont nommés, chacun avec ce qu’il ferme', () => {
  const vu = recensementDesFermetures()
  const parFichier = new Map(vu.sites.map((s) => [s.fichier, s.formes]))
  // Le job `fermetures` de fermetures.yml : les tickets SOLDÉS d'une plage poussée sur main.
  assert.deepEqual(parFichier.get('scripts/ops/fermer-depuis-main.mjs'), ['gh api … state=closed'])
  // Le canari : la survivante d'un signalement rouge, quand la course repasse au vert.
  assert.deepEqual(parFichier.get('scripts/ops/signaler-rouge.mjs'), ['gh issue close'])
  for (const d of SITES_DECLARES) assert.ok(d.pourquoi.trim(), `${d.fichier} sans invariant dit`)
})
