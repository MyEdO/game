// Hook pre-commit : la porte AU COMMIT — gardes anti-poison diff-scopées sur les fichiers stagés.
// Mécanique partagée : scripts/guards/lib/ (source unique avec les tests Vitest et le hook au stylo).
// CE QUI EST JOUÉ ICI : les scanners de commentaires/code sur le contenu de l'INDEX, `validate-data`,
// `docs:check` + `check-docs-vs-head` + `check-plans-anchors`, `raw:implemente`, `build-doctrines`,
// `compile-dessin-quad`,
// `test:raw`, `test:recette`, `agents:check`, et le LINT des fichiers stagés (≈ 4 s / 20 fichiers).
// CE QUI N'EST PAS JOUÉ ICI : ni typecheck, ni suite Vitest, ni les scanners de corpus entier — ils
// coûtent des dizaines de secondes et restent à la CI. La durée totale est imprimée en fin de hook.
// Contrat : BLOQUE (exit 1) sur pierre tombale et logique-par-label (tolérance zéro, arbre à zéro) ;
// les excuses sans tag bloquent quand EXCUSE_GUARD_ACTIVE est vrai, sinon elles rejoignent le canal
// non bloquant. Ce canal (affirmations RAW, revendications d'autorité, hardcode réactif) est trié par
// la baseline nominative `scripts/guards/lib/decisions-baseline.json` : NOUVEAU en tête, sites déjà
// tranchés en une ligne compacte. `docs:check` tourne si un docs/*.md à plat est stagé (racine ou
// docs/raw/, les fiches régénérables — #487) ; sur le même déclencheur, `check-docs-vs-head.mjs`
// confronte les docs GÉNÉRÉS stagés à l'INDEX (porte de COMMIT, jamais dans `docs:check`).
// Testabilité : des chemins passés en arguments remplacent la liste stagée (aucun toucher à l'index).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanTombstones, scanExcuses, scanRawClaims, scanDecisionClaims, scanLegacyVocabHorsStock, EXCUSE_GUARD_ACTIVE,
  estFichierScanne, loadDecisionsBaseline, partitionBaseline, formatBaselineReport,
} from '../guards/lib/commentPoison.mjs';
import {
  scanLabelLogic, scanLabelAsIdArg, collectIdParamFnsAcrossDirs, effectiveIdParamFns,
  scanLabelLiteralCompare, LABEL_LITERAL_STOCK,
  scanCallResultLiteralCompare, LABEL_CALL_LITERAL_STOCK,
  STRICT_DIRS, RATCHET_DIRS, RATCHET_EXCEPTIONS, ratchetShortKey,
} from '../guards/lib/labelLogic.mjs';
import { emojisIn } from '../guards/lib/emojiAffordance.mjs';
import { scanHardcode } from '../guards/lib/hardcode.mjs';
import { scanRollSeamExclusivity } from '../guards/lib/rollSeamExclusivity.mjs';
import { rollSeamExcluded } from '../guards/lib/rollSeamWhitelist.mjs';
import { contexteDeScanRng, scanBattleRngEngineLeak } from '../guards/lib/battleRngEngineLeak.mjs';
import { battleRngEngineLeakExcluded } from '../guards/lib/battleRngEngineLeakWhitelist.mjs';
import { scanNpmLockHoisted } from '../guards/lib/npmLockHoisted.mjs';
import { scanArbresImbriques } from '../guards/lib/arbreImbrique.mjs';
import { fichiersALinter, lancerLint } from '../guards/lib/lintStage.mjs';
import { ciblesDesArmes, generateursArmes } from '../guards/lib/empreinteStage.mjs';
import { codeDePanne, docsDePorte, paquetsDArgv } from '../guards/lib/porteSpawn.mjs';
import { cheminsMalNormalises, raisonDeRefusEol } from '../guards/lib/eolStage.mjs';
import { defautsDeForme, familleDe, raisonDeRefusDeForme } from '../guards/memoire-forme.mjs';
import { INDEX, arbrePrincipal, ceQuEmporteLIndex, depotDe, eolsDe, lireEnLot, racineDe, raisonCourte } from '../guards/lib/gitPorte.mjs';
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs';

