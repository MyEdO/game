import { describe, it, expect } from 'vitest';
import { categoryByKey, type CodexItem, type CodexRow } from './registry';

/** Lignes de la section « Niveau N : … » de l'onglet Progression d'une Carrière. */
const levelRows = (item: CodexItem, levelPrefix: string): CodexRow[] => {
  const prog = item.tabs?.find((t) => t.title === 'Progression');
  const section = prog?.sections.find((s) => s.title.startsWith(levelPrefix));
  return section?.rows ?? [];
};

describe('Codex registry — Possessions de Niveau de Carrière : réf STRUCTURÉE, jamais un libellé re-résolu (#904)', () => {
  it('Umbramancien N3 (Gardien Gris) : {creatureId} lie le bestiaire, {id} lie les Possessions, {text} reste une pastille NUE, jamais une réf', () => {
    const item = categoryByKey('careers')!.items.find((i) => i.id === 'umbramancien')!;
    const rows = levelRows(item, 'Niveau 3');
    expect(rows.length).toBeGreaterThan(0);

    const creatureRow = rows.find((r) => r.t === 'ref' && r.category === 'creatures');
    expect(creatureRow).toMatchObject({ t: 'ref', category: 'creatures', id: 'cheval-de-guerre-leger' });

    const trappingRow = rows.find((r) => r.t === 'ref' && r.category === 'trappings');
    expect(trappingRow).toMatchObject({ t: 'ref', category: 'trappings', id: 'robe-de-sorcier-ordinaire' });

    // `{text}` = un nom d'objet authoré en clair : pastille NUE (`CodexRow` variante
    // `{ t: 'chip'; label }`, rendue par `PlainChip`) — ni lien, ni popover.
    const chipRow = rows.find((r) => r.t === 'chip' && r.label === 'Apprenti');
    expect(chipRow).toBeTruthy();
    // CONTRAT du titre : ce libellé n'est JAMAIS re-résolu en référence (#904).
    const refSurLibelle = rows.find((r) => r.t === 'ref' && (r.label === 'Apprenti' || r.show === 'Apprenti'));
    expect(refSurLibelle).toBeUndefined();
  });

  it('Bourgeois N3 (Conseiller municipal) : {vehicleId} lie les Véhicules', () => {
    const item = categoryByKey('careers')!.items.find((i) => i.id === 'bourgeois')!;
    const rows = levelRows(item, 'Niveau 3');
    const vehicleRow = rows.find((r) => r.t === 'ref' && r.category === 'vehicles');
    expect(vehicleRow).toMatchObject({ t: 'ref', category: 'vehicles', id: 'diligence' });
  });
});
