/**
 * La spécialisation d'une entrée FERMÉE se choisit dans son catalogue (#4056, #841) : la feuille `specFermeeDe` de la
 * menace d'un Test, et le `spec` d'une référence à spécialisation au point de son `id` (`noeudDuChampAuPoint`), offrent
 * `catalogueSpecs` en choix (`choixDuNoeud`) et refusent un texte hors de lui, la règle de la feuille dite ; une entrée OUVERTE reste un texte.
 * Le Statut d'interlocuteur (`vsStatus`, `statutSchema`) se décompose de même : un choix d'Échelon et une saisie
 * de Standing entier de 0, écrits en ids. LDB 08 l.9, l.101
 */
import { describe, expect, it } from 'vitest';
import { conditionSchema, menaceSchema, testDeSceneSchema } from '../../data/schemas/grammaire/mecanique';
import { talents } from '../../data';
import { recast } from '../../data/valeursNeuves';
import { projetSchema } from '../../data/schemas/defs-scenes/projet';
import { schema as talentsSchema } from '../../data/schemas/defs/talents';
import { noeudsAuChemin } from '../../data/schemas/grammaire/descente';
import { catalogueSpecs, entreeOuverte, mesureDuParse } from '../../data/schemas/grammaire/ref';
import { objetDeCampagne } from '../../scenes/fixtures/objetDeCampagne.testkit';
import { emptyNarratif } from '../monde/campaignNarratif';
import { emptyScene } from '../monde/scene';
import { addTrigger, avecLaValeurDuPorteur } from '../sceneEdit';
import { choixDuChamp } from '../sceneEditLecture';
import { catalogueDuProcessus } from '../../data/catalogueDuProcessus';
import { avecLaValeur } from '../edition/formulaire';
import { champsOfferts, choixDuNoeud, bornesDuNoeud, formeAuPoint } from './editFields';

const donnee = { skill: { id: 'art' }, stake: { authored: 'x' } };

describe('choix des spécialisations fermées', () => {
  it('la menace offre le catalogue de Résistance, chaque choix admis, et refuse un texte libre', () => {
    const choix = choixDuNoeud(menaceSchema)!.map((o) => o.valeur);
    expect(choix).toEqual(catalogueSpecs('talent', 'resistance'));
    for (const v of choix) expect(avecLaValeur(testDeSceneSchema, donnee, ['menace'], v)).toMatchObject({ ok: true });
    expect(avecLaValeur(testDeSceneSchema, donnee, ['menace'], 'texte joué')).toEqual({ ok: false, refus: { regle: expect.stringMatching(/absente des spécialisations de « resistance »/) } });
  });

  it('le spec d’une compétence fermée (art) offre son catalogue, au point de son id', () => {
    expect(entreeOuverte('skill', 'art')).toBe(false);
    const skill = champsOfferts(testDeSceneSchema, donnee).find((f) => f.key === 'skill')!;
    const spec = champsOfferts(skill.noeud, donnee.skill).find((f) => f.key === 'spec')!;
    expect(choixDuNoeud(spec.noeud)!.map((o) => o.valeur)).toEqual(catalogueSpecs('skill', 'art'));
    const premiere = catalogueSpecs('skill', 'art')[0];
    expect(avecLaValeur(testDeSceneSchema, donnee, ['skill', 'spec'], premiere)).toMatchObject({ ok: true });
    expect(avecLaValeur(testDeSceneSchema, donnee, ['skill', 'spec'], 'texte joué')).toEqual({ ok: false, refus: { regle: expect.stringMatching(/absente des spécialisations de « art »/) } });
    const specialisee = { ...donnee, skill: { id: 'art', spec: premiere } };
    expect(avecLaValeur(testDeSceneSchema, specialisee, ['skill', 'spec'], undefined)).toEqual({ ok: true, valeur: donnee });
  });

  it('le spec d’une compétence ouverte (metier) reste un texte', () => {
    expect(entreeOuverte('skill', 'metier')).toBe(true);
    const ouverte = { ...donnee, skill: { id: 'metier' } };
    const skill = champsOfferts(testDeSceneSchema, ouverte).find((f) => f.key === 'skill')!;
    const spec = champsOfferts(skill.noeud, ouverte.skill).find((f) => f.key === 'spec')!;
    expect(choixDuNoeud(spec.noeud)).toBeUndefined();
    expect(avecLaValeur(testDeSceneSchema, ouverte, ['skill', 'spec'], 'tonnelier-de-marienburg')).toMatchObject({ ok: true });
  });
});