const DEBUT_MS = Date.now();

// Deux racines DISTINCTES, jamais interchangeables. `core.hooksPath` vaut `scripts/git-hooks` RELATIF
// (`git config --show-origin --get-all core.hooksPath` → `.git/config`, valeur relative), donc le
// FICHIER joué est la copie de l'arbre QUI COMMITTE, worktree compris (#1679 L1c). Ce `.git/config`
// est COMMUN à tous les worktrees : une valeur absolue y désignerait un seul arbre pour tous.
//  - ROOT = racine du worktree QUI COMMITTE, l'arbre à JUGER (contenu lu, scripts de garde joués, cwd
//    des sous-processus). git chdir dans la racine de la copie de travail avant d'invoquer un hook
//    (githooks(5)), donc process.cwd() la porte ; `rev-parse --show-toplevel` la normalise.
//  - HOOK_TREE = arbre PRINCIPAL, seul garanti `npm install`é (un worktree d'agent ne porte souvent
//    qu'un node_modules de caches). Il ne sert QU'À retrouver l'outillage installé, jamais à juger, et
//    se résout par `arbrePrincipal` (scripts/guards/lib/gitPorte.mjs, primitive UNIQUE : elle rend
//    l'arbre principal depuis n'importe quel worktree) ; à défaut, le dossier qui héberge ce fichier.
const DOSSIER_DU_HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOK_TREE = (() => {
  const vu = arbrePrincipal(depotDe(DOSSIER_DU_HOOK));
  return vu.disponible ? resolve(vu.valeur) : DOSSIER_DU_HOOK;
})();
const TOP = racineDe(depotDe(process.cwd()));
const ROOT = TOP ? resolve(TOP) : HOOK_TREE;
const depot = depotDe(ROOT);
// tsx est de l'OUTILLAGE, pas du contenu jugé : il vit là où l'install a eu lieu. Le SCRIPT qu'il joue,
// lui, reste celui de ROOT.
const tsxIn = (root) => join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const TSX_CLI = existsSync(tsxIn(ROOT)) ? tsxIn(ROOT) : tsxIn(HOOK_TREE);

// 5ᵉ forme du garde-fou #142 (`.label` passé où le paramètre de déclaration est `id`) : map GLOBALE
// des déclarations id-param sur le MÊME périmètre que `label-logic-guard.test.ts` (déclaration et
// appel peuvent vivre dans des fichiers différents, ex. `bodyShapeOf`) — composition PARTAGÉE
// (`collectIdParamFnsAcrossDirs`, scripts/guards/lib/labelLogic.mjs), aucune copie ici.
const ID_PARAM_FNS = collectIdParamFnsAcrossDirs(ROOT, [...STRICT_DIRS, ...RATCHET_DIRS]);
const strictRe = new RegExp(`^(?:${STRICT_DIRS.join('|')})/`);
const ratchetRe = new RegExp(`^(?:${RATCHET_DIRS.join('|')})/`);

const argFiles = process.argv.slice(2);
const staged = argFiles.length
  ? argFiles
  : ceQuEmporteLIndex(depot).chemins('ACMR');

const offenders = [];
/**
 * Le texte à juger de `rel`, `null` s'il n'y en a pas : en mode `argFiles`, le fichier (illisible →
 * `null`) ; en mode stagé, le BLOB DE L'INDEX (`lireEnLot`) — sur l'arbre partagé, le fichier disque
 * peut porter le WIP d'une AUTRE session que ce commit n'embarque pas. Un refus ou une panne de
 * `lireEnLot` est un fautif NOMMÉ.
 */
