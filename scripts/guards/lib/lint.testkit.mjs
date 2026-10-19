import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { parseSync } from 'rolldown/utils'
import { BLOCS_LINT } from '../../../oxlint.config.mjs'
import { correspondGlob } from './lister.mjs'
import { lancerLint, nomDeRegle, positionDeRapport } from './lintStage.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
const { ConfigCommentParser } = createRequire(import.meta.resolve('eslint'))('@eslint/plugin-kit')
const parseur = new ConfigCommentParser()

/** Les directives qui éteignent une des `regles` : la ligne de la directive, et la ligne qu'elle CIBLE
 *  selon sa forme — `-next-line` la ligne qui suit le commentaire, `-line` la sienne, `null` pour la
 *  forme bloc (`/* eslint-disable *\/`) et le commentaire de configuration, qui n'éteignent pas UNE ligne —,
 *  et les `noms` de règles qu'elle nomme, lus comme oxlint (justification dès `--`, même collé ; noms séparés par virgules et blancs ; vide : directive globale). `regles` : liste, ou prédicat sur un nom. */
export function directivesLintCiblees(texte, fichier, regles) {
  const vise = typeof regles === 'function' ? regles : (nom) => regles.includes(nom)
  const parse = parseSync(fichier, texte)
  if (parse.errors.length) throw new Error(`${fichier}: ${parse.errors.map(e => e.message).join('; ')}`)
  const ligneDe = (pos) => texte.slice(0, pos).split('\n').length
  return parse.comments.flatMap(c => {
    const d = parseur.parseDirective(c.value.trim().replace(/^oxlint(?=\b|-)/, 'eslint'))
    if (!d) return []
    let noms
    if (d.label.startsWith('eslint-disable')) noms = Object.keys(parseur.parseListConfig(d.value.split('--')[0])).flatMap((cle) => cle.split(/\s+/)).filter(Boolean)
    else if (d.label === 'eslint' && c.type === 'Block') {
      const parsed = parseur.parseJSONLikeConfig(d.value)
      if (!parsed.ok) throw new Error(`${fichier}: directive invalide`)
      noms = Object.keys(parsed.config)
    } else return []
    if (noms.length && !noms.some(vise)) return []
    const cible = d.label === 'eslint-disable-next-line' ? ligneDe(c.end) + 1 : d.label === 'eslint-disable-line' ? ligneDe(c.start) : null
    return [{ ligne: ligneDe(c.start), cible, noms }]
  })
}
/** Le texte peut-il porter une directive ? Préfiltre de `directivesLintCiblees`, qui parse. */
export const porteCommentaireEslint = (texte) => texte.includes('eslint') || texte.includes('oxlint')
export function directivesLint(texte, fichier, regles) {
  return directivesLintCiblees(texte, fichier, regles).map(d => d.ligne)
}
export function configPourFichier(fichier) {
  const rel = relative(RACINE, resolve(RACINE,fichier)).replaceAll('\\','/')
  const rules = {}
  for (const b of BLOCS_LINT) if ((b.files ?? ['**/*']).some(g=>correspondGlob(rel,g)) && !(b.excludeFiles??[]).some(g=>correspondGlob(rel,g))) Object.assign(rules,b.rules)
  return {rules}
}
/** @param {{filePath:string,code:string}[]} fixtures @param {object} [configuration] */
export function lintFixtures(fixtures, configuration) {
  const cwd = mkdtempSync(join(tmpdir(),'lint-contrat-'))
  const chemins = fixtures.map(f=>relative(RACINE,resolve(RACINE,f.filePath)).replaceAll('\\','/'))
  try {
    for (let i=0;i<fixtures.length;i++) { const dest=join(cwd,chemins[i]); mkdirSync(dirname(dest),{recursive:true}); writeFileSync(dest,fixtures[i].code) }
    const resultat=lancerLint(RACINE,chemins,{cwd,configuration})
    if(resultat.defauts.some(d=>d.regle==='(outillage)')) throw new Error(resultat.brut||JSON.stringify(resultat.defauts))
    const rapport=JSON.parse(resultat.stdout)
    return chemins.map((rel)=>{
      const messages=rapport.diagnostics.filter(d=>d.filename.replaceAll('\\','/')===rel).map(d=>({ruleId:d.code?nomDeRegle(d.code):null,message:d.message,severity:d.severity==='error'?2:1,...positionDeRapport(d,cwd),fatal:!d.code&&d.severity==='error'}))
      return {filePath:resolve(RACINE,rel),messages,errorCount:messages.filter(m=>m.severity===2).length}
    })
  } finally { rmSync(cwd,{recursive:true,force:true}) }
}
export function selectionnerMessages(resultat, predicate) {
  const fatals = resultat.messages.filter(message => message.fatal)
  if (fatals.length) throw new Error(fatals.map(message => `${resultat.filePath}:${message.line}:${message.column}: ${message.message}`).join('\n'))
  return resultat.messages.filter(predicate)
}
export function creerBancLint() {
  return {
    /** @param {string} code @param {{filePath:string}} options */
    lintText(code,{filePath}) { return lintFixtures([{filePath,code}]) },
    /** @param {string[]} fichiers */
    lintFiles(fichiers) { return lintFixtures(fichiers.map(filePath=>({filePath,code:readFileSync(resolve(RACINE,filePath),'utf8')}))) },
    calculateConfigForFile:configPourFichier,
  }
}
