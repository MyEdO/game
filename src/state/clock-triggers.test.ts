import { describe, it, expect, beforeEach } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { useGame } from './store';
import { runDailyUpkeep } from './upkeep';
import { fireClockTriggers } from './clockHooks';
import { sleepParty } from './restFlow';
import { spellEffectOps, flowHasTest } from './flow';
import { createHero } from '../engine/character';
import { attachMutation } from '../engine/corruption';
import { applyOps } from '../engine/ops';
import { makeRNG } from '../engine/dice';
import { findMutationById, findTraitById, findSpellById } from '../data';
import { triggeredEffectSchema } from '../data/schemas/grammaire/mecanique';
import type { Combatant } from '../engine/types';
import type { Mutation } from '../engine/corruption';

/**
 * HORLOGE de campagne comme cycle d'effets DÉCLENCHÉS (`onDayStart`/`onWake`) — le jumeau hors-combat
 * du cycle de Round. Contrats vérifiés ici :
 *  - le RATTRAPAGE : `runDailyUpkeep` traite chaque jour franchi, donc trois jours sautés doivent trois
 *    émissions `onDayStart` ;
 *  - le RÉVEIL n'est pas le jour : `onWake` n'est émis que le jour d'une nuit JOUÉE (`lastNightDay`) ;
 *  - le RE-CIBLAGE ne s'empile pas : `[removeTrait, grantTrait]` laisse UNE seule instance du Trait,
 *    et ne touche QUE ce que la mutation elle-même a accordé (registre d'instance `TraitInstance.src`) ;
 *  - la BORNE d'un Trait accordé est portée par la DONNÉE (`grantTrait.durationHours`) et purgée par
 *    l'horloge — le Désespoir ne tire pas au-delà de sa semaine (VDM 09 l.280) ;
 *  - n nuits DORMIES sont n réveils (`sleepParty`), jamais une seule aube ;
 *  - les effets d'une mutation sont lus AU REGISTRE (`mutations.json`), jamais sur l'instance portée ;
 *  - aucun nœud `test` n'est authoré sous un déclencheur d'horloge tant que la cadence n'ouvre pas de
 *    canal de jet DIFFÉRÉ (`onDeferTest`).
 */
const get = useGame.getState;
const set = useGame.setState;

const HAINE_SPORADIQUE = 'haine-sporadique';

/** Instance de mutation MINIMALE (ce que porte un Combatant) — sans `effects` : ils vivent au registre. */
const mutInstance = (id: string, over: Partial<Mutation> = {}): Mutation =>
  ({ id, label: id, desc: '', kind: 'mentale', roll: 1, ...over }) as Mutation;

/** Instance TIRÉE du catalogue — ce que pose le chemin de Corruption (copie gelée de la fiche). */
const mutFromCatalog = (id: string): Mutation => ({ ...findMutationById(id)!, roll: 1 }) as Mutation;

const hero = (label = 'H', seed = 1): Combatant =>
  createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, rng: makeRNG(seed) });

/** Place le groupe au jour `from` (dernier entretien) et l'horloge au jour `to`, 8 h du matin. */
const atDays = (party: Combatant[], from: number, to: number, nightDay = -1): void => {
  set({ party, lastUpkeepDay: from, lastNightDay: nightDay, gameTime: to * 24 * 60 + 8 * 60, battle: null, pendingCascade: null });
};

const haineTraits = (c: Combatant): { id: string; arg?: string }[] => (c.traits ?? []).filter((t) => t.id === 'haine');

/** Porteur du Trait Désespoir posé À LA MAIN (sans borne) — la borne d'horloge est mesurée à part,
 *  depuis l'op RÉELLE du sort qui l'accorde. */
const desespere = (): Combatant => {
  const h = hero('Désespéré');
  h.traits = [...(h.traits ?? []), { id: 'desespoir' }];
  return h;
};

const extenue = (c: Combatant): number => (c.conditions ?? []).find((x) => x.id === 'extenue')?.value ?? 0;
// TÉMOIN sans le Trait : l'entretien a d'autres pourvoyeurs d'Exténué (privation de sommeil #340) —
// seul l'ÉCART entre le désespéré et le témoin mesure l'émission `onWake`.
const ecart = (): number => extenue(get().party[0]) - extenue(get().party[1]);

