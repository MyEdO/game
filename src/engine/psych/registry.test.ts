import { describe, it, expect } from 'vitest';
import { parsePsychTraits } from './registry';
import { creatures } from '../../data';

describe('Psychologie data-driven (capabilities de traits.json) — LDB 21/85', () => {
  it('parse Peur/Terreur/Immunité + ciblés (Animosité/Phobie indice 1/Effrayé indice 0), Cible = id de Groupe', () => {
    const p = parsePsychTraits([{ id: 'peur', value: 2 }, { id: 'immunite-psychologique' }, { id: 'animosite', arg: 'elfe' }, { id: 'phobie', arg: 'Serpents' }, { id: 'effraye', arg: 'Feu' }]);
    expect(p.causesPeur).toBe(2);
    expect(p.psychImmune).toBe(true);
    expect(p.psychTraits).toEqual(expect.arrayContaining([
      { type: 'animosite', cible: 'elfe' },
      // « Serpents »/« Feu » ne sont PAS des ids de Groupe (`groups.json`) → Cible INERTE (pas de chaîne FR résiduelle).
      { type: 'phobie', cible: undefined, indice: 1 },
      { type: 'phobie', cible: undefined, indice: 0 },
    ]));
  });

  it('Cible « un au choix » ou vide → inerte (cible indéfinie) ; « deux au choix » → 2 wildcards inertes', () => {
    expect(parsePsychTraits([{ id: 'haine', arg: 'un au choix' }]).psychTraits).toEqual([{ type: 'haine', cible: undefined }]);
    expect(parsePsychTraits([{ id: 'haine' }]).psychTraits).toEqual([{ type: 'haine', cible: undefined }]);
    expect(parsePsychTraits([{ id: 'animosite', arg: 'deux au choix' }]).psychTraits).toEqual([
      { type: 'animosite', cible: undefined },
      { type: 'animosite', cible: undefined },
    ]);
  });

  it('deux instances → deux Cibles, une par instance (Haine, Effrayé, Animosité, Préjugé)', () => {
    for (const [id, type, indice] of [['haine', 'haine', undefined], ['effraye', 'phobie', 0], ['animosite', 'animosite', undefined], ['prejuge', 'prejuge', undefined]] as const) {
      const attendu = (cible: string) => (indice == null ? { type, cible } : { type, cible, indice });
      expect(parsePsychTraits([{ id, arg: 'noble' }, { id, arg: 'homme-bete' }]).psychTraits, id).toEqual([attendu('noble'), attendu('homme-bete')]);
    }
  });

  it('une liste jointe dans UNE instance n’est pas découpée : une seule Cible, inerte', () => {
    expect(parsePsychTraits([{ id: 'animosite', arg: 'noble, homme-bete' }]).psychTraits).toEqual([{ type: 'animosite', cible: undefined }]);
  });

  it('un trait sans capacité psy est ignoré', () => {
    expect(parsePsychTraits([{ id: 'arme', value: 7 }])).toEqual({});
  });

  /**
   * Cibles d'origine (Phase 2, commit fdc720e1) laissées INERTES en MAX FIDÉLITÉ (phase psy) : chaque
   * cible ci-dessous a été examinée et ne modélise VOLONTAIREMENT aucun Groupe — flavor pur (personnage
   * nommé, critère subjectif/qualitatif, ou élément non-combattant), zéro invention. Traçabilité ; ne
   * PAS résoudre sans un référent combattant réel (cf. `groups.json`/`groups.ts`).
   */
  const LEFT_INERT_ORIGINAL_TARGETS = [
    { creature: 'ogre', trait: 'prejuge', cible: 'Maigrichons', raison: 'insulte propre aux Ogres (gabarit), aucun Groupe' },
    { creature: 'jetsam-la-gelee-intelligente', trait: 'effraye', cible: 'Feu', raison: 'phobie élémentaire (créature-gelée), pas un Groupe de combattants' },
    { creature: 'volee-de-noctecorbes', trait: 'effraye', cible: 'Lumière', raison: 'phobie élémentaire (corvidé nocturne), pas un Groupe' },
    { creature: 'wereburga-krotpreffer', trait: 'prejuge', cible: 'Étrangers', raison: 'relatif (étranger à qui ?), aucun Groupe fixe' },
    { creature: 'marta-gerbenshreiber', trait: 'prejuge', cible: 'Ceux qu’elle considère faibles', raison: 'critère subjectif personnel, aucun Groupe' },
    { creature: 'frere-bengt', trait: 'prejuge', cible: 'Mauvais auditeurs', raison: 'critère subjectif comportemental, aucun Groupe' },
    { creature: 'alfric-demi-nez-brisenclume', trait: 'prejuge', cible: 'Étrangers', raison: 'relatif, aucun Groupe fixe (idem Wereburga)' },
    { creature: 'agna-lottrisdottir', trait: 'prejuge', cible: 'Ces nains lâches qui rechignent à guerroyer pour restaurer le Royaume éternel', raison: 'sous-ensemble idéologique de Nains (PAS tous les Nains) — mapper à `nain` serait sur-large' },
    { creature: 'helmut-beckenbauer', trait: 'prejuge', cible: 'Ceux qui ne savent pas apprécier un bon match de Middenball', raison: 'critère subjectif (sport), aucun Groupe' },
    { creature: 'walpurga-wurklich', trait: 'animosite', cible: 'Menteurs, trompeurs, sophistes', raison: 'trait comportemental transversal à tous les Groupes, aucun Groupe' },
    { creature: 'walpurga-wurklich', trait: 'prejuge', cible: 'Acteurs, amateurs de théâtre', raison: 'métier/loisir sans Groupe dédié (un seul PNJ concerné, zéro invention)' },
    { creature: 'andrea-bruhn', trait: 'prejuge', cible: 'Les artistes qui ne sont pas aussi doués qu’ils le pensent', raison: 'critère qualitatif subjectif, aucun Groupe' },
    { creature: 'traudl-bauer', trait: 'prejuge', cible: 'Ulricains pas assez zélés', raison: 'sous-ensemble QUALIFIÉ des Ulricains (PAS tous) — distinct du simple `ulricain`, reste inerte' },
    { creature: 'brigitte-schleigel', trait: 'effraye', cible: 'créanciers', raison: 'phobie non-combattante (dette), aucun Groupe' },
    { creature: 'brigitte-schleigel', trait: 'prejuge', cible: 'réactionnaires, miliciens, utilisateurs de mystracine', raison: 'reste du segment comma après extraction de `noble` (aristocrates/nantis) — aucun Groupe milice/politique/drogue existant' },
    { creature: 'sangsue-geante', trait: 'effraye', cible: 'Sel', raison: 'phobie élémentaire (sangsue), aucun Groupe' },
    { creature: 'sangsue-des-arbres', trait: 'effraye', cible: 'Sel', raison: 'phobie élémentaire (sangsue), aucun Groupe' },
  ] as const;

  it('DONNÉE creatures.json : les cibles LISTÉES ci-dessus restent bien INERTES (aucune ré-résolution accidentelle)', () => {
    for (const { creature, trait } of LEFT_INERT_ORIGINAL_TARGETS) {
      const c = (creatures as any[]).find((x) => x.id === creature);
      expect(c, `créature introuvable : ${creature}`).toBeTruthy();
      const stillInert = (c.traits ?? []).some((t: { id: string; arg?: string }) => t.id === trait && !t.arg);
      expect(stillInert, `${creature} :: ${trait} devrait avoir au moins une occurrence inerte (sans arg)`).toBe(true);
    }
  });
});
