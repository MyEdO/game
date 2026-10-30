import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CampaignVessel } from '../noyau/etat';
import type { Combatant } from '../engine/types';
import { ShipDossierView } from './ShipDossier';
import { blessuresDeBase } from '../engine/characteristics';

const hero = (id: string): Combatant => ({
  id, label: `Héros ${id}`, kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4,
} as Combatant);

// Fixture COMPLÈTE : coque entamée, Moral, Humeur de Manann avec facteurs appliqués, cale chargée,
// équipage salarié + dette, salissures, sabotage, critiques, eau embarquée, dernière traversée.
const vessel = (): CampaignVessel => ({
  vehicleId: 'cogue',
  label: 'Le Cormoran',
  morale: { score: 62, lastMoraleWeek: 0, factors: [] },
  wounds: { current: 8, max: 20 },
  fouling: { level: 2, lastWeek: 0 },
  manann: { score: 9, applied: ['vaincre-stromfels', 'grand-sacrifice'] },
  saboteurDR: -2,
  cargo: [{ cargoId: 'cereales', enc: 200, basePriceGold: 3 }],
  criticals: ['Voie d’eau majeure : la coque prend l’eau.'],
  waterLitres: 290,
  lastVoyageMilles: 140,
  crew: [{ roleId: 'timonier', count: 1 }, { roleId: 'mousse', count: 6 }],
  wagesOwed: 1200,
});

const render = (initialTab: 'apercu' | 'cargaison' | 'equipage' = 'apercu') =>
  renderToStaticMarkup(<ShipDossierView vessel={vessel()} party={[hero('h1'), hero('h2')]} onClose={() => {}} initialTab={initialTab} />);

describe('ShipDossier — dossier de navire persistant (#227)', () => {
  it('en-tête : nom d’instance, type et gréement', () => {
    const html = render();
    expect(html).toContain('Le Cormoran'); // vessel.label (≠ label du type)
    expect(html).toContain('Cogue'); // label du type
    expect(html).toContain('Voile'); // gréement (rig)
  });

  it('Vue d’ensemble : bande de PROUE — le navire du joueur se MONTRE (silhouette + nom + état coque)', () => {
    const html = render('apercu');
    expect(html).toContain('data-ship-proue'); // bande de proue présente
    expect(html).toContain('data-bone="coque"'); // silhouette effectivement rendue par le gabarit navire
    expect(html).toContain('Silhouette — Le Cormoran'); // a11y : nom d’instance
    expect(html).toContain('avariée'); // état RÉEL : coque 8/20 → avariée (source unique state.vessel)
  });

  it('Vue d’ensemble : les quatre jauges à crans (Coque, Moral, Humeur, Soute)', () => {
    const html = render('apercu');
    const gauges = html.match(/notch-gauge__track/g) ?? [];
    expect(gauges.length).toBe(4);
    expect(html).toContain('Coque');
    expect(html).toContain('Moral');
    expect(html).toContain('Humeur de Manann');
    expect(html).toContain('8'); // Blessures courantes
    expect(html).toContain('200 / 300 Enc'); // soute
  });

  it('Historique d’Humeur : chaque facteur appliqué listé par son LIBELLÉ (lookup id→label)', () => {
    const html = render('apercu');
    expect(html).toContain('Facteurs appliqués (2)');
    expect(html).toContain('Vaincre ou contrer des suivants de Stromfels'); // findManannFactor(...).label
    expect(html).toContain('Grand sacrifice à Manann'); // second facteur
  });

  it('État : salissures, critique de coque, sabotage, eau + autonomie, dernière traversée', () => {
    const html = render('apercu');
    expect(html).toContain('Salissures'); // niveau 2
    expect(html).toContain('Voie d’eau majeure'); // critique verbatim
    expect(html).toContain('-2 DR'); // sabotage actif
    expect(html).toContain('290 L'); // eau embarquée
    expect(html).toContain('autonomie'); // jours d’autonomie calculés via provisioningManifest
    expect(html).toContain('140 milles'); // dernière traversée
    expect(html).toContain('Avarie de coque'); // 20-8 = 12 Blessures à réparer
    expect(html).toContain('<b>12</b> Blessure'); // le manque exact
  });

  it('Cargaison : lot par LIBELLÉ du catalogue + total vs Contenance', () => {
    const html = render('cargaison');
    expect(html).toContain('Céréales'); // findCargoById('cereales').label
    expect(html).toContain('200 / 300'); // total vs capacité
  });

  it('Équipage : roster salarié par rôle + solde hebdomadaire calculée + dette', () => {
    const html = render('equipage');
    expect(html).toContain('Timonier'); // crewRoleLabel('timonier')
    expect(html).toContain('Mousse'); // crewRoleLabel('mousse')
    expect(html).toContain('Solde hebdomadaire');
    expect(html).toContain('Dette de paie'); // wagesOwed
  });

  it('type sans facette navire : composant nul', () => {
    const notAShip = { ...vessel(), vehicleId: 'diligence' };
    expect(renderToStaticMarkup(<ShipDossierView vessel={notAShip} party={[]} onClose={() => {}} />)).toBe('');
  });
});
