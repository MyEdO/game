// La déclaration du corps d'une base validée contre la donnée (#3106) : `lireDeclaration`.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { lireDeclaration } from './declaration.mjs'

const HUMANOIDE = fileURLToPath(new URL('./humanoide.json', import.meta.url))
const dossier = mkdtempSync(join(tmpdir(), 'declaration-'))
after(() => rmSync(dossier, { recursive: true, force: true }))

/** `humanoide.json` au porteur surchargé par `porteur`, écrit sous `dossier`. */
function declarationAvec(nom, porteur) {
  const declaration = JSON.parse(readFileSync(HUMANOIDE, 'utf8'))
  const chemin = join(dossier, `${nom}.json`)
  writeFileSync(chemin, JSON.stringify({ ...declaration, porteur: { ...declaration.porteur, ...porteur } }))
  return chemin
}

describe('lireDeclaration', () => {
  it('accepte la déclaration de la base humanoïde', async () => {
    assert.equal((await lireDeclaration(HUMANOIDE)).porteur.race, 'humain')
  })

  it('refuse une Taille que la donnée ne donne pas à la race, en nommant champ, déclaré et donnée', async () => {
    await assert.rejects(lireDeclaration(declarationAvec('taille', { taille: 'grande' })), /porteur\.taille grande, la donnée donne moyenne à la race humain/)
  })

  it('refuse une échelle d’art que la donnée ne donne pas à la race, en nommant champ, déclaré et donnée', async () => {
    await assert.rejects(lireDeclaration(declarationAvec('echelle', { echelleDArt: 1.2 })), /porteur\.echelleDArt 1\.2, la donnée donne 1 à la race humain/)
  })
})
