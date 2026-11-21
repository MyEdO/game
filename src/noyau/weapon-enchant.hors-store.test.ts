import { describe, expect, it, onTestFinished } from 'vitest';
import { apparences, spells, talents, type SpellData } from '../data';
import type { EntreeVivante } from '../data/datasets';
import { setDataset } from '../data/overrides';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { t } from '../i18n';
import { ouvrirLeBanc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { emptyNarratif } from './monde/campaignNarratif';

const ARME = {
  id: 'arme-a-enchanter', type: 'trappings', label: 'Pertuisane/Fauchard', categorie: 'melee',
  subType: { id: 'armes-d-hast' }, hands: 2, availability: null, qualities: [], damage: { plusBF: true, flat: 4 },
  shape: { id: 'pertuisane' }, formChoices: ['pertuisane_lance', 'fauchard'],
  price: null, source: { book: 'aux-armes', page: 97 },
} satisfies NarratifBlock['objets'][number];

const TALENT_D_INVOCATION = 'invocation-de-test';

const MIRACLE: EntreeVivante<SpellData> = {
  id: 'priere-d-enchantement', type: 'spells', label: 'Prière d’enchantement', ecole: 'Invocation',
  subType: null, family: 'invocation', cn: null, range: { kind: 'self' }, target: { kind: 'self' },
  duration: { kind: 'rounds', value: 4 }, source: { book: 'livre-de-base', page: 224 },
  effects: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [
    { op: 'augmentWeapon', requiresWeapon: ['pertuisane_lance'], addQualities: ['percutante', 'magique'] },
  ] } },
};

function installerLesFixtures(): void {
  const apparencesInitiales = [...apparences];
  const sortsInitiaux = [...spells];
  const talentsInitiaux = [...talents];
  onTestFinished(() => {
    setDataset('apparences', apparencesInitiales);
    setDataset('spells', sortsInitiaux);
    setDataset('talents', talentsInitiaux);
  });
  const formes: string[] = [ARME.shape.id, ...ARME.formChoices];
  setDataset('apparences', [
    ...apparencesInitiales.filter((a) => !formes.includes(a.id)),
    ...formes.map((id) => ({
      id, type: 'apparences' as const, label: id,
      ...(id !== ARME.shape.id ? { formeFixeeALaNaissance: true as const } : {}),
    })),
    { id: 'pertuisane_lance_test', type: 'apparences', label: 'Variante de test', forme: { id: 'pertuisane_lance' } },
  ]);
  setDataset('spells', [...sortsInitiaux, MIRACLE]);
  setDataset('talents', [...talentsInitiaux, {
    id: TALENT_D_INVOCATION, type: 'talents', label: 'Invocation de test', max: 1, test: null,
    combat: { castingKind: 'invocation' }, source: { book: 'livre-de-base', page: 138 },
  }]);
}

describe('Invocation et forme d’arme fixée à la naissance', () => {
  /** LDB 42 l.139-147 ; AA 08 l.304,333 ; #4649 */
  it.each([
    ['pertuisane_lance', ['fauchard', 'pertuisane'], ['percutante', 'magique']],
    ['fauchard', ['pertuisane_lance'], []],
    ['pertuisane', ['pertuisane_lance'], []],
  ] as const)('%s garde sa forme et son enchantement après le geste de fiche', (forme, refus, qualites) => {
    const banc = ouvrirLeBanc({ cadence: 'manuel', desFixes: true });
    installerLesFixtures();
    const pretre = combattantDeTest({
      kind: 'heros', talents: [{ talentId: TALENT_D_INVOCATION, times: 1 }],
      skills: [{ id: 'priere', characteristic: 'sociabilite', advances: 30 }], spells: [MIRACLE.id],
      items: [], loadouts: [{ id: 'lo' }], activeLoadoutId: 'lo',
    });
    const { getState, setState } = banc;
    banc.setState({ party: [pretre], campaignNarratif: { ...emptyNarratif(), objets: [ARME] } });
    applyEffects(getState, setState, [{
      type: 'giveTrapping', trappingId: ARME.id, heroId: pretre.id,
      ...(forme === 'pertuisane' ? {} : { apparence: { id: forme } }),
    }]);
    const heros = () => getState().party[0];
    const uid = heros().items!.find((i) => i.trappingId === ARME.id)!.uid;
    const instance = () => heros().items!.find((i) => i.uid === uid)!;
    const armeTenue = () => heros().weapons.find((w) => w.uid === uid);
    getState().garnirLaPanoplie(pretre.id, 'lo', 'main', uid);
    expect(instance().shape?.id).toBe(forme);
    expect(armeTenue()?.shape?.id).toBe(forme);

    getState().incanterLeSort(pretre.id, MIRACLE.id, pretre.id);
    getState().jetLancer('incantation');
    getState().jetImposerLeResultat('incantation', 23);
    expect(getState().pendingCast?.result?.cast).toBe(true);
    getState().jetValider('incantation');
    banc.reprendreTout();

    expect(instance().enchants?.flatMap((e) => e.addQualities ?? []) ?? []).toEqual(qualites);
    expect(armeTenue()?.qualities.map((q) => q.id)).toEqual(qualites);
    const enchantements = structuredClone(instance().enchants);
    for (const apparence of refus) {
      const debut = getState().journal.length;
      getState().poserLApparence(uid, apparence);
      expect(instance().shape?.id).toBe(forme);
      expect(instance().enchants).toEqual(enchantements);
      expect(armeTenue()?.shape?.id).toBe(forme);
      expect(armeTenue()?.qualities.map((q) => q.id)).toEqual(qualites);
      expect(getState().journal.slice(debut)).toEqual([t('pf.apparenceNonAdmise', { item: ARME.label })]);
    }
    if (forme === 'pertuisane_lance') {
      getState().poserLApparence(uid, 'pertuisane_lance_test');
      expect(instance()).toMatchObject({ apparence: 'pertuisane_lance_test', shape: { id: forme }, enchants: enchantements });
      expect(armeTenue()).toMatchObject({ apparence: 'pertuisane_lance_test', shape: { id: forme } });
    }
  });
});
