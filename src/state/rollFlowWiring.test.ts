import { describe, it, expect } from 'vitest';
import { buildRollFlowActions } from '../noyau/rollFlowSpecs';
import { FLOW_VERBS } from '../noyau/flowVerbs';
import { COMBAT_INTENTS, MANUAL_COMBAT_INTENTS } from '../noyau/intentionsDeSiege';
import type { Get, Set as SetFn } from '../noyau/flowTypes';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { sitesDeDelegueManuscrit } from '../../scripts/guards/lib/delegueDeVerbeManuscrit.mjs';

/**
 * Garde de la SOURCE UNIQUE `FLOW_VERBS` (axe B) : prouve que les 3 miroirs d'un flux de jet — le TYPE
 * (`RollFlowActionsMap`, vérifié par `tsc` via `GameState extends`), le RUNTIME (`buildRollFlowActions`)
 * et les INTENTS coop (`noyau/intentionsDeSiege.ts`) — restent alignés sur la table. Le type est garanti par la
 * compilation ; ce test couvre le runtime et la surface invité, dans les DEUX sens : tout verbe d'un
 * flux MONO est un intent (#1017 — surface dérivée de la possession, sans marqueur à poser), tout
 * verbe d'un flux MULTI `coop` aussi (résolutions comprises), aucun verbe d'un multi non-coop ne l'est, et aucun
 * nom DÉRIVABLE ne dort dans la part manuelle `MANUAL_COMBAT_INTENTS` (une entrée recopiée = une 2ᵉ source).
 */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const noopGet = (() => ({})) as unknown as Get;
const noopSet = (() => {}) as unknown as SetFn;
// `as const` narrowit chaque entrée (verbes = tuple littéral, `coop` absent des entrées non-coop) →
// on relit via une vue élargie pour itérer génériquement (le contenu réel est garanti par le satisfies).
const ENTRIES = Object.entries(FLOW_VERBS) as [string, { kind: 'mono' | 'multi'; verbs: readonly string[]; coop?: boolean; resolution?: readonly string[] }][];

