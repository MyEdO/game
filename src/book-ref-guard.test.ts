import { analyserCorpus, avecAnalyse } from '../scripts/guards/lib/dialecte.mjs';
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import * as ts from 'typescript/unstable/ast';
import type { Checker } from 'typescript/unstable/sync';
import { contexteImports, liaisonImportee, type ContexteImports } from '../scripts/guards/lib/canonUnique.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { alternationDuRegistre, REGISTRE_LIVRES } from '../scripts/guards/lib/rawRefIntegrity.mjs';
import { garanti } from './lib/garanti';
import { HOTES_DU_NOYAU, dossierDe, porteeDeGarde } from '../scripts/guards/lib/couches.mjs';

/**
 * Garde-fou « réf de livre hors surface Codex » (#601, même classe que #596).
 *
 * Une référence de livre (`LDB 23 l.141`, `MDG 12`…) est une information d'AUTEUR : elle a sa place
 * dans un commentaire (AGENTS.md règle 6 : la réf NUE y fait foi), dans la donnée (`source: {book,
 * page}`), et sur les surfaces qui CITENT leur source — le Codex/Compendium, où `CodexRef` la rend
 * lui-même en pied de popover. Elle n'a AUCUNE place sur une surface de JEU : le joueur n'ouvre pas
 * le livre, et une réf affichée doit être LIÉE à la règle qu'elle cite — via `CodexRef` vers une
 * entrée RÉELLE du Codex, jamais une réf en dur ni un ornement (#492).
 *
 * STRUCTURELLE, pas un grep : on lit l'AST TypeScript et on n'inspecte que les nœuds RENDUS
 * (littéraux de chaîne, texte JSX, morceaux de gabarit). Les commentaires sont de la trivia — ils
 * ne sont jamais visités, donc jamais faussement accusés.
 *
 * Le texte joueur (catalogue `t()`, journal du noyau) est balayé au même détecteur,
 * par périmètre (`PERIMETRES_DE_JEU`, #3059). `src/data` n'en est pas : ses textes à réf sont des
 * descriptions de schéma (`hint`, `describe`, `refine`), lues par les seuls écrans d'AUTORING.
 *
 */

/**
 * `abbr` d'un livre du registre (`src/data/books.json`) suivi d'un numéro de chapitre/fiche.
 *
 * L'alternation n'est PAS écrite ici : elle vient de `scripts/raw/_lib.mjs`
 * (`alternationDuRegistre`), servie à `src/**` par la couture typée `rawRefIntegrity.mjs`. Un
 * livre de plus est UNE entrée de `books.json`, zéro ligne ici (#1825, #1826). Le tri est par
 * longueur décroissante : un sigle préfixe d'un autre ne masque pas le plus long.
 *
 * POPULATION : TOUT livre du registre porteur d'un `abbr`, extrait ou non — un livre qu'aucune
 * extraction ne couvre se cite quand même sur un écran. (La population VOISINE, `allAbbrAlternation`,
 * ne retient que les livres EXTRAITS : c'est celle de l'Atlas, qui doit pouvoir OUVRIR le chapitre.)
 *
 * CE QUI RESTE HORS GARDE : un livre du registre SANS `abbr` (aucun aujourd'hui, asséré plus bas) ;
 * un livre nommé par son TITRE et non par son sigle ; une réf de ligne nue (`l.141`) ; un sigle
 * seul HORS parenthèses (deux lettres en capitales sont aussi un mot) ; et tout ce qui n'est pas
 * un nœud RENDU.
 *
 * DEUX formes : le sigle suivi d'un numéro, et le sigle SEUL entre parenthèses — l'apposition par
 * laquelle une phrase de jeu cite sa source sans chapitre.
 */
const SIGLES = alternationDuRegistre();
const BOOK_REF = new RegExp(`\\b(${SIGLES})\\s+\\d+|\\((?:${SIGLES})\\)`);

/**
 * Le Codex cite ses sources dans sa projection au noyau (`src/noyau/codex/`, #3059). Les libellés
 * de fiche au catalogue portent le préfixe `codex.fiche.` (`registry.ts`).
 */
const CODEX_DU_NOYAU = `${dossierDe('noyau')}/codex/`;
const CLES_DU_CODEX = 'codex.fiche.';

/**
 * PUITS DE DIAGNOSTIC — `throw`, `new …Error(…)`, `console.*(…)` et `garanti` (`src/lib/garanti.ts` : « un
 * défaut interne […] — jamais un affichage »). Leur texte n'est pas muet : un `throw` du noyau remonte
 * au CANAL DE DÉFAUT des hôtes — `envoyerLIntention` (`src/hote/geste.ts:184`) le relaie en
 * `ErreurDeGeste` « `<verbe>` a levé : … », que le serveur texte (`hotes/texte/serveur.ts:69`) et le
 * pont Godot (`hotes/godot/pont/pont.ts:170`) rendent. Ce canal porte une VIOLATION D'INVARIANT (un
 * producteur qui manque à sa garantie, une forme impossible), pas une phrase de jeu : le refus qu'un
 * joueur doit lire passe par le catalogue (`t()`, balayé sans dispense) ou par l'`ErreurDeGeste` que
 * l'hôte compose lui-même (périmètre `hôtes`, balayé sans dispense). La dispense est donc juste pour
 * `noyau` et `engine`.
 */
