/**
 * LA CRÉATION D'UN HÉROS VUE PAR UN HÔTE (#3328) : les pages de l'assistant (`stepIds`, l'étape des Compétences en ses
 * trois sous-écrans), chacune en rubriques dites en mots du joueur (un geste, un jet tombé, un choix et ses options,
 * une valeur et son détail), et les gestes du brouillon que ses rubriques jouent : chacun une transition pure de
 * `brouillon.ts`, nommée, ses arguments en JSON (`GESTES_DU_BROUILLON`). AGENTIVITÉ (`brouillon.ts`) : un tirage n'est
 * qu'un geste tant que le joueur ne l'a pas fait ; son résultat ne se dit qu'après.
 */
import {
  apercuDuHeros, careerCharKeys, careerSkillEntries, carrieresOffertes, careerTalentOptions, careerXp, careerXpDuProchainJet, charRolls, charsXp,
  charsXpDeLaMethode, coastalSwapAvailable, draftChars, draftLevel, draftSpecies, draftWealth, newDraft, pettySpellQuota, probeHero, repartition,
  rerollDraftChars, rerollDraftTalent, rollDraftCareer, rollDraftChars, rollDraftDetails, rollDraftName, rollDraftSpecies, rollDraftStar,
  rollDraftTalents, rollDraftWealth, skillsSubDone, skillsSubMessage, speciesSkillPick, speciesSkillRefs, speciesSkillTier,
  speciesTalentChoiceEntries, speciesTalentFixedEntries, speciesTalentRandomCount, speciesTalentRandomDrawn, speciesXp, starXp, stepIds, tirerLaVariante,
  valeurDuCompteur, bornesDuCompteur, validateStep, withAssignment, withCareer, withCareerSkillSpec, withCareerTalent, withCharMode,
  withCoastalSwap, withCompteur, withEvenCareerSkillAdvances, withIgnoreRestrictions, withPettySpellToggled,
  withRandomTalentSpec, withSexe, withSpecies, withSpeciesSkillDefaults, withSpeciesSkillSpec, withSpeciesSkillTier, withSpeciesTalentChoice,
  withStar, withTrappingChoice, xpTotal,
  type CharMode, type Compteur, type CreatorDraft, type SkillsSub, type StepId,
} from './brouillon';
import {
  advancementLabel, careerLabelFor, charAbr, classes, DEFAULT_FABRICATION_ATOUT,
  findBookById, findCareerById, findSpellById, findStarById, findTalentById, libelleDeClasse, offreDuJet, refLabel, species, specLabel, starDie, stars, varianteDe,
  trappingRefLabel, type AdvancementRef, type SpeciesData,
} from '../../data';
import { CHAR_KEYS, CHAR_LABELS, type CharKey } from '../../engine/types';
import { MAX_ADV_PER_SKILL, cleDOption, libreDEspece, poolDuJoker } from '../../engine/character';
import { speciesAllowed, XP_CAREER_FIRST, XP_SPECIES_ACCEPTED, XP_STAR_ROLLED } from '../../engine/creation';
import { refKey, talentMaxReached } from '../../engine/careerSlots';
import { effectiveChar } from '../../engine/characteristics';
import { formatMoney } from '../../engine/money';
import { formatDice, hashSeed } from '../../engine/dice';
import { brancheChoisie, dotationsDuHeros, emplacementsDeDotation, estEmplacementRacine, idChoisi, libelleDeLaValeur, sousEmplacement, valeursDeLEmplacement, type EmplacementDeDotation } from '../../engine/trappingChoices';
import type { AdresseDeCreation } from '../../engine/adresseDeCreation';
import { idsDeLaSousListe, type RefASpecialisation, type RefDesignee } from '../../data/schemas/grammaire/ref';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { sexeSchema, type Sexe } from '../../data/schemas/grammaire/valeurs';
import { listeEt, t } from '../../i18n';

