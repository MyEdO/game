/**
 * L'INTENTION DU CLIC VOYAGE AVEC LE GESTE (#1411, P0-A ; #3613) — spec HUD § « ARBITRAGE 2026-08-19 »
 * (`docs/plans/2026-08-16-spec-hud-combat.md`), qui exige d'ARMER la Course pour dépasser la Marche et
 * la Charge pour s'approcher d'un ennemi cliqué.
 *
 * L'intention armée est LOCALE au client (`localIntent`, hors snapshot réseau). Deux situations la
 * rendent illisible AU MOMENT où le geste s'exécute — ce sont les deux sondes de ce fichier :
 *
 *  (A) RÉ-ENTRÉE : un gate (Test `calme-d-approche`, Bénédiction de Protection, choix cavalier/
 *      monture) DIFFÈRE le geste. Le premier clic a déjà dissous l'intention ; relire le store à la
 *      relance refuserait le geste que le joueur vient de GAGNER à son jet.
 *  (B) COOP : l'invité arme SA case, l'hôte exécute l'intent dans SON store — où cette intention
 *      n'existe pas. Sans intention voyageuse, un invité ne pourrait jamais charger ni courir, et l'hôte
 *      débloquerait le geste d'autrui en armant sa propre case.
 *
 * L'id de l'intention (`OptionsDuClic.intentionId`) voyage donc dans les args ; le receveur en dérive la Charge et la
 * Course, et juge son offre dans SON état (`intentionDuClic`), comme le verbe `armerLIntention`.
 */
import { resetFields } from './stateFields';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { argsAvecIntentionLocale } from './localIntent';
import { refusDeCharge } from './refusDuTour';
import { withActingSeat } from './netOwnership';
import { refuserGeste, eteindreRefus } from './refusVisible';
import { appliquerLInstantane, instantaneDeLaCoop } from './coop';
import { snapshotSave } from './persistance/save';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { chebyshev } from '../engine/grid';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();

/** Combat témoin : un héros au tour ENTIER, un ennemi placé à distance de Charge (hors d'Allonge). */
function setup(opts: { peur?: boolean } = {}) {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero], screen: 'campaign' });
  get().lancerLaScene(testScene());
  get().lancerLeCombat('enc-mutants');
  get().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = get().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const E = b.combatants.find((c) => c.kind === 'ennemi')!;
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'ennemi' && c.id !== E.id)) e.pos = { x: 25 + i++, y: 25 };
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 13, y: 10 }; // distance 3 : hors d'Allonge, dans la portée de Charge (2×M)
  if (opts.peur) H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }] as never;
  const turn = b.order.indexOf(H.id);
  banc.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false, preview: null }, localIntent: null, refus: null });
  return { H, E };
}

describe('(A) RÉ-ENTRÉE — un geste ARMÉ puis DIFFÉRÉ par un gate se commet à la relance', () => {
  it('Charge armée + Test de Calme d’approche RÉUSSI → le héros charge, sans « armez la Charge »', () => {
    const { H, E } = setup({ peur: true });
    banc.jouerLaCase('charge'); // le joueur ARME la case Charge, puis clique la cible
    cliquerSurLeCombattant(get, E.id, { confirm: true });
    // Le gate de Peur s'ouvre : rien n'est commis, l'intention a été dissoute par ce clic.
    expect(get().pendingApproach, 'le Test de Calme d’approche ne s’est pas ouvert').not.toBeNull();
    expect(get().localIntent, 'témoin : le clic a bien dissous l’intention').toBeNull();
    banc.setState({ pendingApproach: { ...get().pendingApproach!, result: { success: true, roll: 5, target: 50, sl: 4 } } });
    banc.abandonner();
    get().jetValider('approche');
    banc.reprendreLesEnAttente(); // joue le glissé d'approche → ouvre la frappe
    const h = get().battle!.combatants.find((c) => c.id === H.id)!;
    expect(get().refus, 'le geste GAGNÉ au jet a été refusé à la relance').toBeNull();
    expect(chebyshev(h.pos!, E.pos!), 'le héros n’a pas rejoint sa cible').toBe(1);
    expect(get().pendingAttack?.fromCharge, 'la frappe de Charge n’a pas suivi').toBe(true);
  });

  it('SANS armement, le même Test réussi ne commet PAS l’approche (le gate ne fabrique pas le geste)', () => {
    const { H, E } = setup({ peur: true });
    cliquerSurLeCombattant(get, E.id, { confirm: true }); // aucune case armée → refus immédiat
    expect(get().refus?.texte ?? '', 'le refus n’a pas été dit').toContain('Charge');
    expect(get().pendingApproach, 'un gate s’est ouvert pour un geste refusé').toBeNull();
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
  });

  it('MONTURE : le choix cavalier/monture relance AVEC l’intention — la Charge armée approche', () => {
    const { H, E } = setup();
    banc.setState({ pendingMountTarget: { riderId: H.id, mountId: E.id, intentionId: 'charge' } });
    get().fenetreChoisir('cibleDeMonture', 'cible', E.id);
    banc.reprendreLesEnAttente();
    const h = get().battle!.combatants.find((c) => c.id === H.id)!;
    expect(get().refus, 'le geste armé avant la modale a été refusé à la relance').toBeNull();
    expect(chebyshev(h.pos!, E.pos!), 'la relance n’a pas approché').toBe(1);
  });

  it('MONTURE : sans intention, la relance REFUSE et le héros reste immobile (la modale ne fabrique rien)', () => {
    const { H, E } = setup();
    banc.setState({ pendingMountTarget: { riderId: H.id, mountId: E.id } });
    get().fenetreChoisir('cibleDeMonture', 'cible', E.id);
    banc.reprendreLesEnAttente();
    expect(get().refus?.texte ?? '', 'le refus n’a pas été dit').toContain('Charge');
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'la modale a déplacé un héros qui n’avait rien armé').toEqual({ x: 10, y: 10 });
  });
});

