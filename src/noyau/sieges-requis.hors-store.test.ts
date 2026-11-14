/**
 * QUORUM DES READY-CHECKS (#1411 P2-A) — « sièges requis » est UNE fonction (`siegesRequis`), lue par
 * les TROIS dispatchers qui attendent l'unanimité (pause de Round, écran de Victoire, nuit de repos)
 * ET par la rangée qui la montre (`ReadyRow`). Le contrat est POSITIF : un siège nommé qui ne tient
 * aucun héros encore en jeu n'est PAS requis — l'attendre bloquait la table, l'afficher mentait.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { siegesRequis, quorumAtteint, withActingSeat } from './netOwnership';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { emptyScene } from './monde/scene';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

function hero(id: string, label: string): Combatant {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: 11 });
  h.id = id;
  h.pos = { x: 3, y: 3 };
  return h;
}

/** Deux sièges NOMMÉS ; le 2ᵉ tient `h2`, dont l'état varie par cas. */
function table(over: Partial<Combatant> = {}) {
  const h1 = hero('h1', 'Gunnar');
  const h2 = { ...hero('h2', 'Rolf'), ...over } as Combatant;
  banc.setState({
    party: [h1, h2],
    scene: emptyScene('scene-test'),
    net: { ...banc.getState().net, mode: 'hote', mySeat: 0, ownership: { h1: 0, h2: 1 }, seatNames: { 0: 'L’hôte', 1: 'Rolf' } },
    battle: {
      combatants: [h1, h2], order: ['h1', 'h2'], baseOrder: ['h1', 'h2'], turn: -1, round: 2,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null,
    } as unknown as BattleState,
  });
  return { h1, h2 };
}

describe('siegesRequis — le quorum d’un ready-check', () => {
  it('TÉMOIN : un siège nommé qui tient un héros EN JEU est requis', () => {
    table();
    expect(siegesRequis(banc.getState())).toEqual([0, 1]);
  });

  it('un siège dont le seul héros est MORT n’est pas requis', () => {
    table({ dead: true });
    expect(siegesRequis(banc.getState())).toEqual([0]);
  });

  it('un siège dont le seul héros est HORS RENCONTRE n’est pas requis', () => {
    table({ outOfRencontre: true });
    expect(siegesRequis(banc.getState())).toEqual([0]);
  });

  it('l’hôte (siège 0) est TOUJOURS requis, même sans aucun héros vivant', () => {
    const { h2 } = table({ dead: false });
    banc.setState({ party: [{ ...h2 }] , net: { ...banc.getState().net, ownership: { h2: 1 } } });
    expect(siegesRequis(banc.getState())).toEqual([0, 1]);
    banc.setState({ party: [] });
    expect(siegesRequis(banc.getState())).toEqual([0]);
  });

  it('quorumAtteint lit le MÊME quorum (un siège non requis ne retient rien)', () => {
    table({ dead: true });
    expect(quorumAtteint(banc.getState(), { 0: true })).toBe(true);
    table();
    expect(quorumAtteint(banc.getState(), { 0: true })).toBe(false);
    expect(quorumAtteint(banc.getState(), { 0: true, 1: true })).toBe(true);
  });
});

describe('les dispatchers de ready-check CONSOMMENT le quorum (aucune recopie)', () => {
  it('pause de Round : l’hôte seul requis (héros distant mort) → le Round part au 1ᵉʳ ✓', () => {
    table({ dead: true });
    banc.setState({ pendingRoundStart: { round: 2 } });
    banc.getState().fenetreValider('debutDuRound');
    expect(banc.getState().pendingRoundStart, 'l’hôte attendait un siège qui n’a plus personne à jouer').toBeNull();
  });

  it('pause de Round : les DEUX sièges requis (héros distant vivant) → il faut les deux ✓', () => {
    table();
    banc.setState({ pendingRoundStart: { round: 2 } });
    banc.getState().fenetreValider('debutDuRound');
    expect(banc.getState().pendingRoundStart, 'le Round est parti sans le siège du héros vivant').not.toBeNull();
    withActingSeat(1, () => banc.getState().fenetreValider('debutDuRound'));
    expect(banc.getState().pendingRoundStart).toBeNull();
  });

  it('victoire : même quorum (le siège sans héros vivant ne retient pas l’écran)', () => {
    table({ dead: true });
    banc.setState({ pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: [], defeated: [] } as never });
    banc.getState().fenetreFermer('victoire');
    expect(banc.getState().pendingVictory, 'l’écran de victoire attendait un siège non requis').toBeNull();
  });

  it('STRUCTUREL — plus AUCUN site ne recopie la formule du quorum', () => {
    const recopie = /seatNames\[[^\]]+\]\s*!=\s*null/g;
    for (const f of ['../noyau/combatSlice.ts', '../noyau/issueDeCombat.ts', '../noyau/restFlow.ts']) {
      expect(src(f).match(recopie) ?? [], `${f} recopie le quorum au lieu d’appeler siegesRequis`).toEqual([]);
    }
    // … et la source unique, elle, la porte bien (méta : sans ce témoin, la garde serait verte à vide).
    expect(src('../noyau/netOwnership.ts').match(recopie)?.length).toBe(1);
  });
});
