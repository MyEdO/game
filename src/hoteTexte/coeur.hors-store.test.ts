/**
 * LE CŒUR DE L'HÔTE TEXTE (#2898, plan v3 étapes 4 et 6), sans sous-processus : l'entrée `executer` sur un disque en
 * mémoire, une commande par appel, la partie fermée à chaque fin d'appel. Le rejeu reprend les jetons du lancement
 * avant la ligne 1 ; chaque catégorie d'erreur laisse le fichier intact ; une offre appliquée s'y écrit. Le rejeu en sous-processus : `cli.hors-store.test.ts` ; les
 * bornes de sortie : `bornes.hors-store.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { executer, type Disque } from './cli';
import { nouvelEntete, rejouer } from './partieTexte';

const FICHIER = 'partie.jsonl';

/** Un disque en mémoire, et l'appel d'une commande sur son fichier de partie. */
function table() {
  const fichiers = new Map<string, string>();
  const disque: Disque = {
    lire: (chemin) => fichiers.get(chemin) ?? null,
    ecrire: (chemin, texte) => void fichiers.set(chemin, texte),
    ajouter: (chemin, texte) => void fichiers.set(chemin, (fichiers.get(chemin) ?? '') + texte),
  };
  const appel = (...argv: string[]) => {
    const sortie = executer(['--partie', FICHIER, ...argv], disque);
    return { ...sortie, lignes: sortie.texte.trimEnd().split('\n') };
  };
  return { appel, fichier: () => fichiers.get(FICHIER) ?? '' };
}

describe('le rejeu reprend les jetons', () => {
  it('ceux du lancement, avant la ligne 1 : le tick de la cadence auto programmé au lancement est repris', () => {
    const r = rejouer(nouvelEntete('dome', { graine: 7, cadence: 'auto' }), []);
    try {
      expect(r.reprises[0], 'aucun jeton du lancement n’a été repris avant la ligne 1').toBeGreaterThan(0);
    } finally {
      r.partie.fermer();
    }
  });
});

describe('les erreurs d’un geste : catégorie, code 1, fichier intact', () => {
  it.each([
    ['validation', ['jouer', 'nimporte']],
    ['validation', ['jouer', 'jouerLOffre', '["end-turn"]', '--siege', '0']],
    ['validation', ['offre', 'charge', '{pas du json']],
    ['permission', ['jouer', 'battleEndTurn', '[]', '--siege', '1']],
    ['regle', ['offre', 'disengage']],
  ])('%s : %j', (categorie, argv) => {
    const { appel, fichier } = table();
    expect(appel('nouvelle', 'dome', '--graine', '7').code).toBe(0);
    expect(appel('jouer', 'confirmRoundStart').code).toBe(0);
    const avant = fichier();
    const sortie = appel(...argv);
    expect(sortie.code).toBe(1);
    expect(sortie.lignes[0]).toMatch(new RegExp(`^erreur ${categorie} : `));
    expect(fichier(), 'un geste en erreur a été écrit au fichier').toBe(avant);
  });
});

describe('le fichier de partie', () => {
  it('une offre appliquée s’y écrit, telle que jouée', () => {
    const { appel, fichier } = table();
    appel('nouvelle', 'dome', '--graine', '7');
    appel('jouer', 'confirmRoundStart');
    const sortie = appel('offre', 'charge');
    expect(sortie.code, sortie.texte).toBe(0);
    expect(fichier().trimEnd().split('\n').pop()).toBe('{"offre":"charge"}');
  });
});
