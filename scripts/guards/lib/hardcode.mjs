// Mécanique de scan du garde-fou « tout migrer » — réactions de combat hardcodées PAR-NOM
// (État/trait/talent/atout d'arme) plutôt que par DONNÉE (TriggeredEffect/passive). Module ESM
// pur, exécutable par `node` nu — consommé par src/state/combat-hardcode-guard.test.ts ET par un
// futur hook pre-commit. Les BASELINES (nombre de sites tolérés par fichier, gelées au recensement)
// restent DONNÉES DE POLICY dans le test — ici ne vit QUE la mécanique de détection, généralisée à
// TOUT src/engine + src/state (cf. docs/combat-events-coherence.md, Lot 8).

/** Retire commentaires ET imports nommés (les ids/noms en commentaire ou en `import {…}` — y
 *  compris multi-lignes — ne sont PAS du code réactif : seuls les SITES d'appel comptent).
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"][^'"]*['"];?/g, '') // imports nommés (multi-lignes)
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/**
 * Marqueurs réactifs par-nom, famille TRAIT/TALENT — recensés aux Lots 4bis/6 sur
 * state/combat/roundHooks.ts et state/combatFlow.ts, généralisés à tout src/engine + src/state
 * (Lot 8) : une réaction de combat codée PAR-NOM (trait/talent) plutôt que par donnée.
 * Les appels `hasTraitKey(`/`hasTalent(` NE sont PAS ici : leur nocivité dépend de l'ARGUMENT-entité
 * (littéral en dur vs donnée), tranchée par `nameCallHasLiteralArg` (#385) — un `hasTalent(c, X)` dont
 * `X` est une variable/donnée est data-driven, pas un hardcode par-nom.
 * @type {RegExp}
 */
export const TRAIT_TALENT_RX = /isBestial|id: '(bestial-fire-fear|determination)|isUnstable/;

/**
 * Appels dont la nocivité se juge à l'ARGUMENT-entité : `hasTraitKey(traits, id)` / `hasTalent(c, talentId)`.
 * Le 2e argument est le nom d'entité. LITTÉRAL de chaîne (`'…'`/`"…"`/gabarit sans interpolation) =>
 * réaction par-nom en dur (signalée) ; variable, accès de propriété ou paramètre => data-driven
 * (non signalé). Affinage STRUCTUREL (#385, même standard que le volet excuses #177 : les faux
 * positifs se retranchent par la FORME de l'argument, jamais par une liste d'exceptions nominatives).
 * @type {RegExp}
 */
