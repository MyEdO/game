/**
 * REJEU DES MIGRATIONS (#1466 L1a) — `npm run migrations:replay`.
 *
 * Une migration de donnée est REJOUABLE : rejouée sur l'arbre courant, elle ne réécrit RIEN. Cette
 * porte le mesure pour de bon — les scripts de `scripts/migrations/*.mjs` sont rejoués DANS L'ORDRE
 * LEXICAL, EN PLACE dans la racine qu'on lui donne (ils lisent `src/data`, `src/scenes` et `Source/`
 * par leur propre chemin : la racine rejouée est celle de LEUR copie).
 *
 * DEUX ARBRES, DEUX MESURES, une même question (« le rejeu a-t-il écrit ? ») :
 *  - DANS UN DÉPÔT (`npm run migrations:replay`, job `migrations` de la CI) : `git diff` pour ce qui
 *    est SUIVI, `git status --porcelain` pour ce qui ne l'est pas — un fichier CRÉÉ par une migration
 *    est invisible à `git diff`, et le rejeu y serait aveugle ;
 *  - SUR UN EXPORT hors dépôt (`npm run migrations:replay:head`, hook pre-push — #1613) : l'EMPREINTE
 *    des fichiers du périmètre confrontée aux blobs de la tête (`lib/empreinteRejeu.mjs`). Là, git ne
 *    connaît aucune histoire : `mesurerParGit` y REFUSE de conclure (`estUnDepot`) au lieu de rendre
 *    le vert que `git diff` fabrique tout seul hors dépôt.
 *
 * Trois verdicts, aucun silence :
 *  - un script sans en-tête d'ENTRÉES (JSDoc « Entrées : … » — ce qu'il LIT) est ROUGE : une
 *    migration dont on ignore le périmètre de lecture ne se rejoue pas en confiance ;
 *  - tout exit non nul, ou toute donnée SUIVIE réécrite, est ROUGE ;
 *  - tout fichier NEUF apparu dans le périmètre pendant le rejeu est ROUGE et NOMMÉ.
 *
 * ENTRÉES : `scripts/migrations/*.mjs` (les migrations elles-mêmes) — le rejeu ne lit aucune donnée
 * de son propre chef, il délègue aux scripts.
 *
 * NOMMAGE DU LOT #1467 L1b : préfixe `<AAAA-MM-JJ>-l1b-<n><lettre>-<concept>.mjs`, la date étant
 * celle d'ÉCRITURE de la vague — elle ne se déduit ni du numéro ni de l'ordre.
 * L'ordre lexical NE SUIT PLUS le numéro de vague depuis la vague 10 : `10a`, `11a` trient AVANT
 * `6a`…`9c` (comparaison de chaînes, pas d'entiers).
 *
 * L'ORDRE EST PORTEUR dès que deux migrations écrivent le MÊME fichier, et c'est le cas des trois
 * migrations de FORME du document de projet (`…-3i-…` 3→4, `…-13-…` 4→5, `…-15b-…` 5→6), qui écrivent
 * toutes les quatre `src/scenes/<c>/<c>-projet.json`. Elles composent une CHAÎNE : chacune n'accepte
 * en entrée que le `schema` que la précédente rend. La CONDITION qui rend l'ordre lexical suffisant
 * est donc que, pour un même fichier, le tri lexical des noms coïncide avec l'ordre des bumps — ici
 * `3i < 13 < 15b`. Elle n'est PAS gratuite : jouée la première sur un document `schema: 3`, la 15b
 * sort 1 (mesuré, `src/scenes/migrations-format-projet.test.ts` cas `S4`). Ajouter une migration qui
 * touche un fichier déjà migré exige donc de VÉRIFIER ce tri, pas de le supposer. Pour tous les autres
 * scripts du lot, les fichiers écrits sont DISJOINTS et aucun ordre n'est requis.
 *
 * La porte ci-dessus rejoue dans l'ordre lexical, quel qu'il soit. Le NO-OP d'une migration se décide
 * sur le CARDINAL du geste qu'elle POSSÈDE : zéro geste à faire = rien n'est écrit et la sortie est 0,
 * quel que soit l'ordre des AUTRES clés du document (banc `lib/idempotence-ordre-des-cles.test.mjs`,
 * corpus entier renversé). Ce qu'une migration ne possède pas, elle le NOMME : un `id` hors tête sans
 * promotion déclarée est une anomalie, sortie 1 AVANT toute écriture. Toute migration qui sort non
 * nul rend le rejeu ROUGE.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

// eslint-disable-next-line no-irregular-whitespace
/** Bloc de commentaire d'en-tête d'un script (jusqu'au premier `*​/`). */
const enTete = (texte) => texte.slice(0, Math.max(0, texte.indexOf('*/')));

