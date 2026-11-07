/**
 * LES HÔTES DÉRIVENT DU NOYAU (#2898 lot D, #2928). laurent, 2026-10-21 13:06Z : « Ce qui est vital pour moi c est que si
 * je modifie le moteur, je n ai pas à toucher ni au mcp, ni à l hôte, sauf si je dois inventer des nouveaux tools ». Garde
 * de classe : aucune chaîne du code d'un hôte du noyau (le dossier de chaque zone de `HOTES_DU_NOYAU`,
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

/** Un mot : une lettre, accentuée ou non, puis des lettres, des chiffres, `_` ou `-` (« portée » est un mot, pas « port »). */
const MOT = /\p{L}[\p{L}\p{N}_-]*/gu;

/** Les mots des chaînes d'un texte de code (littéraux entre apostrophes, guillemets ou accents graves, sans le code
 *  qu'un gabarit interpole), commentaires et chemins de module (`from '…'`, `import('…')`) ôtés, chacun avec sa ligne. */
function motsDesChaines(code: string): { mot: string; ligne: number }[] {
  const sansCommentaires = code
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (c, avant: string) => avant + ' '.repeat(c.length - avant.length))
    .replace(/(\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)(['"])[^'"\n]*\2/gm, (c, avant: string) => avant + ' '.repeat(c.length - avant.length));
  const mots: { mot: string; ligne: number }[] = [];
  for (const m of sansCommentaires.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
    const debut = sansCommentaires.slice(0, m.index).split('\n').length;
    const texte = m[0].startsWith('`') ? m[0].replace(/\$\{[^}]*\}/g, (x) => x.replace(/[^\n]/g, ' ')) : m[0];
    for (const w of texte.matchAll(MOT)) mots.push({ mot: w[0], ligne: debut + texte.slice(0, w.index).split('\n').length - 1 });
  }
  return mots;
}

/** Les mots des chaînes d'un script GDScript (`lexemesGdscript`), chacun avec sa ligne. */
const motsDesChainesGdscript = (code: string): { mot: string; ligne: number }[] =>
  lexemesGdscript(code).chaines.flatMap(({ texte, ligne }) => [...texte.matchAll(MOT)].map((w) => ({ mot: w[0], ligne: ligne + texte.slice(0, w.index).split('\n').length - 1 })));

describe('l’hôte ne nomme aucun verbe ni aucune fenêtre en dur', () => {
  it('témoin : la garde voit le verbe d’une chaîne et la fenêtre d’un gabarit, pas ceux d’un commentaire, d’une interpolation, d’un chemin de module ni d’un mot plus long', () => {
    const [verbe, autre] = Object.keys(VERBES);
    const mots = motsDesChaines(`// '${autre}'\nconst x = '${verbe}';\nconst y = \`fenêtre ${CLES_DE_FENETRE[0]} \${${autre}}\`;\nconst z = '${verbe}ée';\nimport { a } from './${autre}';`);
    expect(mots).toEqual(expect.arrayContaining([{ mot: verbe, ligne: 2 }, { mot: CLES_DE_FENETRE[0], ligne: 3 }]));
    expect(mots.map((m) => m.mot), 'ni le commentaire, ni le code interpolé, ni le chemin de module, ni le début d’un mot accentué').not.toContain(autre);
    expect(mots.filter((m) => m.mot === verbe)).toHaveLength(1);
    expect(motsDesChainesGdscript(`# "${autre}"\nvar x := "${verbe}"`)).toEqual([{ mot: verbe, ligne: 2 }]);
  });

  it('aucun fichier de code d’un hôte', () => {
    const fichiers = fichiersDesHotes();
    for (const d of DOSSIERS) expect(fichiers.some((f) => f.startsWith(`${d}/`)), `témoin : la garde lit ${d}`).toBe(true);
    expect(DOSSIERS, 'témoin : la garde lit le module commun et l’hôte texte').toEqual(expect.arrayContaining(['src/hote', 'src/hoteTexte']));
    expect(fichiers.some(estGdscript), 'témoin : la garde lit les scripts de l’hôte Godot').toBe(true);
    const interdits = new Set([...Object.keys(VERBES), ...CLES_DE_FENETRE]);
    const trouves = fichiers.flatMap((f) => {
      const code = readFileSync(new URL(f, RACINE), 'utf8');
      return (estGdscript(f) ? motsDesChainesGdscript(code) : motsDesChaines(code)).flatMap(({ mot, ligne }) => (interdits.has(mot) ? [`${f}:${ligne} ${mot}`] : []));
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
