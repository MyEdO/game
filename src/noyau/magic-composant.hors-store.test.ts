/**
 * Composants d'incantation, règle courante (LDB 46 l.107-113 ; arbitrage #4132 du 2026-11-16) : objet
 * d'inventaire lié à un Sort, consumé au point d'incantation ; achat (LDB 46 l.113, LDB 49 l.5) ; liaison
 * du joueur et du PNJ ; perte de Blessures du lanceur ogre (ADE II 02 l.726).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { avanceEtapeCascade } from './cascade.testkit';
import { applyCast, applyFocusInterruption, applyMiscast, useSpellComponent } from './combatFlow';
import { refusDeDesignation } from './partyFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { buildEncounter } from './monde/encounterAuthoring';
import { creatureToCombatant, spawnEnemy } from './monde/spawn';
import { findCreatureById, findSpellById } from '../data';
import { pretire } from '../data/pregens';
import { objetDeTest } from '../engine/objetsDeTest.testkit';
import { itemCapability } from '../engine/capabilities';
import { withBourseMoney, bourseOf } from '../engine/bourse';
import { toBrass, toMoney } from '../engine/money';
import { prendUnComposant } from '../engine/magic';
import type { CastResult } from '../engine/magic';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  banc.getState().ensemencerLeTirage(2);
});

const SPELL = 'mur-de-feu'; // Sort de Domaine (Feu), NI 6

const composants = (c: Combatant) => (c.items ?? []).filter((it) => itemCapability(it, 'isSpellComponent'));
const lie = (sortLie: string, uid = `comp-${sortLie}`) => objetDeTest('composant-d-incantation', { uid, sortLie });

function mage(): Combatant {
  return createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
}

function mageInBattle(): Combatant {
  banc.setState({ party: [mage()] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  return banc.getState().battle!.combatants.find((c) => c.kind === 'heros')!;
}

const reussite: CastResult = { cast: true, roll: 20, target: 60, sl: 4, isCritical: false, isFumble: false, log: 'jet réussi' };

describe('composant d’incantation au point d’incantation (LDB 46 l.111)', () => {
  it('Imparfaite Majeure → Mineure, le composant est consumé', () => {
    const hero = mageInBattle();
    hero.items = [...(hero.items ?? []), lie(SPELL)];
    banc.setState({ pendingCascade: null });
    const used = useSpellComponent(hero, SPELL, []);
    expect(used).toBe(true);
    expect(composants(hero)).toEqual([]);
    const out = applyMiscast(banc.getState, banc.setState, hero, 'majeure', { componentDowngrade: used });
    expect(out.some((l) => /Majeure → Mineure/.test(l))).toBe(true);
    expect(banc.getState().pendingCascade!.participants[0].table!.tableId).toBe('miscast-mineure');
    avanceEtapeCascade(banc.getState);
    expect(banc.getState().pendingCascade?.participants.find((s) => s.kind === 'incantationImparfaite')?.label).toBe('Imparfaite');
  });

  it('Imparfaite Mineure annulée : aucune table ouverte', () => {
    const hero = mageInBattle();
    hero.items = [...(hero.items ?? []), lie(SPELL)];
    banc.setState({ pendingCascade: null });
    const used = useSpellComponent(hero, SPELL, []);
    const out = applyMiscast(banc.getState, banc.setState, hero, 'mineure', { componentDowngrade: used });
    expect(out.some((l) => /aucun effet/.test(l))).toBe(true);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('consumé à l’incantation même sans Imparfaite (applyCast)', () => {
    const hero = mage();
    hero.items = [...(hero.items ?? []), lie('armure-aethyrique')];
    banc.setState({ party: [hero] });
    applyCast(banc.getState, banc.setState, hero, [hero], findSpellById('armure-aethyrique')!, reussite, false, false);
    expect(composants(hero)).toEqual([]);
  });

  it('le composant d’un autre Sort reste intact et ne dégrade rien', () => {
    const hero = mageInBattle();
    hero.items = [...(hero.items ?? []), lie('un-autre-sort')];
    banc.setState({ pendingCascade: null });
    const used = useSpellComponent(hero, SPELL, []);
    expect(used).toBe(false);
    expect(composants(hero).map((it) => it.sortLie)).toEqual(['un-autre-sort']);
    const out = applyMiscast(banc.getState, banc.setState, hero, 'mineure', { componentDowngrade: used });
    expect(out.some((l) => /aucun effet/.test(l))).toBe(false);
  });

  it('un composant à lier n’est jamais consumé', () => {
    const hero = mage();
    hero.items = [...(hero.items ?? []), objetDeTest('composant-d-incantation', { uid: 'libre' })];
    expect(useSpellComponent(hero, SPELL, [])).toBe(false);
    expect(composants(hero).map((it) => it.uid)).toEqual(['libre']);
  });

  it('tout lanceur : une créature du bestiaire consume son composant lié', () => {
    const orc = creatureToCombatant(findCreatureById('orc')!, 'e1', { x: 0, y: 0 });
    orc.items = [...(orc.items ?? []), lie(SPELL)];
    expect(useSpellComponent(orc, SPELL, [])).toBe(true);
    expect(composants(orc)).toEqual([]);
  });

  it('la Colère des dieux n’est jamais dégradée', () => {
    const hero = mageInBattle();
    const out = applyMiscast(banc.getState, banc.setState, hero, 'colere', { componentDowngrade: true });
    expect(out.some((l) => /Majeure → Mineure|aucun effet/.test(l))).toBe(false);
  });
});

describe('achat d’un composant (LDB 46 l.113 ; LDB 49 l.5)', () => {
  function acheter(spellId: string): { avant: Combatant; apres: Combatant } {
    const avant = { ...withBourseMoney(mage(), toMoney({ gold: 100 }), idsDeTest), spells: [spellId] };
    banc.setState({ party: [avant] });
    banc.getState().acheterLaComposante(avant.id, spellId);
    return { avant, apres: banc.getState().party[0] };
  }

  it('crée un objet lié au Sort et débite le NI en pistoles d’argent', () => {
    const { avant, apres } = acheter(SPELL);
    expect(composants(apres).map((it) => it.sortLie)).toEqual([SPELL]);
    expect(toBrass(bourseOf(avant)) - toBrass(bourseOf(apres))).toBe(toBrass(toMoney({ silver: 6 })));
  });

  it('Sorcellerie : le NI en sous de cuivre', () => {
    const { avant, apres } = acheter('horreur-obsedante'); // NI 8
    expect(composants(apres).map((it) => it.sortLie)).toEqual(['horreur-obsedante']);
    expect(toBrass(bourseOf(avant)) - toBrass(bourseOf(apres))).toBe(8);
  });
});

describe('liaison par le joueur (arbitrage #4132 « Choisi à l’acquisition »)', () => {
  const erina = () => pretire(idsDeTest, 'erina-eberhauer');

  it('Erina reçoit ses composants à lier, et en lie un à un de ses Sorts', () => {
    const h = erina();
    expect(composants(h).length).toBeGreaterThan(0);
    expect(composants(h).every((it) => !it.sortLie)).toBe(true);
    banc.setState({ party: [h] });
    const uid = composants(h)[0].uid;
    banc.getState().designerLeComposant(uid, 'envol');
    expect(composants(banc.getState().party[0]).find((it) => it.uid === uid)?.sortLie).toBe('envol');
  });

  it('refus : Sort inconnu, Sort sans composant, objet déjà lié', () => {
    const h = erina();
    const [a] = composants(h);
    expect(refusDeDesignation(h, a.uid, SPELL)).toBe(t('pf.spellUnknown', { name: h.label, spell: findSpellById(SPELL)!.label }));
    expect(refusDeDesignation(h, a.uid, 'lumiere')).toBe(t('pf.componentArcaneOnly', { spell: findSpellById('lumiere')!.label }));
    a.sortLie = 'envol';
    expect(refusDeDesignation(h, a.uid, 'chute')).toBe(t('pf.componentAlreadyBound', { item: a.label, spell: findSpellById('envol')!.label }));
  });
});

describe('liaison d’un PNJ au spawn : ses Sorts connus dans l’ordre, en cycle', () => {
  const sortsAComposant = (c: Combatant) => (c.spells ?? []).filter((id) => prendUnComposant(findSpellById(id)!));

  it('Boucher ogre (Niveau 3) : ses 10 composants de dotation liés en cycle', () => {
    const parcours = { carrieres: { 'boucher-ogre': 3 }, talentsDeCarriere: { 'boucher-ogre': [{ id: 'magie-des-arcanes', spec: 'gueule' }] } };
    const c = spawnEnemy({ ref: 'ogre', parcours }, 'e1', { x: 0, y: 0 }, { spells: ['goutemort', 'bouf-crane', 'trollboyaux'] });
    const sorts = sortsAComposant(c);
    expect(sorts.length, `sorts connus : ${c.spells?.join(', ')}`).toBeGreaterThan(0);
    expect(composants(c).map((it) => it.sortLie)).toEqual(Array.from({ length: 10 }, (_, i) => sorts[i % sorts.length]));
  });

  it('Middenheim 02 l.2566-70 : Kanker Flett apparaît avec ses composants et son équipement de fiche', () => {
    const { entities, encounter } = buildEncounter({
      id: 'kanker', enemies: [{ creature: { id: 'kanker-flett' }, pos: { x: 16, y: 11 } }],
    });
    const scene = testScene();
    banc.setState({ party: [mage()] });
    banc.getState().lancerLaScene({ ...scene, entities: [...scene.entities.filter((e) => e.kind === 'heroStart'), ...entities], encounters: [encounter] });
    banc.getState().lancerLeCombat(encounter.id);
    const c = banc.getState().battle!.combatants.find((personnage) => personnage.id === entities[0].id)!;
    expect(composants(c).map((it) => it.sortLie)).toEqual([
      'flot-de-corruption', 'malediction-de-douleur-paralysante', 'menace-rampante', 'infecte-benediction',
    ]);
    expect(c.items?.filter((it) => it.trappingId === 'bequille')).toHaveLength(2);
    expect(new Set(c.items?.map((it) => it.uid)).size).toBe(7);
    const epee = c.items?.find((it) => it.trappingId === 'arme-simple');
    expect(epee).toBeDefined();
    expect(c.weapons).toEqual([expect.objectContaining({ uid: epee?.uid, damage: expect.objectContaining({ flat: 7 }) })]);
  });
});

describe('lanceur ogre sans ingrédient (ADE II 02 l.726)', () => {
  function ogre(...items: ReturnType<typeof objetDeTest>[]): Combatant {
    const o = createHero({ idNeuf: idsDeTest, speciesId: 'ogres', careerId: 'boucher-ogre', label: 'Ogre', seed: 5 });
    o.items = [...(o.items ?? []).filter((it) => !itemCapability(it, 'isRations') && !itemCapability(it, 'isSpellComponent')), ...items];
    banc.setState({ party: [o] });
    return o;
  }
  const perte = (c: Combatant, spellId: string): number => {
    const avant = c.wounds.current;
    applyCast(banc.getState, banc.setState, c, [c], findSpellById(spellId)!, reussite, false, false);
    return avant - c.wounds.current;
  };

  it('perd 1 Blessure par NI du Sort lancé', () => {
    expect(perte(ogre(), 'armure-aethyrique')).toBe(2);
  });

  it('le composant lié au Sort l’en dispense', () => {
    expect(perte(ogre(lie('armure-aethyrique')), 'armure-aethyrique')).toBe(0);
  });

  it('le composant d’un autre Sort ne l’en dispense pas', () => {
    expect(perte(ogre(lie(SPELL)), 'armure-aethyrique')).toBe(2);
  });

  it('des Vivres sur lui l’en dispensent (arbitrage #4132 « la viande ordinaire suffit »)', () => {
    expect(perte(ogre(objetDeTest('ration')), 'armure-aethyrique')).toBe(0);
  });

  it('un lanceur non ogre ne perd rien', () => {
    const m = mage();
    banc.setState({ party: [m] });
    expect(perte(m, 'armure-aethyrique')).toBe(0);
  });

  it('la Magie mineure ne coûte rien', () => {
    expect(perte(ogre(), 'lumiere')).toBe(0);
  });

  it('une Focalisation ne coûte rien', () => {
    const o = ogre();
    o.focus = { spell: 'armure-aethyrique', dr: 2 };
    const avant = o.wounds.current;
    applyFocusInterruption(banc.getState, banc.setState, o);
    expect(o.wounds.current).toBe(avant);
  });
});