/** Le script DÉCLARE-t-il ses entrées ? (`Entrées :` ou `ENTRÉES (…)` dans son en-tête) */
const declareSesEntrees = (texte) => /ENTR[ÉE]ES?\s*[:(]/i.test(enTete(texte));

/**
 * Une migration se RECONNAÎT à son préfixe DATÉ (`<AAAA-MM-JJ>-….mjs`, la convention de nommage du
 * lot ci-dessus) — 88 des 90 `.mjs` du dossier.
 */
const estUneMigration = (nom) => /^\d{4}-\d{2}-\d{2}-.+\.mjs$/.test(nom);

/**
 * Les seuls `.mjs` du dossier qui ne sont PAS des migrations : les modules de cette porte. Liste
 * NOMINATIVE, et c'est le point — tout autre `.mjs` sans préfixe daté est ROUGE.
 *
 * Deux faux verts successifs ont fait cette règle, tous deux mesurés : sous `f !== 'replay.mjs'`,
 * `replay-head.mjs` était REJOUÉ comme une migration (rejeu récursif de 15,7 s dont l'exit 0 tenait
 * lieu de vert) ; sous le seul préfixe daté, une migration NON idempotente mal nommée
 * (`corrige-props.mjs`) était SAUTÉE en silence — « 0 migration(s) », verdict VERT. Ni jouer ce
 * qu'on ne sait pas nommer, ni le taire.
 */
const MODULES_DE_LA_PORTE = ['replay.mjs', 'replay-head.mjs', 'replay-croissance.mjs'];

/** Périmètre ÉCRIT par les migrations : les deux racines de documents, l'AUTHORING qui produit
 *  les artefacts de scène (`scripts/arene` + les générateurs des deux campagnes navales et leur lib
 *  partagée, écrits par `give-trapping` et `give-money-enveloppe` — migrer l'artefact sans sa source
 *  serait une demi-migration : les trois projets sont régénérés À L'OCTET par leur `generate.mjs`),
 *  et l'OUTILLAGE de l'Atlas (`scripts/raw`), dont les stocks nominatifs sont de la donnée keyée par
 *  chemin de page : une migration qui les réécrit à chaque passage doit être vue ici.
 *  Deux lecteurs, aucune recopie : la mesure par git ci-dessous et l'empreinte de `replay-head.mjs`.
 *
 *  Ce périmètre ne se DÉRIVE PAS de l'en-tête `ENTRÉES` des migrations, mesuré sur tous les scripts
 *  du dossier : cet en-tête est de la PROSE (globs « `src/data/*.json` (tous les datasets) », comptes
 *  « les 4 `src/scenes/<campagne>/<campagne>-projet.json` », renvois « les deux racines de documents »,
 *  « le dossier d'extraction qu'il déclare ») et il mêle ce qui est LU à ce qui est ÉCRIT (`declareSesEntrees`
 *  ne teste que la PRÉSENCE du bloc). En tirer un périmètre d'écriture demanderait de deviner à la fois
 *  les chemins et leur sens — une mesure fausse serait pire que celle-ci, qui est bornée et explicite. */
export const PERIMETRE = ['src/data', 'src/scenes', 'scripts/arene', 'scripts/barge-du-sel', 'scripts/loup-et-saumure', 'scripts/campagne', 'scripts/raw'];

/**
 * `racine` est-elle DANS un arbre de travail git ?
 *
 * Le seul détecteur fiable, et la raison pour laquelle il existe : hors dépôt, `git diff --exit-code
 * -- <a> <b> …` ne se plaint pas — il bascule en `--no-index`, compare les deux premiers chemins et
 * prend le reste en pathspec ; aucun de ceux-là n'existant, il rend **0**, soit « rien n'a bougé »
 * sur un arbre pourtant réécrit (mesuré ; `rev-parse` y rend 128).
 * @param {string} racine @returns {boolean}
 */
export function estUnDepot(racine) {
  const vu = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: racine, encoding: 'utf8' });
  return vu.status === 0 && (vu.stdout ?? '').trim() === 'true';
}

