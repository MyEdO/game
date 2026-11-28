/**
 * Les soins, les maladies et les séquelles, par les primitives du moteur ; le soin d'un compagnon par l'infirmerie du
 * noyau.
 */
import {
  arena,
  diseaseLabel,
  skills,
  symptomLabel,
  type QualiteDeRepos,
  verbeDeJetDe,
  type GesteDuJeu,
  prixDeLOffre,
  estOperation,
  gesteDeSoins,
  peutTenter,
  makeRNG,
  maladieDeclaree,
  MINUTES_PER_DAY,
  corruptionThreshold,
  cappedHealAmount,
  HEAL_SKILL,
  type HealMode,
  PA_PER_CO,
  toBrass,
  surgeryTraumas,
  type Combatant,
} from '../../../../src/noyau';
import { rollTest } from '../../../../src/engine/tests';
import { applyHealWounds } from '../../../../src/engine/healing';
import type { EntreeDuJournal } from '../../../../src/engine/journal';
import { cureCriticalWounds, hasTreatableTrauma, treatTrauma, removeSurgicalTrauma } from '../../../../src/engine/trauma';
import { chancesDeReussite, type Visee } from './epreuve';
import { lignesDuJournal, ouvrirEnAuto } from './partie';

export type { QualiteDeRepos };

/** Le nom d'une maladie de `maladies.json`. */
export const nomDeMaladie = (id: string): string => diseaseLabel(id);

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
export const soigner = (c: Combatant, pv: number): EntreeDuJournal[] => applyHealWounds(c, pv);
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
  const { partie, envoyer, pomper, jouerDansLaFenetre } = ouvrirEnAuto(
    graine,
    () => ({ party: groupe.map((c) => structuredClone(c)), scene: arena({ id: 'camp', label: 'Camp', w: 8, h: 8 }), projet: null }),
    (r) => { journal.push(...lignesDuJournal(r)); if (r.refus) refus ??= r.refus; },
  );
  const rendre = (): Combatant[] => { const g = partie.etat().party.map((c) => structuredClone(c)); partie.fermer(); return g; };
  pomper();
  const offre = gesteDeSoins(partie.etat(), patient.id);
  if (offre.refus) refus = offre.refus;
  else envoyer(offre.geste.verbe, offre.geste.args);
  pomper();
  const brouillon = partie.etat().pendingHeal;
  const verdict: VerdictDuSoin = refus || !brouillon
    ? { refus: refus ?? journal[journal.length - 1] ?? `${patient.label} : rien à soigner.` }
    : brouillon.healerId !== soigneur.id
      ? { refus: `${groupe.find((c) => c.id === brouillon.healerId)?.label ?? brouillon.healerName} est meilleur·e en Guérison : à lui ou à elle de soigner.` }
      : estOperation(brouillon.mode)
        ? { refus: `Il ne reste à ${patient.label} qu’une opération, que le camp ne permet pas.` }
        : { soigneur: brouillon.healerId, patient: brouillon.targetId, acte: brouillon.mode, cible: brouillon.target };
  return { verdict, journal, jouerDansLaFenetre, pomper, rendre };
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
  const { verdict, journal, jouerDansLaFenetre, pomper, rendre } = ouvrirLeSoin(soigneur, patient, graine);
  if ('refus' in verdict) return { groupe: rendre(), journal, ...verdict };
  const duSoin = (verbe: 'lancer' | 'valider') => (g: GesteDuJeu) => g.flux === 'soins' && verbeDeJetDe(g.verbe) === verbe;
  jouerDansLaFenetre(duSoin('lancer'));
  jouerDansLaFenetre(duSoin('valider'));
  pomper();
  return { groupe: rendre(), journal, ...verdict };
}

/** Ce que le `soigneur` vise au soin du `patient` : la Guérison, la cible du Test que l'infirmerie du noyau retient
 *  (`verdictDuSoin`) et ses chances ; sinon le refus du noyau. */
export function viseeDuSoin(soigneur: Combatant, patient: Combatant): Visee | { refus: string } {
  const v = verdictDuSoin(soigneur, patient);
  return 'refus' in v ? v : { competence: skills.find((s) => s.id === HEAL_SKILL)?.label ?? HEAL_SKILL, cible: v.cible, chances: chancesDeReussite(v.cible) };
}
