/**
 * LE CŒUR DE L'HÔTE TEXTE (#2898, plan v3 étapes 4 et 6, lots C et D), sans sous-processus : l'hôte (`creerHote`) sur un
 * disque en mémoire (`hote.testkit.ts`). Le rejeu reprend les jetons du lancement avant la ligne 1 ; chaque catégorie
 * d'erreur laisse le fichier intact ; une offre appliquée s'y écrit ; un geste sans effet se refuse ; les arguments de
 * `jouer` se contrôlent contre le type du verbe ; une suite de gestes s'arrête au premier refusé. Le serveur en
 * sous-processus : `serveur.hors-store.test.ts` ; les bornes : `bornes.hors-store.test.ts` ; la vue : `projection.hors-store.test.ts`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { empreinte, jouerUnGeste, lireLeFichier, nouvelEntete, rejouer } from './partieTexte';
import { fermerLaTable, partie, table, verbe } from './hote.testkit';
import type { GesteDeLAgent } from './serveur';

/** Un fichier de partie committé à côté de ce test. */
const fixture = (nom: string): string => readFileSync(new URL(`./${nom}`, import.meta.url), 'utf8');

afterEach(fermerLaTable);

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

/** Le geste est refusé dans sa catégorie, avec ce message, et le fichier reste intact. */
function refuse(t: ReturnType<typeof table>, geste: GesteDeLAgent, categorie: string, message: RegExp) {
  const avant = t.fichier();
  const r = t.jouer(geste);
  expect(r.erreur, r.texte).not.toBeNull();
  expect(r.texte).toMatch(new RegExp(`geste 1/1 refusé, rien de lui ne s’écrit : erreur ${categorie} : `));
  // Une ligne repliée se poursuit sur la suivante, en retrait.
  expect(r.texte.split('\n  ').join(' ')).toMatch(message);
  expect(r.erreur).toBe(categorie);
  expect(t.fichier(), 'un geste refusé a été écrit au fichier').toBe(avant);
}

describe('les erreurs d’un geste : catégorie, drapeau d’erreur, fichier intact', () => {
  it.each([
    ['validation', verbe('nimporte')],
    ['validation', { verbe: 'jouerLOffre', args: ['end-turn'], siege: 0 }],
    ['permission', { verbe: 'battleEndTurn', args: [], siege: 1 }],
    ['regle', { offre: 'disengage' }],
  ] satisfies [string, GesteDeLAgent][])('%s : %j', (categorie, geste) => {
    refuse(partie('dome', verbe('confirmRoundStart')), geste, categorie, /./);
  });
  it('un verbe inconnu nomme les verbes de la fenêtre qui tient la main et ses voisins de nom', () => {
    refuse(partie('dome'), verbe('confirmRound'), 'validation', /verbe inconnu : confirmRound ; verbes de la fenêtre roundStart : confirmRoundStart, roundStartReady, roundStartPromote, armPreempt ; voisins : confirmRoundStart/);
  });
});