beforeEach(() => set({ battle: null, pendingCascade: null, deferredUpkeepQueue: [] }));

describe('onDayStart — une émission PAR JOUR franchi (rattrapage compris)', () => {
  it('trois jours sautés = trois re-ciblages de Haine sporadique (EDOC 12 l.217)', () => {
    const h = hero('Rattrapage');
    attachMutation(h, mutFromCatalog(HAINE_SPORADIQUE), makeRNG(7));
    atDays([h], 0, 3);

    const lines = runDailyUpkeep(get, set, { onDeferTest: () => {} });

    const gains = lines.filter((l) => l.includes('gagne le Trait'));
    expect(gains).toHaveLength(3); // un par jour franchi — jamais « un seul pour tout le saut »
  });

  it('aucun jour franchi (même journée) = aucune émission', () => {
    const h = hero('MemeJour');
    attachMutation(h, mutFromCatalog(HAINE_SPORADIQUE), makeRNG(7));
    atDays([h], 3, 3);

    expect(runDailyUpkeep(get, set, { onDeferTest: () => {} })).toEqual([]);
  });
});

describe('Re-ciblage sans EMPILEMENT — [removeTrait, grantTrait]', () => {
  it('après trois jours, le porteur a UNE seule instance du Trait Haine (pas une par jour)', () => {
    const h = hero('Sporadique');
    attachMutation(h, mutFromCatalog(HAINE_SPORADIQUE), makeRNG(11));
    expect(haineTraits(h)).toHaveLength(1); // attache : la mutation confère le Trait immédiatement
    atDays([h], 0, 3);

    runDailyUpkeep(get, set, { onDeferTest: () => {} });

    const porte = get().party[0];
    expect(haineTraits(porte)).toHaveLength(1);
    // Les effets actifs porteurs ne s'accumulent pas non plus (un `grantedTrait` de Haine au plus).
    expect((porte.activeEffects ?? []).filter((e) => e.grantedTrait?.id === 'haine')).toHaveLength(1);
  });

  it('la Cible est RE-TIRÉE : le Trait porté après l’entretien porte un `arg` (Tableau des Obsessions)', () => {
    const h = hero('Cible');
    attachMutation(h, mutFromCatalog(HAINE_SPORADIQUE), makeRNG(3));
    atDays([h], 0, 1);

    runDailyUpkeep(get, set, { onDeferTest: () => {} });

    expect(haineTraits(get().party[0])[0].arg).toBeTruthy();
  });

  it('le retrait ne touche QUE l’instance de la mutation : les Haine accordées par un TIERS survivent (Vaincre les impies, LDB 226)', () => {
    const h = hero('Béni');
    attachMutation(h, mutFromCatalog(HAINE_SPORADIQUE), makeRNG(11));
    const priere = findSpellById('vaincre-les-impies')!;
    applyOps(h, spellEffectOps(priere.effects), { rng: makeRNG(5), label: priere.label, source: { kind: 'prayer', id: priere.id } });
    expect(haineTraits(h)).toHaveLength(4); // 3 du prêtre + 1 de la mutation
    atDays([h], 0, 1);

    runDailyUpkeep(get, set, { onDeferTest: () => {} });

    const args = haineTraits(get().party[0]).map((t) => t.arg);
    expect(args, 'le re-ciblage quotidien de la mutation a purgé les Haine d’un TIERS.').toContain('peau-verte');
    expect(args).toContain('mort-vivant');
    expect(args).toContain('demon');
    expect(args, 'la mutation doit garder UNE instance — les 3 de la prière + la sienne.').toHaveLength(4);
  });
});

