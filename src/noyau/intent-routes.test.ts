/**
 * #1051 — la TABLE UNIQUE de possession (`netOwnership.ROUTES`) : sa construction, sa forme et ses
 * frontières. `intentAllowedFor` est une lecture de cette table + le REPLI universel ; la route de
 * chaque intention se MESURE ici.
 *
 * Trois verrous :
 *  - FAIL-FAST de construction : deux groupes qui fournissent la même clé lèvent un litige NOMINATIF
 *    (l'écrasement silencieux ferait changer un verbe de route sans qu'aucun test ne le voie) ;
 *  - DISJONCTION des familles (jet / nominatives) — l'ordre des groupes
 *    ne décide de RIEN tant qu'elles ne se recoupent pas, et le fail-fast l'exige ;
 *  - FRONTIÈRE table ⇄ repli : ce qui n'est pas routé tombe sur `repliUniversel`, dont la population
 *    est COMPTÉE ici (une route trop large déplacerait ce compte).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTES, buildRoutes, type Route } from './netOwnership';
import { NOM_DU_VERBE_DE_JET } from './flowVerbs';
import { GUEST_INTENTS, INTERLUDE_INTENTS, PARTY_INTENTS } from './intentionsDeSiege';

const JET = Object.values(NOM_DU_VERBE_DE_JET);
const DERIVEES = new Set<string>(JET);
/** Routes NOMINATIVES : celles que la table pose à la main (le reste vient des registres feuilles). */
const NOM = [...ROUTES.keys()].filter((a) => !DERIVEES.has(a));

describe('#1051 — construction de la table : fail-fast sur clé dupliquée', () => {
  const R: Route = { rule: () => true };

  it('deux groupes qui fournissent la MÊME clé lèvent un litige nommant l’intent', () => {
    expect(() => buildRoutes([['jetLancer', R]], [['recruterLeHeros', R], ['jetLancer', R]])).toThrow(/jetLancer/);
  });

  it('la même clé DEUX FOIS dans un seul groupe lève aussi (pas de dédoublonnage silencieux)', () => {
    expect(() => buildRoutes([['leverLaMain', R], ['leverLaMain', R]])).toThrow(/« leverLaMain »/);
  });

  it('des groupes disjoints s’assemblent, et la dernière route posée est CONSULTABLE', () => {
    const t = buildRoutes([['leverLaMain', R]], [['fenetreValider', { rule: () => false }]]);
    expect([...t.keys()]).toEqual(['leverLaMain', 'fenetreValider']);
    expect(t.get('fenetreValider')!.rule({} as never, 0, [])).toBe(false);
  });

  it('une clé se nomme par un verbe invité ou de jet (#3371 §3.5)', () => {
    // @ts-expect-error aucun verbe ne porte ce nom
    const inconnue = buildRoutes([['intentQuiNExistePas', R]]);
    // @ts-expect-error verbe de l’hôte
    const deLHote = buildRoutes([['ouvrirLeRepos', R]]);
    expect([inconnue, deLHote].map((t) => t.size)).toEqual([1, 1]);
  });
});

