/**
 * Les héros hors d'une partie : la recrue que la création 5e du noyau crée, ses Caractéristiques, ses libellés.
 */
import {
  apresLeGeste,
  brouillonDeLaPartie,
  pagesDeCreation,
  refusDeLaPage,
  rubriquesDeLaPage,
  type CreatorDraft,
  type GesteDuBrouillon,
} from '../../../../src/noyau';
import { buildHero, carrieresOffertes, especesOffertes } from '../../../../src/noyau/creation/brouillon';
import { randomSpeciesTable } from '../../../../src/engine/creation';
import { adresseDeCreation } from '../../../../src/engine/adresseDeCreation';
import { designateSlot, skillSlots, slotCovers } from '../../../../src/engine/careerSlots';
import { fabriqueLocale } from '../../../../src/engine/fabriqueDId';
import { effectiveChar } from '../../../../src/engine/characteristics';
import { raisonVerrouEtat } from '../../../../src/engine/conditions';
import {
  findCareerById,
  levelsForCareer,
  characteristics,
  conditionLabel,
  refLabel,
  skills,
} from '../../../../src/data';
import { makeRNG, type RNG } from '../../../../src/engine/dice';
import type { Combatant, CharKey, ConditionInstance } from '../../../../src/engine/types';
import type { RefDesignee } from '../../../../src/data/schemas/grammaire/ref';

/** La spécialisation `spec` de la Compétence `id` désignée à l'emplacement « (Au choix) » du niveau `niveau`. */
export interface Designation { niveau: number; id: string; spec: string }
/** Ce qui fait l'identité d'une recrue à sa création : le Talent de carrière choisi (et sa spécialisation : le dieu
 *  d'un Béni), les Sorts mineurs d'un lanceur, et les emplacements « (Au choix) » de Compétence désignés. */
export interface Identite { talent: { id: string; spec?: string }; sortsMineurs?: readonly string[]; designations?: readonly Designation[] }

/** Les gestes de création qu'une recrue laisse au hasard de sa graine, une fois ses choix d'identité faits : la
 *  spécialisation d'un emplacement « (Au choix) », un Talent d'espèce à choix, l'utilisation d'un Talent tiré, une
 *  dotation à choix, et le Talent de carrière quand celui de l'identité est déjà au Maxi par un Talent tiré. */
const CHOIX_AU_HASARD: ReadonlySet<GesteDuBrouillon['geste']> = new Set(['specialiteDeCarriere', 'specialiteDEspece', 'talentDEspece', 'utilisation', 'dotation', 'talentDeCarriere']);

/** Les Sorts mineurs que la page des Talents de `d` offre encore. LDB 10 l.714 */
const sortsMineursLibres = (d: CreatorDraft): GesteDuBrouillon[] =>
  rubriquesDeLaPage(d, 'skills.talents').flatMap((r) => (r.genre === 'choix' ? r.options.flatMap((o) => (o.geste.geste === 'sortMineur' && !o.choisie && !o.refus ? [o.geste] : [])) : []));

/** Un héros neuf de la carrière `carriere` et de l'espèce `espece`, créé par le brouillon du noyau sous la règle
 *  `creation-5e` (`poserLesReglesDuRoguelite`), par ses gestes publics (`apresLeGeste`) : ses Caractéristiques tirées,
 *  leur bonus de carrière porté au plus haut sur chaque Caractéristique de carrière à son tour, ses Compétences
 *  d'espèce à +5 (les `utile` d'abord, puis au hasard), la Répartition simple de carrière, son Talent d'identité, ses
 *  Talents tirés, ses Sorts mineurs (ceux de l'identité, puis au hasard jusqu'au quota), sa bourse, son sexe et son
 *  nom ; les choix restants (`CHOIX_AU_HASARD`) tirés à la graine `graine`. Une désignation du niveau 1 passe par la
 *  création (`specialiteDeCarriere`), une autre se pose sur le héros par `designateSlot`. CRB 006 l.5 ; CRB 014 l.11 ;
 *  CRB 008 l.59 ; CRB 015 l.7, l.12 */