/** Les gestes du brouillon, par nom : chacun une transition pure de `brouillon.ts`, ses arguments en JSON. */
const GESTES_DU_BROUILLON = {
  tirerLEspece: (d: CreatorDraft) => rollDraftSpecies(d),
  espece: (d: CreatorDraft, id: string) => withSpecies(d, id),
  tirerLaCarriere: (d: CreatorDraft) => rollDraftCareer(d),
  tirerLaVariante: (d: CreatorDraft, jet: number) => tirerLaVariante(d, jet),
  carriere: (d: CreatorDraft, id: string) => withCareer(d, id),
  restrictions: (d: CreatorDraft, ignorees: boolean) => withIgnoreRestrictions(d, ignorees),
  cotiers: (d: CreatorDraft, cotiers: boolean) => withCoastalSwap(d, cotiers),
  methode: (d: CreatorDraft, mode: CharMode) => withCharMode(d, mode),
  tirerLesCaracteristiques: (d: CreatorDraft) => rollDraftChars(d),
  relancerLesCaracteristiques: (d: CreatorDraft) => rerollDraftChars(d),
  assigner: (d: CreatorDraft, k: CharKey, jet: number) => withAssignment(d, k, jet),
  compteur: (d: CreatorDraft, c: Compteur, v: number) => withCompteur(d, c, v),
  tirerLeSigne: (d: CreatorDraft) => rollDraftStar(d),
  signe: (d: CreatorDraft, id: string) => withStar(d, id),
  competencesDEspece: (d: CreatorDraft) => withSpeciesSkillDefaults(d),
  palier: (d: CreatorDraft, ref: RefASpecialisation, palier: 0 | 3 | 5) => withSpeciesSkillTier(d, ref, palier),
  specialiteDEspece: (d: CreatorDraft, ref: RefASpecialisation, spec: string) => withSpeciesSkillSpec(d, ref, spec),
  competencesDeCarriere: (d: CreatorDraft) => withEvenCareerSkillAdvances(d),
  specialiteDeCarriere: (d: CreatorDraft, adresse: AdresseDeCreation, spec: string) => withCareerSkillSpec(d, careerSkillEntries(d).find((c) => c.adresse === adresse)!, spec),
  talentDEspece: (d: CreatorDraft, adresse: AdresseDeCreation, option: AdvancementRef) => withSpeciesTalentChoice(d, adresse, option),
  tirerLesTalents: (d: CreatorDraft) => rollDraftTalents(d),
  relancerLeTalent: (d: CreatorDraft, adresse: AdresseDeCreation) => rerollDraftTalent(d, adresse),
  utilisation: (d: CreatorDraft, adresse: AdresseDeCreation, spec: string) => withRandomTalentSpec(d, adresse, spec),
  talentDeCarriere: (d: CreatorDraft, talent: RefDesignee) => withCareerTalent(d, talent),
  sortMineur: (d: CreatorDraft, id: string) => withPettySpellToggled(d, id),
  tirerLaBourse: (d: CreatorDraft) => rollDraftWealth(d),
  dotation: (d: CreatorDraft, adresse: AdresseDeCreation, v: number | string) => withTrappingChoice(d, adresse, v),
  sexe: (d: CreatorDraft, sexe: Sexe) => withSexe(d, sexe),
  tirerUnNom: (d: CreatorDraft, graine: number) => rollDraftName(d, graine),
  tirerLePhysique: (d: CreatorDraft) => rollDraftDetails(d),
} satisfies Record<string, (d: CreatorDraft, ...args: never[]) => CreatorDraft>;

type Gestes = typeof GESTES_DU_BROUILLON;
type ArgumentsDu<N extends keyof Gestes> = Gestes[N] extends (d: CreatorDraft, ...args: infer A) => CreatorDraft ? A : never;

/** Un geste du brouillon : le nom d'une transition de `GESTES_DU_BROUILLON` et ses arguments. */
export type GesteDuBrouillon = { [N in keyof Gestes]: { geste: N; args: ArgumentsDu<N> } }[keyof Gestes];

const geste = <N extends keyof Gestes>(nom: N, ...args: ArgumentsDu<N>): GesteDuBrouillon => ({ geste: nom, args }) as unknown as GesteDuBrouillon;

