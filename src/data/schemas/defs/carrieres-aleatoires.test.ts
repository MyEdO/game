/** #3578 L2a — le Tableau des Classes et Carrières aléatoires (LDB 05 l.214-299), ses portions (MDG 09 l.9) et ses
 *  variantes (AA 02 l.109-128) : couverture du dé, une portion par colonne, étendue d'un seul tenant, coupures de la
 *  base, colonnes désignées, carrière détaillée et portée d'une variante. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import carrieresAleatoiresJson from '../../carrieres-aleatoires.json';
import speciesJson from '../../species.json';

type Rangee = { id: string; min: number; max: number };
type Colonne = { id: string; die: string; colonne?: string; carriere?: string; colonnes?: string[]; entries: Rangee[] };
const clone = () => structuredClone(carrieresAleatoiresJson) as unknown as Colonne[];
const doc = (docs: Colonne[], id: string) => docs.find((d) => d.id === id)!;
const FICHIER = 'carrieres-aleatoires.json';

describe('carrieres-aleatoires.json — colonnes, portions et couverture du dé', () => {
  it('le schéma accepte le document RÉEL', () => {
    expect(validateDataset(FICHIER, carrieresAleatoiresJson)).toBeNull();
  });

  it('REFUSE, en la nommant, une seconde portion sur la même colonne', () => {
    const docs = clone();
    const copie = structuredClone(doc(docs, 'cotiers-humain'));
    copie.id = 'cotiers-humain-bis';
    copie.entries = copie.entries.map((r) => (r.min === 63 ? { ...r, id: 'officier' } : r));
    docs.push(copie);
    expect(validateDataset(FICHIER, docs)).toMatch(/cotiers-humain-bis : la colonne « humain » porte déjà la portion « cotiers-humain » : une seule portion par colonne/);
  });

  it('REFUSE, en la nommant, une rangée de base qui chevauche une borne de l’étendue de la portion', () => {
    const docs = clone();
    const base = doc(docs, 'humain').entries;
    base.find((r) => r.max === 59)!.max = 60;
    base.find((r) => r.min === 60)!.min = 61;
    expect(validateDataset(FICHIER, docs)).toMatch(/cotiers-humain : la rangée 59-60 \(sorcier\) de la colonne « humain » chevauche une borne de l'étendue 60-73 de la portion/);
  });

  it('REFUSE, en nommant le trou, une portion qui ne couvre pas son étendue d’un seul tenant', () => {
    const docs = clone();
    const portion = doc(docs, 'cotiers-humain');
    portion.entries = portion.entries.filter((r) => r.min !== 67);
    expect(validateDataset(FICHIER, docs)).toMatch(/cotiers-humain : les rangées de la portion ne couvrent pas 60-73 d'un seul tenant — .*68/);
  });

  it('REFUSE, en nommant le trou, une colonne de base qui ne couvre pas le d100', () => {
    const docs = clone();
    const base = doc(docs, 'ogre');
    base.entries.splice(3, 1);
    expect(validateDataset(FICHIER, docs)).toMatch(/ogre : les rangées ne couvrent pas le d100 d'un seul tenant/);
  });

  it('REFUSE une portion dont `colonne` désigne une autre portion', () => {
    const docs = clone();
    doc(docs, 'cotiers-humain').colonne = 'cotiers-nain';
    expect(validateDataset(FICHIER, docs)).toMatch(/« cotiers-nain » porte le marqueur « colonne »/);
  });

  it('REFUSE une espèce dont `refCareer` désigne une portion', () => {
    const especes = structuredClone(speciesJson) as { refCareer: string }[];
    especes[0].refCareer = 'cotiers-humain';
    expect(validateDataset('species.json', especes)).toMatch(/« cotiers-humain » porte le marqueur « colonne »/);
  });

  it('REFUSE une espèce dont `refCareer` désigne une variante', () => {
    const especes = structuredClone(speciesJson) as { refCareer: string }[];
    especes[0].refCareer = 'variantes-soldat';
    expect(validateDataset('species.json', especes)).toMatch(/« variantes-soldat » porte le marqueur « carriere »/);
  });

  it('REFUSE, en nommant le trou, une variante qui ne couvre pas le d100', () => {
    const docs = clone();
    doc(docs, 'variantes-soldat').entries.splice(2, 1);
    expect(validateDataset(FICHIER, docs)).toMatch(/variantes-soldat : les rangées ne couvrent pas le d100 d'un seul tenant/);
  });

  it('REFUSE, en la nommant, une variante dont aucune rangée ne désigne sa carrière détaillée', () => {
    const docs = clone();
    doc(docs, 'variantes-erudit').entries[0].id = 'artisan';
    expect(validateDataset(FICHIER, docs)).toMatch(/variantes-erudit : aucune rangée ne désigne la carrière détaillée « erudit »/);
  });

  it('REFUSE une variante sans `colonnes`, et une colonne qui porte `colonnes`', () => {
    const sansPortee = clone();
    delete doc(sansPortee, 'variantes-cavalier').colonnes;
    expect(validateDataset(FICHIER, sansPortee)).toMatch(/variantes-cavalier : `carriere` et `colonnes` vont ensemble/);
    const colonneAPortee = clone();
    doc(colonneAPortee, 'ogre').colonnes = ['humain'];
    expect(validateDataset(FICHIER, colonneAPortee)).toMatch(/ogre : `carriere` et `colonnes` vont ensemble/);
  });

  it('REFUSE, en la nommant, une colonne de `colonnes` qui ne tire pas la carrière détaillée', () => {
    const docs = clone();
    doc(docs, 'variantes-chevalier').colonnes!.push('halfling');
    expect(validateDataset(FICHIER, docs)).toMatch(/variantes-chevalier : la colonne « halfling » ne tire pas la carrière détaillée « chevalier »/);
  });

  it('REFUSE une variante dont `colonnes` désigne une portion ou une variante', () => {
    const docs = clone();
    doc(docs, 'variantes-soldat').colonnes!.push('cotiers-humain');
    expect(validateDataset(FICHIER, docs)).toMatch(/« cotiers-humain » porte le marqueur « colonne »/);
  });
});
