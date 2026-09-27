// @vitest-environment jsdom
/**
 * #1657 B3-2b-b — l'écran qui rend les STATIONS jouables, en forme PAR POSTE (maquette A, 2026-09-04).
 * Le moteur savait déjà QUI se trouve où (`crewTarget.stations`, B3-2b-a) ; ce contrat verrouille ce
 * que l'écran doit tenir :
 *  (1) les 5 stations du catalogue sont des LIGNES, aucune n'est filtrée en silence ;
 *  (2) une station que la coque n'a pas (`requiresTrait` — `MSRC 07 l.94`, `MDG 12 l.303`) reste
 *      VISIBLE, éteinte, et dit POURQUOI (raison atteignable, jamais un bouton muet) ;
 *  (3) le clic ÉPINGLE (party ET bataille), re-cliquer le portrait DÉSÉPINGLE ;
 *  (4) sans épinglage, personne n'est sur une ligne : tout le monde est au BANC.
 * Rendu jsdom (`createRoot`) : le panneau lit le store, et l'ouverture du panneau-paramètre est un
 * état React.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach } from 'vitest';
import { useGame, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import { navalTraitsDe } from '../engine/navalTraits';
import { shipStations } from '../data';
import type { Combatant } from '../engine/types';
import { ShipStationsPanel } from './ShipStationsPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); container?.remove(); root = null; container = null; });

/** Deux héros au groupe. */
function poserGroupe(): Combatant[] {
  const gunnar = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 7 }), id: 'gunnar' };
  const lise = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Lise', seed: 8 }), id: 'lise' };
  // L'équipage vit AUSSI dans la bataille en mer (`setShipStation` patche les deux) : la fixture
  // porte donc une file de combat, sans quoi le contrat ne mesurerait que la moitié de l'action.
  const battle = { combatants: [gunnar, lise], log: [], round: 1, turn: 0 } as unknown as BattleState;
  useGame.setState({ party: [gunnar, lise], battle, massBattle: null, interlude: null, journal: [] });
  return [gunnar, lise];
}

/** Monte le panneau sur la coque d'un véhicule RÉEL (ses Traits navals décident des stations ouvertes). */
function monter(vehicleId: string): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root!.render(<ShipStationsPanel traits={navalTraitsDe(vehicleId, undefined)} />); });
  return container;
}

const ligneDe = (el: HTMLElement, id: string) => el.querySelector(`.pr-ligne[data-poste="${id}"]`) as HTMLElement;
const banc = (el: HTMLElement) => el.querySelector('.pr-banc .pr-ligne') as HTMLElement;
const ajout = (el: HTMLElement, id: string) => ligneDe(el, id)?.querySelector('.pr-add') as HTMLButtonElement | null;

/** Ouvre le panneau-paramètre de la ligne `id` et rend le bouton du candidat nommé. À appeler HORS
 *  d'un `act` englobant : un `act` imbriqué ne vide pas la file, et le panneau ne serait pas rendu. */
function candidat(el: HTMLElement, id: string, nom: string): HTMLButtonElement {
  act(() => { ajout(el, id)!.click(); });
  return [...document.querySelectorAll('[data-panneau-parametre] button')].find((b) => b.textContent?.includes(nom)) as HTMLButtonElement;
}

