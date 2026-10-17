// SONDE (lecture seule) — contournabilité d'un plafond « ≤ 1 reste routant » confronté au validateur RÉEL de la porte du commit (`scripts/git-hooks/porte-du-commit.mjs`).
// LECTURE DE LA SORTIE : trois des cinq acceptations sont LÉGITIMES et le resteront — un solde qui
// fond ses restes en UNE ligne routante, un qui les range tous en « RAS : … », un qui n'en déclare
// aucun n'émettent respectivement qu'UN, ZÉRO et ZÉRO ticket : le plafond porte sur les tickets
// ÉMIS, pas sur le nombre de lignes. Seuls les deux premiers cas sont des contournements.
// Usage : node scripts/ops/sondes/audit-2026-09-01/sonde-solde.mjs

import { validateSolde } from '../../../git-hooks/porte-du-commit.mjs'

// SONDE (lecture seule) : un plafond « ≤ 1 reste ROUTANT » (P2-c) est-il tenable, ou se contourne-t-il
// sans mentir, avec le validateur RÉEL de la porte du commit ? (compte routant ajouté par la sonde)
const today = '2026-09-01'
const socle = (restes) => `# Solde #9999 — 2026-09-01
VERIFIE: diff relu ligne à ligne, suite verte, DoD du ticket recoupé au code réel et au RAW cité.
## Restes
${restes}

## Réfutation
verdict: CONFIRMÉ
J'ai attaqué le DoD et le diff, la couverture tient, aucun reste caché mesuré au grep du périmètre.
`
const cas = [
  ['5 restes routants (le cas que P2-c veut bloquer)', ['- a -> #1', '- b -> #2', '- c -> #3', '- d -> #4', '- e -> #5'].join('\n')],
  ['MÊMES 5 restes fondus en UNE ligne routante',      '- a, b, c, d et e (inventaire) -> #1'],
  ['MÊMES 5 restes en "RAS : <texte libre>"',          ['- a -> RAS : je verrai plus tard', '- b -> RAS : hors périmètre', '- c -> RAS : idem', '- d -> RAS : idem', '- e -> RAS : idem'].join('\n')],
  ['5 restes "corrigé dans ce commit" (non vérifié)',  ['- a -> corrigé dans ce commit','- b -> corrigé dans ce commit','- c -> corrigé dans ce commit','- d -> corrigé dans ce commit','- e -> corrigé dans ce commit'].join('\n')],
  ['aucun reste déclaré',                              'RAS'],
]
for (const [nom, r] of cas) {
  const v = validateSolde(socle(r), today)
  const rout = r.split('\n').filter(l => /->\s*#\d+/.test(l)).length
  console.log(`${v.ok ? 'ACCEPTE' : 'REFUSE '} | restes routants = ${rout} | ${nom}` + (v.ok ? '' : ' :: ' + v.problems.join(' ; ')))
}
