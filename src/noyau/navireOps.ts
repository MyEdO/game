/**
 * La cible `navire` d'un EffectOp (#1652) : la COQUE du navire de campagne — sa coque de trajet quand un
 * voyage la porte, sinon sa coque bâtie depuis `vessel` (l'escale). Les ops de NAVIRE (`OPS_DU_NAVIRE`,
 * `engine/ops.ts`) s'y résolvent ici, les autres passent par `applyLeafOps` sur cette coque, puis ses
 * Blessures sont persistées sur `vessel.wounds`. MDG 15 l.83-125, l.132-263
 */
import { t } from '../i18n';
import { garanti } from '../lib/garanti';
import { rollDice, tirerSigne, type RNG } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import { deDeTirageDe } from '../data/rangees';
import { MINUTES_PER_DAY, toDate } from '../engine/clock';
import { estOpDuNavire, nomDeSource, resolveFormula, type GameOp, type OpDuNavire, type OpsCtx } from '../engine/ops';
import type { EffectOp } from '../engine/flowCore';
import type { Combatant } from '../engine/types';
import { addManann, applyManannFactor, cargoBasePrice, meteosActives, modificateursActifs, rollRandomCargo, type ModificateurDuNavire } from '../engine/seaVoyage';
import { ajouterAuRoster } from '../engine/crewMorale';
import { seasonOfMonth } from '../engine/travelStages';
import { isRation } from '../engine/provisions';
import { newUid } from '../engine/items';
import { rollShipCritical } from '../engine/shipCritical';
import { dataLabel, findCrewRoleById, voyageStakeRef } from '../data';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { applyShipMoraleDelta, applyVesselCrewLoss, shipboardSouls } from './shipCrew';
import { applyVesselCritical, buildVoyageCrewStep, coqueDuNavireDeCampagne, entrerDansLeTourbillon, heurterLePeril, localisationAleatoire, navireHostileEnVue, noteSeaLine, persistHullWounds, setVesselHull, vesselManann, voyageShip } from './seaVoyageFlow';
import { findSeaHazard } from '../engine/seaPerils';
import { applyLeafOps, OPS_DIFFEREES } from './combatEffects';
import { startCascade } from './cascade';
import type { Get, Set } from './flowTypes';

/** La coque visée par `navire`, et l'écriture qui la persiste ; `null` sans navire de campagne à coque. */
function coqueVisee(get: Get, set: Set): { coque: Combatant; persister: () => void } | null {
  const plan = get().travelPlan;
  const enVoyage = coqueDuNavireDeCampagne(plan, get().vessel);
  if (plan && enVoyage) {
    return { coque: enVoyage, persister: () => { const p = get().travelPlan; if (p) set({ travelPlan: { ...p } }); persistHullWounds(get, set); } };
  }
  const bati = voyageShip(get);
  if (!bati) return null;
  return { coque: bati.hull, persister: () => setVesselHull(get, set, bati.hull.wounds.current, bati.hull.wounds.max) };
}

/** Jours tirés d'une durée de navire, sur la coque : jamais négatifs. */
const joursTires = (f: Parameters<typeof resolveFormula>[0], coque: Combatant, ctx: OpsCtx): number => Math.max(0, Math.round(resolveFormula(f, coque, ctx.rng)));

