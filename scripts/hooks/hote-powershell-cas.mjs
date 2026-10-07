// Cas de l'hôte PowerShell (#2292) : UNE liste, lue par les tests (`argumentChaine` dans
// `scripts/hooks/segments-profonds.test.mjs`, la garde réelle dans
// `scripts/hooks/commande-piege-guard.test.mjs`) et rejouée sur l'hôte RÉEL par la sonde `scripts/ops/sondes/hote-powershell.mjs`, qui signale tout écart.
//
// `args` : les arguments de l'hôte, où `CHARGE` (dans un argument) devient la commande portée, `CHARGE_ETALEE`
// (un argument entier) ses mots, un argument chacun, et `CHARGE_B64` sa forme `-EncodedCommand`.
// `classe` : `execute` = l'hôte exécute la charge ; `rien` = il n'exécute aucun texte de la ligne ; `stdin` = il
// exécute son entrée standard (`entree`), une limite nommée de la lecture.
// `surApproximation` : pourquoi la lecture rend un texte là où l'hôte n'exécute rien (admis par l'invariant).
// `via: 'gitbash'` : la ligne est tapée sous Git Bash, qui rend `//x` en `/x` (MSYS).

import { Buffer } from 'node:buffer'

/** Versions des hôtes sur lesquelles la liste a été mesurée. */
export const HOTES_MESURES = { pwsh: '7.5.5', powershell: '5.1.26100.9444' }

export const CHARGE = '<charge>'
export const CHARGE_ETALEE = '<charge-etalee>'
export const CHARGE_B64 = '<charge-b64>'

const LES_DEUX = ['pwsh', 'powershell']
const pour = (exes, args, classe, extra = {}) => exes.map((exe) => ({ exe, args, classe, ...extra }))

const TETE_DOUBLEE_51 = 'sous 5.1, un tiret doublé se lit comme un tiret simple ; l\'hôte y voit une erreur d\'analyse'
const INCONNU_51 = 'sous 5.1, l\'inconnu ouvre la commande, lui compris : l\'hôte l\'exécute et échoue sur ce jeton'
const VALEUR_NON_VALIDEE = 'la valeur n\'est pas validée : l\'hôte la refuse avant d\'exécuter la commande'

