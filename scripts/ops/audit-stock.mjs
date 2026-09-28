// PORTE D'AUDIT des deux arbres npm du dépôt (racine et `server/`), jouée par le canari hebdo
// (`.github/workflows/canari.yml`) et à la main par `npm run ops:audit`.
//
// POURQUOI elle remplace `npm audit --audit-level=high` : ce dernier rend 1 sur un stock CONNU et
// figé (7 paquets, tous derrière une montée MAJEURE) — mesuré, il a fait mourir 4 des 5 derniers
// canaris au même endroit, et coupé les 17 à 22 steps suivants. Un rouge permanent ne mesure plus
// rien. Ici le verdict porte sur l'ÉCART au stock daté `audit-stock.json` :
//   - advisory NEUVE sur un paquet du stock  -> ROUGE (jamais une amnistie de paquet) ;
//   - paquet neuf >= high hors stock         -> ROUGE ;
//   - entrée du stock dont le paquet ou l'advisory a DISPARU -> ROUGE « entrée périmée : retire-la » ;
//   - paquet connu, advisories identiques    -> JAUNE au résumé (paquet, sévérité, fix, date d'entrée).
//
// Le comparateur est PUR (`comparerAudit`) : la lecture des deux `npm audit --json` vit dans `main`.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ecartsDeStock } from '../guards/lib/stock.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CHEMIN_STOCK = join(RACINE, 'scripts', 'ops', 'audit-stock.json')

/** Sévérités qui font verdict — les mêmes que `npm audit --audit-level=high`. */
export const SEVERITES_JUGEES = ['high', 'critical']

/** Identifiant GHSA d'une entrée `via` d'objet : `npm audit --json` ne porte que l'URL de l'advisory
 *  (`https://github.com/advisories/GHSA-…`), et c'est le SEUL identifiant stable entre deux courses
 *  (`source` est un numéro interne au registre). */
export const ghsaDe = (via) => String(via?.url ?? '').split('/').pop() || null

/**
 * Paquets >= high d'un rapport `npm audit --json`, chacun avec ses advisories GHSA directes et les
 * paquets par lesquels la vulnérabilité lui arrive. PUR.
 * @param {object} rapport rapport `npm audit --json` (auditReportVersion 2)
 * @param {'racine'|'server'} cible
 * @returns {{ cle: string, paquet: string, cible: string, severite: string, via: string[], viaPaquets: string[], plage: string }[]}
 */
export function paquetsJuges(rapport, cible) {
  const vulns = rapport?.vulnerabilities ?? {}
  return Object.entries(vulns)
    .filter(([, v]) => SEVERITES_JUGEES.includes(v?.severity))
    .map(([paquet, v]) => ({
      cle: `${cible}:${paquet}`,
      paquet,
      cible,
      severite: v.severity,
      via: [...new Set((v.via ?? []).filter((x) => typeof x === 'object').map(ghsaDe).filter(Boolean))].sort(),
      viaPaquets: (v.via ?? []).filter((x) => typeof x === 'string').sort(),
      plage: String(v.range ?? ''),
    }))
    .sort((a, b) => a.cle.localeCompare(b.cle))
}

/**
 * Verdict de l'écart entre le stock daté et ce que les deux audits observent. PUR.
 * @param {{ entrees: object[] }} stock contenu de `audit-stock.json`
 * @param {{ paquet: string, cible: string, severite: string, via: string[], viaPaquets: string[], plage: string, cle: string }[]} observe
 * @returns {{ rouges: string[], jaunes: string[], taille: number }}
 */
