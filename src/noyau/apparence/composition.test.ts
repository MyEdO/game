/**
 * #3086 (D1, D2, D3, D6(b)) — ce que porte une composition et ce qui apporte chaque chose, ses catalogues et ses axes tirés
 * des marques et des métas du schéma, l'entrée de preset d'une composition, enveloppe d'un preset reprise, avec son verdict,
 * et la seule validation d'une composition. Les attendus se lisent au catalogue et au schéma, jamais recopiés.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cataloguesDeComposition, compositionDuPreset, lireComposition, porteeDeComposition, presetDeComposition, type Axe, type Composition } from './composition';
import { findEnsembleParHabille, findPresetDePersonnageById, gardeRobe, trappingsInstanciables } from '../../data';
import { resetData, setDataset } from '../../data/overrides';
import { CLES_ENVELOPPE } from '../../data/schemas/grammaire/document';
import { file as FICHIER_DES_PRESETS, meta as metaDesPresets, type PresetDePersonnage } from '../../data/schemas/defs/presets-de-personnage';
import { noeudDuChamp } from '../../data/schemas/validate';
import { serializeDataset } from '../../data/serialize';
import { BUILD_NEUTRE } from '../../lib/corpulence';
import { piecesDEnsemble } from './gardeRobe';

const soldat = findPresetDePersonnageById('soldat')!;
const composition = compositionDuPreset(soldat);
/** `brut` passé par la seule porte d'une composition (`lireComposition`), qui frappe ses ids. */
const lue = (brut: unknown): Composition => {
  const lu = lireComposition(brut);
  if (!lu.ok) throw new Error(JSON.stringify(lu.fautes));
  return lu.composition;
};

describe('porteeDeComposition', () => {
  it('un objet habillé par un ensemble apporte ses pièces, sans apparence ni point', () => {
    const { portees } = porteeDeComposition(lue({ ...composition, objets: ['heaume'] }));
    expect(portees.filter((p) => p.par?.id === 'heaume')).toEqual(
      piecesDEnsemble({ id: 'heaume', type: 'trapping' }).map((id) => expect.objectContaining({ cle: { champ: 'piece', id }, par: expect.objectContaining({ type: 'trapping', id: 'heaume' }) })),
    );
  });

  it('un objet tenu porte son apparence à sa prise', () => {
    expect(porteeDeComposition(soldat).portees).toContainEqual(expect.objectContaining({ cle: { champ: 'apparence', id: 'hallebarde' }, point: 'main' }));
  });

  it('ce qui apporte une pièce porte le libellé de son ensemble : la chemise du Soldat, par l’uniforme de soldat', () => {
    const chemise = porteeDeComposition(soldat).portees.find((p) => p.cle.id === 'chemise');
    expect(chemise?.par).toEqual({ type: 'tenue', id: 'uniforme-de-soldat', label: 'Uniforme de soldat' });
    expect(chemise?.par?.label).toBe(findEnsembleParHabille({ type: 'tenue', id: 'uniforme-de-soldat' })?.label);
  });
});

describe('cataloguesDeComposition', () => {
  const catalogues = cataloguesDeComposition();

  it('chaque champ référence publie les entrées de sa sous-liste en `{ id, label }`', () => {
    expect(catalogues.tete).toEqual(gardeRobe.filter((g) => g.kind === 'tete').map(({ id, label }) => ({ id, label })));
    expect(catalogues.pieces).toEqual(gardeRobe.filter((g) => g.kind === 'piece').map(({ id, label }) => ({ id, label })));
    expect(catalogues.objets).toEqual(trappingsInstanciables().map(({ id, label }) => ({ id, label })));
  });

  it('un enum nommé publie ses valeurs, celui d’une clé de record aussi', () => {
    expect(catalogues.sex.map((c) => c.id)).toEqual(['M', 'F']);
    expect(catalogues.prises).toEqual([{ id: 'main', label: 'Main directrice' }, { id: 'off', label: 'Main secondaire' }]);
  });

  it('les axes, dans leur ordre : la forme dérivée du schéma, le libellé de sa méta, sa liste, les bornes et le neutre de la corpulence', () => {
    expect(catalogues.axes.map(({ champ, forme }) => [champ, forme])).toEqual([
      ['race', 'ref'],
      ['gabarit', 'ref'],
      ['sex', 'valeur'],
      ['build', 'plage'],
      ['tete', 'ref'],
      ['coiffure', 'ref'],
      ['tenue', 'ref'],
    ]);
    for (const axe of catalogues.axes) {
      expect(axe.label).toBe(metaDesPresets[axe.champ].label);
      if (axe.forme !== 'plage') expect(axe.liste).toBe(axe.champ);
    }
    const build = (noeudDuChamp(FICHIER_DES_PRESETS, 'build') as { unwrap: () => { minValue: number; maxValue: number } }).unwrap();
    expect(catalogues.axes.find((a) => a.champ === 'build')).toEqual({ champ: 'build', label: metaDesPresets.build.label, forme: 'plage', min: build.minValue, max: build.maxValue, neutre: BUILD_NEUTRE });
  });

  it('un axe `plage` sans `neutre` ne se type pas', () => {
    // @ts-expect-error `neutre` est exigé d’une plage
    const sansNeutre: Axe = { champ: 'build', label: metaDesPresets.build.label, forme: 'plage', min: 0, max: 1 };
    expect(catalogues.axes).not.toContainEqual(sansNeutre);
  });
});

