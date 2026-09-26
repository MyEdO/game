/**
 * #1051 — la TABLE UNIQUE de possession (`netOwnership.ROUTES`) : sa construction, sa forme et ses
 * frontières. `intentAllowedFor` est une lecture de cette table + le REPLI universel ; la route de
 * chaque intention se MESURE ici.
 *
 * Trois verrous :
 *  - FAIL-FAST de construction : deux groupes qui fournissent la même clé lèvent un litige NOMINATIF
 *    (l'écrasement silencieux ferait changer un verbe de route sans qu'aucun test ne le voie) ;
 *  - DISJONCTION des familles (jet / participant / hors-modale / nominatives) — l'ordre des groupes
 *    ne décide de RIEN tant qu'elles ne se recoupent pas, et le fail-fast l'exige ;
 *  - FRONTIÈRE table ⇄ repli : ce qui n'est pas routé tombe sur `repliUniversel`, dont la population
 *    est COMPTÉE ici (une route trop large déplacerait ce compte).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTES, buildRoutes, type Route } from './netOwnership';
import { jetOwnedIntents, participantOwnedIntents } from './flowVerbs';
import { horsModalOwnedIntents } from './modalArbiter';
import { GUEST_INTENTS, INTERLUDE_INTENTS } from '../net/intents';

const JET = Object.keys(jetOwnedIntents());
const PART = participantOwnedIntents();
const HM = Object.keys(horsModalOwnedIntents());
const DERIVEES = new Set([...JET, ...PART, ...HM]);
/** Routes NOMINATIVES : celles que la table pose à la main (le reste vient des registres feuilles). */
const NOM = [...ROUTES.keys()].filter((a) => !DERIVEES.has(a));

describe('#1051 — construction de la table : fail-fast sur clé dupliquée', () => {
  const R: Route = { rule: () => true };

  it('deux groupes qui fournissent la MÊME clé lèvent un litige nommant l’intent', () => {
    expect(() => buildRoutes([['castRoll', R]], [['partyAddHero', R], ['castRoll', R]])).toThrow(/castRoll/);
  });

  it('la même clé DEUX FOIS dans un seul groupe lève aussi (pas de dédoublonnage silencieux)', () => {
    expect(() => buildRoutes([['x', R], ['x', R]])).toThrow(/« x »/);
  });

  it('des groupes disjoints s’assemblent, et la dernière route posée est CONSULTABLE', () => {
    const t = buildRoutes([['a', R]], [['b', { rule: () => false }]]);
    expect([...t.keys()]).toEqual(['a', 'b']);
    expect(t.get('b')!.rule({} as never, 0, [])).toBe(false);
  });
});

describe('#1051 — les familles de routes sont DISJOINTES (invariant verrouillé par le fail-fast)', () => {
  const inter = (a: string[], b: string[]) => a.filter((x) => b.includes(x));
  const fams: Record<string, string[]> = { JET, PART, HM, NOM };

  it('aucune intersection entre les quatre familles', () => {
    const collisions: string[] = [];
    for (const [ka, a] of Object.entries(fams)) {
      for (const [kb, b] of Object.entries(fams)) {
        if (ka >= kb) continue;
        const x = inter(a, b);
        if (x.length) collisions.push(`${ka}×${kb} : ${x.join(', ')}`);
      }
    }
    expect(collisions, 'deux familles routent le même intent — l’ordre des groupes déciderait').toEqual([]);
  });

  it('aucun doublon INTERNE à une famille dérivée', () => {
    for (const [k, v] of Object.entries(fams)) {
      expect(v.filter((n, i) => v.indexOf(n) !== i), `doublon dans ${k}`).toEqual([]);
    }
  });

  it('la table est exactement l’union des quatre familles', () => {
    expect(ROUTES.size).toBe(JET.length + PART.length + HM.length + NOM.length);
    expect([...ROUTES.keys()].sort()).toEqual([...JET, ...PART, ...HM, ...NOM].sort());
  });
});