describe('(B) COOP — l’intention part de l’ÉMETTEUR dans les args, l’hôte la juge', () => {
  it('l’intention armée du client entre dans les args de SON intent (clic-ennemi et clic-case)', () => {
    setup();
    banc.jouerLaCase('charge');
    expect(argsAvecIntentionLocale(get, 'cliquerLaCase', [{ x: 11, y: 10 }, 'e1', { confirm: true }]))
      .toEqual([{ x: 11, y: 10 }, 'e1', { confirm: true, intentionId: 'charge' }]);
    banc.jouerLaCase('course');
    expect(argsAvecIntentionLocale(get, 'cliquerLaCase', [{ x: 1, y: 1 }, undefined, { confirm: true }]))
      .toEqual([{ x: 1, y: 1 }, undefined, { confirm: true, intentionId: 'course' }]);
  });

  it('rien d’armé → les args partent inchangés (l’hôte ne doit rien deviner)', () => {
    setup();
    expect(argsAvecIntentionLocale(get, 'cliquerLaCase', [{ x: 11, y: 10 }, 'e1', {}])).toEqual([{ x: 11, y: 10 }, 'e1', {}]);
    expect(argsAvecIntentionLocale(get, 'cliquerLaCase', [{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
  });

  it('un intent SANS intention à joindre voyage inchangé', () => {
    setup();
    banc.jouerLaCase('charge');
    expect(argsAvecIntentionLocale(get, 'terminerLeTour', [])).toEqual([]);
  });

  it('HÔTE non armé : le geste de l’INVITÉ (intention dans les args) s’exécute quand même', () => {
    const { H, E } = setup();
    expect(get().localIntent, 'témoin : l’hôte n’a RIEN armé').toBeNull();
    cliquerSurLeCombattant(get, E.id, { confirm: true, intentionId: 'charge' }); // args tels que l'invité les a émis
    banc.reprendreLesEnAttente();
    const h = get().battle!.combatants.find((c) => c.id === H.id)!;
    expect(get().refus, 'l’hôte a refusé le geste que l’invité avait armé').toBeNull();
    expect(chebyshev(h.pos!, E.pos!)).toBe(1);
  });

  /** Hôte qui a ARMÉ la case `caseId` sur le héros, puis l'a confié au siège 1 : le clic de ce siège
   *  s'exécute chez lui, sous `withActingSeat`, comme `appliquerLIntentionDUnSiege`. */
  function hoteArmeHerosConfie(caseId: 'charge' | 'course') {
    const net0 = get().net;
    const { H, E } = setup();
    banc.setState({ pendingRun: null, net: { ...net0, mode: 'hote', mySeat: 0, ownership: { [H.id]: 0 }, slots: [1, 0, 0, 0] } });
    banc.jouerLaCase(caseId);
    expect(get().localIntent, 'témoin : l’hôte a armé SA case').toEqual({ actionId: caseId });
    banc.setState({ net: { ...get().net, ownership: { [H.id]: 1 } } });
    return { H, E, net0 };
  }

  it('HÔTE armé : sa Charge NE DÉBLOQUE PAS le clic-ennemi d’un siège qui n’a rien armé', () => {
    const { H, E, net0 } = hoteArmeHerosConfie('charge');
    try {
      withActingSeat(1, () => cliquerSurLeCombattant(get, E.id, { confirm: true }));
      banc.reprendreLesEnAttente();
      expect(get().localIntent, 'le clic d’un autre siège a dissous l’intention de l’hôte').toEqual({ actionId: 'charge' });
      expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'le héros a été déplacé par la case d’un AUTRE').toEqual({ x: 10, y: 10 });
      expect(get().pendingAttack).toBeNull();
    } finally {
      banc.setState({ net: net0 });
    }
  });

  it('SIÈGE sans intention : son clic ne court pas et ne dissout pas l’intention armée du propriétaire', () => {
    const { H, net0 } = hoteArmeHerosConfie('course');
    try {
      withActingSeat(1, () => get().cliquerLaCase({ x: 10 + 6, y: 10 }, undefined, { confirm: true }));
      banc.reprendreLesEnAttente();
      expect(get().refus?.texte ?? '', 'témoin : le geste du siège a passé la garde de possession, puis refusé faute d’intention').toContain('Course');
      expect(get().localIntent, 'le clic d’un autre siège a dissous l’intention de l’hôte').toEqual({ actionId: 'course' });
      expect(get().pendingRun ?? get().pendingCascade, 'le siège a couru sur la case de l’hôte').toBeFalsy();
      expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
    } finally {
      banc.setState({ net: net0, pendingRun: null });
    }
  });

  it('SIÈGE avec intention jointe : son clic court, par l’intention qu’il porte', () => {
    const { H, net0 } = hoteArmeHerosConfie('course');
    try {
      withActingSeat(1, () => get().cliquerLaCase({ x: 10 + 6, y: 10 }, undefined, { confirm: true, intentionId: 'course' }));
      banc.reprendreLesEnAttente();
      expect(get().refus, 'le geste armé du siège a été refusé').toBeNull();
      expect(get().pendingRun, 'le siège n’a pas couru').toMatchObject({ combatantId: H.id, dest: { x: 10 + 6, y: 10 } });
    } finally {
      banc.setState({ net: net0, pendingRun: null });
    }
  });

  it('INVITÉ armé, HÔTE sans intention : la Course jointe à l’intent est jugée chez l’hôte et acceptée', () => {
    const net0 = get().net;
    const { H } = setup();
    banc.setState({ pendingRun: null, net: { ...net0, mode: 'hote', mySeat: 0, ownership: { [H.id]: 1 }, slots: [1, 0, 0, 0] } });
    expect(get().localIntent, 'témoin : l’hôte n’a RIEN armé').toBeNull();
    try {
      withActingSeat(1, () => get().cliquerLaCase({ x: 10 + 6, y: 10 }, undefined, { confirm: true, intentionId: 'course' }));
      banc.reprendreLesEnAttente();
      expect(get().refus, 'l’hôte a jugé la Course de l’invité sur SA propre intention').toBeNull();
      expect(get().pendingRun, 'l’invité n’a pas couru').toMatchObject({ combatantId: H.id, dest: { x: 10 + 6, y: 10 } });
    } finally {
      banc.setState({ net: net0, pendingRun: null });
    }
  });

  it('INVITÉ armé d’une Charge que l’état REFUSE (`refusDeCharge`) : l’hôte juge son offre et refuse le clic', () => {
    const net0 = get().net;
    const { H, E } = setup();
    banc.setState({ battle: { ...get().battle!, movementUsed: 1 }, net: { ...net0, mode: 'hote', mySeat: 0, ownership: { [H.id]: 1 }, slots: [1, 0, 0, 0] } });
    expect(refusDeCharge(get().battle!, H), 'témoin : l’état refuse la Charge').not.toBeNull();
    try {
      withActingSeat(1, () => cliquerSurLeCombattant(get, E.id, { confirm: true, intentionId: 'charge' }));
      banc.reprendreLesEnAttente();
      expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'l’invité a approché malgré l’état').toEqual({ x: 10, y: 10 });
      expect(get().pendingAttack, 'l’invité a frappé malgré l’état').toBeNull();
    } finally {
      banc.setState({ net: net0 });
    }
  });
});

describe('(C) le REFUS est un canal LOCAL — et ne se tait jamais', () => {
  it('HORS COMBAT, il retombe sur le journal de partie (jamais un no-op silencieux)', () => {
    banc.setState({ battle: null, refus: null, journal: [] } as never);
    refuserGeste(get, banc.setState, 'Geste impossible ici.');
    expect(get().refus, 'hors combat il n’y a pas de bannière : rien ne doit rester en attente').toBeNull();
    expect(get().journal.join('\n'), 'le refus s’est tu').toContain('Geste impossible ici.');
  });

  it('EN COMBAT, il ne touche NI le journal de partie NI le journal de combat', () => {
    setup();
    const journalAvant = get().journal.length;
    const logAvant = get().battle!.log.length;
    refuserGeste(get, banc.setState, 'Trop loin.');
    expect(get().refus?.texte).toBe('Trop loin.');
    expect(get().journal.length, 'le refus a pollué le journal de partie').toBe(journalAvant);
    expect(get().battle!.log.length, 'le refus a persisté dans le journal de COMBAT (et voyagerait aux invités)').toBe(logAvant);
  });

  it('il NE VOYAGE PAS : absent du snapshot de l’hôte, préservé chez le client qui le reçoit', () => {
    setup();
    refuserGeste(get, banc.setState, 'Trop loin.');
    expect('refus' in instantaneDeLaCoop(get()), 'le refus de l’hôte part chez ses invités').toBe(false);
    const snap = JSON.parse(JSON.stringify({ ...instantaneDeLaCoop(get()) })) as Record<string, unknown>;
    banc.setState(appliquerLInstantane(snap, banc.getState()).etat);
    expect(get().refus?.texte, 'un snapshot de l’hôte a effacé le refus du client').toBe('Trop loin.');
  });

  it('son extinction ne coupe QUE le refus visé (un refus survenu depuis garde sa durée)', () => {
    setup();
    refuserGeste(get, banc.setState, 'Premier.');
    const premier = get().refus!;
    refuserGeste(get, banc.setState, 'Second.');
    eteindreRefus(get, banc.setState, premier); // la minuterie du PREMIER arrive en retard
    expect(get().refus?.texte, 'la minuterie du refus précédent a mangé le suivant').toBe('Second.');
    eteindreRefus(get, banc.setState, get().refus!);
    expect(get().refus).toBeNull();
  });

  it('la minuterie d’un refus remplacé n’éteint pas le refus neuf, même après une remise à zéro (#2907)', () => {
    setup();
    refuserGeste(get, banc.setState, 'Premier.');
    refuserGeste(get, banc.setState, 'Second.');
    const second = get().refus!;
    banc.setState({ ...resetFields('combatStart') }); // un combat neuf remet le refus à zéro, sa minuterie reste en vol
    refuserGeste(get, banc.setState, 'Troisième.');
    refuserGeste(get, banc.setState, 'Quatrième.'); // même nonce que `second`
    eteindreRefus(get, banc.setState, second);
    expect(get().refus?.texte, 'la minuterie d’un refus remplacé a éteint le refus neuf').toBe('Quatrième.');
  });

  it('le CADRE l’efface : le combat SUIVANT ne s’ouvre pas sur le refus du précédent', () => {
    setup();
    refuserGeste(get, banc.setState, 'Hors de portée.');
    banc.setState({ battle: null, mode: 'exploration' }); // fin de combat (patron de la sortie de la victoire)
    get().lancerLeCombat('enc-mutants');
    expect(get().battle, 'témoin : le combat suivant ne s’est pas ouvert').not.toBeNull();
    expect(get().refus, 'le refus du combat précédent ouvre le suivant').toBeNull();
  });

  it('le changement de SCÈNE l’efface aussi, et la sauvegarde qui suit ne l’embarque pas', () => {
    setup();
    refuserGeste(get, banc.setState, 'Hors de portée.');
    banc.setState({ battle: null, mode: 'exploration' });
    get().quitterLaScene(testScene().id); // seam RÉEL du checkpoint : l'entrée en scène fait sauvegarder l'hôte
    expect(get().refus, 'le refus a traversé le changement de scène').toBeNull();
    const snap = snapshotSave(get(), '2026-08-20T00:00:00.000Z');
    expect(snap.data.refus, 'un refus périmé part dans la sauvegarde').toBeNull();
  });
});