/** Résout UNE op de navire sur `coque` ; rend ses lignes. `ctx.label` = la source de l'état posé. */
function appliquerOpDuNavire(get: Get, set: Set, coque: Combatant, o: OpDuNavire, ctx: OpsCtx): string[] {
  switch (o.op) {
    case 'shipMorale':
      return applyShipMoraleDelta(get, set, coque, tirerSigne(o.delta, ctx.rng));
    case 'manann': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const mood = vesselManann(vessel);
      if (o.factorId !== undefined) {
        const deja = mood.applied.includes(o.factorId);
        const { mood: next, delta, label } = applyManannFactor(mood, o.factorId, ctx.rng);
        if (deja) return [t('eff.manannAlready', { factor: label ?? o.factorId })];
        set({ vessel: { ...vessel, manann: next } });
        return [t('eff.manannFactor', { delta: `${delta >= 0 ? '+' : ''}${delta}`, factor: label ?? o.factorId })];
      }
      const delta = tirerSigne(o.delta, ctx.rng);
      set({ vessel: { ...vessel, manann: addManann(mood, delta) } });
      return [t('sv.manannMood', { delta: `${delta >= 0 ? '+' : ''}${delta}`, score: vesselManann(get().vessel).score })];
    }
    case 'shipCritical': {
      const n = Math.max(0, Math.round(resolveFormula(o.count, coque, ctx.rng)));
      for (let i = 0; i < n; i++) {
        applyVesselCritical(get, set, rollShipCritical(o.location === 'aleatoire' ? localisationAleatoire(ctx.rng) : o.location, ctx.rng));
      }
      return [];
    }
    case 'navireMod': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const now = get().gameTime;
      const jusqua: ModificateurDuNavire['jusqua'] = typeof o.jusqua === 'string' ? o.jusqua : now + joursTires(o.jusqua.jours, coque, ctx) * MINUTES_PER_DAY;
      const label = nomDeSource(ctx);
      const mod: ModificateurDuNavire = {
        label, ...(o.m !== undefined ? { m: o.m } : {}), ...(o.manDR !== undefined ? { manDR: o.manDR } : {}), ...(o.evite ? { evite: [...o.evite] } : {}), jusqua,
      };
      set({ vessel: { ...vessel, modificateurs: [...modificateursActifs(vessel.modificateurs, now), mod] } });
      const axes = [
        ...(o.m !== undefined ? [t('eff.navireModM', { m: signe(o.m) })] : []),
        ...(o.manDR !== undefined ? [t('eff.navireModMan', { dr: signe(o.manDR) })] : []),
        ...(o.evite ? [t('eff.navireModEvite', { perils: o.evite.map(libelleDuPeril).join(', ') })] : []),
      ];
      const duree = typeof jusqua === 'number' ? t('eff.pendantNJours', { n: (jusqua - now) / MINUTES_PER_DAY }) : jusqua === 'carenage' ? t('eff.jusquAuCarenage') : t('eff.jusquAuProchainEvenement');
      return [t('eff.navireMod', { label, axes: axes.join(', '), duree })];
    }
    case 'meteoImposee': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const now = get().gameTime;
      const jours = joursTires(o.jours, coque, ctx);
      const label = nomDeSource(ctx);
      const meteo = {
        label, jusqua: now + jours * MINUTES_PER_DAY,
        ...(o.meteo ? { meteo: { ...o.meteo } } : {}),
        ...(o.ventInverse ? { ventInverse: true as const } : {}),
        ...(o.aggravation ? { aggravation: structuredClone(o.aggravation) } : {}), // #2097
      };
      set({ vessel: { ...vessel, meteosImposees: [...meteosActives(vessel.meteosImposees, now), meteo] } });
      return [t('eff.meteoImposee', { label, n: jours })];
    }
    case 'cargaison': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      if (o.perteAuDechargement !== undefined) {
        const perte = Math.max(0, Math.round(resolveFormula(o.perteAuDechargement, coque, ctx.rng)));
        set({ vessel: { ...vessel, perteAuDechargement: perte } });
        return [t('eff.perteAuDechargement', { enc: perte })];
      }
      const enc = Math.max(0, Math.round(resolveFormula(o.enc, coque, ctx.rng)));
      const season = seasonOfMonth(toDate(get().gameTime).month);
      const cargo = rollRandomCargo(season, ctx.rng);
      set({ vessel: { ...vessel, cargo: [...(vessel.cargo ?? []), { uid: newUid(), cargoId: cargo.id, enc, basePriceGold: cargoBasePrice(cargo, season, ctx.rng) }] } });
      return [t('eff.cargaison', { enc, cargo: cargo.label })];
    }
    case 'provisions':
      return o.gateesPct !== undefined ? gaterLesProvisions(get, set, o.gateesPct) : ajouterDesVivres(get, set, joursTires(o.jours, coque, ctx));
    case 'equipage':
      return changerLEquipage(get, set, Math.round(resolveFormula(o.delta, coque, ctx.rng)), o.role?.id, o.sansSolde);
    case 'perilDeMer':
      return o.collision !== undefined ? heurterLePeril(get, set, coque, o.collision.id, ctx.rng) : entrerDansLeTourbillon(get, set, o.tourbillon.id, nomDeSource(ctx));
    case 'navireHostile':
      return navireHostileEnVue(get, set, coque, o, nomDeSource(ctx));
  }
}

