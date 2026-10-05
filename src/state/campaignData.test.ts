import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { presetPnjById, affaireById, indiceById, trappingById } from './campaignData';
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

  it('trappingById : campagne-D’ABORD pour un objet du narratif, repli GLOBAL sinon', () => {
    loadCampaign();
    // Objet de campagne (n'existe pas dans src/data global).
    expect(trappingById(LAME_CAMPAGNE)?.label).toBe('Lame maudite');
    // Id global réel : tombe sur la règle globale.
    expect(trappingById('dague')?.label).toBe('Dague');
    // Preuve « échoue sans la clé » : campagne DÉCHARGÉE → l'objet de campagne n'est plus résolu.
    useGame.setState({ campaignNarratif: null });
    expect(trappingById(LAME_CAMPAGNE)).toBeUndefined();
    expect(trappingById('dague')?.label).toBe('Dague'); // le global reste, lui
  });
});

describe('campaignData — câblage giveTrapping campagne-d’abord par le chemin d’état réel (#767)', () => {
  it('giveTrapping d’un objet de campagne crée l’objet DE CAMPAGNE (kind melee) quand la couche est chargée', () => {
    loadCampaign();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'giveTrapping', trappingId: LAME_CAMPAGNE, heroId: 'a' }]);
    const it = (useGame.getState().party[0].items ?? []).find((i) => i.trappingId === LAME_CAMPAGNE);
    expect(it?.label).toBe('Lame maudite');
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
