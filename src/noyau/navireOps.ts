/**
 * La cible `navire` d'un EffectOp (#1652) : la COQUE du navire de campagne — sa coque de trajet quand un
 * voyage la porte, sinon sa coque bâtie depuis `vessel` (l'escale). Les ops de NAVIRE (`OPS_DU_NAVIRE`,
 * `engine/ops.ts`) s'y résolvent ici, les autres passent par `applyLeafOps` sur cette coque, puis ses
 * Blessures sont persistées sur `vessel.wounds`. MDG 15 l.83-125, l.132-263
 */
import { t } from '../i18n';
import { ligneDeTexte, type EntreeDuJournal } from '../engine/journal';
import { garanti } from '../lib/garanti';
import { tirerSigne, type RNG } from '../engine/dice';
import { MINUTES_PER_DAY } from '../engine/clock';
import { estOpDuNavire, resolveFormula, tirerLaTable, type GameOp, type OpDuNavire, type OpsCtx } from '../engine/ops';
import { nomDeSource } from '../engine/faits';
import { reecrireLesOps, tiragesDuFlow, type EffectOp } from '../engine/flowCore';
import type { Combatant } from '../engine/types';
import { caracDuCombattant, type Referent } from '../engine/formule';
import { profilNavalDe } from '../engine/coque';
import { humanizeFormula } from './codex/humanize';
import { spoilCargoByEnc, valeurDeLaCargaison } from '../engine/cargo';
import {
  addManann,
  applyManannFactor,
  cargoBasePrice,
  meteosActives,
  modificateursActifs,
  rollRandomCargo,
  spoilCargoByPct,
  type ModificateurDuNavire,
} from '../engine/seaVoyage';
import { currentSeason } from '../engine/travelStages';
import { embarquerDesVivres, isRation, LITRES_PAR_TONNEAU, rationsDeCale, rationsDuVivre, retirerDuVivre } from '../engine/provisions';
import { idDe, type Id } from '../data/schemas/grammaire/ref';

import { rollShipCritical } from '../engine/shipCritical';
import { resoudreFlowTest } from '../engine/decisionDuTest';
import { dataLabel, findCrewRoleById, findCrewTestTypeById, refLabel } from '../data';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { applyShipMoraleDelta, applyVesselCrewLoss, shipboardSouls } from './shipCrew';
import { REGISTRES_DU_BORD, type CampaignVessel } from './etat';
import {
  applyVesselCritical,
  combattreEnMer,
  coqueDuNavireDeCampagne,
  entrerDansLeTourbillon,
  etapeDEquipage,
  heurterLePeril,
  localisationAleatoire,
  navireHostileEnVue,
  noteSeaLine,
  persistHullWounds,
  reparationTemporaireDuNavire,
  setVesselHull,
  vesselManann,
  voyageShip,
} from './seaVoyageFlow';
import { findSeaHazard } from '../engine/seaPerils';
import { applyLeafOps, indiceDeMembreDuBord, MAIN_RENDUE, scheduleDelayedOps } from './combatEffects';
import { startCascade } from './cascade';
import { condCtx } from './bourseFlow';
import { autrePortAuHasard } from './portFlow';
import { formatMoney, fromBrass } from '../engine/money';
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

/** Le RÉFÉRENT des formules du navire de campagne : sa coque, sa Taille (longueur, MDG 12 l.54) et la valeur de
 *  sa cargaison (MDG 15 l.247) ; `null` sans navire de campagne à coque. */
export function referentDuNavire(get: Get, set: Set): Referent | null {
  const visee = coqueVisee(get, set);
  return visee && referentDeLaCoque(get, visee.coque);
}

const referentDeLaCoque = (get: Get, coque: Combatant): Referent => ({
  ...caracDuCombattant(coque),
  tailleDuNavire: () => profilNavalDe(coque)?.lengthM ?? 0,
  valeurCargaison: () => valeurDeLaCargaison(get().vessel?.cargo ?? []),
});

/** Jours tirés d'une durée de navire, sur son référent : jamais négatifs. */
const joursTires = (f: Parameters<typeof resolveFormula>[0], ref: Referent, ctx: OpsCtx): number => Math.max(0, Math.round(resolveFormula(f, ref, ctx.rng)));

