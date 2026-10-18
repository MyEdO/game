import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLASSES, EXEMPTIONS, classer } from './lib/balayagesNonResolus.mjs'

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