describe('câblage des flux de jet — source unique FLOW_VERBS', () => {
  it('runtime : buildRollFlowActions expose EXACTEMENT les délégués <prefix><Verbe> de FLOW_VERBS', () => {
    const expected = new Set<string>();
    for (const [prefix, w] of ENTRIES) for (const v of w.verbs) expected.add(`${prefix}${cap(v)}`);
    const actual = new Set(Object.keys(buildRollFlowActions(noopGet, noopSet)));
    expect(actual).toEqual(expected);
  });

  it('intents : tout verbe d’un flux MONO est exposé (surface DÉRIVÉE de la possession, #1017)', () => {
    const missing: string[] = [];
    for (const [prefix, w] of ENTRIES) {
      if (w.kind !== 'mono') continue;
      for (const v of w.verbs) {
        const intent = `${prefix}${cap(v)}`;
        if (!COMBAT_INTENTS.has(intent)) missing.push(intent);
      }
    }
    expect(missing, 'verbe de flux mono hors COMBAT_INTENTS — la dérivation `coopFlowIntents` a été rompue').toEqual([]);
  });

  it('intents coop : chaque verbe d’un flux MULTI coop EST dans COMBAT_INTENTS (anti-dérive)', () => {
    const missing: string[] = [];
    for (const [prefix, w] of ENTRIES) {
      if (w.kind !== 'multi' || !w.coop) continue;
      for (const v of w.verbs) {
        const intent = `${prefix}${cap(v)}`;
        if (!COMBAT_INTENTS.has(intent)) missing.push(intent);
      }
    }
    expect(missing, 'verbes coop sans intent — ajouter à COMBAT_INTENTS (ou retirer `coop`)').toEqual([]);
  });

  it('intents : aucun intent générique orphelin (verbe d’un MULTI non-coop exposé par erreur à l’invité)', () => {
    const orphan: string[] = [];
    for (const [prefix, w] of ENTRIES) {
      if (w.kind !== 'multi' || w.coop) continue;
      for (const v of w.verbs) {
        const intent = `${prefix}${cap(v)}`;
        if (COMBAT_INTENTS.has(intent)) orphan.push(intent);
      }
    }
    expect(orphan, 'intent générique d’un MULTI non-coop — retirer de COMBAT_INTENTS (ou marquer `coop`)').toEqual([]);
  });

  it('intents : la part MANUELLE ne recopie aucun nom dérivable de FLOW_VERBS (source unique)', () => {
    const derivable = new Set<string>();
    for (const [prefix, w] of ENTRIES) {
      for (const v of w.verbs) derivable.add(`${prefix}${cap(v)}`);
      // …y compris les actions de `resolution` : elles sont DÉRIVÉES depuis #1017 (exposées et routées
      // par la table), donc les recopier à la main recréerait la 2ᵉ source que ce test interdit.
      for (const a of w.resolution ?? []) derivable.add(a);
    }
    const recopies = MANUAL_COMBAT_INTENTS.filter((n) => derivable.has(n));
    expect(recopies, 'intent dérivable recopié à la main — le retirer de MANUAL_COMBAT_INTENTS').toEqual([]);
  });

  it('intents : la part MANUELLE ne porte aucun doublon (une entrée = un choix, une fois)', () => {
    const vus = new Set<string>();
    const doublons = MANUAL_COMBAT_INTENTS.filter((n) => (vus.has(n) ? true : (vus.add(n), false)));
    expect(doublons).toEqual([]);
  });

  /** `resist` (auto-succès du Talent Résistance (Menace)) est une DÉPENSE comme les autres (calque
   *  `forceSuccess`) : il est exposé par TOUT flux dont la surface l'est — MONO (routé par le porteur
   *  du jet, `jetOwnedIntents`) comme MULTI coop (routé par participant ou par l'acteur de l'étape,
   *  cf. `multiFlowOwnership.test.ts`). Un flux MULTI non-coop n'expose rien du tout. */
  it('resist : exposé partout où la surface du flux l’est (mono, et multi coop)', () => {
    for (const [prefix, w] of ENTRIES) {
      if (!w.verbs.includes('resist')) continue;
      expect(COMBAT_INTENTS.has(`${prefix}Resist`), `${prefix}Resist`).toBe(w.kind === 'mono' || !!w.coop);
    }
  });

  /** Les actions de `resolution` d'un flux MULTI sont DÉRIVÉES (#1050) : un flux multi n'écrit aucune
   *  ligne dans `noyau/intentionsDeSiege.ts`. */
  it('resolution : chaque flux MULTI coop expose ses actions de clôture (dérivées, jamais recopiées)', () => {
    const manquantes: string[] = [];
    for (const [, w] of ENTRIES) {
      if (w.kind !== 'multi' || !w.coop) continue;
      for (const a of w.resolution ?? []) if (!COMBAT_INTENTS.has(a)) manquantes.push(a);
    }
    expect(manquantes, 'action de résolution d’un flux multi hors surface invité').toEqual([]);
  });

  /**
   * INVARIANT RAW — LDB 17 l.68, « Je ne faillirai pas ! » : « au lieu de lancer les dés pour un Test,
   * vous choisissez le résultat ». Le choix du résultat EST la mécanique de la dépense de Résilience,
   * pas une option qui l'accompagne : un flux qui offre `forceSuccess` DOIT offrir `setForcedRoll`.
   * Aucune liste d'exception : la Résilience est GLOBALE (LDB 17 l.65, « réussir là où vous auriez
   * certainement échoué »), donc tout flux qui porte un Test la porte.
   */
  it('Résilience : tout flux à forceSuccess offre le choix du dé (setForcedRoll)', () => {
    const sans = ENTRIES
      .filter(([, w]) => w.verbs.includes('forceSuccess') && !w.verbs.includes('setForcedRoll'))
      .map(([prefix]) => prefix);
    expect(sans, 'flux à Résilience SANS choix du dé — déclarer son accesseur `die` puis le verbe').toEqual([]);
  });

  /** #2903 — un délégué `<prefix><Verbe>` se GÉNÈRE (`buildRollFlowActions`) : aucune action ne
   *  rappelle le handler d'un verbe à la main, hors surface dérivée et hors possession par le porteur. */
  describe('délégué de verbe manuscrit (`scripts/guards/lib/delegueDeVerbeManuscrit.mjs`)', () => {
    const VERBES = new Set(ENTRIES.flatMap(([, w]) => w.verbs));
    const site = (text: string) => sitesDeDelegueManuscrit({ rel: 'src/noyau/x.ts', text }, VERBES);

    it('voit l’appel direct du handler d’un verbe, par nom de flux ou par index', () => {
      expect(site('const a = { activityCancel: () => FLOWS.activity.cancel(get, set) };')).toEqual([{ ligne: 1, texte: 'FLOWS.activity.cancel(get, set)' }]);
      expect(site('FLOW_HANDLERS[k].setForcedRoll(get, set, 12);').map((x) => x.texte)).toEqual(['FLOW_HANDLERS[k].setForcedRoll(get, set, 12)']);
    });

    it('laisse les membres d’un handler qui ne sont pas des verbes, et le générateur par paramètre', () => {
      expect(site('FLOWS.reload.apply(get, { p });')).toEqual([]);
      expect(site('const flow = FLOW_HANDLERS[prefix]; out[n] = () => flow[v](get, set);')).toEqual([]);
    });

    it('le code de production n’en porte aucun', () => {
      const sites = readCorpus(['src']).flatMap((f) => sitesDeDelegueManuscrit(f, VERBES).map((x) => `${f.rel}:${x.ligne} ${x.texte}`));
      expect(sites, 'délégué de verbe écrit à la main : porter le verbe dans `FLOW_VERBS` (le délégué se génère)').toEqual([]);
    });
  });
});
