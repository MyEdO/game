// @vitest-environment jsdom
/**
 * ÉTAPE DE RÉVÉLATION MONTÉE (#942 L8) — la fenêtre de cascade (`CascadeBody`, patron `createRoot`/
 * `act` du repo) sur une étape d'affichage à charge riche :
 *  - le CONCERNÉ (`RevealEntry.subjectId`) porte son portrait dans la fenêtre — contrat de
 *    `RevealEntry.subjectId` (state/pendings.ts) : « on sait toujours à qui ça s'applique » ;
 *  - la BARRE DE TEMPS de l'auto-fermeture est réservée au GRAVE (arbitrage 2026-06-11) : le mineur
 *    s'auto-ferme aussi, mais sans cérémonie.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { CascadeBody } from './CascadeModal';
import type { RevealEntry } from '../state/pendings';
import { cascadeDeTest } from '../state/cascadeTestKit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

const HERO = () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 1 });

/** Ouvre une séquence d'affichage à UNE étape portant l'entrée bâtie par `make` (forme exacte de
 *  `revealToStep` : `actorId` = le sujet ; `autoCloseMs` n'existe que si le site l'a DÉCLARÉ — la
 *  fermeture d'une révélation est explicite par défaut, #1270). */
function openReveal(make: (heroId: string) => RevealEntry, autoCloseMs?: number) {
  const hero = HERO();
  const entry = make(hero.id);
  useGame.setState({
    battle: null, party: [hero], suspendedCascades: [], journal: [],
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    pendingCascade: cascadeDeTest(
      [{ id: 'cons-0', kind: entry.kind, actorId: entry.subjectId, label: fixtureText(entry.title), reveal: entry, autoCloseMs }],
      { title: entry.title, icon: 'nav/mutation', purpose: 'affichage' },
    ),
  });
  return hero;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, party: [], suspendedCascades: [] });
});

const render = () => act(() => { root.render(<CascadeBody />); });

describe('étape de révélation — le sujet et la barre de temps', () => {
  it('une révélation à `subjectId` MONTRE le concerné (portrait du sujet dans la fenêtre)', () => {
    openReveal((id) => ({ kind: 'mutation', title: 'Mutation — Écailles', dice: 42, lines: ['Des écailles poussent.'], subjectId: id, severity: 'grave' }));
    render();
    const subject = host.querySelector('.modal-subject');
    expect(subject).not.toBeNull();
    expect(subject!.querySelector('[aria-label="Gunnar"]')).not.toBeNull(); // le portrait est CELUI du sujet
  });

  it('sans `subjectId` (entretien de Round) : aucun bandeau de sujet (rien à attribuer)', () => {
    openReveal(() => ({ kind: 'round', title: 'Fin du Round', lines: ['Hémorragique : 1 Blessure.'], severity: 'minor' }));
    render();
    expect(host.querySelector('.modal-subject')).toBeNull();
  });

  it('barre de temps : rendue sur le GRAVE, absente sur le MINEUR (qui s’auto-ferme sans cérémonie)', () => {
    openReveal((id) => ({ kind: 'mutation', title: 'Mutation — Écailles', lines: ['x'], subjectId: id, severity: 'grave' }), 9000);
    render();
    expect(host.querySelector('.reveal-timer')).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(host);
    openReveal(() => ({ kind: 'round', title: 'Entretien quotidien', lines: ['x'], severity: 'minor' }), 3500);
    render();
    expect(host.querySelector('.reveal-timer')).toBeNull();
  });
});
