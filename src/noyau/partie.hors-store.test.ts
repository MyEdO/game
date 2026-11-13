/**
 * LA PARTIE, sans store (#2817 D9) : un hôte qui n'a que la surface du noyau (`./index`) joue une attaque
 * jusqu'à la clôture du combat, puis une intention de siège sans verdict. Les dés viennent des entrées
 * (graine, dés fixés). Le duel est celui de `combatDeTest.testkit.ts`, dans la scène de fixture.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  creerPartie,
  etatInitialDuJeu,
  instantaneDeLaCoop,
  previewAttack,
  type EntreesDeLaPartie,
  type EtatDeJeu,
  type Intention,
  type Jeton,
  type Partie,
  type ResultatDeLAppel,
} from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { BRUNA, etatAttable, rangsAssis } from './taverneAttablee.testkit';
import { testScene } from '../scenes/test-fixture';
import { CLASSE_DES_ACTIONS_DU_NOYAU } from './intentionsDeSiege';
import { portesDuMobile } from './marcheDuGroupe';
import { emptyScene } from './monde/scene';
import { t } from '../i18n';
import { bus, EVT } from './bus';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

const emis = ({ evenements }: ResultatDeLAppel) => evenements.flatMap((e) => (e.type === 'emis' ? [e.evt] : []));

/** Le duel ouvert par une première partie, puis gardé par l'hôte : `garder` réécrit l'état gardé avant
 *  la partie qui le reprend. La première partie fermée, la seconde s'ouvre dans le même contexte. */
