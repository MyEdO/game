/**
 * Le repos, les soins et les séquelles, par les primitives du moteur ; le soin d'un compagnon par l'infirmerie du noyau.
 */
import { rollTest } from '../../../src/engine/tests';
import { testValue } from '../../../src/engine/skills';
import { designeGaranti } from '../../../src/noyau/ligneDeJet';
import { makeRNG } from '../../../src/engine/dice';
import { restRecovery, dailyDiseaseUpkeep, applyDiseaseEnd } from '../../../src/engine/rest';
import { applyDiseaseGangrene, maladieDeclaree } from '../../../src/engine/disease';
import { applyOps, type GameOp } from '../../../src/engine/ops';
import { fabriqueLocale } from '../../../src/engine/fabriqueDId';
import { MINUTES_PER_DAY } from '../../../src/engine/clock';
import { corruptionThreshold } from '../../../src/engine/corruption';
import { diseaseLabel, skills, symptomLabel } from '../../../src/data';
import type { UpkeepDeferTest } from '../../../src/engine/types';
import { applyHealWounds, cappedHealAmount } from '../../../src/engine/healing';
import { PA_PER_CO, toBrass } from '../../../src/engine/money';
import { prixDeLOffre } from '../../../src/noyau/restFlow';
import type { QualiteDeRepos } from '../../../src/data/schemas/grammaire/valeurs';
import { tickTraumaRecovery, applyFractureEnd, cureCriticalWounds, hasTreatableTrauma, treatTrauma, surgeryTraumas, removeSurgicalTrauma } from '../../../src/engine/trauma';
import type { Combatant } from '../../../src/engine/types';
import { peutTenter } from '../../../src/engine/skills';
import { HEAL_SKILL, type HealMode } from '../../../src/engine/healing';
import { estOperation } from '../../../src/noyau/acteDeSoin';
import { chancesDeReussite, type Visee } from './epreuve';
import { arena } from '../../../src/scenes/test-scenarios/_shared';
import { lignesDuJournal, ouvrirEnAuto } from './partie';

export type { QualiteDeRepos };

/** `jours` journées de repos (LDB 18 l.296) et de convalescence des Blessures critiques (LDB 18 l.202-222), par les
 *  primitives du moteur ; le Test de fin d'une fracture est lancé sur place. Mute `c`, rend le journal. */
export function reposer(c: Combatant, graine: number, jours: number): string[] {
  const rng = makeRNG(graine);
  const lignes = restRecovery(c, rng, jours);
  const fins: string[] = [];
  const convalescence = tickTraumaRecovery(c, jours, (spec) => {
    const m = spec.meta as { severity: string; location: string; traumaLabel: string };
    const r = rollTest({ porteur: c.id, teste: designeGaranti(spec.test ?? {}, spec.kind) }, spec.test ? testValue(c, spec.test) : spec.base, spec.difficulty, rng);
    fins.push(...applyFractureEnd(c, r.success, m.severity, m.location, m.traumaLabel));
  });
  return [...lignes, ...convalescence, ...fins];
}

/** `jours` journées de maladie (LDB 20, jours calendaires) par `dailyDiseaseUpkeep` ; `soigne` : un soignant veille le
 *  malade (LDB 09, Guérison). Chaque Test de cycle que le moteur diffère est jeté à la fin de sa journée et appliqué comme
 *  l'applique la cascade de nuit du noyau (`noyau/restFlow.ts`, appliers `maladie-*`). Mute `c`, rend le journal. */
export function entretenirLesMaladies(c: Combatant, graine: number, jours: number, soigne: boolean): string[] {
  const rng = makeRNG(graine);
  const idNeuf = fabriqueLocale(`m${graine}`);
  const lignes: string[] = [];
  const differes: Parameters<UpkeepDeferTest>[0][] = [];
  const appliquer = (spec: Parameters<UpkeepDeferTest>[0]) => {
    const valeur = spec.base ?? testValue(c, spec.test!);
    const r = rollTest({ porteur: c.id, teste: designeGaranti(spec.test ?? {}, spec.kind) }, valeur, spec.difficulty, rng, (spec.mods ?? []).reduce((n, m) => n + m.value, 0));
    const maladie = String(spec.meta?.diseaseName ?? '');
    if (spec.kind === 'maladie-persistance') lignes.push(...applyDiseaseEnd(c, maladie, r.success, r.sl, rng));
    else if (spec.kind === 'maladie-gangrene') lignes.push(...applyDiseaseGangrene(c, maladie, r.success, Number(spec.meta?.be ?? 0)));
    else if (spec.kind === 'maladie-test-quotidien' && !r.success) {
      lignes.push(...applyOps(c, (spec.meta?.opsEchec ?? []) as GameOp[], { idNeuf, rng, sl: r.sl, source: { kind: 'maladie', id: maladie } }).lignes);
    }
  };
  for (let j = 0; j < jours && !c.dead; j++) {
    lignes.push(...dailyDiseaseUpkeep(c, rng, (spec) => { differes.push(spec); }, soigne));
    for (const spec of differes.splice(0)) if (!c.dead) appliquer(spec);
  }
  return lignes;
}

