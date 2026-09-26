// RÉPARATION du MOBILIER DE PAGE d'un livre extrait (#1739) : retire des `.md` en service les sites
// que la SONDE relève (`sonde-mobilier.mjs#sitesDuLivre`), exemptions AU SITE écartées. Elle ne
// relève rien elle-même.
//
// Règle utilisateur, verbatim (2026-09-20) : « Il est interdit de réécrire le texte. On peut réparer
// le texte s'il est tronqué/mélangé car l'extraction n'est pas parfaite. »
//  — ligne réduite au mobilier (`romain-seul`, `folio-nu`, `#` compris) : SUPPRIMÉE ; si ses deux voisines sont
//    vides, l'une part avec elle (aucun `.md` du livre ne porte deux lignes vides consécutives) ;
//  — jeton dans une ligne (`mot`, `folio-tete`) : retiré par `lib/mobilier.mjs#sansJeton` ;
//  — jeton entre deux runs gras d'une ligne de TITRE (titre SOUDÉ) : la ligne se scinde en DEUX
//    titres, au niveau que portent les titres frères de même gabarit au fichier (`niveauDesFreres`) ;
//  — table que le retrait laisse SANS DONNÉE (une seule cellule non vide, dans l'en-tête : un bandeau
//    lu comme table) : le bloc devient UNE ligne de titre au texte verbatim de cette cellule, au niveau
//    des titres de LÉGENDE du fichier (`niveauDeLegende`).
// REFUS D'ÉCRIRE : le MULTI-ENSEMBLE DES MOTS de chaque fichier, avant contre après, doit perdre
// EXACTEMENT les jetons des sites et n'en gagner aucun ; une suppression qui COLLERAIT deux lignes
// non vides est refusée, nommée.
//
// Usage : node scripts/raw/reparer-mobilier.mjs <id du livre> [--apply]
// Sans `--apply`, rend ce qu'il ferait. Idempotent : rejoué sur un livre réparé, il n'écrit rien.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readText } from './_lib.mjs'
import { estLigneDeTable, sansJeton } from './lib/mobilier.mjs'
import { cellulesDe, estSeparateur } from '../../src/data/source/decoupe.ts'
import { sitesDuLivre } from './sonde-mobilier.mjs'

/** Les MOTS d'un texte (suites de lettres et de chiffres), en multi-ensemble. PURE. */
export function motsDe(texte) {
  const out = new Map()
  for (const m of texte.matchAll(/[\p{L}\p{N}]+/gu)) out.set(m[0], (out.get(m[0]) ?? 0) + 1)
  return out
}

/** Différence de deux multi-ensembles : `{ retires, ajoutes }`, chacun `Map<mot, n>`. PURE. */
export function ecartDeMots(avant, apres) {
  const retires = new Map()
  const ajoutes = new Map()
  for (const k of new Set([...avant.keys(), ...apres.keys()])) {
    const d = (avant.get(k) ?? 0) - (apres.get(k) ?? 0)
    if (d > 0) retires.set(k, d)
    if (d < 0) ajoutes.set(k, -d)
  }
  return { retires, ajoutes }
}

