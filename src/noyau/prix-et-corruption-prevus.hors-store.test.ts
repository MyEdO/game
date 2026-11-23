/**
 * LE PRIX ET LA CORRUPTION PRÉVUS (#4574 lot 3) : la fenêtre de Corruption et celle du Marchandage publient, tant
 * qu'elles attendent leur validation, les faits que leur application rendra — un seul résolveur au jet comme à
 * l'application (`faitDuGainDeCorruption`, `variationDuMarchandage`) ; le négoce du port pose son prix sur son étape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { seedBattleRng } from './battleRng';
import { applyEffects } from './combatEffects';
import { jetsEnVue, type ConsequenceEnVue } from './jetsEnVue';
import { createHero } from '../engine/character';
import { texteDuFait, type FaitDeCorruption } from '../engine/faits';
import { bargainBuyFactor } from '../engine/bargain';
import { sellGain } from './merchantFlow';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { emptyScene } from './monde/scene';
import { testValue } from '../engine/skills';
import { setRule } from '../engine/policy';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { acheterAuMarche } from './cargaison.testkit';
import { toBrass, toMoney } from '../engine/money';
import type { PortProfile } from '../engine/seaVoyage';
import type { Jeu } from './etat';
import type { Combatant, ItemInstance, SkillInstance } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => { vi.restoreAllMocks(); });
const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

/** Les conséquences que publient les rangées des jets en vue. */
const consequences = (): ConsequenceEnVue[] => jetsEnVue(get()).flatMap((j) => j.lignes.flatMap((l) => l.consequences ?? []));