/** Résout UNE op de navire sur `coque` ; rend ses lignes. `ctx.label` = la source de l'état posé. */
function appliquerOpDuNavire(get: Get, set: Set, coque: Combatant, o: OpDuNavire, ctx: OpsCtx): EntreeDuJournal[] {
  const ref = referentDeLaCoque(get, coque);
  switch (o.op) {
    case 'shipMorale':
      return applyShipMoraleDelta(get, set, coque, tirerSigne(o.delta, ctx.rng)).map((l) => ligneDeTexte(l));
    case 'manann': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const mood = vesselManann(vessel);
      if ('facteur' in o && o.facteur !== undefined) {
        const facteur = o.facteur.id;
        const deja = mood.applied.includes(facteur);
        const { mood: next, delta, label } = applyManannFactor(mood, facteur, ctx.rng);
        if (deja) return [ligneDeTexte(t('eff.manannDejaApplique', { factor: label ?? facteur }))];
        set({ vessel: { ...vessel, manann: next } });
        return [ligneDeTexte(t('eff.facteurDeManann', { delta: `${delta >= 0 ? '+' : ''}${delta}`, factor: label ?? facteur }))];
      }
      const delta = tirerSigne(o.delta, ctx.rng);
      set({ vessel: { ...vessel, manann: addManann(mood, delta) } });
      return [ligneDeTexte(t('sv.manannMood', { delta: `${delta >= 0 ? '+' : ''}${delta}`, score: vesselManann(get().vessel).score }))];
    }
    case 'shipCritical': {
      const n = Math.max(0, Math.round(resolveFormula(o.count, ref, ctx.rng)));
      for (let i = 0; i < n; i++) {
        applyVesselCritical(get, set, rollShipCritical(o.location === 'aleatoire' ? localisationAleatoire(ctx.rng) : o.location, ctx.rng), o.equipageEpargne);
      }
      return [];
    }
    case 'navireMod': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const now = get().gameTime;
      const jusqua: ModificateurDuNavire['jusqua'] = typeof o.jusqua === 'string' ? o.jusqua : now + joursTires(o.jusqua.jours, ref, ctx) * MINUTES_PER_DAY;
      const label = nomDeSource(ctx);
      const mod: ModificateurDuNavire = {
        label, ...(o.m !== undefined ? { m: o.m } : {}), ...(o.manDR !== undefined ? { manDR: o.manDR } : {}), ...(o.evite ? { evite: [...o.evite] } : {}), jusqua,
      };
      set({ vessel: { ...vessel, modificateurs: [...modificateursActifs(vessel.modificateurs, now), mod] } });
      const axes = [
        ...(o.m !== undefined ? [t('eff.modificateurDuNavireM', { m: signe(o.m) })] : []),
        ...(o.manDR !== undefined ? [t('eff.modificateurDuNavireManoeuvre', { dr: signe(o.manDR) })] : []),
        ...(o.evite ? [t('eff.modificateurDuNavireEvite', { perils: o.evite.map(libelleDuPeril).join(', ') })] : []),
      ];
      const duree = typeof jusqua === 'number' ? t('eff.pendantNJours', { n: (jusqua - now) / MINUTES_PER_DAY }) : jusqua === 'carenage' ? t('eff.jusquAuCarenage') : t('eff.jusquAuProchainEvenement');
      return [ligneDeTexte(t('eff.modificateurDuNavire', { label, axes: axes.join(', '), duree }))];
    }
    case 'meteoImposee': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const now = get().gameTime;
      const jours = joursTires(o.jours, ref, ctx);
      const label = nomDeSource(ctx);
      const meteo = {
        label, jusqua: now + jours * MINUTES_PER_DAY,
        ...(o.meteo ? { meteo: { ...o.meteo } } : {}),
        ...(o.ventInverse ? { ventInverse: true as const } : {}),
        ...(o.aggravation ? { aggravation: structuredClone(o.aggravation) } : {}), // #2097
      };
      set({ vessel: { ...vessel, meteosImposees: [...meteosActives(vessel.meteosImposees, now), meteo] } });
      return [ligneDeTexte(t('eff.meteoImposee', { label, n: jours }))];
    }
    case 'cargaison': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      if (o.perduePct !== undefined) {
        const { lots, removed } = spoilCargoByPct(vessel.cargo ?? [], o.perduePct);
        set({ vessel: { ...vessel, cargo: lots } });
        return [ligneDeTexte(t('eff.cargaisonPerdue', { pct: o.perduePct, enc: removed }))];
      }
      if (o.perteAuDechargement !== undefined) {
        const perte = Math.max(0, Math.round(resolveFormula(o.perteAuDechargement, ref, ctx.rng)));
        set({ vessel: { ...vessel, perteAuDechargement: perte } });
        return [ligneDeTexte(t('eff.perteAuDechargement', { enc: perte }))];
      }
      if (o.perdueEnc !== undefined) {
        const { lots, removed } = spoilCargoByEnc(vessel.cargo ?? [], resolveFormula(o.perdueEnc, ref, ctx.rng));
        set({ vessel: { ...vessel, cargo: lots } });
        return [ligneDeTexte(t('eff.cargaisonPerdueEnc', { enc: removed }))];
      }
      const enc = Math.max(0, Math.round(resolveFormula(o.enc, ref, ctx.rng)));
      const season = currentSeason(get().gameTime);
      const cargo = rollRandomCargo(season, ctx.rng);
      set({ vessel: { ...vessel, cargo: [...(vessel.cargo ?? []), { uid: get().forgerUnId('it'), cargoId: cargo.id, enc, basePriceGold: cargoBasePrice(cargo, season, ctx.rng) }] } });
      return [ligneDeTexte(t('eff.cargaison', { enc, cargo: cargo.label }))];
    }
    case 'provisions':
      if (o.gateesPct !== undefined) return gaterLesProvisions(get, set, o.gateesPct);
      if (o.rations !== undefined) return ajouterDesRations(get, set, joursTires(o.rations, ref, ctx), o.vivre.id);
      if (o.eauTonneaux !== undefined) return ajouterDeLEau(get, set, joursTires(o.eauTonneaux, ref, ctx));
      return ajouterDesVivres(get, set, joursTires(o.jours, ref, ctx), o.vivre.id);
    case 'equipage':
      return o.perdusPct !== undefined
        ? changerLEquipage(get, set, -Math.round(shipboardSouls(get()).crew * o.perdusPct / 100), undefined, undefined, ctx.rng)
        : changerLEquipage(get, set, Math.round(resolveFormula(o.delta, ref, ctx.rng)), o.role?.id, o.sansSolde, ctx.rng);
    case 'perilDeMer':
      return o.collision !== undefined ? heurterLePeril(get, set, coque, o.collision.id, ctx.rng) : entrerDansLeTourbillon(get, set, o.tourbillon.id, nomDeSource(ctx));
    case 'navireHostile':
      return navireHostileEnVue(get, set, coque, o, nomDeSource(ctx));
    case 'combatEnMer':
      return combattreEnMer(get, set, o, nomDeSource(ctx));
    case 'commission': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const label = nomDeSource(ctx);
      const port = autrePortAuHasard(get, ctx.rng);
      if (!port) return [ligneDeTexte(t('eff.commissionSansPort', { label }))];
      const brass = Math.max(0, Math.round(resolveFormula(o.montant.brass, ref, ctx.rng)));
      set({ vessel: { ...vessel, commissions: [...(vessel.commissions ?? []), { label, placeId: port.id, brass }] } });
      return [ligneDeTexte(t('eff.commission', { label, port: port.label, montant: formatMoney(fromBrass(brass)) }))];
    }
    case 'constructeurDEscale': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      set({ vessel: { ...vessel, constructeurDEscale: { competence: o.competence, duree: o.duree } } });
      return [ligneDeTexte(t('eff.constructeurDEscale', { label: nomDeSource(ctx), competence: o.competence, duree: humanizeFormula(o.duree) }))];
    }
    case 'rationsDEscale': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const brass = Math.max(0, Math.round(resolveFormula(o.montant.brass, ref, ctx.rng)));
      set({ vessel: { ...vessel, rationsDEscale: brass } });
      return [ligneDeTexte(t('eff.rationsDEscale', { label: nomDeSource(ctx), prix: formatMoney(fromBrass(brass)) }))];
    }
    case 'infestation': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const label = nomDeSource(ctx);
      set({ vessel: { ...vessel, infestation: { label, crewTestType: o.test.crewTestType, difficulty: o.test.difficulty, drCible: o.drCible, progres: 0, chaqueNuit: o.chaqueNuit, ...(o.surDRNegatif ? { surDRNegatif: o.surDRNegatif } : {}) } } });
      return [ligneDeTexte(t('eff.infestation', { label, dr: o.drCible }))];
    }
  }
}

