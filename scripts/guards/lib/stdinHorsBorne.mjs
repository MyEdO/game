// GARDE DE CLASSE des hooks (#2112) : un hook `scripts/hooks/*.mjs` qui lit son stdin SANS la
// primitive bornée `lireStdinBorne` (`scripts/guards/lib/stdinBorne.mjs`) reste vivant tant que le
// harnais ne ferme pas ce stdin — le `timeout` déclaré dans `.claude/settings.json` n'y fait rien, et
// l'agent appelant attend un `tool_result` qui ne vient jamais.
// Motifs lus sur la vue CODE SEUL (`codeSeul.mjs`) : une mention en commentaire ou en chaîne ne lit rien.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeSeul } from './codeSeul.mjs'
import { listerDossier } from './lister.mjs'

/** Accès au stdin du processus : le flux `process.stdin`, ou une lecture SYNCHRONE du descripteur 0. */
const ACCES_STDIN = /\bprocess\.stdin\b|\b(?:readFileSync|readSync)\(\s*0\b/

/**
 * Les lignes d'un source qui accèdent au stdin hors de la primitive bornée.
 * @param {string} source
 * @returns {{ ligne: number, texte: string }[]}
 */
export function accesStdin(source) {
  const lignesSource = source.split('\n')
  return codeSeul(source)
    .split('\n')
    .flatMap((code, i) => (ACCES_STDIN.test(code) ? [{ ligne: i + 1, texte: lignesSource[i].trim() }] : []))
}

/**
 * Les accès au stdin hors primitive dans les hooks (`*.mjs` hors `*.test.mjs`) d'un dossier.
 * @param {string} dossierHooks
 * @returns {{ fichier: string, ligne: number, texte: string }[]}
 */
export function hooksHorsBorne(dossierHooks) {
  return listerDossier(dossierHooks)
    .filter((nom) => nom.endsWith('.mjs') && !nom.endsWith('.test.mjs'))
    .flatMap((nom) => accesStdin(readFileSync(join(dossierHooks, nom), 'utf8')).map((a) => ({ fichier: nom, ...a })))
}
