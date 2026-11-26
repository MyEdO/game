import { arena, poserLesReglesMaisonPersistees, ruleOverrides } from '../../../../src/noyau';
import { describe, expect, it } from 'vitest';
import { ouvrirEnAuto, poserLesReglesDuRoguelite, REGLES_DU_ROGUELITE } from './partie';

const regle = (id: string): unknown => ruleOverrides()[id];
const ouvrir = () => ouvrirEnAuto(1, () => ({ party: [], scene: arena({ id: 'regles', label: 'Règles', w: 4, h: 4 }), projet: null })).partie;

describe('les règles optionnelles du roguelite', () => {
  it('une partie ouverte par ouvrirEnAuto joue sous REGLES_DU_ROGUELITE posées au démarrage, dont l’incantation VDM', () => {
    poserLesReglesMaisonPersistees({});
    poserLesReglesDuRoguelite();
    const partie = ouvrir();
    expect(REGLES_DU_ROGUELITE).toMatchObject({ 'magie-vdm-incantation': true });
    for (const [id, valeur] of Object.entries(REGLES_DU_ROGUELITE)) expect(regle(id), id).toBe(valeur);
    partie.fermer();
  });

  it('un écart posé au registre vaut pour la partie qui s’ouvre ensuite', () => {
    poserLesReglesDuRoguelite({ 'magie-vdm-incantation': false });
    const partie = ouvrir();
    expect(regle('magie-vdm-incantation')).toBe(false);
    expect(regle('creation-5e')).toBe(true);
    partie.fermer();
    poserLesReglesDuRoguelite();
  });
});