/** Libellé d'un péril de `sea-perils.json`. */
const libelleDuPeril = (id: string): string => garanti(findSeaHazard(id), id, 'péril en mer').label;

/** Change l'effectif de `delta` marins (`applyVesselCrewLoss`, borné à l'effectif nominal) ; un recueilli au
 *  rôle `roleId` entre au roster `crew`, ou à `recueillisSansSolde` jusqu'au prochain port. MDG 15 l.202-204,
 *  l.213-218, l.258 ; MDG 14 l.293-302 */
function changerLEquipage(get: Get, set: Set, delta: number, roleId: string | undefined, sansSolde: 'jusquAuPort' | undefined, rng: RNG): EntreeDuJournal[] {
  const { lignes, variation } = applyVesselCrewLoss(get, set, -delta, delta <= 0 || roleId === undefined ? (postes) => indiceDeMembreDuBord(rng, postes) : {
    roleId, registre: sansSolde ? 'recueillisSansSolde' : 'crew',
  });
  if (delta > 0 && variation === 0) return [ligneDeTexte(t('eff.equipageComplet'))];
  const dites = lignes.map((l) => ligneDeTexte(l));
  if (variation >= 0 || roleId === undefined) return dites;
  return [...dites, ligneDeTexte(t('eff.equipageRole', { n: -variation, role: dataLabel(garanti(findCrewRoleById(roleId), roleId, 'rôle d’équipage').label), sansSolde: sansSolde ? t('eff.equipageSansSolde') : '' }))];
}

