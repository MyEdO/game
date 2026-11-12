/** #1667 C-a — le tableau corps ou esprit de la mutation (LDB 19 l.76-81 ; ADE II 02 l.172-177 ; NADJ 15 l.173) :
 *  un document par race, chaque race tirée, les rangées d'un document couvrent son dé d'un seul tenant. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import { raceKeySchema } from '../grammaire/valeurs';

const FICHIER = 'mutation-nature.json';
type Rangee = { id: string; min: number; max: number };
const document = (race: string, entries: Rangee[]) => ({
  id: `nature-${race}`, type: 'mutation-nature', label: race, race, die: 'd100', source: { book: 'livre-de-base', page: 183 }, entries,
});
const moitie: Rangee[] = [{ id: 'physique', min: 1, max: 50 }, { id: 'mentale', min: 51, max: 100 }];
const toutes = () => raceKeySchema.options.map((race) => document(race, moitie));

describe('mutation-nature.json — un document par race, son dé couvert', () => {
  it('accepte un document par race, chacun couvrant le d100 d’un seul tenant', () => {
    expect(validateDataset(FICHIER, toutes())).toBeNull();
  });

  it('REFUSE, en le nommant, un trou entre deux rangées', () => {
    const docs = toutes();
    docs[0] = document(docs[0].race, [{ id: 'physique', min: 1, max: 50 }, { id: 'mentale', min: 52, max: 100 }]);
    expect(validateDataset(FICHIER, docs)).toMatch(/mutation-nature\.json › nature-humain : les rangées ne couvrent pas le d100 d'un seul tenant/);
  });

  it('REFUSE, en la nommant, une race tirée par deux documents', () => {
    const docs = [...toutes(), { ...document('nain', moitie), id: 'nature-nain-bis' }];
    expect(validateDataset(FICHIER, docs)).toMatch(/nature-nain-bis : la race « nain » est déjà celle du document « nature-nain »/);
  });

  it('REFUSE, en la nommant, une race qu’aucun document ne tire', () => {
    expect(validateDataset(FICHIER, toutes().filter((d) => d.race !== 'ogre'))).toMatch(/aucun document ne tire la nature de la mutation de la race « ogre »/);
  });

  it('REFUSE, en la nommant, une rangée qui tire un Tableau de Corruption hors des deux natures', () => {
    const docs = toutes();
    docs[0] = document(docs[0].race, [{ id: 'edoc-phys-khorne', min: 1, max: 50 }, { id: 'mentale', min: 51, max: 100 }]);
    expect(validateDataset(FICHIER, docs)).toMatch(/nature-humain : la rangée 1-50 tire « edoc-phys-khorne », qui n'est pas une nature de mutation/);
  });
});
