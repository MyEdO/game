// LE MANIFESTE COMPLET D'UNE BASE (#2972, `ManifesteDeBase` de `hotes/godot/asset/manifesteDeBase.ts`), écrit sous
// `manifeste` dans le dossier de production de son GLB exporté (`production.ts`, #3106). Chaque champ a une source :
// - construit par la construction Blender (`humanoide.py`), lu en JSON sur l'entrée standard : `os`, `chaines`,
//   `zones`, `emplacements`, `prises`, `silhouettes`, `gabarit` (dont `st`, `silhouettes.bornes_de_st`), `appuis.pieds`,
//   `osAPositionAnimee` ;
// - déclaré par le corps (`<declaration.json>`) : `base`, `porteur`, et les clips de marche ;
// - mesuré par l'évaluateur (`appuis.ts`) : `appuis.vitessesAuSol`, une par clip de marche ;
// - pris au GLB : `glb.sha256` et `glb.octets`.
// `--licence-<pack>` nomme le texte de licence de chaque pack, lu dans le pack. `--verifier` juge la déclaration, le
// dossier de sortie et les textes de licence sans rien lire ni écrire d'autre : la construction le joue avant Blender.
//   node scripts/personnage-3d/base/manifeste.mjs <declaration.json> <base.glb> --<pack> <source> --licence-<pack> <f>… [--verifier] < <construit.json>
// où <pack> parcourt `SOURCES` (`production.ts`).
import { readFileSync } from 'node:fs'
import { text } from 'node:stream/consumers'
import { parseArgs } from 'node:util'
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'
import { sha256 } from '../../../hotes/godot/asset/empreinte.ts'
import { validerManifesteDeBase, VERSION_DU_SCHEMA_DE_BASE } from '../../../hotes/godot/asset/manifesteDeBase.ts'
import { tableTotale } from '../../../src/lib/tableTotale.ts'
import { lireDeclaration } from './declaration.mjs'
import { ecrireProduction, SOURCES, verifierProduction } from './production.ts'

/** Vitesse posée sur chaque clip de marche le temps de la mesure : `mesurerAppuis` (`appuis.ts`) ne la lit que pour
 *  juger l'écart et le glissement, jamais pour mesurer la vitesse au sol. */
const VITESSE_DE_SONDE = 1

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
  const packs = SOURCES
  const options = { ...Object.fromEntries(packs.flatMap((p) => [[p, { type: 'string' }], [`licence-${p}`, { type: 'string' }]])), verifier: { type: 'boolean' } }
  const { positionals: [cheminDeclaration, cheminGlb, ...reste], values } = parseArgs({ allowPositionals: true, options })
  if (!cheminDeclaration || !cheminGlb?.endsWith('.glb') || reste.length || packs.some((p) => !values[p] || !values[`licence-${p}`])) {
    console.error(`usage : node scripts/personnage-3d/base/manifeste.mjs <declaration.json> <base.glb> ${packs.map((p) => `--${p} <source> --licence-${p} <f>`).join(' ')} [--verifier] < <construit.json>`)
    process.exit(2)
  }
  const sources = tableTotale(packs, (p) => values[p])
  const licences = tableTotale(packs, (p) => values[`licence-${p}`])
  const { base, porteur, clipsDeMarche } = await lireDeclaration(cheminDeclaration)
  const { dossier } = verifierProduction({ glb: cheminGlb, sources, licences })
  if (values.verifier) {
    console.log(`PRODUCTION ${dossier} : déclaration, sortie et textes de licence des packs acceptés`)
    return
  }
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
  const ecrits = ecrireProduction({ glb: cheminGlb, manifeste: complet, sources, licences })
  console.log(`PRODUCTION ${dossier} ${octets.byteLength} octets ${complet.glb.sha256} : ${ecrits.join(', ')}`)
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : String(erreur))
  process.exit(1)
})
