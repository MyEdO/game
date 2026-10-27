/**
 * LA COOP sans hôte (#3041, L5-c) : le `build` du handshake, l'instantané qu'un hôte diffuse (clés de jeu de la
 * sauvegarde, sans ce qui est local au client) et son application à l'état d'un invité (règles maison de l'hôte
 * adoptées, identité réseau de l'invité gardée, paquet de campagne reposé).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { appliquerLInstantane, buildDeLaCoop, instantaneDeLaCoop } from './coop';
import { etatInitialDuJeu, snapshotSave, type EtatDeJeu } from './index';
import { OPTIONAL_RULES, loadRuleOverrides, ruleOverrides } from '../engine/policy';
import { HOUSE_RULES_KEY } from './persistance/save';
import { sceneDuRegistre } from './monde/registreDesScenes';
import { emptyNarratif } from './monde/campaignNarratif';
import { emptyScene } from './monde/scene';
import { FORMAT_SAVE } from './persistance/formats.generated';
import { setDataset } from '../data/overrides';
import { etats } from '../data';

const ETATS_LIVRES = structuredClone(etats);
const REGLES_LIVREES = structuredClone(OPTIONAL_RULES);
const LOCALES = ['localIntent', 'dispelCarrierId', 'refus'] as const;

/** L'état d'un hôte en partie : intention armée, porteur élu, refus affiché, paquet de campagne lancé. */
function hoteEnPartie(): EtatDeJeu {
  return {
    ...etatInitialDuJeu(),
    screen: 'campaign',
    localIntent: { actionId: 'portee-mouvement' },
    dispelCarrierId: 'heros-hote',
    refus: { texte: 'refus de l’hôte', nonce: 7 },
    pendingCampaign: { id: 'camp-fixture', label: 'Campagne fixture', scenes: [emptyScene('scene-a', 4, 4)], startSceneId: 'scene-a', worldMap: null, projet: { id: 'projet-fixture' } },
    net: { mode: 'host', mySeat: 0, roomCode: 'ABC234', seatNames: { 0: 'Hôte', 2: 'Anne' }, presence: { 2: 'ok' }, connection: 'ok', hostAway: false, ownership: { 'heros-anne': 2 }, slots: [0, 2, 0, 0] },
  };
}

/** L'état d'un invité au siège 2, en reconnexion, qui a armé SA propre intention. */
function inviteAuSiege2(): EtatDeJeu {
  return {
    ...etatInitialDuJeu(),
    screen: 'campaign',
    localIntent: { actionId: 'portee-charge' },
    dispelCarrierId: null,
    refus: { texte: 'refus de l’invité', nonce: 3 },
    net: { mode: 'guest', mySeat: 2, roomCode: 'ABC234', seatNames: { 2: 'Anne' }, presence: {}, connection: 'reconnecting', hostAway: true, ownership: {}, slots: [0, 0, 0, 0] },
  };
}

afterEach(() => {
  loadRuleOverrides({});
  setDataset('etats', structuredClone(ETATS_LIVRES));
  setDataset('reglesOptionnelles', structuredClone(REGLES_LIVREES));
});

describe('instantané coop de l’hôte', () => {
  it('porte EXACTEMENT les clés de jeu de la sauvegarde hors celles locales au client, plus les règles maison', () => {
    const etat = hoteEnPartie();
    const cles = Object.keys(snapshotSave(etat, 'x').data).filter((k) => !(LOCALES as readonly string[]).includes(k));
    expect(Object.keys(instantaneDeLaCoop(etat)).sort()).toEqual([...cles, HOUSE_RULES_KEY].sort());
  });

  it('réduit le paquet de campagne à son stub : ses scènes voyagent au join', () => {
    const pc = instantaneDeLaCoop(hoteEnPartie()).pendingCampaign as EtatDeJeu['pendingCampaign'];
    expect(pc).toEqual({ id: 'camp-fixture', label: 'Campagne fixture', scenes: [], startSceneId: 'scene-a', worldMap: null, projet: { id: 'projet-fixture' } });
  });
});