/** Le brouillon `d` après le geste `g`. */
export const apresLeGeste = (d: CreatorDraft, g: GesteDuBrouillon): CreatorDraft =>
  (GESTES_DU_BROUILLON[g.geste] as (d: CreatorDraft, ...args: readonly unknown[]) => CreatorDraft)(d, ...g.args);

/** Le brouillon neuf de rang `rang` qu'ouvre un hôte sans entropie dans la partie de graine `graine` : sa graine se
 *  dérive des deux (`hashSeed`). */
export const brouillonDeLaPartie = (graine: number, rang: number): CreatorDraft => newDraft(hashSeed(`creation/${graine}/${rang}`));

/** Une page de l'assistant : une étape (`StepId`), l'étape des Compétences en ses trois sous-écrans (`SkillsSub`). */
export type PageDeCreation = Exclude<StepId, 'skills'> | `skills.${SkillsSub}`;

/** Les étapes qui se jouent en plusieurs pages, chacune ses sous-écrans dans l'ordre. */
const SOUS_ECRANS: Partial<Record<StepId, readonly PageDeCreation[]>> = {
  skills: (['race', 'career', 'talents'] as const satisfies readonly SkillsSub[]).map((s) => `skills.${s}` as const),
};

/** Les pages de l'assistant, dans l'ordre de ses étapes (`stepIds`). */
export const pagesDeCreation = (): PageDeCreation[] => stepIds().flatMap((id): readonly PageDeCreation[] => SOUS_ECRANS[id] ?? [id as PageDeCreation]);

const sousEcran = (p: PageDeCreation): SkillsSub | null => (p.startsWith('skills.') ? (p.slice('skills.'.length) as SkillsSub) : null);

/** Le refus de quitter la page `p` vers la suivante : son étape invalide (`validateStep`), son sous-écran non soldé
 *  (`skillsSubMessage`) ; `null` sinon. */
export function refusDeLaPage(d: CreatorDraft, p: PageDeCreation): string | null {
  const sous = sousEcran(p);
  if (sous === null) return validateStep(d, p as StepId);
  return skillsSubDone(d, sous) ? null : skillsSubMessage(d, sous);
}

/** Une option d'un choix : ce qu'elle dit, le geste qui la choisit, si elle est la choisie, pourquoi elle se refuse. */
interface OptionDeCreation { libelle: string; geste: GesteDuBrouillon; choisie: boolean; refus: string | null }

/** Une rubrique d'une page : un geste (pressé quand il dit l'état courant), un jet tombé et son détail, un choix et ses
 *  options, une valeur et son détail. */
export type RubriqueDeCreation =
  | { genre: 'geste'; id: string; libelle: string; geste: GesteDuBrouillon; presse: boolean; refus: string | null }
  | { genre: 'jet'; id: string; libelle: string; resultat: string; detail: string | null }
  | { genre: 'choix'; id: string; libelle: string; options: OptionDeCreation[] }
  | { genre: 'valeur'; id: string; libelle: string; valeur: string | null; detail: string | null };

const gesteDe = (id: string, libelle: string, g: GesteDuBrouillon, refus: string | null = null, presse = false): RubriqueDeCreation => ({ genre: 'geste', id, libelle, geste: g, presse, refus });
const jet = (id: string, libelle: string, resultat: string, detail: string | null = null): RubriqueDeCreation => ({ genre: 'jet', id, libelle, resultat, detail });
const choix = (id: string, libelle: string, options: OptionDeCreation[]): RubriqueDeCreation => ({ genre: 'choix', id, libelle, options });
const option = (libelle: string, g: GesteDuBrouillon, choisie: boolean, refus: string | null = null): OptionDeCreation => ({ libelle, geste: g, choisie, refus });
const valeur = (id: string, libelle: string, v: string | null, detail: string | null = null): RubriqueDeCreation => ({ genre: 'valeur', id, libelle, valeur: v, detail });

/** Les PX de création que la page vaut, quand elle en vaut. */
const px = (n: number): RubriqueDeCreation[] => (n > 0 ? [valeur('px', t('crea.vue.px'), t('crea.vue.gainDePx', { px: n }))] : []);

