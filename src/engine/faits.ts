/**
 * LES FAITS APPLIQUÉS (#4574 lot 3) — ce qu'une op a RÉELLEMENT fait à sa cible, en données : ids stables,
 * nombres signés, détail typé, jamais de texte composé ni de nom. Le journal en est la lecture
 * (`texteDuFait`), seul compositeur des lignes de ces genres que rendent `applyOps`, les socles d'États qu'il
 * compose (`syncDerivedConditions`, `releaseConditionLocks`), `gainCorruption` et l'interprète inline des maladies
 * (`applyOnFailInline`) : une ligne de ces producteurs naît de son fait.
 */
import { conditionLabel, refLabel } from '../data';
import { t, pluriel } from '../i18n';
import type { SensDuPrix } from './bargain';
import { formatMoney, fromBrass } from './money';
import { nomDe } from './nom';
import { campOf, type Camp } from './relations';
import type { CodexTarget } from './ruleRefs';
import type { Combatant, ConditionId, HitLocation } from './types';

/** La durée d'un État posé : Rounds, horloge (minutes), ou annonce d'une pose récurrente (pions par Round). */
export type DureeDEtat = { rounds: number } | { minutes: number } | { parRound: number };

/** Atténuation d'une perte de Blessures hors coup d'arme : `sans`, ou ce que la perte a déduit. */
export type MitigationDesBlessures = 'sans' | { pa: 'touches' | 'ignores'; be: 'deduit' | 'ignore' };

interface FaitSurUneCible {
  /** Id du combattant qui subit le fait. */
  cible: string;
  /** Camp de la cible au moment du fait (`campOf`). */
  camp: Camp;
}

/** Blessures perdues ou regagnées. */
export interface FaitDeBlessures extends FaitSurUneCible {
  genre: 'blessures';
  /** − Blessures perdues, + (ou 0) Blessures regagnées. */
  valeur: number;
  /** Atténuation d'une perte hors coup d'arme ; absente sur un coup d'arme, qui l'a déjà comptée. */
  mitigation?: MitigationDesBlessures;
  /** Regagnées par drain. */
  vol?: true;
}

/** Avantage gagné, complété ou dépensé. */
export interface FaitDAvantage extends FaitSurUneCible {
  genre: 'avantage';
  /** Variation signée. */
  valeur: number;
  /** Avantage après le fait. */
  total: number;
  /** Porté à `total` plutôt qu'incrémenté. */
  complete?: true;
}

/** Pions d'un État posés ou retirés. */
export interface FaitDEtat extends FaitSurUneCible {
  genre: 'etat';
  /** Id de l'État. */
  id: ConditionId;
  /** Variation signée du compte de pions ; 0 pour l'annonce d'une pose récurrente. */
  valeur: number;
  /** Durée de la pose ; d'un État porté, celle de son porteur. */
  duree?: DureeDEtat;
  /** État porté par un effet ; `src` : ce qui le porte. */
  porte?: { src?: CodexTarget };
  /** Retiré par l'acte de soin qui lève son verrou. */
  verrouLeve?: true;
  /** Tout l'État retiré. */
  tous?: true;
}

/** Corruption gagnée, retirée ou écartée. */
export type FaitDeCorruption = FaitSurUneCible & { genre: 'corruption' } & (
  /** `valeur` signée (0 : un retrait sans rien à retirer), `total` : Corruption après le fait. */
  | { valeur: number; total: number }
  /** Gain écarté par une protection : rien n'est appliqué. */
  | { valeur: 0; contre: 'protection' }
);

/** Argent reçu ou perdu. */
export interface FaitDArgent extends FaitSurUneCible {
  genre: 'argent';
  /** Variation signée, en sous de cuivre. */
  valeur: number;
}

/** La Localisation qu'une Blessure critique frappe. */
export interface FaitDeLocalisation extends FaitSurUneCible {
  genre: 'localisation';
  /** La Localisation frappée. */
  valeur: HitLocation;
}

/** Un prix marchandé. */
export interface FaitDePrix extends FaitSurUneCible {
  genre: 'prix';
  /** Variation signée du prix, en points de pourcentage. */
  valeur: number;
  /** Le prix d'un achat ou d'une vente. */
  sens: SensDuPrix;
}

