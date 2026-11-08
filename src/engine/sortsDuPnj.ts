/**
 * LES SORTS D'UN PNJ (#3715) : ceux que l'auteur choisit (`SceneEntity.combat.spells`), puis ce que les Talents de
 * lanceur donnent d'office au nombre que le livre chiffre, tiré sur une graine stable, l'id du porteur : Magie mineure
 * (LDB 10 l.714), Invocation (LDB 10 l.625), Magie du Chaos (LDB 10 l.704-708, listes EDOC 13 l.262). Magie des
 * Arcanes et les Traits Lanceur de Sorts et Miracles (LDB 85 l.207, l.233) n'en chiffrent aucun : arbitrage du
 * 2026-11-08 au ticket #3715. Une liste imprimée au profil fait foi.
 */
import type { Combatant } from './types';
import type { PorteurDeFiche } from './statblock';
import { casterTalents, talentOuvre } from './grimoire';
import { pettySpellQuotaFor } from './creation';
import { hashSeed, makeRNG } from './dice';
import { findCreatureById, findSpellById, findTraitById, refLabel, spells, type SpellData } from '../data';
import type { PlayerText } from '../i18n/playerText';
import { t } from '../i18n';

/** Une liste de sorts qu'ouvre un Talent ou un Trait de lanceur, et le nombre de Sorts qu'il en donne d'office. */
export interface ListeDeSorts {
  /** Le Talent ou le Trait qui l'ouvre, avec sa spécialisation. */
  libelle: PlayerText;
  /** Ce qui distingue son tirage parmi les listes du porteur. */
  cle: string;
  /** Absent : l'auteur en choisit autant qu'il veut, rien n'est tiré. */
  quota?: number;
  admet: (sp: SpellData) => boolean;
}

/** Les sorts que le profil du porteur `p` imprime. */
export function sortsImprimes(p: PorteurDeFiche | undefined): readonly string[] {
  if (!p) return [];
  return p.statblock?.spells ?? p.presetCreature?.spells ?? (p.ref === undefined ? undefined : findCreatureById(p.ref)?.spells) ?? [];
}

/** Le quota d'un Talent de lanceur de `c` : le Bonus de Force Mentale pour Magie mineure, un Miracle pour Invocation,
 *  un Sort par prise de Magie du Chaos. */
function quotaDuTalent(c: Combatant, kind: string, niveau: number): number | undefined {
  if (kind === 'mineure') return pettySpellQuotaFor(c);
  if (kind === 'invocation') return 1;
  if (kind === 'chaos') return niveau;
  return undefined;
}

/** Les listes de sorts que les Talents de lanceur (`casterTalents`) et les Traits Lanceur de Sorts (`spellcaster`) ou
 *  d'une famille d'incantation (`castingKind`, l'`arg` en spécialisation) ouvrent à `c`. Un quota exclut les Rituels. */
export function listesDeSorts(c: Combatant): ListeDeSorts[] {
  const parTalent = casterTalents(c).map((ct): ListeDeSorts => {
    const quota = quotaDuTalent(c, ct.kind, ct.niveau);
    return {
      libelle: refLabel('talents', { id: ct.talentId, spec: ct.spec }),
      cle: `${ct.talentId}:${ct.spec ?? ''}`,
      ...(quota === undefined ? {} : { quota }),
      admet: (sp) => talentOuvre(ct, sp) && (quota === undefined || !sp.ritual),
    };
  });
  const parTrait = (c.traits ?? []).flatMap((tr): ListeDeSorts[] => {
    const cap = findTraitById(tr.id)?.capabilities;
    const kind = cap?.castingKind;
    const admet = cap?.spellcaster ? (sp: SpellData) => sp.family === 'mineure' || sp.family === 'arcane' || sp.family === 'chaos'
      : kind ? (sp: SpellData) => talentOuvre({ kind, spec: tr.arg }, sp)
      : undefined;
    return admet ? [{ libelle: refLabel('traits', { id: tr.id, spec: tr.arg }), cle: `${tr.id}:${tr.arg ?? ''}`, admet }] : [];
  });
  return [...parTalent, ...parTrait];
}

/** Les choix `choisis` répartis sur les listes `listes` : chacun sur une liste sans quota qui l'admet, sinon sur la
 *  première qui l'admet sous son quota. `pris`, le nombre de choix par liste ; `admis`, les choix placés ; `refus`, la
 *  raison du premier choix qu'aucune ne prend. */
function repartir(listes: readonly ListeDeSorts[], choisis: readonly string[]): { pris: number[]; admis: string[]; refus?: PlayerText } {
  const pris = listes.map(() => 0);
  const admis: string[] = [];
  let refus: PlayerText | undefined;
  for (const id of choisis) {
    const sp = findSpellById(id);
    const ouvertes = sp ? listes.flatMap((l, i) => (l.admet(sp) ? [i] : [])) : [];
    const i = ouvertes.find((k) => listes[k].quota === undefined) ?? ouvertes.find((k) => pris[k] < listes[k].quota!);
    if (i !== undefined) {
      pris[i]++;
      admis.push(id);
      continue;
    }
    const sort = sp?.label ?? id;
    refus ??= ouvertes.length
      ? t('sortsDuPnj.refus.quota', { sort, liste: listes[ouvertes[0]].libelle, n: listes[ouvertes[0]].quota! })
      : t('sortsDuPnj.refus.horsListes', { sort });
  }
  return { pris, admis, refus };
}

/** Le refus des sorts `choisis` par l'auteur pour `c`, `undefined` s'il les admet : un profil qui imprime ses sorts,
 *  un sort d'aucune liste que `c` ouvre (`listesDeSorts`), un sort au-delà du quota de chaque liste qui l'admet. Un id
 *  absent du catalogue n'est pas le sien : le schéma de la scène le refuse déjà (`refs('spell')`). */
export function refusDesSortsChoisis(c: Combatant, choisis: readonly string[]): PlayerText | undefined {
  const connus = choisis.filter((id) => findSpellById(id));
  if (!connus.length) return undefined;
  if (sortsImprimes(c.porteurDeFiche).length) return t('sortsDuPnj.refus.imprimes');
  return repartir(listesDeSorts(c), connus).refus;
}

/** Les sorts du PNJ `c` : ceux qu'imprime son profil (`sortsImprimes`), tels quels ; sinon ses sorts déjà connus
 *  (Bénédictions de Béni, `applyTalentAcquisition`), puis les choix admis de `choisis` (`refusDesSortsChoisis`), puis,
 *  pour chaque liste à quota, ce que les choix y laissent, tiré parmi les sorts qu'elle admet et qu'il ne connaît pas,
 *  sur la graine de l'id de `c`. */
export function sortsDuPnj(c: Combatant, choisis: readonly string[]): string[] {
  const connus = [...(c.spells ?? [])];
  if (sortsImprimes(c.porteurDeFiche).length) return connus;
  const listes = listesDeSorts(c);
  const { pris, admis } = repartir(listes, choisis);
  for (const id of admis) if (!connus.includes(id)) connus.push(id);
  listes.forEach((l, i) => {
    const rng = makeRNG(hashSeed(`sorts:${c.id}:${l.cle}`));
    const offerts = spells.filter((sp) => l.admet(sp) && !connus.includes(sp.id)).map((sp) => sp.id);
    for (let n = (l.quota ?? 0) - pris[i]; n > 0 && offerts.length; n--) connus.push(...offerts.splice(rng.int(0, offerts.length - 1), 1));
  });
  return connus;
}