/** Les races d'espèces jouables (`speciesAllowed`), groupées par `refChar`, dans l'ordre de la donnée, celles d'un livre de
 *  cœur (`coeur`) d'abord ; chacune ses espèces, sa première la canonique, dont la `family` se lit (LDB 04 l.91). */
export function famillesDEspeces(): { race: SpeciesData['refChar']; famille: string; especes: SpeciesData[] }[] {
  const familles: { race: SpeciesData['refChar']; famille: string; especes: SpeciesData[] }[] = [];
  for (const s of species.filter(speciesAllowed)) {
    const f = familles.find((x) => x.race === s.refChar);
    if (f) f.especes.push(s);
    else familles.push({ race: s.refChar, famille: s.family, especes: [s] });
  }
  const duLivreDeBase = (f: (typeof familles)[number]) => Number(f.especes.some((s) => !!findBookById(s.source.book)?.coeur));
  return familles.sort((a, b) => duLivreDeBase(b) - duLivreDeBase(a));
}

const libelleDeCarriere = (d: CreatorDraft, id: string): string => careerLabelFor({ career: id, appearance: { sex: d.apparence.sex } });

/** 1) La race (LDB 04 l.87-101) : le d100, puis la famille et sa lignée. */
function pageDeLEspece(d: CreatorDraft): RubriqueDeCreation[] {
  const sp = draftSpecies(d);
  const familles = famillesDEspeces();
  const famille = sp && familles.find((f) => f.race === sp.refChar);
  return [
    d.speciesRoll
      ? jet('tirage', t('crea.vue.tirageEspece'), String(d.speciesRoll.roll), listeEt(d.speciesRoll.ids.map((id) => species.find((s) => s.id === id)!.label)))
      : gesteDe('tirage', t('crea.vue.tirerEspece', { px: XP_SPECIES_ACCEPTED }), geste('tirerLEspece')),
    choix('famille', t('crea.vue.race'), familles.map((f) => option(f.famille, geste('espece', sp && f === famille ? sp.id : f.especes[0].id), f === famille))),
    ...(famille && famille.especes.length > 1 ? [choix('lignee', t('crea.vue.lignee'), famille.especes.map((s) => option(s.variant ?? s.label, geste('espece', s.id), s === sp)))] : []),
    ...(sp ? [valeur('espece', sp.label, null, sp.desc ?? null)] : []),
    ...px(speciesXp(d)),
  ];
}

/** 2) La carrière (LDB 05 l.204-212) : le d100 et ses relances, le second lancer offert à chaque jet dont la carrière
 *  a une variante (AA 02 l.109-111 ; VDM 03 l.17-19), les carrières tirées, la classe puis la carrière, les
 *  restrictions de race et les Côtiers (MDG 09 l.9). */
function pageDeLaCarriere(d: CreatorDraft): RubriqueDeCreation[] {
  const offertes = carrieresOffertes(d);
  const carriere = offertes.find((c) => c.id === d.careerId);
  const classe = carriere?.class.id;
  const sp = draftSpecies(d);
  const tirees = sp ? [...new Set(d.careerRolls.flatMap((r) => offreDuJet(sp, r)))] : [];
  const relance = careerXpDuProchainJet(d);
  return [
    ...(d.careerRolls.length
      ? [
          jet('tirage', t('crea.vue.tirageCarriere'), d.careerRolls.map((r) => (r.second ? t('crea.vue.jetEtSecondLancer', { jet: r.roll, second: r.second.roll }) : String(r.roll))).join(t('crea.vue.separateur'))),
          gesteDe('relance', relance ? t('crea.vue.deuxJetsDePlus', { px: relance }) : t('crea.vue.relancerCarriere'), geste('tirerLaCarriere')),
          ...d.careerRolls.flatMap((r, i) => (sp && !r.second && varianteDe(r.id, sp)
            ? [gesteDe(`variante/${i}`, t('crea.vue.secondLancer', { carriere: libelleDeCarriere(d, r.id) }), geste('tirerLaVariante', i))]
            : [])),
          choix('tirees', t('crea.vue.tirees'), tirees.map((id) => option(libelleDeCarriere(d, id), geste('carriere', id), id === d.careerId))),
        ]
      : [gesteDe('tirage', t('crea.vue.tirerCarriere', { px: XP_CAREER_FIRST }), geste('tirerLaCarriere'))]),
    choix('classe', t('crea.vue.classe'), classes.flatMap((cl) => {
      const premiere = offertes.find((c) => c.class.id === cl.id);
      return premiere ? [option(libelleDeClasse(cl.id), geste('carriere', cl.id === classe ? d.careerId : premiere.id), cl.id === classe)] : [];
    })),
    ...(classe ? [choix('carriere', t('crea.vue.carriere'), offertes.filter((c) => c.class.id === classe).map((c) => option(libelleDeCarriere(d, c.id), geste('carriere', c.id), c.id === d.careerId)))] : []),
    gesteDe('restrictions', t('crea.vue.restrictions'), geste('restrictions', !d.ignoreRestrictions), null, d.ignoreRestrictions),
    ...(coastalSwapAvailable(d) ? [gesteDe('cotiers', t('crea.vue.cotiers'), geste('cotiers', !d.coastalSwap), d.careerRolls.length ? t('crea.vue.cotiersAvantLeJet') : null, d.coastalSwap)] : []),
    ...(carriere ? [valeur('carriereChoisie', libelleDeCarriere(d, carriere.id), null, findCareerById(carriere.id)?.desc ?? null)] : []),
    ...px(careerXp(d)),
  ];
}