function texteAJuger(rel) {
  if (argFiles.length) {
    try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; }
  }
  try {
    return lireEnLot(depot, INDEX, [rel]).get(rel) ?? null;
  } catch (e) {
    offenders.push(`${rel} : illisible dans l'index — ${raisonCourte(e?.message ?? e)}`);
    return null;
  }
}
/** Le diff de l'INDEX (`ceQuEmporteLIndex`) ; une panne est un fautif NOMMÉ. */
const diffDeLIndex = (() => {
  try {
    return ceQuEmporteLIndex(depot).diff();
  } catch (e) {
    offenders.push(`diff de l'index illisible — ${raisonCourte(e?.message ?? e)}`);
    return '';
  }
})();
// #1679 L1c — le contenu d'un arbre de travail imbriqué n'appartient pas à un commit du dépôt hôte.
for (const x of scanArbresImbriques(staged, { racine: ROOT })) offenders.push(x.detail);
// Signaux non bloquants, en OBJETS `{ file, line, detail }` : ils passent par la baseline
// nominative (`decisions-baseline.json`) avant impression, qui les range en NOUVEAU / BASELINE.
const warnings = [];
// Fichiers TS réellement scannés — périmètre sur lequel la péremption d'une entrée se juge.
const scannedTs = [];
// Un passage de scan « rng vivant → résolveur moteur » pour tous les fichiers indexés.
const passageRng = contexteDeScanRng();

