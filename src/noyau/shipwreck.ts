/**
 * NAUFRAGE EN MER — séquence de survie GÉNÉRIQUE (aucun couplage campagne), un SEUL chemin pour le site où
 * le navire de campagne coule : le combat naval perdu avec la coque coulée (`checkBattleOver`, État
 * `naufrage`, MDG 13 l.674). Une coque à 0 Blessure ne coule pas (MDG 13 l.656).
 *
 * Cascade INFLUENÇABLE (#269) : chaque héros conscient à bord tente de rejoindre la surface à la NAGE —
 * Test de Natation (LDB 09 l.372 : « votre capacité à nager dans l'eau sans vous noyer… dans des courants
 * difficiles… un Test sera nécessaire »), une ÉTAPE par héros — influençable (Chance/Pacte/Résilience) si CE
 * héros est piloté par un humain, sinon PRÉ-ROULÉE à l'ouverture (même formule) et donnée à lire — mêlant les
 * deux dans une même cascade, cf. `noyau/cascade.ts`. Aucun héros humain à bord (IA/rafale/cadence auto) →
 * résolution inline visible (patron `corruptionFlow`). Difficulté d'un naufrage en pleine mer : ancrage RAW
 * le plus proche = la noyade du Tourbillon (MDG 13 l.522 : « Natation Complexe (–10) sous peine de commencer
 * à se noyer ») → défaut MAISON `mer-naufrage-natation` (#244, éditable). Échec = noyade (LDB 18 l.344, sans
 * secours en pleine mer, la suffocation va à son terme). Un héros hors d'action (Inconscient) ne peut pas
 * nager : il sombre SANS jet. Les rescapés sont échoués au lieu le PLUS PROCHE de la position estimée (la
 * carte le sait) ; le navire et sa cargaison sont perdus ; si personne ne survit, `checkPartyWiped` présente
 * la défaite.
 */
import { nomDe } from '../engine/nom';
import { battleRng } from './battleRng';
import { nomDuNavire } from './carriers';
import { garanti } from '../lib/garanti';
import { checkPartyWiped } from './partyWipe';
import { arriverAuLieu } from './lieuFlow';
import { lieuDuGroupe, placeById, visiblePlaces, type WorldMap, type MapPlace } from './worldMap';
import { condCtx } from './bourseFlow';
import { testValue, type TestDesigne } from '../engine/skills';
import { isOutOfAction } from '../engine/conditions';
import { rule } from '../engine/policy';
import { DIFFICULTY_LABELS, type Combatant, type Difficulty } from '../engine/types';
import { startCascade } from './cascade';
import { rollSansPilote, rollStep } from './rollSeam';
import { humanControlled } from './netOwnership';
import { possessionLabel } from '../engine/possession';
import type { CascadeStep } from './pendings';
import type { Get, Set } from './flowTypes';
import { voyageStakeRef } from '../data';
import { traceLineOf } from '../engine/traceLine';
import { refLabel } from '../data';
import { t } from '../i18n';
import type { PlayerText } from '../i18n/playerText';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';
import { ligneDeTexte } from '../engine/journal';

/** Libellé du Test de survie : la Compétence vient de `skills.json` (jamais bakée), sa difficulté de
 *  la policy `mer-naufrage-natation`. UN foyer pour les DEUX chemins (inline sans pilote / applier de cascade) et
 *  pour le document que l'hôte rédige. */
export const swimTestLabel = (diff: Difficulty): PlayerText =>
  t('step.sujetPrecision', { sujet: refLabel('skills', { id: 'natation' }), precision: DIFFICULTY_LABELS[diff] });

/** Le Test du nageur d'un naufrage, et ce qu'il teste. LDB 18 l.344 */
const SUJET_NATATION = { skill: { id: 'natation' }, characteristic: 'force' } as const;
const NATATION: TestDesigne = { skill: SUJET_NATATION.skill };

/** Ce que devient un héros à bord du navire qui sombre : hors d'état, il sombre sans jet ; sinon son Test de Natation
 *  le fait nager jusqu'à la côte ou le noie. LDB 18 l.344 */
export type IssueDuNaufrage =
  | { issue: 'inconscient' }
  | { issue: 'nage' | 'noye'; test: { roll: number; target: number; sl: number; difficulty: Difficulty } };

/** Le document d'un naufrage (MDG 13 l.674) : ses FAITS, les noms vus gelés à l'écriture (`nomDe`), que l'hôte
 *  rédige. `cargaison` : la Possession qui sombre avec la coque ; `rivage` : le lieu où les rescapés s'échouent,
 *  `null` sans carte. */
export interface DocumentDeNaufrage {
  genre: 'naufrage';
  navire: { nom: string };
  cargaison: { nom: string } | null;
  heros: ({ id: string; nom: string } & IssueDuNaufrage)[];
  rivage: { id: string; nom: string } | null;
}