describe('#1051 — frontière table ⇄ REPLI universel', () => {
  it('le repli n’est PAS une entrée de la table : la majorité des intents invités y passe', () => {
    const repli = [...GUEST_INTENTS].filter((a) => !ROUTES.has(a));
    expect(repli.length, 'population du repli universel (mesure de référence #1051, +12 exposés #1050, −1 routé #1042 : counterspellCancel porte la frontière de phase, −1 verbe purgé #1117 : `cascadeDetermine`, +1 exposé #1279 Sf : `cascadeAmount`, jumeau de `cascadeChoose`, +3 exposés #1426 : les trois verbes du LOT DE DÉS d’étal — `etalLotSetForcedRoll`/`etalLotConfirm`/`etalLotCancel` — passent VOLONTAIREMENT par le repli, qui les route à l’owner de leur modale, soit le sentinel `WORLD_STEP_OWNER` : une route dédiée y recopierait la même réponse, −2 purgés / +1 exposé #1349 G5 : `attackSetHeldGround`/`attackSetIntoCrowd` remplacés par `battleToggleStance`, +1 exposé #1411 P2-A : `armEndTurn`, 1er temps du garde-fou « tour gâché » — geste du TOUR ACTIF, que le repli route à son propriétaire, +2 exposés #1508 : `cascadeDieRoll`/`cascadeDieSetForcedRoll`, jumeaux EXACTS des deux verbes de table — même goulot d’état, même routage par l’owner de leur étape)').toBe(188);
    expect(ROUTES.has('battleSelectAction'), 'un geste de tour ordinaire ne se route pas').toBe(false);
  });

  // Le compte ci-dessus est un CLIQUET : il constate 182 sans dire d'où vient le −1. Ici la population
  // est DÉRIVÉE — repli et routés PARTITIONNENT l'allowlist — et le mouvement de #1117 est NOMMÉ : la
  // Détermination se joue PAR RANGÉE de bande, verbe `cascadeBatchDetermine`, qui est routé.
  it('la population du repli est DÉRIVÉE (partition de l’allowlist) et la Détermination PAR RANGÉE est routée', () => {
    const routes = [...GUEST_INTENTS].filter((a) => ROUTES.has(a));
    const repli = [...GUEST_INTENTS].filter((a) => !ROUTES.has(a));
    expect(repli.length + routes.length, 'partition exacte de l’allowlist').toBe(GUEST_INTENTS.size);
    expect(ROUTES.has('cascadeBatchDetermine'), 'la Détermination PAR RANGÉE est routée (#1117)').toBe(true);
  });

  it('un intent INCONNU n’a pas de route (il tombe sur le repli, jamais sur une route voisine)', () => {
    expect(ROUTES.has('intentQuiNExistePas')).toBe(false);
  });

  it('les routes hors `GUEST_INTENTS` sont conservées et DÉCLARENT leur raison', () => {
    const hors = [...ROUTES.keys()].filter((a) => !GUEST_INTENTS.has(a)).sort();
    expect(hors, 'route hors allowlist : le geste est inatteignable par le réseau (défense en profondeur)')
      .toEqual(['chooseDialogue', 'closeDialogue', 'interactEntity']);
    for (const a of hors.filter((x) => NOM.includes(x))) {
      expect(ROUTES.get(a)!.horsAllowlist, `${a} : route hors allowlist sans justification`).toBeTruthy();
    }
  });
});

describe('#1051 — l’ancienne regex d’interlude est ÉNUMÉRÉE (4 clés explicites, bit-identiques)', () => {
  const RE_HISTORIQUE = /^interlude(Activity|CraftStart|Order|Bank)$/;

  it('les noms que la regex matchait sont EXACTEMENT les 4 clés posées', () => {
    const univers = new Set([...GUEST_INTENTS, ...ROUTES.keys()]);
    const matchés = [...univers].filter((a) => RE_HISTORIQUE.test(a)).sort();
    expect(matchés).toEqual(['interludeActivity', 'interludeBank', 'interludeCraftStart', 'interludeOrder']);
    for (const a of matchés) {
      expect(ROUTES.has(a), `${a} : la regex le routait, la table ne le route plus`).toBe(true);
      expect(INTERLUDE_INTENTS.has(a)).toBe(true);
    }
  });
});

/**
 * DoD FALSIFIABLE — `intentAllowedFor` ne porte plus AUCUNE branche par nom d'intent : sa décision
 * est la table, plus le repli.
 * LIMITE DÉCLARÉE : la garde est TEXTUELLE (elle lit le corps de la fonction dans le fichier), elle
 * prouve l'absence de branchement par nom, pas l'absence de toute logique.
 * L'énumération ci-dessous se fait sans ÉTAT (aucun `useGame` monté ni pending posé) ET par IMPORT
 * ISOLÉ : `netOwnership` ne charge plus le store (#1054), ce que garde
 * `netownership-import-isole.test.ts` — un script ou une garde CI légère peut donc lire `ROUTES`
 * hors environnement de test complet.
 */
describe('#1051 — DoD : aucune branche par nom d’intent dans `intentAllowedFor`', () => {
  const corps = (): string => {
    const src = readFileSync(join(process.cwd(), 'src', 'state', 'netOwnership.ts'), 'utf8');
    const i = src.indexOf('export function intentAllowedFor(');
    expect(i, 'fonction introuvable — la garde ne mesure plus rien').toBeGreaterThan(0);
    return src.slice(i, src.indexOf('\n}', i) + 2);
  };

  it('le corps ne compare JAMAIS `action` à un littéral (ni regex sur `action`)', () => {
    const c = corps();
    expect(/action\s*[=!]==/.test(c), 'branche par nom d’intent résiduelle').toBe(false);
    expect(/test\(action\)|action\.(startsWith|match)/.test(c), 'branchement par forme du nom').toBe(false);
  });

  it('le corps tient en quelques lignes : une lecture de table + le repli', () => {
    expect(corps().split('\n').length).toBeLessThanOrEqual(6);
  });

  it('la table est ÉNUMÉRABLE sans aucun état : ses clés se lisent à l’import', () => {
    expect(ROUTES.size).toBeGreaterThan(200);
    expect([...ROUTES.keys()].every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
    expect([...ROUTES.values()].every((r) => typeof r.rule === 'function')).toBe(true);
  });
});