/**
 * Fichiers NEUFS (non suivis, `??` de `git status --porcelain`) du périmètre, dans `cwd`.
 *
 * `git diff` ne voit QUE le suivi : une migration qui CRÉE un document à chaque passage y est
 * parfaitement invisible. Ce relevé est la seconde moitié de la mesure d'idempotence.
 * @param {string} cwd racine du dépôt à mesurer
 * @param {readonly string[]} perimetre chemins passés en pathspec à `git status`
 * @returns {string[]} chemins relatifs, dans l'ordre rendu par git
 */
export function neufsDe(cwd, perimetre) {
  const r = spawnSync('git', ['status', '--porcelain', '--', ...perimetre], { cwd, encoding: 'utf8' });
  return (r.stdout ?? '')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('?? '))
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
}

/**
 * JOUE les migrations de `dossier` sur l'arbre `racine`, dans l'ordre lexical. Ne mesure RIEN : le
 * verdict d'idempotence appartient à l'appelant — `mesurerParGit` dans un dépôt, l'empreinte sur un
 * export. Les deux racines se séparent pour que le MÊME rejeu serve les deux arbres.
 * @param {{ racine: string, dossier?: string, ecrire?: (ligne: string) => void }} params
 * @returns {{ rouges: string[], joues: number }}
 */
export function rejouer({ racine, dossier = join(racine, 'scripts', 'migrations'), ecrire = console.log }) {
  let entrees;
  try {
    entrees = readdirSync(dossier).filter((f) => f.endsWith('.mjs'));
  } catch (e) {
    return { rouges: [`dossier de migrations illisible : ${dossier} (${e.code ?? e.message})`], joues: 0 };
  }
  const scripts = entrees.filter(estUneMigration).sort((a, b) => a.localeCompare(b, 'en'));
  const horsRejeu = entrees.filter((f) => !estUneMigration(f)).sort((a, b) => a.localeCompare(b, 'en'));
  const outils = horsRejeu.filter((f) => MODULES_DE_LA_PORTE.includes(f));
  const inclassables = horsRejeu.filter((f) => !MODULES_DE_LA_PORTE.includes(f));

  /** @type {string[]} */
  const rouges = [];
  ecrire(`migrations:replay — ${scripts.length} migration(s), ordre lexical, EN PLACE dans ${racine}`);
  if (outils.length) ecrire(`  (hors rejeu, modules de la porte : ${outils.join(', ')})`);
  for (const f of inclassables) {
    ecrire(`  ✗ ${f} — .mjs du dossier des migrations SANS préfixe daté — ni migration, ni module de la porte`);
    rouges.push(`${f} : .mjs du dossier des migrations sans préfixe daté — ni migration, ni module de la porte`);
  }

  for (const f of scripts) {
    const texte = readFileSync(join(dossier, f), 'utf8');
    if (!declareSesEntrees(texte)) {
      ecrire(`  ✗ ${f} — en-tête SANS « Entrées : » (ce que le script LIT)`);
      rouges.push(`${f} : en-tête sans déclaration d'ENTRÉES`);
      continue;
    }
    const debut = Date.now();
    const r = spawnSync(process.execPath, [join(dossier, f)], { cwd: racine, encoding: 'utf8' });
    const secondes = ((Date.now() - debut) / 1000).toFixed(1);
    const ok = r.status === 0;
    ecrire(`  ${ok ? '✓' : '✗'} ${f} — exit ${r.status} (${secondes}s)`);
    if (ok) continue;
    const queue = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split(/\r?\n/).slice(-8).join('\n      ');
    ecrire(`      ${queue}`);
    rouges.push(`${f} : exit ${r.status}`);
  }
  return { rouges, joues: scripts.length };
}

