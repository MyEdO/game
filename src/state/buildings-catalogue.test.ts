/**
 * CONTRAT du catalogue des BÂTIMENTS (#1715) — le dataset `src/data/buildings.json` et la façade
 * `state/buildings` qui le lit.
 *
 * Un bâtiment n'est pas un volume : ce sont des `WallSeg` (murs d'arête) sur un sol de terrain, sa
 * nappe de toit venant du pivot (`builders/roofs` + `authoring/roofsSvg`). L'entrée porte donc la
 * couverture de référence du type et les ornements que le rendu émet.
 *
 * Rien n'est récité ici : les ids, le cardinal et les cibles de référence se DÉRIVENT du dataset et
 * des registres. Les fautes sont injectées dans une COPIE, jamais dans le fichier.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildings, props } from '../data/index';
import { resetData, setDataset } from '../data/overrides';
import { IDS_PAR_ESPACE } from '../data/schemas/_ids.generated';
import { schema } from '../data/schemas/defs/buildings';
import type { BuildingDef } from '../data/buildings.types';
import { buildingsMeta, buildingFeatures } from './buildings';

const charger = (): BuildingDef[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL('../data/buildings.json', import.meta.url)), 'utf8'));

/** Parse une copie du dataset après y avoir injecté une faute ; rend les messages de refus. */
function refus(saboter: (dataset: BuildingDef[]) => void): string[] {
  const dataset = charger();
  saboter(dataset);
  const r = schema.safeParse(dataset);
  return r.success ? [] : r.error.issues.map((i) => `${i.code} @${i.path.join('.')} : ${i.message}`);
}

const COUVERTURES = IDS_PAR_ESPACE['materials.json?domain=roof'] ?? [];
const IDS_DE_PROP = IDS_PAR_ESPACE['props.json'] ?? [];

afterEach(() => resetData());

describe('catalogue des bâtiments — la façade rend le DATASET (#1715)', () => {
  it('les métas d’éditeur couvrent le dataset, id pour id', () => {
    expect(Object.keys(buildingsMeta()).sort()).toEqual(buildings.map((b) => b.id).sort());
  });

  it('chaque méta porte le libellé de SON entrée, et rien d’autre', () => {
    for (const b of buildings) expect(buildingsMeta()[b.id], b.id).toEqual({ id: b.id, label: b.label });
    expect(new Set(buildings.map((b) => b.label)).size, 'deux bâtiments partagent un libellé : la méta ne désignerait plus son entrée.').toBe(buildings.length);
  });

  it('un style hors catalogue n’emprunte la méta d’AUCUN autre (#877)', () => {
    const inconnu = `${buildings.map((b) => b.id).join('-')}-absent`;
    expect(buildingsMeta()[inconnu]).toBeUndefined();
    expect(buildingFeatures(inconnu)).toEqual([]);
  });

  it('les ornements rendus sont ceux de l’entrée, et un bâtiment sobre en rend zéro', () => {
    for (const b of buildings) expect(buildingFeatures(b.id), b.id).toEqual(b.features ?? []);
    expect(buildings.some((b) => !b.features?.length), 'plus aucun bâtiment sobre : le repli `[]` n’est plus exercé.').toBe(true);
    expect(buildings.some((b) => (b.features?.length ?? 0) > 0), 'plus aucun ornement authoré : la lecture n’est plus exercée.').toBe(true);
  });

  it('la lecture est VIVE : une entrée éditée au seam se voit sans rechargement', () => {
    const [premier] = buildings;
    // L'index est AMORCÉ avant l'édition : sans cette lecture, le mémo se construirait pour la
    // première fois APRÈS l'écriture et rendrait la valeur neuve même sans témoin de version.
    expect(buildingsMeta()[premier.id].label).toBe(premier.label);
    setDataset('buildings', buildings.map((b) => (b.id === premier.id ? { ...b, label: 'Halle aux grains', features: [] } : b)));
    expect(buildingsMeta()[premier.id].label).toBe('Halle aux grains');
    expect(buildingFeatures(premier.id)).toEqual([]);
    resetData();
    expect(buildingsMeta()[premier.id].label).toBe(premier.label);
  });
});

describe('dataset des bâtiments — ce que le PARSE refuse', () => {
  it('le dataset COMMITTÉ passe : les cas ci-dessous ne mesurent pas un refus permanent', () => {
    expect(refus(() => {})).toEqual([]);
  });

  it('chaque couverture est une matière du domaine TOITURE, chaque ornement une entrée de props.json', () => {
    expect(COUVERTURES.length, 'le domaine `roof` de materials.json est vide : la porte ne prouverait rien.').toBeGreaterThan(0);
    for (const b of buildings) {
      expect(COUVERTURES, `${b.id}.roofMaterial`).toContain(b.roofMaterial);
      for (const f of b.features ?? []) {
        expect(IDS_DE_PROP, `${b.id}.features[${f.id}]`).toContain(f.id);
        expect(props.find((p) => p.id === f.id), `${b.id} : ornement absent de props.json`).toBeDefined();
      }
    }
  });

  it('une couverture HORS du domaine toiture est refusée nominativement', () => {
    const horsDomaine = (IDS_PAR_ESPACE['materials.json?domain=relief'] ?? []).find((id) => !COUVERTURES.includes(id))!;
    expect(horsDomaine, 'aucune matière de relief hors toiture : le cas n’est plus exerçable.').toBeTruthy();
    const messages = refus((d) => { d[0].roofMaterial = horsDomaine; });
    expect(messages.length, `« ${horsDomaine} » (relief) accepté comme couverture.`).toBe(1);
    expect(messages[0]).toContain('@0.roofMaterial');
    expect(messages[0]).toContain(horsDomaine);
    // La matière `plan` EST du domaine toiture : la porte filtre le domaine, pas une liste d’ids.
    expect(refus((d) => { d[0].roofMaterial = 'plan'; })).toEqual([]);
  });

  it('un ancrage hors du vocabulaire est refusé', () => {
    const i = buildings.findIndex((b) => (b.features?.length ?? 0) > 0);
    const messages = refus((d) => { d[i].features![0].anchor = 'toiture' as never; });
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain(`@${i}.features.0.anchor`);
  });

  it('un ornement absent de props.json est refusé nominativement', () => {
    const i = buildings.findIndex((b) => (b.features?.length ?? 0) > 0);
    const messages = refus((d) => { d[i].features![0].id = 'girouette-fantome'; });
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain('girouette-fantome');
  });

  it('une entrée SANS provenance maison est refusée (aucun folio n’imprime de catalogue de bâtiments)', () => {
    const messages = refus((d) => { delete (d[0] as { maison?: string }).maison; });
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.join(' | ')).toContain('maison');
  });
});