export function nouvelleRecrue(graine: number, carriere: string, espece: string, identite: Identite, utile: (ref: RefDesignee) => boolean): Combatant {
  const rng = makeRNG(graine);
  let d = brouillonDeLaPartie(graine, 0);
  if (d.procedure !== '5e') throw new Error('Recrue hors de la règle `creation-5e` : `poserLesReglesDuRoguelite` se joue au démarrage.');
  const jouer = (g: GesteDuBrouillon) => { d = apresLeGeste(d, g); };
  jouer({ geste: 'espece', args: [espece] });
  jouer({ geste: 'carriere', args: [carriere] });
  jouer({ geste: 'tirerLesCaracteristiques', args: [] });
  for (const id of rubriquesDeLaPage(d, 'chars').map((x) => x.id)) {
    const r = rubriquesDeLaPage(d, 'chars').find((x) => x.id === id);
    if (r?.genre !== 'choix') continue;
    const bonus = r.options.flatMap((o) => (o.geste.geste === 'compteur' && o.geste.args[0].genre === 'augmentation' && !o.refus ? [o.geste] : []));
    if (bonus.length) jouer(bonus.reduce((m, g) => (g.args[1] > m.args[1] ? g : m)));
  }
  const paliers = rubriquesDeLaPage(d, 'skills.race').flatMap((r) => (r.genre === 'choix' ? r.options.flatMap((o) => (o.geste.geste === 'palier' && o.geste.args[1] === 5 ? [o.geste] : [])) : []));
  const auHasard = paliers.map((g) => ({ g, rang: (utile(g.args[0]) ? 0 : 1) + rng.int(0, 999) / 1000 }));
  for (const { g } of auHasard.sort((a, b) => a.rang - b.rang)) jouer(g);
  const premier = levelsForCareer(carriere).find((l) => l.level === 1)?.skills ?? [];
  const designations = identite.designations ?? [];
  for (const x of designations.filter((y) => y.niveau === 1)) {
    const i = premier.findIndex((r) => 'id' in r && r.id === x.id && r.choix != null);
    if (i < 0) throw new Error(`Désignation ${x.id} (${x.spec}) : aucun emplacement « (Au choix) » au niveau 1 de ${carriere}.`);
    jouer({ geste: 'specialiteDeCarriere', args: [adresseDeCreation.carriereCompetence(i), x.spec] });
  }
  jouer({ geste: 'competencesDeCarriere', args: [] });
  jouer({ geste: 'talentDeCarriere', args: [identite.talent] });
  jouer({ geste: 'tirerLesTalents', args: [] });
  for (const s of identite.sortsMineurs ?? []) jouer({ geste: 'sortMineur', args: [s] });
  for (let libres = sortsMineursLibres(d); libres.length && refusDeLaPage(d, 'skills.talents'); libres = sortsMineursLibres(d)) jouer(libres[rng.int(0, libres.length - 1)]);
  jouer({ geste: 'tirerLaBourse', args: [] });
  jouer({ geste: 'sexe', args: [rng.int(0, 1) ? 'M' : 'F'] });
  jouer({ geste: 'tirerUnNom', args: [graine] });
  for (let page = pagesDeCreation(d).find((p) => refusDeLaPage(d, p)); page; page = pagesDeCreation(d).find((p) => refusDeLaPage(d, p))) {
    const options = rubriquesDeLaPage(d, page).flatMap((r) => (r.genre === 'choix' && !r.options.some((o) => o.choisie && !o.refus) ? [r.options.filter((o) => !o.refus && CHOIX_AU_HASARD.has(o.geste.geste))] : [])).find((l) => l.length);
    if (!options) throw new Error(`${carriere} × ${espece} : la page ${page} de la création refuse (${refusDeLaPage(d, page)}).`);
    jouer(options[rng.int(0, options.length - 1)].geste);
  }
  const c = buildHero(d, fabriqueLocale(`r${graine}`));
  const niveaux = levelsForCareer(carriere);
  const emplacements = skillSlots(niveaux, Math.max(...niveaux.map((l) => l.level)));
  for (const x of designations.filter((y) => y.niveau > 1)) {
    const slot = emplacements.find((s) => s.needsChoice && s.level === x.niveau && slotCovers(s, x.id, x.spec));
    const r = slot ? designateSlot(c, carriere, slot, x.id, x.spec, emplacements) : { ok: false, reason: 'aucun emplacement' };
    if (!r.ok) throw new Error(`Désignation ${x.id} (${x.spec}) au niveau ${x.niveau} de ${carriere} : ${r.reason}.`);
  }
  return c;
}

