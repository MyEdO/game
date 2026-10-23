/**
 * LA PARTIE, sans store (#2817 D9) : un hôte qui n'a que la surface du noyau (`./index`) joue une attaque
 * jusqu'à la clôture du combat, puis une intention de siège sans verdict. Les dés viennent des entrées
 * (graine, dés fixés). Le duel est celui de `combatDeTest.testkit.ts`, dans la scène de fixture.
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, previewAttack, type EntreesDeLaPartie, type EtatDeJeu, type Jeton, type Partie, type ResultatDeLAppel } from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { BRUNA, ALDO, etatAttable, rangsAssis } from './taverneAttablee.testkit';
import { testScene } from '../scenes/test-fixture';
import { idNeufDeBanc } from '../lib/entityId.testkit';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {}, idNeuf: idNeufDeBanc };

const emis = ({ evenements }: ResultatDeLAppel) => evenements.flatMap((e) => (e.type === 'emis' ? [e.evt] : []));

/** Le duel ouvert par une première partie, puis gardé par l'hôte : `garder` réécrit l'état gardé avant
 *  la partie qui le reprend. La première partie fermée, la seconde s'ouvre dans le même contexte. */
function duel(garder: (etat: EtatDeJeu, duel: ReturnType<typeof auContact>) => EtatDeJeu = (e) => e) {
  const ouverture = creerPartie({ ...etatInitialDuJeu(), party: [heroDuDuel()] }, ENTREES);
  expect(emis(ouverture.envoyer({ type: 'startScene', args: [testScene()] }))).toContain('arrivee_en_scene');
  ouverture.envoyer({ type: 'startCombat', args: ['enc-mutants'] });
  ouverture.envoyer({ type: 'confirmRoundStart', args: [] });
  const garde = ouverture.etat();
  ouverture.fermer();
  const contact = auContact(garde);
  return { ...contact, partie: creerPartie(garder({ ...garde, ...contact.patch }, contact), ENTREES) };
}

const combattant = (partie: Partie, id: string) => partie.etat().battle!.combatants.find((c) => c.id === id)!;

describe('creerPartie — une attaque jouée par la seule surface du noyau', () => {
  it('déclaration, jet, défense, critique, mise hors de combat, puis `cascadeNext` jusqu’à la clôture', () => {
    const { H, E, partie } = duel((etat, { E }) => {
      E.wounds.current = 1;
      return etat;
    });
    try {
      // `etat` est un `Get` : un lecteur de la surface s'y branche sans cast.
      expect(previewAttack(partie.etat, combattant(partie, H.id), combattant(partie, E.id)).soak, 'l’aperçu ne lit pas la cible').toBeGreaterThan(0);
      partie.envoyer({ type: 'battleClickEntity', args: [E.id, { confirm: true }] });
      expect(partie.etat().pendingAttack, 'la déclaration n’a pas ouvert la fenêtre d’attaque').toMatchObject({ targetId: E.id, result: null });
      partie.envoyer({ type: 'attackRoll', args: [] });
      partie.envoyer({ type: 'attackSetForcedRoll', args: [11] });
      const res = partie.etat().pendingAttack!.result!;
      expect(res.attackerRoll, 'le dé fixé de l’entrée n’a pas été posé').toBe(11);
      expect(res.defenderDetail, 'la défense du Mutant n’a pas été jouée').toBeTruthy();
      expect(res).toMatchObject({ hit: true, critical: true });

      const confirmation = partie.envoyer({ type: 'attackConfirm', args: [] });
      expect(confirmation.issue).toBe('appliquee');
      expect(emis(confirmation)).toContain('anim_attack');
      expect(confirmation.journal.flatMap((l) => (l.de === 'combat' ? [l.evenement.kind] : [])), 'l’appel ne rend pas les lignes de combat qu’il a écrites').toEqual(expect.arrayContaining(['crit', 'death']));
      expect(partie.etat().battle!.log.map((l) => l.kind)).toEqual(expect.arrayContaining(['crit', 'death']));
      expect(combattant(partie, E.id).conditions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'inconscient' })]));

      const fin: string[] = [];
      for (let pas = 0; partie.etat().pendingCascade && pas < 10; pas++) {
        const cascade = partie.etat().pendingCascade!;
        const rangee = cascade.participants[cascade.cursor]?.participants?.find((r) => !r.result);
        fin.push(...emis(partie.envoyer(rangee ? { type: 'cascadeBatchRoll', args: [rangee.id] } : { type: 'cascadeNext', args: [] })));
      }
      expect(partie.etat().pendingCascade, 'la cascade de fin de combat ne s’est pas close').toBeNull();
      expect(partie.etat().battle!.over).toBe('victory');
      expect(fin).toContain('battle_over');
    } finally {
      partie.fermer();
    }
  });

  it('une intention de siège sans verdict ne court pas et laisse l’intention armée du propriétaire', () => {
    const { H, partie: armee } = duel((etat, { H }) => ({ ...etat, net: { ...etat.net, mode: 'host', mySeat: 0, ownership: { [H.id]: 0 }, slots: [1, 0, 0, 0] } }));
    armee.envoyer({ type: 'battleArmIntent', args: ['course'] });
    expect(armee.etat().localIntent, 'témoin : le propriétaire a armé SA Course').toEqual({ actionId: 'course' });
    const garde = armee.etat();
    armee.fermer();
    const partie = creerPartie({ ...garde, net: { ...garde.net, ownership: { [H.id]: 1 } } }, ENTREES);
    try {
      const loin = { x: H.pos!.x - 6, y: H.pos!.y };
      const horsPossession = partie.envoyer({ type: 'battleClickTile', args: [loin, { confirm: true }], siege: 2 });
      expect(horsPossession.issue, 'un siège qui ne possède pas l’acteur a passé la possession').toBe('refusee');
      expect(horsPossession.journal.map((l) => l.de), 'le refus n’a rien écrit au journal').toEqual(['journal']);
      expect(partie.envoyer({ type: 'battleClickTile', args: [loin, { confirm: true }], siege: 1 }).issue).toBe('appliquee');
      expect(partie.etat().refus?.texte ?? '', 'témoin : le geste du siège a passé la possession, puis été refusé faute de verdict').toContain('Course');
      expect(partie.etat().localIntent, 'le clic du siège a dissous l’intention du propriétaire').toEqual({ actionId: 'course' });
      expect(partie.etat().pendingRun ?? partie.etat().pendingCascade, 'le siège a couru sur la case du propriétaire').toBeFalsy();
      expect(combattant(partie, H.id).pos).toEqual({ x: 10, y: 10 });
    } finally {
      partie.fermer();
    }
  });
});

