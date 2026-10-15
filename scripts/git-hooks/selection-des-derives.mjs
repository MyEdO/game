// SÉLECTION des dérivés par lectures mesurées (#1773, #2193, #2603) : fonctions PURES, sans écrivain, que
// lisent le post-hook (`docs-rebuild.mjs`), le périmètre de tests (`scripts/test/perimetre.mjs`) et l'étape
// `docs` du train (`scripts/ops/etapesDuTrain.mjs`).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ciblesSurDisque, GENERATORS, generateursDeCode, perimetreDesMixtes, SOURCES_LUES } from '../docs/build-all.mjs'
import { fichiersDOutillage } from '../docs/lib/fraicheur-docs.mjs'
import { correspondGlob } from '../guards/lib/lister.mjs'

/** Les sources MESURÉES de l'arbre (`docs/.sources-lues.json`), ou `null` si le dérivé est illisible. */
export function sourcesMesurees(racine) {
  try { return JSON.parse(readFileSync(join(racine, SOURCES_LUES), 'utf8')) } catch { return null }
}

/** Les manifestes de dépendances : leurs lectures ne sont pas mesurées, un changement invalide toute
 *  sélection par lectures (docs dérivés, périmètre de tests). */
export const LECTURES_DES_DEPENDANCES = Object.freeze(['package.json', 'package-lock.json', 'server/package.json', 'server/package-lock.json'])

/** Les modules qui décident de la reconstruction d'un lot : modifiés, toute sélection par lectures tombe. */
const GRAPHE_DE_SELECTION = Object.freeze(['scripts/git-hooks/docs-rebuild.mjs', 'scripts/git-hooks/selection-des-derives.mjs'])

const parentDe = (chemin) => (chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : '')

/** Les dossiers qui contiennent `chemin`, du parent à la racine (`''`) comprise. */
export function ancetresDe(chemin) {
  const ancetres = [parentDe(chemin)]
  while (ancetres.at(-1) !== '') ancetres.push(parentDe(ancetres.at(-1)))
  return ancetres
}

/**
 * Vrai si le lot peut avoir périmé un doc dérivé. La réponse se DÉRIVE de la mesure
 * (`docs/.sources-lues.json`, #1773). Quatre façons, pour un lot, de périmer un doc dérivé :
 *   1. le chemin EST une source lue, ou une cible ;
 *   2. un de ses ANCÊTRES est un dossier LISTÉ — un fichier posé dans un dossier NEUF change le
 *      listing du premier ancêtre qui existait (#2193) ;
 *   3. son dossier parent contient déjà une source lue — c'est le frère AJOUTÉ ou RETIRÉ d'une
 *      source, que la mesure d'un générateur qui énumère sans lister ne peut pas dire autrement ;
 *   4. sans restriction par générateur, il vit sous `docs/`.
 * Lot inconnu ou mesure illisible → régénération conservatrice.
 * `seulement` (des `script` de `GENERATORS`) restreint la mesure aux entrées de ces générateurs ; un
 * membre SANS entrée fait régénérer, comme une mesure illisible (#2193).
 */
export function touchesDocSources(chemins, mesure, { seulement = null } = {}) {
  if (chemins === null || mesure === null) return true
  if (seulement && seulement.some((script) => !Object.hasOwn(mesure, script))) return true
  const fichiers = new Set()
  const dossiers = new Set()
  const dossiersDeSources = new Set()
  for (const e of seulement ? seulement.map((script) => mesure[script]) : Object.values(mesure)) {
    for (const f of e.fichiers ?? []) {
      fichiers.add(f)
      dossiersDeSources.add(parentDe(f))
    }
    for (const c of e.cibles ?? []) fichiers.add(c)
    for (const d of e.dossiers ?? []) dossiers.add(d)
  }
  return chemins.some((brut) => {
    const chemin = brut.split('\\').join('/')
    const parent = parentDe(chemin)
    return fichiers.has(chemin) || (!seulement && chemin.startsWith('docs/')) || ancetresDe(chemin).some((a) => dossiers.has(a)) ||
      (parent !== '' && dossiersDeSources.has(parent))
  })
}

export function selectionDesGenerateurs({ lot, mesure, cwd, generateurs = GENERATORS }) {
  const tous = (raison) => ({ scripts: generateurs.map((g) => g.script), complete: true, raison })
  if (lot === null) return tous('plage Git inconnue')
  if (lot.some((f) => LECTURES_DES_DEPENDANCES.includes(f))) return tous('toolchain modifiée : lectures des dépendances non mesurées')
  if (!mesure || generateurs.some((g) => !Array.isArray(mesure[g.script]?.fichiers) || !Array.isArray(mesure[g.script]?.dossiers) || !Array.isArray(mesure[g.script]?.cibles))) return tous('mesure absente ou incomplète')
  const outillage = fichiersDOutillage()
  if (lot.some((f) => GRAPHE_DE_SELECTION.includes(f) || outillage.has(f))) return tous('graphe ou outil de mesure modifié')
  if (generateurs.some((g) => mesure[g.script].cibles.some((c) => !existsSync(join(cwd, c))) ||
    [...g.targets, ...(g.injecte ?? [])].some((c) => !c.includes('*') && !existsSync(join(cwd, c))))) return tous('cible absente')
  const selection = new Set(generateurs.filter((g) => touchesDocSources(lot, mesure, { seulement: [g.script] })).map((g) => g.script))
  const sorties = (g) => [...g.targets, ...(g.injecte ?? [])]
  let changement = true
  while (changement) {
    const avant = selection.size
    if (generateursDeCode(generateurs).some((g) => selection.has(g.script)))
      for (const g of perimetreDesMixtes(generateurs)) selection.add(g.script)
    for (const g of generateurs) {
      if (selection.has(g.script)) {
        for (const producteur of generateurs)
          if (producteur !== g && mesure[g.script].fichiers.some((f) => sorties(producteur).some((c) => correspondGlob(f, c)))) selection.add(producteur.script)
        if (perimetreDesMixtes(generateurs).includes(g) && (g.injecte ?? []).length)
          for (const code of generateursDeCode(generateurs)) selection.add(code.script)
      } else if (generateurs.some((producteur) => selection.has(producteur.script) &&
        (mesure[g.script].fichiers.some((f) => sorties(producteur).some((c) => correspondGlob(f, c))) ||
          touchesDocSources(ciblesSurDisque(sorties(producteur), cwd), mesure, { seulement: [g.script] })))) selection.add(g.script)
    }
    changement = selection.size !== avant
  }
  return { scripts: generateurs.filter((g) => selection.has(g.script)).map((g) => g.script), complete: false, raison: 'sources mesurées et préalables' }
}