export function comparerAudit(stock, observe) {
  const entrees = (stock?.entrees ?? []).map((e) => ({ ...e, cle: `${e.cible}:${e.paquet}` }))
  const parPaquet = ecartsDeStock({
    observe,
    stock: entrees,
    cle: (e) => e.cle,
    remede: {
      neuve: (cle, e) =>
        `PAQUET NEUF >= high hors stock : ${cle} (${e.severite}, ${e.plage}) — le traiter, ou l'inscrire ` +
        'au stock daté avec son motif et son échéance (scripts/ops/audit-stock.json)',
      perimee: (cle) =>
        `entrée périmée : retire-la — ${cle} n'a plus de vulnérabilité >= high (scripts/ops/audit-stock.json)`,
    },
  })
  const rouges = [...parPaquet.neuves, ...parPaquet.perimees]

  const communs = observe.filter((o) => entrees.some((e) => e.cle === o.cle))
  /** Paquets dont une advisory a bougé : ils sortent des jaunes, leur écart étant déjà rouge. */
  const paquetsEnEcart = new Set()
  const parAdvisory = ecartsDeStock({
    observe: communs.flatMap((o) => o.via.map((g) => ({ cle: `${o.cle}:${g}`, paquet: o.cle, ghsa: g }))),
    stock: entrees
      .filter((e) => communs.some((o) => o.cle === e.cle))
      .flatMap((e) => (e.via ?? []).map((g) => ({ cle: `${e.cle}:${g}` }))),
    cle: (e) => e.cle,
    remede: {
      neuve: (cle) => {
        paquetsEnEcart.add(cle.slice(0, cle.lastIndexOf(':')))
        return `ADVISORY NEUVE sur un paquet du stock : ${cle} — un paquet au stock n'amnistie pas ses advisories futures`
      },
      perimee: (cle) => {
        paquetsEnEcart.add(cle.slice(0, cle.lastIndexOf(':')))
        return `entrée périmée : retire-la — l'advisory ${cle} a disparu du rapport`
      },
    },
  })
  rouges.push(...parAdvisory.neuves, ...parAdvisory.perimees)

  const jaunes = communs
    .filter((o) => !paquetsEnEcart.has(o.cle))
    .map((o) => {
      const e = entrees.find((x) => x.cle === o.cle)
      return `${o.cle} — ${o.severite}, fix : ${e.fix} (au stock depuis le ${e.date} ; ${e.echeance})`
    })

  return { rouges: rouges.sort(), jaunes: jaunes.sort(), taille: parPaquet.taille }
}

const isWin = process.platform === 'win32'

/** Tentatives de lecture d'un audit. MESURÉ le 2026-09-04 sur cette machine : l'endpoint
 *  `security/advisories/bulk` du registre a rendu 4 fois un `network timeout` ou un `503` sur 6
 *  appels, et le rapport valide au 2e essai les deux fois. Sans reprise, le canari hebdo rendrait
 *  un rouge de RÉSEAU indiscernable d'un rouge de sécurité. */
const ESSAIS_AUDIT = 3

/** `npm audit --json` d'une cible. `npm` sort en code 1 dès qu'il trouve une vulnérabilité : le JSON
 *  reste sur stdout (même contrat que `scripts/ops/deps-report.mjs`). Fail-LOUD si le registre ne
 *  rend jamais de rapport — le silence se lirait « 0 vulnérabilité » et périmerait tout le stock. */
export function lireAudit(cible, essais = ESSAIS_AUDIT) {
  const args = cible === 'server' ? ['--prefix', 'server', 'audit', '--json'] : ['audit', '--json']
  const echecs = []
  for (let n = 1; n <= essais; n += 1) {
    let brut
    try {
      brut = execFileSync('npm', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: isWin })
    } catch (err) {
      if (typeof err.stdout === 'string' && err.stdout.trim()) brut = err.stdout
      else { echecs.push(String(err.message).slice(0, 200)); continue }
    }
    let rapport
    try {
      rapport = JSON.parse(brut)
    } catch {
      echecs.push(`sortie non JSON : ${brut.slice(0, 200)}`)
      continue
    }
    if (rapport.vulnerabilities) return rapport
    echecs.push(String(rapport.message ?? brut.slice(0, 200)))
  }
  throw new Error(
    `npm audit (${cible}) n'a pas rendu de rapport en ${essais} essais : ${echecs.join(' | ')} — ` +
    "l'endpoint d'advisories du registre npm expire ou répond 503 par intermittence.",
  )
}

function main() {
  const stock = JSON.parse(readFileSync(CHEMIN_STOCK, 'utf8'))
  const observe = [
    ...paquetsJuges(lireAudit('racine'), 'racine'),
    ...paquetsJuges(lireAudit('server'), 'server'),
  ]
  const { rouges, jaunes, taille } = comparerAudit(stock, observe)
  process.stdout.write(`[audit-stock] stock ${taille} entrée(s), observé ${observe.length} paquet(s) >= high\n`)
  for (const j of jaunes) process.stdout.write(`  JAUNE ${j}\n`)
  for (const r of rouges) process.stderr.write(`  ROUGE ${r}\n`)
  if (rouges.length) {
    process.stderr.write(`[audit-stock] ${rouges.length} écart(s) au stock daté — voir scripts/ops/audit-stock.json\n`)
    process.exit(1)
  }
  process.stdout.write('[audit-stock] aucun écart au stock daté\n')
}

if (import.meta.main) main()
