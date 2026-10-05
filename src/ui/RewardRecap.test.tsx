// @vitest-environment jsdom
/**
 * RÉCAPITULATIF DE GAIN (#1920) — le CONTRAT, pas le balisage : une seule forme (aucun état de
 * ferrage), le geste de sortie est le `.btn-primary` de la barre `.cadre-pied` ENFANT DIRECT de la
 * boîte (la barre porte seule son espacement et son ferrage), les rangées sont des `Row`, et aucune
 * feuille ne vise l'interne d'une autre : ni un hôte ceux de la brique, ni la brique ceux de la modale.
 * Le focus d'entrée est le canonique de `Modal` (`focusTarget`) : un groupe de choix non tranché (le
 * `PortraitPicker` d'attribution est un `.rm-loc-grid`) passe avant le primaire de la barre.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RewardRecap } from './RewardRecap';
import { LootModal } from './LootModal';
import { Modal } from './Modal';
import { useGame } from '../state/store';
import { findTrappingById } from '../data';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { poserLayoutJsdom } from './layoutJsdom.testkit';
import { reglesCss } from '../../scripts/guards/lib/cssCouches.mjs';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import type { Combatant } from '../engine/types';

let retirerLayout: () => void;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  retirerLayout = poserLayoutJsdom();
});
afterAll(() => retirerLayout());
afterEach(() => {
  demonterRacines();
  useGame.setState({ pendingLoot: null, party: [] });
});

const STYLES = join(process.cwd(), 'src/ui/styles');
const lireFeuille = (f: string) => readFileSync(join(STYLES, f), 'utf8');
const classes = (sel: string) => (sel.match(/\.[a-zA-Z_-][\w-]*/g) ?? []).map((c) => c.slice(1));

