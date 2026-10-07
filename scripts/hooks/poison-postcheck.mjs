// Garde PostToolUse des canaux d'écriture (`OUTILS_ECRITURE`) : la porte AU STYLO — rejoue les gardes anti-poison sur le fichier
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
import { contexteDeLaGarde, corpusDeLaGarde, estDansLeCorpus, scanLabelLogicFichier } from '../guards/lib/labelLogic.mjs';
import { OUTILS_ECRITURE, cheminDEcriture, ecrituresDe, texteAvant, texteNeuf } from '../guards/lib/contratGarde.mjs';
import { INDEX, depotDe, lireEnLot } from '../guards/lib/gitPorte.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Une note documentaire ou de mémoire : le pointeur nu s'y lit sans son ticket. */
const NOTE_SUIVIE = /^(\.claude|docs)\//;
/** Un titre sur la MÊME ligne : guillemets (droits, français), ou parenthèse explicative. */
const PORTE_UN_TITRE = /["“”«»()]/;
/** Un numéro de ticket cité seul (jamais dans une URL, un chemin ou une ancre `issuecomment-…`). */
const POINTEUR_NU = /(^|[\s(,;:[])#\d+/;
const MAX_POINTEURS = 3;

/** Les trouvailles des gardes de commentaire sur le fichier `rel` écrit (volet 1). */
async function voletPoison(rel, reel) {
  // Clôture statique chargeable sous un Node refusé : scripts/node-requis.mjs (#1801).
  const {
    scanTombstones, scanExcuses, scanRawClaims, scanDecisionClaims, scanLegacyVocabHorsStock, EXCUSE_GUARD_ACTIVE,
    estFichierScanne, loadDecisionsBaseline, partitionBaseline, formatBaselineReport,
  } = await import('../guards/lib/commentPoison.mjs');
  // MÊME périmètre que la suite Vitest et le pre-commit : `estFichierScanne` (source unique,
  // `commentPoison.mjs`), qui lit `PERIMETRE_DES_GARDES`.
  if (!estFichierScanne(rel)) return [];
  let text;
  try { text = readFileSync(reel, 'utf8'); } catch { text = ''; }
  if (!text) return [];
  const lines = [];
  for (const f of scanTombstones(rel, text))
    lines.push(`POISON pierre tombale (règle 6, tolérance zéro) — ${rel}:${f.line} ${f.detail}`);
  for (const f of scanExcuses(rel, text))
    lines.push(`${EXCUSE_GUARD_ACTIVE ? 'POISON' : 'ALERTE'} commentaire-excuse sans tag [entériné AAAA-MM-JJ] (règle 6) — ${rel}:${f.line} ${f.detail}`);
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
  // Garde « logique par libellé » : la composition de la lib (`scanLabelLogicFichier`, corpus
  // `estDansLeCorpus`), celle du test ; seuls les sites `nu` (ni couture, ni dette
  // au stock) sont signalés. Le contexte inter-fichiers ne se lit que pour un fichier du corpus.
  if (estDansLeCorpus(rel))
    for (const f of scanLabelLogicFichier(rel, text, contexteDeLaGarde(corpusDeLaGarde())).filter((s) => s.statut === 'nu'))
      lines.push(`POISON logique par libellé (#142, id STABLE seulement) [${f.rule}] — ${rel}:${f.line} ${f.detail}`);
  if (lines.length)
    lines.push('→ Corrige AVANT de poursuivre : la CI porte les MÊMES gardes et refusera.');
  return [...lines, ...rappelBaseline];
}

/** Le fichier tel que l'INDEX le porte (`''` hors dépôt, absent, ou git indisponible) : en PostToolUse
 *  le disque porte déjà l'écriture, l'index porte l'avant. */
function texteDeLIndex(chemin) {
  if (chemin.racine === null) return '';
  try {
    return lireEnLot(depotDe(chemin.racine, { enPanne: () => {} }), INDEX, [chemin.relatif]).get(chemin.relatif) ?? '';
  } catch {
    return '';
  }
}

/** Les pointeurs nus que l'écriture AJOUTE à une note suivie (volet 2), jugée contre son texte AVANT
 *  (`texteAvant`, sur l'index). */
function voletPointeurs(chemin, ecrit) {
  const rel = chemin.relatif;
  if (!NOTE_SUIVIE.test(rel)) return [];
  const neuf = texteNeuf(ecrit);
  const ancien = new Set(String(texteAvant(ecrit, () => texteDeLIndex(chemin))).split(/\r?\n/).map((l) => l.trim()));
  const nues = typeof neuf === 'string'
    ? neuf.split(/\r?\n/).filter((l) => !ancien.has(l.trim()) && POINTEUR_NU.test(l) && !PORTE_UN_TITRE.test(l))
    : [];
  if (nues.length === 0) return [];
  return [
    `POINTEUR DÉRÉFÉRENCÉ (${nues.length} ligne(s) écrite(s) dans ${rel}) : un numéro de ticket seul ` +
    'ne se lit pas — recoller le TITRE sur la même ligne (`gh issue view <N> --json title`), sinon la ' +
    'note est inerte pour qui la relit.',
    ...nues.slice(0, MAX_POINTEURS).map((l) => `  ${l.trim().slice(0, 120)}`),
  ];
}

/** Les trouvailles pour UNE écriture (`ecrituresDe`), `null` sans trouvaille. */
async function trouvailles(ecrit) {
  // Chemin RÉEL RELATIF à la racine de l'arbre git qui CONTIENT le fichier (`cheminDEcriture`, un
  // relatif se résout contre la racine de ce hook) : périmètre, lecture et message se jugent sur lui,
  // jamais sur le chemin brut — un worktree lié vit lui-même sous `.claude/worktrees/`, et tout fichier
  // y passerait pour une note suivie. Hors du contenu versionné (`horsContenu`), la garde se tait — jugé
  // à la sortie, pour que le spawn git ne se paie que si un volet a trouvé quelque chose.
  const chemin = cheminDEcriture(ecrit, { base: root });
  if (chemin === null) return null;
  const sortie = [...await voletPoison(chemin.relatif, chemin.reel), ...voletPointeurs(chemin, ecrit)];
  return sortie.length && !chemin.horsContenu ? { contexte: sortie.join('\n') } : null;
}

const evaluer = (entree) => Promise.all(ecrituresDe(entree).map(trouvailles));

export const garde = { nom: 'poison-postcheck', outils: OUTILS_ECRITURE, evaluer };