describe('la partie et son fichier', () => {
  it('une offre appliquée s’y écrit, telle que jouée', () => {
    const t = partie('dome', verbe('confirmRoundStart'));
    const r = t.jouer({ offre: 'charge' });
    expect(r.erreur, r.texte).toBeNull();
    expect(t.fichier().trimEnd().split('\n').pop()).toBe('{"offre":"charge"}');
  });
  it('une suite s’arrête au premier geste refusé : les précédents s’écrivent, lui non, la réponse dit combien sont passés', () => {
    const t = partie('dome');
    const r = t.jouer(verbe('confirmRoundStart'), { offre: 'charge' }, verbe('cascadeNext'), verbe('battleEndTurn'));
    expect(r.erreur, r.texte).not.toBeNull();
    expect(r.lignes[0]).toMatch(/^2\/4 appliqués : confirmRoundStart · offre charge/);
    expect(r.texte).toMatch(/geste 3\/4 refusé, rien de lui ne s’écrit : erreur regle : cascadeNext sans effet/);
    expect(r.texte, 'une seule vue, à la fin').toMatch(/intention armée : charge/);
    expect(t.fichier().trimEnd().split('\n')).toHaveLength(3);
  });
  it('un fichier changé hors de l’hôte se rejoue : la partie est ce qu’il porte', () => {
    const t = partie('dome', verbe('confirmRoundStart'), { offre: 'charge' });
    t.disque.ecrire('p', t.fichier().trimEnd().split('\n').slice(0, 2).join('\n') + '\n');
    expect(t.lire('vue').texte).not.toMatch(/intention armée/);
  });
  it('un geste refusé qui a touché l’état (son refus) ne laisse rien en mémoire : la partie est rejouée depuis le fichier', () => {
    const t = partie('pont-vitrine', verbe('stepPartyRelative', 'back'));
    const avant = t.lire('vue').texte;
    refuse(t, verbe('sauter', [{ x: 13, y: 12 }, { x: 13, y: 13 }], 1), 'regle', /sauter sans effet : Saut refusé/);
    expect(t.lire('vue').texte, 'la mémoire a divergé du fichier : la vue garde le refus').toBe(avant);
  });
  it('deux rejeux d’un fichier dans un même processus rendent la même empreinte (les séquences d’ids repartent de zéro)', () => {
    const { entete, gestes } = lireLeFichier(fixture('combat-dome.jsonl'));
    const empreintes = [0, 1, 2].map(() => {
      const r = rejouer(entete, gestes);
      try {
        return empreinte(r.partie.etat());
      } finally {
        r.partie.fermer();
      }
    });
    expect(new Set(empreintes).size, empreintes.join(' ')).toBe(1);
  });
  it('une partie tenue par un autre serveur se refuse en `permission`, en nommant qui la tient', () => {
    const t = table(fixture('combat-dome.jsonl'));
    t.disque.prendre = () => 'le processus 42, un autre serveur de l’hôte';
    const r = t.lire('vue', { partie: 'p' });
    expect(r.erreur).not.toBeNull();
    expect(r.texte).toMatch(/^erreur permission : la partie p est tenue par le processus 42/);
  });
  it('la partie ouverte est tenue tant qu’elle est ouverte, rendue à sa fermeture', () => {
    const t = partie('dome');
    expect([...t.tenues]).toEqual(['p']);
    t.hote.fermer();
    expect([...t.tenues]).toEqual([]);
  });
});

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
    refuse(partie('dome', verbe('confirmRoundStart')), verbe('cascadeNext'), 'regle', /cascadeNext sans effet/);
  });
  it('une Dissipation sans Langue (Magick) ne dit sa raison qu’au journal : sans effet, la ligne du journal est la raison', { timeout: 120_000 }, () => {
    refuse(partie('revisit'), verbe('oocDispelSpell', 'pregen-101', 'nulle-part', 'pregen-101'), 'regle', /oocDispelSpell sans effet : Il faut la compétence Langue \(Magick\)/);
  });
  it('un pas bloqué n’émet qu’un événement informatif : sans effet, l’événement est la raison', { timeout: 120_000 }, () => {
    const t = partie('pont-vitrine', verbe('stepPartyRelative', 'back'));
    refuse(t, verbe('stepPartyRelative', 'back'), 'regle', /stepPartyRelative sans effet : move_blocked/);
    expect(t.lire('vue').texte).toMatch(/groupe \(7,0\)/);
  });
  it('un clic du champ sous un coup ouvert (son jet en attente) : le noyau le refuse, sans aperçu posé', { timeout: 120_000 }, () => {
    const t = table(fixture('attaque-ouverte-dome.jsonl'));
    refuse(t, verbe('battleClickEntity', 'enemy-enc-dome-1'), 'regle', /battleClickEntity sans effet/);
    refuse(t, verbe('battleClickTile', { x: 3, y: 6 }), 'regle', /battleClickTile sans effet/);
    expect(t.lire('vue').texte).not.toMatch(/aperçu/);
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
    refuse(t, verbe('sauter', [{ x: 13, y: 12 }, { x: 13, y: 13 }], 1), 'regle', /sauter sans effet : Saut refusé : il part de la case du groupe/);
    expect(t.lire('vue').texte).toMatch(/groupe \(7,1\)/);
  });
  it('un saut depuis la case du groupe vers une case qu’aucun saut n’atteint est refusé', { timeout: 120_000 }, () => {
    refuse(partie('pont-vitrine'), verbe('sauter', [{ x: 7, y: 1 }, { x: 7, y: 5 }], 1), 'regle', /Saut refusé : aucun saut ne mène à cette case/);
  });
});

describe('`moveParty` est un PAS : la garde du verbe est celle du noyau (`pasDuGroupe`)', () => {
  it('un pas vers une case qui n’est pas voisine est refusé, le groupe ne bouge pas', { timeout: 120_000 }, () => {
    const t = partie('pont-vitrine');
    refuse(t, verbe('moveParty', { x: 13, y: 13 }), 'regle', /moveParty sans effet : Pas refusé/);
    expect(t.lire('vue').texte).toMatch(/groupe \(7,1\)/);
  });
  it('une porte fermée s’ouvre par son id, puis le pas la franchit (« La porte close »)', { timeout: 120_000 }, () => {
    const t = partie('porte-close', verbe('moveParty', { x: 2, y: 1 }));
    expect(t.lire('vue').texte).toContain('Porte extérieure fermée : `jouer {"gestes":[{"verbe":"actionnerLaPorte","args":["0:2,1:E:exterior:reduit"]}]}`');
    refuse(t, verbe('moveParty', { x: 3, y: 1 }), 'regle', /Pas refusé/);
    const r = t.jouer(verbe('actionnerLaPorte', '0:2,1:E:exterior:reduit'), verbe('moveParty', { x: 3, y: 1 }));
    expect(r.erreur, r.texte).toBeNull();
    expect(t.lire('vue').texte).toMatch(/groupe \(3,1\)/);
  });
});