for (const f of staged) {
  const rel = f.replace(/\\/g, '/');
  // MÊME périmètre que la suite Vitest et le hook au stylo : `estFichierScanne` (source unique,
  // `commentPoison.mjs`), qui lit `PERIMETRE_DES_GARDES`.
  if (!estFichierScanne(rel)) continue;
  // Familles de COMMENTAIRES (tombale / excuse / vocabulaire de l'ancien état / revendications RAW / revendications d'autorité) : tests compris,
  // « le poison écrit dans un test est du poison » (commentPoison.mjs). Familles CODE (label-logic,
  // hardcode, emoji, seam de jet, rng) : leur périmètre canonique EXCLUT les fichiers de test — ce
  // sont eux qui plantent les FIXTURES littérales de ces gardes (label-logic-guard.test.ts EXCLUDED,
  // combat-hardcode-guard.test.ts EXCLUDED, roll-seam-exclusivity-guard.test.ts EXCLUDED,
  // no-emoji-affordance.test.ts EXCLUDED) — un fichier de test stagé ne doit PAS y rougir.
  const isTestFile = estFichierVitest(rel);
  const text = texteAJuger(rel);
  if (text === null) continue;
  scannedTs.push(rel);
  for (const x of scanTombstones(rel, text)) offenders.push(`${rel}:${x.line} [pierre tombale] ${x.detail}`);
  for (const x of scanExcuses(rel, text)) {
    if (EXCUSE_GUARD_ACTIVE) offenders.push(`${rel}:${x.line} [excuse sans tag] ${x.detail}`);
    else warnings.push({ file: rel, line: x.line, detail: `[excuse sans tag] ${x.detail}` });
  }
  // Famille (e) — #1486 (credo règle 1) : un mot qui nomme l'état d'avant bloque, où qu'il vive
  // (`src/**` comme `scripts/**`) ; les sites déjà recensés vivent au stock décroissant du test.
  for (const x of scanLegacyVocabHorsStock(rel, text))
    offenders.push(`${rel}:${x.line} [vocabulaire de l'ancien état] ${x.detail}`);
  for (const x of scanRawClaims(rel, text))
    warnings.push({ file: rel, line: x.line, detail: `[affirmation RAW non ancrée] ${x.detail}` });
  for (const x of scanDecisionClaims(rel, text))
    warnings.push({ file: rel, line: x.line, detail: `[revendication d'autorité sans trace] ${x.detail}` });
  if (!isTestFile && strictRe.test(rel)) {
    for (const x of scanLabelLogic(rel, text)) offenders.push(`${rel}:${x.line} [logique par label] ${x.detail}`);
    for (const x of scanLabelAsIdArg(rel, text, effectiveIdParamFns(text, ID_PARAM_FNS))) offenders.push(`${rel}:${x.line} [logique par label — id STABLE attendu] ${x.detail}`);
    // hardcode.mjs porte des BASELINES par-fichier (policy dans combat-hardcode-guard.test.ts, PAS
    // dupliquée ici) — un nouveau site réactif par-nom peut rester SOUS une baseline tolérée : simple
    // signal, la CI (cliquet complet) reste la porte bloquante pour cette famille.
    for (const x of scanHardcode(rel, text)) warnings.push({ file: rel, line: x.line, detail: `[hardcode réactif par-nom] ${x.detail}` });
  } else if (!isTestFile && ratchetRe.test(rel)) {
    // MÊME périmètre RATCHET que `label-logic-guard.test.ts` (STRICT_DIRS/RATCHET_DIRS/RATCHET_EXCEPTIONS
    // partagés via labelLogic.mjs) : un site nouveau dans src/gameIso|ui BLOQUE le commit sauf entrée
    // JUSTIFIÉE dans la MÊME table d'exceptions que le test — jamais un périmètre plus étroit ici.
    const idParamFns = effectiveIdParamFns(text, ID_PARAM_FNS);
    for (const x of [...scanLabelLogic(rel, text), ...scanLabelAsIdArg(rel, text, idParamFns)]) {
      if (!(ratchetShortKey({ rel, line: x.line }) in RATCHET_EXCEPTIONS))
        offenders.push(`${rel}:${x.line} [logique par label — hors exception ratchet] ${x.detail}`);
    }
  }
  // #142 — libellé porté par un champ AUTRE que `label` (`w.reach === 'Très longue'`) : même
  // stock PAR FICHIER que `label-logic-guard.test.ts` (`LABEL_LITERAL_STOCK`, partagé par la lib).
  // Le hook ne voit qu'un fichier à la fois : seul un compte SUPÉRIEUR au stock y bloque — le volet
  // « dette soldée non retirée » reste à la CI, qui scanne le corpus entier.
  if (!isTestFile && (strictRe.test(rel) || ratchetRe.test(rel))) {
    const n = scanLabelLiteralCompare(rel, text).length;
    if (n > (LABEL_LITERAL_STOCK[rel] ?? 0)) offenders.push(`${rel} [logique par LIBELLÉ] ${n} site(s), stock = ${LABEL_LITERAL_STOCK[rel] ?? 0}`);
  }
  // #1694 — retour d'APPEL comparé à un littéral FR (`rangeBandName(…) === 'Bout portant'`), stock
  // par fichier `LABEL_CALL_LITERAL_STOCK` : même double détente que ci-dessus, le volet « dette
  // soldée » restant à la CI (`label-logic-guard.test.ts`), qui scanne le corpus entier.
  if (!isTestFile && strictRe.test(rel)) {
    const n = scanCallResultLiteralCompare(rel, text).length;
    if (n > (LABEL_CALL_LITERAL_STOCK[rel] ?? 0)) offenders.push(`${rel} [retour d'appel comparé à un LIBELLÉ] ${n} site(s), stock = ${LABEL_CALL_LITERAL_STOCK[rel] ?? 0}`);
  }
  if (!isTestFile && /^src\/(ui|state|gameIso)\//.test(rel))
    for (const emoji of emojisIn(text)) offenders.push(`${rel} [emoji d'affordance] ${emoji}`);
  // #274 — exclusivité du seam de jet : rollTest(/d100(/TestOutcome.seal( hors whitelist (double
  // détente avec src/state/roll-seam-exclusivity-guard.test.ts, SOURCE UNIQUE de la whitelist).
  if (!isTestFile && !rollSeamExcluded(rel))
    for (const x of scanRollSeamExclusivity(rel, text)) offenders.push(`${rel}:${x.line} [seam de jet contourné] ${x.detail}`);
  // #370 — rng vivant → résolveur moteur : resolveXxx(…, battleRng()) hors whitelist (double détente
  // avec src/state/roll-seam-exclusivity-guard.test.ts, SOURCE UNIQUE de la whitelist).
  if (!isTestFile && !battleRngEngineLeakExcluded(rel))
    for (const x of scanBattleRngEngineLeak(rel, text, passageRng)) offenders.push(`${rel}:${x.line} [rng vivant → résolveur moteur] ${x.detail}`);
}

// #290 — emoji dans la DONNÉE (`src/scenes/**/*.json` + `src/data/*.json`) : même tolérance zéro que le code.
const emojiJsonStaged = staged.filter((f) => {
  const r = f.replace(/\\/g, '/');
  return /^src\/scenes\/.*\.json$/.test(r) || /^src\/data\/[^/]+\.json$/.test(r);
});
for (const f of emojiJsonStaged) {
  const rel = f.replace(/\\/g, '/');
  const text = texteAJuger(rel);
  if (text === null) continue;
  for (const emoji of emojisIn(text)) offenders.push(`${rel} [emoji d'affordance] ${emoji}`);
}

const dataStaged = staged.filter((f) => /^src\/data\/[^/]+\.json$/.test(f.replace(/\\/g, '/')));
if (dataStaged.length) {
  try {
    // Le consommateur EXIGE ses chemins en arguments et aucune sélection ne les borne : on le rejoue
    // par PAQUETS tenant sous les 32 k caractères d'argv de Windows (classe : `porteSpawn.mjs`).
    for (const paquet of paquetsDArgv(dataStaged)) {
      execFileSync(
        process.execPath,
        [TSX_CLI, join(ROOT, 'scripts', 'guards', 'validate-data.mts'), ...paquet],
        { cwd: ROOT, stdio: 'inherit' },
      );
    }
  } catch (e) {
    const panne = codeDePanne(e);
    offenders.push(panne
      ? `contrat de donnée — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué)`
      : 'contrat de donnée VIOLÉ (schéma zod, rapport ci-dessus) — corriger la donnée, jamais le contourner');
  }
}

// Tag [entériné] NOUVELLEMENT introduit dans le diff stagé : visibilité systématique (le tag est
// réservé à l'utilisateur, qui l'écrit lui-même ; ici on rend tout ajout VISIBLE).
const ajoutees = diffDeLIndex.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
const addedTags = ajoutees.filter((l) => /\[entériné[^\]]*\]/i.test(l));
if (addedTags.length) {
  process.stderr.write(`pre-commit — tag(s) [entériné] AJOUTÉ(s) par ce commit (mot réservé à l'utilisateur — vérifier que CHAQUE site a reçu sa validation) :\n${addedTags.map((l) => `  ${l.slice(0, 160)}`).join('\n')}\n`);
}

