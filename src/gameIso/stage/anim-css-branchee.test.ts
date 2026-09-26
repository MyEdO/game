/**
 * LES KEYFRAMES DU STAGE SONT BRANCHÉES — `gameIso/anim.css` porte les animations que les surcouches
 * du monde RÉCLAMENT par leur `className` : projectiles et halos de FX (`.proj`), fourmis du gabarit
 * de zone d'effet (`.zde-ants`), pastilles d'état des jetons (`.token-endmark`/`.es-*`), faune et
 * ambiance (`.fly`, `.sway`, `.smoke`, `.glow`, `.breathe`, `.warm`). Une feuille de style
 * n'entre dans le bundle que si un module l'IMPORTE : personne ne l'important, toutes ces classes
 * restent des noms morts, sans une seule erreur — les projectiles cessent de voler en silence.
 *
 * Ce que ce banc tient : (1) le BRANCHEMENT — `anim.css` est importée par l'HÔTE du monde
 * (`stage/MondeDeCampagne`), qui vit tant que l'écran de campagne vit, et par lui SEUL : une surcouche
 * se démonte au changement de regard, et une feuille globale a UN propriétaire ; (2) chaque classe de
 * MISE EN PAGE du plateau a SA feuille (table `MISES_EN_PAGE` : `.iso-stage` → `stage/iso-stage.css`,
 * `.pastille-entite` → `stage/pastille-entite.css`, `.plaque-nom` → `stage/plaque-nom.css`) : la
 * feuille porte la règle, et tout module de `src/` qui rend un élément de cette classe l'importe. Une
 * mise en page tient ainsi par son RENDEUR, jamais par l'hôte qui le monte.
 *
 * PÉRIMÈTRE ET ANGLE MORT, énoncés. Le scan est TEXTUEL et STATIQUE : il lit les sources, jamais un
 * DOM. jsdom n'exécute NI les keyframes NI la cascade CSS — aucun test de rendu ne pourrait dire ici
 * qu'une animation « tourne ». Une règle d'animation supprimée d'`anim.css` alors que son nom survit
 * dans un composant est HORS DE PORTÉE : la feuille est la seule liste de ses classes, et un scan
 * textuel n'a aucune autre source contre laquelle la confronter. Une classe est RÉCLAMÉE par une
 * valeur `className`/`class`, par `classList.add(…)` ou par `setAttribute('class', …)` ; une classe
 * construite dynamiquement (`\u0060es-${kind}\u0060`) n'est vue que par sa RACINE, et toute autre
 * écriture (`classList.toggle`, concaténation hors littéral, nom tiré d'une variable) échappe au scan.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';

const GAMEISO = fileURLToPath(new URL('../', import.meta.url)); // …/stage/ → …/gameIso/
const SOUS_GAMEISO = 'src/gameIso/';
/** L'HÔTE du monde : il ne se démonte qu'avec l'écran de campagne. */
const HOTE = join(GAMEISO, 'stage/MondeDeCampagne.tsx');
const RACINE = fileURLToPath(new URL('../../../', import.meta.url)); // …/src/gameIso/stage/ → dépôt

/** Classe de MISE EN PAGE → la feuille qui la porte, et les rendeurs que le scan DOIT voir (prémisse). */
const MISES_EN_PAGE: readonly { classe: string; feuille: string; rendeurs: readonly string[] }[] = [
  { classe: 'iso-stage', feuille: 'src/gameIso/stage/iso-stage.css', rendeurs: ['src/gameIso/stage/GameStage3D.tsx', 'src/gameIso/SurcoucheIso.tsx'] },
  { classe: 'pastille-entite', feuille: 'src/gameIso/stage/pastille-entite.css', rendeurs: ['src/gameIso/stage/PastilleEntite.tsx'] },
  { classe: 'plaque-nom', feuille: 'src/gameIso/stage/plaque-nom.css', rendeurs: ['src/gameIso/stage/PlaquesDeNom.tsx'] },
];

/** Le module IMPORTE-t-il la feuille ? Lecture LIGNE À LIGNE, commentaires écartés : un import mis en
 *  commentaire ne branche rien, et une regex posée sur le fichier entier le prendrait pour un import. */
const SAUT = String.fromCharCode(10);

export function importeFeuille(src: string, feuille: string): boolean {
  const rx = new RegExp(`^import\\s+['"](?:[^'"]*/)?${feuille.replace('.', '\\.')}['"]\\s*;?`);
  return src.split(SAUT).some((l) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
    return rx.test(t);
  });
}

/** Les sources de `gameIso/`, hors tests — chemin DEPUIS `gameIso/`, la forme que porte le rapport. */
function sources(): { chemin: string; code: string }[] {
  return readCorpus([SOUS_GAMEISO]).map(({ rel, text }) => ({
    chemin: rel.slice(SOUS_GAMEISO.length),
    code: text,
  }));
}

