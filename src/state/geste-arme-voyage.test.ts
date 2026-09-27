/**
 * LE VERDICT D'ARMEMENT VOYAGE AVEC LE GESTE (#1411, P0-A) — spec HUD § « ARBITRAGE 2026-08-19 »
 * (`docs/plans/2026-08-16-spec-hud-combat.md`), qui exige d'ARMER la Course pour dépasser la Marche et
 * la Charge pour s'approcher d'un ennemi cliqué.
 *
 * L'intention armée est LOCALE au client (`localIntent`, hors snapshot réseau). Deux situations la
 * rendent illisible AU MOMENT où le geste s'exécute — ce sont les deux sondes de ce fichier :
 *
 *  (A) RÉ-ENTRÉE : un gate (Test de Calme d'approche, Bénédiction de Protection, choix cavalier/
 *      monture) DIFFÈRE le geste. Le premier clic a déjà dissous l'intention ; relire le store à la
 *      relance refuserait le geste que le joueur vient de GAGNER à son jet.
 *  (B) COOP : l'invité arme SA case, l'hôte exécute l'intent dans SON store — où cette intention
 *      n'existe pas. Sans verdict voyageur, un invité ne pourrait jamais charger ni courir, et l'hôte
 *      débloquerait le geste d'autrui en armant sa propre case.
 *
 * Le verdict se calcule donc chez l'ÉMETTEUR et voyage dans les args (`approche`/`courseArmee`),
 * exactement comme `confirm`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { argsAvecVerdictLocal } from './localIntent';
import { refuserGeste, eteindreRefus } from './refusVisible';
import { netSnapshot, applyNetSnapshot } from './netFlow';
import { snapshotSave } from './saves';
import { runAction } from './actionRegistry';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { chebyshev } from '../engine/grid';

const get = () => useGame.getState();

/** Combat témoin : un héros au tour ENTIER, un ennemi placé à distance de Charge (hors d'Allonge). */
function setup(opts: { peur?: boolean } = {}) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  get().startScene(testScene);
  get().startCombat('enc-mutants');
  get().confirmRoundStart();
  vi.clearAllTimers();
  const b = get().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const E = b.combatants.find((c) => c.kind === 'enemy')!;
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id)) e.pos = { x: 25 + i++, y: 25 };
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 13, y: 10 }; // distance 3 : hors d'Allonge, dans la portée de Charge (2×M)
  if (opts.peur) H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }] as never;
  const turn = b.order.indexOf(H.id);
  useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false, preview: null }, localIntent: null, refus: null });
  return { H, E };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllTimers();
  useGame.setState({ battle: null, pendingApproach: null, pendingAttack: null, localIntent: null, refus: null });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('(A) RÉ-ENTRÉE — un geste ARMÉ puis DIFFÉRÉ par un gate se commet à la relance', () => {
  it('Charge armée + Test de Calme d’approche RÉUSSI → le héros charge, sans « armez la Charge »', () => {
    const { H, E } = setup({ peur: true });
    runAction('charge', get); // le joueur ARME la case Charge, puis clique la cible
    get().battleClickEntity(E.id, { confirm: true });
    // Le gate de Peur s'ouvre : rien n'est commis, l'intention a été dissoute par ce clic.
    expect(get().pendingApproach, 'le Test de Calme d’approche ne s’est pas ouvert').not.toBeNull();
    expect(get().localIntent, 'témoin : le clic a bien dissous l’intention').toBeNull();
    useGame.setState({ pendingApproach: { ...get().pendingApproach!, result: { success: true, roll: 5, target: 50, sl: 4 } } });
    vi.clearAllTimers();
    get().approachConfirm();
    vi.runOnlyPendingTimers(); // joue le glissé d'approche → ouvre la frappe
    const h = get().battle!.combatants.find((c) => c.id === H.id)!;
    expect(get().refus, 'le geste GAGNÉ au jet a été refusé à la relance').toBeNull();
    expect(chebyshev(h.pos!, E.pos!), 'le héros n’a pas rejoint sa cible').toBe(1);
    expect(get().pendingAttack?.fromCharge, 'la frappe de Charge n’a pas suivi').toBe(true);
  });

  it('SANS armement, le même Test réussi ne commet PAS l’approche (le gate ne fabrique pas le geste)', () => {
    const { H, E } = setup({ peur: true });
    get().battleClickEntity(E.id, { confirm: true }); // aucune case armée → refus immédiat
    expect(get().refus?.texte ?? '', 'le refus n’a pas été dit').toContain('Charge');
    expect(get().pendingApproach, 'un gate s’est ouvert pour un geste refusé').toBeNull();
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
  });

  it('MONTURE : le choix cavalier/monture relance AVEC le verdict — la Charge armée approche', () => {
    const { H, E } = setup();
    useGame.setState({ pendingMountTarget: { riderId: H.id, mountId: E.id, approche: true } } as never);
    get().mountTargetSelect(E.id);
    vi.runOnlyPendingTimers();
    const h = get().battle!.combatants.find((c) => c.id === H.id)!;
    expect(get().refus, 'le geste armé avant la modale a été refusé à la relance').toBeNull();
    expect(chebyshev(h.pos!, E.pos!), 'la relance n’a pas approché').toBe(1);
  });

  it('MONTURE : sans verdict, la relance REFUSE et le héros reste immobile (la modale ne fabrique rien)', () => {
    const { H, E } = setup();
    useGame.setState({ pendingMountTarget: { riderId: H.id, mountId: E.id, approche: false } } as never);
    get().mountTargetSelect(E.id);
    vi.runOnlyPendingTimers();
    expect(get().refus?.texte ?? '', 'le refus n’a pas été dit').toContain('Charge');
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'la modale a déplacé un héros qui n’avait rien armé').toEqual({ x: 10, y: 10 });
  });
});

