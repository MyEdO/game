// L'intégration d'un lot d'éléments 3D (#4338) : ordre, commandes, triangles et transfert, sur fixtures nommées.
import test from 'node:test'
import assert from 'node:assert/strict'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { gitDe } from '../test/gitDeBanc.mjs'
import { commandeDEnvoi, commandeDImport, construction, fabriquerTransfert, ordreDuLot, trianglesParEmpreinte } from './integrer.mjs'

const BURE = 'humanoide/vetement--bure'
const CORDELIERE = 'humanoide/accessoire--cordeliere'
const SCEAU = 'humanoide/accessoire--sceau-de-cire'
const CARAQUE = 'vehicule/caraque'
const LUS = {
  [BURE]: [],
  [CORDELIERE]: ['humanoide--vetement--bure'],
  [SCEAU]: ['humanoide--vetement--bure', 'humanoide--accessoire--cordeliere'],
  [CARAQUE]: [],
}

test('ordreDuLot construit chaque élément après ceux du lot qu’il contourne, l’ordre donné gardé sinon', () => {
  assert.deepEqual(ordreDuLot([SCEAU, CARAQUE, CORDELIERE, BURE], LUS), [BURE, CORDELIERE, SCEAU, CARAQUE])
  assert.deepEqual(ordreDuLot([CARAQUE, BURE, CORDELIERE], LUS), [CARAQUE, BURE, CORDELIERE])
  assert.deepEqual(ordreDuLot([SCEAU], LUS), [SCEAU], 'un id contourné hors du lot se lit au cache épinglé')
})

test('ordreDuLot refuse un cycle de contournement', () => {
  assert.throws(() => ordreDuLot([BURE, CORDELIERE], { [BURE]: ['humanoide--accessoire--cordeliere'], [CORDELIERE]: ['humanoide--vetement--bure'] }), /cycle de contournement/)
})

test('construction choisit le constructeur de la base et nomme le donnees.py de l’élément', () => {
  assert.deepEqual(construction(BURE, '/tmp/x'), {
    commande: ['scripts/personnage-3d/environnement.mjs', 'scripts/personnage-3d/element/construire.py', 'humanoide/vetement--bure', '--sortie', '/tmp/x'],
    donnees: 'scripts/personnage-3d/element/humanoide/vetement--bure/donnees.py',
  })
  assert.deepEqual(construction(CARAQUE, '/tmp/x'), {
    commande: ['scripts/personnage-3d/environnement.mjs', 'scripts/personnage-3d/vehicule/construire.py', 'caraque', '--sortie', '/tmp/x'],
    donnees: 'scripts/personnage-3d/vehicule/caraque/donnees.py',
  })
  for (const inconnu of ['decor/tonneau', 'humanoide', 'humanoide/a/b', 'toString/x']) assert.equal(construction(inconnu, '/tmp/x'), null, inconnu)
})

test('commandeDImport importe sans publier, et remplace un id déjà importé', () => {
  assert.deepEqual(commandeDImport('/tmp/x/id', 'id', false), ['hotes/godot/importer.mjs', '/tmp/x/id', 'id', '--sans-publier'])
  assert.deepEqual(commandeDImport('/tmp/x/id', 'id', true), ['hotes/godot/importer.mjs', '/tmp/x/id', 'id', '--sans-publier', '--remplacer'])
})

test('trianglesParEmpreinte lit les lignes GLB d’un élément sur base comme d’un véhicule', () => {
  const [a, b] = ['a'.repeat(64), 'b'.repeat(64)]
  const journal = `INFO export\nGLB humanoide--vetement--bure 81234 ${a} TRIANGLES 2311\nGLB caraque 912 ${b} TRIANGLES 14 -> vehicule--caraque\n  NOEUD coque (0, 0, 0) 12 []\n`
  assert.deepEqual([...trianglesParEmpreinte(journal)], [[a, 2311], [b, 14]])
})

test('commandeDEnvoi pousse le commit en branche transfert sans rien lancer', () => {
  assert.equal(commandeDEnvoi('c0ffee', 'soldat'), 'git push origin c0ffee:refs/heads/transfert/soldat')
})