function duel(garder: (etat: EtatDeJeu, duel: ReturnType<typeof auContact>) => EtatDeJeu = (e) => e) {
  const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
  expect(emis(ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' }))).toContain('arrivee_en_scene');
  ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
  const garde = ouverture.etat();
  ouverture.fermer();
  const contact = auContact(garde);
  return { ...contact, partie: creerPartie(garder({ ...garde, ...contact.patch }, contact), ENTREES) };
}

const combattant = (partie: Partie, id: string) => partie.etat().battle!.combatants.find((c) => c.id === id)!;

/** L'état d'un invité du siège 1 d'une session. */
const chezLInvite = (etat: EtatDeJeu): EtatDeJeu => ({ ...etat, net: { ...etat.net, mode: 'invite', mySeat: 1, roomCode: 'ABCDEF' } });

describe('creerPartie — une attaque jouée par la seule surface du noyau', () => {
  it('déclaration, jet, défense, critique, mise hors de combat, puis `jetValider@cascade` jusqu’à la clôture', () => {
    const { H, E, partie } = duel((etat, { E }) => {
      E.wounds.current = 1;
      return etat;
    });
    try {
      // `etat` est un `Get` : un lecteur de la surface s'y branche sans cast.
      expect(previewAttack(partie.etat, combattant(partie, H.id), combattant(partie, E.id)).soak, 'l’aperçu ne lit pas la cible').toBeGreaterThan(0);
      partie.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] });
      expect(partie.etat().pendingAttack, 'la déclaration n’a pas ouvert la fenêtre d’attaque').toMatchObject({ targetId: E.id, result: null });
      partie.envoyer({ type: 'jetLancer', args: ['attaque'] });
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['attaque', 11] });
      const res = partie.etat().pendingAttack!.result!;
      expect(res.attackerRoll, 'le dé fixé de l’entrée n’a pas été posé').toBe(11);
      expect(res.defenderDetail, 'la défense du Mutant n’a pas été jouée').toBeTruthy();
      expect(res).toMatchObject({ hit: true, critical: true });

      const confirmation = partie.envoyer({ type: 'jetValider', args: ['attaque'] });
      expect(confirmation.issue).toBe('appliquee');
      expect(emis(confirmation)).toContain('anim_attack');
      expect(confirmation.journal.flatMap((l) => (l.de === 'combat' ? [l.evenement.kind] : [])), 'l’appel ne rend pas les lignes de combat qu’il a écrites').toEqual(expect.arrayContaining(['critique', 'mort']));
      expect(partie.etat().battle!.log.map((l) => l.kind)).toEqual(expect.arrayContaining(['critique', 'mort']));
      expect(combattant(partie, E.id).conditions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'inconscient' })]));
      expect(confirmation.evenements, 'l’État gagné par l’appel se rend, une fois').toEqual(expect.arrayContaining([{ type: 'etatGagne', porteur: E.id, etat: 'inconscient' }]));
      expect(partie.envoyer({ type: 'jetValider', args: ['cascade'] }).evenements.filter((e) => e.type === 'etatGagne' && e.etat === 'inconscient'), 'un État déjà porté ne se regagne pas').toEqual([]);

      const fin: string[] = [];
      for (let pas = 0; partie.etat().pendingCascade && pas < 10; pas++) {
        const cascade = partie.etat().pendingCascade!;
        const rangee = cascade.participants[cascade.cursor]?.participants?.find((r) => !r.result);
        fin.push(...emis(partie.envoyer(rangee ? { type: 'jetLancer', args: ['cascadeEnBande', rangee.id] } : { type: 'jetValider', args: ['cascade'] })));
      }
      expect(partie.etat().pendingCascade, 'la cascade de fin de combat ne s’est pas close').toBeNull();
      expect(partie.etat().battle!.over).toBe('victoire');
      expect(fin).toContain('battle_over');
    } finally {
      partie.fermer();
    }
  });

  it('une intention de siège sans verdict ne court pas et laisse l’intention armée du propriétaire', () => {
    const { H, partie: armee } = duel((etat, { H }) => ({ ...etat, net: { ...etat.net, mode: 'hote', mySeat: 0, ownership: { [H.id]: 0 }, slots: [1, 0, 0, 0] } }));
    armee.envoyer({ type: 'armerLIntention', args: ['course'] });
    expect(armee.etat().localIntent, 'témoin : le propriétaire a armé SA Course').toEqual({ actionId: 'course' });
    const garde = armee.etat();
    armee.fermer();
    const partie = creerPartie({ ...garde, net: { ...garde.net, ownership: { [H.id]: 1 } } }, ENTREES);
    try {
      const loin = { x: H.pos!.x - 6, y: H.pos!.y };
      const horsPossession = partie.envoyer({ type: 'cliquerLaCase', args: [loin, undefined, { confirm: true }], siege: 2 });
      expect(horsPossession.issue, 'un siège qui ne possède pas l’acteur a passé la possession').toBe('refusee');
      expect(horsPossession.journal.map((l) => l.de), 'le refus n’a rien écrit au journal').toEqual(['journal']);
      expect(partie.envoyer({ type: 'cliquerLaCase', args: [loin, undefined, { confirm: true }], siege: 1 }).issue).toBe('appliquee');
      expect(partie.etat().refus?.texte ?? '', 'témoin : le geste du siège a passé la possession, puis été refusé faute de verdict').toContain('Course');
      expect(partie.etat().localIntent, 'le clic du siège a dissous l’intention du propriétaire').toEqual({ actionId: 'course' });
      expect(partie.etat().pendingRun ?? partie.etat().pendingCascade, 'le siège a couru sur la case du propriétaire').toBeFalsy();
      expect(combattant(partie, H.id).pos).toEqual({ x: 10, y: 10 });
    } finally {
      partie.fermer();
    }
  });
});

