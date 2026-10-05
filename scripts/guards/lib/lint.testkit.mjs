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

export function directivesLint(texte, fichier, regles) {
  const parse = parseSync(fichier, texte)
  if (parse.errors.length) throw new Error(`${fichier}: ${parse.errors.map(e => e.message).join('; ')}`)
  return parse.comments.flatMap(c => {
    const d = parseur.parseDirective(c.value.trim().replace(/^oxlint(?=\b|-)/, 'eslint'))
    if (!d) return []
    let noms
    if (d.label.startsWith('eslint-disable')) noms = Object.keys(parseur.parseListConfig(d.value))
    else if (d.label === 'eslint' && c.type === 'Block') {
      const parsed = parseur.parseJSONLikeConfig(d.value)
      if (!parsed.ok) throw new Error(`${fichier}: directive invalide`)
      noms = Object.keys(parsed.config)
    } else return []
    return (!noms.length || noms.some(n => regles.includes(n))) ? [texte.slice(0,c.start).split('\n').length] : []
  })
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