describe('application de l’instantané chez l’invité', () => {
  const flag = OPTIONAL_RULES.find((r) => r.kind === 'flag')!;

  it('adopte les règles maison de l’hôte', () => {
    loadRuleOverrides({ [flag.id]: true });
    const data = instantaneDeLaCoop(hoteEnPartie());
    loadRuleOverrides({});
    appliquerLInstantane(data, inviteAuSiege2());
    expect(ruleOverrides()).toEqual({ [flag.id]: true });
  });

  it('garde l’identité réseau de l’invité et ce qui lui est local, prend le reste de l’hôte', () => {
    const mien = inviteAuSiege2();
    const { etat } = appliquerLInstantane(JSON.parse(JSON.stringify(instantaneDeLaCoop(hoteEnPartie()))), mien);
    expect(etat.net).toEqual({ ...hoteEnPartie().net, mode: 'guest', mySeat: 2, connection: 'reconnecting', hostAway: true });
    expect({ localIntent: etat.localIntent, dispelCarrierId: etat.dispelCarrierId, refus: etat.refus })
      .toEqual({ localIntent: mien.localIntent, dispelCarrierId: mien.dispelCarrierId, refus: mien.refus });
  });

  it('garde l’écran créateur de l’invité pendant la composition d’équipe de l’hôte, pas au-delà', () => {
    const mien: EtatDeJeu = { ...inviteAuSiege2(), screen: 'creator' };
    expect(appliquerLInstantane(instantaneDeLaCoop({ ...hoteEnPartie(), screen: 'party' }), mien).etat.screen).toBe('creator');
    expect(appliquerLInstantane(instantaneDeLaCoop({ ...hoteEnPartie(), screen: 'campaign' }), mien).etat.screen).toBe('campaign');
  });

  it('repose le paquet de campagne : scènes enregistrées, narratif re-dérivé', () => {
    const narratif = emptyNarratif();
    const hote: EtatDeJeu = { ...hoteEnPartie(), campaignDoc: { scenes: [emptyScene('scene-du-paquet', 4, 4)], worldMap: null, narratif, startSceneId: 'scene-du-paquet', projet: null } };
    const { etat } = appliquerLInstantane(instantaneDeLaCoop(hote), inviteAuSiege2());
    expect(etat.campaignNarratif).toEqual(narratif);
    expect(sceneDuRegistre('scene-du-paquet')?.id).toBe('scene-du-paquet');
  });

  it('dit une partie neuve quand `gameTime` recule, une autre scène quand la scène change', () => {
    const mien = { ...inviteAuSiege2(), gameTime: 500 };
    expect(appliquerLInstantane(instantaneDeLaCoop({ ...hoteEnPartie(), gameTime: 400 }), mien)).toMatchObject({ neuve: true, autreScene: false });
    const scene = emptyScene('scene-b', 4, 4);
    expect(appliquerLInstantane(instantaneDeLaCoop({ ...hoteEnPartie(), gameTime: 600, scene }), mien)).toMatchObject({ neuve: false, autreScene: true });
  });
});

describe('build du handshake coop : format ET registres (#1463 LD.1)', () => {
  it('porte le format de l’état, et change quand un registre que nomme un instantané change', () => {
    const base = buildDeLaCoop();
    expect(base.startsWith(`${FORMAT_SAVE}.`)).toBe(true);
    expect(buildDeLaCoop(), 'déterministe').toBe(base);
    setDataset('etats', [...structuredClone(ETATS_LIVRES), { ...structuredClone(ETATS_LIVRES[0]), id: 'etat-de-fixture' }]);
    expect(buildDeLaCoop()).not.toBe(base);
    setDataset('etats', structuredClone(ETATS_LIVRES));
    expect(buildDeLaCoop()).toBe(base);
    const mode = REGLES_LIVREES.findIndex((r) => r.kind === 'mode');
    setDataset('reglesOptionnelles', REGLES_LIVREES.map((r, i) => (i === mode ? { ...structuredClone(r), options: [...(r.options ?? []), 'option-de-fixture'] } : structuredClone(r))));
    expect(buildDeLaCoop()).not.toBe(base);
  });
});