/**
 * Mesure « le rejeu a-t-il écrit ? » DANS UN DÉPÔT, par les deux voies de git : `git diff` pour le
 * suivi, `git status` pour le reste. `diffAvant`/`neufsAvant` = l'état relevé AVANT le rejeu : ce que
 * l'arbre portait déjà (WIP d'une autre session) n'est pas imputable aux migrations.
 *
 * Hors dépôt, cette mesure REFUSE de conclure : rouge NOMMÉ, jamais un « INCHANGÉ » de complaisance.
 * @param {{ racine: string, perimetre?: readonly string[], diffAvant: string, neufsAvant: Set<string> }} params
 * @returns {{ rouges: string[], lignes: string[] }}
 */
export function mesurerParGit({ racine, perimetre = PERIMETRE, diffAvant, neufsAvant }) {
  if (!estUnDepot(racine)) {
    const motif =
      `mesure git impossible : ${racine} n’est pas un dépôt — un arbre exporté se mesure par EMPREINTE ` +
      '(scripts/migrations/lib/empreinteRejeu.mjs, `npm run migrations:replay:head`)';
    return { rouges: [motif], lignes: [motif] };
  }

  /** @type {string[]} */
  const rouges = [];
  /** @type {string[]} */
  const lignes = [];
  const diffApres = spawnSync('git', ['diff', '--exit-code', '--', ...perimetre], { cwd: racine, encoding: 'utf8' });
  const stat = () => spawnSync('git', ['diff', '--stat', '--', ...perimetre], { cwd: racine, encoding: 'utf8' }).stdout ?? '';

  if (diffApres.status === 0) {
    lignes.push(`\ngit diff --exit-code -- ${perimetre.join(' ')} : rien n’a bougé`);
  } else if (diffApres.stdout === diffAvant) {
    // L'arbre portait DÉJÀ ce diff avant le rejeu (WIP d'une autre session, édition en cours) : le
    // rejeu, lui, n'a rien écrit. En CI l'arbre est propre et `--exit-code` suffit ; ici on mesure la
    // DELTA, seule chose que ce script a le droit d'imputer aux migrations.
    lignes.push(
      `\ngit diff -- ${perimetre.join(' ')} : INCHANGÉ par le rejeu (l’arbre portait déjà ce diff — WIP hors rejeu) :`,
      stat(),
    );
  } else {
    lignes.push('\nDONNÉE RÉÉCRITE par le rejeu — une migration n’est pas idempotente :', stat());
    rouges.push(`git diff : ${perimetre.join('/')} réécrits par le rejeu`);
  }

  const apparus = neufsDe(racine, perimetre).filter((f) => !neufsAvant.has(f));
  if (apparus.length) {
    lignes.push('\nFICHIER(S) NEUF(S) créé(s) par le rejeu — invisibles à `git diff` :', ...apparus.map((f) => `  + ${f}`));
    rouges.push(`git status : ${apparus.length} fichier(s) NEUF(S) créé(s) par le rejeu (${apparus.join(', ')})`);
  } else {
    lignes.push(`git status --porcelain -- ${perimetre.join(' ')} : aucun fichier NEUF créé par le rejeu`);
  }
  return { rouges, lignes };
}

function main() {
  /** État du diff AVANT le rejeu : ce que l'arbre portait déjà n'est pas imputable aux migrations. */
  const diffAvant = spawnSync('git', ['diff', '--', ...PERIMETRE], { cwd: RACINE, encoding: 'utf8' }).stdout;
  /** Idem pour les fichiers NEUFS : un WIP voisin non suivi n'est pas l'œuvre du rejeu. */
  const neufsAvant = new Set(neufsDe(RACINE, PERIMETRE));

  const { rouges } = rejouer({ racine: RACINE });
  const mesure = mesurerParGit({ racine: RACINE, perimetre: PERIMETRE, diffAvant, neufsAvant });
  for (const ligne of mesure.lignes) console.log(ligne);
  rouges.push(...mesure.rouges);

  if (rouges.length) {
    console.error(`\nmigrations:replay ROUGE (${rouges.length}) :\n  - ${rouges.join('\n  - ')}`);
    process.exit(1);
  }
  console.log('migrations:replay — OK');
}

// Le module est IMPORTABLE (la garde de `neufsDe` le monte, comme `replay-head.mjs` et le pre-push) :
// le rejeu ne part que si ce fichier est le point d'entrée du process.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
