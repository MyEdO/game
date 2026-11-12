/**
 * LES SORTS HORS COMBAT EN COOP (#3427), sur transport en mémoire (`FakeTransport`) : sans combat, l'invité du siège 1
 * incante, focalise et dissipe avec SON héros chez l'hôte (`appliquerLIntentionDUnSiege`) ; la fenêtre ouverte tient la
 * main au héros de l'invité (`quiTientLaMain`), qui joue le jet jusqu'à sa clôture ; l'instantané reçu montre la même
 * fenêtre. Avec le héros de l'hôte, chaque geste est refusé.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { appliquerLIntentionDUnSiege, type IssueDIntention } from '../../noyau/intentionsDeSiege';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { quiTientLaMain } from '../../noyau/netOwnership';
import { fenetreDuJeu } from '../../noyau/combatAuto';
import { fenetreDIncantation, type FenetreDIncantation } from '../../noyau/fenetreDIncantation';
import { etatInitialDuJeu, type Jeu, type NetState } from '../../noyau/etat';
import { testScene } from '../../scenes/test-fixture';
import { herosDeScenario } from '../../scenes/test-scenarios/_heros';
import type { Combatant } from '../../engine/types';

const NET = (mode: 'hote' | 'invite', mySeat: number): NetState => ({
  mode, mySeat, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'connecte', hoteAbsent: false, ownership: { L: 1 }, slots: [1, 1, 0, 0], rangs: {},
});

/** Un sorcier en Langue (Magick) 60, qui connaît l'Arme aethyrique. */
function sorcier(id: string): Combatant {
  const h = herosDeScenario(idsDeTest, 'sorcier');
  h.id = id; h.label = id;
  h.spells = ['arme-aethyrique'];
  h.skills = [...h.skills.filter((s) => s.id !== 'langue'), { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 }] as typeof h.skills;
  return h;
}

/** Le héros de l'hôte porte un Sort durable (`dispel-hors-combat.hors-store.test.ts`). */
function porteurDuMalefice(id: string): Combatant {
  const h = sorcier(id);
  h.activeEffects = [{ label: 'Malédiction', characteristic: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
    spell: { spellId: 'malefice', ni: 1, casterId: 'ennemi', label: 'Maléfice' } }];
  return h;
}

interface Table {
  banc: Banc;
  envoyer: (action: string, args: unknown[]) => IssueDIntention;
  /** L'état de l'invité après le dernier instantané diffusé par l'hôte. */
  chezLInvite: () => Jeu;
}

/** La table hors combat : l'hôte (banc, héros `H`) et l'invité du siège 1 (héros `L`), reliés par transport. */
function table(): Table {
  const banc = ouvrirLeBanc({ desFixes: true, etat: { party: [porteurDuMalefice('H'), sorcier('L')], net: NET('hote', 0), screen: 'campaign' } });
  banc.getState().lancerLaScene(testScene());
  const issues: IssueDIntention[] = [];
  const recus: Record<string, unknown>[] = [];
  const host = new HostSession({
    build: 'test',
    applyIntent: (action, args, seat) => { issues.push(appliquerLIntentionDUnSiege(banc.getState, seat, action, args)); },
    getSnapshot: () => instantaneDeLaCoop(banc.getState()),
  });
  const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: (d) => { recus.push(d); } });
  const [a, b] = FakeTransport.pair();
  host.addGuest(a, 1);
  guest.connect(b);
  return {
    banc,
    envoyer: (action, args) => { guest.sendIntent(action, args); return issues[issues.length - 1]; },
    chezLInvite: () => {
      host.broadcastSnapshot();
      const etat = appliquerLInstantane(recus[recus.length - 1], { ...etatInitialDuJeu(), net: NET('invite', 1) }).etat;
      // Les lecteurs sont purs : l'état de l'invité, sous les actions du banc, qu'ils ne lisent pas.
      return { ...banc.getState(), ...etat };
    },
  };
}

/** La fenêtre sans ce qui juge le siège qui la lit (`incantation-coop.hors-store.test.ts`). */
function auMasque(v: FenetreDIncantation | null): unknown {
  return JSON.parse(JSON.stringify(v, (k, x) => (/^refus|^fermetures$|^annulation$/.test(k) ? undefined : x)));
}