/** Ce qu'un naufrage sait dès qu'il coule, porté jusqu'à sa clôture (`finishShipwreck`) : le navire, sa cargaison,
 *  les héros hors d'état qui sombrent sans jet, et le rivage. */
interface NaufrageEnCours {
  navire: DocumentDeNaufrage['navire'];
  cargaison: DocumentDeNaufrage['cargaison'];
  inconscients: string[];
  rivage: MapPlace | undefined;
}

/** Le Test de Natation d'un nageur, résolu. */
interface Nage { id: string; roll: number; target: number; sl: number; success: boolean }

/** Lieu le plus proche d'un point de la carte (distance euclidienne sur `pos`) — pris dans la liste
 *  fournie par l'appelant, jamais dans `map.places` brut (un naufrage n'échoue pas le groupe sur un
 *  lieu que le récit n'a pas révélé, #684). */
function nearestPlaceTo(places: MapPlace[], pos: { x: number; y: number }): MapPlace | undefined {
  let best: MapPlace | undefined;
  let bestD = Infinity;
  for (const p of places) {
    const d = (p.pos.x - pos.x) ** 2 + (p.pos.y - pos.y) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** Lieu d'échouage : le plus proche de la position estimée sur la traversée (`kmDone/km` interpolé entre
 *  départ et arrivée), sinon le lieu où se tient le groupe. `undefined` = pas de carte (on reste sur place). */
function shorePlace(get: Get): MapPlace | undefined {
  const map = get().worldMap as WorldMap | undefined;
  if (!map) return undefined;
  const plan = get().travelPlan;
  if (plan?.fromPlaceId && plan.toPlaceId) {
    const from = placeById(map, plan.fromPlaceId);
    const to = placeById(map, plan.toPlaceId);
    if (from && to) {
      const frac = plan.km > 0 ? Math.max(0, Math.min(1, plan.kmDone / plan.km)) : 0;
      const est = { x: from.pos.x + (to.pos.x - from.pos.x) * frac, y: from.pos.y + (to.pos.y - from.pos.y) * frac };
      return nearestPlaceTo(visiblePlaces(map, condCtx(get)), est);
    }
  }
  return lieuDuGroupe(get());
}

/**
 * NAUFRAGE : le navire de campagne coule. Résout la survie à la nage de chaque héros à bord (cascade
 * influençable pour les pilotes humains, cf. en-tête), échoue les rescapés au rivage le plus proche, PURGE
 * le navire (coque + cargaison perdues, IMMÉDIAT — indépendant de l'issue des jets) et surface le
 * dénouement (modale document + journal). `aboardIds` : héros à bord (défaut = tout le groupe vivant) — le
 * combat naval passe l'équipage de la coque coulée. Le navire qui sombre est celui de campagne, sinon
 * (passage) celui du voyage (`travelPlan.vehicle`) : l'un des deux est requis.
 */
export function beginShipwreck(get: Get, set: Set, opts: { aboardIds?: string[] } = {}): void {
  const vessel = get().vessel;
  const navire = { nom: vessel ? nomDuNavire(vessel) : nomDe(garanti(get().travelPlan?.vehicle, get().travelPlan?.routeId, 'navire qui sombre')) };
  const diff = rule('mer-naufrage-natation') as Difficulty;
  const shore = shorePlace(get);
  const aboardSet = opts.aboardIds ? new Set(opts.aboardIds) : null;
  const isAboard = (h: Combatant) => (aboardSet ? aboardSet.has(h.id) : !h.dead);

  // MDG 13 l.674
  const opening: string[] = [t('wreck.sinks', { ship: navire.nom })];
  let cargaison: DocumentDeNaufrage['cargaison'] = null;
  // Cascade Possession (#618 SOCLE POSSESSIONS) : `CampaignVessel` et `Possession{nature:'navire'}`
  // n'ont pas de `uid` partagé — la clé de jointure est `vehicleId` (`NavalPossessionState` miroite déjà
  // `CampaignVessel`, `engine/possession.ts`). Navire trouvé au registre → sa Possession et toute
  // embarquée dessus (`hostUid`) passent `destroyed` (fret/monture/véhicule sombrent AVEC la coque,
  // MDG 13 l.674 « corps et biens ») ; sans correspondance, la purge legacy `vessel:null` ci-dessus reste
  // seule.
  if (vessel) {
    const sunk = get().possessions.find((p) => p.nature === 'navire' && p.vehicleId === vessel.vehicleId && !p.destroyed);
    if (sunk) {
      set({
        possessions: get().possessions.map((p) => {
          if (p.uid === sunk.uid) return { ...p, destroyed: true };
          if (p.location.kind === 'embarquee' && p.location.hostUid === sunk.uid) return { ...p, destroyed: true };
          return p;
        }),
      });
      cargaison = { nom: possessionLabel(sunk) };
      opening.push(t('wreck.cargoSinks', { label: cargaison.nom }));
    }
  }
  const swimmerIds: string[] = [];
  const inconscients: string[] = [];
  const party = get().party.map((h) => {
    if (!isAboard(h) || h.dead) return h;
    // Un héros HORS D'ÉTAT ne peut pas nager (LDB 18 l.344 : suffocation) → il sombre — prédicat de
    // cycle de vie canonique (`isOutOfAction`, machinerie universelle), jamais un test par-État nommé.
    // Un rescapé passé par-dessus bord (`outOfRencontre`, MDG 13) reste conscient : il nage ci-dessous —
    // `outOfRencontre` seul (l'éjection du COMBAT que ce naufrage vient de résoudre) n'incapacite pas,
    // donc écarté du prédicat ; dead/inconscient/Mort Subite restent des voies RÉELLES d'incapacité.
    if (isOutOfAction({ ...h, outOfRencontre: false })) {
      opening.push(t('wreck.unconscious', { name: nomDe(h) }));
      inconscients.push(h.id);
      return { ...h, dead: true };
    }
    swimmerIds.push(h.id);
    return h;
  });
  // Navire + cargaison sombrent avec la coque (#244, règle 7) : purgé IMMÉDIATEMENT, indépendant de
  // l'issue des jets de Natation (le navire est perdu dès qu'il coule, pas seulement s'il y a des noyés).
  set({ party, vessel: null, travelPlan: null, travelRecap: null, worldMapOpen: false });
  get().ecrireAuJournal([t('wreck.banner'), ...opening]);

  const naufrage: NaufrageEnCours = { navire, cargaison, inconscients, rivage: shore };
  if (!swimmerIds.length) { emitShipwreckLines(get, finishShipwreck(get, set, naufrage, [], diff)); return; }

  const swimmers = swimmerIds.map((id) => get().party.find((h) => h.id === id)!);
  const rng = battleRng();

  // Repli AUCUN pilote humain à bord (IA/rafale/cadence auto) : résolution inline VISIBLE (patron
  // `corruptionFlow` — un pilote humain remonte en modale, sinon on résout et on journalise).
  if (!swimmers.some((h) => humanControlled(get(), h))) {
    const lines: string[] = [];
    const nages: Nage[] = [];
    for (const h of swimmers) {
      // Aucune rangée nulle part sur ce chemin (repli sans pilote humain, aucune cascade démarrée) —
      // le journal est la SEULE surface, et sa ligne se DÉRIVE (`traceLineOf`) comme toute ligne de dé.
      const value = testValue(h, SUJET_NATATION);
      const tr = rollSansPilote(get, h, NATATION, value, diff, rng);
      lines.push(traceLineOf({
        who: nomDe(h), label: swimTestLabel(diff), roll: tr.roll, target: tr.target, success: tr.success,
        // LDB 18 l.344
        issue: tr.success ? t('wreck.issueSwims') : t('wreck.issueDrowns'),
      }));
      nages.push({ id: h.id, roll: tr.roll, target: tr.target, sl: tr.sl, success: tr.success });
      if (tr.success) { h.outOfRencontre = false; h.exitReason = undefined; } else h.dead = true;
    }
    set({ party: [...get().party] });
    emitShipwreckLines(get, [...lines, ...finishShipwreck(get, set, naufrage, nages, diff)]);
    return;
  }

  // Cascade influençable : une étape de Natation par nageur conscient. Le héros qu'aucun siège ne
  // pilote voit son jet PRÉ-ROULÉ (même formule) et son étape est une lecture — c'est le jet POSÉ +
  // la non-surface du porteur qui la rendent passive au socle (`rollFlowFactory.passive`), jamais un
  // drapeau d'étape. La clôture (dernière étape validée) exécute `finishShipwreck` —
  // `purpose:'test'` : aucun crochet dédié requis dans le store (générique, `dispatchCascadeDone`
  // n'a rien à router).
  const meta = { shoreId: shore?.id ?? '', navire: navire.nom, cargaison: cargaison?.nom, inconscients };
  const steps: CascadeStep[] = swimmers.map((h) => {
    const value = testValue(h, SUJET_NATATION);
    const human = humanControlled(get(), h);
    const result = human ? null : (() => { const t = rollSansPilote(get, h, NATATION, value, diff, rng); return { roll: t.roll, target: t.target, sl: t.sl, success: t.success }; })();
    return {
      id: `shipwreck-${h.id}`, kind: 'naufrageNatation', actorId: h.id, icon: 'nautique/natation',
      label: t('step.natation'), rollLabel: refLabel('skills', { id: 'natation' }), difficulty: diff, teste: structuredClone(NATATION), // #2097
      ...rollStep({ actor: h, test: SUJET_NATATION, difficulty: diff }),
      stake: voyageStakeRef('mer-naufrage-nage'),
      result,
      meta,
    };
  });
  startCascade(get, set, { title: t('wreck.title'), icon: 'nautique/natation', purpose: 'test', steps });
}

/** Journalise (réellement, `get().ecrireAuJournal`) une liste de lignes accumulées AVANT qu'elles n'existent dans
 *  le journal (chemin inline/sans-nageur — le pilote CASCADE les fait vivre via le retour d'applier,
 *  poussées par `commitStep`). Petite brique pour ne pas dupliquer la boucle aux deux sites inline. */
function emitShipwreckLines(get: Get, lines: string[]): void {
  for (const l of lines) get().ecrireAuJournal(l);
}

/** Clôture commune (inline ET cascade) : rescapés = les nageurs dont le Test de Natation a réussi, échouage au
 *  rivage le plus proche (`arriverAuLieu`), document du naufrage (`DocumentDeNaufrage`, l'issue de chaque héros dans
 *  l'ordre du groupe), puis `checkPartyWiped`. Renvoie les lignes à journaliser par l'appelant (dans le BON ordre —
 *  cascade : via le retour d'applier ; inline : via `emitShipwreckLines`). */
function finishShipwreck(get: Get, set: Set, naufrage: NaufrageEnCours, nages: Nage[], difficulty: Difficulty): string[] {
  const shore = naufrage.rivage;
  const heros = get().party.flatMap((h): DocumentDeNaufrage['heros'] => {
    const nage = nages.find((n) => n.id === h.id);
    if (nage) return [{ id: h.id, nom: nomDe(h), issue: nage.success ? 'nage' : 'noye', test: { roll: nage.roll, target: nage.target, sl: nage.sl, difficulty } }];
    return naufrage.inconscients.includes(h.id) ? [{ id: h.id, nom: nomDe(h), issue: 'inconscient' }] : [];
  });
  const survivors = heros.filter((h) => h.issue === 'nage').map((h) => h.nom);
  const lines: string[] = [];
  if (shore) lines.push(survivors.length
    ? t('wreck.survivors', { names: survivors.join(', '), place: shore.label })
    : t('wreck.noSurvivor'));
  // #686
  if (survivors.length && shore) arriverAuLieu(set, shore);
  get().remettreLeDocument({
    genre: 'naufrage', navire: naufrage.navire, cargaison: naufrage.cargaison, heros,
    rivage: shore ? { id: shore.id, nom: shore.label } : null,
  });
  // Aucun survivant → défaite hors combat (écran unique `checkPartyWiped`).
  checkPartyWiped(get, set);
  return lines;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = ['naufrageNatation'] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    /** Étape-jet de Natation d'un naufrage (#269) : succès → rescapé (sort de la rencontre) ; échec → noyé
     *  (LDB 18 l.344). La DERNIÈRE étape validée déclenche la clôture complète (`finishShipwreck`). */
    naufrageNatation: (get, set, step, hero, ctx) => {
      if (!step.result || !hero) return;
      const diff = rule('mer-naufrage-natation') as Difficulty;
      const success = step.result.success;
      // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
      const line = t('wreck.applierLine', {
        name: nomDe(hero), test: swimTestLabel(diff),
        issue: success ? t('wreck.issueSwims') : t('wreck.issueDrowns'),
      });
      if (success) { hero.outOfRencontre = false; hero.exitReason = undefined; } else hero.dead = true;
      set({ party: [...get().party] });
      if (ctx.index !== ctx.steps.length - 1) return { applique: { lignes: [ligneDeTexte(line)], faits: [] } };
      const m = step.meta ?? {};
      const shoreId = String(m.shoreId ?? '');
      const naufrage: NaufrageEnCours = {
        navire: { nom: String(m.navire) },
        cargaison: m.cargaison ? { nom: String(m.cargaison) } : null,
        inconscients: (m.inconscients as string[] | undefined) ?? [],
        rivage: shoreId ? placeById(get().worldMap as WorldMap, shoreId) : undefined,
      };
      // L'étape en cours porte SON résultat ; les nageurs précédents, le leur (`ctx.steps`).
      const nages = ctx.steps.filter((s) => s.kind === 'naufrageNatation').map((s) => {
        const r = garanti(s.id === step.id ? step.result : s.result, s.id, 'Test de Natation résolu');
        return { id: s.actorId!, roll: garanti(r.roll, s.id, 'dé de Natation'), target: garanti(r.target, s.id, 'cible de Natation'), sl: r.sl, success: r.success };
      });
      return { applique: { lignes: [ligneDeTexte(line), ...finishShipwreck(get, set, naufrage, nages, diff).map((x) => ligneDeTexte(x))], faits: [] } };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
} satisfies FragmentDeTables;
