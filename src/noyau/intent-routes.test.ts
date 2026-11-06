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
    expect(() => buildRoutes([['jetRoll', R]], [['partyAddHero', R], ['jetRoll', R]])).toThrow(/jetRoll/);
  });

  it('la même clé DEUX FOIS dans un seul groupe lève aussi (pas de dédoublonnage silencieux)', () => {
    expect(() => buildRoutes([['raiseHand', R], ['raiseHand', R]])).toThrow(/« raiseHand »/);
  });

  it('des groupes disjoints s’assemblent, et la dernière route posée est CONSULTABLE', () => {
    const t = buildRoutes([['raiseHand', R]], [['lowerHand', { rule: () => false }]]);
    expect([...t.keys()]).toEqual(['raiseHand', 'lowerHand']);
    expect(t.get('lowerHand')!.rule({} as never, 0, [])).toBe(false);
  });

  it('une clé se nomme par un verbe invité ou de jet (#3371 §3.5)', () => {
    // @ts-expect-error aucun verbe ne porte ce nom
    const inconnue = buildRoutes([['intentQuiNExistePas', R]]);
    // @ts-expect-error verbe de l’hôte
    const deLHote = buildRoutes([['openRest', R]]);
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
  it('le repli n’est PAS une entrée de la table : la majorité des intents invités y passe', () => {
    const repli = [...GUEST_INTENTS].filter((a) => !ROUTES.has(a));
    expect(repli.length, 'population du repli universel (mesure de référence #1051, +12 exposés #1050, −1 routé #1042 : counterspellCancel porte la frontière de phase, −1 verbe purgé #1117 : `cascadeDetermine`, +1 exposé #1279 Sf : la quantité d’étape, jumelle du choix d’étape, +3 exposés #1426 : les trois verbes du LOT DE DÉS d’étal — `etalLotSetForcedRoll`/`etalLotConfirm`/`etalLotCancel` — passent VOLONTAIREMENT par le repli, qui les route à l’owner de leur modale, soit le sentinel `WORLD_STEP_OWNER` : une route dédiée y recopierait la même réponse, −2 purgés / +1 exposé #1349 G5 : `attackSetHeldGround`/`attackSetIntoCrowd` remplacés par `basculerLaPosture`, +1 exposé #1411 P2-A : `armerLaFinDuTour`, 1er temps du garde-fou « tour gâché » — geste du TOUR ACTIF, que le repli route à son propriétaire, +2 exposés #1508 : `cascadeDieRoll`/`cascadeDieSetForcedRoll`, jumeaux EXACTS des deux verbes de table — même goulot d’état, même routage par l’owner de leur étape, +1 exposé #1920 : `surgeryPassCancel`, jumeau de `surgeryNext`/`surgeryCancel` qui passent déjà par le repli — il les route à l’owner de la modale `medic`, le chirurgien de `pendingSurgery`, porteur même du jet, −1 routé #2415 : `toggleCluePin`, refusé à tout invité par le repli hors combat — il passe à `TOUJOURS` avec `markCluesSeen`, exposé et routé d’emblée, −3 verbes purgés #1765 : `battleTrample`/`trampleConfirm`/`trampleCancel`, le Piétinement passe par la manœuvre commune, +1 exposé #1595 : la Riposte (réglage `defense.riposte`), jumelle des réglages `defense.reaction`/`defense.armeDeParade`/`defense.porteBouclier` qui passent déjà par le repli — il les route à l’owner de l’étape `defense` de la cascade, le défenseur, +1 exposé #2942 : `battleClearPreview`, jumeau d’`armerLaFinDuTour` — l’aperçu armé vit dans `battle`, geste du TOUR ACTIF que le repli route à son propriétaire, −2 routés #2903 : `activityCancel`/`disengageCancel`, verbe `cancel` de leur flux mono, routés par le porteur du jet (`jetOwnedIntents`), +1 exposé #3059 : `extendedTestReverse`, la fenêtre du Test étendu appartient à son acteur (`modalArbiter`), le repli refuse tout autre siège, +1 exposé #3059 I3 : le Test du soin (réglage `heal.test`), jumeau du réglage `heal.mode` qui passe déjà par le repli — il le route à l’owner de la fenêtre de soin, le soigneur, −23 routés #2961 : 18 annulations et 5 jets manuscrits deviennent les verbes `cancel`/`roll` générés de leur flux mono, routés par le porteur du jet (`jetOwnedIntents`), −21 routés #3311 : les gestes de jet sans acteur de rangée — Round, étape, dé, annulation d’un flux multi — deviennent les verbes `jet<Verbe>(flux, …)`, routés (`routeDuVerbeDeJet`), qui rendent la décision au repli universel, −35 routés #3324 : les clôtures manuscrites deviennent le verbe `jetConfirm(flux)`, routé par le porteur du jet (flux mono) ou rendu au repli (flux multi), −6 routés #3327 : le dé d’étape de cascade (4) et la Maladresse (2) deviennent les verbes de jet de leurs flux `cascadeTirage` et `fumble`, −3 routés #3367 : les sorties de la cascade, du choix de monture et de l’infirmerie deviennent `fenetreFermer(fenetre)`, routé par le siège que le registre de la fenêtre déclare, −26 routés #3368 : les réglages des jets deviennent le verbe `jetRegler(flux, reglage, valeur)`, routé par le porteur du jet (flux mono), le porteur que la valeur désigne (Bandages) ou la rangée (arme d’enfoncement), le repli ne gardant que la fenêtre d’un flux multi, −5 sortis #3370 : `battleRun`/`battleHeal`/`battleAuContact`/`battleGrapple`/`battleShipBattery` sont la machinerie du clic (`MachinerieDuNoyau`), qui voyage par `battleClickEntity`/`battleClickTile`, −1 routé #3369 : le « Prêt » du repos devient la validation du repos `fenetreValider` sur `rest`, routée par le registre de la fenêtre), −1 routé #3367 lot B : la validation d’étape de la cascade devient la clôture `jetConfirm(\'cascade\')`, routée (`routeDuVerbeDeJet`), qui rend la décision au repli universel, −9 routés #3369 lot 2 : le Destin (3), le reniement, la cible montée, le patient et l’abandon d’opération deviennent `fenetreChoisir(fenetre, axe, valeur)`, routé par le siège que le choix déclare, la carte de l’incantation (2) devient le réglage `cast.carte`, routé par le porteur du jet, −1 routé #3369 lot 3 : « Tout résoudre » devient le jet sans rangée `jetRoll(\'cascade\')`, routé (`routeDuVerbeDeJet`), qui rend la décision au repli universel, −7 routés #3369 lot 3 : le choix et la quantité d’étape de cascade, le sacrifice et la fuite du Désengagement, l’issue d’Au Contact, la rupture et l’issue de l’Empoignade deviennent des réglages `jetRegler(flux, reglage, valeur)`, routés par le porteur du jet (flux mono) ou rendus au repli (rangée d’étape de cascade, qui n’est pas un combattant), −1 routé #3369 lot 3 : la plaie opérée devient le choix `fenetreChoisir(\'medic\', \'plaie\', uid)`, routé par le siège que le choix déclare, −41 sortis #3371 lot 2 : les 32 corps d’offre et les 9 verbes de combat fusionnés avec leur jumeau hors combat sont la machinerie de `jouerLOffre`, routé par le lieu de son offre (`lieuDeLOffre`), +4 exposés #3371 lot 2 : `desarmerLeMode`, `utiliserLObjet`, `prendreLaPanoplie` et `depenserLaDetermination`, gestes du tour actif ou de leur porteur, que le repli route à son propriétaire, −1 routé #3371 lot 4 : le réglage de la nuit `restSet` devient les choix `fenetreChoisir(\'rest\', \'couchage\' | \'pitance\', valeur, pid)`, routés par le siège que le choix déclare)').toBe(10);
    expect(ROUTES.has('armerLeMode'), 'un geste de tour ordinaire ne se route pas').toBe(false);
  });

  // Le compte ci-dessus est un CLIQUET : il constate 182 sans dire d'où vient le −1. Ici la population
  // est DÉRIVÉE — repli et routés PARTITIONNENT l'allowlist — et le mouvement de #1117 est NOMMÉ : la
  // Détermination se joue PAR RANGÉE de bande, geste `jetDetermine('cascadeBatch', pid)`, qui est routé.
  it('la population du repli est DÉRIVÉE (partition de l’allowlist) et la Détermination PAR RANGÉE est routée', () => {
    const routes = [...GUEST_INTENTS].filter((a) => ROUTES.has(a));
    const repli = [...GUEST_INTENTS].filter((a) => !ROUTES.has(a));
    expect(repli.length + routes.length, 'partition exacte de l’allowlist').toBe(GUEST_INTENTS.size);
    expect(ROUTES.has('jetDetermine'), 'la Détermination PAR RANGÉE est routée (#1117)').toBe(true);
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