describe('Sorts hors combat en coop : l’invité joue le geste et le jet de SON héros', () => {
  it('incanter : la fenêtre s’ouvre au héros de l’invité, la même chez lui, et il la joue jusqu’à sa clôture', () => {
    const t = table();
    expect(t.banc.getState().battle ?? null, 'témoin : hors combat').toBeNull();
    expect(t.envoyer('incanterLeSort', ['L', 'arme-aethyrique', 'L'])).toBe('appliquee');
    expect(t.banc.getState().pendingCast).toMatchObject({ casterId: 'L', result: null });
    expect(quiTientLaMain(t.banc.getState()), 'la fenêtre ne tient pas la main au héros de l’invité').toBe('L');
    const invite = t.chezLInvite();
    expect(quiTientLaMain(invite)).toBe('L');
    expect(auMasque(fenetreDIncantation(invite))).toEqual(auMasque(fenetreDIncantation(t.banc.getState())));
    expect(fenetreDIncantation(invite)).not.toBeNull();
    expect(t.envoyer('jetLancer', ['incantation'])).toBe('appliquee');
    expect(t.banc.getState().pendingCast!.result, 'le jet de l’invité n’est pas tombé chez l’hôte').toBeTruthy();
    expect(t.envoyer('jetValider', ['incantation'])).toBe('appliquee');
    expect(t.banc.getState().pendingCast ?? null, 'l’incantation n’est pas close').toBeNull();
    expect(quiTientLaMain(t.banc.getState())).toBeUndefined();
  });

  it('focaliser : la fenêtre s’ouvre au héros de l’invité, la même chez lui, et il la joue jusqu’à sa clôture', () => {
    const t = table();
    expect(t.envoyer('focaliserLeSort', ['L', 'arme-aethyrique'])).toBe('appliquee');
    expect(t.banc.getState().pendingFocus).toMatchObject({ casterId: 'L', result: null });
    expect(quiTientLaMain(t.banc.getState())).toBe('L');
    const invite = t.chezLInvite();
    expect(invite.pendingFocus).toEqual(t.banc.getState().pendingFocus);
    expect(fenetreDuJeu(invite)).toEqual(fenetreDuJeu(t.banc.getState()));
    expect(fenetreDuJeu(invite)).toMatchObject({ cle: 'focalisation', proprietaire: 'L' });
    expect(t.envoyer('jetLancer', ['focalisation'])).toBe('appliquee');
    expect(t.banc.getState().pendingFocus!.result).toBeTruthy();
    expect(t.envoyer('jetValider', ['focalisation'])).toBe('appliquee');
    expect(t.banc.getState().pendingFocus ?? null).toBeNull();
    expect(t.banc.getState().party.find((h) => h.id === 'L')!.focus?.spell).toBe('arme-aethyrique');
  });

  it('dissiper : la fenêtre s’ouvre au héros de l’invité, la même chez lui, et il la joue jusqu’à sa clôture', () => {
    const t = table();
    expect(t.envoyer('dissiperLeSort', ['L', 'malefice', 'ennemi'])).toBe('appliquee');
    expect(t.banc.getState().pendingDispel).toMatchObject({ casterId: 'L', spellCasterId: 'ennemi', result: null });
    expect(quiTientLaMain(t.banc.getState())).toBe('L');
    const invite = t.chezLInvite();
    expect(invite.pendingDispel).toEqual(t.banc.getState().pendingDispel);
    expect(fenetreDuJeu(invite)).toEqual(fenetreDuJeu(t.banc.getState()));
    expect(fenetreDuJeu(invite)).toMatchObject({ cle: 'dissipation', proprietaire: 'L' });
    expect(t.envoyer('jetLancer', ['dissipation'])).toBe('appliquee');
    expect(t.banc.getState().pendingDispel!.result).toBeTruthy();
    expect(t.envoyer('jetValider', ['dissipation'])).toBe('appliquee');
    expect(t.banc.getState().pendingDispel ?? null).toBeNull();
  });

  it('avec le héros de l’hôte, incanter, focaliser et dissiper sont refusés', () => {
    const t = table();
    expect(t.envoyer('incanterLeSort', ['H', 'arme-aethyrique', 'H'])).toBe('refusee');
    expect(t.envoyer('focaliserLeSort', ['H', 'arme-aethyrique'])).toBe('refusee');
    expect(t.envoyer('dissiperLeSort', ['H', 'malefice', 'ennemi'])).toBe('refusee');
    const s = t.banc.getState();
    expect([s.pendingCast ?? null, s.pendingFocus ?? null, s.pendingDispel ?? null]).toEqual([null, null, null]);
  });
});