describe('ShipStationsPanel — le joueur ÉPINGLE une station (#1657 B3-2b-b)', () => {
  it('1. les 5 stations du catalogue sont des LIGNES, dans l’ordre, plus le banc', () => {
    poserGroupe();
    const el = monter('barge-fluviale');
    expect(el.textContent).toContain('Stations à bord');
    const ids = [...el.querySelectorAll('.pr-ligne')].map((l) => (l as HTMLElement).dataset.poste);
    expect(ids).toEqual([...shipStations.map((s) => s.id), '__banc']);
    expect(shipStations.length, 'le catalogue fermé nommé par les livres').toBe(5);
    for (const s of shipStations) expect(ligneDe(el, s.id).textContent, s.id).toContain(s.label);
  });

  it('2. aucune station par DÉFAUT : toutes les lignes sont vides et les héros sont au BANC', () => {
    poserGroupe();
    const el = monter('barge-fluviale');
    for (const s of shipStations) expect(ligneDe(el, s.id).querySelectorAll('.ptile'), s.id).toHaveLength(0);
    expect(banc(el).querySelectorAll('.ptile'), 'les deux héros y sont VISIBLES, pas escamotés').toHaveLength(2);
    expect(banc(el).textContent).toContain('Sans station');
    // Une case vide ne porte AUCUN mot — l'affordance et le nom accessible, rien d'autre.
    const add = ajout(el, 'pont')!;
    expect(add.textContent?.trim()).toBe('');
    expect(add.getAttribute('aria-label')).toBe('Stations à bord — Pont : affecter');
    expect(el.textContent).not.toContain('auto');
  });

  it('3. le clic ÉPINGLE la station (party ET bataille — `setShipStation`), le portrait la DÉSÉPINGLE', () => {
    const [gunnar] = poserGroupe();
    const el = monter('barge-fluviale');
    const dans = (ou: 'party' | 'bataille') => (ou === 'party'
      ? useGame.getState().party
      : useGame.getState().battle!.combatants).find((h) => h.id === gunnar.id)!.shipStation;
    const gunnarAvirons = candidat(el, 'avirons', 'Gunnar');
    act(() => { gunnarAvirons.click(); });
    expect(dans('party')).toBe('avirons');
    expect(dans('bataille'), 'l’équipage vit dans la file de combat en mer').toBe('avirons');
    // Le portrait est DANS la case de la station ; le cliquer déséping le (retour au banc).
    const portrait = ligneDe(el, 'avirons').querySelector('.ptile') as HTMLButtonElement;
    expect(portrait.getAttribute('aria-label')).toBe('Retirer Gunnar de Avirons');
    act(() => { portrait.click(); });
    expect(dans('party')).toBeUndefined();
    expect(dans('bataille')).toBeUndefined();
  });

  it('4. « Cale » sur une BARQUE (bateau ouvert, MSRC 07 l.70) : offerte, éteinte, et elle DIT pourquoi', () => {
    poserGroupe();
    const el = monter('barque-fluviale');
    const l = ligneDe(el, 'cale');
    expect(l, 'la station fermée reste VISIBLE — jamais masquée en silence').toBeTruthy();
    expect(ajout(el, 'cale'), 'aucun [+] actif sur une station que la coque n’a pas').toBeNull();
    const gate = l.querySelector('button[aria-disabled="true"]') as HTMLButtonElement;
    expect(gate, 'atteignable au clavier/à la manette, mais inerte').toBeTruthy();
    expect(gate.hasAttribute('disabled'), 'jamais `disabled` : il doit rester atteignable').toBe(false);
    const raison = el.querySelector(`#${gate.getAttribute('aria-describedby')}`);
    expect(raison?.textContent, 'la raison NOMME le Trait naval manquant (MSRC 07 l.94)').toContain('Cale');
    act(() => { gate.click(); });
    expect(useGame.getState().party.every((h) => h.shipStation === undefined)).toBe(true);
  });

  it('5. « Cale » sur la BARGE commerciale (MSRC 10 l.90) : ouverte, épinglable', () => {
    poserGroupe();
    const el = monter('barge-fluviale');
    expect(ligneDe(el, 'cale').querySelector('button[aria-disabled="true"]'), 'la barge porte le Trait « cale »').toBeNull();
    const gunnarCale = candidat(el, 'cale', 'Gunnar');
    act(() => { gunnarCale.click(); });
    expect(useGame.getState().party[0].shipStation).toBe('cale');
  });

  it('6. « Nid-de-pie » : amélioration payante (MDG 12 l.299) — fermée sur une coque qui ne la porte pas', () => {
    poserGroupe();
    const el = monter('cogue');
    expect(ligneDe(el, 'nid-de-pie').querySelector('button[aria-disabled="true"]')).toBeTruthy();
    expect(ligneDe(el, 'pont').querySelector('button[aria-disabled="true"]'), 'toute coque a un pont').toBeNull();
  });
});
