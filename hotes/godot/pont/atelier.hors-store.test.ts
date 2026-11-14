/**
 * LES MODÈLES DE L'ATELIER 3D (#3086, `CONTRAT.md`, section « Atelier 3D ») : `modelesDeLAtelier` rend chaque base avec
 * ses points d'accroche, emplacements puis prises, à chaque emplacement les éléments rigides de cette base dont un mesh
 * pend à l'os du point, à chaque prise ceux dont un mesh pend à l'os de l'une de ses prises (`osDesRigides`), ses lignes de pièce tirées de la garde-robe (#3086, D3), où vont ses éléments liés au
 * squelette ou en surface et ses accessoires rigides, le fichier GLB de chaque base et de chaque élément servi, et pour ces seuls éléments les noms de
 * leurs surfaces `blason`, et la marche de chaque base (l'unique clip de ses appuis et sa vitesse au sol, au gabarit
 * neutre) ; les emblèmes sont la sous-liste `embleme` de la garde-robe ; un rigide sans os n'est servi nulle part, les
 * refus de l'index sont rendus, une base à marche ambiguë est refusée seule ; un véhicule, sans base, est servi sous sa
 * fiche (#2987).
 */
import { describe, expect, it } from 'vitest';
import { baseDeTest, elementSchema3, glbDElement, vehiculeDeTest } from '../asset/modeles.testkit.ts';
import { empreinte } from '../asset/empreinte.ts';
import { emplacementsDeRangement, gardeRobe } from '../../../src/noyau/index';
import { tableTotale } from '../../../src/lib/tableTotale';
import { modelesDeLAtelier } from './atelier';

