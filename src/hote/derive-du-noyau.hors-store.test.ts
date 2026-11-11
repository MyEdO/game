/**
 * LES HÔTES DÉRIVENT DU NOYAU (#2898 lot D, #2928). laurent, 2026-10-21 13:06Z : « Ce qui est vital pour moi c est que si
 * je modifie le moteur, je n ai pas à toucher ni au mcp, ni à l hôte, sauf si je dois inventer des nouveaux tools ». Garde
 * de classe : aucun id d'une chaîne (`idsDe`, `nommes` : un verbe à toute place, une fenêtre après le `@` d'un id de geste) du code d'un hôte du noyau (le dossier de chaque zone de `HOTES_DU_NOYAU`,
 * `scripts/guards/lib/couches.mjs`, TypeScript et GDScript, hors tests et cibles générées) ne nomme un verbe de la partie
 * (`VERBES`, lus du type du noyau) ni une clé de fenêtre (`CLES_DE_FENETRE`) ; un hôte les lit du noyau, le verbe d'une
 * offre compris (`OffreEnVue.geste`). Et aucun script GDScript ne calcule une règle
 * (`calculsDeRegle`, #2928) : il lit la vue ; l'arithmétique de la mise
 * en page vit dans un seul module, que sa structure désigne (`estMiseEnPage`).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { estFichierVitest, estKitDeTest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { HOTES_DU_NOYAU, dossierDe } from '../../scripts/guards/lib/couches.mjs';
import { calculsDeRegle, estMiseEnPage } from '../../scripts/guards/lib/gdscriptSansRegle.mjs';
import { lexemesGdscript } from '../../scripts/guards/lib/gdscript.mjs';
import { VERBES } from './verbes.generated';
import { CLES_DE_FENETRE } from '../noyau/index';

const RACINE = new URL('../../', import.meta.url);

/** Les dossiers des hôtes que l'arbre porte. */
const DOSSIERS = HOTES_DU_NOYAU.map(dossierDe).filter((d) => existsSync(new URL(d, RACINE)));

/** Les fichiers de code des hôtes, relatifs à la racine du dépôt : TypeScript ou GDScript, ni test, ni table de test, ni
 *  cible générée. */
const fichiersDesHotes = (): string[] =>
  DOSSIERS.flatMap((d) => listerArbre(fileURLToPath(new URL(d, RACINE)), { filtre: (f) => /\.(ts|gd)$/.test(f) && !estFichierVitest(f) && !estKitDeTest(f) && !/\.generated\.ts$/.test(f) }).map((f) => `${d}/${f}`));
const estGdscript = (f: string): boolean => f.endsWith('.gd');

/** Un id d'une chaîne, et s'il suit un `@` : la fenêtre d'un id de geste (`'<verbe>@<clé>#axe'`). */
interface IdDeChaine { mot: string; ligne: number; fenetre: boolean }

/** Les ids d'une chaîne qui a la forme d'un id (ni blanc, ni `://`) : la chaîne entière et chacun de ses segments entre
 *  `@ # / . :`, le segment qui suit un `@` marqué `fenetre` ; une prose, une URL n'en portent aucun. */
