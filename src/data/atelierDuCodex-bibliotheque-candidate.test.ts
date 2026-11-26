/**
 * Le Compendium juge une mutation sous le catalogue de la bibliothèque CANDIDATE (#5070) : une entrée créée, puis une
 * seconde qui la référence, sont acceptées sans `npm run gen` ni régime vivant des ids ; un id mort est refusé.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enregistrerEntree } from './atelierDuCodex';
import { entreesDuDataset, resetData } from './overrides';
import { poserRegimeVivant, type RegimeVivant } from './schemas/grammaire/idsVivants';

const GROUPE = 'groupe-de-la-bibliotheque-candidate';
const DIEU = 'dieu-de-la-bibliotheque-candidate';
const MORT = 'id-mort-de-la-bibliotheque-candidate';

/** Un dieu neuf qui accorde le groupe `groupe`, sur la forme d'un dieu livré. */
const dieu = (groupe: string) => ({ ...entreesDuDataset('gods')[0], id: DIEU, label: 'Dieu de la bibliothèque candidate', grantGroups: [groupe] });

let regime: RegimeVivant | undefined;
beforeEach(() => {
  regime = poserRegimeVivant(undefined);
});
afterEach(() => {
  poserRegimeVivant(regime);
  resetData();
});

describe('Compendium — la bibliothèque candidate juge la mutation', () => {
  it('une entrée créée, puis une seconde qui la référence : les deux sont acceptées', () => {
    expect(enregistrerEntree('groups', { id: GROUPE, type: 'groups', label: 'Groupe de la bibliothèque candidate' }, -1)).toMatchObject({ ok: true });
    expect(enregistrerEntree('gods', dieu(GROUPE), -1)).toMatchObject({ ok: true });
  });

  it('une entrée qui référence un id mort est refusée', () => {
    const r = enregistrerEntree('gods', dieu(MORT), -1);
    expect(r.ok ? '' : r.erreurs.join('\n')).toContain(MORT);
  });
});
