#!/usr/bin/env node
// LE REJEU DES TEXTURES ÉPINGLÉES (#4527) : la commande de `rejouerLesTextures` (`asset/texture.ts`). Elle refabrique
// chaque texture nommée (toutes, sans nom) depuis sa source CC0 par le traitement de sa provenance
// (`projet/textures/provenance.json`), dans un dossier temporaire, et la compare à celle que la provenance épingle
// (`verdictDuRejeu`) : mêmes octets, ou mêmes pixels sous d'autres octets JPEG, elle est reproduite ; elle dit chaque
// texture différente, et sort alors en 1. Avec `--epingler`, elle dépose les textures nommées au projet et inscrit
// leurs sommes : c'est le geste qui suit un `traitement` ou une `source` modifiés.
//
//   node hotes/godot/textures.mjs [--epingler] [<fichier>.jpg ...]
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chargerAssets } from './asset/charger.mjs'

const { values: o, positionals: nommes } = parseArgs({ options: { epingler: { type: 'boolean' } }, allowPositionals: true })
if (o.epingler && !nommes.length) {
  console.error('--epingler attend les textures à déposer\nUsage : node hotes/godot/textures.mjs [--epingler] [<fichier>.jpg ...]')
  process.exit(2)
}
const { rejouerLesTextures, epinglerLesSommes, verdictDuRejeu, versionDImageMagick, DOSSIER_DES_TEXTURES } = await chargerAssets([
  "export { rejouerLesTextures, epinglerLesSommes, verdictDuRejeu, versionDImageMagick, DOSSIER_DES_TEXTURES } from '/hotes/godot/asset/texture.ts';",
])
const provenance = JSON.parse(readFileSync(join(DOSSIER_DES_TEXTURES, 'provenance.json'), 'utf8'))
const noms = nommes.length ? nommes : Object.keys(provenance)
const temporaire = o.epingler ? null : mkdtempSync(join(tmpdir(), 'wfrp-textures-'))
try {
  console.log(`[textures] ${versionDImageMagick()}`)
  const sommes = await rejouerLesTextures(noms, provenance, temporaire ?? DOSSIER_DES_TEXTURES)
  if (o.epingler) {
    epinglerLesSommes(sommes)
    for (const [nom, somme] of sommes) console.log(`[textures] ${nom} épinglée : ${somme}${somme === provenance[nom].sha256 ? ' (inchangée)' : `, ${provenance[nom].sha256} avant`}`)
    console.log('[textures] ensuite : leur versement par une branche transfert/<x> (`node hotes/godot/epingles.mjs`)')
  } else {
    const verdicts = [...sommes].map(([nom, somme]) => ({ nom, somme, verdict: verdictDuRejeu(somme, provenance[nom].sha256, join(temporaire, nom), join(DOSSIER_DES_TEXTURES, nom)) }))
    const compte = (verdict) => verdicts.filter((v) => v.verdict === verdict).length
    for (const { nom } of verdicts.filter((v) => v.verdict === 'pixels')) console.log(`[textures] ${nom} : reproduite, octets JPEG différents`)
    for (const { nom, somme } of verdicts.filter((v) => v.verdict === 'differente')) console.log(`[textures] ${nom} : DIFFÉRENTE, rejouée ${somme}, épinglée ${provenance[nom].sha256}`)
    console.log(`[textures] ${sommes.size} texture(s) rejouée(s) : ${compte('octets')} identique(s) à l'octet, ${compte('pixels')} identique(s) aux pixels, ${compte('differente')} différente(s)`)
    if (compte('differente')) process.exitCode = 1
  }
} catch (e) {
  console.error(`[textures] ${e.message}`)
  process.exitCode = 1
} finally {
  if (temporaire) rmSync(temporaire, { recursive: true })
}