describe('(B) COOP — le verdict se calcule chez l’ÉMETTEUR et voyage dans les args', () => {
  it('l’intention armée du client entre dans les args de SON intent (clic-ennemi et clic-case)', () => {
    setup();
    runAction('charge', get);
    expect(argsAvecVerdictLocal(get, 'battleClickEntity', ['e1', { confirm: true }]))
      .toEqual(['e1', { confirm: true, approche: true }]);
    runAction('course', get);
    expect(argsAvecVerdictLocal(get, 'battleClickTile', [{ x: 1, y: 1 }, { confirm: true }]))
      .toEqual([{ x: 1, y: 1 }, { confirm: true, courseArmee: true }]);
  });

  it('rien d’armé → le verdict part FAUX (l’hôte ne doit rien deviner)', () => {
    setup();
    expect(argsAvecVerdictLocal(get, 'battleClickEntity', ['e1', {}])).toEqual(['e1', { approche: false }]);
    expect(argsAvecVerdictLocal(get, 'battleClickTile', [{ x: 1, y: 1 }, {}])).toEqual([{ x: 1, y: 1 }, { courseArmee: false }]);
  });

  it('un intent SANS verdict à joindre voyage inchangé', () => {
    setup();
    runAction('charge', get);
    expect(argsAvecVerdictLocal(get, 'battleEndTurn', [])).toEqual([]);
  });

  it('HÔTE non armé : le geste de l’INVITÉ (verdict dans les args) s’exécute quand même', () => {
    const { H, E } = setup();
    expect(get().localIntent, 'témoin : l’hôte n’a RIEN armé').toBeNull();
    get().battleClickEntity(E.id, { confirm: true, approche: true }); // args tels que l'invité les a émis
    vi.runOnlyPendingTimers();
    const h = get().battle!.combatants.find((c) => c.id === H.id)!;
    expect(get().refus, 'l’hôte a refusé le geste que l’invité avait armé').toBeNull();
    expect(chebyshev(h.pos!, E.pos!)).toBe(1);
  });

  it('HÔTE armé : sa case NE DÉBLOQUE PAS le geste d’un invité qui n’a rien armé', () => {
    const { H, E } = setup();
    runAction('charge', get); // l'HÔTE arme SA case…
    expect(get().localIntent).toEqual({ actionId: 'charge' });
    get().battleClickEntity(E.id, { confirm: true, approche: false }); // …mais l'invité a émis « non armé »
    expect(get().refus?.texte ?? '', 'le geste non armé de l’invité est passé').toContain('Charge');
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'le héros a été déplacé par la case d’un AUTRE').toEqual({ x: 10, y: 10 });
    expect(get().pendingAttack).toBeNull();
  });

  it('MÊME loi pour le clic-case : l’hôte armé ne fait pas courir l’invité', () => {
    const { H } = setup();
    const loin = { x: 10 + 6, y: 10 }; // au-delà de la Marche (M4), dans la zone de Course
    runAction('course', get);
    get().battleClickTile(loin, { confirm: true, courseArmee: false });
    expect(get().pendingRun ?? get().pendingCascade, 'la Course d’autrui est partie sur la case de l’hôte').toBeFalsy();
    expect(get().refus?.texte ?? '').toContain('Course');
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
  });

  it('CLAVIER : `commitCursor` commet par l’ACTION DE STORE — donc par le wrapper d’invité', () => {
    const { E } = setup();
    // L'invité n'émet ses gestes que parce que `netFlow.interceptGuestActions` REMPLACE les actions de
    // l'allowlist DANS le store. Un commit clavier qui appellerait le chemin interne au lieu de
    // `get().battleClickEntity` sortirait du réseau sans un bruit : chez l'invité, le clavier ne jouerait
    // plus. On installe le substitut par le MÊME moyen que le wrapper (`useGame.setState`).
    const originales = { battleClickEntity: get().battleClickEntity, battleClickTile: get().battleClickTile };
    const emis: { action: string; args: unknown[] }[] = [];
    useGame.setState({
      battleClickEntity: (...args: unknown[]) => { emis.push({ action: 'battleClickEntity', args }); },
      battleClickTile: (...args: unknown[]) => { emis.push({ action: 'battleClickTile', args }); },
    } as never);
    try {
      useGame.setState({ combatCursor: { tile: { ...E.pos! }, snappedId: E.id } } as never);
      get().commitCursor();
      useGame.setState({ combatCursor: { tile: { x: 11, y: 10 } } } as never);
      get().commitCursor();
    } finally {
      useGame.setState(originales as never);
      useGame.setState({ combatCursor: null } as never);
    }
    expect(emis, 'le commit clavier a court-circuité les actions de store (invisible au réseau)').toEqual([
      { action: 'battleClickEntity', args: [E.id, { confirm: true }] },
      { action: 'battleClickTile', args: [{ x: 11, y: 10 }, { confirm: true }] },
    ]);
  });
});