describe('la fenêtre de Corruption prévoit le gain que sa validation applique (LDB 19 l.35)', () => {
  /** Sigmund, sans Talent tiré, ouvert sur une Exposition Mineure ratée (+1 Point). */
  function expositionRatee(sigmund: Partial<Combatant> = {}, battle?: Partial<NonNullable<Jeu['battle']>>): Combatant {
    const h = Object.assign(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sigmund', id: 'h-sigmund', seed: 101, talentsRolled: false }), sigmund);
    set({ party: [h], journal: [], pendingCorruption: null, corruptionQueue: [], battle: battle ? { combatants: [h], ...battle } as Jeu['battle'] : null });
    applyEffects(get, set, [{ type: 'corruptionExposure', level: 'mineure', nature: 'physique', heroId: h.id }]);
    const pc = get().pendingCorruption;
    if (pc) set({ pendingCorruption: { ...pc, roll: 99, target: 30, sl: -7, success: false } });
    return h;
  }

  /** La conséquence prévue est celle du fait que la validation applique : sa ligne au journal, son total sur la fiche. */
  function valideEtCompare(h: Combatant, prevu: FaitDeCorruption): void {
    const avant = h.corruption ?? 0;
    get().jetValider('corruption');
    expect(get().journal, 'la ligne du fait prévu est celle que l’application journalise').toContain(texteDuFait(prevu, 'Sigmund'));
    expect(h.corruption ?? 0).toBe('total' in prevu ? prevu.total : avant);
  }

  it('un gain : la valeur et le total que `gainCorruption` applique', () => {
    const h = expositionRatee();
    const prevu: FaitDeCorruption = { genre: 'corruption', cible: h.id, camp: 'groupe', valeur: 1, total: 1 };
    expect(consequences()).toEqual([{ genre: 'corruption', valeur: 1, qui: h.id, ton: 'echec', detail: { total: 1 } }]);
    valideEtCompare(h, prevu);
  });

  it('sous la Protection de Phâ (LDB 48 l.393) : le gain écarté, prévu comme appliqué', () => {
    const h = expositionRatee({ pos: { x: 5, y: 5 } }, { zones: [{ label: 'Protection de Phâ', tiles: [{ x: 5, y: 5 }], rounds: 3, noCorruption: true }] as never });
    expect(consequences()).toEqual([{ genre: 'corruption', valeur: 0, qui: h.id, ton: 'reussite', detail: { contre: 'protection' } }]);
    valideEtCompare(h, { genre: 'corruption', cible: h.id, camp: 'groupe', valeur: 0, contre: 'protection' });
  });

  it('une Exposition repoussée ne prévoit rien, et la validation n’applique rien', () => {
    const h = expositionRatee();
    set({ pendingCorruption: { ...get().pendingCorruption!, roll: 5, target: 30, sl: 2, success: true } });
    expect(consequences()).toEqual([]);
    get().jetValider('corruption');
    expect(h.corruption ?? 0).toBe(0);
  });

  it('qui ne reçoit pas la Corruption (LDB 19 l.29, l.70) : rien de prévu, rien d’appliqué', () => {
    const h = expositionRatee();
    const sansRegles = { ...h, kind: 'ennemi', followsCharacterRules: false } as Combatant;
    set({ party: [sansRegles] });
    expect(consequences()).toEqual([]);
    get().jetValider('corruption');
    expect(sansRegles.corruption ?? 0).toBe(0);
    expect(get().journal.filter((l) => l.includes('Corruption'))).toEqual([]);
  });
});

/** Meneur Négociateur à exactement 80 en Marchandage. */
function negociateur(): Combatant {
  const [h] = tousLesHerosDeScenario(idsDeTest);
  h.talents = [...h.talents.filter((t) => t.talentId !== 'negociateur'), { talentId: 'negociateur', times: 1 }];
  h.skills = h.skills.filter((s) => s.id !== 'marchandage');
  h.skills.push({ id: 'marchandage', advances: 0 } as SkillInstance);
  h.skills[h.skills.length - 1].advances = 80 - testValue(h, { skill: { id: 'marchandage' } });
  return h;
}

describe('la fenêtre du Marchandage prévoit le prix que sa validation fige (LDB 59 l.43, l.54 ; LDB 10 l.818)', () => {
  beforeEach(() => setRule('test-bandes-auto', 'off'));

  /** Ouvre l'armurier ambulant (Marchandage 45) et marchande `mode`, d100 imposés (joueur, marchand). */
  function marchander(mode: 'achat' | 'vente', joueur: number, marchand: number): Combatant {
    const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
    sc.entities.push({ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 0, y: 0 }, merchant: { archetype: { id: 'armurier' }, settlement: 'ville' } } as never);
    const h = negociateur();
    set({ party: [h], scene: sc, merchant: null, merchantStocks: {}, journal: [], pendingCascade: null, pendingBargain: null } as never);
    get().ouvrirLeMarchand('pnj');
    get().fenetreChoisir('marchand', 'marchander', mode);
    imposerLesD100(joueur, marchand);
    get().jetLancer('marchandage');
    return h;
  }

  it('achat gagné : la remise prévue est le facteur que les prix du marchand lisent', () => {
    const h = marchander('achat', 70, 40);
    expect(consequences()).toEqual([{ genre: 'prix', valeur: -20, qui: h.id, ton: 'reussite', detail: { sens: 'achat' } }]);
    get().jetValider('marchandage');
    expect(bargainBuyFactor(get().merchant!.bargainBuy!)).toBe((100 - 20) / 100);
  });

  /** Le gain de vente que le marchand affiche (`sellGain`) pour un objet pré-valué à 1 CO, avant le Marchandage de vente
   *  `joueur` contre `marchand` puis après sa validation, et le prix que sa fenêtre prévoit entre les deux. */
  function venteMarchandee(joueur: number, marchand: number): { avant: number; apres: number; prevu: ConsequenceEnVue[] } {
    const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
    sc.entities.push({ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 0, y: 0 }, merchant: { archetype: { id: 'armurier' }, settlement: 'ville' } } as never);
    const h = negociateur();
    const objet = { uid: 'piece-pre-valuee', label: 'Pièce pré-valuée', price: { gold: 1, silver: 0, brass: 0 } } as ItemInstance;
    h.items = [...(h.items ?? []), objet];
    set({ party: [h], scene: sc, merchant: null, merchantStocks: {}, journal: [], pendingCascade: null, pendingBargain: null } as never);
    get().ouvrirLeMarchand('pnj');
    const gain = () => toBrass(sellGain(objet, get().merchant!, objetDuNarratif(get().campaignNarratif)));
    const avant = gain();
    get().fenetreChoisir('marchand', 'marchander', 'vente');
    imposerLesD100(joueur, marchand);
    get().jetLancer('marchandage');
    const prevu = consequences();
    get().jetValider('marchandage');
    return { avant, apres: gain(), prevu };
  }

  it('vente gagnée de 6 DR par un Négociateur : le gain affiché varie du pourcent prévu', () => {
    const { avant, apres, prevu } = venteMarchandee(5, 95);
    expect(prevu).toEqual([{ genre: 'prix', valeur: 140, qui: get().party[0].id, ton: 'reussite', detail: { sens: 'vente' } }]);
    expect(apres / avant - 1).toBe(Number(prevu[0].valeur) / 100);
  });

  it('vente perdue : le gain affiché ne bouge pas, et rien n’est prévu', () => {
    const { avant, apres, prevu } = venteMarchandee(99, 5);
    expect(apres).toBe(avant);
    expect(prevu).toEqual([]);
  });

  it('achat perdu : aucune variation, aucune conséquence, le prix plein', () => {
    marchander('achat', 99, 5);
    expect(consequences()).toEqual([]);
    get().jetValider('marchandage');
    expect(bargainBuyFactor(get().merchant!.bargainBuy!)).toBe(1);
  });
});