describe('les Conditions et le Test de Talent offrent les choix de leur schéma', () => {
  it.each([
    ['skill', 'id', 'crochetage', 'braveheart'],
    ['career', 'id', 'soldat', 'crochetage'],
    ['species', 'id', 'halflings', 'soldat'],
    ['attackKind', 'is', 'morsure', 'halflings'],
    ['capability', 'id', 'braveheart', 'lockpicks'],
    ['casterChaosDomain', 'is', 'indivisible', 'sigmar'],
  ])('la Condition %s offre ses valeurs et refuse une valeur du mauvais espace', (kind, champ, valeur, inconnue) => {
    const condition = kind === 'capability' ? { kind, who: 'target', [champ]: valeur } : { kind, [champ]: valeur };
    const forme = formeAuPoint(conditionSchema, condition)!;
    const champOffert = champsOfferts(forme.noeud, condition, forme.tenus).find((field) => field.key === champ)!;
    const choix = choixDuNoeud(champOffert.noeud)?.map((option) => option.valeur) ?? [];
    expect(choix).toContain(valeur);
    expect(choix).not.toContain(inconnue);
    expect(avecLaValeur(conditionSchema, condition, [champ], valeur)).toMatchObject({ ok: true });
    expect(avecLaValeur(conditionSchema, condition, [champ], inconnue)).toMatchObject({ ok: false });
    expect(conditionSchema.safeParse(condition).success).toBe(true);
    expect(conditionSchema.safeParse({ ...condition, [champ]: inconnue }).success).toBe(false);
  });

  it('ne présente pas un champ de CombatFeature qui ne peut valoir vrai', () => {
    const condition = { kind: 'capability', who: 'target', id: 'braveheart' };
    expect(conditionSchema.safeParse({ ...condition, id: 'offHandPenalty' }).success).toBe(false);
  });

  it('écrit l’exclusion de Magick après avoir choisi la spécialisation de Langue', () => {
    const match = { skill: { id: 'langue', spec: 'magick' }, sauf: true };
    const document = [{ test: { raw: 'Langue (toutes)', matches: [match] } }];
    const [noeud] = noeudsAuChemin(talentsSchema, document, [0, 'test', 'matches', 0]);
    const { skill } = match;
    const correspondance = champsOfferts(noeud, match);
    const champSkill = correspondance.find((field) => field.key === 'skill')!;
    const champs = champsOfferts(champSkill.noeud, skill);
    expect(choixDuNoeud(champs.find((field) => field.key === 'spec')!.noeud)?.map((option) => option.valeur))
      .toEqual(catalogueSpecs('skill', 'langue'));
    expect(correspondance.find((field) => field.key === 'sauf')?.label).toBe('Exclure la spécialisation');
    const nouvelle = { skill: { id: 'langue' } };
    expect(avecLaValeur(noeud, nouvelle, ['skill', 'spec'], 'bagarre')).toMatchObject({ ok: false });
    const specialisee = avecLaValeur(noeud, nouvelle, ['skill', 'spec'], 'magick');
    expect(specialisee).toEqual({ ok: true, valeur: { skill: { id: 'langue', spec: 'magick' } } });
    if (!specialisee.ok) throw new Error('La spécialisation Magick doit pouvoir être posée.');
    expect(avecLaValeur(noeud, specialisee.valeur, ['sauf'], true)).toEqual({ ok: true, valeur: match });
  });
});