describe('(C) le REFUS est un canal LOCAL — et ne se tait jamais', () => {
  it('HORS COMBAT, il retombe sur le journal de partie (jamais un no-op silencieux)', () => {
    useGame.setState({ battle: null, refus: null, journal: [] } as never);
    refuserGeste(get, useGame.setState, 'Geste impossible ici.');
    expect(get().refus, 'hors combat il n’y a pas de bannière : rien ne doit rester en attente').toBeNull();
    expect(get().journal.join('\n'), 'le refus s’est tu').toContain('Geste impossible ici.');
  });

  it('EN COMBAT, il ne touche NI le journal de partie NI le journal de combat', () => {
    setup();
    const journalAvant = get().journal.length;
    const logAvant = get().battle!.log.length;
    refuserGeste(get, useGame.setState, 'Trop loin.');
    expect(get().refus?.texte).toBe('Trop loin.');
    expect(get().journal.length, 'le refus a pollué le journal de partie').toBe(journalAvant);
    expect(get().battle!.log.length, 'le refus a persisté dans le journal de COMBAT (et voyagerait aux invités)').toBe(logAvant);
  });

  it('il NE VOYAGE PAS : absent du snapshot de l’hôte, préservé chez le client qui le reçoit', () => {
    setup();
    refuserGeste(get, useGame.setState, 'Trop loin.');
    expect('refus' in netSnapshot(get), 'le refus de l’hôte part chez ses invités').toBe(false);
    const snap = JSON.parse(JSON.stringify({ ...netSnapshot(get) })) as Record<string, unknown>;
    applyNetSnapshot(useGame.setState, snap);
    expect(get().refus?.texte, 'un snapshot de l’hôte a effacé le refus du client').toBe('Trop loin.');
  });

  it('son extinction ne coupe QUE le refus visé (un refus survenu depuis garde sa durée)', () => {
    setup();
    refuserGeste(get, useGame.setState, 'Premier.');
    const premier = get().refus!.nonce;
    refuserGeste(get, useGame.setState, 'Second.');
    eteindreRefus(get, useGame.setState, premier); // la minuterie du PREMIER arrive en retard
    expect(get().refus?.texte, 'la minuterie du refus précédent a mangé le suivant').toBe('Second.');
    eteindreRefus(get, useGame.setState, get().refus!.nonce);
    expect(get().refus).toBeNull();
  });

  it('le CADRE l’efface : le combat SUIVANT ne s’ouvre pas sur le refus du précédent', () => {
    setup();
    refuserGeste(get, useGame.setState, 'Hors de portée.');
    useGame.setState({ battle: null, mode: 'exploration' }); // fin de combat (patron `dismissVictory`)
    get().startCombat('enc-mutants');
    expect(get().battle, 'témoin : le combat suivant ne s’est pas ouvert').not.toBeNull();
    expect(get().refus, 'le refus du combat précédent ouvre le suivant').toBeNull();
  });

  it('le changement de SCÈNE l’efface aussi, et la sauvegarde qui suit ne l’embarque pas', () => {
    setup();
    refuserGeste(get, useGame.setState, 'Hors de portée.');
    useGame.setState({ battle: null, mode: 'exploration' });
    get().transitionTo(testScene.id); // seam RÉEL du checkpoint : `transitionTo` appelle `autoSave`
    expect(get().refus, 'le refus a traversé le changement de scène').toBeNull();
    const snap = snapshotSave(
      get() as unknown as Record<string, unknown>,
      useGame.getInitialState() as unknown as Record<string, unknown>,
      '2026-08-20T00:00:00.000Z',
    );
    expect(snap.data.refus, 'un refus périmé part dans la sauvegarde').toBeNull();
  });
});