export const NAME_CALL_RX = /\b(?:hasTraitKey|hasTalent)\(/g;

/**
 * Index du 1er caractère non-espace du 2e argument d'un appel dont la `(` est à `open`, ou null (appel
 * à 0/1 argument). Suit la profondeur `()`/`[]`/`{}` et saute les chaînes, pour trouver la virgule de
 * séparation à la profondeur 1.
 * @param {string} line @param {number} open @returns {number|null}
 */
function secondArgIndex(line, open) {
  let depth = 0;
  for (let i = open; i < line.length; i++) {
    const c = line[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      for (i++; i < line.length && line[i] !== q; i++) if (line[i] === '\\') i++;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (--depth === 0) return null; }
    else if (c === ',' && depth === 1) {
      let j = i + 1;
      while (j < line.length && /\s/.test(line[j])) j++;
      return j < line.length ? j : null;
    }
  }
  return null;
}

/**
 * Vrai si un appel `hasTraitKey(`/`hasTalent(` de la ligne porte un 2e argument LITTÉRAL de chaîne
 * (nom d'entité en dur). Gabarit avec interpolation (`${…}`) = dynamique => NON littéral.
 * @param {string} line @returns {boolean}
 */
export function nameCallHasLiteralArg(line) {
  return callHasLiteralArg(line, NAME_CALL_RX);
}

/**
 * Vrai si un appel dont la regex `callRx` (globale, `\(` en fin de motif) matche sur `line` porte
 * un 2e argument LITTÉRAL de chaîne (`'…'`/`"…"`/gabarit sans interpolation `${…}`). Généralisation
 * de `nameCallHasLiteralArg` (#385) à toute famille d'appel à 2 arguments (#413).
 * @param {string} line @param {RegExp} callRx @returns {boolean}
 */
function callHasLiteralArg(line, callRx) {
  callRx.lastIndex = 0;
  let m;
  while ((m = callRx.exec(line))) {
    const arg = secondArgIndex(line, m.index + m[0].length - 1);
    if (arg == null) continue;
    const ch = line[arg];
    if (ch === "'" || ch === '"') return true;
    if (ch === '`') {
      const close = line.indexOf('`', arg + 1);
      const seg = close === -1 ? line.slice(arg + 1) : line.slice(arg + 1, close);
      if (!seg.includes('${')) return true;
    }
  }
  return false;
}

/**
 * Marqueurs réactifs par-nom, famille PAR-ÉTAT — motif du Lot 4 (`hasCondition(_, COND.*)` /
 * `stacks(_, COND.*)`), généralisé À TOUT l'arbre (Lot 8, issue #160). Var libre (`\w+`) : plus
 * seulement `c`/`target`. Toute lecture d'un État en INTERROGATION nominative est candidate ;
 * les GATES/mesures de machinerie universelle en sont retranchés par `MACHINERY_RX` (ci-dessous),
 * PAS par une entrée nominative d'entité (COND.hemorragique/aTerre/surpris…).
 * Étendu (#411, 2026-07-13) aux formes en CHAÎNE LITTÉRALE (`hasCondition(c, 'inconscient')` /
 * `stacks(c, "aveugle")`) : le contournement consistant à taper la chaîne au lieu de la constante
 * `COND.*` échappait totalement au scan (audit #410). Un 2e argument variable/propriété/gabarit
 * interpolé reste NON signalé (data-driven, même doctrine que #385 pour `hasTraitKey`/`hasTalent`).
 * Le gabarit BACKTICK STATIQUE (`` hasCondition(c, `inconscient`) ``) n'est PAS couvert par cette
 * regex : un backtick en tête de 2e argument peut être suivi d'une interpolation ARBITRAIREMENT
 * loin dans le segment (`` `etat-${x}` ``), donc juger sa littéralité exige de lire le segment ENTIER
 * jusqu'au backtick fermant — pas juste le caractère suivant. C'est `perEtatHasLiteralArg` (même
 * mécanique que `nameCallHasLiteralArg`, #385) qui tranche cette forme, dans `scanHardcode` (#413,
 * corrige un faux positif de la 1ère version qui testait seulement `` `(?!\$\{) `` — flaguait à tort
 * un préfixe littéral suivi d'interpolation).
 * @type {RegExp}
 */
export const PER_ETAT_RX = /hasCondition\(\w+, ?(?:COND\.|['"])|stacks\(\w+, ?(?:COND\.|['"])/;

/**
 * Appels de la famille PAR-ÉTAT (`hasCondition(`/`stacks(`), pour juger si leur 2e argument est un
 * LITTÉRAL de chaîne — sert à fermer le loophole d'instrumentation (#413) : une ligne qui matche
 * `MACHINERY_RX` (ex. `const _ = stacks(c, …)`) ne doit rester une machinerie retranchée QUE si son
 * argument est la constante canonique `COND.*` ; un littéral de chaîne dans le MÊME gabarit est
 * toujours une réaction par-nom, jamais un gate.
 * @type {RegExp}
 */
const PER_ETAT_CALL_RX = /\b(?:hasCondition|stacks)\(/g;

/**
 * Vrai si une ligne porte un appel `hasCondition(`/`stacks(` dont le 2e argument est un LITTÉRAL
 * de chaîne (`'…'`/`"…"`/gabarit sans interpolation). @param {string} line @returns {boolean}
 */
export function perEtatHasLiteralArg(line) {
  return callHasLiteralArg(line, PER_ETAT_CALL_RX);
}

/**
 * Lignes à EXCLURE inconditionnellement : déclarations d'import (jamais un site d'appel réactif).
 * @type {RegExp}
 */
export const EXCLUDE_RX = /^\s*import/;

/**
 * EXCLUSIONS de MACHINERIE (généralisation de l'exclude Lot 4 d'engine/conditions.ts, issue #160) —
 * appliquées AUX SEULES lectures PAR-ÉTAT. Chaque terme est une RÈGLE d'arène universelle ou une
 * INSTRUMENTATION, JAMAIS un nom d'État/trait/talent éditable : une lecture d'État qui matche décrit
 * un GATE (mort, action/mouvement, géométrie, contrôle) ou une MESURE/journalisation, pas la
 * réaction propre d'une entité (celle-ci est en donnée — etats.json). Familles :
 *  - mort & cycle de vie (LDB 18) : isOutOfAction/inDeathCondition/applyZeroWounds/aaDeathByCriticalCount/
 *    usesSuddenDeath/criticalWounds/roundsAtZero/outOfRencontre/.dead + le gate 0 PB `wounds.current <= 0`
 *    (BORNÉ à `<= 0` — surtout PAS `wounds.current` nu : un `wounds.current -= …` par-nom DOIT rester signalé) ;
 *  - gating d'Action/Mouvement/Engagement : canTakeAction/isEngaged/controlsCombatant/movementUsed ;
 *  - géométrie (allonge / balayage des surdimensionnés) : sizeGap / `return reach` ;
 *  - coutures de contrôle/capacité : hasActiveCapability / pilotedByHuman ;
 *  - transition d'État par la machinerie : removeCondition ;
 *  - instrumentation : capture d'un compte d'États dans un local (`const/let X = stacks(`) pour un delta ;
 *  - journal seul : la lecture ne nourrit qu'une ligne de log (log.push( / .log( / `return tr(`) ;
 *  - SÉLECTEURS d'ouverture de combat / doctrine IA (l'État Surpris lu comme SIGNAL d'initiative) :
 *    `return 'ambush'|'assault'|'combat'|'embuscade'`.
 * Toute NOUVELLE lecture par-État qui n'est aucune de ces machineries = réaction par-nom → signalée.
 * Retranchement (#413) : la machinerie ne retranche QUE la forme canonique `COND.*` — un 2e argument
 * LITTÉRAL de chaîne dans le MÊME gabarit (ex. `const _ = stacks(c, 'inconscient')`) reste COMPTÉ,
 * ferme le contournement où l'instrumentation masquait un nom d'État en dur (`perEtatHasLiteralArg`).
 * @type {RegExp}
 */
export const MACHINERY_RX = new RegExp([
  'isOutOfAction', 'inDeathCondition', 'applyZeroWounds', 'aaDeathByCriticalCount', 'usesSuddenDeath',
  'criticalWounds', 'roundsAtZero', 'outOfRencontre', '\\.dead\\b', 'wounds\\.current\\s*<=\\s*0',
  'canTakeAction', 'isEngaged', 'controlsCombatant', 'movementUsed',
  'sizeGap', '\\breturn reach\\b', 'hasActiveCapability', 'pilotedByHuman', 'removeCondition',
  '\\b(?:const|let)\\s+\\w+\\s*=\\s*stacks\\([^)]*\\);?\\s*$', 'log\\.push\\(', '\\.log\\(', '\\breturn tr\\(',
  "return '(?:ambush|assault|combat|embuscade)'",
].join('|'));

/**
 * Scan complet d'un fichier source : chaque ligne portant un marqueur réactif par-nom (hors
 * lignes exclues), commentaires/imports retirés. Une lecture PAR-ÉTAT (et par-État SEULE) qui est
 * de la machinerie/instrumentation universelle (`MACHINERY_RX`) est un GATE, pas une réaction —
 * retranchée, SAUF (#413) si son 2e argument est un LITTÉRAL de chaîne (`perEtatHasLiteralArg`) :
 * seule la forme canonique `COND.*` reste un gate, un nom d'État en dur derrière de la machinerie
 * reste compté. La famille TRAIT/TALENT n'est JAMAIS retranchée par la machinerie (baselines inchangées).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanHardcode(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (EXCLUDE_RX.test(line)) return;
      const trait = TRAIT_TALENT_RX.test(line) || nameCallHasLiteralArg(line);
      const etat = PER_ETAT_RX.test(line) || perEtatHasLiteralArg(line);
      if (!trait && !etat) return;
      if (etat && !trait && MACHINERY_RX.test(line) && !perEtatHasLiteralArg(line)) return; // gate/mesure d'arène (forme canonique) — pas une réaction par-nom
      findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites réactifs par-nom dans un fichier (raccourci de `scanHardcode(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countHardcode(relPath, contenu) {
  return scanHardcode(relPath, contenu).length;
}
