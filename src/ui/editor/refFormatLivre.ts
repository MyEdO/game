/**
 * PORTE UNIQUE du FORMAT LIVRE d'une référence de statbloc — « Compétence (Spéc) Valeur »,
 * « Talent (Spéc) Niveau » : le RENDU vit dans `src/data` (`skillRefLabel`/`talentRefLabel`), le PARSE
 * INVERSE vit ici. Round-trip verrouillé par `statblock-skillref-roundtrip.test.ts`.
 *
 * Deux consommateurs : l'éditeur de statbloc de scène (`StatblockEditor`) et l'atelier du Codex
 * (`CodexEdit`, fiche créature). `spec` rend un `id` dès qu'elle en RÉSOUT un — d'abord au catalogue
 * de l'entrée, sinon au registre partagé (`specIdOf`) ; sur un domaine à spécialisations OUVERTES,
 * le verbatim saisi est conservé en dernier ressort (« Savoir (Zorglub) » persiste « Zorglub »),
 * faute d'id à désigner. Doctrine « toute LOGIQUE est keyée par id STABLE » (CLAUDE.md).
 */
import { byId, findSkill, findTalent, findTalentById, specCatalogOf, specLabel, specResolves, type SkillRef, type TalentRef } from '../../data';
import { slugId } from '../../data/slug';
import { parseStatEntry } from '../../engine/statEntry';
import { t } from '../../i18n';

/** Saisie « (Au choix) » : un EMPLACEMENT, jamais une spécialisation (#1548). Le mot lu est celui que
 *  l'affichage compose (`ref.motAuChoix`, `choixLabel`). */
function saisieAuChoix(arg: string): boolean {
  return arg.toLowerCase().replace(/^(un |une |deux )/, '') === t('ref.motAuChoix').toLowerCase();
}

/** Branches d'une saisie « A ou B », coupées sur le liant que l'affichage compose (`ref.ou`,
 *  `ouListe`) ; une seule branche sans liant. */
function branchesOu(arg: string): string[] {
  const liant = t('ref.ou').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return arg.split(new RegExp(`\\s+${liant}\\s+`, 'i')).map((x) => x.trim());
}

/**
 * Libellé FR d'une spécialisation → son `id`. Deux étages, car ce qui est ÉNUMÉRABLE (`specCatalogOf`)
 * est un SOUS-ENSEMBLE de ce qui est VALIDE (`specResolves`) quand la def désigne une `specsSource` :
 * (1) l'entrée du catalogue dont le libellé est ce texte ; (2) sinon le slug du texte, s'il RÉSOUT au
 * registre partagé — un statbloc RAW porte des spécs réelles hors du pool joueur (Focalisation
 * « Magie des mers de Triton »). Verbatim en dernier ressort : domaine OUVERT, spéc libre saisie par
 * l'auteur (`LDB 09 l.40`).
 */
function specIdOf(ds: 'skills' | 'talents', refId: string, label: string): string {
  const def = ds === 'skills' ? byId('skill', refId) : findTalentById(refId);
  if (!def) return label;
  const auCatalogue = specCatalogOf(def).find((id) => specLabel(ds, refId, id) === label);
  if (auCatalogue) return auCatalogue;
  const candidat = slugId(label);
  return specResolves(def, candidat) ? candidat : label;
}

/** Parse une saisie « Compétence (Spéc) Valeur » → `SkillRef` (forme unique `{id, spec?|choix?, value}`).
 *  « (Au choix) » rend `choix: true`, « (A ou B) » rend `choix: [ids]` — jamais le littéral en `spec` ;
 *  une spéc concrète revient à son `id` (le round-trip d'édition passe par le libellé d'affichage). */
export function parseSkillRef(text: string): SkillRef {
  const p = parseStatEntry(text);
  const id = findSkill(p.name)?.id ?? slugId(p.name);
  const value = p.indice ?? 0;
  const arg = p.arg?.trim();
  if (!arg) return { id, value };
  if (saisieAuChoix(arg)) return { id, choix: true, value };
  const branches = branchesOu(arg);
  if (branches.length > 1) return { id, choix: branches.map((x) => specIdOf('skills', id, x)), value };
  return { id, spec: specIdOf('skills', id, arg), value };
}

/** Parse une saisie « Talent (Spéc) Niveau » → `TalentRef` (id stable + spec en id + `times` ≥2).
 *  Inverse EXACT de `talentRefLabel` : le niveau (« Maîtrise du combat 3 ») et la spécialisation
 *  survivent à l'aller-retour d'édition — un niveau absent vaut 1 (jamais écrit). */
export function parseTalentRef(text: string): TalentRef {
  const p = parseStatEntry(text);
  const id = findTalent(p.name)?.id ?? slugId(p.name);
  const arg = p.arg?.trim();
  return {
    id,
    ...(arg ? { spec: specIdOf('talents', id, arg) } : {}),
    ...(p.indice != null && p.indice > 1 ? { times: p.indice } : {}),
  };
}