describe('le négoce du port pose sur son étape le prix qu’il applique (MDG 15 l.335 ; LDB 59 l.43)', () => {
  const PORT: PortProfile = { taille: 4, richesse: 4, production: [] } as PortProfile;

  it('achat : le fait de prix est la variation que le lot payé porte', () => {
    seedBattleRng(1);
    const [meneur] = tousLesHerosDeScenario(idsDeTest);
    set({
      party: [meneur], battle: null, journal: [], pendingCascade: null,
      scene: { id: 'scene-P', label: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] },
      worldMap: { id: 'm', nom: 'x', places: [{ id: 'P', label: 'Port', pos: { x: 0, y: 0 }, scene: { id: 'scene-P' }, port: PORT }], routes: [] },
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [], lastVoyageMilles: 0 },
      port: { placeId: 'P', label: 'Port', port: structuredClone(PORT), offers: [{ cargoId: 'bois-mer', label: 'Bois', enc: 40, basePrice: 10, surplus: false }] },
    } as never);
    creditBourse(get, set, meneur.id, { gold: 5000, silver: 0, brass: 0 });
    expect(acheterAuMarche(get, 'port', 'vessel', 'bois-mer', 20)).toBeNull();
    const etape = get().pendingCascade!.participants[0];
    expect(etape.kind).toBe('port-achat-marchandage');
    const avant = toBrass(partyMoneyTotal(get));
    imposerLesD100(1, 100); // le meneur, puis le marchand à l'application
    get().jetLancer('cascade');
    get().jetValider('cascade');
    const jouee = get().pendingCascade?.participants.find((s) => s.id === etape.id) ?? etape;
    const prix = (jouee.faits ?? []).filter((f) => f.genre === 'prix');
    expect(prix).toHaveLength(1);
    const [fait] = prix;
    expect(fait).toMatchObject({ genre: 'prix', cible: meneur.id, camp: 'groupe', sens: 'achat' });
    expect(fait.valeur, 'le meneur l’emporte : une remise').toBeLessThan(0);
    expect(avant - toBrass(partyMoneyTotal(get)), 'le lot payé au prix que le fait varie')
      .toBe(toBrass(toMoney({ gold: Math.round(20 * 10 * (1 + fait.valeur / 100)) })));
  });
});
