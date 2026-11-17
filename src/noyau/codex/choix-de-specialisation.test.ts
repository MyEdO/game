/**
 * La spécialisation d'une entrée FERMÉE se choisit dans son catalogue (#4056, #841) : la feuille `specFermeeDe` de la
 * menace d'un Test, et le `spec` d'une référence à spécialisation au point de son `id` (`noeudDuChampAuPoint`), offrent
 * `catalogueSpecs` en choix (`choixDuNoeud`) et refusent un texte hors de lui ; une entrée OUVERTE reste un texte.
 */
import { describe, expect, it } from 'vitest';
import { menaceSchema, testDeSceneSchema } from '../../data/schemas/grammaire/mecanique';
import { catalogueSpecs, entreeOuverte } from '../../data/schemas/grammaire/ref';
import { avecLaValeur } from '../edition/formulaire';
import { champsOfferts, choixDuNoeud } from './editFields';

const donnee = { skill: { id: 'art' }, stake: { authored: 'x' } };

describe('choix des spécialisations fermées', () => {
  it('la menace offre le catalogue de Résistance, chaque choix admis, et refuse un texte libre', () => {
    const choix = choixDuNoeud(menaceSchema)!.map((o) => o.valeur);
    expect(choix).toEqual(catalogueSpecs('talent', 'resistance'));
    for (const v of choix) expect(avecLaValeur(testDeSceneSchema, donnee, ['menace'], v)).toMatchObject({ ok: true });
    expect(avecLaValeur(testDeSceneSchema, donnee, ['menace'], 'texte joué')).toEqual({ ok: false, refus: 'horsSorte' });
  });

  it('le spec d’une compétence fermée (art) offre son catalogue, au point de son id', () => {
    expect(entreeOuverte('skill', 'art')).toBe(false);
    const skill = champsOfferts(testDeSceneSchema, donnee).find((f) => f.key === 'skill')!;
    const spec = champsOfferts(skill.noeud, donnee.skill).find((f) => f.key === 'spec')!;
    expect(choixDuNoeud(spec.noeud)!.map((o) => o.valeur)).toEqual(catalogueSpecs('skill', 'art'));
    const premiere = catalogueSpecs('skill', 'art')[0];
    expect(avecLaValeur(testDeSceneSchema, donnee, ['skill', 'spec'], premiere)).toMatchObject({ ok: true });
    expect(avecLaValeur(testDeSceneSchema, donnee, ['skill', 'spec'], 'texte joué')).toEqual({ ok: false, refus: 'horsSorte' });
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