// #528 — package-lock.json amputé des entrées hoistées @emnapi/* par une régénération npm 11.
if (staged.some((f) => f.replace(/\\/g, '/') === 'package-lock.json')) {
  const lockText = texteAJuger('package-lock.json');
  if (lockText !== null) {
    for (const x of scanNpmLockHoisted(lockText)) offenders.push(`package-lock.json:${x.line} [lock npm amputé] ${x.detail}`);
  }
}

// Les chemins passés au garde sont SA sélection (`docsDePorte`), jamais le diff entier : 32 k caractères
// d'argv sous Windows, un gros renommage dépasse — `execFileSync` part alors en `ENAMETOOLONG` et le
// `catch` rendrait un verdict de doc pour une porte qui n'a jamais tourné (classe nommée et mesurée dans
// `scripts/guards/lib/porteSpawn.mjs`).
const docsPourLaPorte = docsDePorte(staged);
if (docsPourLaPorte.length) {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'docs', 'check-doc-refs.mjs')], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    const panne = codeDePanne(e);
    offenders.push(panne
      ? `docs:check — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué, pas le doc)`
      : 'docs:check en échec (référence vivante qui ment — corriger le doc ou le code, jamais commiter le mensonge)');
  }
  // Un doc GÉNÉRÉ stagé doit décrire l'arbre QUI PART au commit, pas le WIP d'une session voisine :
  // ses `fichier:ligne` et ses comptes d'inventaire sont confrontés à l'INDEX. Cette garde reste HORS
  // `docs:check` (qui tourne légitimement sur un arbre en vol) — c'est une porte de COMMIT.
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'docs', 'check-docs-vs-head.mjs'), ...docsPourLaPorte], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    const panne = codeDePanne(e);
    offenders.push(panne
      ? `docs-vs-commit — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué, pas le doc)`
      : 'docs-vs-commit en échec (doc généré qui décrit un arbre absent du commit — régénérer sur l’arbre stagé, ou stager le code décrit)');
  }
}

