export interface MessageLint {
  ruleId: string | null
  message: string
  severity: 1 | 2
  line: number
  column: number
  fatal: boolean
}
export interface ResultatLint {
  filePath: string
  messages: MessageLint[]
  errorCount: number
}
export interface FixtureLint { filePath: string; code: string }
export function directivesLint(texte: string, fichier: string, regles: string[]): number[]
export function configPourFichier(fichier: string): { rules: Record<string, unknown> }
export function ignoreLint(fichier: string, configuration?: object): boolean
export function lintFixtures(fixtures: FixtureLint[], configuration?: object): ResultatLint[]
export function selectionnerMessages(resultat: ResultatLint, predicate: (message: MessageLint) => boolean): MessageLint[]
export function creerBancLint(): {
  lintText(code: string, options: {filePath: string; warnIgnored?: boolean}): ResultatLint[]
  lintFiles(fichiers: string[]): ResultatLint[]
  calculateConfigForFile: typeof configPourFichier
  isPathIgnored: typeof ignoreLint
}
