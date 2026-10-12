import { test } from 'node:test'

import assert from 'node:assert/strict'

import { boitesDuPdf, classer, regenerations } from '../../raw/sonde-titres.mjs'

import { reparerLivre } from '../../raw/reparer-titres.mjs'

import { decoupeDe, gabaritTitreDe, livreExtraitDe, nomsDeLaListe, pdfDe, readText } from '../../raw/_lib.mjs'

import { ecartDeRegeneration, texteEnPlace } from '../../guards/lib/stockDeSites.mjs'

import { lignes } from '../../raw/lib/colonnes.mjs'

import { gitDeLArbreReel, resultatDeLArbreReel } from '../../test/gitDeBanc.mjs'

const PDF_CRB = (() => { try { return pdfDe('core-rulebook-5e') } catch { return null } })()

let boitesCrb = null

const boitesDuCrb = () => (boitesCrb ??= boitesDuPdf('core-rulebook-5e'))

test('#1820 stock COMMITTÉ de la sonde (CRB) : chaque site émis hors `colonne` y a son entrée, aucune entrée n’est soldée', (t) => {
  for (const r of regenerations()) {
    if (r.manque.length > 0) {
      t.skip(r.manque.join(' ; '))
      return
    }
    assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
  }
})

const AVANT_AF2A = 'af2a08ab1^'

const historique = resultatDeLArbreReel(['cat-file', '-e', AVANT_AF2A]).status === 0

test('#1739 la RÉPARATION ne contredit pas la SONDE : rejouée depuis les `.md` d’af2a08ab1^ (CRB 105, 106, 108), les S′ prouvés par COMPTAGE à côté de l’en-tête de profil (Dog, Griffon, Varghulf) et le F de Skeleton sont APPLIQUÉS, sans aucun refus', { skip: !PDF_CRB ? 'PDF du CRB absent de cet arbre' : !historique ? `${AVANT_AF2A} absent de l’historique` : false }, () => {
  const id = 'core-rulebook-5e'
  const dir = String(livreExtraitDe(id).dir).split('\\').join('/').replace(/\/$/, '')
  const liste = decoupeDe(id)
  const texte = (nom) => (/^10[568] /.test(nom)
    ? gitDeLArbreReel(undefined)('show', `${AVANT_AF2A}:${dir}/${nom}`)
    : readText(`${dir}/${nom}`))
  const textes = new Map(nomsDeLaListe(liste).map((nom) => [nom.slice(0, 3), texte(nom)]))
  const fichiers = nomsDeLaListe(liste).map((nom, i) => ({ nom, page: liste[i].page, pageFin: liste[i].pageFin, lignes: textes.get(nom.slice(0, 3)).split('\n') }))
  const pages = boitesDuCrb().map((p) => ({ page: p.page, lignes: lignes(p.boites), cercles: p.cercles ?? [] }))
  const { sites } = classer(pages, fichiers, gabaritTitreDe(id))
  const r = reparerLivre(textes, sites)
  assert.deepEqual(r.refus, [])
  assert.deepEqual(r.appliques.filter((a) => /« (dog|griffon|varghUlf|skeleTon) »/.test(a)), [
    "S' --- → 105:43 « dog » = « # **Dog** »",
    "S' --- → 106:251 « griffon » = « # **Griffon** »",
    'F 108:93 → 108:43 « skeleTon » = « # **Skeleton** »',
    "S' --- → 108:363 « varghUlf » = « # **Varghulf** »",
  ])
})