// #1679 L1b — EMPREINTE DE SOURCES des docs dérivés. UN déclencheur : un doc GÉNÉRÉ est stagé. Pour
// ce doc-là, les blobs figés dans son pied doivent être ceux de l'INDEX — sinon il décrit un arbre
// que ce commit n'embarque pas. Une SOURCE stagée sans régénération n'arme rien ici : le pied qu'elle
// périme porte un doc qui ne part pas dans ce commit, et armer sur les sources coûterait un
// `docs:build` à 59,3 % des commits (mesuré 2026-09-02) pour un pied re-signé UNE fois par train, à
// l'étape docs de `ops:publier`. La gate `docs:empreinte` reste la porte. Ce qui est joué ici ne
// régénère RIEN (recalcul sur l'index, `git ls-files -s`), contre 49,8 s pour la régénération des 13
// générateurs qu'un `src/data/*.json` arme (mesuré 2026-09-02).
// CHAÎNE DE CONFIANCE : `docs/.sources-lues.json` est lu ici dans l'ARBRE (il ne sert qu'à CHOISIR
// les générateurs), SANS être revérifié ; le VERDICT, lui, ne sort que de l'INDEX. Sa fraîcheur est
// gatée en CI par `docs:check:tout`, qui rejoue chaque générateur et compare la mesure au committé. DÉFAUT CONNU : s'il
// est illisible, la sélection rend une liste vide et la porte se tait ici — la CI reste le filet.
const sourcesLues = (() => {
  try { return JSON.parse(readFileSync(join(ROOT, 'docs', '.sources-lues.json'), 'utf8')); } catch { return {}; }
})();
const armes = (() => {
  try { return generateursArmes(sourcesLues, staged); } catch { return []; }
})();
if (armes.length) {
  try {
    // `armes` est une liste de NOMS de générateurs (bornée par `docs/.sources-lues.json`), pas le diff :
    // elle ne peut pas faire dépasser les 32 k caractères d'argv — le `catch` distingue quand même la
    // PANNE de spawn du verdict, pour ne jamais accuser un doc à la place d'un lancement raté.
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'docs', 'build-all.mjs'), '--empreinte', '--only', ...armes], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    const panne = codeDePanne(e);
    const cibles = ciblesDesArmes(sourcesLues, armes);
    offenders.push(panne
      ? `empreinte de sources — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué)`
      : `empreinte de sources en échec — ${cibles.join(', ')} décrit un arbre ≠ index : \`npm run docs:build\`, puis stage le(s) doc(s) avec les sources nommées ci-dessus`);
  }
}

// La garde des plans datés scanne TOUT fichier suivi (sens « référent → plan », par chemin ET par nom
// nu) : l'armer sur le seul stage d'un doc laissait passer le cas le plus courant — un commentaire de
// `.ts`/`.css` qui cite un plan. Elle coûte 4,8 s (mesuré), donc elle ne tourne pas à chaque commit :
// COMPROMIS retenu = déclencheur sur le DIFF STAGÉ, pas sur la liste des fichiers.
//   (a) un doc stagé, comme avant ;
//   (b) une ligne AJOUTÉE qui cite `docs/plans/` — le cas « je crée la référence », quel que soit le
//       fichier porteur ;
//   (c) une ligne AJOUTÉE qui NOMME un plan déjà supprimé (registre lu par `--registre`, 0,45 s) —
//       consulté uniquement si le diff ajoute un nom de fichier plausible, sinon on ne paie rien.
// Reste hors pre-commit (couvert par `npm run docs:check` et le canari) : une violation
// PRÉEXISTANTE d'un fichier que ce commit ne touche pas.
const citePlan = ajoutees.some((l) => l.includes('docs/plans/'));
const nommeUnFichier = ajoutees.some((l) => /[\w-]{3,}\.(?:md|html|png|json)\b/.test(l));
const citeUnMort = () => {
  if (!nommeUnFichier) return false;
  let registre;
  try {
    registre = execFileSync(process.execPath, [join(ROOT, 'scripts', 'docs', 'check-plans-anchors.mjs'), '--registre'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return false; }
  return ajoutees.some((l) => registre.some((mort) => l.includes(mort)));
};
if (docsPourLaPorte.length || citePlan || citeUnMort()) {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'docs', 'check-plans-anchors.mjs')], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    const panne = codeDePanne(e);
    offenders.push(panne
      ? `docs:check-plans — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué)`
      : "docs:check-plans en échec (plan daté sans ancre `Ticket:`/`Instrument:`, ou citation d'un plan supprimé — chemin ou nom nu)");
  }
}

