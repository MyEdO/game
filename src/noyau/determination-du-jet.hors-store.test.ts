/**
 * La Détermination d'un jet de Psychologie (LDB 17 l.59) n'a qu'une entrée, le verbe général `depenserLaDetermination`
 * (#3612 L5) : la fenêtre de la bande l'offre (`fenetreDeDetermination`), chaque porteur fermé par son refus
 * (`refusDImmunite`), le même que le verbe lit ; la dépense frappe la rangée du porteur (`jetImmunise`). Sa route coop
 * n'admet que le siège qui influence le porteur (`seatInfluences`) : ni celui qui tient la main du tour, ni un autre
 * siège sur une bande partagée.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { initialFields } from './stateFields';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { intentAllowedFor } from './netOwnership';
import { startCascade } from './cascade';
import { fenetreDeDetermination } from './determinationDuJet';
import { libelleDeLaFermeture } from './libelles';
import { testScene } from '../scenes/test-fixture';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { isPsychImmune } from '../engine/psychology';
import type { Combatant } from '../engine/types';
import type { BatchParticipant, CascadeStep } from './pendings';
import { t } from '../i18n';
import { fixtureText } from '../i18n/fixtureText';
import { cleDeFixture } from './noyau.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, pos: { x: number; y: number }, resolve = 2): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind: 'heros', characteristics: { ...CHARS }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(12), resolve, fortune: 0,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);

/** Combat coop : `h2` (siège 1) ACTIF, `h3` (siège 2). */
function arene() {
  const h2 = mk('h2', { x: 0, y: 0 });
  const h3 = mk('h3', { x: 4, y: 4 });
  const battle = {
    combatants: [h2, h3], order: ['h2', 'h3'], baseOrder: ['h2', 'h3'], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({
    ...initialFields(), battle, mode: 'battle', scene: testScene(), party: [h2, h3],
    net: { ...initialNet(), mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { h2: 1, h3: 2 }, slots: [1, 2, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité A', 2: 'Invité B' } },
  });
}

const row = (id: string, over: Partial<BatchParticipant> = {}): BatchParticipant => ({ id, interactive: true, base: 50, target: 50, result: null, ...over });

/** Une bande de Peur (LDB 21 l.25) partagée par `h2` et `h3` : la fenêtre est à tous (`groupOwner`). */
function bandeDePeur(rangees: BatchParticipant[] = [row('h2'), row('h3')]) {
  const etape: CascadeStep = {
    id: 'bande-peur', kind: 'psychologieDeCombat', label: fixtureText('Peur'), aggregate: 'none', participants: rangees, result: null, groupOwner: true,
    psychologieDeCombat: { kind: 'peur', sourceId: 'e1', sourceName: fixtureText('Bête'), indice: 2, round: 1 },
  };
  startCascade(banc.getState, banc.setState, { title: 'Peur', purpose: 'test', steps: [etape] });
}

const combattant = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;
const intention = (siege: number, args: unknown[]) => appliquerLIntentionDUnSiege(banc.getState, siege, 'depenserLaDetermination', args);

describe('route coop de `depenserLaDetermination` : le siège qui influence le porteur', () => {
  beforeEach(arene);

  it('à la barre de l’actif : son siège ne dépense pas le point du héros d’un autre siège ; le siège du porteur, oui', () => {
    expect(intention(1, ['h3', 'immuniserALaPsychologie']), 'le siège du tour dépensait le point d’autrui').toBe('refusee');
    expect(combattant('h3').resolve).toBe(2);
    expect(isPsychImmune(combattant('h3'))).toBe(false);
    expect(intention(2, ['h3', 'immuniserALaPsychologie'])).toBe('appliquee');
    expect(combattant('h3').resolve).toBe(1);
    expect(isPsychImmune(combattant('h3'))).toBe(true);
    expect(intention(1, ['h2', 'ignorerLesCritiques']), 'le siège de l’actif dépense le sien').toBe('appliquee');
    expect(combattant('h2').resolve).toBe(1);
  });

  it('sur une bande partagée (`*`) : un invité ne dépense que le point de son héros', () => {
    bandeDePeur();
    expect(intentAllowedFor(banc.getState(), 1, 'depenserLaDetermination', ['h3', 'immuniserALaPsychologie'])).toBe(false);
    expect(intention(1, ['h3', 'immuniserALaPsychologie'])).toBe('refusee');
    expect(banc.getState().pendingCascade!.participants[0].participants![1].immune).toBeUndefined();
    expect(intention(1, ['h2', 'immuniserALaPsychologie'])).toBe('appliquee');
    expect(banc.getState().pendingCascade!.participants[0].participants![0].immune).toBe(true);
  });

  it('un id absent ou qui n’est pas une chaîne : personne', () => {
    expect(intentAllowedFor(banc.getState(), 0, 'depenserLaDetermination', [])).toBe(false);
    expect(intentAllowedFor(banc.getState(), 0, 'depenserLaDetermination', [3, 'immuniserALaPsychologie'])).toBe(false);
  });
});

describe('`fenetreDeDetermination` : la bande offre l’immunité à chacun de ses porteurs, chacun fermé par le refus du verbe', () => {
  beforeEach(arene);

  it('rangée due ouverte, rangée jetée fermée, réserve vide fermée ; l’immunité seule, sans État', () => {
    banc.setState({ battle: { ...banc.getState().battle!, combatants: [mk('h2', { x: 0, y: 0 }), mk('h3', { x: 4, y: 4 }, 0)] } });
    bandeDePeur([row('h2'), row('h3')]);
    const f = fenetreDeDetermination(banc.getState())!;
    expect(f.porteur.options).toEqual([
      { valeur: 'h2', libelle: 'h2', refus: null },
      { valeur: 'h3', libelle: 'h3', refus: t('agate.noResolve') },
    ]);
    expect(f.option.options.map((o) => o.valeur)).toEqual(['immuniserALaPsychologie']);
    expect(f.etat.options.map((o) => o.valeur)).toEqual([null]);
    banc.getState().jetLancer('cascadeEnBande', 'h2');
    expect(fenetreDeDetermination(banc.getState())!.porteur.options[0].refus, 'le jet tombé, la Peur a pesé').toBe(libelleDeLaFermeture('jetLance'));
    banc.getState().depenserLaDetermination('h2', 'immuniserALaPsychologie');
    expect(combattant('h2').resolve, 'le verbe lit le même refus que la fenêtre').toBe(2);
  });

  it('une bande sans Psychologie : chaque porteur fermé, rien à écarter, et le verbe ne dépense rien', () => {
    const etape: CascadeStep = { id: 'bande-nue', kind: cleDeFixture('bande-nue'), label: fixtureText('Bande'), aggregate: 'none', participants: [row('h2'), row('h3')], result: null, groupOwner: true };
    startCascade(banc.getState, banc.setState, { title: 'Bande', purpose: 'test', steps: [etape] });
    expect(fenetreDeDetermination(banc.getState())!.porteur.options.map((o) => o.refus)).toEqual([t('cs.determinationSansMalusPsy'), t('cs.determinationSansMalusPsy')]);
    banc.getState().depenserLaDetermination('h2', 'immuniserALaPsychologie');
    expect(combattant('h2').resolve).toBe(2);
  });

  it('hors de tout jet : aucune fenêtre de Détermination', () => {
    expect(fenetreDeDetermination(banc.getState())).toBeNull();
  });
});