describe('creerPartie — l’intention sans siège joue l’action de l’état (#3009)', () => {
  it('chez un invité, un verbe de l’allowlist part à l’hôte par l’enrobage, rien ne se joue chez lui', () => {
    const partie = creerPartie(chezLInvite(etatAttable()), ENTREES);
    try {
      const envoi = vi.fn();
      partie.etat().transmettreLesIntentions(envoi);
      partie.envoyer({ type: 'renvoyerLeHeros', args: [BRUNA.id] });
      expect(envoi.mock.calls).toEqual([['renvoyerLeHeros', [BRUNA.id]]]);
      expect(partie.etat().party.map((h) => h.id), 'l’invité a renvoyé le héros dans sa copie').toContain(BRUNA.id);
    } finally {
      partie.fermer();
    }
  });

  it('chez un invité, l’intention armée (verbe `local`) se pose chez lui sans partir, puis le clic du champ part avec son `intentionId`', () => {
    const { H, partie: ouverte } = duel();
    const garde = ouverte.etat();
    ouverte.fermer();
    const partie = creerPartie(chezLInvite({ ...garde, net: { ...garde.net, ownership: { [H.id]: 1 }, slots: [1, 0, 0, 0] } }), ENTREES);
    try {
      const envoi = vi.fn();
      partie.etat().transmettreLesIntentions(envoi);
      partie.envoyer({ type: 'armerLIntention', args: ['course'] });
      expect(partie.etat().localIntent, 'l’intention armée se pose chez l’invité').toEqual({ actionId: 'course' });
      expect(envoi, 'un verbe `local` ne part pas').not.toHaveBeenCalled();
      const loin = { x: H.pos!.x - 6, y: H.pos!.y };
      partie.envoyer({ type: 'cliquerLaCase', args: [loin, undefined, { confirm: true }] });
      expect(envoi.mock.calls).toEqual([['cliquerLaCase', [loin, undefined, { confirm: true, intentionId: 'course' }]]]);
      expect(combattant(partie, H.id).pos, 'le clic ne s’est pas joué chez l’invité').toEqual(H.pos);
    } finally {
      partie.fermer();
    }
  });

  /** Les verbes de classe `hôte`, lus à la table. */
  const VERBES_D_HOTE = Object.entries(CLASSE_DES_ACTIONS_DU_NOYAU).flatMap(([verbe, classe]) => (classe === 'hôte' ? [verbe as keyof typeof CLASSE_DES_ACTIONS_DU_NOYAU] : []));
  /** L'intention d'un verbe envoyée sans argument : la garde passe avant toute lecture des arguments. */
  const sansArgument = (verbe: string): Intention => ({ type: verbe, args: [] }) as unknown as Intention;
  /** L'état sans fonction ni journal, ni son compte : ce qu'un geste refusé ne doit pas changer. */
  const horsJournal = (partie: Partie): string => JSON.stringify({ ...partie.etat(), journal: undefined, lignesAuJournal: undefined });

  it('chez un invité, hors combat, chaque verbe `hôte` se refuse au journal sans rien jouer ni envoyer', () => {
    expect(VERBES_D_HOTE.length, 'la table ne compte aucun verbe `hôte`').toBeGreaterThan(0);
    const partie = creerPartie(chezLInvite(etatAttable()), ENTREES);
    try {
      const envoi = vi.fn();
      partie.etat().transmettreLesIntentions(envoi);
      for (const verbe of VERBES_D_HOTE) {
        const avant = horsJournal(partie);
        const appel = partie.envoyer(sansArgument(verbe));
        expect(appel.issue, verbe).toBe('appliquee');
        expect(appel.journal, `${verbe} : le refus n’est pas la seule ligne de l’appel`).toEqual([expect.objectContaining({ de: 'journal', texte: t('coop.hoteSeul') })]);
        expect(horsJournal(partie), `${verbe} s’est joué dans la copie de l’invité`).toBe(avant);
      }
      expect(envoi, 'un verbe `hôte` est parti à l’hôte').not.toHaveBeenCalled();
    } finally {
      partie.fermer();
    }
  });

  it('chez un invité, en combat, chaque verbe `hôte` pose son refus à la bannière', () => {
    const { partie: ouverte } = duel();
    const garde = ouverte.etat();
    ouverte.fermer();
    const partie = creerPartie(chezLInvite(garde), ENTREES);
    try {
      for (const verbe of VERBES_D_HOTE) {
        const refusPrecedent = partie.etat().refus;
        partie.envoyer(sansArgument(verbe));
        expect(partie.etat().refus, `${verbe} n’a pas posé de refus neuf`).not.toBe(refusPrecedent);
        expect(partie.etat().refus?.texte, verbe).toBe(t('coop.hoteSeul'));
      }
    } finally {
      partie.fermer();
    }
  });

  it('M3 (e) : chez un invité, une intention qui porte un siège se refuse sans rien jouer, émettre ni envoyer, hors combat et en combat', () => {
    const attable = creerPartie(chezLInvite(etatAttable()), ENTREES);
    try {
      const envoi = vi.fn();
      attable.etat().transmettreLesIntentions(envoi);
      const avant = horsJournal(attable);
      const appel = attable.envoyer({ type: 'renvoyerLeHeros', args: [BRUNA.id], siege: 1 });
      expect(appel.issue).toBe('appliquee');
      expect(appel.journal).toEqual([expect.objectContaining({ de: 'journal', texte: t('coop.siegeHoteSeul') })]);
      expect(horsJournal(attable), 'l’intention du siège s’est jouée dans la copie de l’invité').toBe(avant);
      expect(envoi, 'l’intention du siège est partie à l’hôte').not.toHaveBeenCalled();
    } finally {
      attable.fermer();
    }
    const { H, partie: ouverte } = duel();
    const garde = ouverte.etat();
    ouverte.fermer();
    const partie = creerPartie(chezLInvite({ ...garde, net: { ...garde.net, ownership: { [H.id]: 1 }, slots: [1, 0, 0, 0] } }), ENTREES);
    try {
      const envoi = vi.fn();
      partie.etat().transmettreLesIntentions(envoi);
      const avant = horsJournal(partie);
      const appel = partie.envoyer({ type: 'jetLancer', args: ['attaque'], siege: 1 });
      expect(appel.evenements, 'le refus a émis').toEqual([]);
      expect(partie.etat().refus?.texte).toBe(t('coop.siegeHoteSeul'));
      expect(JSON.stringify({ ...partie.etat(), refus: undefined, journal: undefined, lignesAuJournal: undefined }), 'l’intention du siège s’est jouée').toBe(JSON.stringify({ ...JSON.parse(avant), refus: undefined }));
      expect(envoi).not.toHaveBeenCalled();
    } finally {
      partie.fermer();
    }
  });

  it('en partie locale et chez l’hôte d’une session, un verbe `hôte` se joue : la porte fermée s’ouvre', () => {
    const scene = emptyScene('scene-test', 4, 4);
    scene.effectZones = [{ id: 'piece', label: 'Pièce', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 } }];
    scene.walls = [{ x: 1, y: 1, side: 'N', door: true, closed: true }];
    const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
    ouverture.lancer({ party: [heroDuDuel()], scene, projet: null });
    const garde = { ...ouverture.etat(), partyPos: { x: 1, y: 1 } };
    ouverture.fermer();
    for (const mode of ['local', 'hote'] as const) {
      const partie = creerPartie({ ...garde, net: { ...garde.net, mode, roomCode: mode === 'hote' ? 'ABCDEF' : garde.net.roomCode } }, ENTREES);
      try {
        const porte = portesDuMobile(partie.etat()).find((p) => p.kind === 'door-closed');
        expect(porte, `${mode} : fixture sans porte fermée`).toBeTruthy();
        partie.envoyer({ type: 'actionnerLaPorte', args: [porte!.id] });
        expect(portesDuMobile(partie.etat()).find((p) => p.id === porte!.id)?.kind, `${mode} : la porte ne s’est pas ouverte`).toBe('door-open');
      } finally {
        partie.fermer();
      }
    }
  });

  it('chez l’hôte d’une session, le verbe se joue chez lui comme en partie locale', () => {
    const etat = etatAttable();
    const partie = creerPartie({ ...etat, net: { ...etat.net, mode: 'hote', roomCode: 'ABCDEF' } }, ENTREES);
    try {
      partie.envoyer({ type: 'renvoyerLeHeros', args: [BRUNA.id] });
      expect(partie.etat().party.map((h) => h.id)).not.toContain(BRUNA.id);
    } finally {
      partie.fermer();
    }
  });
});