const MODELES = 'hotes/godot/projet/modeles'
const BURE_IMPORTEE = `${MODELES}/humanoide--vetement--bure`
const ANCIEN = 'c'.repeat(64)
const SHA = 'd'.repeat(64)
/** Un dépôt forgé dont HEAD épingle `ANCIEN` pour `humanoide--vetement--bure`, et dont l'arbre de travail porte son import
 *  neuf hors de HEAD : manifeste et provenance qui épinglent `SHA`, et le GLB, ignoré. */
function depotAvecGlbImporte(t) {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.glb\n', [`${BURE_IMPORTEE}.manifeste.json`]: '{"version":1}', [`${BURE_IMPORTEE}.provenance.json`]: JSON.stringify({ model_sha256: ANCIEN }) } })
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  writeFileSync(join(racine, `${BURE_IMPORTEE}.manifeste.json`), '{"version":2}')
  writeFileSync(join(racine, `${BURE_IMPORTEE}.provenance.json`), JSON.stringify({ model_sha256: SHA }))
  writeFileSync(join(racine, `${BURE_IMPORTEE}.glb`), 'glTF bure')
  return { racine, git: gitDe(racine, { net: true }) }
}
const GLB = [{ id: 'humanoide--vetement--bure', chemin: `${BURE_IMPORTEE}.glb`, sha256: SHA }]
const acceptee = () => ({ status: 0, stdout: '', stderr: '' })

test('fabriquerTransfert rend en un passage le commit fils de HEAD qui porte manifeste, provenance neuve et GLB, sans toucher l’index ni l’arbre', (t) => {
  const { racine, git } = depotAvecGlbImporte(t)
  const head = git('rev-parse', 'HEAD')
  const statut = git('status', '--porcelain')
  const indexJuges = []
  const sha = fabriquerTransfert({ racine, glb: GLB, nom: 'soldat', env: envDeDepotForge(), porte: (fichier, { env }) => (indexJuges.push(env.GIT_INDEX_FILE), acceptee()) })
  assert.equal(git('rev-parse', `${sha}^`), head)
  assert.equal(git('show', `${sha}:${BURE_IMPORTEE}.glb`), 'glTF bure')
  assert.equal(git('show', `${sha}:${BURE_IMPORTEE}.manifeste.json`), '{"version":2}')
  assert.equal(JSON.parse(git('show', `${sha}:${BURE_IMPORTEE}.provenance.json`)).model_sha256, SHA)
  assert.deepEqual(git('diff', '--name-only', head, sha).split('\n'), [`${BURE_IMPORTEE}.glb`, `${BURE_IMPORTEE}.manifeste.json`, `${BURE_IMPORTEE}.provenance.json`])
  assert.equal(git('rev-parse', 'HEAD'), head, 'HEAD ne bouge pas')
  assert.equal(git('diff', '--cached', '--name-only'), '', 'l’index ne change pas')
  assert.equal(git('status', '--porcelain'), statut, 'l’arbre de travail ne change pas')
  assert.match(git('log', '-1', '--format=%B', sha), /^transfert\/soldat : 1 GLB à verser/)
  assert.equal(indexJuges.length, 1)
  assert.ok(indexJuges[0], 'la porte juge l’index temporaire')
})

test('fabriquerTransfert refuse un GLB que la provenance importée n’épingle pas, et un message que la porte refuse', (t) => {
  const { racine } = depotAvecGlbImporte(t)
  assert.throws(() => fabriquerTransfert({ racine, glb: [{ ...GLB[0], sha256: 'e'.repeat(64) }], nom: 'soldat', env: envDeDepotForge(), porte: acceptee }),
    /épingle d{64}, le GLB importé est e{64}/)
  assert.throws(() => fabriquerTransfert({ racine, glb: GLB, nom: 'soldat', env: envDeDepotForge(), porte: () => ({ status: 1, stdout: '', stderr: 'sujet refusé' }) }),
    /porte du commit : sujet refusé/)
})