/** Le compteur `c` en choix de ses valeurs, de son plancher à son plafond (`bornesDuCompteur`) : une valeur au-delà de
 *  ce qui reste à répartir se refuse. */
function compteur(d: CreatorDraft, c: Compteur, id: string, libelle: string): RubriqueDeCreation {
  const { min, max } = bornesDuCompteur(d, c);
  const courante = valeurDuCompteur(d, c);
  const plafond = c.genre === 'points' ? max : c.genre === 'competence' ? MAX_ADV_PER_SKILL : repartition(d, c.genre).quota;
  return choix(id, libelle, Array.from({ length: plafond - min + 1 }, (_, i) => min + i).map((v) =>
    option(String(v), geste('compteur', c, v), v === courante, v > max && v > courante ? t('crea.vue.rienAREpartir') : null)));
}

const METHODES: readonly CharMode[] = ['tire', 'reassigne', 'repartition'];

/** 3) Les Caractéristiques (LDB 05 l.319-464) : la méthode, les dix 2d10 tirés puis relancés, chaque Caractéristique
 *  (tirée, réassignée à un jet, ou achetée), les 5 Augmentations de carrière, Destin et Résilience. */
function pageDesCaracteristiques(d: CreatorDraft): RubriqueDeCreation[] {
  const valeurs = draftChars(d);
  const jets = charRolls(d);
  const carac = (k: CharKey): RubriqueDeCreation => {
    if (d.charMode === 'repartition') return compteur(d, { genre: 'points', k }, `carac/${k}`, charAbr(k));
    if (d.charMode === 'reassigne' && d.charsRolled) return choix(`carac/${k}`, charAbr(k), jets.map((j, i) => option(String(j), geste('assigner', k, i), d.assignment[k] === i)));
    return valeur(`carac/${k}`, charAbr(k), d.charsRolled ? String(valeurs[k]) : null, CHAR_LABELS[k]);
  };
  return [
    choix('methode', t('crea.vue.methode'), METHODES.map((m) => {
      const gain = charsXpDeLaMethode(d, m);
      return option(gain ? t('crea.vue.methodeEtPx', { methode: t(`crea.vue.methode.${m}`), px: gain }) : t(`crea.vue.methode.${m}`), geste('methode', m), d.charMode === m);
    })),
    ...(d.charMode === 'repartition' ? []
      : [d.charsRolled ? gesteDe('tirage', t('crea.vue.relancerCaracteristiques'), geste('relancerLesCaracteristiques')) : gesteDe('tirage', t('crea.vue.tirerCaracteristiques'), geste('tirerLesCaracteristiques'))]),
    ...CHAR_KEYS.map(carac),
    ...careerCharKeys(d).map((k) => compteur(d, { genre: 'augmentation', k }, `augmentation/${k}`, t('crea.vue.augmentation', { carac: charAbr(k) }))),
    ...(repartition(d, 'destin').quota
      ? [compteur(d, { genre: 'destin', k: 'fate' }, 'destin', t('ecran.destin')), compteur(d, { genre: 'destin', k: 'resilience' }, 'resilience', t('ecran.fiche.resilience'))]
      : []),
    ...px(charsXp(d)),
  ];
}