/** Les classes du CSS qu'un source RÉCLAME — dans un `className`/`class` littéral ou un template. */
export function classesReclamees(src: string, connues: readonly string[]): string[] {
  const out = new Set<string>();
  for (const c of connues) {
    // La classe est réclamée si son nom apparaît dans une valeur de classe : littéral (`"proj"`,
    // `'fly crow'`) ou template (`` `es-${k}` ``). On exige une frontière de mot pour ne pas
    // confondre `.fly` avec `.flyover`.
    const valeur = `(?:["'\`{][^"'\`]*)?\\b${c}\\b`;
    const rx = new RegExp(
      `class(?:Name)?\\s*=\\s*${valeur}|classList\\.add\\([^)]*?["'\`]${c}["'\`]|setAttribute\\(\\s*["']class["']\\s*,\\s*${valeur}`,
    );
    if (rx.test(src)) out.add(c);
  }
  return [...out];
}

describe('keyframes du stage — la feuille est BRANCHÉE, et sur l’hôte du monde', () => {
  it('`anim.css` est importée par l’hôte du monde (jamais par une surcouche, qui se démonte)', () => {
    const hote = readFileSync(HOTE, 'utf8');
    expect(
      importeFeuille(hote, 'anim.css'),
      '`stage/MondeDeCampagne` n’importe plus `gameIso/anim.css` : toutes les animations du stage sont mortes',
    ).toBe(true);
  });

  it('AUCUN autre module ne l’importe : une feuille globale a UN propriétaire', () => {
    const importeurs = sources()
      .filter(({ code }) => importeFeuille(code, 'anim.css'))
      .map(({ chemin }) => chemin);
    expect(importeurs, `deux propriétaires pour une même feuille :\n${importeurs.join('\n')}`)
      .toEqual(['stage/MondeDeCampagne.tsx']);
  });

  it.each(MISES_EN_PAGE)('mise en page $classe : sa feuille porte la règle, tout module de `src/` qui la rend l’importe', ({ classe, feuille, rendeurs: attendus }) => {
    const nomFeuille = feuille.slice(feuille.lastIndexOf('/') + 1);
    expect(
      new RegExp(`^\\.${classe}\\s*\\{`, 'm').test(readFileSync(join(RACINE, feuille), 'utf8')),
      `\`${feuille}\` ne porte plus la règle \`.${classe}\``,
    ).toBe(true);
    const rendeurs = readCorpus(['src/']).filter(({ text }) => classesReclamees(text, [classe]).length > 0);
    // PRÉMISSE — le scan MORD : les rendeurs connus rendent bien la classe.
    expect(rendeurs.map(({ rel }) => rel), `aucun rendeur de \`.${classe}\` : le scan ne voit rien`)
      .toEqual(expect.arrayContaining([...attendus]));
    const sansFeuille = rendeurs.filter(({ text }) => !importeFeuille(text, nomFeuille)).map(({ rel }) => rel);
    expect(sansFeuille, `rendent \`.${classe}\` sans importer \`${nomFeuille}\` :\n${sansFeuille.join('\n')}`).toEqual([]);
  });

  it('fail-closed : le scanner voit une déclaration et une réclamation SYNTHÉTIQUES', () => {
    expect(classesReclamees('<g className="proj tourne" />', ['tourne'])).toEqual(['tourne']);
    expect(classesReclamees('<g className={`es-${k}`} />', ['es-mort'])).toEqual([]);
    expect(classesReclamees('<g className="tournevis" />', ['tourne'])).toEqual([]);
    // …et un import MIS EN COMMENTAIRE ne branche rien (c'est exactement la panne mesurée).
    expect(importeFeuille("import '../anim.css';", 'anim.css')).toBe(true);
    expect(importeFeuille("// import '../anim.css';", 'anim.css')).toBe(false);
    expect(importeFeuille(" * import '../anim.css';", 'anim.css')).toBe(false);
    expect(importeFeuille("import './stage/iso-stage.css';", 'iso-stage.css')).toBe(true);
    expect(importeFeuille("import './iso-stage.css';", 'iso-stage.css')).toBe(true);
    expect(importeFeuille("import './faux-iso-stage.css';", 'iso-stage.css')).toBe(false);
    expect(classesReclamees('<svg className="iso-stage" />', ['iso-stage'])).toEqual(['iso-stage']);
    expect(classesReclamees("el.classList.add('muet', 'plaque-nom');", ['plaque-nom'])).toEqual(['plaque-nom']);
    expect(classesReclamees("el.setAttribute('class', 'plaque-nom halo-champ');", ['plaque-nom'])).toEqual(['plaque-nom']);
    expect(classesReclamees("el.setAttribute('data-x', 'plaque-nom');", ['plaque-nom'])).toEqual([]);
    expect(classesReclamees("el.classList.add('plaque-nommee');", ['plaque-nom'])).toEqual([]);
  });
});
