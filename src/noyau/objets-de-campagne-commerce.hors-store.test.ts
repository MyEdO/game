/** #2967 ; LDB 59 l.54, l.60, l.66 ; LDB 62 l.135 ; LDB 73 l.23 */
import { describe, expect, it } from 'vitest';
import { findTrappingById } from '../data';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { formatMoney, fromBrass, toBrass } from '../engine/money';
import { t } from '../i18n';
import { objetDeCampagne } from '../scenes/fixtures/objetDeCampagne.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { applyEffects, applyEffectsLoot } from './combatEffects';
import { troquer } from './marchand.testkit';
import { marchandEnVue } from './marchandEnVue';
import { emptyNarratif } from './monde/campaignNarratif';
import { emptyScene } from './monde/scene';

const bien = objetDeCampagne({ id: 'lame-du-relais', label: 'Lame du relais', availability: 'commune', price: fromBrass(480) });
const relique = objetDeCampagne({ ...bien, id: 'relique-du-relais', label: 'Relique du relais', availability: null });
const prothese = objetDeCampagne({ ...findTrappingById('fausse-jambe')!, id: 'jambe-du-relais', label: 'Jambe du relais' });

function jouer(...objets: (typeof bien)[]) {
  const banc = ouvrirLeBanc();
  const hero = combattantDeTest({
    id: 'h', label: 'H', kind: 'heros', items: [], xp: 300,
    skills: [{ id: 'evaluation', characteristic: 'intelligence', advances: 10 }],
  });
  const scene = emptyScene('relais', 5, 5);
  scene.entities.push(
    { id: 'depart', kind: 'heroStart', pos: { x: 1, y: 1 } },
    { id: 'artisan', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 2, y: 1 }, merchant: { archetype: { id: 'armurier' }, settlement: 'ville', resaleRate: 0.5 } },
  );
  const { getState: get, setState: set } = banc;
  set({ party: [withBourseMoney(hero, fromBrass(960), idsDeTest)] });
  get().chargerLeProjet({ scenes: [scene], entryId: scene.id, narratif: { ...emptyNarratif(), objets }, projet: null });
  applyEffects(get, set, objets.map(({ id }) => ({ type: 'giveTrapping', objet: { id }, heroId: hero.id })));
  const item = (id: string) => get().party[0].items!.find((it) => it.trappingId === id)!;
  const bourse = () => toBrass(bourseOf(get().party[0]));
  const ouvrir = () => {
    set({ merchantStocks: { artisan: { stock: [{ id: 'dague', qty: 3 }], rolledAt: get().gameTime } } });
    get().jouerAction('artisan', 'commercer');
  };
  return { get, set, hero, item, bourse, ouvrir };
}

describe('lectures marchandes des possessions de campagne (#2967)', () => {
  it('la vente annonce et crédite le prix de la fiche locale ; une relique hors commerce est refusée', () => {
    const { get, hero, item, bourse, ouvrir } = jouer(bien, relique);
    ouvrir();
    const vente = marchandEnVue(get())!.vente.heros.find(({ id }) => id === hero.id)!.possessions;
    expect(vente).toContainEqual(expect.objectContaining({ uid: item(bien.id).uid, gain: formatMoney(fromBrass(120)), refus: null }));
    expect(vente.find(({ uid }) => uid === item(relique.id).uid)?.refus).toContain(relique.label);
    get().fenetreChoisir('marchand', 'ajouterALaVente', item(relique.id).uid);
    expect(get().merchant!.sellCart ?? []).toHaveLength(0);
    const avant = bourse();
    get().fenetreChoisir('marchand', 'ajouterALaVente', item(bien.id).uid);
    get().fenetreChoisir('marchand', 'vendre', true);
    expect(bourse() - avant).toBe(120);
    expect(item(bien.id)).toBeUndefined();
    expect(item(relique.id)).toBeDefined();
  });

  it('le troc cède une possession locale et reçoit la dague du stock sans échange d’argent', () => {
    const { get, hero, item, bourse, ouvrir } = jouer(bien);
    ouvrir();
    const avant = bourse();
    troquer(get, { giveHeroId: hero.id, giveTrappingId: bien.id, getStockId: 'dague' });
    expect(item(bien.id)).toBeUndefined();
    expect(item('dague')?.label).toBe(findTrappingById('dague')!.label);
    expect(get().merchant!.stock).toEqual([{ id: 'dague', qty: 2 }]);
    expect(bourse()).toBe(avant);
    expect(get().journal.slice(-1)[0]).toContain(bien.label);
  });

  it('l’évaluation d’une possession locale annonce le prix et la disponibilité de sa fiche', () => {
    const { get, item } = jouer(bien);
    get().evaluerLObjet(item(bien.id).uid);
    expect(get().pendingAppraise).toMatchObject({ itemUid: item(bien.id).uid, truePriceBrass: 480, availability: 'commune' });
  });

  it('le butin de campagne est évalué avec la même fiche avant son attribution', () => {
    const { get, set } = jouer(bien);
    applyEffectsLoot(get, set, [{ type: 'giveTrapping', objet: { id: bien.id }, identified: false }], 'Coffre du relais');
    const { uid } = get().pendingLoot!.gear![0];
    get().evaluerLObjet(uid);
    expect(get().pendingAppraise).toMatchObject({ gear: { scope: 'butin', uid }, truePriceBrass: 480, availability: 'commune' });
  });

  it('le geste de réparation débite le prix de la fiche de campagne', () => {
    const { get, set, item, bourse, ouvrir } = jouer(bien);
    const abime = item(bien.id);
    set(({ party }) => ({ party: party.map((h) => ({ ...h, items: h.items?.map((it) => it.uid === abime.uid ? { ...it, damageTaken: 1 } : it) })) }));
    ouvrir();
    const avant = bourse();
    get().fenetreChoisir('marchand', 'reparer', abime.uid);
    expect(bourse()).toBe(avant - 48);
    expect(item(bien.id).damageTaken).toBe(0);
  });
});

it('une prothèse du narratif acquiert ses paliers et annonce son entraînement complet', () => {
  const { get, hero, item } = jouer(prothese);
  const { uid } = item(prothese.id);
  get().entrainerLaProthese(uid);
  expect(get().party[0].xp).toBe(300);
  expect(get().journal.slice(-1)[0]).toBe(t('pf.prosthesisNotTrainable', { name: hero.label }));
  get().equiperLObjet(uid);
  get().entrainerLaProthese(uid);
  expect(get().party[0].xp).toBe(200);
  expect(item(prothese.id).prosthesisMoveTrained).toBe(true);
  get().entrainerLaProthese(uid);
  expect(get().party[0].xp).toBe(0);
  expect(item(prothese.id).prosthesisTrained).toBe(true);
  get().entrainerLaProthese(uid);
  expect(get().party[0].xp).toBe(0);
  expect(get().journal.slice(-1)[0]).toBe(t('pf.prosthesisTrained', { name: hero.label, item: prothese.label }));
});