describe('lireComposition', () => {
  it('la composition d’un preset est son entrée sans l’enveloppe, et se lit', () => {
    expect(Object.keys(composition)).toEqual(Object.keys(soldat).filter((k) => !(CLES_ENVELOPPE as readonly string[]).includes(k)));
    expect(lireComposition(composition)).toEqual({ ok: true, composition });
  });

  it('une composition absente, enveloppée ou fautive est refusée, chaque faute à son chemin', () => {
    expect(lireComposition(undefined)).toMatchObject({ ok: false, fautes: [{ chemin: [] }] });
    expect(lireComposition(soldat)).toMatchObject({ ok: false });
    expect(lireComposition({ ...composition, prises: { main: { id: 'hallebarde' }, off: { id: 'hallebarde' } } })).toEqual({
      ok: false,
      fautes: [{ chemin: ['prises', 'off'], message: expect.stringContaining('porté deux fois') }],
    });
  });

  it('une pièce déjà portée par l’ensemble de la tenue est une faute (D6(b))', () => {
    expect(lireComposition({ ...composition, pieces: [...composition.pieces!, 'chemise'] })).toEqual({
      ok: false,
      fautes: [{ chemin: ['pieces', composition.pieces!.length], message: expect.stringContaining('chemise') }],
    });
  });
});

describe('presetDeComposition', () => {
  afterEach(resetData);

  it('un preset qui porte d’autres clés d’enveloppe (`labelF`, `maison`) : sa composition se lit, et son entrée les reprend toutes et reparse à l’égal du preset', () => {
    const vetu: PresetDePersonnage = { ...soldat, labelF: 'Soldate', maison: 'Arbitrage de fixture' };
    setDataset('presetsDePersonnage', [vetu]);
    const sienne = compositionDuPreset(vetu);
    expect(lireComposition(sienne)).toEqual({ ok: true, composition: sienne });
    const rendu = presetDeComposition(sienne, 'soldat');
    expect(rendu).toMatchObject({ ok: true, verdict: [] });
    expect(JSON.parse((rendu as { entree: string }).entree)).toEqual(vetu);
  });

  it('la composition du Soldat sous son preset reprend son enveloppe, est valide, et son entrée reparse à l’égal de son JSON', () => {
    const rendu = presetDeComposition(composition, 'soldat');
    expect(rendu).toMatchObject({ ok: true, verdict: [] });
    expect(JSON.parse((rendu as { entree: string }).entree)).toEqual(soldat);
  });

  it('l’entrée valide suit l’ordre des clés du schéma, quel que soit celui de la composition', () => {
    const inverse = Object.fromEntries(Object.entries(composition).reverse()) as Composition;
    expect(presetDeComposition(inverse, 'soldat')).toMatchObject({ entree: serializeDataset(soldat) });
  });

  it('sans preset, l’entrée porte le type et la composition, et le verdict nomme l’enveloppe manquante', () => {
    const rendu = presetDeComposition(composition) as { entree: string; verdict: { chemin: unknown[] }[] };
    expect(JSON.parse(rendu.entree)).toEqual({ type: soldat.type, ...composition });
    expect(rendu.verdict.map((f) => f.chemin)).toEqual([['id'], ['label'], ['source']]);
  });

  it('un preset inconnu est refusé, avec les ids des presets', () => {
    expect(presetDeComposition(composition, 'inconnu')).toEqual({ ok: false, presets: ['soldat'] });
  });
});