/** Les maladies portées : libellé, phase (incubation ou déclarée), jours restants dans la phase, symptômes. LDB 20 */
export const maladies = (c: Combatant): { label: string; declaree: boolean; jours: number; symptomes: string[] }[] =>
  (c.diseases ?? []).map((d) => ({
    label: diseaseLabel(d.id), declaree: maladieDeclaree(d), jours: Math.ceil(d.minutesLeft / MINUTES_PER_DAY),
    symptomes: d.symptoms.map((s) => symptomLabel(s.symptomId)),
  }));

/** La Corruption portée face à son seuil (`corruptionThreshold`, LDB 19 l.80), et les mutations subies par libellé. */
export const souillure = (c: Combatant): { points: number; seuil: number; mutations: string[] } =>
  ({ points: c.corruption ?? 0, seuil: corruptionThreshold(c), mutations: (c.mutations ?? []).map((m) => m.label) });

/** `pv` Points de Blessure regagnés par un soin (`applyHealWounds`) : un Inconscient guéri revient à lui. */
export const soigner = (c: Combatant, pv: number): string[] => applyHealWounds(c, pv);
/** Les Points de Blessure qu'un soin complet (`soigner(c, c.wounds.max)`) rend effectivement (`cappedHealAmount`). */
export const blessuresARendre = (c: Combatant): number => cappedHealAmount(c, c.wounds.max);

/** Les séquelles portées (`traumas`) et leur issue : jours de convalescence restants, chirurgie exigée (LDB 18 l.208,
 *  l.239), sinon permanente. */
export const sequelles = (c: Combatant): { label: string; jours?: number; chirurgie: boolean; desc?: string }[] =>
  (c.traumas ?? []).map((t) => ({ label: t.label, chirurgie: !!t.needsSurgery, ...(t.recoveryDays != null ? { jours: t.recoveryDays } : {}), ...(t.desc ? { desc: t.desc } : {}) }));

/** Ce qu'un soigneur peut encore faire des séquelles : des plaies à panser par la Guérison (LDB 18 l.204, l.222), des
 *  blessures à opérer (LDB 18 l.208, l.239). */
export const plaiesASoigner = (c: Combatant): { panser: boolean; operer: number } => ({ panser: panserSert(c), operer: surgeryTraumas(c).length });

/** Panser changerait-il une plaie ? Joué sur une copie, chaque Test réussi : une déchirure majeure n'est que
 *  diagnostiquée (LDB 18 l.231), une déchirure mineure raccourcit, une fracture est réduite. */
function panserSert(c: Combatant): boolean {
  if (!hasTreatableTrauma(c)) return false;
  const copie = structuredClone(c);
  const etatDe = (x: Combatant) => JSON.stringify((x.traumas ?? []).map((t) => [t.recoveryDays, t.fractureSet]));
  const avant = etatDe(copie);
  while (hasTreatableTrauma(copie)) treatTrauma(copie, 0, true);
  return etatDe(copie) !== avant;
}

/** Un soigneur de Guérison `valeur` panse chaque plaie qui le permet : un Test par plaie, le jet consommé même raté
 *  (`treatTrauma`). LDB 18 l.204, l.222 */
export function panserLesPlaies(c: Combatant, valeur: number, graine: number): string[] {
  const rng = makeRNG(graine);
  const lignes: string[] = [];
  while (hasTreatableTrauma(c)) {
    const r = rollTest({ porteur: null, teste: { skill: { id: HEAL_SKILL } } }, valeur, 'intermediaire', rng);
    lignes.push(...treatTrauma(c, r.sl, r.success));
  }
  return lignes;
}

/** L'opération réussie de chaque blessure qui exige la Chirurgie (`removeSurgicalTrauma`). LDB 10 l.184 */
export function opererLesBlessures(c: Combatant): string[] {
  const lignes: string[] = [];
  while (surgeryTraumas(c).length) lignes.push(...removeSurgicalTrauma(c));
  return lignes;
}

/** Guérit `n` Blessures critiques de convalescence, jamais une amputation (`cureCriticalWounds`). LDB 42 */
export const guerirDesSequelles = (c: Combatant, n: number): string[] => cureCriticalWounds(c, n);

/** Le prix en CO de `nuits` nuits d'auberge en chambre privée, repas compris, de qualité `qualite` (`prixDeLOffre`).
 *  LDB 66 l.5, l.12-16, l.28 */
export const prixDuSejourALAuberge = (qualite: QualiteDeRepos, nuits: number): number =>
  (nuits * (toBrass(prixDeLOffre({ id: 'chambre' }, qualite)) + toBrass(prixDeLOffre({ id: 'repas' }, qualite)))) / PA_PER_CO;

