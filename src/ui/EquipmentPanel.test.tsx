import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EquipmentPanel } from './EquipmentPanel';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { trappings } from '../data';
import type { Combatant, ItemInstance } from '../engine/types';

/** Résolveur de test : libellé → instance par id (authoring). */
const itemFromTrapping = (label: string) => itemFromTrappingById(trappings.find((t) => t.label === label)!.id);

/** Héros de test : cuir souple + maille PORTÉS (couches superposées), plate et cape au sac,
 *  arme simple en main + hallebarde (2M) au sac. Armure/armes/loadouts dérivés par recompute. */
const mkHero = (mut?: (items: ItemInstance[]) => void): Combatant => {
  const real = (label: string, uid: string, equipped: boolean): ItemInstance => ({
    ...itemFromTrapping(label)!,
    uid,
    equipped,
  });
  const items = [
    real('Justaucorps de cuir', 'cuir', true),
    real('Chemise de mailles', 'maille', true),
    real('Plastron', 'plate', false),
    real('Cape', 'cape', false),
    real('Arme simple', 'epee', true),
    real('Hallebarde', 'halle', false),
  ];
  mut?.(items);
  const c = {
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'Humains (Reiklander)',
    career: 'Soldat',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    conditions: [],
    skills: [],
    talents: [],
    movement: 4,
    items,
  } as unknown as Combatant;
  recomputeLoadout(c); // dérive armour/weapons + auto-génère Set I / Set II
  return c;
};

describe('EquipmentPanel (rendu)', () => {
  it('localisations × couches : PA cumulé en face de la zone, plate proposée en Extérieure', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero()} />);
    expect(html).toContain('Tête');
    expect(html).toContain('Corps');
    expect(html).toContain('Souple'); // libellé de couche (en-tête + tooltip)
    expect(html).toContain('Flexible');
    expect(html).toContain('PA 3'); // Corps : maille (Flexible, 2) + justaucorps (souple, 1) cumulés par wornArmourPoints
    expect(html).toContain('Plastron · PA 2'); // candidat de la couche Extérieure (option du picker)
    expect(html).toContain('eq-slot'); // cellules-emplacements (nom des pièces portées = popover au survol)
  });

  it('mannequin MORT (#492, rig grand format = colonne de fiche) + damier 4 localisations + ligne Cape', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero()} />);
    expect(html).not.toContain('equip-figure');
    expect(html).not.toContain('equip-doll');
    expect(html).toContain('equip-slots');
    expect(html).toContain('eq-slot'); // cellules-emplacements
    for (const zone of ['Tête', 'Bras', 'Corps', 'Jambes']) expect(html).toContain(zone);
    expect(html).toContain('Cape');
  });

  it('cape portée → retirable depuis la ligne Cape', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero((items) => { items.find((i) => i.uid === 'cape')!.equipped = true; })} />);
    expect(html).toContain('eq-loc-cape');
    expect(html).not.toContain('Aucune cape dans le sac');
  });

  it('sets d’armes en cartes-cellules (sans libellé « Set ») ; hallebarde marquée (2M) ; récap en main', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero()} />);
    expect(html).toContain('Harnois'); // Band de gauche (damier)
    expect(html).toContain('Sets d’armes'); // Band de droite
    expect(html).toContain('equip-sets');
    expect(html).toContain('set-card');
    expect(html).toContain('chip tone-warn'); // Set I actif par défaut — chip d'ÉTAT, pas un bouton
    expect(html).toContain('Actif</span>');
    expect(html).toContain('Hallebarde (2M)'); // option du picker d'arme
    expect(html).toContain('En main');
    expect(html).toContain('Arme simple');
    expect(html).not.toContain('Set I'); // plus de libellé « Set 1/2/3 »
  });

  it('arme 2 mains en principale → cellule secondaire bloquée (pas de 2nde main)', () => {
    const h = mkHero();
    h.loadouts![0].main = 'halle';
    h.loadouts![0].off = undefined;
    recomputeLoadout(h);
    const html = renderToStaticMarkup(<EquipmentPanel hero={h} />);
    expect(html).toContain('deux mains'); // titre de la cellule 2nde bloquée
  });

  it('« En main » : les qualités de l’arme = chips canoniques (EntityRef)', () => {
    const h = mkHero();
    h.loadouts![0].main = 'halle'; // Hallebarde : Défensive/Taille/Empaleuse
    h.loadouts![0].off = undefined;
    recomputeLoadout(h);
    const html = renderToStaticMarkup(<EquipmentPanel hero={h} />);
    expect(html).toContain('weap-quals');
    expect(html).toContain('entity-chip'); // plus de texte plat « Défensive, … »
    expect(html).toContain('Empaleuse');
  });
});