/** 3bis) Le signe astral (ADE II 3) : le d100, puis le signe. */
function pageDuSigne(d: CreatorDraft): RubriqueDeCreation[] {
  const signe = findStarById(d.star);
  return [
    d.starRollValue === undefined
      ? gesteDe('tirage', t('crea.vue.tirerSigne', { die: formatDice(starDie()), px: XP_STAR_ROLLED }), geste('tirerLeSigne'))
      : jet('tirage', t('crea.vue.tirageSigne', { die: formatDice(starDie()) }), String(d.starRollValue), findStarById(d.starRoll)?.label ?? null),
    choix('signe', t('crea.vue.signe'), stars.map((s) => option(s.label, geste('signe', s.id), s.id === d.star))),
    ...(signe ? [valeur('signeChoisi', signe.label, null, signe.desc ?? null)] : []),
    ...px(starXp(d)),
  ];
}

const PALIERS = [0, 3, 5] as const;

/** 4a) Les Compétences de race (LDB 05 l.484) : 3 à +5 et 3 à +3, chacune à son palier, la spécialisation d'un joker. */
function pageDesCompetencesDeRace(d: CreatorDraft): RubriqueDeCreation[] {
  const sp = draftSpecies(d)!;
  return [
    gesteDe('defaut', t('crea.vue.competencesDEspece'), geste('competencesDEspece')),
    ...speciesSkillRefs(d).flatMap((ref, i) => {
      const retenue = speciesSkillPick(d, ref);
      const palier = speciesSkillTier(d, ref);
      const nom = retenue?.spec ? refLabel('skills', retenue) : advancementLabel('skills', ref);
      const autres = [...d.speciesPlus5, ...d.speciesPlus3].filter((r) => r !== retenue);
      return [
        choix(`palier/${i}`, nom, PALIERS.map((p) => option(p ? `+${p}` : '0', geste('palier', ref, p), p === palier, p !== palier && withSpeciesSkillTier(d, ref, p) === d ? t('crea.vue.rienAREpartir') : null))),
        ...(ref.choix != null && retenue
          ? [choix(`specialite/${i}`, t('crea.vue.specialite', { nom: refLabel('skills', { id: ref.id }) }),
              poolDuJoker('skill', ref).filter(libreDEspece(sp, ref, autres)).map((s) => option(specLabel('skills', ref.id, s), geste('specialiteDEspece', ref, s), retenue.spec === s)))]
          : []),
      ];
    }),
  ];
}

/** 4b) Les Compétences de carrière (LDB 05 l.535) : 40 Augmentations, 10 au plus par Compétence, la spécialisation
 *  d'un joker augmenté. */
function pageDesCompetencesDeCarriere(d: CreatorDraft): RubriqueDeCreation[] {
  return [
    gesteDe('defaut', t('crea.vue.competencesDeCarriere'), geste('competencesDeCarriere')),
    ...careerSkillEntries(d).flatMap((c) => {
      const nom = c.designee ? refLabel('skills', c.designee) : advancementLabel('skills', c.ref);
      return [
        compteur(d, { genre: 'competence', cle: c.cle }, `competence/${c.adresse}`, nom),
        ...(c.ref.choix != null && (d.skillAdvances[c.cle] ?? 0) > 0
          ? [choix(`specialite/${c.adresse}`, t('crea.vue.specialite', { nom: refLabel('skills', { id: c.ref.id }) }),
              poolDuJoker('skill', c.ref).filter(c.libre).map((s) => option(specLabel('skills', c.ref.id, s), geste('specialiteDeCarriere', c.adresse, s), d.specChoices[c.adresse] === s)))]
          : []),
      ];
    }),
  ];
}