describe('les arguments de `jouer` se contrôlent contre le type du verbe', () => {
  it.each([
    ['un Pt écrit en tableau', verbe('battleClickTile', [3, 6]), /pt : un objet JSON \{"x": nombre, "y": nombre, "z"\?: nombre\} attendu/],
    ['un Pt sans y', verbe('battleClickTile', { x: 3 }), /pt\.y manque/],
    ['un pid nombre', verbe('cascadeChoose', 0, 'devier'), /pid : une chaîne attendue/],
    ['un argument requis manquant', verbe('cascadeChoose', 0), /l’argument key manque/],
    ['un argument en trop', verbe('cascadeNext', 1), /0 argument\(s\) au plus/],
  ] as const)('%s lève `validation`', { timeout: 120_000 }, (_cas, geste, message) => {
    refuse(partie('dome', verbe('confirmRoundStart')), geste, 'validation', message);
  });
  it('une porte se désigne par son id : l’hôte complète le `RoomPortal`, un id inconnu lève `validation`', { timeout: 120_000 }, () => {
    const t = partie('fenetre-ecuries');
    refuse(t, verbe('actionnerLaPorte', '1:2,4:N:couloir:bureau'), 'regle', /actionnerLaPorte sans effet/);
    refuse(t, verbe('actionnerLaPorte', 'door-open(2,3)'), 'validation', /portail : "door-open\(2,3\)" n’est pas un id de porte \(valides : 1:2,4:N:couloir:bureau\)/);
  });
  it('`null` omet un argument optionnel pour poser le suivant', { timeout: 120_000 }, () => {
    const t = partie('revisit', verbe('transitionTo', 'test-revisit-couloir', null, { x: 1, y: 1 }));
    expect(t.lire('vue').texte).toMatch(/^scène test-revisit-couloir [^]*\ngroupe \(1,1\)/);
  });
});

describe('les verbes et les scènes', () => {
  it('`lire verbes` rend la signature d’un verbe, ou les verbes dont le nom contient un morceau, sans partie', () => {
    const t = table();
    expect(t.lire('verbes', { id: 'sauter' }).texte).toBe('sauter(chemin: [{"x": nombre, "y": nombre, "z"?: nombre}, …], indice: nombre)');
    expect(t.lire('verbes', { id: 'RoundStart' }).texte).toMatch(/confirmRoundStart/);
    const tous = t.lire('verbes');
    expect(tous.erreur).toBeNull();
    expect(tous.texte).toMatch(/\+\d+ : `lire \{"quoi":"verbes","depuis":80\}`/);
  });
  it('toutes les scènes du scénario sont chargées : `transitionTo` mène à la scène sœur', { timeout: 120_000 }, () => {
    const t = partie('revisit', verbe('transitionTo', 'test-revisit-couloir'));
    expect(t.lire('vue').texte).toMatch(/^scène test-revisit-couloir « Le Couloir »/);
  });
});

describe('une réponse dit ce qui attendait le geste suivant, et qui tient la main', () => {
  it('l’aperçu du premier clic et la fin de tour armée que la fin du tour lève', () => {
    const t = partie('dome', verbe('confirmRoundStart'));
    const r = t.jouer(verbe('battleClickTile', { x: 3, y: 5 }), { offre: 'end-turn' }, { offre: 'end-turn' });
    expect(r.erreur, r.texte).toBeNull();
    expect(r.texte.split('\n  ').join(' ')).toMatch(/levé : aperçu move → \(3,5\), fin de tour armée/);
  });

  it('un refus de permission nomme qui tient la main et son siège', () => {
    const t = partie('dome', verbe('confirmRoundStart'));
    refuse(t, { verbe: 'battleClickTile', args: [{ x: 3, y: 6 }], siege: 1 }, 'permission', /refusée au siège 1 : la main est à Ilyanwe la Voilée, siège 0/);
  });

  it('un clic au nom du siège qui tient la main voit l’intention armée : son aperçu, puis la Charge au même clic', () => {
    const t = partie('dome', verbe('confirmRoundStart'));
    const clic = { verbe: 'battleClickEntity', args: ['enemy-enc-dome-1'], siege: 0 };
    const apercu = t.jouer({ offre: 'charge' }, clic);
    expect(apercu.erreur, apercu.texte).toBeNull();
    expect(apercu.texte).toMatch(/^aperçu : charge → enemy-enc-dome-1 \(le même clic confirme\)$/m);
    expect(t.jouer(clic).texte).toMatch(/Ilyanwe la Voilée charge Orc/);
  });
});
