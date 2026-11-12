// Les refus de `contratDe` (scripts/docs/build-contrat-du-pont.mjs, #3816), chacun nommé à son `fichier:ligne`, sur
// des fichiers en mémoire.
//   node --test scripts/docs/build-contrat-du-pont.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contratDe } from './build-contrat-du-pont.mjs'

const PONT = 'hotes/godot/pont/pont.ts'
const GD = 'hotes/godot/projet/scripts/contrat.gd'
const TITRES = ['En-tête', 'Transport', 'Erreurs', 'Suite', 'Vue', 'Monde', 'Éditeur', 'Lumière', 'Effets', 'Musique', "L'écran de Godot",
  "Corps d'un combattant", 'Atelier 3D', "Gabarit d'une base", "Composition d'un personnage", 'Pile des couches', 'Écran publié']

const pont = (methode) => `export function creerPont() {\n  const methodes = {\n${methode}\n    vue() { return {} },\n  }\n  return methodes\n}\n`
const AVEC_RETOUR = '    /** aucune\n     * @returns `{ vue }` */'
const gd = (titres) => titres.map((t) => `## @contrat ${t}\n## Le texte.\nfunc f_${titres.indexOf(t)}():\n\tpass\n`).join('\n')

/** Le contrat de `pont.ts` (sa méthode `vue` documentée par `methode`) et d'un `.gd` qui remplit `titres`, plus `autres`. */
const rendre = ({ methode = AVEC_RETOUR, titres = TITRES, autres = [] } = {}) =>
  contratDe([{ rel: PONT, text: pont(methode) }, { rel: GD, text: gd(titres) }, ...autres])

test('témoin : les fixtures rendent un contrat', () => {
  assert.match(rendre(), /^# Contrat du pont `wfrpPont`\n/)
})

test('un membre d’une déclaration `@contrat` sans JSDoc abandonne, nommé', () => {
  const text = '/**\n * @contrat Suite\n * La suite.\n */\nexport interface Suite {\n  /** la vue */\n  vue: string\n  programmes: number[]\n}\n'
  assert.throws(() => rendre({ autres: [{ rel: 'src/hote/suite.ts', text }] }), /src\/hote\/suite\.ts:8 : membre `programmes` sans JSDoc/)
})

test('une variante d’union d’une déclaration `@contrat` sans JSDoc abandonne, nommée', () => {
  const text = '/** @contrat Effets */\nexport type Effet =\n  /** un coup */\n  | { quoi: \'coup\'; de: string }\n  | { quoi: \'son\'; son: string }\n'
  assert.throws(() => rendre({ autres: [{ rel: 'src/noyau/effets.ts', text }] }), /src\/noyau\/effets\.ts:5 : variante `quoi: 'son'` sans JSDoc/)
})

test('une déclaration `@contrat` ni interface, ni littéral d’objet, ni union abandonne, nommée', () => {
  const text = '/** @contrat Composition d\'un personnage */\nexport type Axe = { champ: string } & (\n  | { forme: \'ref\' }\n  | { forme: \'plage\' }\n);\n'
  assert.throws(() => rendre({ autres: [{ rel: 'src/noyau/axe.ts', text }] }), /src\/noyau\/axe\.ts:2 : déclaration `Axe` ni interface/)
})

test('une méthode sans `@returns` abandonne, nommée', () => {
  assert.throws(() => rendre({ methode: '    /** aucune */' }), /hotes\/godot\/pont\/pont\.ts:4 : méthode `vue` sans `@returns`/)
})

test('un titre hors de la liste des sections abandonne, nommé', () => {
  assert.throws(() => rendre({ titres: [...TITRES, 'Plateau'] }), new RegExp(`contrat\\.gd:${TITRES.length * 5 + 1} : titre de section inconnu « Plateau »`))
})

test('une section sans bloc abandonne, nommée', () => {
  assert.throws(() => rendre({ titres: TITRES.filter((t) => t !== 'Lumière') }), /section « Lumière » : aucun bloc/)
})

test('une ligne de commentaire extraite de plus de 160 caractères abandonne, nommée', () => {
  const text = `/** @contrat Vue\n * ${'x'.repeat(161)}\n */\nexport const v = 1\n`
  assert.throws(() => rendre({ autres: [{ rel: 'src/noyau/vue.ts', text }] }), /src\/noyau\/vue\.ts:2 : ligne de commentaire de 161 caractères/)
})