export const CAS_HOTE_POWERSHELL = [
  // Préfixes de l'hôte : le premier couple qui correspond l'emporte (`MatchSwitch`).
  ...['-c', '-co', '-com', '-Command', '-COMMAND'].flatMap((p) => pour(LES_DEUX, ['-NoProfile', p, CHARGE], 'execute')),
  ...['-e', '-ec', '-en', '-enc', '-EncodedCommand'].flatMap((p) => pour(LES_DEUX, ['-NoProfile', p, CHARGE_B64], 'execute')),
  ...pour(['pwsh'], ['-NoProfile', '-cwa', CHARGE], 'execute'),
  ...pour(['pwsh'], ['-NoProfile', '-CommandWithArgs', CHARGE], 'execute'),
  ...pour(['powershell'], ['-NoProfile', '-cwa', CHARGE], 'rien', { surApproximation: INCONNU_51 }),
  ...pour(['pwsh'], ['-NoProfile', '-conf', CHARGE], 'rien'),
  ...pour(['powershell'], ['-NoProfile', '-conf', CHARGE], 'rien', { surApproximation: INCONNU_51 }),
  ...pour(['pwsh'], ['-NoProfile', '-commandw', CHARGE], 'rien'),
  ...pour(['pwsh'], ['-NoProfile', '-encodeda', CHARGE_B64], 'rien'),
  // Caractère de paramètre (`GetSwitchKey`, `IsDash`).
  ...['/c', '/co', '/command', '–c', '—c', '―c', ' -c', '-c ', '–Command']
    .flatMap((p) => pour(LES_DEUX, ['-NoProfile', p, CHARGE], 'execute')),
  ...['/e', '/ec', '–e'].flatMap((p) => pour(LES_DEUX, ['-NoProfile', p, CHARGE_B64], 'execute')),
  ...pour(['pwsh'], ['-NoProfile', '/cwa', CHARGE], 'execute'),
  // Le jeton est `Trim()` aux blancs de .NET : U+0085 en est un (pas pour le `trim()` de JS), U+FEFF n'en est pas un.
  ...['\u0085-c', '-c\u0085'].flatMap((p) => pour(LES_DEUX, ['-NoProfile', p, CHARGE], 'execute')),
  ...pour(['pwsh'], ['-NoProfile', '\uFEFF-c', CHARGE], 'rien'),
  ...pour(['powershell'], ['-NoProfile', '\uFEFF-c', CHARGE], 'rien', { surApproximation: INCONNU_51 }),
  ...['--c', '--command', '––c'].flatMap((p) => [
    ...pour(['pwsh'], ['-NoProfile', p, CHARGE], 'execute'),
    ...pour(['powershell'], ['-NoProfile', p, CHARGE], 'rien', { surApproximation: TETE_DOUBLEE_51 }),
  ]),
  ...pour(['pwsh'], ['-NoProfile', '--ec', CHARGE_B64], 'execute'),
  ...pour(['powershell'], ['-NoProfile', '--ec', CHARGE_B64], 'rien', { surApproximation: TETE_DOUBLEE_51 }),
  ...pour(['pwsh'], ['-NoProfile', '-–c', CHARGE], 'rien'),
  ...pour(['powershell'], ['-NoProfile', '-–c', CHARGE], 'rien', { surApproximation: INCONNU_51 }),
  ...pour(['pwsh'], ['-NoProfile', '-c:', CHARGE], 'rien'),
  // Graphie Git Bash : MSYS rend `//c` en `/c`.
  ...pour(LES_DEUX, ['-NoProfile', '//c', CHARGE], 'execute', { via: 'gitbash' }),
  ...pour(['pwsh'], ['-NoProfile', '//command', CHARGE], 'execute', { via: 'gitbash' }),
  // Séquence : valeurs et drapeaux sautés, la commande prend tout le reste de la ligne.
  ...pour(LES_DEUX, ['-ex', 'Bypass', '-c', CHARGE], 'execute'),
  ...pour(LES_DEUX, ['-ep', 'Bypass', '-c', CHARGE], 'execute'),
  ...pour(LES_DEUX, ['-ExecutionPolicy', 'Bypass', '-Command', CHARGE], 'execute'),
  ...pour(LES_DEUX, ['-NoProfile', '-NonInteractive', '-Command', CHARGE], 'execute'),
  ...pour(LES_DEUX, ['-NoProfile', '-wd', '.', '-c', CHARGE], 'execute'),
  ...pour(LES_DEUX, ['-NoProfile', '-o', 'Text', '-c', CHARGE], 'execute'),
  ...pour(LES_DEUX, ['-NoProfile', '-c', CHARGE_ETALEE], 'execute'),
  ...pour(['pwsh'], ['-in', '-c', CHARGE], 'execute'),
  ...pour(['pwsh'], ['-i', '-c', CHARGE], 'execute'),
  ...pour(['powershell'], ['-in', '-c', CHARGE], 'rien', { surApproximation: VALEUR_NON_VALIDEE }),
  ...pour(LES_DEUX, ['-NoProfile', '-o', 'Bogus', '-c', CHARGE], 'rien', { surApproximation: VALEUR_NON_VALIDEE }),
  ...pour(LES_DEUX, ['-NoProfile', '-ConfigurationName', 'x', '-c', CHARGE], 'rien', {
    surApproximation: 'la configuration de session « x » n\'existe pas : l\'hôte échoue avant d\'exécuter la commande',
  }),
  // Table de 5.1, mesurée : `-st` est `-Sta`, `-to` et `-utc` prennent une valeur ; `-PSConsoleFile` et `-Version` n'y
  // sont pas des paramètres ; `-so` est un mode serveur.
  ...pour(['powershell'], ['-NoProfile', '-st', '-c', CHARGE], 'execute'),
  ...pour(['pwsh'], ['-NoProfile', '-st', '-c', CHARGE], 'rien'),
  ...pour(['powershell'], ['-NoProfile', '-to', 'x', CHARGE], 'execute'),
  ...pour(['powershell'], ['-NoProfile', '-utc', '2026-01-01T00:00:00Z', CHARGE], 'execute'),
  ...pour(['powershell'], ['-NoProfile', '-psc', 'x', '-c', CHARGE], 'rien', { surApproximation: INCONNU_51 }),
  ...pour(['powershell'], ['-NoProfile', '-Version', '5.1', '-c', CHARGE], 'rien', { surApproximation: INCONNU_51 }),
  ...pour(['powershell'], ['-NoProfile', '-so', CHARGE], 'rien', {
    surApproximation: 'un mode serveur lit du PSRP sur stdin ; la lecture le saute comme un drapeau',
  }),
  // L'hôte n'exécute aucun texte de la ligne.
  ...pour(LES_DEUX, ['-NoProfile', '-File', 'absent.ps1', '-c', CHARGE], 'rien'),
  ...pour(LES_DEUX, ['-NoProfile', '-h', '-c', CHARGE], 'rien'),
  ...pour(LES_DEUX, ['-NoProfile', '-?', '-c', CHARGE], 'rien'),
  ...pour(['pwsh'], ['-NoProfile', '-v', '-c', CHARGE], 'rien'),
  ...pour(['powershell'], ['-NoProfile', '-v', '-c', CHARGE], 'rien', { surApproximation: INCONNU_51 }),
  ...pour(LES_DEUX, ['-NoProfile', '-e', CHARGE_B64, '-c', 'Write-Output AUTRE'], 'rien', {
    surApproximation: 'une seconde commande est refusée (`CommandAlreadySpecified`, `CLPP.cs:1489-1494`) ; la lecture rend la première',
  }),
  // Positionnel et inconnu : `pwsh` y ouvre `-File`, `powershell` 5.1 la commande.
  ...pour(['pwsh'], ['-NoProfile', CHARGE], 'rien'),
  ...pour(['pwsh'], ['-NoProfile', CHARGE_ETALEE], 'rien'),
  ...pour(['pwsh'], ['-zz', '-c', CHARGE], 'rien'),
  ...pour(['pwsh'], ['-NoProfile', `-zz; ${CHARGE}`], 'rien'),
  ...pour(['pwsh'], ['-NoProfile', '', '-c', CHARGE], 'rien'),
  ...pour(['powershell'], [CHARGE], 'execute'),
  ...pour(['powershell'], ['-NoProfile', CHARGE], 'execute'),
  ...pour(['powershell'], ['-NoProfile', CHARGE_ETALEE], 'execute'),
  ...pour(['powershell'], ['-ExecutionPolicy', 'Bypass', CHARGE_ETALEE], 'execute'),
  ...pour(['powershell'], ['-NoProfile', '-ex', 'Bypass', '-NoLogo', CHARGE_ETALEE], 'execute'),
  ...pour(['powershell'], ['-NoProfile', `-zz; ${CHARGE}`], 'execute'),
  ...pour(['powershell'], ['-NoProfile', '-zz', ';', CHARGE_ETALEE], 'execute'),
  ...pour(['powershell'], ['-NoProfile', '-NoExit:$false', ';', CHARGE_ETALEE], 'execute'),
  ...pour(['powershell'], ['-NoProfile', '', '-c', CHARGE], 'execute'),
  // L'hôte lit sa commande sur stdin : #2172.
  ...pour(LES_DEUX, ['-NoProfile', '-c', '-'], 'stdin', { entree: true }),
  ...pour(LES_DEUX, ['-NoProfile', '-'], 'stdin', { entree: true }),
  ...pour(LES_DEUX, ['-NoProfile'], 'stdin', { entree: true }),
]

/** Arguments d'un cas, la charge `commande` substituée (`b64` = son encodage `-EncodedCommand`). */
export function argumentsDuCas(cas, commande) {
  const b64 = Buffer.from(commande, 'utf16le').toString('base64')
  return cas.args.flatMap((a) => {
    if (a === CHARGE_ETALEE) return commande.split(' ')
    return [a.replaceAll(CHARGE_B64, b64).replaceAll(CHARGE, commande)]
  })
}