const idDeRoleABord = idDe('crewRole');
const estRetourLie = (o: GameOp, cle: string): boolean =>
  o.op === 'equipage' && typeof o.delta === 'object' && 'tire' in o.delta && o.delta.tire === cle && o.delta.de === undefined;

function verifierLeRetourDesMarins(suite: Flow, cle: string): void {
  let retour = false;
  const apres = reecrireLesOps(suite, (o) => {
    if (!estRetourLie(o, cle)) return o;
    retour = true;
    return null;
  });
  if (!retour) throw new Error(`Liaison d’équipage « ${cle} » : aucun retour dans cet événement.`);
  const { nonLies } = tiragesDuFlow(apres);
  if (nonLies.length) throw new Error(`Liaison d’équipage « ${cle} » : valeurs sans définition (${nonLies.join(', ')}).`);
}

/** Lie les retours aux postes effectivement perdus, dans la suite sérialisable du flux. MDG 15 l.245 */
export function lierLeRetourDesMarins(get: Get, set: Set, flow: Flow, cle: string, rng: RNG): Flow {
  const [premier, ...etapes] = flow.kind === 'sequence' ? flow.etapes : [];
  const effet = premier?.kind === 'effet' ? premier.effet : undefined;
  const retrait = effet?.type === 'ops' && effet.on === 'navire' && effet.ops.length === 1 ? effet.ops[0] : undefined;
  const delta = retrait?.op === 'equipage' ? retrait.delta : undefined;
  const produit = typeof delta === 'object' && 'times' in delta ? delta.times : undefined;
  const lie = produit?.of;
  if (effet?.type !== 'ops' || produit?.factor !== -1 || typeof lie !== 'object'
    || !('tire' in lie) || lie.tire !== cle || lie.de === undefined) {
    throw new Error(`Liaison d’équipage « ${cle} » : la première étape doit déclarer le retrait lié.`);
  }
  const { nonLies } = tiragesDuFlow(flow);
  if (nonLies.length) throw new Error(`Liaison d’équipage « ${cle} » : valeurs sans définition (${nonLies.join(', ')}).`);
  const suite: Flow = { kind: 'sequence', etapes };
  verifierLeRetourDesMarins(suite, cle);

  const avant = get().vessel;
  const lignes = appliquerAuNavire(get, set, {
    ...effet, ops: [{ op: 'equipage', delta: { times: { of: lie.de, factor: produit.factor } } }],
  }, { idNeuf: get().forgerUnId, rng });
  if (lignes.length) get().ecrireAuJournal(lignes);
  const apres = get().vessel;
  const pertes = Math.max(0, (apres?.crewLost ?? 0) - (avant?.crewLost ?? 0));
  const retours = opsDeRetourDEquipage(avant, apres, pertes);
  return reecrireLesOps(suite, (o) => estRetourLie(o, cle) ? retours : o);
}