/** Libellé d'un péril de `sea-perils.json`. */
const libelleDuPeril = (id: string): string => garanti(findSeaHazard(id), id, 'péril en mer').label;

/** Change l'effectif de `delta` marins (`applyVesselCrewLoss`, borné à l'effectif nominal) ; un recueilli au
 *  rôle `roleId` entre au roster `crew`, ou à `recueillisSansSolde` jusqu'au prochain port. MDG 15 l.202-204,
 *  l.213-218, l.258 ; MDG 14 l.293-302 */
function changerLEquipage(get: Get, set: Set, delta: number, roleId: string | undefined, sansSolde: 'jusquAuPort' | undefined): string[] {
  const lignes = applyVesselCrewLoss(get, set, -delta);
  if (delta > 0 && !lignes.length) lignes.push(t('eff.equipageComplet'));
  if (delta <= 0 || roleId === undefined) return lignes;
  const vessel = garanti(get().vessel, 'equipage', 'navire de campagne de la coque visée');
  const champ = sansSolde ? 'recueillisSansSolde' : 'crew';
  set({ vessel: { ...vessel, [champ]: ajouterAuRoster(vessel[champ], roleId, delta) } });
  return [...lignes, t('eff.equipageRole', { n: delta, role: dataLabel(garanti(findCrewRoleById(roleId), roleId, 'rôle d’équipage').label), sansSolde: sansSolde ? t('eff.equipageSansSolde') : '' })];
}

/** Gâte `pct` % des provisions à bord : les vivres de la cale (`vessel.provisions`) et les rations de chaque
 *  héros, arrondi à l'entier inférieur. MDG 15 l.169-170 */
function gaterLesProvisions(get: Get, set: Set, pct: number): string[] {
  let jetees = 0;
  const party = get().party.map((h) => {
    let n = Math.floor((h.items ?? []).filter(isRation).length * pct / 100);
    if (!n) return h;
    jetees += n;
    return { ...h, items: h.items!.filter((it) => !(isRation(it) && n-- > 0)) };
  });
  set({ party });
  const lignes = [t('sv.rationsSpoiled', { n: jetees })];
  const vessel = garanti(get().vessel, 'provisions', 'navire de campagne de la coque visée');
  if (vessel.provisions == null) return lignes;
  const perdues = Math.floor(vessel.provisions * pct / 100);
  set({ vessel: { ...vessel, provisions: vessel.provisions - perdues } });
  return [...lignes, t('eff.provisionsGatees', { perdues, total: vessel.provisions - perdues })];
}

/** Ajoute `jours` jours de vivres de l'équipage (une ration par marin et par jour) aux provisions de la
 *  cale. MDG 15 l.235-236 ; MDG 14 l.238 */
function ajouterDesVivres(get: Get, set: Set, jours: number): string[] {
  const vessel = garanti(get().vessel, 'provisions', 'navire de campagne de la coque visée');
  if (vessel.provisions == null) return [t('eff.provisionsSansSuivi')];
  const equipage = shipboardSouls(get()).crew;
  const rations = jours * equipage;
  set({ vessel: { ...vessel, provisions: vessel.provisions + rations } });
  return [t('eff.provisionsJours', { n: jours, equipage, rations, total: vessel.provisions + rations })];
}

