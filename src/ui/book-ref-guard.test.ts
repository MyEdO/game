import { ast, analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript/unstable/ast';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { alternationDuRegistre, REGISTRE_LIVRES } from '../../scripts/guards/lib/rawRefIntegrity.mjs';

/**
 * Garde-fou « réf de livre hors surface Codex » (#601, même classe que #596).
 *
 * Une référence de livre (`LDB 23 l.141`, `MDG 12`…) est une information d'AUTEUR : elle a sa place
 * dans un commentaire (CLAUDE.md règle 6 : la réf NUE y fait foi), dans la donnée (`source: {book,
 * page}`), et sur les surfaces qui CITENT leur source — le Codex/Compendium, où `CodexRef` la rend
 * lui-même en pied de popover. Elle n'a AUCUNE place sur une surface de JEU : le joueur n'ouvre pas
 * le livre, et une réf affichée doit être LIÉE à la règle qu'elle cite — via `CodexRef` vers une
 * entrée RÉELLE du Codex, jamais une réf en dur ni un ornement (#492).
 *
 * STRUCTURELLE, pas un grep : on lit l'AST TypeScript et on n'inspecte que les nœuds RENDUS
 * (littéraux de chaîne, texte JSX, morceaux de gabarit). Les commentaires sont de la trivia — ils
 * ne sont jamais visités, donc jamais faussement accusés.
 *
 * Les deux répertoires d'AUTORING sont dispensés (voir `AUTHORING_DIRS`) — pas une liste
 * d'exception à vider : une décision de PÉRIMÈTRE, stable.
 */

const UI_DIR = fileURLToPath(new URL('.', import.meta.url));

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
 * Surfaces d'AUTORING, dispensées au MÊME titre que le Codex — tranché sous #601.
 *
 * `src/ui/compendium/**` : le Codex EST la surface de citation ; `CodexRef` y rend `source.book
 * p.page` par construction, et l'éditeur de fiche (`CodexEdit`) sert à SAISIR cette source.
 *
 * `src/ui/editor/**` : l'éditeur de scène/statblock a pour utilisateur un AUTEUR, jamais un joueur.
 * Sa raison d'être est de produire de la donnée conforme au RAW, chaque entrée taguée à sa `source`
 * (CLAUDE.md règles 1 et 5) : un champ « Caractéristiques aléatoires (LDB 77 l.108) » dit à l'auteur
 * QUEL passage il implémente — c'est le même service que rend la réf en commentaire au codeur. La
 * retirer appauvrirait l'outil sans rien protéger, puisque aucune de ces vues n'est atteignable en
 * jouant.
 *
 * Cette frontière n'est pas posée ici : elle est DÉJÀ celle du dépôt.
 * `editor-quarantine-guard.test.ts` (#495) oppose l'« ATELIER » (`src/ui/editor/**`, vocabulaire
 * technique d'auteur) à la « surface JOUEUR », et range `compendium/CodexEdit.tsx`/`StructFields.tsx`
 * parmi les « surfaces d'atelier assumées ». Même partition, appliquée ici à la réf de livre.
 */
const AUTHORING_DIRS = ['src/ui/compendium/', 'src/ui/editor/'];

/** Nœuds RENDUS uniquement — les commentaires (trivia) ne sont jamais visités. */
function renderedBookRefs(file: string, src: string, sf = ast({ rel: file, text: src })!): { line: number; text: string }[] {
  const hits: { line: number; text: string }[] = [];
  const visit = (node: ts.Node): void => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    if (text && BOOK_REF.test(text)) {
      hits.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: text.trim().slice(0, 120) });
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return hits;
}

describe('réfs de livre — réservées au Codex et aux surfaces d’authoring (#601)', () => {
  it('aucune surface de JEU de src/ui ne rend une référence de livre', () => {
    const offenders: string[] = [];
    for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(readCorpus(['src/ui']))) {
      if (AUTHORING_DIRS.some((d) => rel.startsWith(d))) continue;
      for (const h of renderedBookRefs(rel, text, sourceFile!)) offenders.push(`${rel}:${h.line} — « ${h.text} »`);
    }
    expect(offenders, `Réf de livre rendue hors Codex (retirer la réf ; si la glose porte une RÈGLE, la relier par <CodexRef> à son entrée réelle) :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('le détecteur voit RÉELLEMENT une réf rendue (et ignore les commentaires)', () => {
    // Preuve que la garde échoue sur la classe — sinon elle ne mesure que son angle mort.
    // Le sigle de la sonde est PRIS au registre lui-même (jamais découpé dans l'alternation, où il
    // serait déjà échappé) : aucune identité de livre n'est écrite ici, et un registre qui perdrait
    // ce livre déplacerait la sonde avec lui.
    const sigle = REGISTRE_LIVRES.find((b) => b.abbr)!.abbr!;
    const probe = join(UI_DIR, '__probe.tsx');
    const sf = ast({ rel: probe, text: [
        `// glose en commentaire (${sigle} 23 l.141) — tolérée`,
        `export const a = "Refuser la Faveur (${sigle} 23 l.141)";`,
        `export const b = "la voie des sorciers (${sigle}).";`,
        `export const c = "un mot qui contient ${sigle} sans le citer";`,
      ].join('\n') })!;
    const hits: number[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteral(n) && BOOK_REF.test(n.text)) hits.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
      n.forEachChild(visit);
    };
    visit(sf);
    expect(hits).toEqual([2, 3]);
  });

  it('le motif est DÉRIVÉ du registre ENTIER, jamais une seconde alternation (#1826)', () => {
    expect(BOOK_REF.source).toBe(`\\b(${alternationDuRegistre()})\\s+\\d+|\\((?:${alternationDuRegistre()})\\)`);
    // La population couverte, assérée et non promise : tout livre à `abbr`, extrait ou non.
    const sansAbbr = REGISTRE_LIVRES.filter((b) => !b.abbr).map((b) => b.id);
    expect(sansAbbr, `Livre(s) du registre sans \`abbr\`, donc hors de cette garde : ${sansAbbr.join(', ')}`).toEqual([]);
    for (const b of REGISTRE_LIVRES) expect(BOOK_REF.test(`${b.abbr} 12`), `${b.abbr} n'est pas couvert`).toBe(true);
  });
});
