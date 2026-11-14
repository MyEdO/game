/**
 * LE CŒUR DE L'HÔTE TEXTE (#2898, plan v3 étapes 4 et 6, lots C et D), sans sous-processus : l'hôte (`creerHote`) sur un
 * disque en mémoire (`hote.testkit.ts`). Le rejeu reprend les jetons du lancement avant la ligne 1 ; chaque catégorie
 * d'erreur laisse le fichier intact ; un geste d'offre appliqué s'y écrit ; un geste sans effet se refuse ; les arguments de
 * `jouer` se contrôlent contre le type du verbe ; une suite de gestes s'arrête au premier refusé. Le serveur en
 * sous-processus : `serveur.hors-store.test.ts` ; les bornes : `bornes.hors-store.test.ts` ; la vue : `projection.hors-store.test.ts`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { empreinte, jouerUnGeste, lireLeFichier, rejouer } from './partieTexte';
import { nouvelEntete } from '../hote/partie';
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
    ['permission', { verbe: 'terminerLeTour', args: [], siege: 1 }],
    ['regle', verbe('rompreLEngagement')],
  ] satisfies [string, GesteDeLAgent][])('%s : %j', (categorie, geste) => {
    refuse(partie('dome', verbe('fenetreValider', 'debutDuRound')), geste, categorie, /./);
  });
  it('un verbe inconnu nomme les gestes de la fenêtre qui tient la main et ses voisins de nom', () => {
    refuse(partie('dome'), verbe('fenetreValid'), 'validation', /verbe inconnu : fenetreValid ; gestes de la fenêtre debutDuRound : fenetreChoisir@debutDuRound#promouvoir, fenetreChoisir@debutDuRound#viser, cliquerLaCase, fenetreValider@debutDuRound ; voisins : fenetreValider/);
  });
});

describe('une écriture du noyau n’est pas un geste (`MachinerieDuNoyau`, #3370)', () => {
  it('`jouer` refuse `lancerLaScene` en `validation`, verbe inconnu', () => {
    refuse(partie('dome'), verbe('lancerLaScene', {}), 'validation', /verbe inconnu : lancerLaScene/);
  });
  it('le rejeu refuse la ligne du fichier qui nomme `lancerLaScene`, avec son rang', () => {
    const t = partie('dome', verbe('fenetreValider', 'debutDuRound'));
    t.disque.ecrire('p', `${t.fichier()}{"type":"lancerLaScene","args":[{}]}\n`);
    const r = t.lire('vue');
    expect(r.erreur, r.texte).toBe('validation');
    expect(r.texte.split('\n  ').join(' ')).toMatch(/ligne 3 du fichier ne se rejoue plus : verbe inconnu : lancerLaScene/);
  });
});

describe('la partie et son fichier', () => {
  it('le geste d’une offre appliqué s’y écrit, tel que joué', () => {
    const t = partie('dome', verbe('fenetreValider', 'debutDuRound'));
    const r = t.jouer(verbe('armerLIntention', 'charge'));
    expect(r.erreur, r.texte).toBeNull();
    expect(t.fichier().trimEnd().split('\n').pop()).toBe('{"type":"armerLIntention","args":["charge"]}');
  });
  it('une suite s’arrête au premier geste refusé : les précédents s’écrivent, lui non, la réponse dit combien sont passés', () => {
    const t = partie('dome');
    const r = t.jouer(verbe('fenetreValider', 'debutDuRound'), verbe('armerLIntention', 'charge'), verbe('jetValider', 'cascade'), verbe('terminerLeTour'));
    expect(r.erreur, r.texte).not.toBeNull();
    expect(r.lignes[0]).toMatch(/^2\/4 appliqués : fenetreValider · armerLIntention/);
    expect(r.texte).toMatch(/geste 3\/4 refusé, rien de lui ne s’écrit : erreur regle : jetValider sans effet/);
    expect(r.texte, 'une seule vue, à la fin').toMatch(/intention armée : charge/);
    expect(t.fichier().trimEnd().split('\n')).toHaveLength(3);
  });
  it('un fichier changé hors de l’hôte se rejoue : la partie est ce qu’il porte', () => {
    const t = partie('dome', verbe('fenetreValider', 'debutDuRound'), verbe('armerLIntention', 'charge'));
    t.disque.ecrire('p', t.fichier().trimEnd().split('\n').slice(0, 2).join('\n') + '\n');
    expect(t.lire('vue').texte).not.toMatch(/intention armée/);
  });
  it('un geste refusé qui a touché l’état (son refus) ne laisse rien en mémoire : la partie est rejouée depuis le fichier', () => {
    const t = partie('pont-vitrine', verbe('avancerDUnPas', 'arriere'));
    const avant = t.lire('vue').texte;
    refuse(t, verbe('franchirLArete', { x: 13, y: 13 }), 'regle', /franchirLArete sans effet : /);
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
    const r = rejouer(nouvelEntete('dome', { graine: 7 }), [{ type: 'fenetreValider', args: ['debutDuRound'] }]);
    const vraie = r.partie;
    try {
      r.partie = { ...vraie, envoyer: () => { vraie.etat().battle!.combatants[0].advantage += 1; return { issue: 'appliquee', evenements: [], journal: [] }; } };
      expect(() => jouerUnGeste(r, { type: 'terminerLeTour', args: [] })).not.toThrow();
      expect(r.gestes, 'le geste à effet en place n’a pas été écrit').toHaveLength(2);
    } finally {
      vraie.fermer();
    }
  });
  it('valider une étape sans cascade ouverte', { timeout: 120_000 }, () => {
    refuse(partie('dome', verbe('fenetreValider', 'debutDuRound')), verbe('jetValider', 'cascade'), 'regle', /jetValider sans effet/);
  });
  it('une Dissipation sans Langue (Magick) ne dit sa raison qu’au journal : sans effet, la ligne du journal est la raison', { timeout: 120_000 }, () => {
    refuse(partie('revisit'), verbe('dissiperLeSort', 'soldat-de-test', 'arme-aethyrique', 'soldat-de-test'), 'regle', /dissiperLeSort sans effet : Il faut la compétence Langue \(Magick\)/);
  });
  it('un pas bloqué n’émet qu’un événement informatif : sans effet, l’événement est la raison', { timeout: 120_000 }, () => {
    const t = partie('pont-vitrine', verbe('avancerDUnPas', 'arriere'));
    refuse(t, verbe('avancerDUnPas', 'arriere'), 'regle', /avancerDUnPas sans effet : move_blocked/);
    expect(t.lire('vue').texte).toMatch(/groupe \(7,0\)/);
  });
  it('un clic du champ sous un coup ouvert (son jet en attente) : le noyau le refuse, sans aperçu posé', { timeout: 120_000 }, () => {
    const t = table(fixture('attaque-ouverte-dome.jsonl'));
    refuse(t, verbe('cliquerLaCase', { x: 7, y: 5 }, 'enemy-enc-dome-1'), 'regle', /cliquerLaCase sans effet/);
    refuse(t, verbe('cliquerLaCase', { x: 3, y: 6 }), 'regle', /cliquerLaCase sans effet/);
    expect(t.lire('vue').texte).not.toMatch(/aperçu/);
  });
  it('la cascade de `c3`, nettoyée de ses gestes morts, se rejoue sans un seul geste sans effet', { timeout: 240_000 }, () => {
    const r = lireLeFichier(fixture('defaite-dome.jsonl'));
    const rejouee = rejouer(r.entete, r.gestes);
    try {
      expect(rejouee.partie.etat().battle?.over, 'témoin : la partie va jusqu’à la défaite').toBe('defaite');
    } finally {
      rejouee.partie.fermer();
    }
  });
});

describe('`cliquerLaCase` mène le groupe jusqu’à la case, en une passe (`marcherLeChemin`)', () => {
  it('une case au-delà du gouffre : le groupe saute (`sauter`) et atterrit sur la case cliquée', { timeout: 120_000 }, () => {
    const t = partie('pont-vitrine');
    const r = t.jouer(verbe('cliquerLaCase', { x: 7, y: 5 }));
    expect(r.erreur, r.texte).toBeNull();
    expect(t.lire('vue').texte).toMatch(/groupe \(7,5\) étage 0/);
  });
  it('une porte fermée arrête la marche ; ouverte par son id, le clic la franchit (« La porte close »)', { timeout: 120_000 }, () => {
    const t = partie('porte-close', verbe('cliquerLaCase', { x: 2, y: 1 }));
    expect(t.lire('vue').texte).toContain('Porte extérieure fermée : `jouer {"gestes":[{"verbe":"actionnerLaPorte","args":["0:2,1:E:exterior:reduit"]}]}`');
    refuse(t, verbe('cliquerLaCase', { x: 3, y: 1 }), 'regle', /cliquerLaCase sans effet/);
    const r = t.jouer(verbe('actionnerLaPorte', '0:2,1:E:exterior:reduit'), verbe('cliquerLaCase', { x: 3, y: 1 }));
    expect(r.erreur, r.texte).toBeNull();
    expect(t.lire('vue').texte).toMatch(/groupe \(3,1\)/);
  });
});

describe('les arguments de `jouer` se contrôlent contre le type du verbe', () => {
  it.each([
    ['un Pt écrit en tableau', verbe('cliquerLaCase', [3, 6]), /pt : un objet JSON \{"x": nombre, "y": nombre, "z"\?: nombre\} attendu/],
    ['un Pt sans y', verbe('cliquerLaCase', { x: 3 }), /pt\.y manque/],
    ['un pid nombre', verbe('jetLancer', 'cascade', 0), /pid : une chaîne attendue/],
    ['un argument requis manquant', verbe('dissiperLeSort', 'sorciere'), /l’argument spellId manque/],
    ['un argument en trop', verbe('jetValider', 'cascade', 1), /1 argument\(s\) au plus/],
    ['un Indice de placement à 0 (LDB 23 l.168 : de 1 à 10)', verbe('deposerALaBanque', 'sorciere', 'investir', 120, 0), /indice : .* n’est pas une valeur admise \(admises : 1, 2, 3, 4, 5, 6, 7, 8, 9, 10\)/],
    ['un Indice de placement à 11', verbe('deposerALaBanque', 'sorciere', 'investir', 120, 11), /indice : .* n’est pas une valeur admise \(admises : 1, 2, 3, 4, 5, 6, 7, 8, 9, 10\)/],
    ['un Indice de placement non entier', verbe('deposerALaBanque', 'sorciere', 'investir', 120, 3.5), /indice : .* n’est pas une valeur admise \(admises : 1, 2, 3, 4, 5, 6, 7, 8, 9, 10\)/],
    ['un Indice de placement écrit en texte', verbe('deposerALaBanque', 'sorciere', 'investir', 120, '3'), /indice : .* n’est pas une valeur admise \(admises : 1, 2, 3, 4, 5, 6, 7, 8, 9, 10\)/],
  ] as const)('%s lève `validation`', { timeout: 120_000 }, (_cas, geste, message) => {
    refuse(partie('dome', verbe('fenetreValider', 'debutDuRound')), geste, 'validation', message);
  });
  it('une porte se désigne par son id, que le noyau résout parmi les accès du groupe ; un id inconnu lève `validation`', { timeout: 120_000 }, () => {
    const t = partie('fenetre-ecuries');
    refuse(t, verbe('actionnerLaPorte', '1:2,4:N:couloir:bureau'), 'regle', /actionnerLaPorte sans effet/);
    refuse(t, verbe('actionnerLaPorte', 'door-open(2,3)'), 'validation', /porte : "door-open\(2,3\)" n’est pas un id de porte \(valides : 1:2,4:N:couloir:bureau\)/);
  });
  it('`null` omet un argument optionnel pour poser le suivant', { timeout: 120_000 }, () => {
    const t = partie('revisit', verbe('cliquerLaCase', { x: 1, y: 0 }, null, { confirm: true }));
    expect(t.lire('vue').texte).toMatch(/^scène test-revisit-reserve [^]*\ngroupe \(1,0\)/);
  });
});

describe('les verbes et les scènes', () => {
  it('`lire verbes` rend la signature d’un verbe, ou les verbes dont le nom contient un morceau, sans partie', () => {
    const t = table();
    expect(t.lire('verbes', { id: 'cliquerLaCase' }).texte).toBe('cliquerLaCase(pt: {"x": nombre, "y": nombre, "z"?: nombre}, entite?: id de combattant ou d’entité de scène, opts?: {"confirm"?: booleen, "intentionId"?: id\n  d’intention})');
    expect(t.lire('verbes', { id: 'LObjet' }).texte).toMatch(/evaluerLObjet/);
    const tous = t.lire('verbes');
    expect(tous.erreur).toBeNull();
    expect(tous.texte).toMatch(/\+\d+ : `lire \{"quoi":"verbes","depuis":80\}`/);
  });
  it('toutes les scènes du scénario sont chargées : la sortie de la Réserve mène à la scène sœur', { timeout: 120_000 }, () => {
    const t = partie('revisit', verbe('cliquerLaCase', { x: 5, y: 1 }));
    expect(t.lire('vue').texte).toMatch(/^scène test-revisit-couloir « Le Couloir »/);
  });
});

describe('une réponse dit ce qui attendait le geste suivant, et qui tient la main', () => {
  it('l’aperçu du premier clic et la fin de tour armée que la fin du tour lève', () => {
    const t = partie('dome', verbe('fenetreValider', 'debutDuRound'));
    const r = t.jouer(verbe('cliquerLaCase', { x: 3, y: 5 }), verbe('terminerLeTour'), verbe('terminerLeTour'));
    expect(r.erreur, r.texte).toBeNull();
    expect(r.texte.split('\n  ').join(' ')).toMatch(/levé : aperçu deplacement → \(3,5\), fin de tour armée/);
  });

  it('un refus de permission nomme qui tient la main et son siège', () => {
    const t = partie('dome', verbe('fenetreValider', 'debutDuRound'));
    refuse(t, { verbe: 'cliquerLaCase', args: [{ x: 3, y: 6 }], siege: 1 }, 'permission', /refusée au siège 1 : la main est à Ilyanwe la Voilée, siège 0/);
  });

  it('un clic au nom du siège qui tient la main voit l’intention armée : son aperçu, puis la Charge au même clic', () => {
    const t = partie('dome', verbe('fenetreValider', 'debutDuRound'));
    const clic = { verbe: 'cliquerLaCase', args: [{ x: 7, y: 5 }, 'enemy-enc-dome-1'], siege: 0 };
    const apercu = t.jouer(verbe('armerLIntention', 'charge'), clic);
    expect(apercu.erreur, apercu.texte).toBeNull();
    expect(apercu.texte).toMatch(/^aperçu : charge → enemy-enc-dome-1 \(le même clic confirme\)$/m);
    expect(t.jouer(clic).texte).toMatch(/Ilyanwe la Voilée charge Orc/);
  });
});
