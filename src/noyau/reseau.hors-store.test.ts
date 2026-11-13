/**
 * LE RÉSEAU DE L'INVITÉ (#3009) : `transmettreLesIntentions` enrobe dans l'état les actions de l'allowlist
 * (`GUEST_INTENTS`) ; un appel par l'état part en intention (`emettreIntentInvite`, `sanitizeIntentArgs`), sauf l'élection
 * locale ; `restaurerLesIntentions` rend les actions d'origine. Le sort d'une action (`emettreIntentInvite`) : l'élection
 * locale, le carnet, les clics du champ, le verbe d'une offre. L'attribution des sièges (`affecterLeHerosAuSiege`,
 * `affecterLEmplacementAuSiege`, `affecterLeSiegeMJ`) et ses refus.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emettreIntentInvite, sanitizeIntentArgs } from './reseau';
import { GUEST_INTENTS } from './intentionsDeSiege';
import { tableDeDissipation } from './tableDeDissipation.testkit';
import { applyEffects } from './combatEffects';
import { affichés, narratif, hero as heroDesIndices, fixtureScene } from './monde/clues.fixture';
import { initialNet, type NetState } from './etat';
import { appliquerLInstantane, instantaneDeLaCoop } from './coop';
import { t } from '../i18n';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { spawnEnemy } from './monde/spawn';

const caseDe = (banc: Banc, id: string) => ({ ...banc.getState().battle!.combatants.find((c) => c.id === id)!.pos! });

/** Un invité (siège 1, qui tient `h1`) devant la table de Dissipation, ses intentions transmises à `espion`. */
function invite(porteurs: Record<string, number>, banc = ouvrirLeBanc()) {
  banc.setState(tableDeDissipation('invite', porteurs));
  const espion = vi.fn();
  banc.getState().transmettreLesIntentions(espion);
  return { banc, espion };
}

/** Le nombre d'écritures de l'état depuis l'appel. */
function compterLesEcritures(banc: Banc): () => number {
  let n = 0;
  banc.subscribe(() => { n++; });
  return () => n;
}
const actionsDe = (banc: Banc) => new Map([...GUEST_INTENTS].map((nom) => [nom, (banc.getState() as unknown as Record<string, unknown>)[nom]]));
/** Les actions de l'allowlist qui ne sont plus celles d'`origine`. */
const enrobesRestants = (banc: Banc, origine: Map<string, unknown>) =>
  [...origine].filter(([nom, fn]) => (banc.getState() as unknown as Record<string, unknown>)[nom] !== fn).map(([nom]) => nom);
function enInvite(): Banc {
  const banc = ouvrirLeBanc();
  banc.setState({ net: { ...banc.getState().net, mode: 'invite', mySeat: 1 } });
  return banc;
}

