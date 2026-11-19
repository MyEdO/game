import { contractionDue, diseaseDefs, diseaseHasCapability, maladieDeclaree, type Disease } from '../engine/disease';
import { rule } from '../engine/policy';
import type { ContagionSpec } from './contagion';
import type { Get, Set } from './flowTypes';
import type { PorteurABord } from './shipCrew';

interface Intervalle {
  debut: number;
  fin: number;
}

interface FenetreDExposition {
  porteurId: string;
  maladieId: string;
  fin: number;
  prochaineHeure: number;
}

interface PhaseObservee {
  porteurId: string;
  maladieId: string;
  origine: number;
  phase: Disease['phase'];
  minutesLeft: number;
  durationMinutes: number;
  infectedMinutes: number;
}

export interface EtatDeContagion {
  fenetres: FenetreDExposition[];
  sources: PhaseObservee[];
}

type GroupeExpose = readonly Pick<PorteurABord, 'id' | 'porteur'>[];
type InclureIncubation = (porteurId: string, maladieId: string) => boolean;

export const cleDeMaladieDeVoyage = (porteurId: string, maladieId: string): string => `${porteurId}|${maladieId}`;

/** EDOC 09 l.21 */
export function incubationPendantLeVoyage(get: Get): InclureIncubation | undefined {
  const plan = get().travelPlan;
  if (!plan?.diseasesAtStart || plan.river || plan.sea || !rule('voyage-etapes')) return undefined;
  const auDepart = new Set(plan.diseasesAtStart);
  return (porteurId, maladieId) => auDepart.has(cleDeMaladieDeVoyage(porteurId, maladieId));
}

/** LDB 20 l.12-13 */
function origineDeLaPhase(precedente: PhaseObservee | undefined, maladie: Disease, maintenant: number): number {
  if (!precedente) return maintenant;
  const minutesEcoulees = (maladie.infectedMinutes ?? 0) - precedente.infectedMinutes;
  const memeDecompte = precedente.phase === maladie.phase && precedente.durationMinutes === maladie.durationMinutes
    && minutesEcoulees >= 0 && precedente.minutesLeft - maladie.minutesLeft === minutesEcoulees;
  if (memeDecompte) {
    const derniereOriginePossible = Math.max(maintenant, precedente.origine);
    return Math.min(derniereOriginePossible, precedente.origine + minutesEcoulees);
  }
  if (precedente.phase === 'incubation' && maladieDeclaree(maladie) && minutesEcoulees >= precedente.minutesLeft) {
    const eclosion = precedente.origine + precedente.minutesLeft;
    const dureeDecomptee = Math.max(0, maladie.durationMinutes - maladie.minutesLeft);
    return eclosion + dureeDecomptee;
  }
  return maintenant;
}

function releverLesSources(
  groupes: readonly GroupeExpose[],
  precedentes: readonly PhaseObservee[],
  debut: number,
  inclureIncubation: InclureIncubation | undefined,
) {
  const presentes = new Map(groupes.flatMap((groupe) => groupe.map(({ id, porteur }) => [id, porteur] as const)));
  const observations = new Map(precedentes.map((source) => [cleDeMaladieDeVoyage(source.porteurId, source.maladieId), source]));
  const peutExposer = (phase: Disease['phase'], porteurId: string, maladieId: string) =>
    phase === 'active' || inclureIncubation?.(porteurId, maladieId) !== false;
  const sources = new Map([...observations].filter(([, { phase, porteurId, maladieId }]) =>
    !presentes.has(porteurId) && peutExposer(phase, porteurId, maladieId)));
  for (const [porteurId, porteur] of presentes) {
    for (const maladie of porteur.diseases ?? []) {
      const { id: maladieId, phase, minutesLeft, durationMinutes, infectedMinutes = 0 } = maladie;
      if (!diseaseHasCapability(maladie, 'contagious') || !peutExposer(phase, porteurId, maladieId)) continue;
      const cle = cleDeMaladieDeVoyage(porteurId, maladieId);
      const origine = origineDeLaPhase(observations.get(cle), maladie, debut);
      sources.set(cle, { porteurId, maladieId, origine, phase, minutesLeft, durationMinutes, infectedMinutes });
    }
  }
  return sources;
}

/** LDB 20 l.12-13, l.206 */
function periodeContagieuse(maladie: Disease, origine: number, debut: number, fin: number): Intervalle {
  const declaree = maladieDeclaree(maladie);
  const debutContagieux = declaree ? origine : origine + maladie.minutesLeft;
  const duree = declaree ? maladie.minutesLeft : maladie.durationMinutes;
  const attendLeCycle = maladie.endTestPending || maladie.persistDifficulty
    || diseaseHasCapability(maladie, 'persistentActive') || diseaseDefs()[maladie.id]?.dureeAuFrais;
  return { debut: Math.max(debut, debutContagieux), fin: attendLeCycle ? fin : Math.min(fin, debutContagieux + duree) };
}

function intervallesParPorteur(
  groupes: readonly GroupeExpose[],
  sources: ReadonlyMap<string, PhaseObservee>,
  debut: number,
  fin: number,
) {
  const porteurs = new Map<string, Map<string, Intervalle[]>>();
  for (const groupe of groupes) {
    for (const source of groupe) {
      for (const maladie of source.porteur.diseases ?? []) {
        const phase = sources.get(cleDeMaladieDeVoyage(source.id, maladie.id));
        if (!phase) continue;
        const intervalle = periodeContagieuse(maladie, phase.origine, debut, fin);
        if (intervalle.debut >= intervalle.fin) continue;
        for (const cible of groupe) {
          if (cible.id === source.id || !contractionDue(cible.porteur, maladie.id)) continue;
          const maladies = porteurs.get(cible.id) ?? new Map<string, Intervalle[]>();
          const intervalles = maladies.get(maladie.id) ?? [];
          intervalles.push(intervalle);
          maladies.set(maladie.id, intervalles);
          porteurs.set(cible.id, maladies);
        }
      }
    }
  }
  return porteurs;
}