describe('onWake — le RÉVEIL n’est pas le franchissement de jour', () => {

  it('24 h franchies SANS nuit jouée → aucun État Exténué du réveil (Désespoir, VDM 09 l.280)', () => {
    atDays([desespere(), hero('Témoin', 2)], 0, 1, 0); // lastNightDay = 0 : la nuit du jour 1 n'a pas été jouée

    runDailyUpkeep(get, set, { onDeferTest: () => {} });

    expect(ecart()).toBe(0);
  });

  it('nuit JOUÉE le jour franchi (`lastNightDay`) → l’État Exténué du réveil est posé', () => {
    atDays([desespere(), hero('Témoin', 2)], 0, 1, 1); // restFlow a posé lastNightDay = 1 avant l'entretien

    runDailyUpkeep(get, set, { onDeferTest: () => {} });

    expect(ecart()).toBe(1);
  });
});

describe('BORNE du Trait accordé — la semaine du Désespoir (VDM 09 l.280) vit dans la DONNÉE', () => {
  /** L'op RÉELLE du sort qui accorde le Trait (`apercu-de-la-mort`) — si la borne quitte la donnée, ce
   *  test rougit : rien n'est reconstruit à la main ici. */
  const grantDesespoir = () => {
    const sort = findSpellById('apercu-de-la-mort')!;
    const op = spellEffectOps(sort.effects).find((o) => o.op === 'grantTrait' && o.traitId === 'desespoir');
    return { sort, op: op! };
  };

  it('l’op authorée porte la durée d’horloge d’une semaine (168 h), pas une durée de contexte', () => {
    const { op } = grantDesespoir();
    expect(op, 'le sort n’accorde plus le Trait Désespoir.').toBeTruthy();
    expect(op.op === 'grantTrait' && op.durationHours).toBe(168);
  });

  it('30 réveils consécutifs ne donnent que 7 États Exténué — le Trait expire à l’horloge', () => {
    const { sort, op } = grantDesespoir();
    const victime = hero('Victime');
    set({ party: [victime, hero('Témoin', 2)], gameTime: 12 * 60, lastUpkeepDay: 0, lastNightDay: 0, battle: null, pendingCascade: null });
    // Incantation à midi du jour 0 (le chemin de sort passe `now`, cf. combatFlow) — les réveils suivants
    // sont à 8 h : la semaine RAW en couvre exactement sept.
    applyOps(victime, [op], { rng: makeRNG(5), now: get().gameTime, label: sort.label, source: { kind: 'spell', id: sort.id } });
    expect((get().party[0].traits ?? []).some((t) => t.id === 'desespoir')).toBe(true);

    let matins = 0;
    for (let d = 1; d <= 30; d++) {
      const avant = ecart();
      set({ lastUpkeepDay: d - 1, lastNightDay: d, gameTime: d * 24 * 60 + 8 * 60 });
      runDailyUpkeep(get, set, { onDeferTest: () => {} });
      if (ecart() > avant) matins++;
    }

    expect(matins, 'le Désespoir tire au-delà de la semaine que le RAW lui donne (VDM 09 l.280).').toBe(7);
    expect((get().party[0].traits ?? []).some((t) => t.id === 'desespoir'), 'le Trait borné est resté porté après son échéance.').toBe(false);
  });
});

describe('n nuits DORMÍES = n réveils (`sleepParty`)', () => {
  it('trois nuits d’affilée émettent TROIS `onWake` — un séjour ne vaut pas une seule aube', () => {
    const victime = desespere();
    set({ party: [victime, hero('Témoin', 2)], gameTime: 12 * 60, lastUpkeepDay: 0, lastNightDay: -1, battle: null, pendingCascade: null });

    const entries = sleepParty(get, set, 3);

    // La récupération de la nuit retire l'État (LDB 16) : ce qui se compte est l'ÉMISSION, ligne à ligne.
    const matins = entries.filter((e) => e.actorId === victime.id && (e.text ?? '').includes('Exténué'));
    expect(matins, 'trois nuits dormies n’ont pas produit trois réveils.').toHaveLength(3);
    expect(entries.filter((e) => e.actorId === get().party[1].id && (e.text ?? '').includes('Exténué'))).toHaveLength(0);
  });
});