function hero(id: string, label: string): Combatant {
  return {
    id, label, kind: 'hero', species: 'humains-reiklander',
    characteristics: {} as Combatant['characteristics'],
    items: [], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
}

function rendreDansModale() {
  const { container } = monterRacine(
    <Modal title="Coffre" footer={<button className="btn btn-primary">Continuer</button>}>
      <RewardRecap
        messages={['Le coffre cède.']}
        xp={40}
        gold={{ gold: 3, silver: 0, brass: 0 }}
        sections={[{ id: 'equipement', titre: 'Équipement', children: <button className="btn">Donner</button> }]}
      />
    </Modal>,
  );
  const boite = container.querySelector<HTMLElement>('[role="dialog"]');
  if (!boite) throw new Error('boîte de modale absente');
  return boite;
}

describe('RewardRecap — une forme, la barre de la modale, des rangées Row', () => {
  it('une SEULE forme : aucun état de ferrage rendu, aucun sélecteur d’état hors la rubrique à toucher', () => {
    const boite = rendreDansModale();
    expect(boite.querySelector('[data-ferrage]')).toBeNull();
    const etats = reglesCss(lireFeuille('reward-recap.css'))
      .flatMap((r) => r.selecteurs)
      .flatMap((s) => s.match(/\[data-[\w-]+/g) ?? []);
    expect(new Set(etats)).toEqual(new Set(['[data-avant']));
  });

  it('le geste de sortie est le primaire de la barre, ENFANT DIRECT de la boîte (hors de la pile du récapitulatif)', () => {
    const boite = rendreDansModale();
    const barre = boite.querySelector<HTMLElement>('.cadre-pied');
    expect(barre?.parentElement).toBe(boite);
    expect(barre?.querySelector('.btn-primary')?.textContent).toBe('Continuer');
    expect(barre?.closest('.stack')).toBeNull();
  });

  it('les récompenses sont des Row : la rangée ET chaque pastille', () => {
    const stats = [...rendreDansModale().querySelectorAll<HTMLElement>('.reward-stat')];
    expect(stats).toHaveLength(2);
    for (const s of stats) {
      expect(s.classList.contains('row')).toBe(true);
      expect(s.parentElement?.classList.contains('row')).toBe(true);
    }
  });

  it('la brique ne vise aucune classe qui ne soit pas la sienne (ni `.cadre-pied`, ni `.row`, ni `.stack`)', () => {
    const etrangeres = reglesCss(lireFeuille('reward-recap.css'))
      .flatMap((r) => r.selecteurs)
      .filter((s) => classes(s).some((c) => !c.startsWith('reward-')));
    expect(etrangeres).toEqual([]);
  });

  it('aucun hôte ne vise une classe de la brique', () => {
    const fautifs = listerDossier(STYLES)
      .filter((f) => f.endsWith('.css') && f !== 'reward-recap.css')
      .filter((f) => reglesCss(lireFeuille(f)).some((r) => r.selecteurs.some((s) => classes(s).some((c) => c.startsWith('reward-')))));
    expect(fautifs).toEqual([]);
  });
});

describe('Modal — le cadre que le récapitulatif habite', () => {
  it('titre, corps, pied : le récapitulatif est DANS le corps, le geste dans le pied', () => {
    const boite = rendreDansModale();
    const cadre = ['modal-title', 'modal-body', 'cadre-pied'];
    expect([...boite.children].map((e) => cadre.find((c) => e.classList.contains(c)))).toEqual(cadre);
    expect(boite.querySelector('.modal-body .reward-stat')).not.toBeNull();
    expect(boite.querySelector('.modal-body .cadre-pied')).toBeNull();
  });
});

describe('LootModal — focus d’entrée : le canonique de `Modal`, mesuré', () => {
  const heros = () => [hero('h1', 'Magnus'), hero('h2', 'Elsa')];
  const gear = (trappingId: string) => ({ label: findTrappingById(trappingId)!.label, magic: false, effect: { type: 'giveTrapping' as const, trappingId } });

  /** Une frappe d'Entrée telle que le document la reçoit. `Modal` laisse un BOUTON focalisé à son
   *  activation native (il ne l'empêche pas) : jsdom n'active pas un bouton sur `keydown`, le banc
   *  joue donc l'activation native lui-même, et seulement si la boîte ne l'a pas prise. Le sauvetage
   *  du focus (`useModalA11y`) passe par un `MutationObserver` : on rend la main une fois. */
  async function entree() {
    const cible = document.activeElement as HTMLElement;
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => { cible.dispatchEvent(ev); });
    if (!ev.defaultPrevented && cible instanceof HTMLButtonElement) act(() => cible.click());
    await act(async () => { await Promise.resolve(); });
  }

  it('AVEC équipement : focus au 1er portrait ; Entrée répétée attribue ligne à ligne au 1er héros, puis « Continuer » ferme (déclaré, réversible par `transferItem`)', async () => {
    useGame.setState({ party: heros(), pendingLoot: { title: 'Coffre', gear: [gear('huile-de-lampe'), gear('clef')] } });
    monterRacine(<LootModal />);
    const items = (i: number) => (useGame.getState().party[i].items ?? []).map((x) => x.label);
    const focus = () => document.activeElement as HTMLElement;

    expect(focus().closest('.gear-row .portrait-picker'), '#0 : portrait d’attribution').not.toBeNull();
    expect(focus().closest('.gear-row')?.textContent).toContain('Lampe à huile');

    await entree();
    expect(items(0)).toEqual(['Lampe à huile']);
    expect(useGame.getState().pendingLoot?.gear.map((g) => g.label)).toEqual(['Clef']);
    expect(focus().closest('.gear-row')?.textContent, '#1 : le focus passe à la ligne suivante').toContain('Clef');

    await entree();
    expect(items(0)).toEqual(['Lampe à huile', 'Clef']);
    expect(focus().textContent, '#2 : plus rien à attribuer, le primaire de la barre').toBe('Continuer');
    expect(focus().closest('.cadre-pied')).not.toBeNull();

    await entree();
    expect(useGame.getState().pendingLoot, '#3 : la fenêtre se ferme').toBeNull();
    expect(items(1)).toEqual([]);
  });

  it('SANS équipement : le focus va au primaire « Continuer » de la barre', () => {
    useGame.setState({ party: heros(), pendingLoot: { title: 'Bourse', gold: { gold: 1, silver: 0, brass: 0 }, gear: [] } });
    monterRacine(<LootModal />);
    const actif = document.activeElement as HTMLElement;
    expect(actif.textContent).toBe('Continuer');
    expect(actif.closest('.cadre-pied')).not.toBeNull();
  });
});