function estPuitsDeDiagnostic(node: ts.Node, sf: ts.SourceFile): boolean {
  if (ts.isThrowStatement(node)) return true;
  if (ts.isNewExpression(node)) return /Error$/.test(node.expression.getText(sf));
  if (!ts.isCallExpression(node)) return false;
  const appele = node.expression;
  if (ts.isIdentifier(appele)) return appele.text === garanti.name;
  return ts.isPropertyAccessExpression(appele) && ts.isIdentifier(appele.expression) && appele.expression.text === 'console';
}

/** Un argument direct d'une assertion Node porte une attente de test. Les expressions imbriquées
 *  restent parcourues et le checker distingue l'import d'un homonyme local. */
function estTexteDAssertion(node: ts.Node, sf: ts.SourceFile, imports: ContexteImports): boolean {
  const appel = node.parent;
  if (!appel || !ts.isCallExpression(appel) || !appel.arguments.some((arg) => arg === node)) return false;
  const appele = appel.expression;
  const parMembre = ts.isPropertyAccessExpression(appele);
  const recepteur = parMembre ? appele.expression : appele;
  if (!ts.isIdentifier(recepteur)) return false;
  const origine = liaisonImportee(recepteur, sf, imports);
  if (!origine || (origine.spec !== 'node:assert' && origine.spec !== 'node:assert/strict')) return false;
  return parMembre ? ['*', 'default', 'strict'].includes(origine.nom) : origine.nom !== '*';
}

/** Nœuds RENDUS uniquement — les commentaires sont de la trivia ; `horsDiagnostic` taille
 *  les puits de diagnostic (`estPuitsDeDiagnostic`). */
function renderedBookRefs(sf: ts.SourceFile, checker: Checker | undefined, horsDiagnostic = false): { line: number; text: string }[] {
  const hits: { line: number; text: string }[] = [];
  const imports = contexteImports(sf, checker);
  const visit = (node: ts.Node): void => {
    if (horsDiagnostic && estPuitsDeDiagnostic(node, sf)) return;
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && node.name.text.startsWith(CLES_DU_CODEX)) return;
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    if (text && BOOK_REF.test(text) && !estTexteDAssertion(node, sf, imports)) {
      hits.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: text.trim().slice(0, 120) });
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return hits;
}

function refsDuTexte(rel: string, text: string, horsDiagnostic = false) {
  return avecAnalyse({ rel, text }, undefined, undefined, (sf, checker) => renderedBookRefs(sf, checker, horsDiagnostic));
}

/**
 * LES PÉRIMÈTRES DE JEU (#3059).
 *
 * `src/i18n/messages/**` : le CATALOGUE du texte joueur (`t()`), journal, refus, détails d'option.
 * Garde ABSOLUE : aucune clé du catalogue n'est rendue par une surface qui cite sa source — le Codex
 * rend la sienne par `CodexRef`, depuis la donnée (`source`), jamais depuis une clé. Le jour où une
 * telle clé naîtrait, sa dispense serait un PRÉFIXE de clé ou un module de catalogue dédié (décision de
 * périmètre), jamais une liste de clés.
 *
 * `src/noyau/**`, `src/engine/**` : les couches qui écrivent au journal (`ecrireAuJournal`, `tell`,
 * conséquences, détails d'option) sans passer par le catalogue ; leurs puits de diagnostic sont taillés.
 *
 * Les hôtes du noyau (`HOTES_DU_NOYAU` : les zones bâties sur les droits d'un hôte ou d'un projet) que l'arbre porte,
 * où le `throw new ErreurDeGeste` EST le texte rendu au joueur : aucun puits n'y est taillé.
 *
 * `src/scenes/test-scenarios/**` : le menu « Scénarios de test » (le pont Godot) rend leurs titres et descriptions, c'est une surface de jeu.
 */
const PERIMETRES_DE_JEU = [
  { nom: 'catalogue i18n', racines: [`${dossierDe('i18n')}/messages`], horsDiagnostic: false },
  { nom: 'noyau et moteur', racines: porteeDeGarde(['noyau', 'engine']), horsDiagnostic: true },
  { nom: 'hôtes', racines: porteeDeGarde(HOTES_DU_NOYAU).filter((d) => existsSync(new URL(`../${d}`, import.meta.url))), horsDiagnostic: false },
  { nom: 'scénarios de test', racines: [`${dossierDe('scenes')}/test-scenarios`], horsDiagnostic: false },
] as const;

