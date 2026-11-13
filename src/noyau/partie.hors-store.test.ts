/**
 * LA PARTIE, sans store (#2817 D9) : un hôte qui n'a que la surface du noyau (`./index`) joue une attaque
 * jusqu'à la clôture du combat, puis une intention de siège sans verdict. Les dés viennent des entrées
 * (graine, dés fixés). Le duel est celui de `combatDeTest.testkit.ts`, dans la scène de fixture.
 */
import { describe, it, expect, vi } from 'vitest';
import { creerPartie, etatInitialDuJeu, previewAttack, type EntreesDeLaPartie, type EtatDeJeu, type Intention, type Jeton, type Partie, type ResultatDeLAppel } from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { BRUNA, etatAttable, rangsAssis } from './taverneAttablee.testkit';
import { testScene } from '../scenes/test-fixture';

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
  const chezLInvite = (etat: EtatDeJeu): EtatDeJeu => ({ ...etat, net: { ...etat.net, mode: 'invite', mySeat: 1, roomCode: 'ABCDEF' } });

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

