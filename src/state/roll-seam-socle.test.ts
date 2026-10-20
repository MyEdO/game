/**
 * SOCLE DE SURFACE (#1262 V0) — les constructeurs partagés de `rollSeam` : `surfaceRow` (rangée
 * surfacée vs témoin NÉ roulé), `bandStep` (la bande pose SA possession, et sa fenêtre atteint le
 * siège de son porteur), `bandStepId` (dédoublement d'id).
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { surfaceRow, bandStep, bandStepId, surfaceOf } from '../noyau/rollSeam';
import { startCascade } from '../noyau/cascade';
import { modalOwnerOf } from '../noyau/modalArbiter';
import { ownsLocal } from '../noyau/netOwnership';
import { seatOwns } from '../noyau/sieges';
import type { BatchParticipant } from '../noyau/pendings';
import type { Combatant } from '../engine/types';
import { cleDeFixture } from '../noyau/noyau.testkit';

const hero = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: `Héros ${id}`, kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    skills: [], conditions: [], talents: [], fortune: 2, resilience: 3,
    ...over,
  }) as unknown as Combatant;

const rang = (id: string): BatchParticipant =>
  ({ id, label: 'Résistance', difficulty: 'intermediaire', base: 40, target: 40, result: null, interactive: true }) as unknown as BatchParticipant;

describe('#1262 — surfaceRow : rangée SURFACÉE ou TÉMOIN né roulé', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, party: [], pendingCascade: null } as never);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {} } } as never);
  });

  it('porteur tenu par un siège → rangée SURFACÉE : interactive, sans résultat', () => {
    const h = hero('H1');
    useGame.setState({ party: [h] } as never);
    expect(surfaceOf(useGame.getState, h.id)).toBe(true);
    const r = surfaceRow(useGame.getState, h.id, rang('H1'));
    expect(r.interactive).toBe(true);
    expect(r.result).toBeNull();
  });

  it('porteur qu’AUCUN siège ne tient (héros conduit par l’IA) → TÉMOIN né roulé : result posé à la construction', () => {
    const h = hero('H2', { aiControlled: true } as Partial<Combatant>);
    useGame.setState({ party: [h] } as never);
    expect(surfaceOf(useGame.getState, h.id)).toBe(false);
    const r = surfaceRow(useGame.getState, h.id, rang('H2'));
    expect(r.interactive).toBe(false);
    expect(r.result, 'un témoin sans résultat suspendrait sa bande').toBeTruthy();
    expect(typeof r.result!.roll).toBe('number');
  });

  it('acteur ABSENT (côté monde) → témoin né roulé (aucun pilote possible)', () => {
    const r = surfaceRow(useGame.getState, undefined, rang('W'));
    expect(r.interactive).toBe(false);
    expect(r.result).toBeTruthy();
  });

  it('rangée VENUE d’une sauvegarde (résultat déjà posé) : aucun second dé, dans les deux régimes', () => {
    const h = hero('H3');
    useGame.setState({ party: [h] } as never);
    const deja = { ...rang('H3'), result: { roll: 42, target: 40, sl: 0, success: false } } as BatchParticipant;
    expect(surfaceRow(useGame.getState, h.id, deja).result).toEqual(deja.result);
    expect(surfaceRow(useGame.getState, undefined, deja).result).toEqual(deja.result);
  });
});

describe('#1262 — bandStep : la bande pose SA possession', () => {
  it('plus d’UN porteur → `groupOwner` posé par le constructeur (l’appelant ne le décide plus)', () => {
    const b = bandStep({ id: 'manche-1', kind: 'pursuitMove', label: fixtureText('Manche 1')}, [rang('H1'), rang('H2')]);
    expect(b!.groupOwner).toBe(true);
    expect(b!.aggregate).toBe('none');
    expect(b!.participants).toHaveLength(2);
  });

  it('un SEUL porteur → pas de `groupOwner`, mais l’étape NOMME son porteur (jamais une étape sans owner)', () => {
    const b = bandStep({ id: 'b', kind: cleDeFixture('k'), label: fixtureText('L')}, [rang('H1')])!;
    expect(b.groupOwner).toBeUndefined();
    expect(b.actorId, 'la bande mono NOMME son porteur — c’est ce qui donne à l’arbitre un owner à router (sans `actorId` : fenêtre hôte seul)').toBe('H1');
  });

  it('zéro rangée → aucune fenêtre à ouvrir', () => {
    expect(bandStep({ id: 'b', kind: cleDeFixture('k'), label: fixtureText('L')}, [])).toBeUndefined();
  });

  it('`options` n’est PAS un champ que la bande peut porter (invariant #1262 tenu à la construction)', () => {
    const b = bandStep({ id: 'b', kind: cleDeFixture('k'), label: fixtureText('L')}, [rang('H1'), rang('H2')])!;
    expect(b.options).toBeUndefined();
  });
});

describe('#1262 — bandStepId : dédoublement d’id (deux jets de MÊME clé pour le MÊME porteur)', () => {
  it('clé libre → rendue telle quelle ; clé déjà prise PAR CE porteur → `#2`, `#3`…', () => {
    const bandes = new Map<string, { rows: BatchParticipant[] }>();
    expect(bandStepId(bandes, 'k', 'H1')).toBe('k');
    bandes.set('k', { rows: [rang('H1')] });
    expect(bandStepId(bandes, 'k', 'H1')).toBe('k#2');
    bandes.set('k#2', { rows: [rang('H1')] });
    expect(bandStepId(bandes, 'k', 'H1')).toBe('k#3');
  });

  it('clé prise par un AUTRE porteur → même clé (les deux rangées cohabitent dans la bande)', () => {
    const bandes = new Map<string, { rows: BatchParticipant[] }>([['k', { rows: [rang('H1')] }]]);
    expect(bandStepId(bandes, 'k', 'H2')).toBe('k');
  });
});

describe('#1262 — une bande est TOUJOURS visible chez le siège de son porteur', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, party: [], pendingCascade: null, suspendedCascades: [] } as never);
  });

  /** HÔTE au siège 0 ; l'unique porteur `H1` appartient au siège 1 (invité). */
  function ouvreBandeChezLHote(rows: BatchParticipant[]): void {
    useGame.setState({ party: [hero('H1'), hero('H2')] } as never);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { H1: 1, H2: 1 } } } as never);
    const b = bandStep({ id: 'bande', kind: cleDeFixture('nightTest'), label: fixtureText('Bande')}, rows)!;
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [b] });
  }

  it('bande MONO : l’étape désigne son porteur — la fenêtre va au siège qui le possède, pas à l’hôte', () => {
    ouvreBandeChezLHote([rang('H1')]);
    expect(modalOwnerOf(useGame.getState()), 'owner = le porteur : la fenêtre part au siège qui le tient, jamais à l’hôte').toBe('H1');
    expect(ownsLocal(useGame.getState(), 'H1'), 'chez l’hôte, la fenêtre n’est pas à lui').toBe(false);
    expect(seatOwns(useGame.getState(), 1, 'H1'), 'elle est au siège 1, qui possède le porteur').toBe(true);
  });

  it('bande MULTI : owner de GROUPE (chaque siège voit la fenêtre où se tient SA rangée)', () => {
    ouvreBandeChezLHote([rang('H1'), rang('H2')]);
    expect(modalOwnerOf(useGame.getState())).toBe('*');
  });
});