/** Les rôles débités entre les deux registres, puis les marins génériques, à hauteur du retour. MDG 15 l.245 */
export function opsDeRetourDEquipage(avant: CampaignVessel | null, apres: CampaignVessel | null, nombre: number): GameOp[] {
  const retours: GameOp[] = [];
  let restants = nombre;
  for (const registre of REGISTRES_DU_BORD) {
    const pertes = new Map<string, number>();
    for (const { roleId, count } of avant?.[registre] ?? []) {
      pertes.set(roleId, (pertes.get(roleId) ?? 0) + count);
    }
    for (const { roleId, count } of apres?.[registre] ?? []) {
      pertes.set(roleId, (pertes.get(roleId) ?? 0) - count);
    }
    for (const [roleId, perdus] of pertes) {
      const id = idDeRoleABord.safeParse(roleId);
      if (!id.success) continue;
      const delta = Math.min(restants, perdus);
      if (delta <= 0) continue;
      retours.push({ op: 'equipage', delta, role: { id: id.data }, ...(registre === 'recueillisSansSolde' ? { sansSolde: 'jusquAuPort' } : {}) });
      restants -= delta;
    }
  }
  if (restants > 0) retours.push({ op: 'equipage', delta: restants });
  return retours;
}

/** Gâte `pct` % des provisions à bord : chaque vivre de la cale (`vessel.provisions`, du lot le plus vieux au plus
 *  jeune) et les rations de chaque héros, arrondi à l'entier inférieur par vivre et par héros. MDG 15 l.169-170 */
function gaterLesProvisions(get: Get, set: Set, pct: number): EntreeDuJournal[] {
  let jetees = 0;
  const party = get().party.map((h) => {
    let n = Math.floor((h.items ?? []).filter(isRation).length * pct / 100);
    if (!n) return h;
    jetees += n;
    return { ...h, items: h.items!.filter((it) => !(isRation(it) && n-- > 0)) };
  });
  set({ party });
  const lignes = [ligneDeTexte(t('sv.rationsSpoiled', { n: jetees }))];
  const vessel = garanti(get().vessel, 'provisions', 'navire de campagne de la coque visée');
  if (vessel.provisions == null) return lignes;
  let provisions = vessel.provisions;
  let perdues = 0;
  for (const id of new Set(vessel.provisions.map((l) => l.vivre))) {
    const gatees = Math.floor(rationsDuVivre(vessel.provisions, id) * pct / 100);
    perdues += gatees;
    provisions = retirerDuVivre(provisions, id, gatees);
  }
  set({ vessel: { ...vessel, provisions } });
  return [...lignes, ligneDeTexte(t('eff.provisionsGatees', { perdues, total: rationsDeCale(provisions) }))];
}

/** Ajoute `jours` jours de vivres de l'équipage (une ration par marin et par jour) de `vivre` à la cale.
 *  MDG 15 l.223, l.235-236 ; MDG 14 l.238 */
function ajouterDesVivres(get: Get, set: Set, jours: number, vivre: Id<'trapping'>): EntreeDuJournal[] {
  const vessel = garanti(get().vessel, 'provisions', 'navire de campagne de la coque visée');
  if (vessel.provisions == null) return [ligneDeTexte(t('eff.provisionsSansSuivi'))];
  const equipage = shipboardSouls(get()).crew;
  const rations = jours * equipage;
  const provisions = embarquerDesVivres(vessel.provisions, vivre, rations, get().gameTime);
  set({ vessel: { ...vessel, provisions } });
  return [ligneDeTexte(t('eff.provisionsJours', { n: jours, equipage, rations, vivre: refLabel('trappings', { id: vivre }), total: rationsDeCale(provisions) }))];
}

/** Ajoute `n` rations (jours-homme) de `vivre` à la cale. MDG 15 l.194 ; MDG 14 l.238, l.245-252 */
export function ajouterDesRations(get: Get, set: Set, n: number, vivre: Id<'trapping'>): EntreeDuJournal[] {
  const vessel = garanti(get().vessel, 'provisions', 'navire de campagne de la coque visée');
  if (vessel.provisions == null) return [ligneDeTexte(t('eff.provisionsSansSuivi'))];
  const provisions = embarquerDesVivres(vessel.provisions, vivre, n, get().gameTime);
  set({ vessel: { ...vessel, provisions } });
  return [ligneDeTexte(t('eff.provisionsRations', { n, vivre: refLabel('trappings', { id: vivre }), total: rationsDeCale(provisions) }))];
}