/** Une espèce de `especes` tirée pour la carrière `carriere`, sur la création 5e du noyau : parmi les espèces que le
 *  brouillon offre (`especesOffertes`) et dont le tirage de carrière offre `carriere` (`carrieresOffertes`), au poids de
 *  leur rangée à la table des espèces du brouillon (`randomSpeciesTable`). CRB 006 l.9-17 ; CRB 013 l.7-9 */
export function tirerUneEspece(rng: RNG, carriere: string, especes: readonly string[]): string {
  const d = brouillonDeLaPartie(0, 0);
  const offertes = especesOffertes(d);
  const permise = (id: string) => especes.includes(id) && carrieresOffertes(apresLeGeste(d, { geste: 'espece', args: [id] })).some((c) => c.id === carriere);
  const rangees = randomSpeciesTable(offertes).entries.flatMap(({ min, max, ids }) => ids.filter(permise).slice(0, 1).map((id) => ({ id, poids: max - min + 1 })));
  let jet = rng.int(1, rangees.reduce((n, r) => n + r.poids, 0));
  return rangees.find((r) => (jet -= r.poids) <= 0)!.id;
}

/** Valeur courante d'une Caractéristique, Augmentations et effets compris. */
export const carac = (c: Combatant, k: CharKey): number => effectiveChar(c, k);


/** Hors de combat : à 0 PB ou Inconscient. */
export const horsDeCombat = (c: Combatant): boolean => !!c.dead || c.wounds.current <= 0 || c.conditions.some((e) => e.id === 'inconscient');

/** Libellé d'une carrière (`careers.json`). */
export const nomDeCarriereDuLivre = (id: string): string => findCareerById(id)?.label ?? id;

/** Ce que le livre dit d'une Caractéristique (`characteristics.json`), verbatim. */
export const texteDeCarac = (k: CharKey): string => characteristics.find((x) => x.id === k)?.desc ?? '';
/** Ce que le livre dit d'une Compétence (`skills.json`) : son texte verbatim, et la Caractéristique qui la porte. */
export function ficheDeCompetence(id: string): { texte: string; carac?: CharKey } {
  const d = skills.find((x) => x.id === id);
  return { texte: d?.desc ?? '', ...(d?.characteristic ? { carac: d.characteristic as CharKey } : {}) };
}

/** D'où vient l'État porté `e`, tel que le noyau le dit sur le héros : le fait qui le porte (`derivedFrom`, symptôme,
 *  mutation, trait…), le verrou qui le retient (`raisonVerrouEtat`), sa durée en Rounds, l'effet actif qui le repose
 *  à chaque Round (`opsPerRound`), et pour l'Inconscient les 0 Blessure (LDB 18 l.15). Vide quand le noyau ne dit rien
 *  de sa cause. */
export function causesDEtat(c: Combatant, e: ConditionInstance): string[] {
  const src = e.derivedFrom?.src;
  const verrou = raisonVerrouEtat(e, c);
  return [
    ...(src ? [`Porté par : ${refLabel(src.category, { id: src.id })}.`] : []),
    ...(verrou ? [verrou] : []),
    ...(e.roundsLeft != null ? [`Encore ${e.roundsLeft} Round${e.roundsLeft > 1 ? 's' : ''}.`] : []),
    ...(c.activeEffects ?? []).filter((x) => x.opsPerRound?.some((o) => o.op === 'condition' && o.id.id === e.id))
      .map((x) => `Reposé à chaque fin de Round par ${x.label}${x.duration.scale === 'rounds' ? `, encore ${x.duration.left} Round${x.duration.left > 1 ? 's' : ''}` : ''}.`),
    ...(e.id === 'inconscient' && c.wounds.current <= 0 ? ['À 0 Blessure.'] : []),
  ];
}

/** Libellé d'un État porté (`etats.json`), sa valeur comprise. */
export const libelleDEtat = (id: string, valeur: number): string => {
  const nom = conditionLabel(id);
  return valeur > 1 ? `${nom} ${valeur}` : nom;
};
