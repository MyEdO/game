/**
 * L'ACTE DU SOIN EN DONNÉES (#3059, J5) : `fenetreDuSoin(s).mode` porte chaque acte avec sa raison de refus, et le
 * réglage `soins.mode` refuse un acte exactement là où la fenêtre le dit refusé, de la même raison
 * (`refusDuModeDuSoin`). Contrat sans écart à l'arbre de départ (le refus du réglage et le filtre du sélecteur
 * jugeaient déjà par `raisonDeModeDeSoinEnCombat` puis `refusDuTestDeSoin`) ; la fenêtre ne portait pas l'acte.
 * LDB 09 l.255-261 ; LDB 74 l.41 ; LDB 62 l.250 ; LDB 18 l.222.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { fenetreDuSoin } from './soin';
import { HEAL_MODES, type HealMode } from '../engine/healing';
import { itemFromTrappingById } from '../engine/items';
import { garanti } from '../lib/garanti';
import type { Combatant } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();

const bandages = () => ({ ...garanti(itemFromTrappingById('bandages', idsDeTest), 'bandages', 'Bandages'), uid: 'b1' });
function cb(p: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Doc', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12, 10), advantage: 0, conditions: [], movement: 4, engagedWith: [], items: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0, pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

function enCombat(soigneur: Combatant, patient: Combatant): void {
  const order = [soigneur.id, patient.id];
  banc.setState({
    mode: 'battle', party: [soigneur, patient],
    battle: {
      combatants: [soigneur, patient], order, baseOrder: order, turn: 0, round: 1,
      action: 'soins', selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false, log: [], over: null,
    } as never,
    pendingHeal: null,
  });
}

/** Pour chaque acte : la raison de la fenêtre, puis celle que le réglage `soins.mode` prononce (`refus`), l'état du soin
 *  restauré entre deux actes. */
function confronter(): { mode: HealMode; fenetre: string | null; reglage: string | null }[] {
  const ph0 = garanti(g().pendingHeal, 'soin', 'soin ouvert');
  return HEAL_MODES.map((mode) => {
    banc.setState({ pendingHeal: ph0, refus: null });
    const fenetre = garanti(fenetreDuSoin(g())?.mode.options.find((o) => o.valeur === mode), mode, 'acte de la fenêtre').refus ?? null;
    g().jetRegler('soins', 'mode', mode);
    const reglage = g().refus?.texte ?? null;
    if (reglage === null) expect(g().pendingHeal!.mode, `${mode} : le réglage accepté pose l’acte`).toBe(mode);
    else expect(g().pendingHeal!.mode, `${mode} : le réglage refusé laisse l’acte`).toBe(ph0.mode);
    return { mode, fenetre, reglage };
  });
}

describe('fenêtre du soin — l’acte, refusé comme le réglage `soins.mode` le refuse', () => {
  it('« le patient aux trois maux », soigné à la Guérison : Blessures, Hémorragie et Munition s’offrent, les actes au long cours non', () => {
    const doc = cb({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = cb({ id: 'al', label: 'Blessé', wounds: blessuresDeBase(12, 3), conditions: [{ id: 'hemorragique', value: 2 }, { id: 'munition-logee', value: 1 }], pos: { x: 2, y: 1 } });
    enCombat(doc, al);
    g().ouvrirLaGuerison('al');
    const lignes = confronter();
    for (const l of lignes) expect(l.reglage, `${l.mode} : même verdict, même raison`).toBe(l.fenetre);
    expect(lignes.filter((l) => l.fenetre === null).map((l) => l.mode)).toEqual(['blessures', 'hemorragie', 'munition']);
  });

  it('« le patient sans Hémorragie » : l’Hémorragie et la Munition sont refusées par le patient', () => {
    const doc = cb({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = cb({ id: 'al', label: 'Blessé', wounds: blessuresDeBase(12, 3), pos: { x: 2, y: 1 } });
    enCombat(doc, al);
    g().ouvrirLaGuerison('al');
    const lignes = confronter();
    for (const l of lignes) expect(l.reglage, `${l.mode} : même verdict, même raison`).toBe(l.fenetre);
    expect(lignes.filter((l) => l.fenetre === null).map((l) => l.mode)).toEqual(['blessures']);
  });

  it('« le soigneur à la Dextérité » (sans Guérison, sous Bandages) : seule l’Hémorragie s’offre, refusée ailleurs par le Test', () => {
    const doc = cb({ id: 'doc', items: [bandages()] as never });
    const al = cb({ id: 'al', label: 'Blessé', wounds: blessuresDeBase(12, 3), conditions: [{ id: 'hemorragique', value: 2 }, { id: 'munition-logee', value: 1 }], pos: { x: 2, y: 1 } });
    enCombat(doc, al);
    g().ouvrirLaGuerison('al');
    expect(g().pendingHeal, 'chemin : la Dextérité sous Bandages ouvre l’Hémorragie').toMatchObject({ test: 'dexterite', mode: 'hemorragie' });
    const lignes = confronter();
    for (const l of lignes) expect(l.reglage, `${l.mode} : même verdict, même raison`).toBe(l.fenetre);
    expect(lignes.filter((l) => l.fenetre === null).map((l) => l.mode)).toEqual(['hemorragie']);
  });

  it('après le dé, tout acte est refusé à la fenêtre', () => {
    const doc = cb({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = cb({ id: 'al', label: 'Blessé', wounds: blessuresDeBase(12, 3), conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } });
    enCombat(doc, al);
    g().ouvrirLaGuerison('al');
    g().jetLancer('soins');
    expect(fenetreDuSoin(g())!.mode.options.every((o) => o.refus), 'aucun acte ne se règle une fois le dé tombé').toBe(true);
  });
});