describe('creerPartie — le journal de l’appel, capté à ses écrivains', () => {
  const lignesDuJournal = ({ journal }: ResultatDeLAppel) => journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []));

  it('une scène où l’on entre deux fois rend deux fois sa ligne d’entrée, une par appel', () => {
    const scene = { ...testScene(), startMessage: { texte: 'Vous entrez dans la salle.' } };
    const partie = creerPartie(etatInitialDuJeu(), ENTREES);
    try {
      expect(lignesDuJournal(partie.lancer({ party: [heroDuDuel()], scene, projet: null }))).toEqual(['Vous entrez dans la salle.']);
      expect(lignesDuJournal(partie.lancer({ party: [heroDuDuel()], scene, projet: null })), 'la seconde entrée n’a rendu aucune ligne').toEqual(['Vous entrez dans la salle.']);
    } finally {
      partie.fermer();
    }
  });

  it('un journal plein d’une ligne rend cette ligne, écrite de nouveau par l’appel', () => {
    // Hors scène, la fouille se refuse au journal (`refuserGeste`) : une ligne connue, que le journal porte déjà 41 fois.
    const fouille: Intention = { type: 'fouillerLaPiece', args: [] };
    const vierge = creerPartie(etatInitialDuJeu(), ENTREES);
    const [refus] = lignesDuJournal(vierge.envoyer(fouille));
    vierge.fermer();
    expect(refus, 'la fouille hors scène ne s’est pas refusée au journal').toBeTruthy();
    const partie = creerPartie({ ...etatInitialDuJeu(), journal: Array.from({ length: 41 }, () => refus) }, ENTREES);
    try {
      expect(lignesDuJournal(partie.envoyer(fouille))).toEqual([refus]);
      expect(lignesDuJournal(partie.envoyer(fouille))).toEqual([refus]);
    } finally {
      partie.fermer();
    }
  });
});

