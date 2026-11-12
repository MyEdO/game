// @vitest-environment jsdom
/**
 * ÉTAPE DE RÉVÉLATION MONTÉE (#942 L8) — la fenêtre de cascade (`CascadeBody`, patron `createRoot`/
 * `act` du repo) sur une étape d'affichage à charge riche :
 *  le CONCERNÉ (`RevealEntry.subjectId`) porte son portrait dans la fenêtre — contrat de
 *  `RevealEntry.subjectId` (noyau/pendings.ts) : « on sait toujours à qui ça s'applique ».
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { CascadeBody } from './CascadeModal';
import type { RevealEntry } from '../noyau/pendings';
import { cascadeDeTest } from '../noyau/cascade.testkit';
import { cleDeFixture } from '../noyau/noyau.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

const HERO = () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 1 });

/** Ouvre une séquence d'affichage à UNE étape portant l'entrée bâtie par `make` (forme exacte de
 *  `revealToStep` : `actorId` = le sujet). */
function openReveal(make: (heroId: string) => RevealEntry) {
  const hero = HERO();
  const entry = make(hero.id);
  useGame.setState({
    battle: null, party: [hero], suspendedCascades: [], journal: [],
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    pendingCascade: cascadeDeTest(
      [{ id: 'cons-0', kind: entry.kind, actorId: entry.subjectId, label: fixtureText(entry.title), reveal: entry }],
      { title: entry.title, icon: 'navigation/mutation', purpose: 'affichage' },
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

describe('étape de révélation — le sujet', () => {
  it('l’introduction rend le Markdown complet sans paragraphes imbriqués', () => {
    openReveal(() => ({ kind: 'entreeEnScene', title: 'Entrée', lines: ['**Le groupe** entre.\n\n- Une porte'] }));
    render();
    expect(host.querySelector('.modal-log strong')?.textContent).toBe('Le groupe');
    expect(host.querySelector('.modal-log li')?.textContent).toBe('Une porte');
    expect(host.textContent).not.toContain('**Le groupe**');
    expect(host.querySelector('p .prose, p p, p ul')).toBeNull();
  });
  it('le choix rend son invite Markdown dans le corps et ses aperçus en texte', () => {
    openReveal(() => ({ kind: 'entreeEnScene', title: 'Entrée', lines: [] }));
    useGame.setState({ pendingCascade: cascadeDeTest([{ id: 'choix', kind: cleDeFixture('choix'), label: fixtureText('**Entrer** par [la porte](https://example.com) ?'),
      options: [{ key: 'oui', label: fixtureText('**Oui**'), detail: '*Entrer*' }, { key: 'non', label: fixtureText('Non') }] }], { title: 'Choix', purpose: 'affichage' }) });
    render();
    expect(host.querySelector('strong')?.textContent).toBe('Entrer');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(host.querySelector('h3')?.textContent).not.toContain('**');
    expect(host.querySelector('button strong, h3 strong, p p')).toBeNull();
    expect([...host.querySelectorAll('button')].some(b => b.textContent?.trim() === 'Oui')).toBe(true);
    expect(host.textContent).not.toContain('**Oui**');
  });
  it('une révélation à `subjectId` MONTRE le concerné (portrait du sujet dans la fenêtre)', () => {
    openReveal((id) => ({ kind: 'mutation', title: 'Mutation — Écailles', dice: 42, lines: ['Des écailles poussent.'], subjectId: id }));
    render();
    const subject = host.querySelector('.modal-subject');
    expect(subject).not.toBeNull();
    expect(subject!.querySelector('[aria-label="Gunnar"]')).not.toBeNull(); // le portrait est CELUI du sujet
  });

  it('sans `subjectId` (entretien de Round) : aucun bandeau de sujet (rien à attribuer)', () => {
    openReveal(() => ({ kind: 'round', title: 'Fin du Round', lines: ['Hémorragique : 1 Blessure.'] }));
    render();
    expect(host.querySelector('.modal-subject')).toBeNull();
  });
});