describe('Condition de possession d’un objet', () => {
  const condition = (id: string) => ({ kind: 'hasItem', objet: { id } } as const);

  it('dans le Compendium, une référence désigne un objet instanciable du catalogue', () => {
    const linguistique = talents.find((talent) => talent.id === 'linguistique')!;
    const essai = (id: string) => talentsSchema.safeParse([{
      ...linguistique,
      test: { ...linguistique.test, matches: [{ skill: { id: 'langue' }, when: condition(id) }] },
    }]);
    expect(essai('corde').success).toBe(true);
    expect(essai('chambre-commune-nuit').error?.issues[0].message).toMatch(/service/);
    expect(essai('objet-inconnu').error?.issues[0].message).toMatch(/absent du catalogue des objets/);
    expect(conditionSchema.safeParse(recast({ kind: 'always' }, 'hasItem')).success).toBe(true);
  });

  it('le projet valide les deux porteurs, et l’éditeur offre le catalogue et les objets de la campagne', () => {
    const objet = objetDeCampagne();
    const scene = addTrigger({ ...emptyScene('sonde', 4, 4), desc: 'Scène de sonde.' }, { x: 0, y: 0, w: 1, h: 1 }).scene;
    const when = condition(objet.id);
    const declencheur = { ...scene.triggers[0], when };
    const narratif = { ...emptyNarratif(), objets: [objet], cloture: { when, titre: 'Fin du chapitre' } };
    const projet = { type: 'projet', id: 'sonde', label: 'Projet de sonde', maison: 'Sonde', versionContenu: 1, scenes: [{ ...scene, triggers: [declencheur] }], narratif };
    const cadre = { scene, projet, source: { manifeste: null, chapitres: {} }, catalogue: catalogueDuProcessus() };

    expect(projetSchema.safeParse(projet).success).toBe(true);
    expect(mesureDuParse(projetSchema, projet).reperes.filter((r) => r.type === 'local:narratif.objets').map((r) => r.path)).toEqual([
      ['scenes', 0, 'triggers', 0, 'when', 'objet', 'id'],
      ['narratif', 'cloture', 'when', 'objet', 'id'],
    ]);
    expect(projetSchema.safeParse({ ...projet, narratif: { ...narratif, objets: [] } }).error?.issues).toEqual([
      expect.objectContaining({ path: ['scenes', 0, 'triggers', 0, 'when', 'objet', 'id'] }),
      expect.objectContaining({ path: ['narratif', 'cloture', 'when', 'objet', 'id'] }),
    ]);

    const chemin = ['when', 'objet', 'id'];
    const choix = choixDuChamp('declencheur', declencheur, chemin, cadre)!;
    expect(choix).toContainEqual({ valeur: objet.id, libelle: objet.label, refus: null });
    expect(choix).toContainEqual({ valeur: 'corde', libelle: 'Corde', refus: null });
    expect(avecLaValeurDuPorteur('declencheur', declencheur, chemin, 'objet-inconnu', cadre).ok).toBe(false);

    const catalogue = avecLaValeurDuPorteur('declencheur', declencheur, chemin, 'corde', cadre);
    expect(catalogue).toMatchObject({ ok: true, valeur: { when: condition('corde') } });
    if (!catalogue.ok) throw new Error('Le formulaire doit permettre de choisir un objet du catalogue.');
    expect(avecLaValeurDuPorteur('declencheur', catalogue.valeur, chemin, objet.id, cadre))
      .toMatchObject({ ok: true, valeur: { when } });
  });
});

describe('Statut d’interlocuteur décomposé (`vsStatus`)', () => {
  const avecStatut = { ...donnee, vsStatus: { tier: 'argent', standing: 2 } };
  const sousChamps = () => {
    const vsStatus = champsOfferts(testDeSceneSchema, avecStatut).find((f) => f.key === 'vsStatus')!;
    return champsOfferts(vsStatus.noeud, avecStatut.vsStatus);
  };

  it('`tier` est un choix des trois Échelons, `standing` un entier de 0 sans borne haute', () => {
    const [tier, standing] = (['tier', 'standing'] as const).map((k) => sousChamps().find((f) => f.key === k)!);
    expect(choixDuNoeud(tier.noeud)).toEqual([
      { valeur: 'bronze', libelle: 'Bronze' },
      { valeur: 'argent', libelle: 'Argent' },
      { valeur: 'or', libelle: 'Or' },
    ]);
    expect(bornesDuNoeud(standing.noeud)).toEqual({ entier: true, min: 0, max: Number.MAX_SAFE_INTEGER });
  });

  it('écrit des ids ; refuse un Échelon en libellé et un Standing négatif', () => {
    expect(avecLaValeur(testDeSceneSchema, avecStatut, ['vsStatus', 'tier'], 'or')).toMatchObject({ ok: true, valeur: { vsStatus: { tier: 'or', standing: 2 } } });
    expect(avecLaValeur(testDeSceneSchema, avecStatut, ['vsStatus', 'standing'], 0)).toMatchObject({ ok: true, valeur: { vsStatus: { tier: 'argent', standing: 0 } } });
    expect(avecLaValeur(testDeSceneSchema, avecStatut, ['vsStatus', 'tier'], 'Or')).toMatchObject({ ok: false });
    expect(avecLaValeur(testDeSceneSchema, avecStatut, ['vsStatus', 'standing'], -1)).toMatchObject({ ok: false });
  });

  it('offre les deux avis par id et accepte un Test de scène préexistant sans avis', () => {
    const avis = champsOfferts(testDeSceneSchema, avecStatut).find((f) => f.key === 'avisSurLeStatut')!;
    expect(choixDuNoeud(avis.noeud)).toEqual([
      { valeur: 'favorable', libelle: 'Favorable' },
      { valeur: 'hostile', libelle: 'Hostile' },
    ]);
    expect(testDeSceneSchema.parse(avecStatut)).toEqual(avecStatut);
    expect(avecLaValeur(testDeSceneSchema, avecStatut, ['avisSurLeStatut'], 'hostile')).toEqual({
      ok: true,
      valeur: { ...avecStatut, avisSurLeStatut: 'hostile' },
    });
    expect(avecLaValeur(testDeSceneSchema, avecStatut, ['avisSurLeStatut'], 'Hostile')).toMatchObject({ ok: false });
  });

});
