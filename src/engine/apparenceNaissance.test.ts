import { afterEach, describe, expect, it } from 'vitest';
import { itemFromTrappingRef, itemFromTrappingById, itemFromGive, contexteDeNaissanceDObjet, recomputeLoadout } from './items';
import { apparencesCandidates } from './items';
import { findTrappingById } from '../data';
import { objetDuNarratif } from '../noyau/monde/resolveursDuNarratif';
import { emptyNarratif } from '../noyau/monde/campaignNarratif';
import { applyOps } from './ops';
import { makeRNG } from './dice';
import { giveTrappingSchema } from '../data/schemas/defs-scenes/effets';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { herosDeNaissance, poserVariantesDeNaissance, restaurerApparencesDeNaissance, varianteDeNaissance } from '../apparenceNaissance.testkit';

afterEach(restaurerApparencesDeNaissance);

describe('apparence décidée à la naissance', () => {
  it('la naissance et les candidats lisent le même objet de campagne absent du catalogue', () => {
    poserVariantesDeNaissance(varianteDeNaissance({ forme: { id: 'hache' } }));
    const objet = { ...findTrappingById('arme-simple')!, id: 'hache-de-campagne', shape: { id: 'hache' }, formChoices: ['hache'] };
    const resolve = objetDuNarratif({ ...emptyNarratif(), objets: [objet] });
    const instance = itemFromGive({ trappingId: objet.id }, undefined, resolve, { espece: 'nains' });
    expect(instance.apparence).toBe('naissance-naine');
    expect(apparencesCandidates(instance)).toEqual(['naissance-naine', 'hache']);
  });

  it('une apparence d’auteur de campagne est jugée sur sa définition de campagne', () => {
    const objet = { ...findTrappingById('arme-simple')!, id: 'hache-de-campagne', shape: { id: 'hache' }, formChoices: ['hache'] };
    const resolve = objetDuNarratif({ ...emptyNarratif(), objets: [objet] });
    expect(itemFromGive({ trappingId: objet.id, apparence: { id: 'hache_naine' } }, undefined, resolve).apparence).toBe('hache_naine');
  });
  it.each([
    { patch: { especes: ['nains'] }, contexte: { espece: 'nains' } },
    { patch: { especes: undefined, classes: ['guerriers'] }, contexte: { classe: 'guerriers' } },
  ])('correspondance par espèce ou classe : %j', ({ patch, contexte }) => {
    poserVariantesDeNaissance(varianteDeNaissance(patch));
    expect(itemFromTrappingRef({ id: 'arme-simple' }, undefined, contexte)?.apparence).toBe('naissance-naine');
  });

  it.each(['raffine', 'laid'])('les qualités finales de la ref et du give sont prises en compte : %s', (id) => {
    poserVariantesDeNaissance(varianteDeNaissance({ especes: undefined, qualites: [id] }));
    expect(itemFromTrappingRef({ id: 'arme-simple', qualities: [{ id }] }, undefined, {})?.apparence).toBe('naissance-naine');
    expect(itemFromGive({ trappingId: 'arme-simple', qualities: [id] }, undefined, undefined, {}).apparence).toBe('naissance-naine');
  });

  it('sans contexte ou sans correspondance, aucune clé ne naît, quel que soit le constructeur', () => {
    poserVariantesDeNaissance(varianteDeNaissance());
    for (const objet of [
      itemFromTrappingById('arme-simple'),
      itemFromTrappingRef({ id: 'arme-simple' }),
      itemFromGive({ trappingId: 'arme-simple' }),
      itemFromTrappingById('arme-simple', undefined, { espece: 'humains-reiklander' }),
    ]) expect(objet).not.toHaveProperty('apparence');
  });

  it('les listes sont alternatives sur un axe, et les axes renseignés sont cumulatifs', () => {
    poserVariantesDeNaissance(varianteDeNaissance({ especes: ['humains-reiklander', 'nains'], classes: ['guerriers'] }));
    expect(itemFromTrappingById('arme-simple', undefined, { espece: 'nains', classe: 'guerriers' })?.apparence).toBe('naissance-naine');
    expect(itemFromTrappingById('arme-simple', undefined, { espece: 'nains', classe: 'courtisans' })).not.toHaveProperty('apparence');
  });

  it('la spécificité prime, puis l’id tranche sans dépendre de l’ordre du catalogue', () => {
    const simple = varianteDeNaissance({ id: 'a-simple' });
    const z = varianteDeNaissance({ id: 'z-specialisee', classes: ['guerriers'] });
    const a = varianteDeNaissance({ id: 'a-specialisee', classes: ['guerriers'] });
    for (const variantes of [[simple, z, a], [a, z, simple]]) {
      poserVariantesDeNaissance(...variantes);
      expect(itemFromTrappingById('arme-simple', undefined, { espece: 'nains', classe: 'guerriers' })?.apparence).toBe('a-specialisee');
    }
  });

  it('la naissance ne change pas la forme de départ et ne choisit pas une variante sans étiquette', () => {
    poserVariantesDeNaissance(varianteDeNaissance({ forme: { id: 'hache' } }), varianteDeNaissance({ id: 'sans-etiquette', especes: undefined }));
    expect(itemFromTrappingById('arme-simple', undefined, { espece: 'nains' })).not.toHaveProperty('apparence');
  });

  it('une décision d’auteur prime le contexte, même en son absence', () => {
    poserVariantesDeNaissance(varianteDeNaissance(), varianteDeNaissance({ id: 'auteur', especes: ['humains-reiklander'] }));
    for (const contexte of [undefined, { espece: 'nains' }]) {
      const objet = itemFromGive({ trappingId: 'arme-simple', apparence: { id: 'auteur' } }, undefined, undefined, contexte);
      expect(objet.apparence).toBe('auteur');
    }
  });

  it('un appel direct refuse aussi une apparence étrangère ou un custom sans identité', () => {
    expect(() => itemFromGive({ trappingId: 'arme-simple', apparence: { id: 'cape' } })).toThrow(/arme-simple.*cape/);
    expect(() => itemFromGive({ custom: 'Souvenir', apparence: { id: 'cape' } })).toThrow(/custom.*cape/);
  });

  it('les refs d’auteur sont validées au parse pour l’effet et l’op', () => {
    poserVariantesDeNaissance(varianteDeNaissance());
    for (const [schema, payload] of [
      [giveTrappingSchema, { type: 'giveTrapping', trappingId: 'arme-simple' }],
      [gameOpSchema, { op: 'giveTrapping', trappingId: 'arme-simple' }],
    ] as const) {
      expect(schema.safeParse({ ...payload, apparence: { id: 'naissance-naine' } }).success).toBe(true);
      const refus = schema.safeParse({ ...payload, apparence: { id: 'inconnue-naissance' } });
      expect(refus.success).toBe(false);
      if (!refus.success) expect(refus.error.message).toContain('inconnue-naissance');
    }
  });

  it('createHero transmet le contexte aux possessions de départ', () => {
    poserVariantesDeNaissance(varianteDeNaissance({ especes: undefined, classes: ['guerriers'] }));
    const hero = herosDeNaissance();
    const objet = hero.items?.find((i) => i.trappingId === 'arme-simple');
    expect(objet).toBeDefined();
    expect(objet?.apparence).toBe('naissance-naine');
  });

  it('l’op donne à son destinataire puis conserve la décision lors du re-dérivage', () => {
    poserVariantesDeNaissance(varianteDeNaissance());
    const hero = herosDeNaissance();
    hero.items = [];
    applyOps(hero, [{ op: 'giveTrapping', trappingId: 'arme-simple' }], { rng: makeRNG(1) });
    const objet = hero.items[0];
    expect(objet.apparence).toBe('naissance-naine');
    hero.species = 'humains-reiklander';
    hero.career = 'noble';
    recomputeLoadout(hero);
    expect(objet.apparence).toBe('naissance-naine');
    expect(contexteDeNaissanceDObjet(hero)).toEqual({ espece: 'humains-reiklander', classe: 'courtisans' });
  });
});
