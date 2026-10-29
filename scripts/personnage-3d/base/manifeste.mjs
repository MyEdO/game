// LE MANIFESTE COMPLET D'UNE BASE (#2972, `ManifesteDeBase` de `hotes/godot/asset/manifesteDeBase.ts`), écrit à côté
// de son GLB exporté, `<base>.manifeste.json`. Chaque champ a une source :
// - construit par la construction Blender (`humanoide.py`), lu en JSON sur l'entrée standard : `os`, `chaines`,
//   `zones`, `emplacements`, `prises`, `silhouettes`, `gabarit` (dont `st`, `silhouettes.bornes_de_st`), `appuis.pieds`,
//   `osAPositionAnimee` ;
// - déclaré par le corps (`<declaration.json>`) : `base`, `porteur`, et les clips de marche ;
// - mesuré par l'évaluateur (`appuis.ts`) : `appuis.vitessesAuSol`, une par clip de marche ;
// - pris au GLB : `glb.sha256` et `glb.octets`.
//   node scripts/personnage-3d/base/manifeste.mjs <declaration.json> <base.glb> < <construit.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { text } from 'node:stream/consumers'
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'
import { sha256 } from '../../../hotes/godot/asset/empreinte.ts'
import { validerManifesteDeBase, VERSION_DU_SCHEMA_DE_BASE } from '../../../hotes/godot/asset/manifesteDeBase.ts'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

const lireDonnee = (nom) => JSON.parse(readFileSync(new URL(`../../../src/data/${nom}`, import.meta.url), 'utf8'))

/** Vitesse posée sur chaque clip de marche le temps de la mesure : `mesurerAppuis` (`appuis.ts`) ne la lit que pour
 *  juger l'écart et le glissement, jamais pour mesurer la vitesse au sol. */
const VITESSE_DE_SONDE = 1

/** La déclaration du corps, refusée si une race ou un gabarit du porteur n'existe pas dans la donnée. */
function lireDeclaration(chemin) {
  const declaration = JSON.parse(readFileSync(chemin, 'utf8'))
  const { porteur, clipsDeMarche } = declaration
  if (!Array.isArray(clipsDeMarche) || !clipsDeMarche.length) throw new Error(`${chemin} : clipsDeMarche, liste non vide attendue`)
  if (!lireDonnee('raceAppearance.json').some((r) => r.id === porteur?.race)) throw new Error(`${chemin} : porteur.race ${porteur?.race} absente de raceAppearance.json`)
  if (!lireDonnee('gabarits.json').some((g) => g.id === porteur?.gabarit)) throw new Error(`${chemin} : porteur.gabarit ${porteur?.gabarit} absent de gabarits.json`)
  return declaration
}

/** Les vitesses au sol des `clips`, mesurées par l'évaluateur sur `octets` avec le manifeste `manifeste`. */
async function mesurerVitesses(octets, manifeste, clips) {
  const { evaluer } = await chargerEvaluateur()
  const fiche = await evaluer({ base: octets, manifeste, clips })
  const refus = fiche.ecarts.filter((e) => e.garde === 'manifeste')
  if (refus.length) throw new Error(`manifeste refusé par l'évaluateur :\n${refus.map((e) => `  [${e.code}] ${e.valeur} : ${e.detail}`).join('\n')}`)
  return tableTotale(clips, (clip) => {
    const vitesse = fiche.mesures.clips.find((c) => c.nom === clip)?.appuis?.vitesseAuSol
    if (!(typeof vitesse === 'number' && vitesse > 0)) throw new Error(`${clip} : vitesse au sol ${vitesse ?? 'indétectable'}, positive attendue`)
    console.log(`VITESSE ${clip} ${vitesse} m/s`)
    return vitesse
  })
}

async function main() {
  const [cheminDeclaration, cheminGlb, ...reste] = process.argv.slice(2)
  if (!cheminDeclaration || !cheminGlb?.endsWith('.glb') || reste.length) {
    console.error('usage : node scripts/personnage-3d/base/manifeste.mjs <declaration.json> <base.glb> < <construit.json>')
    process.exit(2)
  }
  const { base, porteur, clipsDeMarche } = lireDeclaration(cheminDeclaration)
  const construit = JSON.parse(await text(process.stdin))
  const octets = readFileSync(cheminGlb)
  const manifeste = (vitessesAuSol) => ({
    schema: VERSION_DU_SCHEMA_DE_BASE, base, ...construit,
    porteur,
    appuis: { ...construit.appuis, vitessesAuSol },
    glb: { sha256: sha256(octets), octets: octets.byteLength },
  })
  const complet = manifeste(await mesurerVitesses(octets, manifeste(tableTotale(clipsDeMarche, () => VITESSE_DE_SONDE)), clipsDeMarche))
  const verdict = validerManifesteDeBase(complet, octets)
  if (!verdict.ok) throw new Error(`manifeste refusé :\n${verdict.ecarts.map((e) => `  [${e.code}] ${e.ou} : ${e.detail}`).join('\n')}`)
  const sortie = cheminGlb.replace(/\.glb$/, '.manifeste.json')
  writeFileSync(sortie, `${JSON.stringify(complet, null, 2)}\n`)
  console.log(`MANIFESTE ${sortie} ${octets.byteLength} octets ${complet.glb.sha256}`)
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : String(erreur))
  process.exit(1)
})