const CONSIGNE = 'retirer la réf (elle va en commentaire au site qui écrit le message) ; si la glose porte une règle, la relier à son entrée du Codex';

describe('réfs de livre — réservées au Codex et aux surfaces d’authoring (#601)', () => {
  it.each(PERIMETRES_DE_JEU)('aucun texte joueur du périmètre $nom ne porte une référence de livre (#3059)', ({ racines, horsDiagnostic }) => {
    const offenders: string[] = [];
    for (const { fichier: { rel }, sourceFile, checker } of analyserCorpus(readCorpus(racines))) {
      if (rel.startsWith(CODEX_DU_NOYAU)) continue;
      for (const h of renderedBookRefs(sourceFile!, checker, horsDiagnostic)) offenders.push(`${rel}:${h.line} — « ${h.text} »`);
    }
    expect(offenders, `Réf de livre dans un texte joueur (${CONSIGNE}) :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('les puits de diagnostic sont taillés et le journal reste vu (#3059)', () => {
    const sigle = REGISTRE_LIVRES.find((b) => b.abbr)!.abbr!;
    const texte = [
      `log.push("Le navire sombre (${sigle} 13 l.674).");`,
      `throw new Error("profil absent (${sigle} 12 l.131)");`,
      `const p = garanti(x, id, "gréement (${sigle} 12 l.131)");`,
      `console.error("frappe refusée (${sigle} 85 l.41)");`,
      `const o = { detail: "Le groupe fait face (${sigle} 15 l.94)." };`,
    ].join('\n');
    const lignes = (horsDiagnostic: boolean) => refsDuTexte('__probe.ts', texte, horsDiagnostic).map((h) => h.line);
    expect(lignes(true)).toEqual([1, 5]);
    expect(lignes(false)).toEqual([1, 2, 3, 4, 5]);
  });

  it('au catalogue, seule une clé de fiche du Codex (`codex.fiche.`) cite sa source (#3059)', () => {
    const sigle = REGISTRE_LIVRES.find((b) => b.abbr)!.abbr!;
    const catalogue = [
      `export const fr = {`,
      `  'codex.fiche.table': 'Table du Codex (${sigle} 13)',`,
      `  'codex.op.degats': 'inflige des Dégâts (${sigle} 13)',`,
      `  'log.coup': 'Le coup porte (${sigle} 13)',`,
      `};`,
    ].join('\n');
    expect(refsDuTexte('__catalogue.ts', catalogue).map((h) => h.line)).toEqual([3, 4]);
  });

  it('le détecteur voit RÉELLEMENT une réf rendue (et ignore les commentaires)', () => {
    // Preuve que la garde échoue sur la classe — sinon elle ne mesure que son angle mort.
    // Le sigle de la sonde est PRIS au registre lui-même (jamais découpé dans l'alternation, où il
    // serait déjà échappé) : aucune identité de livre n'est écrite ici, et un registre qui perdrait
    // ce livre déplacerait la sonde avec lui.
    const sigle = REGISTRE_LIVRES.find((b) => b.abbr)!.abbr!;
    const texte = [
      "import assert from 'node:assert/strict';",
      "import { strictEqual as verifier } from 'node:assert';",
      `// glose en commentaire (${sigle} 23 l.141) — tolérée`,
      `export const a = "Refuser la Faveur (${sigle} 23 l.141)";`,
      `export const b = "la voie des sorciers (${sigle}).";`,
      `export const c = "un mot qui contient ${sigle} sans le citer";`,
      `assert.equal(v, "Baliste (${sigle})");`,
      `verifier(v, "Profil attendu (${sigle})");`,
      `assert.equal(v, afficher("Profil rendu (${sigle})"));`,
      `function autre(assert) { assert.equal(v, "Traité par un homonyme (${sigle})"); }`,
    ].join('\n');
    expect(refsDuTexte('__probe.tsx', texte).map((h) => h.line)).toEqual([4, 5, 9, 10]);
  });

  it('le motif est DÉRIVÉ du registre ENTIER, jamais une seconde alternation (#1826)', () => {
    expect(BOOK_REF.source).toBe(`\\b(${alternationDuRegistre()})\\s+\\d+|\\((?:${alternationDuRegistre()})\\)`);
    // La population couverte, assérée et non promise : tout livre à `abbr`, extrait ou non.
    const sansAbbr = REGISTRE_LIVRES.filter((b) => !b.abbr).map((b) => b.id);
    expect(sansAbbr, `Livre(s) du registre sans \`abbr\`, donc hors de cette garde : ${sansAbbr.join(', ')}`).toEqual([]);
    for (const b of REGISTRE_LIVRES) expect(BOOK_REF.test(`${b.abbr} 12`), `${b.abbr} n'est pas couvert`).toBe(true);
  });
});
