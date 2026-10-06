import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { presetPnjById, affaireById, indiceById } from './campaignData';
import { itemFromTrappingById, itemLabel, isUnarmed, resoudreObjet } from '../engine/items';
import { isShieldItem } from '../engine/equipCompare';
import { dropHeaviestPossession } from '../engine/exposure';
import { weaponFamily } from '../gameIso/rig/parts/equipment';
import { sellGain, sellRefusal, type MerchantState } from './merchantFlow';
import { syncDerivedConditions } from '../engine/conditions';
import { chipCodex, type EffectChip } from '../gameIso/effectIcons';
import { findTrappingById, type TrappingData } from '../data';
import { objetDeTest } from '../engine/objetDeTest.testkit';
import type { NarratifBlock } from './campaignNarratif';
import { emptyScene } from './scene';
import { applyEffects } from './combatFlow';
import type { Combatant } from '../engine/types';
import type { Scene } from './scene';

/** Objet de campagne (id NON-colluant avec le global) : type `melee` → `kind:'melee'` prouve la
 *  résolution par la couche de campagne. */
const LAME_CAMPAGNE = 'campagne-lame-maudite';

const narratif: NarratifBlock = {
  affaires: [{ id: 'aff-corbeau-noir', titre: 'Le Corbeau noir' }],
  indices: [{ id: 'ind-lettre-scellee', affaireId: 'aff-corbeau-noir', kind: 'indice', titre: 'Lettre scellée', stades: [{ id: 's1', prose: 'Une lettre.' }] }],
  presetsPnj: [{ id: 'pnj-baron-caché' }],
  objets: [{ id: LAME_CAMPAGNE, label: 'Lame maudite', categorie: 'melee', subType: null } as NarratifBlock['objets'][number]],
};

function hero(): Combatant {
  return ({
    id: 'a', label: 'A', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  }) as unknown as Combatant;
}

/** Scène minimale (heroStart) pour un chargement de campagne par le CHEMIN RÉEL (`loadProject`). */
function fixtureScene(id = 'camp-scene'): Scene {
  const s = emptyScene(6, 6);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

/** Charge la campagne fixture par le chemin RÉEL du store (pose `campaignNarratif`). */
function loadCampaign(): void {
  useGame.setState({ party: [hero()] });
  useGame.getState().loadProject([fixtureScene()], 'camp-scene', undefined, narratif);
}

beforeEach(() => {
  useGame.setState({ campaignNarratif: null, party: [], scene: null });
});

describe('campaignData — accesseurs de la couche narrative (#767)', () => {
  it('sans campagne chargée (campaignNarratif === null) : tout accesseur couche-seulement retourne undefined', () => {
    expect(useGame.getState().campaignNarratif).toBeNull();
    expect(presetPnjById('pnj-baron-caché')).toBeUndefined();
    expect(affaireById('aff-corbeau-noir')).toBeUndefined();
    expect(indiceById('ind-lettre-scellee')).toBeUndefined();
  });

  it('campagne chargée par loadProject : les accesseurs retournent l’entrée de la campagne', () => {
    loadCampaign();
    expect(useGame.getState().campaignNarratif).not.toBeNull();
    expect(presetPnjById('pnj-baron-caché')?.id).toBe('pnj-baron-caché');
    expect(affaireById('aff-corbeau-noir')?.titre).toBe('Le Corbeau noir');
    expect(indiceById('ind-lettre-scellee')?.affaireId).toBe('aff-corbeau-noir');
  });

  it('resoudreObjet : campagne-D’ABORD pour un objet du narratif, repli GLOBAL sinon', () => {
    loadCampaign();
    // Objet de campagne (n'existe pas dans src/data global).
    expect(resoudreObjet(LAME_CAMPAGNE)?.label).toBe('Lame maudite');
    // Id global réel : tombe sur la règle globale.
    expect(resoudreObjet('dague')?.label).toBe('Dague');
    // Preuve « échoue sans la clé » : campagne DÉCHARGÉE → l'objet de campagne n'est plus résolu.
    useGame.setState({ campaignNarratif: null });
    expect(resoudreObjet(LAME_CAMPAGNE)).toBeUndefined();
    expect(resoudreObjet('dague')?.label).toBe('Dague'); // le global reste, lui
  });
});

describe('campaignData — câblage giveTrapping campagne-d’abord par le chemin d’état réel (#767)', () => {
  it('giveTrapping d’un objet de campagne crée l’objet DE CAMPAGNE (kind melee) quand la couche est chargée', () => {
    loadCampaign();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'giveTrapping', trappingId: LAME_CAMPAGNE, heroId: 'a' }]);
    const it = (useGame.getState().party[0].items ?? []).find((i) => i.trappingId === LAME_CAMPAGNE);
    expect(itemLabel(it!)).toBe('Lame maudite'); // libellé de l'objet de CAMPAGNE, résolu campagne-d'abord
    expect(it?.kind).toBe('melee'); // objet à stats du narratif
  });

  it('sans couche chargée : le MÊME giveTrapping LÈVE, nommé, et ne donne rien — la clé est au bon site', () => {
    useGame.setState({ party: [hero()], campaignNarratif: null });
    useGame.getState().startScene(fixtureScene('nu-scene'));
    expect(() => applyEffects(useGame.getState, useGame.setState, [{ type: 'giveTrapping', trappingId: LAME_CAMPAGNE, heroId: 'a' }]))
      .toThrow(`instancesDeDon: « ${LAME_CAMPAGNE} » n'est ni un objet de la campagne ni une entrée du catalogue des objets.`);
    expect(useGame.getState().party[0].items ?? []).toEqual([]);
  });
});