const signe = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

/**
 * Ouvre le TEST D'ÉQUIPAGE d'un nœud `test` de Flow (`crewTestType`) : l'étape à participants du voyage
 * (`buildVoyageCrewStep`), dont l'applier `flowCrewTest` (`seaVoyageFlow.ts`) joue la branche du verdict
 * puis `after`. Son enjeu est celui que le Test nomme, sinon celui du type de Test. `false` : aucun marin
 * apte à bord, l'appelant joue l'échec. MDG 14 l.39 ; MDG 15 l.144-145
 */
export function ouvrirLeTestDEquipage(get: Get, set: Set, node: Extract<Flow, { kind: 'test' }>, after: Flow, label: string, sl?: number): boolean {
  const { crewTestType, difficulty, stake } = node.test;
  const type = garanti(crewTestType, label, 'type de Test d’équipage');
  const st = buildVoyageCrewStep(get, type, 'flowCrewTest', { ...(difficulty ? { difficulty } : {}), stake: stake ?? voyageStakeRef(type) });
  if (!st) return false;
  startCascade(get, set, {
    title: label, icon: 'travel/anchor', purpose: 'test',
    steps: [{ ...st, meta: { ...st.meta, onSuccess: node.success, onFail: node.fail, after, flowLabel: label, ...(sl !== undefined ? { flowSl: sl } : {}) } }],
  });
  return true;
}

type TableEnLigne = Extract<GameOp, { op: 'rollTable'; entries: unknown }>;

/** Une table à rangées en ligne dont une rangée porte une op de NAVIRE : elle se tire à la portée du navire,
 *  où ses ops se résolvent ; `applyOps` les laisserait inertes. MDG 15 l.213-218, l.258 */
const estTableDuNavire = (o: GameOp): o is TableEnLigne =>
  o.op === 'rollTable' && 'entries' in o && o.entries.some((r) => r.ops.some((x) => estOpDuNavire(x) || estTableDuNavire(x)));

/** La rangée tirée d'une table de navire : son dé, `mod` compris. */
const rangeeTiree = (o: TableEnLigne, rng: RNG) => findTableEntry(o.entries, rollDice(deDeTirageDe(o), rng) + (o.mod ?? 0));

/** Applique la feuille `e` (`on: 'navire'`) au navire de campagne, ops dans l'ordre authoré ; rend les
 *  lignes du journal (aussi posées au recap du jour en mer). */
export function appliquerAuNavire(get: Get, set: Set, e: EffectOp, base: OpsCtx): string[] {
  const visee = coqueVisee(get, set);
  if (!visee) return [t('eff.navireAbsent')];
  const { coque, persister } = visee;
  const ctx: OpsCtx = { ...base, hull: coque };
  const lignes: string[] = [];
  let pures: GameOp[] = [];
  const viderLesPures = (): void => {
    if (!pures.length) return;
    const issue = applyLeafOps(get, set, coque, { ...e, ops: pures }, ctx);
    if (issue === OPS_DIFFEREES) throw new Error(`#1652 — une op à dé ouvert à la porte vise le navire (${pures.map((o) => o.op).join(', ')}) : son applier ne retrouverait pas la coque.`);
    lignes.push(...issue);
    pures = [];
    persister();
  };
  const file = [...e.ops];
  while (file.length) {
    const o = file.shift()!;
    if (estTableDuNavire(o)) { file.unshift(...rangeeTiree(o, ctx.rng).ops); continue; }
    if (!estOpDuNavire(o)) { pures.push(o); continue; }
    viderLesPures();
    lignes.push(...appliquerOpDuNavire(get, set, coque, o, ctx));
  }
  viderLesPures();
  noteSeaLine(get, set, lignes);
  return lignes;
}