describe('Effets de mutation lus AU REGISTRE (jamais sur l’instance gelée)', () => {
  it('une instance SANS `effects` déclenche quand même (la fiche `mutations.json` fait foi)', () => {
    const h = hero('Registre');
    h.mutations = [mutInstance(HAINE_SPORADIQUE)]; // instance nue : aucun `effects` porté
    set({ party: [h] });

    const lines = fireClockTriggers(get, 'onDayStart');

    expect(lines.some((l) => l.includes('gagne le Trait'))).toBe(true);
    expect(findMutationById(HAINE_SPORADIQUE)?.effects?.[0].trigger).toBe('onDayStart');
  });

  it('une mutation MAISON (hors catalogue) qui porte des `effects` sur l’instance n’en déclenche aucun', () => {
    const h = hero('Maison');
    h.mutations = [mutInstance('mutation-maison-sans-fiche', {
      effects: findMutationById(HAINE_SPORADIQUE)!.effects,
    })];
    set({ party: [h] });

    expect(fireClockTriggers(get, 'onDayStart')).toEqual([]);
    expect(haineTraits(get().party[0])).toHaveLength(0);
  });
});

describe('CADENCE — aucun jet authoré sous un déclencheur d’horloge tant que le canal DIFFÉRÉ manque', () => {
  /** Tous les documents authorés des deux racines (mêmes racines que les gardes de structure).
   *  `tests: true` parce que c'est l'INCLUSION qui est le contrat : la mesure porte sur TOUT document
   *  authoré. Aucun `.json` ne porte `.test.` aujourd'hui — sans l'option, un document nommé ainsi
   *  demain sortirait du scan sans un mot. */
  const documents = (): { rel: string; json: unknown }[] =>
    readCorpus(['src/data', 'src/scenes'], { exts: ['.json'], tests: true })
      .map(({ rel, text }) => ({ rel, json: JSON.parse(text) as unknown }));

  /** Chaque `TriggeredEffect` authoré d'un document, quel que soit le champ qui le porte. */
  const effetsDeclenches = (node: unknown, out: { trigger: string; flow: unknown }[] = []): { trigger: string; flow: unknown }[] => {
    if (Array.isArray(node)) { for (const v of node) effetsDeclenches(v, out); return out; }
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (typeof o.trigger === 'string' && o.flow != null) out.push({ trigger: o.trigger, flow: o.flow });
      for (const v of Object.values(o)) effetsDeclenches(v, out);
    }
    return out;
  };

  it('la marche des documents VOIT les effets d’horloge (sans quoi la garde serait un no-op vert)', () => {
    const horloge = documents().flatMap((d) => effetsDeclenches(d.json).filter((e) => e.trigger === 'onDayStart' || e.trigger === 'onWake'));
    expect(horloge.length, 'aucun effet d’horloge trouvé dans les données : la marche a divergé.').toBeGreaterThanOrEqual(2);
  });

  it('aucun nœud `test` sous `onDayStart`/`onWake` : `fireClockTriggers` est appelé SANS canal `onDeferTest` (upkeep.ts)', () => {
    const fautifs = documents().flatMap((d) =>
      effetsDeclenches(d.json)
        .filter((e) => (e.trigger === 'onDayStart' || e.trigger === 'onWake') && flowHasTest(e.flow as Parameters<typeof flowHasTest>[0]))
        .map((e) => `${d.rel} › ${e.trigger}`),
    );
    expect(
      fautifs,
      'un Test authoré sous un déclencheur d’horloge serait PRÉ-RÉSOLU inline (témoin), ce que la cascade ' +
        'de nuit interdit (upkeep.ts, `onDeferTest`) : ouvrir le canal différé à `fireClockTriggers` avant ' +
        'de poser ce jet en donnée.',
    ).toEqual([]);
  });
});

describe('Grammaire — les deux sites de l’énumération acceptent les déclencheurs d’horloge', () => {
  it('le schéma de donnée valide les `effects` RÉELS de Haine sporadique et de Désespoir', () => {
    expect(triggeredEffectSchema.safeParse(findMutationById(HAINE_SPORADIQUE)!.effects![0]).success).toBe(true);
    expect(triggeredEffectSchema.safeParse(findTraitById('desespoir')!.effects![0]).success).toBe(true);
    expect(findTraitById('desespoir')!.effects![0].trigger).toBe('onWake');
  });
});
