import { describe, it, expect } from 'vitest';
import { categoryByKey, type CodexItem, type CodexRow } from './registry';

/** Lignes de la section « Niveau N : … » de l'onglet Progression d'une Carrière. */
const levelRows = (item: CodexItem, levelPrefix: string): CodexRow[] => {
  const prog = item.tabs?.find((t) => t.title === 'Progression');
  const section = prog?.sections.find((s) => s.title.startsWith(levelPrefix));
  return section?.rows ?? [];
};

describe('Codex registry — Possessions de Niveau de Carrière : réf STRUCTURÉE, jamais un libellé re-résolu (#904)', () => {
  it('Umbramancien N3 (Gardien Gris) : {id, type: creature} lie le bestiaire, {id} lie les Possessions, la mention « Apprenti » suit les possessions sous sa nature, en pastille NUE', () => {
    const item = categoryByKey('careers')!.items.find((i) => i.id === 'umbramancien')!;
    const rows = levelRows(item, 'Niveau 3');
    expect(rows.length).toBeGreaterThan(0);

    const creatureRow = rows.find((r) => r.t === 'ref' && r.category === 'creatures');
    expect(creatureRow).toMatchObject({ t: 'ref', category: 'creatures', id: 'cheval-de-guerre-leger' });

    const trappingRow = rows.find((r) => r.t === 'ref' && r.category === 'trappings');
    expect(trappingRow).toMatchObject({ t: 'ref', category: 'trappings', id: 'robe-de-sorcier-ordinaire' });

    // La mention se range sous le sous-titre de sa nature, après toutes les possessions.
    const sousTitre = rows.findIndex((r) => r.t === 'sub' && r.label === 'Personnes');
    const apprenti = rows.findIndex((r) => r.t === 'chip' && r.label === 'Apprenti');
    expect(sousTitre).toBeGreaterThan(rows.findIndex((r) => r === trappingRow));
    expect(apprenti).toBe(sousTitre + 1);
    // CONTRAT du titre : ce libellé n'est JAMAIS re-résolu en référence (#904).
    const refSurLibelle = rows.find((r) => r.t === 'ref' && (r.label === 'Apprenti' || r.show === 'Apprenti'));
    expect(refSurLibelle).toBeUndefined();
  });

  it('Bourgeois N3 (Conseiller municipal) : {id, type: vehicle} lie les Véhicules', () => {
    const item = categoryByKey('careers')!.items.find((i) => i.id === 'bourgeois')!;
    const rows = levelRows(item, 'Niveau 3');
    const vehicleRow = rows.find((r) => r.t === 'ref' && r.category === 'vehicles');
    expect(vehicleRow).toMatchObject({ t: 'ref', category: 'vehicles', id: 'diligence' });
  });
});