// #487 — champ Implémente d'une fiche docs/raw ÉDITÉ à la main : le --check tourne UNIQUEMENT si une
// page de l'Atlas est stagée (coût borné à ce cas), même patron bloquant que ci-dessus. Les fiches
// vivent SOUS leur cœur (`docs/raw/<coeur>/<page>.md`, #1825) : le motif traverse les dossiers.
const rawFicheStaged = staged.some((f) => /^docs\/raw\/.+\.md$/.test(f.replace(/\\/g, '/')));
if (rawFicheStaged) {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'raw', 'build-implemente.mjs'), '--check'], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    const panne = codeDePanne(e);
    offenders.push(panne
      ? `raw:implemente — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué)`
      : 'raw:implemente --check en échec (champ Implémente périmé — relancer `npm run raw:implemente` et committer)');
  }
}

// #1679 L1b — `docs/doctrines.md` est DÉRIVÉ des fiches `.claude/memory/user-*.md` : le --check
// tourne dès qu'une fiche user-* ou le doc lui-même est stagé (même patron borné que #487 ci-dessus).
const doctrineStaged = staged.some((f) => {
  const r = f.replace(/\\/g, '/');
  return r === 'docs/doctrines.md' || /^\.claude\/memory\/user-[^/]+\.md$/.test(r);
});
if (doctrineStaged) {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'docs', 'build-doctrines.mjs'), '--check'], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    const panne = codeDePanne(e);
    offenders.push(panne
      ? `build-doctrines — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué)`
      : 'build-doctrines --check en échec (docs/doctrines.md périmé ou édité à la main — relancer `npm run docs:doctrines` et committer le résultat)');
  }
}

// FORME DU STOCK PERMANENT (scripts/guards/memoire-forme.mjs) : jugée sur ce que l'INDEX porte, pas
// sur l'arbre — même discipline que tous les scans ci-dessus. Périmètre borné par `familleDe`.
const formeStaged = staged.map((f) => f.replace(/\\/g, '/')).filter(familleDe);
if (formeStaged.length) {
  const parFichier = [];
  for (const rel of formeStaged) {
    const texte = texteAJuger(rel);
    if (texte === null) continue;
    const defauts = defautsDeForme(rel, texte);
    if (defauts.length) parFichier.push({ chemin: rel, defauts });
  }
  const raison = raisonDeRefusDeForme(parFichier);
  if (raison) offenders.push(raison);
}

// FINS DE LIGNE DE L'INDEX : un blob stagé porteur de `\r` sur un chemin que `.gitattributes` déclare
// `eol=lf` (scripts/guards/lib/eolStage.mjs). Lu sur l'INDEX (`--cached`), jamais sur le disque.
if (staged.length) {
  try {
    const entrees = paquetsDArgv(staged).flatMap((paquet) => eolsDe(depot, paquet));
    const raison = raisonDeRefusEol(cheminsMalNormalises(entrees));
    if (raison) offenders.push(raison);
  } catch (e) {
    offenders.push(`fins de ligne de l'index — porte en PANNE : ${codeDePanne(e) ?? e.message} (le garde n'a pas tourné)`);
  }
}

// #1082/#1128 — le compilé committé EST la compilation exacte du dessin committé : le --check tourne
// dès qu'un dessin d'atelier quadrupède (espèce à plat OU set sous atelier/harnais/) ou une sortie
// compilée (quadruped/*Compile.ts OU quadruped/harnais/*Compile.ts) est stagé, même patron bloquant.
const atelierQuadStaged = staged.some((f) => {
  const r = f.replace(/\\/g, '/');
  return r.startsWith('src/gameIso/rig/quadruped/atelier/') || /^src\/gameIso\/rig\/quadruped\/(?:harnais\/)?[^/]+Compile\.ts$/.test(r);
});
if (atelierQuadStaged) {
  try {
    execFileSync(
      process.execPath,
      [TSX_CLI, join(ROOT, 'scripts', 'rig', 'compile-dessin-quad.mts'), '--check'],
      { cwd: ROOT, stdio: 'inherit' },
    );
  } catch (e) {
    const panne = codeDePanne(e);
    offenders.push(panne
      ? `compile-dessin-quad — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué)`
      : "compile-dessin-quad --check en échec (dessin d'atelier et compilé désynchronisés — relancer `npx tsx scripts/rig/compile-dessin-quad.mts` et committer les deux)");
  }
}

