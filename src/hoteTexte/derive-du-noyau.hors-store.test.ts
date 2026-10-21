/**
 * L'HÔTE DÉRIVE DU NOYAU (#2898 lot D). laurent, 2026-10-21 13:06Z : « Ce qui est vital pour moi c est que si je modifie
 * le moteur, je n ai pas à toucher ni au mcp, ni à l hôte, sauf si je dois inventer des nouveaux tools ». Garde de classe :
 * aucune chaîne du code de l'hôte (`src/hoteTexte/`, hors tests et cibles générées) ne nomme un verbe de la partie
 * (`VERBES`, lus du type du noyau) ni une clé de fenêtre (`CLES_DE_FENETRE`) ; l'hôte les lit du noyau. Seule exception :
 * le verbe que l'outil `offre` porte, son entrée dans le noyau.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { estFichierVitest, estKitDeTest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { VERBES } from './verbes.generated';
import { CLES_DE_FENETRE } from '../noyau/index';

/** Les noms que l'hôte a le droit d'écrire, et pourquoi. */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  jouerLOffre: 'l’entrée du noyau que le geste `offre` porte',
};

const DOSSIER = new URL('./', import.meta.url);

/** Les fichiers de code de l'hôte : ni test, ni table de test, ni cible générée. */
const fichiersDeLHote = (): string[] =>
  listerDossier(fileURLToPath(DOSSIER)).filter((f) => /\.ts$/.test(f) && !estFichierVitest(f) && !estKitDeTest(f) && !/\.generated\.ts$/.test(f));

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

describe('l’hôte ne nomme aucun verbe ni aucune fenêtre en dur', () => {
  it('témoin : la garde voit le verbe d’une chaîne et la fenêtre d’un gabarit, pas ceux d’un commentaire', () => {
    const [verbe, autre] = Object.keys(VERBES).filter((v) => !EXCEPTIONS[v]);
    const mots = motsDesChaines(`// '${autre}'\nconst x = '${verbe}';\nconst y = \`fenêtre ${CLES_DE_FENETRE[0]}\`;`);
    expect(mots).toEqual(expect.arrayContaining([{ mot: verbe, ligne: 2 }, { mot: CLES_DE_FENETRE[0], ligne: 3 }]));
    expect(mots.map((m) => m.mot)).not.toContain(autre);
  });

  it('aucun fichier de code de l’hôte', () => {
    const interdits = new Set([...Object.keys(VERBES), ...CLES_DE_FENETRE].filter((n) => !EXCEPTIONS[n]));
    const trouves = fichiersDeLHote().flatMap((f) =>
      motsDesChaines(readFileSync(new URL(f, DOSSIER), 'utf8')).flatMap(({ mot, ligne }) => (interdits.has(mot) ? [`src/hoteTexte/${f}:${ligne} ${mot}`] : [])));
    expect(trouves, 'un verbe ou une fenêtre nommé en dur : le lire du noyau (`VERBES`, `fenetreDuJeu`)').toEqual([]);
  });
});
