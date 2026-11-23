/**
 * Le repos, les soins et les séquelles, par les primitives du moteur ; le soin d'un compagnon par l'infirmerie du noyau.
 */
import { rollTest } from '../../../src/engine/tests';
import { testValue } from '../../../src/engine/skills';
import { makeRNG } from '../../../src/engine/dice';
import { restRecovery } from '../../../src/engine/rest';
import { applyHealWounds } from '../../../src/engine/healing';
import { PA_PER_CO, toBrass } from '../../../src/engine/money';
import { prixDeLOffre } from '../../../src/noyau/restFlow';
import type { QualiteDeRepos } from '../../../src/data/schemas/grammaire/valeurs';
import { tickTraumaRecovery, applyFractureEnd, cureCriticalWounds, hasTreatableTrauma, treatTrauma, surgeryTraumas, removeSurgicalTrauma } from '../../../src/engine/trauma';
import type { Combatant } from '../../../src/engine/types';
import { peutTenter } from '../../../src/engine/skills';
import { HEAL_SKILL, type HealMode } from '../../../src/engine/healing';
import { estOperation } from '../../../src/noyau/acteDeSoin';
import { refusDeSoins } from '../../../src/noyau/medicFlow';
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
    const r = rollTest(spec.test ? testValue(c, spec.test) : spec.base, spec.difficulty, rng);
    fins.push(...applyFractureEnd(c, r.success, m.severity, m.location, m.traumaLabel));
  });
  return [...lignes, ...convalescence, ...fins];
}

/** `pv` Points de Blessure regagnés par un soin (`applyHealWounds`) : un Inconscient guéri revient à lui. */
export const soigner = (c: Combatant, pv: number): string[] => applyHealWounds(c, pv);

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
    const r = rollTest(valeur, 'intermediaire', rng);
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

/** Pourquoi le noyau refuse d'ouvrir l'infirmerie sur `patient` soigné par `soigneur` (`refusDeSoins`), ou `null`. */
export const refusDuSoin = (soigneur: Combatant, patient: Combatant): string | null =>
  refusDeSoins({ battle: null, party: [soigneur, patient] }, patient.id);

/** Un soin joué : le groupe tel que le noyau le laisse, son journal ; le soigneur, le patient et l'acte que le noyau a
 *  retenus. Sinon `refus` : l'infirmerie refusée, le soin confié par le noyau à un autre que le soigneur choisi, ou
 *  une opération, aucun jet tiré. */
export type IssueDuSoin = { groupe: Combatant[]; journal: string[] }
  & ({ soigneur: string; patient: string; acte: HealMode } | { refus: string });

/** Le `soigneur` soigne le `patient` par l'infirmerie du noyau, sur une place dégagée : `ouvrirLeMedecin`, l'acte
 *  du brouillon (`brouillonTenu`), `jetLancer('soins')` et `jetValider('soins')`. Le noyau confie l'acte au meilleur
 *  soigneur des deux (`bestHealerFor`), l'autre le soutient : si ce n'est pas le soigneur choisi, rien ne se joue. Une
 *  opération (`estOperation`) ne se joue pas ici. LDB 09 l.30 */
export function soignerUnCompagnon(soigneur: Combatant, patient: Combatant, graine: number): IssueDuSoin {
  const groupe = [soigneur, patient];
  const journal: string[] = [];
  let refus: string | undefined;
  const { partie, envoyer, pomper } = ouvrirEnAuto(
    graine,
    () => ({ party: groupe.map((c) => structuredClone(c)), scene: arena({ id: 'camp', label: 'Camp', w: 8, h: 8 }), projet: null }),
    (r) => { journal.push(...lignesDuJournal(r)); if (r.refus) refus ??= r.refus; },
  );
  const rendre = () => { const g = partie.etat().party.map((c) => structuredClone(c)); partie.fermer(); return g; };
  pomper();
  envoyer('ouvrirLeMedecin', [patient.id]);
  pomper();
  const brouillon = partie.etat().pendingHeal;
  if (refus || !brouillon) return { groupe: rendre(), journal, refus: refus ?? journal[journal.length - 1] ?? `${patient.label} : rien à soigner.` };
  if (brouillon.healerId !== soigneur.id) {
    const meilleur = groupe.find((c) => c.id === brouillon.healerId)?.label ?? brouillon.healerName;
    return { groupe: rendre(), journal, refus: `${meilleur} est meilleur·e en Guérison : à lui ou à elle de soigner.` };
  }
  if (estOperation(brouillon.mode)) return { groupe: rendre(), journal, refus: `Il ne reste à ${patient.label} qu’une opération, que le camp ne permet pas.` };
  envoyer('jetLancer', ['soins']);
  envoyer('jetValider', ['soins']);
  pomper();
  return { groupe: rendre(), journal, soigneur: brouillon.healerId, patient: brouillon.targetId, acte: brouillon.mode };
}