const MINUTES_PAR_HEURE = 60;

function joindreLesIntervalles(intervalles: Intervalle[]): Intervalle[] {
  const joints: Intervalle[] = [];
  for (const { debut, fin } of intervalles.sort((a, b) => a.debut - b.debut)) {
    const dernier = joints[joints.length - 1];
    if (dernier && debut <= dernier.fin) dernier.fin = Math.max(dernier.fin, fin);
    else joints.push({ debut, fin });
  }
  return joints;
}

interface ContactExpose {
  porteurId: string;
  maladieId: string;
  intervalles: Intervalle[];
  precedente?: FenetreDExposition;
}

/** LDB 20 l.206 */
function borneAvantLeProchainTest(contacts: readonly ContactExpose[], debut: number, fin: number): number {
  for (const { intervalles, precedente } of contacts) {
    for (const intervalle of intervalles) {
      const prochaineHeure = intervalle.debut === debut ? (precedente?.prochaineHeure ?? debut) : intervalle.debut;
      if (prochaineHeure >= intervalle.fin) continue;
      const borne = prochaineHeure === debut ? debut + MINUTES_PAR_HEURE : prochaineHeure;
      fin = Math.min(fin, borne);
    }
  }
  return fin;
}

/** LDB 20 l.206 */
function compterLesHeures({ intervalles, precedente }: ContactExpose, finDuPas: number) {
  let fin = precedente?.fin ?? -Infinity;
  let prochaineHeure = precedente?.prochaineHeure ?? -Infinity;
  let nombre = 0;
  for (const intervalle of intervalles) {
    if (intervalle.debut >= finDuPas) break;
    if (intervalle.debut > fin) prochaineHeure = intervalle.debut;
    fin = Math.min(intervalle.fin, finDuPas);
    const nouvelles = Math.max(0, Math.ceil((fin - prochaineHeure) / MINUTES_PAR_HEURE));
    nombre += nouvelles;
    prochaineHeure += nouvelles * MINUTES_PAR_HEURE;
  }
  return { nombre, fin, prochaineHeure };
}

/** À appeler au début du segment, avec les groupes qui y partagent le même espace. LDB 20 l.206 ; MDG 14 l.208 */
function preparerLePasDExposition(
  get: Get,
  set: Set,
  minutes: number,
  groupes: readonly GroupeExpose[],
  inclureIncubation: InclureIncubation | undefined,
  aLHeure: boolean,
): { minutes: number; tests: ContagionSpec[] } {
  if (minutes <= 0) return { minutes: 0, tests: [] };
  const { gameTime: debut, etatDeContagion: precedent } = get();
  const finMax = debut + minutes;
  const active = rule('maladie-mode') !== 'off';
  const ensemble = active ? groupes : [];
  const phases = releverLesSources(ensemble, active ? precedent.sources : [], debut, inclureIncubation);
  const contacts: ContactExpose[] = [];
  for (const [porteurId, maladies] of intervallesParPorteur(ensemble, phases, debut, finMax)) {
    for (const [maladieId, intervalles] of maladies) contacts.push({
      porteurId, maladieId, intervalles: joindreLesIntervalles(intervalles),
      precedente: precedent.fenetres.find((e) => e.porteurId === porteurId && e.maladieId === maladieId && e.fin === debut),
    });
  }
  const fin = aLHeure ? borneAvantLeProchainTest(contacts, debut, finMax) : finMax;
  const fenetres: FenetreDExposition[] = [];
  const tests: ContagionSpec[] = [];
  for (const contact of contacts) {
    const { porteurId, maladieId } = contact;
    const bilan = compterLesHeures(contact, fin);
    if (bilan.nombre > 0) tests.push({
      porteurId,
      diseaseName: maladieId,
      difficulty: diseaseDefs()[maladieId]?.contractDifficulty ?? 'accessible',
      nombre: bilan.nombre,
    });
    if (bilan.fin === fin) fenetres.push({ porteurId, maladieId, fin, prochaineHeure: bilan.prochaineHeure });
  }
  const sources = [...phases.values()];
  if (precedent.fenetres.length || fenetres.length || precedent.sources.length || sources.length) {
    set({ etatDeContagion: { fenetres, sources } });
  }
  return { minutes: fin - debut, tests };
}

/** À appeler au début du segment, avec les groupes qui y partagent le même espace. LDB 20 l.206 ; MDG 14 l.208 */
export function calculerLesTestsDExposition(
  get: Get, set: Set, minutes: number, groupes: readonly GroupeExpose[], inclureIncubation?: InclureIncubation,
): ContagionSpec[] {
  return preparerLePasDExposition(get, set, minutes, groupes, inclureIncubation, false).tests;
}

/** Les Tests du pas sont dus à son début. La prochaine heure ouvre le pas suivant. LDB 20 l.206 */
export function calculerLePasDExposition(
  get: Get, set: Set, minutes: number, groupes: readonly GroupeExpose[],
): { minutes: number; tests: ContagionSpec[] } {
  return preparerLePasDExposition(get, set, minutes, groupes, undefined, true);
}
