/**
 * `giveTrapping` résout l'objet dans la couche de campagne chargée d'abord (#767).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { emptyNarratif } from './monde/campaignNarratif';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { emptyScene } from './monde/scene';
import { applyEffects } from './combatEffects';
import type { Combatant } from '../engine/types';
import type { Scene } from './monde/scene';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
});

/** Objet de campagne (id NON-colluant avec le global) : type `melee` → `kind:'melee'` distingue une
 *  vraie résolution catalogue-campagne d'un repli `customTrapping` (kind `misc`, label = id brut). */
const LAME_CAMPAGNE = 'campagne-lame-maudite';

const narratif: NarratifBlock = {
  ...emptyNarratif(),
  presetsPnj: [{ id: 'pnj-baron-caché' }],
  objets: [{ id: LAME_CAMPAGNE, label: 'Lame maudite', categorie: 'melee', subType: null } as NarratifBlock['objets'][number]],
};

function hero(): Combatant {
  return (blessuresSurLeProfil({
    id: 'a', label: 'A', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  })) as unknown as Combatant;
}

/** Scène minimale (heroStart) pour un chargement de campagne par le CHEMIN RÉEL (`chargerLeProjet`). */
function fixtureScene(id = 'camp-scene'): Scene {
  const s = emptyScene('scene-test', 6, 6);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

/** Charge la campagne fixture par le chemin RÉEL du noyau (pose `campaignNarratif`). */
function loadCampaign(): void {
  banc.setState({ party: [hero()] });
  banc.getState().chargerLeProjet({ scenes: [fixtureScene()], entryId: 'camp-scene', narratif, projet: null });
}

beforeEach(() => {
  banc.setState({ campaignNarratif: null, party: [], scene: null });
});

describe('campaignData — câblage giveTrapping campagne-d’abord par le chemin d’état réel (#767)', () => {
  it('giveTrapping d’un objet de campagne crée l’objet DE CAMPAGNE (kind melee) quand la couche est chargée', () => {
    loadCampaign();
    applyEffects(banc.getState, banc.setState, [{ type: 'giveTrapping', trappingId: LAME_CAMPAGNE, heroId: 'a' }]);
    const it = (banc.getState().party[0].items ?? []).find((i) => i.trappingId === LAME_CAMPAGNE);
    expect(it?.label).toBe('Lame maudite');
    expect(it?.kind).toBe('melee'); // objet à stats du narratif, pas un customTrapping
  });

  it('sans couche chargée : le MÊME giveTrapping tombe sur un customTrapping (kind misc) — la clé est au bon site', () => {
    banc.setState({ party: [hero()], campaignNarratif: null });
    banc.getState().lancerLaScene(fixtureScene('nu-scene'));
    applyEffects(banc.getState, banc.setState, [{ type: 'giveTrapping', trappingId: LAME_CAMPAGNE, heroId: 'a' }]);
    const it = (banc.getState().party[0].items ?? []).find((i) => i.label === LAME_CAMPAGNE || i.trappingId === LAME_CAMPAGNE);
    expect(it).toBeTruthy();
    expect(it?.trappingId).toBeUndefined(); // customTrapping : aucune réf catalogue
    expect(it?.kind).toBe('misc'); // pas de stats — la campagne n'est PAS chargée
  });
});
