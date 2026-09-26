// Hook PostToolUse(Write|Edit) : la porte AU STYLO — rejoue les gardes anti-poison sur le fichier
// que la session vient d'écrire et renvoie les trouvailles dans SON contexte, pendant qu'elle a
// encore tout le fil. Non bloquant (le blocage vit au pre-commit et en CI — mêmes libs, mêmes
// verdicts). Mécanique partagée : scripts/guards/lib/ (source unique avec les tests Vitest).
//
// Second volet, sur .claude/** et docs/** : le POINTEUR DÉRÉFÉRENCÉ — une ligne écrite qui cite un
// ticket par son seul numéro. « #1463 » ne se lit pas : le lecteur suivant (ou la session suivante)
// doit ouvrir GitHub pour savoir de quoi il s'agit, et la note devient inerte au premier oubli.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanTombstones, scanExcuses, scanRawClaims, scanDecisionClaims, scanLegacyVocabHorsStock, EXCUSE_GUARD_ACTIVE,
  estFichierScanne, loadDecisionsBaseline, partitionBaseline, formatBaselineReport,
} from '../guards/lib/commentPoison.mjs';
import { scanLabelLogic } from '../guards/lib/labelLogic.mjs';
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs';
import { cheminDEcriture } from './solde-ticket-guard.mjs';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

let entree = {};
try { entree = JSON.parse(raw)?.tool_input ?? {}; } catch { /* stdin illisible → silence */ }
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Chemin RÉEL RELATIF à la racine de l'arbre git qui CONTIENT le fichier (`cheminDEcriture`, un
// relatif se résout contre la racine de ce hook) : périmètre, lecture et message se jugent sur lui,
// jamais sur le chemin brut — un worktree lié vit lui-même sous `.claude/worktrees/`, et tout fichier
// y passerait pour une note suivie. Hors du contenu versionné (`horsContenu`), le hook se tait — jugé
// à la sortie, pour que le spawn git ne se paie que si un volet a trouvé quelque chose.
const chemin = cheminDEcriture(entree, { base: root });
if (chemin === null) process.exit(0);
const rel = chemin.relatif;
// MÊME périmètre que la suite Vitest et le pre-commit : `estFichierScanne` (source unique,
// `commentPoison.mjs`) — les deux racines, les quatre extensions, tests compris.
const isSrcTs = estFichierScanne(rel);

/** Tout ce qui part en contexte, tous volets confondus (une seule sortie JSON par appel). */
const sortie = [];

if (isSrcTs) {
  let text;
  try { text = readFileSync(chemin.reel, 'utf8'); } catch { text = ''; }
  if (text) {
    const lines = [];
    for (const f of scanTombstones(rel, text))
      lines.push(`POISON pierre tombale (règle 6c, tolérance zéro) — ${rel}:${f.line} ${f.detail}`);
    for (const f of scanExcuses(rel, text))
      lines.push(`${EXCUSE_GUARD_ACTIVE ? 'POISON' : 'ALERTE'} commentaire-excuse sans tag [entériné AAAA-MM-JJ] (règle 6b) — ${rel}:${f.line} ${f.detail}`);
    // Famille (e) — #1486 : un mot qui nomme l'état d'avant se solde par la mort du site (stock
    // nominatif décroissant `legacyVocabStock.mjs`), ou par un tag `[entériné]` de l'utilisateur.
    for (const f of scanLegacyVocabHorsStock(rel, text))
      lines.push(`POISON vocabulaire de l'ancien état (credo règle 1, #1486) — ${rel}:${f.line} ${f.detail}`);
    // Familles 3 et 4 : le canal ALERTE passe par la baseline nominative — un site déjà tranché
    // (decisions-baseline.json) sort en une ligne compacte, la trouvaille NOUVELLE garde sa consigne.
    const signaux = [
      ...scanRawClaims(rel, text).map((f) => ({
        file: rel, line: f.line,
        detail: `${f.detail} → ouvre le Source : cite la réf dans CE commentaire, ou reformule en réf nue. Une thèse RAW non sourcée d'agent est du poison présumé.`,
      })),
      ...scanDecisionClaims(rel, text).map((f) => ({
        file: rel, line: f.line,
        detail: `${f.detail} → une revendication se TRACE (tag [entériné AAAA-MM-JJ] validé par l'utilisateur) ou n'existe pas. Sans trace = justification fallacieuse présumée.`,
      })),
    ];
    const verdict = partitionBaseline(signaux, loadDecisionsBaseline(), [rel]);
    // Ce qui appelle un geste (NOUVEAU, entrée de baseline périmée) rejoint les lignes à traiter ;
    // le rappel des sites tenus pour intentionnels sort à part, sans consigne de correction.
    lines.push(...formatBaselineReport({ ...verdict, connus: [] }));
    const rappelBaseline = formatBaselineReport({ nouveaux: [], connus: verdict.connus, perimees: [] });
    // Même exclusion que label-logic-guard.test.ts (EXCLUDED) et le pre-commit : un fichier de test
    // plante les FIXTURES littérales de ce garde, il ne doit pas y rougir.
    if (/^src\/(engine|state)\//.test(rel) && !estFichierVitest(rel))
      for (const f of scanLabelLogic(rel, text))
        lines.push(`POISON logique par label (#142, id STABLE seulement) — ${rel}:${f.line} ${f.detail}`);
    if (lines.length)
      lines.push('→ Corrige AVANT de poursuivre : le pre-commit et la CI portent les MÊMES gardes et refuseront.');
    sortie.push(...lines, ...rappelBaseline);
  }
}

/** Une note documentaire ou de mémoire : le pointeur nu s'y lit sans son ticket. */
const estNoteSuivie = /^(\.claude|docs)\//.test(rel);
/** Un titre sur la MÊME ligne : guillemets (droits, français), ou parenthèse explicative. */
const PORTE_UN_TITRE = /["“”«»()]/;
/** Un numéro de ticket cité seul (jamais dans une URL, un chemin ou une ancre `issuecomment-…`). */
const POINTEUR_NU = /(^|[\s(,;:[])#\d+/;
const MAX_POINTEURS = 3;

if (estNoteSuivie) {
  const neuf = entree.new_string ?? entree.new_text ?? entree.content;
  const ancien = new Set(String(entree.old_string ?? entree.old_text ?? '').split(/\r?\n/).map((l) => l.trim()));
  const nues = typeof neuf === 'string'
    ? neuf.split(/\r?\n/).filter((l) => !ancien.has(l.trim()) && POINTEUR_NU.test(l) && !PORTE_UN_TITRE.test(l))
    : [];
  if (nues.length > 0) {
    sortie.push(
      `POINTEUR DÉRÉFÉRENCÉ (${nues.length} ligne(s) écrite(s) dans ${rel}) : un numéro de ticket seul ` +
      'ne se lit pas — recoller le TITRE sur la même ligne (`gh issue view <N> --json title`), sinon la ' +
      'note est inerte pour qui la relit.',
      ...nues.slice(0, MAX_POINTEURS).map((l) => `  ${l.trim().slice(0, 120)}`),
    );
  }
}

if (sortie.length && !chemin.horsContenu) {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: sortie.join('\n') },
  }));
}