/** Ce qu'un fait a fait d'un objet : `usee` (un point perdu), `brisee` (inutilisable), `lachee` (tombée des mains),
 *  `intacte` (Incassable), `sauvee` (Sauvegarde Solide tenue sur son dé), `imperdable` (sauvée sans dé). */
export type IssueDObjet = 'usee' | 'brisee' | 'lachee' | 'intacte' | 'sauvee' | 'imperdable';

/** Ce qu'un fait a fait d'une arme ou d'une pièce d'armure (`IssueDObjet`). */
export interface FaitDObjet extends FaitSurUneCible {
  genre: 'objet';
  /** L'arme (`weaponIdentity`) ou la Localisation de l'armure. */
  objet: { arme: string } | { armure: HitLocation };
  /** −1 : un point d'arme ou de PA perdu, ou l'objet brisé ; 0 sinon. */
  valeur: -1 | 0;
  issue: IssueDObjet;
}

/** Un fait que le journal dit par sa ligne (`texteDuFait`). */
export type FaitAvecLigne = FaitDeBlessures | FaitDAvantage | FaitDEtat | FaitDeCorruption | FaitDArgent;

export type FaitApplique = FaitAvecLigne | FaitDeLocalisation | FaitDePrix | FaitDObjet;

/** Les genres que le journal dit par leur ligne (`texteDuFait`) : un genre neuf s'y déclare. */
const GENRE_AVEC_LIGNE: Readonly<Record<FaitApplique['genre'], boolean>> = {
  blessures: true, avantage: true, etat: true, corruption: true, argent: true, localisation: false, prix: false, objet: false,
};

/** Le fait `f` a-t-il une ligne de journal (`texteDuFait`) ? */
const aUneLigne = (f: FaitApplique): f is FaitAvecLigne => GENRE_AVEC_LIGNE[f.genre];

/** Le fait d'objet `issue` sur l'objet `objet` de `cible`. */
export const faitDObjet = (cible: Pick<Combatant, 'id' | 'kind'>, objet: FaitDObjet['objet'], issue: IssueDObjet): FaitDObjet =>
  ({ genre: 'objet', cible: cible.id, camp: campOf(cible), objet, valeur: issue === 'usee' || issue === 'brisee' ? -1 : 0, issue });

/** Le fait de prix de `valeur` points de pourcentage (signée) dans le sens `sens`, marchandé par `cible`. */
export const faitDePrix = (cible: Pick<Combatant, 'id' | 'kind'>, valeur: number, sens: SensDuPrix): FaitDePrix =>
  ({ genre: 'prix', cible: cible.id, camp: campOf(cible), valeur, sens });

/** Le fait d'argent de `valeur` sous de cuivre (signée) sur `cible`. */
export const faitDArgent = (cible: Pick<Combatant, 'id' | 'kind'>, valeur: number): FaitDArgent =>
  ({ genre: 'argent', cible: cible.id, camp: campOf(cible), valeur });

export type NatureDEffet = 'effet' | 'metamorphose' | 'mutation' | 'contrecoup' | 'lumiere' | 'sequelle';

/** Le nom de la SOURCE d'un lot d'ops (`ActiveEffect.label`, journal) : son libellé, sinon la NATURE de
 *  l'effet posé — la taverne, le navire, les postes de voyage, l'entretien et les déclencheurs posent un
 *  `OpsCtx` sans libellé (#1906). Jamais « sort » pour une source qui n'en est pas un. */
export function nomDeSource(ctx: { label?: string } | undefined, nature: NatureDEffet = 'effet'): string {
  return ctx?.label ?? t(`op.nature.${nature}`);
}

/** Le résultat d'une application : les lignes du journal et les faits dont elles sont la lecture. */
export interface Applique { lignes: string[]; faits: FaitApplique[] }

/** Le fragment d'une durée bornée, en Rounds ou à l'horloge. */
function texteDeDuree(d: { rounds: number } | { minutes: number }): string {
  if ('minutes' in d) {
    const min = d.minutes;
    return min >= 60 ? t('op.frag.heures', { n: Math.round(min / 60), s: min >= 120 ? 's' : '' }) : t('op.frag.minutes', { n: min });
  }
  return t('op.frag.plafondDeRounds', { n: d.rounds, s: d.rounds > 1 ? 's' : '' });
}

