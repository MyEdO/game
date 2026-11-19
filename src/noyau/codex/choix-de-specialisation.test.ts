/**
 * La spécialisation d'une entrée FERMÉE se choisit dans son catalogue (#4056, #841) : la feuille `specFermeeDe` de la
 * menace d'un Test, et le `spec` d'une référence à spécialisation au point de son `id` (`noeudDuChampAuPoint`), offrent
 * `catalogueSpecs` en choix (`choixDuNoeud`) et refusent un texte hors de lui, la règle de la feuille dite ; une entrée OUVERTE reste un texte.
 * Le Statut d'interlocuteur (`vsStatus`, `statutSchema`) se décompose de même : un choix d'Échelon et une saisie
 * de Standing entier de 0, écrits en ids. LDB 08 l.9, l.101
 */
import { describe, expect, it } from 'vitest';
import { menaceSchema, testDeSceneSchema } from '../../data/schemas/grammaire/mecanique';
import { catalogueSpecs, entreeOuverte } from '../../data/schemas/grammaire/ref';
import { avecLaValeur } from '../edition/formulaire';
import { champsOfferts, choixDuNoeud, bornesDuNoeud } from './editFields';

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
});