const descDuTalent = (id: string): string | null => findTalentById(id)?.desc ?? null;
const memeRef = (a: RefDesignee | undefined, b: RefDesignee): boolean => !!a && refKey(a.id, a.spec) === refKey(b.id, b.spec);

/** 4c) Les Talents (LDB 05 l.484, l.535 ; LDB 10 l.714) : ceux de race (acquis, « A ou B », tirés au d100, leur
 *  relance et leur utilisation), le Talent de carrière, les sorts de Magie mineure qu'un Talent inclut. */
function pageDesTalents(d: CreatorDraft): RubriqueDeCreation[] {
  const n = speciesTalentRandomCount(d);
  const probe = probeHero(d, false);
  const quota = pettySpellQuota(d);
  return [
    ...speciesTalentFixedEntries(d).map((r, i) => valeur(`acquis/${i}`, refLabel('talents', r), null, descDuTalent(r.id))),
    ...speciesTalentChoiceEntries(d).map((e) => {
      const retenue = d.speciesTalentChoices[e.adresse];
      return choix(`option/${e.adresse}`, advancementLabel('talents', e.ref), e.options.map((o) => option(advancementLabel('talents', o), geste('talentDEspece', e.adresse, o), !!retenue && cleDOption(retenue) === cleDOption(o))));
    }),
    ...(n && !d.talentsRolled ? [gesteDe('tirage', t('crea.vue.tirerTalents', { n }), geste('tirerLesTalents'))] : []),
    ...speciesTalentRandomDrawn(d).flatMap((x) => {
      const nom = refLabel('talents', { id: x.ref.id });
      return [
        valeur(`tire/${x.adresse}`, refLabel('talents', x.utilisationChoisie == null ? { id: x.ref.id } : x.ref), x.doublon ? t(x.auMaxi ? 'crea.vue.auMaxi' : 'crea.vue.dejaPossede') : null, descDuTalent(x.ref.id)),
        ...(x.doublon ? [gesteDe(`relance/${x.adresse}`, t('crea.vue.relancerTalent', { nom }), geste('relancerLeTalent', x.adresse))] : []),
        ...(x.utilisations.length
          ? [choix(`utilisation/${x.adresse}`, t('crea.vue.utilisation', { nom }), x.utilisations.map((u) => option(specLabel('talents', x.ref.id, u), geste('utilisation', x.adresse, u), x.utilisationChoisie === u)))]
          : []),
      ];
    }),
    choix('talentDeCarriere', t('crea.vue.talentDeCarriere'), careerTalentOptions(d).flatMap((o) => o.choices ?? [o.selected!]).map((r) => {
      const nom = refLabel('talents', r);
      return option(nom, geste('talentDeCarriere', r), memeRef(d.careerTalent, r), talentMaxReached(probe, r.id, r.spec) ? t('crea.maxiAtteint', { nom }) : null);
    })),
    ...(quota
      ? [choix('sorts', t('crea.vue.sortsMineurs', { n: quota }), idsDeLaSousListe('spell', 'mineure').map((id) => {
          const retenu = d.pettySpells.includes(id);
          return option(findSpellById(id)!.label, geste('sortMineur', id), retenu, !retenu && d.pettySpells.length >= quota ? t('crea.vue.rienAREpartir') : null);
        }))]
      : []),
  ];
}

/** Un emplacement de dotation en choix (LDB 05 l.542-583) : une branche, l'emplacement que porte la branche choisie
 *  dessous ; une arme au choix ; un Atout de Fabrication (LDB 60 l.9-32), `DEFAULT_FABRICATION_ATOUT` à défaut. */
