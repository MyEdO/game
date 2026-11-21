import { describe, expect, it } from 'vitest';
import { enregistrerEntree } from '../../data/atelierDuCodex';
import { datasetArray, resetData } from '../../data/overrides';
import { adresseDeCreation } from '../../engine/adresseDeCreation';
import { newDraft, speciesTalentChoiceEntries, speciesTalentRandomDrawn, withSpecies } from './brouillon';
import { apresLeGeste, rubriquesDeLaPage } from './vueDeLaCreation';

describe('la référence à une table de Talents, de l’atelier à la création', () => {
  it('édite la table d’une option, affiche les dés actifs, tire sur la nouvelle table et refuse une référence morte', () => {
    const [imprimee] = datasetArray('talentsAleatoires');
    const especes = datasetArray('species');
    const index = especes.findIndex((esp) => esp.id === 'humains-nordland');
    const espece = especes[index];
    const id = 'autres-talents-du-nordland';
    const table = {
      id, type: imprimee.type, label: 'Autres Talents du Nordland', maison: 'Table du test',
      die: { n: 2, sides: 6 },
      entries: [{ id: 'ambidextre', min: 2, max: 12 }],
    };
    const modifier = (cible: string) => ({
      ...espece,
      talents: espece.talents.map((a) => 'of' in a
        ? { ...a, of: a.of.map((option) => 'table' in option ? { ...option, table: { id: cible } } : option) }
        : a),
    });
    try {
      const tableSauvee = enregistrerEntree('talentsAleatoires', table, -1);
      expect(tableSauvee).toMatchObject({ ok: true, fichier: 'talents-aleatoires.json' });
      const especeSauvee = enregistrerEntree('races', modifier(id), index);
      expect(especeSauvee).toMatchObject({ ok: true, fichier: 'species.json' });
      if (especeSauvee.ok) expect(especeSauvee.texte).toContain(`"id": "${id}"`);

      const d = withSpecies(newDraft(1), espece.id);
      const page = () => rubriquesDeLaPage(d, 'skills.talents');
      expect(page().find((r) => r.id === 'tirage')?.libelle).toBe('Tirer 2 Talents au 1d100');
      const adresseChoix = adresseDeCreation.especeTalent(2);
      const option = speciesTalentChoiceEntries(d).find((choix) => choix.adresse === adresseChoix)?.options.find((o) => 'table' in o);
      expect(option).toEqual({ pick: 1, table: { id } });
      const dChoisi = apresLeGeste(d, { geste: 'talentDEspece', args: [adresseChoix, option!] });
      const geste = rubriquesDeLaPage(dChoisi, 'skills.talents').find((r) => r.id === 'tirage');
      expect(geste?.libelle).toBe('Tirer 3 Talents au 2d6 et 1d100');
      if (geste?.genre !== 'geste') throw new Error('Tirage de Talents absent');
      const tire = apresLeGeste(dChoisi, geste.geste);
      expect(speciesTalentRandomDrawn(tire).find((r) => r.adresse === adresseDeCreation.especeTirage(2, 0))?.ref)
        .toEqual({ id: 'ambidextre' });

      const avantRefus = especes[index];
      const refuse = enregistrerEntree('races', modifier('table-fantome'), index);
      expect(refuse).toEqual({
        ok: false,
        erreurs: expect.arrayContaining([expect.stringMatching(/table-fantome.*absent du catalogue des tables de Talents aléatoires/)]),
      });
      expect(especes[index]).toBe(avantRefus);
    } finally {
      resetData();
    }
  });
});