describe('transmettreLesIntentions — l’invité demande, l’hôte joue', () => {
  it('a. un verbe de l’allowlist appelé par l’état part en intention, arguments assainis, et ne joue pas chez l’invité', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ party: [heroDesIndices()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-o')], entryId: 'scene-o', narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    banc.setState({ net: { ...banc.getState().net, mode: 'invite', mySeat: 1 } });
    const espion = vi.fn();
    banc.getState().transmettreLesIntentions(espion);
    const vus = affichés(banc.getState().clues, ['ind-lettre']);
    const evenement: Record<string, unknown> = {};
    evenement.self = evenement;
    (banc.getState().marquerLesIndices as (...a: unknown[]) => void)(vus, evenement);
    expect(espion.mock.calls).toEqual([['marquerLesIndices', [vus]]]);
    expect(banc.getState().clues['ind-lettre'].vuParSiège, 'le marquage s’est joué chez l’invité').toBeUndefined();
  });

  it('b. l’élection locale (Dissiper, porteur à 2 Sorts) joue chez l’invité et ne part pas (LDB 46 l.158-162)', () => {
    const { banc, espion } = invite({ e1: 2 });
    banc.getState().cliquerLaCase(caseDe(banc, 'e1'), 'e1');
    expect(banc.getState().dispelCarrierId, 'l’élection n’a pas eu lieu chez l’invité').toBe('e1');
    expect(espion).not.toHaveBeenCalled();
  });

  it('c. un verbe hors allowlist joue chez l’invité', () => {
    const { banc, espion } = invite({ e1: 2 });
    expect(GUEST_INTENTS.has('designerLeSupport')).toBe(false);
    banc.getState().designerLeSupport('e1');
    expect(banc.getState().dispelCarrierId).toBe('e1');
    expect(espion).not.toHaveBeenCalled();
  });

  it('d. restaurerLesIntentions rend les actions d’origine ; un second appel, ou sans enrobage, ne fait rien', () => {
    const banc = ouvrirLeBanc();
    const actions = () => [...GUEST_INTENTS].map((nom) => [nom, (banc.getState() as unknown as Record<string, unknown>)[nom]] as const);
    const memes = (attendu: ReturnType<typeof actions>) => actions().forEach(([nom, fn], i) => expect(fn, nom).toBe(attendu[i][1]));
    const origine = actions();
    const ecritures = compterLesEcritures(banc);
    banc.getState().restaurerLesIntentions();
    expect(ecritures(), 'restaurer sans enrobage a écrit l’état').toBe(0);
    memes(origine);
    banc.setState({ net: { ...banc.getState().net, mode: 'invite', mySeat: 1 } });
    banc.getState().transmettreLesIntentions(vi.fn());
    expect(banc.getState().marquerLesIndices, 'l’enrobage n’est pas posé').not.toBe(banc.actions.marquerLesIndices);
    banc.getState().restaurerLesIntentions();
    memes(origine);
    const apres = ecritures();
    banc.getState().restaurerLesIntentions();
    expect(ecritures(), 'un second restaurer a écrit l’état').toBe(apres);
    memes(origine);
  });

  it('e. une seconde transmission est ignorée : même enrobage, aucune écriture, l’envoi part au premier `envoyer`', () => {
    const banc = enInvite();
    const origine = actionsDe(banc);
    const premier = vi.fn();
    const second = vi.fn();
    banc.getState().transmettreLesIntentions(premier);
    const enrobe = banc.getState().terminerLeTour;
    const ecritures = compterLesEcritures(banc);
    banc.getState().transmettreLesIntentions(second);
    expect(ecritures(), 'la seconde transmission a écrit l’état').toBe(0);
    expect(banc.getState().terminerLeTour, 'la seconde transmission a ré-enrobé').toBe(enrobe);
    banc.getState().terminerLeTour();
    expect(premier.mock.calls).toEqual([['terminerLeTour', []]]);
    expect(second).not.toHaveBeenCalled();
    banc.getState().restaurerLesIntentions();
    expect(enrobesRestants(banc, origine)).toEqual([]);
  });

  it('f. une transmission après restauration ré-enrobe : l’envoi part au second `envoyer`', () => {
    const banc = enInvite();
    const origine = actionsDe(banc);
    const premier = vi.fn();
    const second = vi.fn();
    banc.getState().transmettreLesIntentions(premier);
    banc.getState().restaurerLesIntentions();
    banc.getState().transmettreLesIntentions(second);
    banc.getState().terminerLeTour();
    expect(second.mock.calls).toEqual([['terminerLeTour', []]]);
    expect(premier).not.toHaveBeenCalled();
    banc.getState().restaurerLesIntentions();
    expect(enrobesRestants(banc, origine)).toEqual([]);
  });

  it('g. un instantané appliqué entre transmission et restauration garde l’enrobage ; la restauration rend tout', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ net: { ...banc.getState().net, mode: 'hote' } });
    const instantane = JSON.parse(JSON.stringify(instantaneDeLaCoop(banc.getState()))) as Record<string, unknown>;
    banc.setState({ net: { ...banc.getState().net, mode: 'invite', mySeat: 1 } });
    const origine = actionsDe(banc);
    const envoyer = vi.fn();
    banc.getState().transmettreLesIntentions(envoyer);
    banc.setState(appliquerLInstantane(instantane, banc.getState()).etat as never);
    banc.getState().terminerLeTour();
    expect(envoyer.mock.calls).toEqual([['terminerLeTour', []]]);
    banc.getState().restaurerLesIntentions();
    expect(enrobesRestants(banc, origine)).toEqual([]);
  });

  it('h. en Auto-combat, le Destin que le tick résout pour le héros de l’invité part en intention', () => {
    const { banc, espion } = invite({}, ouvrirLeBanc({ cadence: 'auto' }));
    banc.setState({ pendingFateSave: { heroId: 'h1', source: 'slow' } as never });
    banc.jusquA(() => espion.mock.calls.length > 0);
    expect(espion.mock.calls[0]).toEqual(['fenetreChoisir', ['destin', 'issue', 'survivre']]);
    expect(banc.getState().pendingFateSave, 'le Destin s’est joué chez l’invité').not.toBeNull();
  });
});

