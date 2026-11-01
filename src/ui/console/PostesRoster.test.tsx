// @vitest-environment jsdom
/**
 * CONTRAT du roster PAR POSTE (maquette A validée par l'utilisateur le 2026-09-04).
 *
 * Ce que la surface DOIT tenir, quel que soit le roster qui la compose :
 *  (1) une LIGNE par poste, dans l'ordre du catalogue, TOUTES présentes même vides — rien ne glisse ;
 *  (2) les personnes sont des portraits DANS la case de leur poste ;
 *  (3) un BANC ferme le roster : qui n'est épinglé nulle part y est VISIBLE (jamais escamoté) ;
 *  (4) une case vide ne porte AUCUN MOT — l'affordance et le nom accessible, rien d'autre ;
 *  (5) un poste FERMÉ reste offert, éteint, et DIT pourquoi (atteignable, jamais `disabled` muet) ;
 *  (6) RIEN n'est déduit à l'écran : seul l'épinglage s'affiche (arbitrage user 2026-09-04) ;
 *  (7) retirer un portrait DÉSÉPINGLE — le porteur descend au banc, il ne saute pas sur une ligne devinée.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach } from 'vitest';
import { PostesRoster, nextPinned } from './PostesRoster';
import type { Poste } from '../../noyau/poste';
import type { Combatant } from '../../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../../engine/combattantDeTest.testkit';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); container?.remove(); root = null; container = null; });

const hero = (id: string, label: string): Combatant => (blessuresSurLeProfil({
  id, label, kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4,
}) as Combatant);

const POSTES: Poste[] = [
  { id: 'plein-air', label: 'Plein air', skills: [] },
  { id: 'approvisionnement', label: 'Approvisionnement', skills: [] },
  { id: 'monter-camp', label: 'Monter le camp', skills: [] },
];

const HEROES = [hero('h1', 'Hilda'), hero('h2', 'Gunnar')];
const BANC = 'Au choix de l’Étape';
const TITRE = 'Rôles de marche';

function monter(props: Partial<Parameters<typeof PostesRoster>[0]> = {}): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <PostesRoster
        title={TITRE}
        banc={BANC}
        heroes={HEROES}
        postes={POSTES}
        pinnedOf={() => undefined}
        onSet={() => {}}
        codexCategory="activities"
        {...props}
      />,
    );
  });
  return container;
}

const lignes = (el: HTMLElement) => [...el.querySelectorAll('.pr-ligne')] as HTMLElement[];
const ligneDe = (el: HTMLElement, poste: string) => el.querySelector(`.pr-ligne[data-poste="${poste}"]`) as HTMLElement;
const banc = (el: HTMLElement) => el.querySelector('.pr-banc .pr-ligne') as HTMLElement;

describe('PostesRoster — une ligne par POSTE (maquette A)', () => {
  it('1. autant de lignes que le catalogue (+ le banc), dans SON ordre, toutes présentes même vides', () => {
    const el = monter();
    expect(lignes(el).map((l) => l.dataset.poste)).toEqual(['plein-air', 'approvisionnement', 'monter-camp', '__banc']);
    // Aucun héros n'est épinglé : les 3 lignes de poste sont VIDES et pourtant rendues.
    for (const p of POSTES) expect(ligneDe(el, p.id).querySelectorAll('.ptile'), p.id).toHaveLength(0);
  });

  it('2. le portrait est DANS la case de son poste, et nommé pour le retrait', () => {
    const el = monter({ pinnedOf: (h) => (h.id === 'h1' ? 'plein-air' : undefined) });
    const tuiles = ligneDe(el, 'plein-air').querySelectorAll('.ptile');
    expect(tuiles).toHaveLength(1);
    expect(tuiles[0].getAttribute('aria-label')).toBe('Retirer Hilda de Plein air');
  });

  it('3. BANC : qui n’est épinglé nulle part y est VISIBLE, sous son libellé', () => {
    const el = monter({ pinnedOf: (h) => (h.id === 'h1' ? 'plein-air' : undefined) });
    expect(banc(el).textContent).toContain(BANC);
    expect(banc(el).querySelectorAll('.ptile'), 'Gunnar n’est sur aucune ligne : il est au banc, pas escamoté').toHaveLength(1);
  });

  it('3ter. le banc ne promet AUCUN geste : portraits décoratifs, pas de [+], rien à « retirer »', () => {
    const poses: [string, string | null][] = [];
    const el = monter({ pinnedOf: () => undefined, onSet: (id, p) => poses.push([id, p]) });
    const tuiles = [...banc(el).querySelectorAll('.ptile')] as HTMLElement[];
    expect(tuiles).toHaveLength(2);
    for (const t of tuiles) {
      // Ces personnes ne tiennent AUCUN poste : « retirer » ne retirerait rien. Une affordance qui
      // ne change rien est morte — le portrait est un CONSTAT, pas un contrôle.
      expect(t.tagName, 'décor, pas contrôle').toBe('SPAN');
      expect(t.getAttribute('aria-label'), 'aucun nom ne promet un geste').toBeNull();
    }
    expect(banc(el).querySelector('.pr-add'), 'le banc n’offre aucun ajout').toBeNull();
    expect(banc(el).querySelector('button'), 'aucun bouton du tout sur la ligne de banc').toBeNull();
    expect(poses, 'rien n’a pu être déclenché').toEqual([]);
  });

  it('3bis. le banc reste une LIGNE quand il est vide — sans un mot de plus', () => {
    const el = monter({ heroes: [hero('h1', 'Hilda')], pinnedOf: () => 'plein-air' });
    expect(banc(el), 'la ligne existe toujours (rien ne glisse)').toBeTruthy();
    expect(banc(el).querySelectorAll('.ptile')).toHaveLength(0);
    expect(banc(el).textContent?.trim()).toBe(BANC);
  });

  it('4. case VIDE = aucun mot (arbitrage user 2026-08-24), affordance + nom accessible', () => {
    const el = monter();
    const ajout = ligneDe(el, 'plein-air').querySelector('.pr-add') as HTMLButtonElement;
    expect(ajout.textContent?.trim(), 'ni « Libre », ni « choisir », ni un tiret').toBe('');
    expect(ajout.querySelector('svg'), 'l’affordance d’ajout reste visible').toBeTruthy();
    expect(ajout.getAttribute('aria-label')).toBe(`${TITRE} — Plein air : affecter`);
    expect(el.textContent).not.toMatch(/libre|choisir|aucun/i);
  });

  it('5. poste FERMÉ : offert, ÉTEINT, atteignable, et il dit pourquoi — aucun [+] actif', () => {
    const el = monter({ refusOf: (p) => (p.id === 'monter-camp' ? 'Le sol est détrempé.' : undefined) });
    const l = ligneDe(el, 'monter-camp');
    expect(l, 'jamais un filtrage silencieux : la ligne reste là').toBeTruthy();
    expect(l.querySelector('.pr-add'), 'pas de [+] ACTIF sur un poste fermé').toBeNull();
    const gate = l.querySelector('button[aria-disabled="true"]') as HTMLButtonElement;
    // L'affordance ne DISPARAÎT pas : c'est le MÊME glyphe d'ajout, simplement éteint — sinon la
    // ligne fermée aurait l'air d'une ligne sans ajout possible, et non d'un ajout REFUSÉ.
    const actif = (ligneDe(el, 'plein-air').querySelector('.pr-add') as HTMLElement).innerHTML;
    expect(gate.innerHTML, 'à l’octet : le refus rend le même [+], éteint').toBe(actif);
    expect(gate, 'éteint par aria-disabled, jamais par disabled (il reste atteignable)').toBeTruthy();
    expect(gate.hasAttribute('disabled')).toBe(false);
    const raison = el.querySelector(`#${gate.getAttribute('aria-describedby')}`);
    expect(raison?.textContent).toContain('Le sol est détrempé.');
    expect(ligneDe(el, 'plein-air').querySelector('.pr-add'), 'les autres lignes gardent leur [+]').toBeTruthy();
  });

  it('6. RIEN n’est déduit : un poste non épinglé n’affiche PERSONNE, et aucun marqueur « auto »', () => {
    const el = monter({ pinnedOf: () => undefined });
    for (const p of POSTES) expect(ligneDe(el, p.id).querySelectorAll('.ptile'), p.id).toHaveLength(0);
    expect(el.textContent).not.toContain('auto');
    expect(el.querySelector('[data-auto]'), 'le marqueur d’inférence n’existe plus nulle part').toBeNull();
    expect(banc(el).querySelectorAll('.ptile'), 'les deux héros sont au banc').toHaveLength(2);
  });

  it('7. retirer un portrait DÉSÉPINGLE (null) — il descend au banc, il ne saute pas', () => {
    const poses: [string, string | null][] = [];
    const el = monter({ pinnedOf: (h) => (h.id === 'h1' ? 'plein-air' : undefined), onSet: (id, p) => poses.push([id, p]) });
    act(() => { (ligneDe(el, 'plein-air').querySelector('.ptile') as HTMLButtonElement).click(); });
    expect(poses).toEqual([['h1', null]]);
  });

  it('8. le [+] ouvre un PANNEAU-PARAMÈTRE borné, ancré, aux candidats de CE poste', () => {
    const el = monter({ pinnedOf: (h) => (h.id === 'h1' ? 'plein-air' : undefined) });
    act(() => { (ligneDe(el, 'plein-air').querySelector('.pr-add') as HTMLButtonElement).click(); });
    const panneau = document.querySelector('[data-panneau-parametre]') as HTMLElement;
    expect(panneau, 'un seul mécanisme de choix borné : PanneauParametre').toBeTruthy();
    expect(panneau.getAttribute('aria-label')).toBe(`${TITRE} — Plein air : affecter`);
    // Hilda tient DÉJÀ ce poste : elle n'est pas candidate à s'y remettre.
    expect(panneau.textContent).toContain('Gunnar');
    expect(panneau.textContent).not.toContain('Hilda');
  });

  it('8bis. le panneau dit le poste ACTUEL d’un candidat — le déplacement est visible avant le clic', () => {
    const el = monter({ pinnedOf: (h) => (h.id === 'h1' ? 'approvisionnement' : undefined) });
    act(() => { (ligneDe(el, 'plein-air').querySelector('.pr-add') as HTMLButtonElement).click(); });
    const panneau = document.querySelector('[data-panneau-parametre]') as HTMLElement;
    expect(panneau.textContent).toContain('(Approvisionnement)');
  });

  it('9. choisir dans le panneau ÉPINGLE le héros sur CE poste', () => {
    const poses: [string, string | null][] = [];
    const el = monter({ onSet: (id, p) => poses.push([id, p]) });
    act(() => { (ligneDe(el, 'monter-camp').querySelector('.pr-add') as HTMLButtonElement).click(); });
    const btn = [...document.querySelectorAll('[data-panneau-parametre] button')].find((b) => b.textContent?.includes('Gunnar')) as HTMLButtonElement;
    act(() => { btn.click(); });
    expect(poses).toEqual([['h2', 'monter-camp']]);
  });

  it('10. aucun héros → rien du tout', () => {
    expect(monter({ heroes: [] }).innerHTML).toBe('');
  });
});

describe('nextPinned — décision d’épinglage au clic (logique du handler, sans DOM)', () => {
  it('aucun poste épinglé → clic épingle le poste choisi', () => {
    expect(nextPinned(undefined, 'plein-air')).toBe('plein-air');
  });
  it('un autre poste épinglé → clic change pour le poste choisi', () => {
    expect(nextPinned('approvisionnement', 'plein-air')).toBe('plein-air');
  });
  it('re-clic sur le poste DÉJÀ épinglé → détache (null)', () => {
    expect(nextPinned('plein-air', 'plein-air')).toBeNull();
  });
});