describe('creerPartie — la machinerie n’est pas une intention (#3370)', () => {
  it('`lancerLaScene` ne se type pas en `Intention` : une scène se lance par `lancer`', () => {
    // @ts-expect-error `lancerLaScene` est un membre de `MachinerieDuNoyau`, qu'aucune `Intention` ne nomme.
    const intention: Intention = { type: 'lancerLaScene', args: [testScene()] };
    expect(intention.type).toBe('lancerLaScene');
  });
});

describe('creerPartie — le tick auto et `reprendre`', () => {
  it('en cadence `auto`, l’hôte qui rejoue les jetons mène le combat à sa fin ; un jeton déjà repris est inconnu', () => {
    const partie = creerPartie(etatInitialDuJeu(), { ...ENTREES, cadence: 'auto', desFixes: false });
    try {
      const file: Jeton[] = [];
      const suivre = (r: ResultatDeLAppel) => file.push(...r.evenements.flatMap((e) => (e.type === 'programme' ? [e.jeton] : [])));
      suivre(partie.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' }));
      suivre(partie.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] }));
      expect(file.length, 'le début du combat n’a programmé aucun tick').toBeGreaterThan(0);
      const premier = file[0];
      for (let pas = 0; file.length && pas < 5000 && !partie.etat().battle?.over; pas++) {
        const reprise = partie.reprendre(file.shift()!);
        expect(reprise.issue).toBe('appliquee');
        suivre(reprise);
      }
      expect(partie.etat().battle?.over, 'les reprises n’ont pas mené le combat à sa fin').toBeTruthy();
      expect(partie.reprendre(premier).issue).toBe('jeton-inconnu');
    } finally {
      partie.fermer();
    }
  });
});

describe('creerPartie — le `set` du propriétaire', () => {
  it('applique la transition du jeu après l’écriture : la chaise suit le corps', () => {
    const partie = creerPartie(etatAttable(), ENTREES);
    try {
      expect(rangsAssis(partie.etat().scene)).toEqual([1, 2]);
      partie.envoyer({ type: 'renvoyerLeHeros', args: [BRUNA.id] });
      expect(rangsAssis(partie.etat().scene), 'le retrait d’un héros n’a levé aucune chaise').toEqual([1]);
    } finally {
      partie.fermer();
    }
  });

  it('un seul propriétaire : une seconde partie ouverte lève, une partie fermée ne reçoit plus rien', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES);
    expect(() => creerPartie(etatInitialDuJeu(), ENTREES)).toThrow(/déjà branché/);
    partie.fermer();
    expect(() => partie.envoyer({ type: 'terminerLeTour', args: [] })).toThrow(/partie fermée/);
  });
});


