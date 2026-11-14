// @vitest-environment jsdom
/**
 * #3059 L3, #3612 — un acte de l'infirmerie (`MedicModal`) est grisé EXACTEMENT quand le réglage `soins.mode` du
 * brouillon le refuserait (`refusDuModeDuSoin`), ou, sans brouillon, l'infirmerie (`refusDeLActeALInfirmerie`,
 * `noyau/acteDeSoin.ts`), avec la même raison. Montage réel, clic réel sur le bouton de l'acte.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { MedicModal } from './MedicModal';
import type { Combatant } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function hero(p: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Doc', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12, 12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

const VIDE = { mode: 'exploration', battle: null, party: [], pendingHeal: null, pendingSurgery: null, medic: null, journal: [] } as never;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useGame.setState(VIDE);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState(VIDE);
});

/** Le bouton d'acte nommé `nom`, son état fermé et la raison qu'il donne à lire. */
function acte(nom: string) {
  const bouton = [...document.body.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === nom);
  if (!bouton) throw new Error(`acte « ${nom} » absent`);
  const rid = bouton.getAttribute('aria-describedby');
  return { bouton, ferme: bouton.getAttribute('aria-disabled') === 'true', raison: rid ? document.getElementById(rid)?.textContent ?? null : null };
}

describe('MedicModal — acte grisé = acte que `soins.mode` refuse, même raison', () => {
  it('Hémorragie verrouillée par Chirurgie, chirurgien présent : « Opérer » offert, le clic règle l’acte, « Lancer » arme l’opération', () => {
    const doc = hero({ id: 'doc', talents: [{ talentId: 'chirurgie', times: 1 }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] });
    useGame.setState({ party: [doc, patient], medic: { patientId: 'p' } } as never);
    act(() => root.render(<MedicModal />));
    const operer = acte('Opérer');
    expect(operer.ferme).toBe(false);
    expect(operer.raison).toBeNull();
    act(() => operer.bouton.click());
    expect(useGame.getState().pendingHeal?.mode).toBe('chirurgie');
    expect(useGame.getState().medic?.surgery).toBeUndefined();
    act(() => useGame.getState().jetLancer('soins')); // le « Lancer » de la coquille joue ce verbe après son frisson (`useRollFrisson`)
    expect(useGame.getState().medic?.surgery?.kind).toBe('chirurgie');
  });

  it('PNJ à 5 co, bourse vide : « Soigner les Blessures » fermé, raison « Le groupe n’a pas assez d’argent pour cet acte. »', () => {
    const patient = hero({ id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(12, 4) });
    const npc = { id: 'barbier', label: 'Barbier', skill: { id: 'guerison', value: 50 }, intBonus: 3, acts: [{ act: 'blessures' as const, cost: { gold: 5 } }] };
    useGame.setState({ party: [patient], medic: { patientId: 'p', npc } } as never);
    act(() => root.render(<MedicModal />));
    const soigner = acte('Soigner les Blessures');
    expect(soigner.ferme).toBe(true);
    expect(soigner.raison).toBe('Le groupe n’a pas assez d’argent pour cet acte.');
  });
});
