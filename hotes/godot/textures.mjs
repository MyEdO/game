#!/usr/bin/env node
// LE REJEU DES TEXTURES ÉPINGLÉES (#4527) : la commande de `rejouerLesTextures` (`asset/texture.ts`). Elle refabrique
// chaque texture nommée (toutes, sans nom) depuis sa source CC0 par le traitement de sa provenance
// (`projet/textures/provenance.json`), dans un dossier temporaire, et la compare à celle que la provenance épingle,
// tirée au projet si elle y manque (`recupererEpingles`, `verdictDuRejeu`) : mêmes octets, ou mêmes pixels sous d'autres
// octets JPEG, elle est reproduite ; elle dit chaque texture différente, et sort alors en 1. Avec `--epingler`, elle
// dépose au projet les seules textures nommées, toutes rejouées, et inscrit leurs sommes (`epinglerLesTextures`) :
// c'est le geste qui suit un `traitement` ou une `source` modifiés.
//
//   node hotes/godot/textures.mjs [--epingler] [<fichier>.jpg ...]
import { spawnSync } from 'node:child_process'
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
const { rejouerLesTextures, epinglerLesTextures, verdictDuRejeu, recupererEpingles, DOSSIER_DES_TEXTURES } = await chargerAssets([
  "export { rejouerLesTextures, epinglerLesTextures, verdictDuRejeu } from '/hotes/godot/asset/texture.ts';",
  "export { recupererEpingles, DOSSIER_DES_TEXTURES } from '/hotes/godot/asset/epingles.ts';",
])
const provenance = JSON.parse(readFileSync(join(DOSSIER_DES_TEXTURES, 'provenance.json'), 'utf8'))

/** Les textures `nommes` déposées au projet et leurs sommes inscrites. */
async function epingler() {
  for (const [nom, somme] of await epinglerLesTextures(nommes)) console.log(`[textures] ${nom} épinglée : ${somme}${somme === provenance[nom].sha256 ? ' (inchangée)' : `, ${provenance[nom].sha256} avant`}`)
  console.log('[textures] ensuite : leur versement par une branche transfert/<x> (`node hotes/godot/epingles.mjs`)')
}

/** Le nombre de textures rejouées qui diffèrent de leur épingle, chaque verdict dit. */
async function comparer() {
  await recupererEpingles({ dossiers: [DOSSIER_DES_TEXTURES] })
  const temporaire = mkdtempSync(join(tmpdir(), 'wfrp-textures-'))
  try {
    const sommes = await rejouerLesTextures(nommes.length ? nommes : Object.keys(provenance), provenance, temporaire)
    const verdicts = [...sommes].map(([nom, somme]) => ({ nom, somme, verdict: verdictDuRejeu(somme, provenance[nom].sha256, join(temporaire, nom), join(DOSSIER_DES_TEXTURES, nom)) }))
    const compte = (verdict) => verdicts.filter((v) => v.verdict === verdict).length
    for (const { nom } of verdicts.filter((v) => v.verdict === 'pixels')) console.log(`[textures] ${nom} : reproduite, octets JPEG différents`)
    for (const { nom, somme } of verdicts.filter((v) => v.verdict === 'differente')) console.log(`[textures] ${nom} : DIFFÉRENTE, rejouée ${somme}, épinglée ${provenance[nom].sha256}`)
    console.log(`[textures] ${sommes.size} texture(s) rejouée(s) : ${compte('octets')} identique(s) à l'octet, ${compte('pixels')} identique(s) aux pixels, ${compte('differente')} différente(s)`)
    return compte('differente')
  } finally {
    rmSync(temporaire, { recursive: true })
  }
}

try {
  console.log(`[textures] ${spawnSync('convert', ['-version'], { encoding: 'utf8' }).stdout?.split('\n')[0] ?? 'ImageMagick introuvable'}`)
  if (o.epingler) await epingler()
  else if (await comparer()) process.exitCode = 1
} catch (e) {
  console.error(`[textures] ${e.message}`)
  process.exitCode = 1
}