/** L'instantané que l'hôte diffuse, copié comme le réseau le porte. */
const instantane = (hote: Partie): Record<string, unknown> => JSON.parse(JSON.stringify(instantaneDeLaCoop(hote.etat()))) as Record<string, unknown>;
const textes = ({ journal }: ResultatDeLAppel) => journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []));
const deCombat = ({ journal }: ResultatDeLAppel) => journal.flatMap((l) => (l.de === 'combat' ? [l.evenement] : []));
const etatsGagnesDe = ({ evenements }: ResultatDeLAppel) => evenements.filter((e) => e.type === 'etatGagne');

/** Joue `jouer` sur une partie d'hôte ouverte sur `depart`, qui pousse à `diffuser` les instantanés qu'elle diffuse ; la ferme. */
function chezLHote(depart: EtatDeJeu, jouer: (hote: Partie, diffuser: () => void) => void): Record<string, unknown>[] {
  const diffuses: Record<string, unknown>[] = [];
  const hote = creerPartie({ ...depart, net: { ...depart.net, mode: 'hote', mySeat: 0, roomCode: 'ABCDEF' } }, ENTREES);
  try {
    jouer(hote, () => diffuses.push(instantane(hote)));
  } finally {
    hote.fermer();
  }
  return diffuses;
}

/** Une partie d'invité ouverte, l'hôte fermé ; fermée après `jouer`. */
function invite(jouer: (partie: Partie) => void, depart: EtatDeJeu = etatInitialDuJeu()): void {
  const partie = creerPartie(chezLInvite(depart), ENTREES);
  try {
    jouer(partie);
  } finally {
    partie.fermer();
  }
}

