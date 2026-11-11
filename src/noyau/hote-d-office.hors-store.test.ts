/**
 * L'ÉTAPE HÔTE QU'AUCUN HUMAIN NE TIENT (#3892) — `sieges.tenuParUnHumain` : « leur étape se résout d'office et se
 * montre au bilan ». Parquée dans le slot par le pilote immédiat, elle se joue par les MÊMES verbes qu'un humain
 * (`jetLancer`/`jetValider` sur son flux, `combatAuto.jouerLaPaireDuJet`) ; tenue, elle reste parquée sur sa fenêtre.
 * Matrice des hôtes atteignables hors bataille par leur producteur réel : Test (`openSkillTest`), Test étendu
 * (`ouvrirLeTestEtendu`), incantation (`incanterLeSort`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { openSkillTest } from './combatEffects';
import { condCtx } from './bourseFlow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { startCascade } from './cascade';
import { cleDeFixture } from './noyau.testkit';
import { fixtureText } from '../i18n/fixtureText';
import type { Combatant } from '../engine/types';
import type { PendingKey } from './stateFields';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  banc.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
  banc.getState().ensemencerLeTirage(5);
});

const heros = (ia: boolean): Combatant => {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
  h.aiControlled = ia;
  return h;
};

const sorcier = (ia: boolean): Combatant => {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  const sk = w.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  else w.skills.push({ id: 'langue', spec: 'magick', advances: 10 } as never);
  w.aiControlled = ia;
  return w;
};

/** Un membre de la matrice : son porteur, son producteur réel, le slot qui porte la donnée de son jet. */
const MEMBRES: readonly { jet: string; slot: PendingKey; porteur: (ia: boolean) => Combatant; ouvrir: (c: Combatant) => void }[] = [
  {
    jet: 'test', slot: 'pendingTest', porteur: heros,
    ouvrir: (c) => { openSkillTest(banc.getState, banc.setState, { characteristic: 'force-mentale', difficulty: 'difficile' } as never, condCtx(banc.getState), EMPTY_FLOW, EMPTY_FLOW, EMPTY_FLOW, { actorId: c.id }); },
  },
  {
    jet: 'testEtendu', slot: 'pendingExtendedTest', porteur: heros,
    ouvrir: (c) => banc.getState().ouvrirLeTestEtendu({ actorId: c.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, targetDR: 2 }),
  },
  {
    jet: 'incantation', slot: 'pendingCast', porteur: sorcier,
    ouvrir: (c) => banc.getState().incanterLeSort(c.id, 'armure-aethyrique', c.id),
  },
];

describe('Étape hôte hors bataille : tenue, elle parque ; non tenue, ses verbes se jouent d’office (#3892)', () => {
  for (const m of MEMBRES) {
    it(`${m.jet} — porteur TENU : l’étape reste parquée sur sa fenêtre, non validée`, () => {
      const c = m.porteur(false);
      banc.setState({ party: [c] });
      m.ouvrir(c);
      const p = banc.getState().pendingCascade!;
      expect(p.participants[p.cursor].jet).toBe(m.jet);
      expect(p.participants[p.cursor].committed).toBeFalsy();
      expect(banc.getState()[m.slot], 'la fenêtre vit : son slot porte la donnée').not.toBeNull();
    });

    it(`${m.jet} — porteur NON TENU (IA) : la paire lancer/valider se joue sur le slot, la fenêtre se ferme`, () => {
      const c = m.porteur(true);
      banc.setState({ party: [c] });
      m.ouvrir(c);
      expect(banc.getState()[m.slot], 'le jet a été joué et validé par ses verbes').toBeNull();
      expect(banc.getState().pendingCascade, 'aucune étape hôte ne reste parquée').toBeNull();
    });
  }

  it('Test étendu NON TENU à plusieurs Rounds : une paire par Round jusqu’à la borne d’essais', () => {
    const c = heros(true);
    banc.setState({ party: [c] });
    banc.getState().ouvrirLeTestEtendu({ actorId: c.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, targetDR: 100, tentativesMax: 3 });
    expect(banc.getState().pendingExtendedTest, 'trois Rounds joués : la borne d’essais clôt le Test').toBeNull();
    expect(banc.getState().pendingCascade).toBeNull();
    expect(banc.getState().journal.some((l) => l.startsWith('Enfoncer la porte : échoué'))).toBe(true);
  });

  it('slot VIVANT d’un autre contexte : la cascade qui le tenait est suspendue, pas écrasée', () => {
    const autre = heros(false);
    const c = heros(true);
    banc.setState({ party: [autre, c] });
    startCascade(banc.getState, banc.setState, {
      title: 'Autre', purpose: 'upkeep',
      steps: [{ id: 'autre-1', kind: cleDeFixture('note'), actorId: autre.id, options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }] }],
    });
    MEMBRES[0].ouvrir(c);
    expect(banc.getState().suspendedCascades.map((x) => x.title)).toEqual(['Autre']);
    expect(banc.getState().pendingTest).toBeNull();
  });
});