describe('creerPartie — le journal de l’appel, capté à ses écrivains', () => {
  const lignesDuJournal = ({ journal }: ResultatDeLAppel) => journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []));

  it('une scène où l’on entre deux fois rend deux fois sa ligne d’entrée, une par appel', () => {
    const scene = { ...testScene(), startMessage: { texte: 'Vous entrez dans la salle.' } };
    const partie = creerPartie({ ...etatInitialDuJeu(), party: [heroDuDuel()] }, ENTREES);
    try {
      expect(lignesDuJournal(partie.envoyer({ type: 'startScene', args: [scene] }))).toEqual(['Vous entrez dans la salle.']);
      expect(lignesDuJournal(partie.envoyer({ type: 'startScene', args: [scene] })), 'la seconde entrée n’a rendu aucune ligne').toEqual(['Vous entrez dans la salle.']);
    } finally {
      partie.fermer();
    }
  });

  it('un journal plein de « X » rend la ligne « X » écrite par l’appel', () => {
    const partie = creerPartie({ ...etatInitialDuJeu(), journal: Array.from({ length: 41 }, () => 'X') }, ENTREES);
    try {
      expect(lignesDuJournal(partie.envoyer({ type: 'log', args: ['X'] }))).toEqual(['X']);
      expect(lignesDuJournal(partie.envoyer({ type: 'log', args: [['X', 'X']] }))).toEqual(['X', 'X']);
    } finally {
      partie.fermer();
    }
  });
});

describe('creerPartie — le tick auto et `reprendre`', () => {
  it('en cadence `auto`, l’hôte qui rejoue les jetons mène le combat à sa fin ; un jeton déjà repris est inconnu', () => {
    const partie = creerPartie({ ...etatInitialDuJeu(), party: [heroDuDuel()] }, { ...ENTREES, cadence: 'auto', desFixes: false });
    try {
      const file: Jeton[] = [];
      const suivre = (r: ResultatDeLAppel) => file.push(...r.evenements.flatMap((e) => (e.type === 'programme' ? [e.jeton] : [])));
      suivre(partie.envoyer({ type: 'startScene', args: [testScene()] }));
      suivre(partie.envoyer({ type: 'startCombat', args: ['enc-mutants'] }));
      suivre(partie.envoyer({ type: 'confirmRoundStart', args: [] }));
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
      partie.envoyer({ type: 'setParty', args: [[BRUNA, ALDO]] });
      expect(rangsAssis(partie.etat().scene), 'la permutation du groupe n’a levé aucune chaise').toEqual([]);
    } finally {
      partie.fermer();
    }
  });

  it('un seul propriétaire : une seconde partie ouverte lève, une partie fermée ne reçoit plus rien', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES);
    expect(() => creerPartie(etatInitialDuJeu(), ENTREES)).toThrow(/déjà branché/);
    partie.fermer();
    expect(() => partie.envoyer({ type: 'battleEndTurn', args: [] })).toThrow(/partie fermée/);
  });
});

