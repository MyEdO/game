/**
 * #3253, #3456 — ce que porte un combattant (`porteeDuCombattant`) : sa race de rendu, sa tête, ses armes tenues puis
 * rangées, les objets équipés qui revêtent des pièces, son armure (équipée, sinon de statbloc déclarée portée), la teinte
 * de ses objets, la tenue de sa carrière, son emblème et ses couleurs, par le même assembleur d'objet qu'une composition. Les attendus
 * se lisent au catalogue, jamais recopiés.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { afterEach, describe, expect, it } from 'vitest';
import { porteeDuCombattant, vehiculeDuCombattant } from './combattant';
import { facteursDeComposition, porteesDeLaTenue } from './composition';
import { piecesDEnsemble } from './gardeRobe';
import { createHero } from '../../engine/character';
import { hydratePoste, itemFromGive, loadoutCreate, loadoutSetActive, loadoutSetSlot, recomputeLoadout } from '../../engine/items';
import {
  creatures,
  findCreatureById,
  findGroupeDArmureById,
  findPlanDEspeceById,
  findSpeciesById,
  findTenueDeCarriere,
  findTrappingById,
  piecesCouvrant,
  piecesDeLObjet,
  raceAppearance,
  weaponGroups,
  type GroupeDArmure,
} from '../../data';
import { findTierEntry } from '../../engine/tables';
import { resetData, setDataset } from '../../data/overrides';
import { localisationsDeLoc } from '../../engine/classementDeTrait';
import { spawnEnemy } from '../monde/spawn';
import { ficheDEntite } from '../monde/sceneNpc';
import type { Combatant, FireArc, ItemInstance } from '../../engine/types';
import { couleursSchema } from '../../data/schemas/grammaire/valeurs';
import { ref } from '../../data/schemas/grammaire/ref';

const REIKLANDER = 'humains-reiklander';

/** Des couleurs du nuancier, lues au schéma (`couleursSchema`) : emplacement → id de couleur. */
const couleurs = (ids: Record<string, string>) => couleursSchema.parse(Object.fromEntries(Object.entries(ids).map(([slot, id]) => [slot, { id }])));

const heros = (opts: Partial<Parameters<typeof createHero>[0]> = {}): Combatant =>
  createHero({ idNeuf: idsDeTest, speciesId: REIKLANDER, careerId: 'soldat', label: 'Porteur', seed: 3, ...opts });

const objet = (trappingId: string): ItemInstance => ({ ...itemFromGive({ trappingId }, idsDeTest), uid: trappingId });

/** Un héros qui tient `tenue` en main directrice, et range `rangee` dans un second set. */
function herosArme(tenue: string, rangee: string): Combatant {
  const c = heros();
  c.items = [objet(tenue), objet(rangee)];
  c.loadouts = [];
  const second = loadoutCreate(c);
  loadoutSetSlot(c, second, 'main', rangee);
  const premier = loadoutCreate(c);
  loadoutSetSlot(c, premier, 'main', tenue);
  loadoutSetActive(c, premier);
  recomputeLoadout(c);
  return c;
}

const creature = (id: string): Combatant => spawnEnemy({ presetCreature: findCreatureById(id)!, presetId: id }, `${id}-1`, { x: 0, y: 0 });

/** Un héros d'une carrière sans tenue, qui porte `items`. */
const herosVetu = (...items: ItemInstance[]): Combatant => ({ ...heros({ careerId: 'agitateur' }), items });

const equipe = (trappingId: string): ItemInstance => ({ ...objet(trappingId), equipped: true });

/** Les pièces portées de `c`, chacune par l'id de l'objet qui l'apporte et sa teinte. */
const pieces = (c: Combatant) =>
  porteeDuCombattant(c)!.portees.flatMap((p) => (p.cle.champ === 'piece' ? [{ piece: p.cle.id, par: p.par?.id, ...(p.teinte ? { teinte: p.teinte } : {}) }] : []));

/** La référence à la teinte d'objet `id`, frappée au schéma de la référence. */
const teinteDObjet = ref('material', undefined, 'objet');

