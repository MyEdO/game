/**
 * LES HÔTES DÉRIVENT DU NOYAU (#2898 lot D, #2928). laurent, 2026-10-21 13:06Z : « Ce qui est vital pour moi c est que si
 * je modifie le moteur, je n ai pas à toucher ni au mcp, ni à l hôte, sauf si je dois inventer des nouveaux tools ». Garde
 * de classe : aucune chaîne du code d'un hôte du noyau (le dossier de chaque zone de `HOTES_DU_NOYAU`,
 * `scripts/guards/lib/couches.mjs`, TypeScript et GDScript, hors tests et cibles générées) ne nomme un verbe de la partie
 * (`VERBES`, lus du type du noyau) ni une clé de fenêtre (`CLES_DE_FENETRE`) ; un hôte les lit du noyau. Seule exception :
 * le verbe que le geste `offre` porte, son entrée dans le noyau. Et aucun script GDScript ne calcule une règle
 * (`calculsDeRegle`, plan `docs/plans/2026-10-21-vague6-hote-godot.md` M-e) : il lit la vue.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { estFichierVitest, estKitDeTest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { HOTES_DU_NOYAU, dossierDe } from '../../scripts/guards/lib/couches.mjs';
import { calculsDeRegle, lexemesGdscript } from '../../scripts/guards/lib/gdscriptSansRegle.mjs';
import { VERBES } from './verbes.generated';
import { CLES_DE_FENETRE } from '../noyau/index';

/** Les noms que l'hôte a le droit d'écrire, et pourquoi. */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  jouerLOffre: 'l’entrée du noyau que le geste `offre` porte',
};

const RACINE = new URL('../../', import.meta.url);

/** Les dossiers des hôtes que l'arbre porte. */
const DOSSIERS = HOTES_DU_NOYAU.map(dossierDe).filter((d) => existsSync(new URL(d, RACINE)));

/** Les fichiers de code des hôtes, relatifs à la racine du dépôt : TypeScript ou GDScript, ni test, ni table de test, ni
 *  cible générée. */
const fichiersDesHotes = (): string[] =>
  DOSSIERS.flatMap((d) => listerArbre(fileURLToPath(new URL(d, RACINE)), { filtre: (f) => /\.(ts|gd)$/.test(f) && !estFichierVitest(f) && !estKitDeTest(f) && !/\.generated\.ts$/.test(f) }).map((f) => `${d}/${f}`));
const estGdscript = (f: string): boolean => f.endsWith('.gd');

/** Les mots des chaînes d'un texte de code (littéraux entre apostrophes, guillemets ou accents graves), commentaires ôtés,
 *  chacun avec sa ligne. */
function motsDesChaines(code: string): { mot: string; ligne: number }[] {
  const sansCommentaires = code.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (c, avant: string) => avant + ' '.repeat(c.length - avant.length));
  const mots: { mot: string; ligne: number }[] = [];
  for (const m of sansCommentaires.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
    const debut = sansCommentaires.slice(0, m.index).split('\n').length;
    for (const w of m[0].matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)) mots.push({ mot: w[0], ligne: debut + m[0].slice(0, w.index).split('\n').length - 1 });
  }
  return mots;
}

/** Les mots des chaînes d'un script GDScript (`lexemesGdscript`), chacun avec sa ligne. */
const motsDesChainesGdscript = (code: string): { mot: string; ligne: number }[] =>
  lexemesGdscript(code).chaines.flatMap(({ texte, ligne }) => [...texte.matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)].map((w) => ({ mot: w[0], ligne: ligne + texte.slice(0, w.index).split('\n').length - 1 })));

describe('l’hôte ne nomme aucun verbe ni aucune fenêtre en dur', () => {
  it('témoin : la garde voit le verbe d’une chaîne et la fenêtre d’un gabarit, pas ceux d’un commentaire', () => {
    const [verbe, autre] = Object.keys(VERBES).filter((v) => !EXCEPTIONS[v]);
    const mots = motsDesChaines(`// '${autre}'\nconst x = '${verbe}';\nconst y = \`fenêtre ${CLES_DE_FENETRE[0]}\`;`);
    expect(mots).toEqual(expect.arrayContaining([{ mot: verbe, ligne: 2 }, { mot: CLES_DE_FENETRE[0], ligne: 3 }]));
    expect(mots.map((m) => m.mot)).not.toContain(autre);
    expect(motsDesChainesGdscript(`# "${autre}"\nvar x := "${verbe}"`)).toEqual([{ mot: verbe, ligne: 2 }]);
  });

  it('aucun fichier de code d’un hôte', () => {
    const fichiers = fichiersDesHotes();
    for (const d of DOSSIERS) expect(fichiers.some((f) => f.startsWith(`${d}/`)), `témoin : la garde lit ${d}`).toBe(true);
    expect(DOSSIERS, 'témoin : la garde lit le module commun et l’hôte texte').toEqual(expect.arrayContaining(['src/hote', 'src/hoteTexte']));
    expect(fichiers.some(estGdscript), 'témoin : la garde lit les scripts de l’hôte Godot').toBe(true);
    const interdits = new Set([...Object.keys(VERBES), ...CLES_DE_FENETRE].filter((n) => !EXCEPTIONS[n]));
    const trouves = fichiers.flatMap((f) => {
      const code = readFileSync(new URL(f, RACINE), 'utf8');
      return (estGdscript(f) ? motsDesChainesGdscript(code) : motsDesChaines(code)).flatMap(({ mot, ligne }) => (interdits.has(mot) ? [`${f}:${ligne} ${mot}`] : []));
    });
    expect(trouves, 'un verbe ou une fenêtre nommé en dur : le lire du noyau (`VERBES`, `fenetreDuJeu`)').toEqual([]);
  });

  it('aucun script GDScript ne calcule une règle : ni hasard, ni chemin, ni mesure entre cases', () => {
    const trouves = fichiersDesHotes().filter(estGdscript).flatMap((f) =>
      calculsDeRegle(readFileSync(new URL(f, RACINE), 'utf8')).map(({ famille, ligne, extrait }) => `${f}:${ligne} ${famille} ${extrait}`));
    expect(trouves, 'une règle calculée par l’hôte : la lire de la vue du noyau').toEqual([]);
  });
});
