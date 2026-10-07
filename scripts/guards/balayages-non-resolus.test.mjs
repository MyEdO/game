// CLIQUET des balayages NON RÉSOLUS (#2400) : toute valeur de site de lecture ou de listage que la dérivation du
// périmètre de tests ne rattache à aucune racine est une lecture qui échappe à la dérivation. Elle se rend
// résoluble, ou elle est au stock (`scripts/guards/balayages-non-resolus-stock.json`), qui ne fait que DÉCROÎTRE :
// l'écart nominatif dans les deux sens (`ecartDuVolet`), le stock point fixe de sa régénération.
//   node --test scripts/guards/balayages-non-resolus.test.mjs   (gate `test:hooks`)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleDeSite, ecartDuVolet, remedeNomme } from './lib/stock.mjs'
import { ecartDeRegeneration, lireEntreesDeSite, texteEnPlace } from './lib/stockDeSites.mjs'
import { CLASSES, EXEMPTIONS, STOCK, classer, mesure, regenerations } from './lib/balayagesNonResolus.mjs'

const { sites } = mesure()
const stock = lireEntreesDeSite(join(fileURLToPath(new URL('../..', import.meta.url)), STOCK))

test('aucun balayage NON RÉSOLU neuf hors du stock — le rendre résoluble, jamais le stocker', () => {
  const { neuves } = ecartDuVolet({ sites, stock, ou: STOCK })
  assert.deepEqual(neuves, [], `balayage(s) NEUF(S) que la dérivation ne rattache à aucune racine :\n${neuves.join('\n')}`)
})

test('le stock ne peut que DÉCROÎTRE — toute entrée devenue résoluble en sort', () => {
  const { perimees } = ecartDuVolet({ sites, stock, ou: STOCK })
  assert.deepEqual(perimees, [], `entrée(s) soldée(s) — régénérer : npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/balayagesNonResolus.mjs\n${perimees.join('\n')}`)
})

test('le stock committé est le point fixe de sa régénération', () => {
  for (const r of regenerations(sites)) assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
})

test('une SUBSTITUTION à compte constant rougit des deux côtés', () => {
  const substitue = [...stock.slice(1), { famille: 'autre', fichier: 'scripts/inexistant.mjs', ref: 'readFileSync : forme Bidon', occurrence: 1 }]
  const ecart = ecartDuVolet({ sites, stock: substitue, ou: STOCK })
  assert.ok(remedeNomme(ecart.neuves, cleDeSite(stock[0])), 'le site retiré du stock doit ressortir NEUF')
  assert.ok(remedeNomme(ecart.perimees, cleDeSite(substitue[substitue.length - 1])), "l'entrée bidon doit ressortir SOLDÉE")
})

test('classifieur : valeur nulle et module qui balaie la racine exemptés par règle, chaque autre raison prend sa classe, la ref porte helper et raison', () => {
  const { sites: classes, exemptes } = classer([
    { fichier: 'a.mjs', helper: 'readFileSync', raison: 'valeur nulle' },
    { fichier: 'r.mjs', helper: 'readFileSync', raison: 'paramètre rels', moduleBalaieLeDepot: true },
    { fichier: 'a.mjs', helper: 'lire', raison: 'appel String(vu.valeur.stdout).trim' },
    { fichier: 'a.mjs', helper: 'lire', raison: 'appel relative' },
    { fichier: 'b.mjs', helper: 'existsSync', raison: 'paramètre dir' },
    { fichier: 'b.mjs', helper: 'existsSync', raison: 'process introuvable' },
    { fichier: 'b.mjs', helper: 'existsSync', raison: 'courant introuvable' },
    { fichier: 'b.mjs', helper: 'glob', raison: 'chemin absolu /src/data' },
    { fichier: 'c.mjs', helper: 'readFile', raison: "URL new URL(s,\n  racine)" },
    { fichier: 'c.mjs', helper: 'readFile', raison: "cycle d'appels lire, sous" },
    { fichier: 'c.mjs', helper: 'readFile', raison: "profondeur d'appels > 16 (f17)" },
    { fichier: 'c.mjs', helper: 'readFile', raison: 'ancetre réaffectée en récurrence' },
  ])
  assert.deepEqual(exemptes, { 'valeur nulle': 1, 'module qui balaie la racine du dépôt': 1 })
  assert.deepEqual(classes.map((s) => [s.famille, s.file, s.ref]), [
    ['sortie de processus', 'a.mjs', 'lire : appel String(vu.valeur.stdout).trim'],
    ['appel non suivi', 'a.mjs', 'lire : appel relative'],
    ['paramètre non lié', 'b.mjs', 'existsSync : paramètre dir'],
    ['environnement de processus', 'b.mjs', 'existsSync : process introuvable'],
    ['identifiant introuvable', 'b.mjs', 'existsSync : courant introuvable'],
    ['chemin absolu', 'b.mjs', 'glob : chemin absolu /src/data'],
    ['URL', 'c.mjs', 'readFile : URL new URL(s, racine)'],
    ["cycle d'appels", 'c.mjs', "readFile : cycle d'appels lire, sous"],
    ["profondeur d'appels", 'c.mjs', "readFile : profondeur d'appels > 16 (f17)"],
    ['autre', 'c.mjs', 'readFile : ancetre réaffectée en récurrence'],
  ])
})

test('chaque exemption porte sa justification ; les classes finissent par une classe qui prend tout', () => {
  for (const e of EXEMPTIONS) assert.ok(e.justification.length > 40, `${e.classe} : justification absente`)
  assert.equal(CLASSES.at(-1).motif.test('raison inconnue'), true)
})