describe('Partie.recevoir — l’instantané de l’hôte entre par un appel (#3009 E3r)', () => {
  it('R1 : pose l’état de l’hôte, l’invité garde son identité réseau, et ses verbes partent encore à l’hôte', () => {
    const [premier, second] = chezLHote(etatAttable(), (hote, diffuser) => {
      diffuser();
      hote.etat().ecrireAuJournal('Une ligne de l’hôte.');
      diffuser();
    });
    invite((partie) => {
      const envoi = vi.fn();
      partie.etat().transmettreLesIntentions(envoi);
      partie.recevoir(premier);
      partie.recevoir(second);
      expect(partie.etat().scene?.id, 'la scène de l’hôte n’est pas posée').toBe(etatAttable().scene?.id);
      expect(partie.etat().party.map((h) => h.id)).toEqual(etatAttable().party.map((h) => h.id));
      expect(partie.etat().net).toMatchObject({ mode: 'invite', mySeat: 1 });
      partie.envoyer({ type: 'renvoyerLeHeros', args: [BRUNA.id] });
      expect(envoi.mock.calls, 'après deux instantanés, le verbe ne part plus à l’hôte').toEqual([['renvoyerLeHeros', [BRUNA.id]]]);
    });
  });

  it('R2 : le journal arrive une fois ; deux lignes écrites entre deux instantanés arrivent dans l’ordre', () => {
    const [zero, deux] = chezLHote(etatInitialDuJeu(), (hote, diffuser) => {
      diffuser();
      hote.etat().ecrireAuJournal('Première.');
      hote.etat().ecrireAuJournal('Seconde.');
      diffuser();
    });
    invite((partie) => {
      expect(textes(partie.recevoir(zero))).toEqual([]);
      expect(textes(partie.recevoir(deux))).toEqual(['Première.', 'Seconde.']);
      expect(textes(partie.recevoir(deux)), 'le même instantané redit le journal').toEqual([]);
    });
  });

  it('R3 : une ligne que l’invité écrit chez lui ne décale pas le compte de l’hôte', () => {
    const [zero, deux] = chezLHote(etatAttable(), (hote, diffuser) => {
      diffuser();
      hote.etat().ecrireAuJournal(['Une.', 'Deux.']);
      diffuser();
    });
    const verbeDHote = Object.entries(CLASSE_DES_ACTIONS_DU_NOYAU).find(([, classe]) => classe === 'hôte')![0];
    const refusChezLInvite = (partie: Partie) => expect(textes(partie.envoyer({ type: verbeDHote, args: [] } as unknown as Intention)), 'témoin : le refus s’écrit chez l’invité').toEqual([t('coop.hoteSeul')]);
    invite((partie) => {
      partie.recevoir(zero);
      refusChezLInvite(partie);
      expect(textes(partie.recevoir(deux))).toEqual(['Une.', 'Deux.']);
      refusChezLInvite(partie);
      expect(textes(partie.recevoir(deux))).toEqual([]);
    });
  });

  it('R4 : la fenêtre de l’hôte borne ce qui arrive entre deux instantanés', () => {
    const lignes = Array.from({ length: 45 }, (_, i) => `Ligne ${i + 1}.`);
    const [zero, uneAUne, enUnAppel] = chezLHote(etatInitialDuJeu(), (hote, diffuser) => {
      diffuser();
      for (const ligne of lignes) hote.etat().ecrireAuJournal(ligne);
      diffuser();
      hote.etat().ecrireAuJournal(lignes);
      diffuser();
    });
    invite((partie) => {
      partie.recevoir(zero);
      expect(textes(partie.recevoir(uneAUne))).toEqual(lignes.slice(-41));
      expect(textes(partie.recevoir(enUnAppel))).toEqual(lignes);
    });
  });

  it('R5 : une partie relancée après une avance de l’horloge rend son message de départ une fois, et rien sans message', () => {
    const texte = 'Vous entrez dans la salle.';
    for (const scene of [{ ...testScene(), startMessage: { texte } }, testScene()]) {
      const [lancee, avancee, relancee] = chezLHote(etatInitialDuJeu(), (hote, diffuser) => {
        hote.lancer({ party: [heroDuDuel()], scene, projet: null });
        diffuser();
        hote.etat().avancerLeTemps(60);
        diffuser();
        hote.lancer({ party: [heroDuDuel()], scene, projet: null });
        diffuser();
      });
      invite((partie) => {
        partie.recevoir(lancee);
        partie.recevoir(avancee);
        const recu = partie.recevoir(relancee);
        expect(recu.neuve, 'témoin : l’instantané relancé n’est pas `neuve`').toBe(true);
        expect(textes(recu)).toEqual(scene.startMessage ? [texte] : []);
        expect(textes(partie.relever())).toEqual([]);
      });
    }
  });

  it('R6 : la suite d’un combat rend sa queue, un combat neuf son journal entier, même égal au dernier reçu', () => {
    const lancement = { party: [heroDuDuel()], scene: { ...testScene(), startMessage: { texte: 'Vous entrez dans la salle.' } }, projet: null, combatDirect: 'enc-mutants' };
    let garde = etatInitialDuJeu();
    const [avant, premier, second] = chezLHote(garde, (hote, diffuser) => {
      hote.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null });
      diffuser();
      hote.lancer(lancement);
      diffuser();
      hote.lancer(lancement);
      diffuser();
      hote.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
      garde = hote.etat();
    });
    const { E, patch } = auContact(garde);
    const [suite] = chezLHote({ ...garde, ...patch }, (hote, diffuser) => {
      hote.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] });
      hote.envoyer({ type: 'jetLancer', args: ['attaque'] });
      hote.envoyer({ type: 'jetImposerLeResultat', args: ['attaque', 11] });
      hote.envoyer({ type: 'jetValider', args: ['attaque'] });
      diffuser();
    });
    const log = (i: Record<string, unknown>) => (i.battle as { log: unknown[] }).log;
    expect(log(second), 'témoin : les deux ouvertures diffèrent').toEqual(log(premier));
    expect(log(suite).length, 'témoin : l’attaque n’a rien écrit au combat').toBeGreaterThan(log(second).length);
    invite((partie) => {
      partie.recevoir(avant);
      expect(deCombat(partie.recevoir(premier))).toEqual(log(premier));
      const lignesAvant = partie.etat().lignesAuJournal;
      expect(deCombat(partie.recevoir(second)), 'le combat relancé passe pour la suite du premier').toEqual(log(second));
      expect(partie.etat().lignesAuJournal, 'le second lancement remet le compte du journal à zéro').toBeGreaterThan(lignesAvant);
      expect(deCombat(partie.recevoir(suite))).toEqual(log(suite).slice(log(second).length));
      expect(deCombat(partie.recevoir(suite)), 'le même instantané redit le combat').toEqual([]);
      expect(deCombat(partie.relever()), 'la capture redit le combat reçu').toEqual([]);
      expect(partie.etat().combatsOuverts).toBe(2);
    });
  });

  it('R7 : le premier instantané ne rend ni ligne ni État gagné ; au suivant, l’État gagné chez l’hôte sort', () => {
    const { E, partie: hote } = duel((etat, { E }) => {
      E.wounds.current = 1;
      return { ...etat, net: { ...etat.net, mode: 'hote', mySeat: 0, roomCode: 'ABCDEF' } };
    });
    let avantLeCoup: Record<string, unknown>, apresLeCoup: Record<string, unknown>;
    try {
      avantLeCoup = instantane(hote);
      hote.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] });
      hote.envoyer({ type: 'jetLancer', args: ['attaque'] });
      hote.envoyer({ type: 'jetImposerLeResultat', args: ['attaque', 11] });
      hote.envoyer({ type: 'jetValider', args: ['attaque'] });
      apresLeCoup = instantane(hote);
    } finally {
      hote.fermer();
    }
    const inconscient = { type: 'etatGagne', porteur: E.id, etat: 'inconscient' };
    invite((partie) => {
      const premier = partie.recevoir(apresLeCoup);
      expect(combattant(partie, E.id).conditions.map((c) => c.id), 'témoin : le Mutant reçu n’est pas inconscient').toContain('inconscient');
      expect(etatsGagnesDe(premier)).toEqual([]);
      expect(premier.journal).toEqual([]);
    });
    invite((partie) => {
      partie.recevoir(avantLeCoup);
      expect(etatsGagnesDe(partie.recevoir(apresLeCoup))).toEqual(expect.arrayContaining([inconscient]));
    });
  });

  it('R8 : `relever` rend une fois l’écrit hors appel, `abonner` suit chaque écriture, un appel qui lève ne jette que le sien', () => {
    invite((partie) => {
      const vu = vi.fn();
      const desabonner = partie.abonner(vu);
      partie.etat().ecrireAuJournal('Hors appel.');
      bus.emit(EVT.SCENE_DIRTY);
      expect(vu).toHaveBeenCalledTimes(1);
      desabonner();
      partie.etat().ecrireAuJournal('Hors appel, encore.');
      expect(vu, 'appelée après le désabonnement').toHaveBeenCalledTimes(1);
      // L'abonné d'un hôte qui lève sur une écriture qui suit l'arrivée en scène : l'appel a déjà écrit et émis.
      let arrivee = false;
      const desabonnerDuBus = bus.on(EVT.ARRIVEE_EN_SCENE, () => (arrivee = true));
      const desabonnerLeveur = partie.abonner(() => {
        if (arrivee) throw new Error('abonné de l’hôte');
      });
      try {
        expect(() => partie.lancer({ party: [heroDuDuel()], scene: { ...testScene(), startMessage: { texte: 'Ligne de l’appel levé.' } }, projet: null })).toThrow('abonné de l’hôte');
      } finally {
        desabonnerLeveur();
        desabonnerDuBus();
      }
      const releve = partie.relever();
      expect(textes(releve)).toEqual(['Hors appel.', 'Hors appel, encore.']);
      expect(emis(releve), 'l’appel levé a laissé ce qu’il avait émis, ou jeté ce qui l’attendait').toEqual(['scene_dirty']);
      const vide = partie.relever();
      expect([...vide.journal, ...vide.evenements]).toEqual([]);
    });
  });
});