function texteDEtat(f: FaitDEtat, name: string, source: string | undefined): string {
  const cond = conditionLabel(f.id);
  const d = f.duree;
  if (f.porte) {
    const src = f.porte.src ? refLabel(f.porte.src.category, { id: f.porte.src.id }) : t('cond.derivedSrcFallback');
    if (f.valeur <= 0) return t('cond.derivedLoss', { name, cond, src });
    return t('cond.derivedGain', { name, cond, src, duree: d && !('parRound' in d) ? ` (${texteDeDuree(d)})` : '' });
  }
  if (f.verrouLeve) return t('cond.lockReleased', { name, cond });
  if (f.valeur < 0) return t('op.etatRetire', { name, what: f.tous ? t('op.etatsTous') : t('op.etatsCertains', { n: -f.valeur }), cond });
  if (d && 'parRound' in d) return t('op.etatParRound', { name, v: d.parRound, cond, src: nomDeSource({ label: source }) });
  const v = f.valeur;
  if (d) return t('op.etatTemporaire', { name, v, cond, roundsTxt: texteDeDuree(d) });
  return t('op.etat', { name, v, cond });
}

function texteDesBlessures(f: FaitDeBlessures, name: string): string {
  if (f.valeur >= 0) return t(f.vol ? 'op.volDeVie' : 'op.soin', { name, n: f.valeur });
  const m = f.mitigation;
  const mitig = m == null ? '' : m === 'sans' ? t('op.frag.sansAttenuation')
    : ` (${m.pa === 'touches' ? t('op.frag.paTouches') : t('op.frag.paIgnores')}, ${m.be === 'deduit' ? t('op.frag.beDeduit') : t('op.frag.beIgnore')})`;
  return t('op.blessures', { name, n: -f.valeur, mitig });
}

/** LA ligne de journal d'un fait appliqué : `name`, nom de sa cible (`nomDe`) ; `source`, libellé du lot qui l'applique
 *  (`OpsCtx.label`, lu par `nomDeSource`). Libellés d'affichage, jamais portés par le fait. */
export function texteDuFait(f: FaitAvecLigne, name: string, source?: string): string {
  switch (f.genre) {
    case 'blessures': return texteDesBlessures(f, name);
    case 'avantage':
      if (f.valeur < 0) return t('op.avantageDepense', { name });
      return f.complete ? t('op.avantageComplete', { name, n: f.total }) : t('op.gainDAvantage', { name, n: f.valeur, s: pluriel(f.valeur) });
    case 'etat': return texteDEtat(f, name, source);
    case 'corruption':
      if ('contre' in f) return t('cor.phaWard', { name });
      return f.valeur <= 0
        ? t('op.corruptionRetiree', { name, delta: f.valeur, total: f.total })
        : t('op.corruptionAjoutee', { name, amount: f.valeur, s: f.valeur > 1 ? 's' : '', total: f.total });
    case 'argent':
      return t('op.argent', { name, sens: f.valeur > 0 ? t('op.argent.gagne') : t('op.argent.perd'), montant: formatMoney(fromBrass(Math.abs(f.valeur))), src: nomDeSource({ label: source }) });
  }
}

/** Pousse `f` et sa ligne dans `a` : LA seule émission d'un fait avec sa ligne. */
export function emettreDans(a: Applique, cible: Pick<Combatant, 'id' | 'label'>, f: FaitAvecLigne, source?: string): void {
  a.faits.push(f);
  a.lignes.push(texteDuFait(f, nomDe(cible), source));
}

/** Pousse `f` dans `a` sans ligne : LA seule émission d'un fait que le journal ne dit pas, ou que son producteur dit
 *  par sa propre prose. */
export function constaterDans(a: Applique, f: FaitApplique): void {
  a.faits.push(f);
}

/** Les lignes de `a` qui ne lisent aucun de ses faits (`texteDuFait`), dans leur ordre : ce qu'une révélation dit en
 *  lignes à côté des faits qu'elle porte. `nom` : le nom d'une cible par son id ; `source` : le libellé du lot. */
export function lignesHorsDesFaits(a: Applique, nom: (id: string) => string, source?: string): string[] {
  const restantes = [...a.lignes];
  for (const f of a.faits) {
    if (!aUneLigne(f)) continue;
    const i = restantes.indexOf(texteDuFait(f, nom(f.cible), source));
    if (i >= 0) restantes.splice(i, 1);
  }
  return restantes;
}