describe('#1051 — les familles de routes sont DISJOINTES (invariant verrouillé par le fail-fast)', () => {
  const inter = (a: string[], b: string[]) => a.filter((x) => b.includes(x));
  const fams: Record<string, string[]> = { JET, NOM };

  it('aucune intersection entre les familles', () => {
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

  it('la table est exactement l’union des familles', () => {
    expect(ROUTES.size).toBe(JET.length + NOM.length);
    expect([...ROUTES.keys()].sort()).toEqual([...JET, ...NOM].sort());
  });
});

describe('#1051 — frontière table ⇄ REPLI universel', () => {
  it('le repli n’est PAS une entrée de la table : il porte les gestes routés au propriétaire de ce qu’ils touchent', () => {
    const repli = [...GUEST_INTENTS].filter((a) => !ROUTES.has(a)).sort();
    expect(repli, 'population du repli universel : chacun se route au propriétaire du tour actif (`effacerLApercu`, `desarmerLeMode`, les verbes de la barre de l’actif), de son porteur (`prendreLaPanoplie`), ou du mobile (`franchirLArete`), sauf la Détermination, routée au siège qui influence son porteur ; un geste qui entre au repli ou en sort se nomme ici').toEqual([
      'aiderLEquipe', 'annulerLeDeplacement', 'approvisionnerLArme', 'armerLAttaque', 'armerLeMode', 'aspergerDEau', 'basculerLaPosture',
      'basculerLaRepousse', 'chanterLaChanson', 'desarmerLeMode', 'effacerLApercu', 'entrerEnFrenesie',
      'faireUnBattement', 'franchirLArete', 'gagnerLAvantage', 'lancerLAttaqueDeZone', 'manoeuvrerLeNavire', 'manoeuvrerSurSoi', 'mettrePiedATerre',
      'monterEnSelle', 'pousserLEngin', 'prendreLaDefensive', 'prendreLaPanoplie', 'prendreLaVisee', 'quitterLePoste',
      'ramasserLObjet', 'rechargerLArme', 'rompreLEngagement', 'seRelever', 'seRemettreDeLEtat', 'servirLePoste',
      'tenterDeDistraire', 'terminerLeTour',
    ]);
    expect(ROUTES.has('armerLeMode'), 'un geste de tour ordinaire ne se route pas').toBe(false);
  });

  // La population est DÉRIVÉE : repli et routés PARTITIONNENT l'allowlist. La Détermination se joue à la barre comme
  // sur la rangée d'une bande, un seul geste `depenserLaDetermination(porteur, …)`, qui est routé.
  it('la population du repli est DÉRIVÉE (partition de l’allowlist) et la Détermination est routée', () => {
    const routes = [...GUEST_INTENTS].filter((a) => ROUTES.has(a));
    const repli = [...GUEST_INTENTS].filter((a) => !ROUTES.has(a));
    expect(repli.length + routes.length, 'partition exacte de l’allowlist').toBe(GUEST_INTENTS.size);
    expect(ROUTES.has('depenserLaDetermination'), 'la Détermination est routée (#1117, #3612 L5)').toBe(true);
  });

  it('GARDE DE CLASSE (#2415) : tout intent de GROUPE a sa route — hors combat, le repli le refuserait à tout invité', () => {
    const sansRoute = [...PARTY_INTENTS].filter((a) => !ROUTES.has(a));
    expect(sansRoute, 'intent de PARTY_INTENTS sans entrée dans ROUTES : le repli (`seatOwns(…, undefined)` hors combat) le réserve à l’hôte, surface morte pour l’invité').toEqual([]);
  });

  it('un intent INCONNU n’a pas de route (il tombe sur le repli, jamais sur une route voisine)', () => {
    expect(ROUTES.has('intentQuiNExistePas')).toBe(false);
  });

  it('toute route est celle d’un geste que l’invité envoie (`GUEST_INTENTS`)', () => {
    expect([...ROUTES.keys()].filter((a) => !GUEST_INTENTS.has(a)), 'route d’un geste que le réseau ne porte pas').toEqual([]);
  });
});

describe('#1051 — les Activités d’interlude sont routées par une clé explicite chacune', () => {
  it('chaque verbe d’Activité a sa route et son intent d’interlude', () => {
    for (const a of ['deposerALaBanque', 'commanderLObjet', 'solderLaFaveur'] as const) {
      expect(ROUTES.has(a), `${a} : la table ne le route pas`).toBe(true);
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
 * ISOLÉ : `netOwnership` vit au noyau, auquel `src/state` est fermé (`COUCHES`, #1054) — un script ou
 * une garde CI légère peut donc lire `ROUTES` hors environnement de test complet.
 */
describe('#1051 — DoD : aucune branche par nom d’intent dans `intentAllowedFor`', () => {
  const corps = (): string => {
    const src = readFileSync(join(process.cwd(), 'src', 'noyau', 'netOwnership.ts'), 'utf8');
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
    expect(Object.values(NOM_DU_VERBE_DE_JET).filter((n) => !ROUTES.has(n))).toEqual([]);
    expect([...ROUTES.keys()].every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
    expect([...ROUTES.values()].every((r) => typeof r.rule === 'function')).toBe(true);
  });
});