const dos = { os: 'spine', position: [0, 0.1, 0], rotation: [0, 0, 0] };
const humanoide = { ...baseDeTest('humanoide'), emplacements: { dos }, clips: { marche: 'Walk_Loop', repos: 'Idle_Loop' }, appuis: { ...baseDeTest('humanoide').appuis, pieds: ['root'], vitesseAuSol: 1.25 } };
const epee = elementSchema3('humanoide');
const chemise = {
  schema: 3, base: 'humanoide', categorie: 'vetement', cle: { piece: 'chemise' }, liaison: { mode: 'squelette' }, couche: 'tenue', couvre: ['torse'],
  emplacements: { epaule_d: { os: 'root', position: [0.2, 0.3, 0], rotation: [0, 0, 0] } },
  surfaces: [{ nom: 'tissu', palette: 'tissu' }, { nom: 'ecusson', palette: 'tissu', blason: true }], glb: empreinte(glbDElement('root', ['tissu', 'ecusson'])),
};
const teteNaine = {
  schema: 3, base: 'humanoide', categorie: 'tete', cle: { tete: 'nain' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['tete'],
  surfaces: [{ nom: 'peau', palette: 'peau' }], glb: empreinte(glbDElement('root', ['peau'])),
};
const broche = { ...elementSchema3('humanoide'), categorie: 'accessoire', cle: { piece: 'baudrier' }, liaison: { mode: 'surface' }, couvre: [] };
const bouclier = {
  ...elementSchema3('humanoide'), cle: { apparence: 'rond' },
  surfaces: [{ nom: 'metal', palette: 'metal' }, { nom: 'champ', palette: 'vet1', blason: true }], glb: empreinte(glbDElement('spine', ['metal', 'champ'])),
};
const lanterne = { ...elementSchema3('humanoide'), cle: { apparence: 'targe' }, surfaces: [{ nom: 'verre', palette: 'accent', blason: true }], glb: empreinte(glbDElement(null, ['verre'])) };
const orpheline = { ...elementSchema3('nain'), cle: { apparence: 'hache' } };

describe('modelesDeLAtelier', () => {
  const modeles = modelesDeLAtelier(
    { humanoide, epee, bouclier, lanterne, chemise, teteNaine, broche, orpheline },
    { humanoide: [], epee: ['root'], bouclier: ['spine', 'handslot.l'], lanterne: [], chemise: ['root'], teteNaine: ['root'], broche: ['root'] },
  );
  const lignes = modeles.bases[0].lignes;

  it('une base donne ses points, ses emplacements, ceux qu’offrent ses pièces, puis ses prises, et son empreinte (#3844)', () => {
    expect(modeles.bases.map(({ id, empreinte }) => ({ id, empreinte }))).toEqual([{ id: 'humanoide', empreinte: humanoide.glb.sha256 }]);
    expect(modeles.bases[0].points.map(({ id, genre, attache, offertPar }) => ({ id, genre, attache, offertPar }))).toEqual([
      { id: 'dos', genre: 'emplacement', attache: dos, offertPar: undefined },
      { id: 'epaule_d', genre: 'emplacement', attache: chemise.emplacements.epaule_d, offertPar: { chemise: chemise.emplacements.epaule_d } },
      { id: 'main', genre: 'prise', attache: humanoide.prises.main, offertPar: undefined },
      { id: 'secondaire', genre: 'prise', attache: humanoide.prises.secondaire, offertPar: undefined },
    ]);
  });

  it('une base publie sa table rôle → clip et la vitesse au sol de son rôle `marche`, au gabarit neutre', () => {
    expect([modeles.bases[0].clips, modeles.bases[0].vitesseAuSol]).toEqual([{ marche: 'Walk_Loop', repos: 'Idle_Loop' }, 1.25]);
  });

  it('une base publie les os de ses chaînes (#3842)', () => {
    expect(modelesDeLAtelier({ humanoide: { ...humanoide, chaines: { cape: ['cape_1', 'cape_2'], jupe: ['jupe_1'] } } }, { humanoide: [] }).bases[0].osDeChaine).toEqual(['cape_1', 'cape_2', 'jupe_1']);
  });

  it('une base sans table des rôles tenus à deux mains la publie vide (#3319)', () => {
    expect(modeles.bases[0].clipsDeuxMains).toEqual({});
    expect(modeles.bases[0].prisesOccupees).toEqual({});
  });

  it('chaque point porte exactement les objets rigides de la base dont un mesh pend à son os, ni le squelette, ni la surface, ni un accessoire', () => {
    expect(Object.fromEntries(modeles.bases[0].points.map(({ id, elements }) => [id, elements]))).toEqual({ dos: ['epee', 'bouclier'], epaule_d: ['epee'], main: ['epee'], secondaire: ['epee'] });
  });

  it('un objet tenu construit pour une prise est offert à chaque prise de sa base et aux emplacements où sa forme se range, jamais à un autre emplacement (#3319)', () => {
    const attache = (os: string) => ({ os, position: [0, 0, 0], rotation: [0, 0, 0] });
    expect(emplacementsDeRangement('epee')).toContain('ceinture_g');
    expect(emplacementsDeRangement('epee')).toContain('dos');
    expect(emplacementsDeRangement('epee')).not.toContain('epaule_d');
    const mains = { ...humanoide, os: ['root', 'spine', 'main_d', 'main_g'], emplacements: { dos, ceinture_g: attache('root') }, prises: { main: attache('main_d'), secondaire: attache('main_g') } };
    const base = modelesDeLAtelier({ humanoide: mains, epee, bouclier }, { humanoide: [], epee: ['main_d'], bouclier: ['spine'] }).bases[0];
    expect(Object.fromEntries(base.points.map(({ id, elements }) => [id, elements]))).toEqual({ dos: ['epee', 'bouclier'], ceinture_g: ['epee'], main: ['epee'], secondaire: ['epee'] });
  });
  it('les lignes de pièce sont, dans l’ordre de la garde-robe, le sélecteur `tete`, le sélecteur `coiffure`, une bascule `piece` par pièce de vêtement ou d’armure, puis une liste `emplacement` par emplacement d’une pièce d’accessoire', () => {
    const emplacementsDAccessoire = new Set<string>(gardeRobe.flatMap((g) => (g.kind === 'piece' && g.emplacement ? [g.emplacement.id] : [])));
    expect(lignes.map((l) => ('id' in l ? `${l.sorte}:${l.id}` : l.sorte))).toEqual([
      'tete', 'coiffure',
      ...gardeRobe.flatMap((g) => (g.kind === 'piece' && g.categorie !== 'accessoire' ? [`piece:${g.id}`] : [])),
      ...gardeRobe.flatMap((g) => (g.kind === 'emplacement' && emplacementsDAccessoire.has(g.id) ? [`emplacement:${g.id}`] : [])),
    ]);
  });

  it('un sélecteur d’axe offre chaque id de sa sous-liste avec les éléments de la base dont la clé le vaut : une tête sans élément a une liste vide', () => {
    const choixDe = (kind: 'tete' | 'coiffure') => gardeRobe.flatMap((g) => (g.kind === kind ? [{ id: g.id, label: g.label, elements: g.id === 'nain' ? ['teteNaine'] : [] }] : []));
    expect(lignes.find((l) => l.sorte === 'tete')).toEqual({ sorte: 'tete', label: 'Tête', choix: choixDe('tete') });
    expect(lignes.find((l) => l.sorte === 'coiffure')).toEqual({ sorte: 'coiffure', label: 'Coiffure', choix: choixDe('coiffure') });
    const tete = lignes.find((l) => l.sorte === 'tete');
    expect(tete && 'choix' in tete ? tete.choix.find(({ id }) => id === 'humain') : undefined).toEqual({ id: 'humain', label: gardeRobe.find(({ id }) => id === 'humain')?.label, elements: [] });
  });

  it('un vêtement lié au squelette est servi sur la ligne de sa pièce, et nulle autre', () => {
    expect(lignes.filter((l) => 'id' in l && l.elements.length > 0)).toEqual([
      { sorte: 'piece', variantes: false, id: 'chemise', label: gardeRobe.find(({ id }) => id === 'chemise')?.label, elements: ['chemise'] },
      { sorte: 'emplacement', id: 'epaule_d', label: gardeRobe.find(({ id }) => id === 'epaule_d')?.label, elements: ['broche'] },
    ]);
  });

  it('le GLB et la scène fabriquée de chaque base et de chaque élément servi, à un point ou à une ligne, sont nommés, et d’eux seuls', () => {
    expect(modeles.fichiers).toEqual(tableTotale(['humanoide', 'bouclier', 'epee', 'chemise', 'teteNaine', 'broche'], (id) => ({ glb: `${id}.glb`, scene: `${id}.scn` })));
  });

  it('chaque base et chaque élément servi, quelle que soit sa liaison, et eux seuls, donnent leurs surfaces ; une base sans `surfaces`, aucune', () => {
    expect(modeles.surfaces).toEqual({ humanoide: [], bouclier: bouclier.surfaces, epee: epee.surfaces, chemise: chemise.surfaces, teteNaine: teteNaine.surfaces, broche: broche.surfaces });
    const peinte = { ...humanoide, surfaces: [{ nom: 'peau', palette: 'peau' }] };
    expect(modelesDeLAtelier({ humanoide: peinte }, { humanoide: [] }).surfaces).toEqual({ humanoide: peinte.surfaces });
  });

  it('chaque élément servi qui déclare une seconde prise la donne telle quelle, avec le maniement de sa forme, et lui seul (#3319)', () => {
    const secondePrise = { position: [0, -0.4, 0], rotation: [0, Math.PI, 0] };
    const hallebarde = { ...elementSchema3('humanoide'), cle: { apparence: 'hallebarde' }, liaison: { mode: 'rigide', secondePrise } };
    const estoc = { ...elementSchema3('humanoide'), cle: { apparence: 'epee_soldat' }, liaison: { mode: 'rigide', secondePrise } };
    expect(modeles.secondesPrises).toEqual({});
    expect(modelesDeLAtelier({ humanoide, epee, hallebarde, estoc }, { humanoide: [], epee: ['root'], hallebarde: ['root'], estoc: ['root'] }).secondesPrises)
      .toEqual({ hallebarde: { repere: secondePrise, maniement: 'hampe' }, estoc: { repere: secondePrise, maniement: null } });
  });

  it('chaque élément servi qui a une couche donne son rang, s’il est un accessoire, les zones qu’il couvre et les éléments qu’il masque, ceux de couche plus intérieure ou sans couche, et lui seul (#2972, #3842)', () => {
    expect(modeles.couches).toEqual({ chemise: { rang: 2, accessoire: false, couvre: ['torse'], masque: ['epee', 'bouclier', 'teteNaine', 'broche'] }, teteNaine: { rang: 0, accessoire: false, couvre: ['tete'], masque: ['epee', 'bouclier', 'broche'] } });
    const { couvre: _, ...sansZones } = { ...broche, couche: 'tenue' };
    expect(modelesDeLAtelier({ humanoide, chemise, broche: sansZones }, { humanoide: [], chemise: ['root'], broche: ['root'] }).couches)
      .toEqual({ chemise: { rang: 2, accessoire: false, couvre: ['torse'], masque: [] }, broche: { rang: 2, accessoire: true, couvre: [], masque: [] } });
  });

  it('les emblèmes sont la sous-liste `embleme` de la garde-robe, chacun réduit à son id, son libellé et son dessin', () => {
    expect(modeles.emblemes.map(({ id }) => id)).toEqual(['taureau-rouge', 'tete-de-mort-rouge', 'marteau-de-sigmar']);
    for (const embleme of modeles.emblemes) {
      const entree = gardeRobe.find(({ id }) => id === embleme.id);
      expect(entree?.kind, embleme.id).toBe('embleme');
      if (entree?.kind === 'embleme') expect(embleme, embleme.id).toStrictEqual({ id: entree.id, label: entree.label, svg: entree.svg });
    }
  });

  it('les refus de l’index sont rendus', () => {
    expect(modeles.refus).toEqual(['[base-absente] orpheline : nain']);
  });

  it('un accessoire rigide est servi à la ligne de son emplacement, jamais à un point ; si ni la base ni aucune de ses pièces ne l’offre, il est rapporté, sans refus, et servi nulle part', () => {
    const plumet = { ...elementSchema3('humanoide'), categorie: 'accessoire', cle: { piece: 'plumet' }, couche: 'tenue' };
    const casque = { ...chemise, categorie: 'armure', cle: { piece: 'casque' }, couche: 'armure', emplacements: { cimier: dos } };
    const servis = (m: ReturnType<typeof modelesDeLAtelier>) => [...m.bases[0].points, ...m.bases[0].lignes].flatMap((l) => ('elements' in l ? l.elements : []));
    const sansCimier = modelesDeLAtelier({ humanoide, plumet }, { humanoide: [], plumet: ['root'] });
    expect(sansCimier.rapport).toEqual(['[emplacement-non-offert] plumet : plumet se pose sur cimier, que ni la base `humanoide` ni aucune de ses pièces n’offre']);
    expect(sansCimier.refus).toEqual([]);
    expect(servis(sansCimier)).toEqual([]);
    expect(Object.keys(sansCimier.fichiers)).toEqual(['humanoide']);
    const avecCimier = modelesDeLAtelier({ humanoide, casque, plumet }, { humanoide: [], casque: [], plumet: ['spine'] });
    expect(avecCimier.rapport).toEqual([]);
    expect(avecCimier.bases[0].lignes.filter((l) => 'id' in l && l.elements.includes('plumet')).map((l) => ('id' in l ? `${l.sorte}:${l.id}` : l.sorte))).toEqual(['emplacement:cimier']);
    expect(avecCimier.bases[0].points.flatMap(({ elements }) => elements)).toEqual([]);
    expect(servis(avecCimier)).toEqual(['casque', 'plumet']);
  });

  it('un véhicule, sans base, est servi sous la fiche que nomme sa `definition`, son GLB, ses surfaces et le libellé de sa fiche avec lui, même sans aucune base (#2987)', () => {
    const caraque = vehiculeDeTest('caraque');
    const seul = modelesDeLAtelier({ caraque }, { caraque: [] });
    expect(seul).toMatchObject({ bases: [], refus: [], vehicules: { caraque: 'caraque' }, fichiers: { caraque: { glb: 'caraque.glb', scene: 'caraque.scn' } }, surfaces: { caraque: caraque.surfaces }, libelles: { caraque: 'Caraque (MDG)' } });
    expect(modelesDeLAtelier({ humanoide, epee, caraque }, { humanoide: [], epee: ['root'], caraque: [] }).bases[0].points.flatMap(({ elements }) => elements)).not.toContain('caraque');
    expect(modeles.vehicules).toEqual({});
  });

  it('deux fiches homonymes de livres différents se distinguent par le sigle du leur', () => {
    const { libelles } = modelesDeLAtelier(
      { baliste: vehiculeDeTest('baliste'), 'baliste-ade2': vehiculeDeTest('baliste-ade2') },
      { baliste: [], 'baliste-ade2': [] },
    );
    expect(libelles).toEqual({ baliste: 'Baliste (AA)', 'baliste-ade2': 'Baliste (ADE II)' });
  });
});