/** Le héros peut-il tenter la Guérison ? LDB 09 l.30 */
export const saitSoigner = (c: Combatant): boolean => peutTenter(c, { skill: { id: HEAL_SKILL } });

/** L'acte que l'infirmerie du noyau jouerait : le soigneur et le patient qu'elle retient, l'acte du brouillon et la cible
 *  de son Test de Guérison (`target`, Soutien et Difficulté de l'acte compris). Sinon
 *  `refus` : l'infirmerie refusée, le soin confié par le noyau à un autre que le soigneur choisi, ou une opération. */
export type VerdictDuSoin = { soigneur: string; patient: string; acte: HealMode; cible: number } | { refus: string };

/** Un soin joué : le groupe tel que le noyau le laisse, son journal, et son verdict (`VerdictDuSoin`), aucun jet tiré
 *  sur un refus. */
export type IssueDuSoin = { groupe: Combatant[]; journal: string[] } & VerdictDuSoin;

/** Ouvre l'infirmerie du noyau sur une place dégagée, le `soigneur` et le `patient` seuls au groupe : `ouvrirLeMedecin`
 *  puis l'acte du brouillon (`pendingHeal`). Le noyau confie l'acte au meilleur soigneur des deux (`bestHealerFor`),
 *  l'autre le soutient : si ce n'est pas le soigneur choisi, le verdict est un refus. Une opération (`estOperation`)
 *  ne se joue pas au camp. LDB 09 l.30 */
function ouvrirLeSoin(soigneur: Combatant, patient: Combatant, graine: number) {
  const groupe = [soigneur, patient];
  const journal: string[] = [];
  let refus: string | undefined;
  const { partie, envoyer, pomper } = ouvrirEnAuto(
    graine,
    () => ({ party: groupe.map((c) => structuredClone(c)), scene: arena({ id: 'camp', label: 'Camp', w: 8, h: 8 }), projet: null }),
    (r) => { journal.push(...lignesDuJournal(r)); if (r.refus) refus ??= r.refus; },
  );
  const rendre = (): Combatant[] => { const g = partie.etat().party.map((c) => structuredClone(c)); partie.fermer(); return g; };
  pomper();
  envoyer('ouvrirLeMedecin', [patient.id]);
  pomper();
  const brouillon = partie.etat().pendingHeal;
  const verdict: VerdictDuSoin = refus || !brouillon
    ? { refus: refus ?? journal[journal.length - 1] ?? `${patient.label} : rien à soigner.` }
    : brouillon.healerId !== soigneur.id
      ? { refus: `${groupe.find((c) => c.id === brouillon.healerId)?.label ?? brouillon.healerName} est meilleur·e en Guérison : à lui ou à elle de soigner.` }
      : estOperation(brouillon.mode)
        ? { refus: `Il ne reste à ${patient.label} qu’une opération, que le camp ne permet pas.` }
        : { soigneur: brouillon.healerId, patient: brouillon.targetId, acte: brouillon.mode, cible: brouillon.target };
  return { verdict, journal, envoyer, pomper, rendre };
}

/** Le verdict de l'infirmerie du noyau sur le soin du `patient` par le `soigneur` (`ouvrirLeSoin`), sans jet. */
export function verdictDuSoin(soigneur: Combatant, patient: Combatant): VerdictDuSoin {
  const { verdict, rendre } = ouvrirLeSoin(soigneur, patient, 0);
  rendre();
  return verdict;
}

/** Le `soigneur` soigne le `patient` par l'infirmerie du noyau : le verdict d'`ouvrirLeSoin`, puis s'il retient l'acte
 *  `jetLancer('soins')` et `jetValider('soins')`. LDB 09 l.30 */
export function soignerUnCompagnon(soigneur: Combatant, patient: Combatant, graine: number): IssueDuSoin {
  const { verdict, journal, envoyer, pomper, rendre } = ouvrirLeSoin(soigneur, patient, graine);
  if ('refus' in verdict) return { groupe: rendre(), journal, ...verdict };
  envoyer('jetLancer', ['soins']);
  envoyer('jetValider', ['soins']);
  pomper();
  return { groupe: rendre(), journal, ...verdict };
}

/** Ce que le `soigneur` vise au soin du `patient` : la Guérison, la cible du Test que l'infirmerie du noyau retient
 *  (`verdictDuSoin`) et ses chances ; sinon le refus du noyau. */
export function viseeDuSoin(soigneur: Combatant, patient: Combatant): Visee | { refus: string } {
  const v = verdictDuSoin(soigneur, patient);
  return 'refus' in v ? v : { competence: skills.find((s) => s.id === HEAL_SKILL)?.label ?? HEAL_SKILL, cible: v.cible, chances: chancesDeReussite(v.cible) };
}