const TITRE = /^(#{1,6}) /
/** Classes dont le site EST la ligne entière : elle se supprime. */
const LIGNE_ENTIERE = new Set(['romain-seul', 'folio-nu'])

/** Titre SOUDÉ : ligne de titre où le jeton sépare deux runs gras — `# **A** XII **B**`. PURE. */
export function estTitreSoude(ligne, site) {
  if (!TITRE.test(ligne)) return false
  const gauche = ligne.slice(0, site.debut).trimEnd()
  const droite = ligne.slice(site.debut + site.jeton.length).trimStart()
  return gauche.endsWith('**') && /^\*\*[^*]+\*\*$/.test(droite)
}

/** Niveau des titres FRÈRES d'une ligne : le niveau le plus porté par les lignes de titre du fichier
 *  dont le gabarit est le sien (un run gras seul), hors la ligne elle-même. PURE. */
export function niveauDesFreres(lignes, i) {
  const n = new Map()
  lignes.forEach((l, j) => {
    const m = /^(#{1,6}) \*\*[^*]+\*\*$/.exec(l)
    if (j !== i && m) n.set(m[1], (n.get(m[1]) ?? 0) + 1)
  })
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? TITRE.exec(lignes[i])[1]
}

/** Le niveau le plus porté par les titres de LÉGENDE du fichier — une ligne de titre que suit, après
 *  des lignes vides, une ligne de table —, hors la ligne `i` ; à égalité, le moins profond ; sans
 *  légende, `niveauDesFreres`. PURE. */
export function niveauDeLegende(lignes, i) {
  const n = new Map()
  lignes.forEach((l, j) => {
    const m = TITRE.exec(l)
    if (!m || j === i) return
    let k = j + 1
    while (k < lignes.length && lignes[k].trim() === '') k += 1
    if (k < lignes.length && estLigneDeTable(lignes[k])) n.set(m[1], (n.get(m[1]) ?? 0) + 1)
  })
  const [premier] = [...n].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
  return premier?.[0] ?? niveauDesFreres(lignes, i)
}

/** Le texte d'une table que le retrait de l'onglet laisse SANS DONNÉE : l'unique cellule non vide du
 *  bloc, portée par sa rangée d'en-tête, ou `null`. PURE. @param {string[]} bloc */
export function texteDeBandeau(bloc) {
  const pleines = bloc.flatMap((l, r) => (estSeparateur(l) ? [] : cellulesDe(l).filter(Boolean).map((c) => ({ r, c }))))
  return pleines.length === 1 && pleines[0].r === 0 ? pleines[0].c : null
}

/**
 * Le texte réparé d'UN fichier, et ce qui s'y oppose — PUR.
 * @param {string} texte @param {{ ligne: number, classe: string, jeton: string, debut?: number }[]} sites
 * @returns {{ texte: string, refus: string[], scindes: { ligne: number, titres: string[] }[], bandeaux: { ligne: number, titre: string }[] }}
 */
export function reparer(texte, sites) {
  const lignes = texte.split('\n')
  const refus = []
  const scindes = []
  const bandeaux = []
  const parLigne = new Map()
  for (const s of sites) parLigne.set(s.ligne, [...(parLigne.get(s.ligne) ?? []), s])
  const out = []
  for (let i = 0; i < lignes.length; i += 1) {
    if (estLigneDeTable(lignes[i]) && !estLigneDeTable(lignes[i - 1] ?? '')) {
      let k = i
      while (k < lignes.length && estLigneDeTable(lignes[k])) k += 1
      const touchees = lignes.slice(i, k).some((_, r) => parLigne.has(i + r + 1))
      if (touchees) {
        const bloc = lignes.slice(i, k).map((l, r) => [...(parLigne.get(i + r + 1) ?? [])].sort((a, b) => b.debut - a.debut).reduce((x, s) => sansJeton(x, s.debut, s.jeton), l))
        const bandeau = texteDeBandeau(bloc)
        if (bandeau) {
          const titre = `${niveauDeLegende(lignes, i)} **${bandeau}**`
          bandeaux.push({ ligne: i + 1, titre })
          out.push(titre)
        } else out.push(...bloc)
        i = k - 1
        continue
      }
    }
    const ici = parLigne.get(i + 1)
    if (!ici) { out.push(lignes[i]); continue }
    if (ici.some((s) => LIGNE_ENTIERE.has(s.classe))) {
      const avant = out.at(-1)
      const apres = lignes[i + 1]
      if (avant !== undefined && apres !== undefined && avant.trim() && apres.trim()) {
        refus.push(`l.${i + 1} : supprimer « ${lignes[i].trim()} » collerait deux lignes non vides`)
        out.push(lignes[i])
        continue
      }
      if (avant === '' && apres === '') i += 1
      continue
    }
    let l = lignes[i]
    const mots = [...ici].sort((a, b) => b.debut - a.debut)
    if (mots.length === 1 && estTitreSoude(l, mots[0])) {
      const niveau = niveauDesFreres(lignes, i)
      const corps = l.replace(TITRE, '')
      const debut = mots[0].debut - (l.length - corps.length)
      const titres = [corps.slice(0, debut).trimEnd(), corps.slice(debut + mots[0].jeton.length).trimStart()].map((t) => `${niveau} ${t}`)
      scindes.push({ ligne: i + 1, titres })
      out.push(titres[0], '', titres[1])
      continue
    }
    for (const s of mots) l = sansJeton(l, s.debut, s.jeton)
    out.push(l)
  }
  return { texte: out.join('\n'), refus, scindes, bandeaux }
}

/** Le verdict de fidélité d'un fichier : `null`, ou ce qui cloche. PURE. */
export function infidelite(avant, apres, sites) {
  const { retires, ajoutes } = ecartDeMots(motsDe(avant), motsDe(apres))
  const attendus = new Map()
  for (const s of sites) attendus.set(s.jeton, (attendus.get(s.jeton) ?? 0) + 1)
  const dit = (m) => [...m].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, n]) => `${k}×${n}`).join(' ') || '∅'
  if (ajoutes.size) return `mots AJOUTÉS : ${dit(ajoutes)}`
  if (dit(retires) !== dit(attendus)) return `mots retirés ${dit(retires)} ≠ jetons des sites ${dit(attendus)}`
  return null
}

function main() {
  const [id, ...args] = process.argv.slice(2)
  if (!id) { console.error('usage : node scripts/raw/reparer-mobilier.mjs <id du livre> [--apply]'); process.exitCode = 2; return }
  const apply = args.includes('--apply')
  const aReparer = sitesDuLivre(id).filter((s) => !s.exemption)
  const parFichier = new Map()
  for (const s of aReparer) parFichier.set(s.fichier, [...(parFichier.get(s.fichier) ?? []), s])
  const ecrits = []
  let bloque = false
  for (const [fichier, sites] of parFichier) {
    const avant = readText(fichier)
    const { texte, refus, scindes, bandeaux } = reparer(avant, sites)
    const faute = infidelite(avant, texte, sites.filter((s) => !refus.some((r) => r.startsWith(`l.${s.ligne} `))))
    for (const r of refus) console.log(`REFUS ${fichier} ${r}`)
    if (faute) console.log(`REFUS ${fichier} : ${faute}`)
    if (refus.length || faute) { bloque = true; continue }
    for (const s of scindes) console.log(`SCINDÉ ${fichier}:${s.ligne} → ${s.titres.join(' / ')}`)
    for (const b of bandeaux) console.log(`BANDEAU ${fichier}:${b.ligne} → ${b.titre}`)
    console.log(`${fichier} : ${sites.length} site(s), ${sites.length} jeton(s) retiré(s)`)
    ecrits.push([fichier, texte])
  }
  if (bloque) { console.log('rien n’est écrit : un refus au moins.'); process.exitCode = 1; return }
  if (!apply) { console.log(`${ecrits.length} fichier(s) à réparer, ${aReparer.length} site(s) — --apply pour écrire`); return }
  for (const [f, t] of ecrits) writeFileSync(f, t)
  console.log(`${ecrits.length} fichier(s) réparé(s), ${aReparer.length} site(s)`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
