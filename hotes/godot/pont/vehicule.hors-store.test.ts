/**
 * LE VÉHICULE D'UN COMBATTANT (#2987 ; `CONTRAT.md`, section « Corps d'un combattant ») : une coque ou un engin se
 * projette en véhicule, sa fiche, son empreinte, son cap et les pièces de ses postes à un bord ; la vue lui donne l'élément
 * `vehicule` servi de sa fiche, sans base, quelles que soient les bases servies.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { baseDeTest, vehiculeDeTest } from '../asset/modeles.testkit.ts';
import { modelesCommites, servirLesModeles, suiteDe, table, vueDe } from './pont.testkit';
import type { CombattantProjete } from '../../../src/hote/projection';

const COMMITES = await modelesCommites();

const { appel } = table();
const servir = (manifestes: Record<string, unknown>) => servirLesModeles(appel, COMMITES, manifestes);

describe('le véhicule des combattants dans la vue', () => {
  let barge: CombattantProjete;
  beforeAll(() => {
    const { vue } = suiteDe(appel('demarrer', { scenario: 'embuscade-fluviale', graine: 7 }));
    barge = vue.projection.combat!.voisins.liste.find((c) => c.vehicule?.definition === 'barge-fluviale')!;
  });

  it('une coque se projette en véhicule, sa fiche, son empreinte, son cap et ses postes, sans portée', () => {
    expect([barge.vehicule, barge.portee]).toEqual([{ definition: 'barge-fluviale', empreinte: 2, taille: 'empreinte', cap: 'E', postes: [], ameliorations: [] }, null]);
  });

  it('sans élément de sa fiche servi, ni véhicule ni navire ; servi, la coque que la scène pose par ses ponts est un navire, à sa taille réelle, même sous refus de base', () => {
    const sansBarge = Object.fromEntries(Object.entries(COMMITES.manifestes).filter(([id]) => id !== 'vehicule--barge-fluviale'));
    servir(sansBarge);
    expect([vueDe(appel('vue')).corps.vehicules, vueDe(appel('vue')).corps.navires]).toEqual([{}, {}]);
    servir({ ...sansBarge, 'barge-fluviale': vehiculeDeTest('barge-fluviale'), nain: baseDeTest('nain') });
    const { corps } = vueDe(appel('vue'));
    expect(corps.refus).toMatch(/^\[base-ambigue\] /);
    expect(corps.vehicules).toEqual({});
    expect(corps.navires[barge.id]?.corps).toEqual({ element: 'barge-fluviale', empreinte: 2, taille: 'reelle', cap: 'N', palette: {}, postes: [], ameliorations: [], caches: [], clips: {} });
  });
});