/** Un objet de CAMPAGNE tiré d'une entrée du catalogue : mêmes stats, id et libellé du projet. */
const objetDeCampagne = (base: string, id: string, label: string, over: Partial<TrappingData> = {}): TrappingData =>
  ({ ...findTrappingById(base)!, id, label, ...over });

/** Pose `objets` en couche de campagne par la couture RÉELLE du store (`campaignNarratif`). */
function poserObjets(objets: TrappingData[]): void {
  useGame.setState({ campaignNarratif: { affaires: [], indices: [], presetsPnj: [], objets } });
}

describe('#2324 — une instance se lit à la résolution qui l’a créée : la couche de campagne', () => {
  const ECU = objetDeCampagne('bouclier', 'campagne-ecu-de-la-baronne', 'Écu de la baronne');
  const POINGS = objetDeCampagne('mains-nues', 'campagne-poings-de-fer', 'Poings de fer');
  const GUISARME = objetDeCampagne('hallebarde', 'campagne-guisarme-du-guet', 'Guisarme du guet');
  const MALLE = objetDeCampagne('corde', 'campagne-malle-du-capitaine', 'Malle du capitaine', { enc: 6 });
  const DAGUE = objetDeCampagne('dague', 'campagne-dague-du-comte', 'Dague du comte');

  it('un écu de campagne est reconnu bouclier', () => {
    poserObjets([ECU]);
    expect(isShieldItem(itemFromTrappingById(ECU.id)!)).toBe(true);
  });

  it('des mains nues de campagne sont reconnues mains nues', () => {
    poserObjets([POINGS]);
    expect(isUnarmed({ label: '', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [], trappingId: POINGS.id })).toBe(true);
  });

  it('une arme de campagne à `shape` se dessine sous sa forme', () => {
    poserObjets([GUISARME]);
    expect(weaponFamily({ type: 'melee', form: GUISARME.id } as Parameters<typeof weaponFamily>[0])).toBe(GUISARME.shape);
  });

  it('journal : la Possession la plus lourde jetée se nomme par son entrée de campagne, jamais par son id', () => {
    poserObjets([MALLE]);
    const c = { ...hero(), items: [itemFromTrappingById(MALLE.id)!] } as Combatant;
    expect(dropHeaviestPossession(c)).toBe('Malle du capitaine');
  });

  it('prix marchand : un objet de campagne se revend au prix de son entrée', () => {
    poserObjets([DAGUE]);
    const m = { resaleRate: 1 } as MerchantState;
    const gain = sellGain(itemFromTrappingById(DAGUE.id)!, m);
    expect(gain).toEqual(sellGain(itemFromTrappingById('dague')!, m));
    expect(gain).not.toEqual(sellGain(objetDeTest({ trappingId: 'objet-que-rien-ne-resout' }), m));
  });

  it('vente (LDB 59 « Vente ») : la Disponibilité de l’entrée de campagne décide, comme pour un stock', () => {
    const INTROUVABLE = objetDeCampagne('corde', 'campagne-reliquaire', 'Reliquaire', { availability: 'ND' as never });
    poserObjets([DAGUE, INTROUVABLE]);
    expect(sellRefusal(itemFromTrappingById(DAGUE.id)!)).toBeNull();
    expect(sellRefusal(itemFromTrappingById(INTROUVABLE.id)!)).not.toBeNull();
  });

  it('source d’un État : le passif d’un objet de campagne se nomme par son entrée, jamais par son id', () => {
    const AMULETTE = objetDeCampagne('corde', 'campagne-amulette-maudite', 'Amulette maudite', { passive: [{ op: 'condition', id: 'assourdi', value: 1 }] as never });
    poserObjets([AMULETTE]);
    const c = { ...hero(), items: [{ ...itemFromTrappingById(AMULETTE.id)!, equipped: true }] } as Combatant;
    const journal = syncDerivedConditions(c).join('\n');
    expect(journal).toContain('Amulette maudite');
    expect(journal).not.toContain(AMULETTE.id);
  });

  it('pastille : une source objet de campagne ne vise aucune fiche Codex ; le repli par sort reste vivant', () => {
    poserObjets([DAGUE]);
    const chip = { key: 'b-1', icon: 'action/cast', label: 'Dague du comte', kind: 'buff', source: { kind: 'trapping', id: DAGUE.id } } as EffectChip;
    expect(chipCodex(chip)).toBeNull();
    expect(chipCodex({ ...chip, sourceSpellId: 'arme-aethyrique' })?.category).toBe('spells');
  });
});