// #641 — la suite `test:raw` (harnais de couverture Atlas, node --test) échappait au gate : un
// commit touchant scripts/raw/** ou docs/raw/** pouvait laisser test:raw rouge (vécu #604). Même
// patron diff-scopé bloquant que docs:check ci-dessus.
const rawInfraStaged = staged.some((f) => {
  const r = f.replace(/\\/g, '/');
  return /^scripts\/raw\//.test(r) || /^docs\/raw\//.test(r);
});
if (rawInfraStaged) {
  try {
    execFileSync('npm', ['run', 'test:raw'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  } catch (e) {
    const panne = codeDePanne(e);
    offenders.push(panne
      ? `test:raw — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué)`
      : 'npm run test:raw en échec (suite de couverture Atlas rouge — corriger, jamais committer le rouge)');
  }
}

// #1211 — même patron diff-scopé pour le kit de recette : la logique de survie au rechargement
// (classification CDP + rejeu, scripts/recette/lib.mjs) est couverte par `test:recette`.
const recetteInfraStaged = staged.some((f) => /^scripts\/recette\//.test(f.replace(/\\/g, '/')));
if (recetteInfraStaged) {
  try {
    execFileSync('npm', ['run', 'test:recette'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  } catch (e) {
    const panne = codeDePanne(e);
    offenders.push(panne
      ? `test:recette — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué)`
      : 'npm run test:recette en échec (kit de recette rouge — corriger, jamais committer le rouge)');
  }
}

// LINT du diff (≈ 4 s / 20 fichiers) : la CI joue `npm run lint` sur le dépôt entier, ce hook le joue
// sur les seuls stagés EXISTANTS — câblage et raisons dans `scripts/guards/lib/lintStage.mjs`.
const aLinter = fichiersALinter(staged, ROOT);
if (aLinter.length) {
  const { defauts } = lancerLint(ROOT, aLinter);
  for (const d of defauts) offenders.push(`${d.site} [lint ${d.gravite}] ${d.regle} — ${d.message}`);
}

try {
  execFileSync('npm', ['run', 'agents:check'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} catch (e) {
  const panne = codeDePanne(e);
  offenders.push(panne
    ? `agents:check — porte en PANNE : ${panne} (le garde n'a pas tourné : c'est le LANCEMENT qui a échoué)`
    : 'agents:check en échec (adaptateurs Claude/Codex divergents — lancer `npm run agents:sync`)');
}

// Canal non bloquant : la baseline nominative sépare le DÉJÀ TRANCHÉ (compact, une ligne par site)
// de ce qui arrive avec ce commit — c'est la ligne NOUVEAU qui doit sauter aux yeux. Une entrée de
// baseline sans site correspondant dans les fichiers scannés est signalée pour purge.
const verdict = partitionBaseline(warnings, loadDecisionsBaseline(), scannedTs);
const rapport = formatBaselineReport(verdict);
if (rapport.length) {
  process.stderr.write(`pre-commit — signaux de commentaires (non bloquant) :\n${rapport.map((l) => `  ${l}`).join('\n')}\n`);
}
process.stderr.write(`[pre-commit] ${staged.length} fichier(s) stagé(s), ${aLinter.length} linté(s) — ${((Date.now() - DEBUT_MS) / 1000).toFixed(1)} s\n`);
if (offenders.length) {
  process.stderr.write(`pre-commit REFUSÉ — poison détecté (mêmes gardes que la CI, cf. scripts/guards/lib/) :\n${offenders.map((o) => `  ${o}`).join('\n')}\n`);
  process.exit(1);
}