/** `weaponGroups.json` où chaque Groupe d'armure a pour teinte `teintes[id]`. */
const teindreLesGroupes = (teintes: Record<string, string>) =>
  setDataset('weaponGroups', weaponGroups.map((g) => (g.kind === 'armour' && teintes[g.id] ? { ...g, teinte: teinteDObjet.parse({ id: teintes[g.id] }) } : g)));

afterEach(() => resetData());

describe('porteeDuCombattant', () => {
  it('un héros d’espèce jouable : la race de rendu de son espèce (`refChar`), la tête de cette race et ses facteurs', () => {
    const race = raceAppearance.find((r) => r.id === findSpeciesById(REIKLANDER)!.refChar)!;
    const portee = porteeDuCombattant(heros())!;
    expect(portee.portees[0].cle).toEqual({ champ: 'tete', id: race.id });
    expect(portee.facteurs).toEqual(facteursDeComposition(undefined, race));
  });

  it('une créature de race porte la tête de sa race', () => {
    expect(porteeDuCombattant(creature('squelette'))!.portees[0].cle).toEqual({ champ: 'tete', id: 'squelette' });
  });

  it('une créature sans base humanoïde ne porte rien', () => {
    expect(porteeDuCombattant(creature('cheval'))).toBeNull();
  });

  it('une créature prend la base humanoïde à la race que le plan de bestiaire donne à son espèce (#2993)', () => {
    const race = findPlanDEspeceById(findCreatureById('gor')!.appearance.species)!.race!.id;
    expect(race).not.toBe('gor');
    expect(porteeDuCombattant(creature('gor'))!.portees[0].cle).toEqual({ champ: 'tete', id: race });
    expect(porteeDuCombattant(creature('gor'))!.facteurs).toEqual(facteursDeComposition(undefined, raceAppearance.find((r) => r.id === race)!));
  });

  it('l’arme tenue porte sa forme à sa main, l’arme rangée au rangement de son trapping', () => {
    const { portees } = porteeDuCombattant(herosArme('arme-simple', 'dague'))!;
    expect(portees.filter((p) => p.cle.champ === 'apparence').map(({ cle, point }) => [cle.id, point])).toEqual([
      [findTrappingById('arme-simple')!.shape!.id, 'main'],
      [findTrappingById('dague')!.shape!.id, findTrappingById('dague')!.rangement!.id],
    ]);
  });

  it('un objet équipé qu’un ensemble habille apporte les pièces de l’ensemble', () => {
    expect(pieces(herosVetu(equipe('gants')))).toEqual(piecesDEnsemble({ type: 'trapping', id: 'gants' }).map((piece) => ({ piece, par: 'gants' })));
  });

  it('une armure équipée revêt les pièces qui couvrent ses localisations, à la teinte de son Groupe d’armure', () => {
    const veste = findTrappingById('veste-de-cuir')!;
    teindreLesGroupes({ [veste.subType!.id]: 'shyish' });
    const attendues = piecesCouvrant(localisationsDeLoc(veste.loc));
    expect(attendues.length).toBeGreaterThan(1);
    expect(pieces(herosVetu(equipe('veste-de-cuir')))).toEqual(attendues.map((piece) => ({ piece, par: 'veste-de-cuir', teinte: 'shyish' })));
  });

  it('la teinte de l’objet passe avant celle de son Groupe d’armure', () => {
    teindreLesGroupes({ [findTrappingById('veste-de-cuir')!.subType!.id]: 'shyish' });
    expect(pieces(herosVetu({ ...equipe('veste-de-cuir'), teinte: 'aethyrique' })).map((p) => p.teinte)).toEqual(piecesDeLObjet('veste-de-cuir').map(() => 'aethyrique'));
  });

  it('une pièce que revêtent deux armures est celle de la couche du dessus', () => {
    const [dessous, dessus] = ['veste-de-cuir', 'chemise-de-mailles'].sort((a, b) => findGroupeDArmureById(findTrappingById(a)!.subType?.id)!.couche - findGroupeDArmureById(findTrappingById(b)!.subType?.id)!.couche);
    const communes = piecesDeLObjet(dessus).filter((p) => piecesDeLObjet(dessous).includes(p));
    expect(communes.length).toBeGreaterThan(0);
    const portees = pieces(herosVetu(equipe(dessous), equipe(dessus)));
    for (const piece of communes) expect(portees.filter((p) => p.piece === piece)).toEqual([{ piece, par: dessus }]);
  });

  it('l’arme teintée porte sa teinte', () => {
    const { portees } = porteeDuCombattant(herosArme('arme-simple', 'dague'))!;
    expect(portees.every((p) => p.teinte === undefined)).toBe(true);
    const c = herosArme('arme-simple', 'dague');
    c.items = c.items!.map((i) => (i.uid === 'arme-simple' ? { ...i, teinte: 'aethyrique' } : i));
    recomputeLoadout(c);
    expect(porteeDuCombattant(c)!.portees.find((p) => p.point === 'main')?.teinte).toBe('aethyrique');
  });

  it('une armure de statbloc déclarée portée revêt les pièces des localisations à PA, à la teinte du Groupe de leur palier', () => {
    const c = creature('helmut-beckenbauer');
    expect(c.items?.some((i) => i.equipped && i.kind === 'armor')).toBeFalsy();
    const locs = (Object.keys(c.armour) as (keyof typeof c.armour)[]).filter((l) => c.armour[l] > 0);
    expect(locs.length).toBeGreaterThan(0);
    const palier = findTierEntry(weaponGroups.filter((g): g is GroupeDArmure & { seuil: number } => g.kind === 'armour' && g.seuil !== undefined), c.armour.corps)!;
    teindreLesGroupes({ [palier.id]: 'ardente-de-rhuin' });
    expect(pieces(c)).toEqual(piecesCouvrant(locs).map((piece) => ({ piece, par: undefined, teinte: 'ardente-de-rhuin' })));
  });

  it('sans `armurePortee`, ni PA ni armure ne revêtent de pièce ; une armure équipée passe avant celle du statbloc', () => {
    const c = creature('helmut-beckenbauer');
    expect(pieces({ ...c, appearanceOverride: { ...c.appearanceOverride, armurePortee: false } })).toEqual([]);
    expect(pieces({ ...c, items: [equipe('heaume')] })).toEqual(piecesDeLObjet('heaume').map((piece) => ({ piece, par: 'heaume' })));
  });

  it('la tenue de sa carrière, après ce qu’il porte : une pièce déjà revêtue ne l’est pas deux fois', () => {
    const tenue = findTenueDeCarriere('soldat')!;
    const uniforme = porteesDeLaTenue(tenue.id).map((p) => p.cle.id);
    expect(pieces({ ...heros(), items: [] }).map((p) => p.piece)).toEqual(uniforme);
    const gants: readonly string[] = piecesDEnsemble({ type: 'trapping', id: 'gants' });
    expect(pieces({ ...heros(), items: [equipe('gants')] })).toEqual([
      ...gants.map((piece) => ({ piece, par: 'gants' })),
      ...uniforme.filter((p) => !gants.includes(p)).map((piece) => ({ piece, par: tenue.id })),
    ]);
    expect(pieces(herosVetu())).toEqual([]);
  });

  it('l’emblème est celui de l’apparence d’auteur', () => {
    const ne = ficheDEntite({ id: 'garde', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 0, y: 0 }, appearance: { embleme: { id: 'taureau-rouge' } } }, () => undefined);
    expect(porteeDuCombattant(ne)!.embleme).toEqual({ id: 'taureau-rouge' });
  });

  it('ses couleurs : celles de l’apparence de sa créature, chacune remplacée par celle de son apparence d’auteur', () => {
    const squelette = findCreatureById('squelette')!;
    setDataset('creatures', creatures.map((e) => (e.id === 'squelette' ? { ...e, appearance: { ...e.appearance, couleurs: couleurs({ corps: 'peau-pale', accent: 'peau-mate' }) } } : e)));
    const c = creature('squelette');
    expect(porteeDuCombattant(c)!.couleurs).toEqual({ corps: { id: 'peau-pale' }, accent: { id: 'peau-mate' } });
    expect(porteeDuCombattant({ ...c, appearanceOverride: { ...c.appearanceOverride, couleurs: couleurs({ accent: 'peau-brune' }) } })!.couleurs)
      .toEqual({ corps: { id: 'peau-pale' }, accent: { id: 'peau-brune' } });
    expect(squelette.appearance.couleurs).toBeUndefined();
    expect(porteeDuCombattant(heros())).not.toHaveProperty('couleurs');
  });

  it('le sexe est celui de l’apparence ; sans apparence, le corps neutre de la base', () => {
    expect(porteeDuCombattant(heros({ apparence: { sex: 'F' } }))!.sex).toBe('F');
    expect(porteeDuCombattant(heros())!.sex).toBe('M');
  });
});