const idsDe = (texte: string, ligne: number): IdDeChaine[] => {
  if (/\s|:\/\//.test(texte)) return [];
  const segments = [...new Set([texte, ...texte.split(/[@#/.:]/)])].map((mot) => ({ mot, ligne, fenetre: false }));
  return [...segments, ...[...texte.matchAll(/@([^@#/.:]+)/g)].map((m) => ({ mot: m[1], ligne, fenetre: true }))];
};

/** Les ids des chaînes d'un texte de code (littéraux entre apostrophes, guillemets ou accents graves, le code qu'un
 *  gabarit interpole tenu pour un séparateur), commentaires et chemins de module (`from '…'`, `import('…')`) ôtés,
 *  chacun avec sa ligne. */
function idsDesChaines(code: string): IdDeChaine[] {
  const sansCommentaires = code
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (c, avant: string) => avant + ' '.repeat(c.length - avant.length))
    .replace(/(\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)(['"])[^'"\n]*\2/gm, (c, avant: string) => avant + ' '.repeat(c.length - avant.length));
  const ids: IdDeChaine[] = [];
  for (const m of sansCommentaires.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
    const ligne = sansCommentaires.slice(0, m.index).split('\n').length;
    const texte = m[0].slice(1, -1);
    ids.push(...idsDe(m[0].startsWith('`') ? texte.replace(/\$\{[^}]*\}/g, '/') : texte, ligne));
  }
  return ids;
}

/** Les ids des chaînes d'un script GDScript (`lexemesGdscript`), chacun avec sa ligne. */
const idsDesChainesGdscript = (code: string): IdDeChaine[] => lexemesGdscript(code).chaines.flatMap(({ texte, ligne }) => idsDe(texte, ligne));

const VERBES_DE_LA_PARTIE = new Set(Object.keys(VERBES));
const CLES: ReadonlySet<string> = new Set(CLES_DE_FENETRE);
/** Les noms en dur parmi `ids` : un verbe de la partie à toute place d'un id, une clé de fenêtre après un `@`. */
const nommes = (ids: readonly IdDeChaine[]): { mot: string; ligne: number }[] =>
  ids.filter((i) => VERBES_DE_LA_PARTIE.has(i.mot) || (i.fenetre && CLES.has(i.mot))).map(({ mot, ligne }) => ({ mot, ligne }));

describe('l’hôte ne nomme aucun verbe ni aucune fenêtre en dur', () => {
  it('témoin : la garde voit un verbe à toute place d’un id et une fenêtre après le `@` d’un id de geste, pas une prose, une URL, un commentaire, une interpolation, un chemin de module, ni une clé de fenêtre entière, de chemin ou de texte', () => {
    const [verbe, autre] = Object.keys(VERBES);
    const [cle] = CLES_DE_FENETRE;
    const code = [
      `const a = '${verbe}';`,
      `const b = 'x/${verbe}';`,
      `const c = '${verbe}@${cle}#axe';`,
      `const d = \`\${v}@${cle}\`;`,
      `// '${autre}@${cle}'`,
      `const e = 'fenêtre ${autre} ouverte';`,
      `const f = \`\${${autre}}\`;`,
      `const g = 'https://h/${autre}';`,
      `const h = '${cle}';`,
      `const i = 'x/${cle}';`,
      `const j = 'ecran.${cle}.xp';`,
      `const k = '${verbe}ée';`,
      `import { z } from './${autre}';`,
    ].join('\n');
    expect(nommes(idsDesChaines(code)), 'le verbe littéral, le verbe en segment, la fenêtre après le `@`, littérale et en gabarit').toEqual([
      { mot: verbe, ligne: 1 }, { mot: verbe, ligne: 2 }, { mot: verbe, ligne: 3 }, { mot: cle, ligne: 3 }, { mot: cle, ligne: 4 },
    ]);
    expect(nommes(idsDesChainesGdscript(`# "${autre}"\nvar x := "${verbe}"\nvar y := "${cle}"\nvar z := "le ${autre} du jour"`))).toEqual([{ mot: verbe, ligne: 2 }]);
  });

  it('aucun fichier de code d’un hôte', () => {
    const fichiers = fichiersDesHotes();
    for (const d of DOSSIERS) expect(fichiers.some((f) => f.startsWith(`${d}/`)), `témoin : la garde lit ${d}`).toBe(true);
    expect(DOSSIERS, 'témoin : la garde lit le module commun et l’hôte texte').toEqual(expect.arrayContaining(['src/hote', 'src/hoteTexte']));
    expect(fichiers.some(estGdscript), 'témoin : la garde lit les scripts de l’hôte Godot').toBe(true);
    const trouves = fichiers.flatMap((f) => {
      const code = readFileSync(new URL(f, RACINE), 'utf8');
      return nommes(estGdscript(f) ? idsDesChainesGdscript(code) : idsDesChaines(code)).map(({ mot, ligne }) => `${f}:${ligne} ${mot}`);
    });
    expect(trouves, 'un verbe ou une fenêtre nommé en dur : le lire du noyau (`VERBES`, `fenetreDuJeu`)').toEqual([]);
  });

  it('aucun script GDScript ne calcule une règle : ni hasard, ni chemin, ni arithmétique, ordre ou mesure hors de la mise en page', () => {
    const scripts = fichiersDesHotes().filter(estGdscript).map((f) => ({ f, src: readFileSync(new URL(f, RACINE), 'utf8') }));
    expect(scripts.filter(({ src }) => estMiseEnPage(src)).map(({ f }) => f), 'un seul module de mise en page').toHaveLength(1);
    const trouves = scripts.flatMap(({ f, src }) => calculsDeRegle(src).map(({ famille, ligne, extrait }) => `${f}:${ligne} ${famille} ${extrait}`));
    expect(trouves, 'une règle calculée par l’hôte : la lire de la vue du noyau ; une mise en page : dans le module de mise en page').toEqual([]);
  });
});