describe('emettreIntentInvite — l’action d’un invité part en intention, sauf l’élection locale', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });

  it('Dissiper, porteur à 2 Sorts : l’élection se joue chez l’émetteur, rien ne part (LDB 46 l.158-162)', () => {
    banc.setState(tableDeDissipation('invite', { e1: 2 }));
    const envoyer = vi.fn();
    emettreIntentInvite(banc.getState, 'cliquerLaCase', banc.getState().cliquerLaCase as never, envoyer, [caseDe(banc, 'e1'), 'e1']);
    expect(banc.getState().dispelCarrierId, 'l’élection n’a pas eu lieu chez l’ÉMETTEUR').toBe('e1');
    expect(envoyer, 'l’élection est partie chez l’hôte').not.toHaveBeenCalled();
    expect(banc.getState().pendingDispel).toBeNull();
  });

  it('Dissiper, porteur à 1 Sort : rien à élire, rien d’armé : le geste part tel quel', () => {
    banc.setState(tableDeDissipation('invite', { e1: 1 }));
    const envoyer = vi.fn();
    emettreIntentInvite(banc.getState, 'cliquerLaCase', banc.getState().cliquerLaCase as never, envoyer, [caseDe(banc, 'e1'), 'e1']);
    expect(banc.getState().dispelCarrierId).toBeNull();
    expect(banc.getState().pendingDispel, 'le commit s’est joué EN LOCAL').toBeNull();
    expect(envoyer.mock.calls).toEqual([['cliquerLaCase', [caseDe(banc, 'e1'), 'e1']]]);
  });

  it('carnet : `marquerLesIndices` part en intention et ne se joue pas localement (#2415)', () => {
    banc.setState({ party: [heroDesIndices()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-o')], entryId: 'scene-o', narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    const envoyer = vi.fn();
    const vus = affichés(banc.getState().clues, ['ind-lettre']);
    emettreIntentInvite(banc.getState, 'marquerLesIndices', banc.getState().marquerLesIndices as never, envoyer, [vus]);
    expect(envoyer).toHaveBeenCalledWith('marquerLesIndices', [vus]);
    expect(banc.getState().clues['ind-lettre'].vuParSiège, 'le marquage s’est joué EN LOCAL').toBeUndefined();
  });

  it('clics du champ : la frappe d’un ennemi et le clic-sol partent, l’action locale ne joue pas', () => {
    const h = tousLesHerosDeScenario(idsDeTest)[0]; h.id = 'h1'; h.pos = { x: 6, y: 10 };
    const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 });
    const w = 22, hh = 16;
    banc.setState({
      battle: { combatants: [h, enemy], order: ['h1', 'e1'], baseOrder: ['h1', 'e1'], turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as never,
      scene: { id: 's', dimensions: { w, h: hh }, layers: [{ z: 0, tiles: new Array(w * hh).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never,
      party: [h], mode: 'battle', net: { ...initialNet(), mode: 'invite', mySeat: 0, ownership: { h1: 0 } },
    });
    const local = vi.fn();
    const envoyer = vi.fn();
    emettreIntentInvite(banc.getState, 'cliquerLaCase', local, envoyer, [{ x: 7, y: 10 }, 'e1', { confirm: true }]);
    emettreIntentInvite(banc.getState, 'cliquerLaCase', local, envoyer, [{ x: 12, y: 4 }, undefined, { confirm: false }]);
    expect(envoyer.mock.calls.map(([action]) => action)).toEqual(['cliquerLaCase', 'cliquerLaCase']);
    expect(local, 'le geste s’est joué en local au lieu de partir à l’hôte').not.toHaveBeenCalled();
  });
});

describe('emettreIntentInvite — le verbe de l’offre d’un invité : il part, l’attaque s’arme avant', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });

  /** Le duel du héros `h1` de l'invité (siège 0 de la table) contre `e1`, à son tour. */
  function duel(): void {
    const h = tousLesHerosDeScenario(idsDeTest)[0]; h.id = 'h1'; h.pos = { x: 6, y: 10 };
    const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 });
    const w = 22, hh = 16;
    banc.setState({
      battle: { combatants: [h, enemy], order: ['h1', 'e1'], baseOrder: ['h1', 'e1'], turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as never,
      scene: { id: 's', dimensions: { w, h: hh }, layers: [{ z: 0, tiles: new Array(w * hh).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never,
      party: [h], mode: 'battle', screen: 'campaign', net: { ...initialNet(), mode: 'invite', mySeat: 0, ownership: { h1: 0 } }, localIntent: null,
    });
  }

  it('un verbe de la barre (`terminerLeTour`) part tel quel et ne se joue pas chez l’émetteur', () => {
    duel();
    const local = vi.fn();
    const envoyer = vi.fn();
    emettreIntentInvite(banc.getState, 'terminerLeTour', local, envoyer, []);
    expect(envoyer.mock.calls).toEqual([['terminerLeTour', []]]);
    expect(local).not.toHaveBeenCalled();
    expect(banc.getState().localIntent).toBeNull();
  });

  it('`armerLAttaque`, joué chez l’hôte : son intention s’arme chez l’émetteur AVANT l’envoi', () => {
    duel();
    const local = vi.fn();
    const armeeALEnvoi: (string | null)[] = [];
    const envoyer = vi.fn(() => { armeeALEnvoi.push(banc.getState().localIntent?.actionId ?? null); });
    emettreIntentInvite(banc.getState, 'armerLAttaque', local, envoyer, ['arme']);
    expect(envoyer.mock.calls).toEqual([['armerLAttaque', ['arme']]]);
    expect(armeeALEnvoi, 'l’intention n’était pas armée quand l’offre est partie').toEqual(['attaque']);
    expect(local, 'le corps s’est joué chez l’émetteur').not.toHaveBeenCalled();
  });
});

describe('les sièges de la coop : une attribution refusée laisse `net` inchangé et dit son refus (#3059 F10)', () => {
  let banc: Banc;
  const hote = (): NetState => ({ ...initialNet(), mode: 'hote', roomCode: 'ABC234', seatNames: { 0: 'Hôte', 1: 'Anna' }, rangs: { h: 0 } });
  beforeEach(() => {
    banc = ouvrirLeBanc();
    banc.setState({ net: hote(), party: [{ ...tousLesHerosDeScenario(idsDeTest)[0], id: 'h' }], battle: null });
  });

  it('un emplacement occupé, puis un siège hors de la table ; un héros et le rôle MJ hors de la table, un héros absent', () => {
    const avant = banc.getState().net;
    const journal = banc.getState().journal.length;
    banc.getState().affecterLEmplacementAuSiege(0, 1);
    banc.getState().affecterLEmplacementAuSiege(1, 7);
    banc.getState().affecterLeHerosAuSiege('h', 7);
    banc.getState().affecterLeHerosAuSiege('absent', 1);
    banc.getState().affecterLeSiegeMJ(7);
    expect(banc.getState().net).toBe(avant);
    expect(banc.getState().journal.slice(journal)).toEqual([
      t('coop.assign.slotTaken'), t('coop.assign.seatUnknown'), t('coop.assign.seatUnknown'), t('coop.assign.heroAbsent'), t('coop.assign.seatUnknown'),
    ]);
  });

  it('les mêmes gestes vers un emplacement vide et un siège de la table s’appliquent', () => {
    banc.getState().affecterLEmplacementAuSiege(1, 1);
    banc.getState().affecterLeHerosAuSiege('h', 1);
    banc.getState().affecterLeSiegeMJ(1);
    expect(banc.getState().net).toMatchObject({ slots: [0, 1, 0, 0], ownership: { h: 1 }, gmSeat: 1 });
  });
});

describe('sanitizeIntentArgs — l’événement React ne part pas sur le réseau (audit coop)', () => {
  it('tronque la queue non sérialisable (événement circulaire, fonction) sans toucher aux vrais args', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular; // un SyntheticEvent est circulaire (nativeEvent/target)
    expect(sanitizeIntentArgs(['h2', 'planque', 120, circular])).toEqual(['h2', 'planque', 120]);
    expect(sanitizeIntentArgs([circular])).toEqual([]);
    expect(sanitizeIntentArgs([() => {}])).toEqual([]);
    expect(sanitizeIntentArgs(['h1', { x: 1 }])).toEqual(['h1', { x: 1 }]);
  });
});