describe('vehiculeDuCombattant (#2987)', () => {
  const coque = (id: string): Combatant => spawnEnemy({ vehicule: id }, `${id}-1`, { x: 0, y: 0 });
  const engin = (id: string): Combatant => spawnEnemy({ engin: id }, `${id}-1`, { x: 0, y: 0 });
  const poste = (trappingId: string, side?: FireArc) => hydratePoste({ trappingId, ...(side ? { side } : {}) }, 'poste-de-test');
  it.each([['caraque', coque, 4, 'empreinte'], ['barque-fluviale', coque, 1, 'empreinte'], ['canon-petit', engin, 2, 'reelle'], ['belier-ade2', engin, 2, 'reelle']] as const)('%s, coque ou engin de siège : sa fiche, le côté de son empreinte et sa taille, sans portée', (ref, fiche, empreinte, taille) => {
    const c = fiche(ref);
    expect([vehiculeDuCombattant(c, undefined), porteeDuCombattant(c)]).toEqual([{ definition: ref, empreinte, taille, cap: 'N', postes: [], ameliorations: [] }, null]);
  });
  it('son cap, et les pièces de ses seuls postes à un bord, dans leur ordre', () => {
    const c = { ...coque('caraque'), postes: [poste('canon-moyen', 'tribord'), poste('canon-petit'), poste('canon-grand', 'proue'), poste('canon-moyen', 'tribord')] };
    expect(vehiculeDuCombattant(c, 'SE')).toEqual({ definition: 'caraque', empreinte: 4, taille: 'empreinte', cap: 'SE', postes: [{ definition: 'canon-moyen', bord: 'tribord' }, { definition: 'canon-grand', bord: 'proue' }, { definition: 'canon-moyen', bord: 'tribord' }], ameliorations: [] });
  });
  it('ses couleurs, celles de son apparence d’auteur, et la teinte de chaque pièce', () => {
    const teinte = { ...poste('canon-moyen', 'tribord'), item: { ...poste('canon-moyen', 'tribord').item, teinte: 'aethyrique' } };
    const c = { ...coque('caraque'), appearanceOverride: { couleurs: couleurs({ bois: 'peau-brune' }) }, postes: [teinte, poste('canon-grand', 'proue')] };
    expect(vehiculeDuCombattant(c, 'N')).toEqual({
      definition: 'caraque', empreinte: 4, taille: 'empreinte', cap: 'N', couleurs: { bois: { id: 'peau-brune' } },
      postes: [{ definition: 'canon-moyen', bord: 'tribord', teinte: 'aethyrique' }, { definition: 'canon-grand', bord: 'proue' }], ameliorations: [],
    });
  });
  it('les Améliorations de sa coque, de sa fiche puis installées, sans ses Traits (MDG 12)', () => {
    const c = { ...coque('loup-imperial'), upgrades: [{ id: 'sabord' }, { id: 'robuste' }, { id: 'nid-de-pie' }] };
    expect(vehiculeDuCombattant(c, 'N')!.ameliorations).toEqual(['belier', 'sabord', 'nid-de-pie']);
  });
  it('son emblème, celui de son apparence d’auteur, qu’en portent ses voiles et son pavillon', () => {
    expect(vehiculeDuCombattant({ ...coque('caraque'), appearanceOverride: { embleme: { id: 'taureau-rouge' } } }, 'N')!.embleme).toEqual({ id: 'taureau-rouge' });
    expect(vehiculeDuCombattant(coque('caraque'), 'N')).not.toHaveProperty('embleme');
  });
  it('une créature n’est pas un véhicule', () => expect(vehiculeDuCombattant(creature('loup'), 'N')).toBeNull());
});