function dotation(d: CreatorDraft, e: EmplacementDeDotation): RubriqueDeCreation[] {
  const choisis = d.trappingChoices ?? {};
  switch (e.sorte) {
    case 'branches': {
      const j = brancheChoisie(e, choisis);
      const sous = j === undefined ? undefined : sousEmplacement(e, j);
      return [choix(e.adresse, t('crea.vue.auChoix'), valeursDeLEmplacement(e).map((k) => option(libelleDeLaValeur(e, k), geste('dotation', e.adresse, k), k === j))), ...(sous ? dotation(d, sous) : [])];
    }
    case 'joker': return [choix(e.adresse, trappingRefLabel(e.ref), valeursDeLEmplacement(e).map((id) => option(libelleDeLaValeur(e, id), geste('dotation', e.adresse, id), idChoisi(e, choisis) === id)))];
    case 'atout': {
      const atout = idChoisi(e, choisis) ?? DEFAULT_FABRICATION_ATOUT;
      return [choix(e.adresse, trappingRefLabel(e.ref), valeursDeLEmplacement(e).map((id) => option(libelleDeLaValeur(e, id), geste('dotation', e.adresse, id), id === atout)))];
    }
  }
}

/** 5) Les possessions (LDB 05 l.542-583) : la bourse tirée, puis chaque emplacement de dotation à trancher. */
function pageDesPossessions(d: CreatorDraft): RubriqueDeCreation[] {
  const bourse = draftWealth(d);
  return [
    d.wealthRoll
      ? jet('bourse', t('crea.vue.bourse'), formatMoney(bourse.montant), bourse.faces.join(t('crea.vue.separateur')))
      : gesteDe('bourse', t('crea.vue.tirerBourse'), geste('tirerLaBourse')),
    ...(draftLevel(d) ? emplacementsDeDotation(dotationsDuHeros(d.careerId)).filter(estEmplacementRacine).flatMap((e) => dotation(d, e)) : []),
  ];
}

/** 6) L'identité : le sexe, le nom, le physique tiré aux dés. */
function pageDeLIdentite(d: CreatorDraft): RubriqueDeCreation[] {
  return [
    choix('sexe', t('crea.vue.sexe'), sexeSchema.options.map((s) => option(libelleDeValeur(sexeSchema, s), geste('sexe', s), s === d.apparence.sex))),
    gesteDe('nom', t('crea.vue.tirerNom'), geste('tirerUnNom', hashSeed(`nom/${d.seed}/${d.label}`))),
    ...(d.label ? [valeur('nomTire', t('crea.vue.nom'), d.label)] : []),
    ...(d.age === undefined
      ? [gesteDe('physique', t('crea.vue.tirerPhysique'), geste('tirerLePhysique'))]
      : [
          valeur('age', t('crea.vue.age'), String(d.age)),
          valeur('taille', t('crea.vue.taille'), t('crea.vue.centimetres', { n: d.height ?? 0 })),
          valeur('yeux', t('crea.vue.yeux'), d.eyes ?? null),
          valeur('cheveux', t('crea.vue.cheveux'), d.hair ?? null),
        ]),
  ];
}

/** 7) La présentation : le héros que le brouillon construit (`apercuDuHeros`), son espèce, sa carrière, ses PX de création
 *  et ses Caractéristiques. */
function pageDeLaPresentation(d: CreatorDraft): RubriqueDeCreation[] {
  const h = apercuDuHeros(d);
  return [
    valeur('nom', h.label, null),
    valeur('espece', draftSpecies(d)!.label, null),
    valeur('carriere', libelleDeCarriere(d, d.careerId), null),
    valeur('px', t('crea.vue.px'), String(xpTotal(d))),
    ...CHAR_KEYS.map((k) => valeur(`carac/${k}`, charAbr(k), String(effectiveChar(h, k)), CHAR_LABELS[k])),
  ];
}

const PAGES: Record<PageDeCreation, (d: CreatorDraft) => RubriqueDeCreation[]> = {
  species: pageDeLEspece,
  career: pageDeLaCarriere,
  chars: pageDesCaracteristiques,
  star: pageDuSigne,
  'skills.race': pageDesCompetencesDeRace,
  'skills.career': pageDesCompetencesDeCarriere,
  'skills.talents': pageDesTalents,
  trappings: pageDesPossessions,
  details: pageDeLIdentite,
  presentation: pageDeLaPresentation,
};

/** Les rubriques de la page `p` du brouillon `d`. */
export const rubriquesDeLaPage = (d: CreatorDraft, p: PageDeCreation): RubriqueDeCreation[] => PAGES[p](d);
