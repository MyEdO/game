/**
 * LE CŒUR DE L'HÔTE TEXTE (#2898, plan v3 étapes 4 et 6, lot C), sans sous-processus : l'entrée `executer` sur un disque
 * en mémoire, une commande par appel, la partie fermée à chaque fin d'appel. Le rejeu reprend les jetons du lancement
 * avant la ligne 1 ; chaque catégorie d'erreur laisse le fichier intact ; une offre appliquée s'y écrit ; un geste sans
 * effet se refuse ; les arguments de `jouer` se contrôlent contre le type du verbe. Le rejeu en sous-processus :
 * `cli.hors-store.test.ts` ; les bornes de sortie : `bornes.hors-store.test.ts` ; la vue : `projection.hors-store.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { executer, type Disque } from './cli';
import { jouerUnGeste, lireLeFichier, nouvelEntete, rejouer } from './partieTexte';

const FICHIER = 'partie.jsonl';

/** Un fichier de partie committé à côté de ce test. */
const fixture = (nom: string): string => readFileSync(new URL(`./${nom}`, import.meta.url), 'utf8');

/** Un disque en mémoire, son fichier de partie posé à `texte`, et l'appel d'une commande sur ce fichier. */
function table(texte?: string) {
  const fichiers = new Map<string, string>(texte === undefined ? [] : [[FICHIER, texte]]);
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

/** Une partie neuve de `scenario` (graine 7), ses `gestes` joués ; rend la table, le fichier en est l'état. */
function partie(scenario: string, ...gestes: string[][]) {
  const t = table();
  expect(t.appel('nouvelle', scenario, '--graine', '7').code).toBe(0);
  for (const g of gestes) {
    const sortie = t.appel(...g);
    expect(sortie.code, `${g.join(' ')} : ${sortie.texte}`).toBe(0);
  }
  return t;
}

/** Le geste est refusé dans sa catégorie, avec ce message, et le fichier reste intact. */
function refuse(t: ReturnType<typeof table>, argv: string[], categorie: string, message: RegExp) {
  const avant = t.fichier();
  const sortie = t.appel(...argv);
  expect(sortie.code, sortie.texte).toBe(1);
  expect(sortie.lignes[0]).toMatch(new RegExp(`^erreur ${categorie} : `));
  expect(sortie.texte).toMatch(message);
  expect(t.fichier(), 'un geste refusé a été écrit au fichier').toBe(avant);
}

describe('un geste sans effet se refuse (`regle`) et ne s’écrit pas', () => {
  it('un effet écrit EN PLACE (un combattant muté, sans nouvel objet d’état) compte : l’empreinte se prend avant l’appel', { timeout: 120_000 }, () => {
    const r = rejouer(nouvelEntete('dome', { graine: 7 }), [{ type: 'confirmRoundStart', args: [] }]);
    const vraie = r.partie;
    try {
      r.partie = { ...vraie, envoyer: () => { vraie.etat().battle!.combatants[0].advantage += 1; return { issue: 'appliquee', evenements: [], journal: [] }; } };
      expect(() => jouerUnGeste(r, { type: 'battleEndTurn', args: [] })).not.toThrow();
      expect(r.gestes, 'le geste à effet en place n’a pas été écrit').toHaveLength(2);
    } finally {
      vraie.fermer();
    }
  });
  it('cascadeNext sans cascade ouverte', { timeout: 120_000 }, () => {
    refuse(partie('dome', ['jouer', 'confirmRoundStart']), ['jouer', 'cascadeNext'], 'regle', /cascadeNext sans effet/);
  });
  it('transitionTo vers une scène inconnue : la ligne du journal est la raison', { timeout: 120_000 }, () => {
    refuse(partie('revisit'), ['jouer', 'transitionTo', '["nulle-part"]'], 'regle', /transitionTo sans effet : \(Scène « nulle-part » introuvable/);
  });
  it('un pas bloqué n’émet qu’un événement informatif : sans effet, l’événement est la raison', { timeout: 120_000 }, () => {
    const t = partie('pont-vitrine', ['jouer', 'stepPartyRelative', '["back"]']);
    refuse(t, ['jouer', 'stepPartyRelative', '["back"]'], 'regle', /stepPartyRelative sans effet : move_blocked/);
    expect(t.appel('vue').texte).toMatch(/groupe \(7,0\)/);
  });
  it('un clic du champ sous un coup ouvert (son jet en attente) : le noyau le refuse, sans aperçu posé', { timeout: 120_000 }, () => {
    const t = table(fixture('attaque-ouverte-dome.jsonl'));
    refuse(t, ['jouer', 'battleClickEntity', '["enemy-enc-dome-1"]'], 'regle', /battleClickEntity sans effet/);
    refuse(t, ['jouer', 'battleClickTile', '[{"x":3,"y":6}]'], 'regle', /battleClickTile sans effet/);
    expect(t.appel('vue').texte).not.toMatch(/aperçu/);
  });
  it('la cascade de `c3`, nettoyée de ses gestes morts, se rejoue sans un seul geste sans effet', { timeout: 240_000 }, () => {
    const r = lireLeFichier(fixture('defaite-dome.jsonl'));
    const rejouee = rejouer(r.entete, r.gestes);
    try {
      expect(rejouee.partie.etat().battle?.over, 'témoin : la partie va jusqu’à la défaite').toBe('defeat');
    } finally {
      rejouee.partie.fermer();
    }
  });
});

describe('la garde du saut est celle du noyau (`sauter`)', () => {
  it('un saut qui ne part pas de la case du groupe est refusé, le groupe ne bouge pas', { timeout: 120_000 }, () => {
    const t = partie('pont-vitrine');
    refuse(t, ['jouer', 'sauter', '[[{"x":13,"y":12},{"x":13,"y":13}],1]'], 'regle', /sauter sans effet : Saut refusé : il part de la case du groupe/);
    expect(t.appel('vue').texte).toMatch(/groupe \(7,1\)/);
  });
  it('un saut depuis la case du groupe vers une case qu’aucun saut n’atteint est refusé', { timeout: 120_000 }, () => {
    refuse(partie('pont-vitrine'), ['jouer', 'sauter', '[[{"x":7,"y":1},{"x":7,"y":5}],1]'], 'regle', /Saut refusé : aucun saut ne mène à cette case/);
  });
});

describe('`moveParty` est un PAS : la garde du verbe est celle du noyau (`pasDuGroupe`)', () => {
  it('un pas vers une case qui n’est pas voisine est refusé, le groupe ne bouge pas', { timeout: 120_000 }, () => {
    const t = partie('pont-vitrine');
    refuse(t, ['jouer', 'moveParty', '[{"x":13,"y":13}]'], 'regle', /moveParty sans effet : Pas refusé/);
    expect(t.appel('vue').texte).toMatch(/groupe \(7,1\)/);
  });
  it('une porte fermée s’ouvre par son id, puis le pas la franchit (« La porte close »)', { timeout: 120_000 }, () => {
    const t = partie('porte-close', ['jouer', 'moveParty', '[{"x":2,"y":1}]']);
    expect(t.appel('vue').texte).toMatch(/portails : 0:2,1:E:exterior:reduit door-closed\(3,1\)/);
    refuse(t, ['jouer', 'moveParty', '[{"x":3,"y":1}]'], 'regle', /Pas refusé/);
    expect(t.appel('jouer', 'actionnerLaPorte', '["0:2,1:E:exterior:reduit"]').code).toBe(0);
    expect(t.appel('jouer', 'moveParty', '[{"x":3,"y":1}]').code).toBe(0);
    expect(t.appel('vue').texte).toMatch(/groupe \(3,1\)/);
  });
});

describe('les arguments de `jouer` se contrôlent contre le type du verbe', () => {
  it.each([
    ['un Pt écrit en tableau', ['jouer', 'battleClickTile', '[[3,6]]'], /pt : un objet JSON \{"x": nombre, "y": nombre, "z"\?: nombre\} attendu/],
    ['un Pt sans y', ['jouer', 'battleClickTile', '[{"x":3}]'], /pt\.y manque/],
    ['un pid nombre', ['jouer', 'cascadeChoose', '[0,"devier"]'], /pid : une chaîne attendue/],
    ['un argument requis manquant', ['jouer', 'cascadeChoose', '[0]'], /l’argument key manque/],
    ['un argument en trop', ['jouer', 'cascadeNext', '[1]'], /0 argument\(s\) au plus/],
  ])('%s lève `validation`', { timeout: 120_000 }, (_cas, argv, message) => {
    refuse(partie('dome', ['jouer', 'confirmRoundStart']), argv, 'validation', message);
  });
  it('une porte se désigne par son id : l’hôte complète le `RoomPortal`, un id inconnu lève `validation`', { timeout: 120_000 }, () => {
    const t = partie('fenetre-ecuries');
    expect(t.appel('vue').texte, 'témoin : la vue nomme la porte par son id').toMatch(/portails : 1:2,4:N:couloir:bureau door-open/);
    refuse(t, ['jouer', 'actionnerLaPorte', '["1:2,4:N:couloir:bureau"]'], 'regle', /actionnerLaPorte sans effet/);
    refuse(t, ['jouer', 'actionnerLaPorte', '["door-open(2,3)"]'], 'validation', /aucun RoomPortal d’id door-open\(2,3\) ici/);
  });
  it('`null` omet un argument optionnel pour poser le suivant', { timeout: 120_000 }, () => {
    const t = partie('revisit', ['jouer', 'transitionTo', '["test-revisit-couloir",null,{"x":1,"y":1}]']);
    expect(t.appel('vue').texte).toMatch(/^scène test-revisit-couloir .*\ngroupe \(1,1\)/);
  });
});

describe('les scénarios et leurs scènes', () => {
  it('`scenarios` liste les ids que `nouvelle` accepte, sans partie', () => {
    const sansDisque: Disque = { lire: () => null, ecrire: () => undefined, ajouter: () => undefined };
    const premiere = executer(['scenarios'], sansDisque);
    expect(premiere.code).toBe(0);
    expect(premiere.texte).toMatch(/\+\d+ : `scenarios --depuis 15`/);
    const ids: string[] = [];
    for (let depuis = 0, enPlus = 1; enPlus > 0; depuis += 15) {
      const page = JSON.parse(executer(['scenarios', '--depuis', String(depuis), '--json'], sansDisque).texte) as { scenarios: string[]; enPlus: number };
      ids.push(...page.scenarios);
      enPlus = page.enPlus;
    }
    expect(ids).toEqual(expect.arrayContaining(['dome', 'revisit', 'fenetre-ecuries', 'siege-enceinte']));
  });
  it('toutes les scènes du scénario sont chargées : `transitionTo` mène à la scène sœur', { timeout: 120_000 }, () => {
    const t = partie('revisit', ['jouer', 'transitionTo', '["test-revisit-couloir"]']);
    expect(t.appel('vue').texte).toMatch(/^scène test-revisit-couloir « Le Couloir »/);
  });
});
