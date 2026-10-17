import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';
import { t } from '../../i18n';
import { TAB_LABELS } from '../../ui/CharacterSheet';

// Un texte de scénario qui NOMME un élément d'interface le nomme tel que l'écran l'affiche (#2198 K19).

const LIBELLES_D_ONGLET = Object.values(TAB_LABELS).map((cle) => String(t(cle)));

/** Les « onglet X » d'un texte dont X n'est pas un onglet de la fiche (30 caractères de X). Un onglet se
 *  cite par son nom propre (majuscule initiale) : « onglet du panneau marchand » n'en est pas un. X doit
 *  COMMENCER par un libellé d'onglet entier, borné au mot — quoi qu'il suive. */
function ongletsInconnus(texte: string): string[] {
  return [...texte.matchAll(/(?<![\p{L}\p{N}-])[Oo]nglets?[\s\u00a0]+(?:«[\s\u00a0]*)?(?=\p{Lu})/gu)]
    .map((m) => texte.slice(m.index + m[0].length))
    .filter((suite) => !LIBELLES_D_ONGLET.some((l) => suite.startsWith(l) && !/^[\p{L}\p{N}]/u.test(suite.slice(l.length))))
    .map((suite) => suite.slice(0, 30));
}

describe('textes des scénarios de test : les onglets et les héros nommés existent', () => {
  it('ongletsInconnus : tête de phrase, pluriel, espace insécable, guillemets, et borne au mot', () => {
    const possessions = String(t(TAB_LABELS.possessions));
    expect(ongletsInconnus(`Ouvrez l’onglet ${possessions}, puis l’onglet « ${possessions} ».`)).toEqual([]);
    expect(ongletsInconnus('Onglet Sac : changer la forme.')).toEqual(['Sac : changer la forme.']);
    expect(ongletsInconnus('les onglets Sac et Magie')).toEqual(['Sac et Magie']);
    expect(ongletsInconnus('onglet\u00a0Sac, puis')).toEqual(['Sac, puis']);
    expect(ongletsInconnus(`onglet ${possessions}X`)).toEqual([`${possessions}X`]);
    expect(ongletsInconnus('sous-onglet Sac')).toEqual([]);
    expect(ongletsInconnus('onglet du panneau marchand')).toEqual([]);
  });

  for (const sc of testScenarios) {
    it(`${sc.id} : chaque « onglet X » cité est un onglet de la fiche`, () => {
      const { scene } = sc.construire();
      expect(ongletsInconnus([scene.startMessage?.texte ?? '', sc.tests, sc.partyNote].join(' '))).toEqual([]);
    });
  }

  it('entrainement : les textes citent le héros de la forme d’arme par le nom que porte sa fiche', () => {
    const sc = testScenarios.find((s) => s.id === 'entrainement')!;
    const { party, scene } = sc.construire();
    const bretteur = party.find((h) => h.items?.some((i) => i.trappingId === 'arme-simple'))!;
    expect(scene.startMessage?.texte).toContain(`fiche du ${bretteur.label} (onglet ${t('sheet.tab.possessions')})`);
    expect(sc.tests).toContain(`fiche « ${bretteur.label} »`);
  });
});
