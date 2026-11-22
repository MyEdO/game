import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entreeDHote } from './entree-d-hote.mjs'

test("l'entrée virtuelle préserve les déclarations du pont, de l'hôte texte et des assets", () => {
  const entrees = {
    'wfrp-pont': ["import '/hotes/godot/pont/entree.ts';"],
    'hote-texte': [
      "export { creerHote } from '/src/hoteTexte/serveur.ts';",
      "export { testScenarios } from '/src/scenes/test-scenarios/index.ts';",
      "export { preferenceDef } from '/src/noyau/index.ts';",
    ],
    'godot-assets': [
      "export { importerPersonnage } from '/hotes/godot/asset/importer.ts';",
      "export * from '/scripts/personnage-3d/base/donneeDeDeclaration.ts';",
    ],
  }
  for (const [nom, lignes] of Object.entries(entrees)) {
    const { entree, id, greffons: [prose, chargement] } = entreeDHote(nom, lignes)
    assert.equal(entree, `virtual:${nom}`)
    assert.equal(id, `\0${entree}`)
    assert.equal(prose.name, 'wfrp:prose-source')
    assert.equal(chargement.name, `${nom}-entree`)
    assert.equal(chargement.resolveId(entree), id)
    assert.equal(chargement.resolveId(id), id)
    assert.equal(chargement.resolveId('/ailleurs.ts'), null)
    assert.equal(chargement.load(id), ["import '/src/data/overrides.ts';", ...lignes].join('\n'))
    assert.equal(chargement.load(entree), null)
  }
})

test("l'entrée virtuelle refuse les instructions et origines hors de sa déclaration statique", () => {
  for (const ligne of [
    'void 0;',
    'export const valeur = 0;',
    "import nom from '/src/data/overrides.ts';",
    "import('./inerte.ts');",
    "export { valeur } from 'node:path';",
    "import '../inerte.ts';",
    "import '/src/../inerte.ts';",
    "import '/src/./inerte.ts';",
    "import '/src/inerte.ts?suffixe';",
    "import '/src/inerte.ts#suffixe';",
    "import '/src/%69nerte.ts';",
    "import '/@fs/inerte.ts';",
    "import '//source.inerte/temoin.ts';",
  ]) {
    assert.throws(() => entreeDHote('banc', [ligne]), /imports latéraux et réexports statiques du dépôt attendus/, ligne)
  }
})