/** Embarque `n` tonneaux d'eau douce. MDG 15 l.194 ; MDG 14 l.242 */
export function ajouterDeLEau(get: Get, set: Set, n: number): EntreeDuJournal[] {
  const vessel = garanti(get().vessel, 'provisions', 'navire de campagne de la coque visée');
  if (vessel.waterLitres == null) return [ligneDeTexte(t('eff.eauSansSuivi'))];
  const litres = n * LITRES_PAR_TONNEAU;
  set({ vessel: { ...vessel, waterLitres: vessel.waterLitres + litres } });
  return [ligneDeTexte(t('eff.eauTonneaux', { n, litres, total: vessel.waterLitres + litres }))];
}

const signe = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

/**
 * Ouvre le TEST D'ÉQUIPAGE d'un nœud `test` de Flow (`crewTestType`) : l'étape à participants du voyage
 * (`etapeDEquipage`), dont l'applier `testDEquipage` (`seaVoyageFlow.ts`) joue la branche du verdict
 * puis `after`. Son enjeu est celui que le Test nomme (`flowTestSchema`). `false` : aucun marin
 * apte à bord, l'appelant joue l'échec. MDG 14 l.39 ; MDG 15 l.144-145
 */
export function ouvrirLeTestDEquipage(get: Get, set: Set, node: Extract<Flow, { kind: 'test' }>, label: string, sl?: number): boolean {
  const { crewTestType, stake } = node.test;
  const type = garanti(crewTestType, label, 'type de Test d’équipage');
  const { difficulty } = resoudreFlowTest(node.test, { cc: condCtx(get) });
  const st = etapeDEquipage(get, type, 'testDEquipage', garanti(stake, label, 'enjeu du Test d’équipage'), { difficulty });
  if (!st) return false;
  // MDG 13 l.651
  const reparation = findCrewTestTypeById(type)?.steering ? reparationTemporaireDuNavire(get, get().travelPlan?.vehicle, st.id) : undefined;
  startCascade(get, set, {
    title: label, icon: 'voyage/ancre', purpose: 'test',
    steps: [{ ...st, meta: { ...st.meta, differeLaSuite: true, onSuccess: node.reussite, onFail: node.echec, flowLabel: label, ...(sl !== undefined ? { flowSl: sl } : {}) } }, ...(reparation ? [reparation] : [])],
  });
  return true;
}

/** Une table à rangées en ligne dont une rangée porte une op de NAVIRE : elle se tire à la portée du navire,
 *  où ses ops se résolvent ; `applyOps` les laisserait inertes. MDG 15 l.213-218, l.258 */
const estTableDuNavire = (o: GameOp): o is Extract<GameOp, { op: 'rollTable' }> =>
  o.op === 'rollTable' && o.entries !== undefined && o.entries.some((r) => r.ops.some((x) => estOpDuNavire(x) || estTableDuNavire(x)));

/** Applique la feuille `e` (`on: 'navire'`) au navire de campagne, ops dans l'ordre authoré ; rend les
 *  lignes du journal (aussi posées au recap du jour en mer). */
export function appliquerAuNavire(get: Get, set: Set, e: EffectOp, base: OpsCtx): EntreeDuJournal[] {
  const visee = coqueVisee(get, set);
  if (!visee) return [ligneDeTexte(t('eff.navireAbsent'))];
  const { coque, persister } = visee;
  const ctx: OpsCtx = { ...base, hull: coque };
  const lignes: EntreeDuJournal[] = [];
  let pures: GameOp[] = [];
  const viderLesPures = (): void => {
    if (!pures.length) return;
    const issue = applyLeafOps(get, set, coque, { ...e, ops: pures }, ctx);
    if (issue === MAIN_RENDUE) throw new Error(`#1652 — une op à dé ouvert à la porte vise le navire (${pures.map((o) => o.op).join(', ')}) : son applier ne retrouverait pas la coque.`);
    lignes.push(...issue);
    pures = [];
    persister();
  };
  const file = [...e.ops];
  while (file.length) {
    const o = file.shift()!;
    if (estTableDuNavire(o)) { file.unshift(...[...tirerLaTable(o, ctx, ctx.rng)].flatMap((r) => r.ops)); continue; }
    if (o.op === 'delayed') { scheduleDelayedOps(get, set, coque, o, { now: get().gameTime, label: nomDeSource(ctx) }, { on: 'navire' }); continue; }
    if (!estOpDuNavire(o)) { pures.push(o); continue; }
    viderLesPures();
    lignes.push(...appliquerOpDuNavire(get, set, coque, o, ctx));
  }
  viderLesPures();
  noteSeaLine(get, set, lignes);
  return lignes;
}
