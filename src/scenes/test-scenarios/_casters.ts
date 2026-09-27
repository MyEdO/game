/**
 * Fabrique PARTAGÉE de lanceurs (Hautes Sorcières + Prêtres complets + prêtre-guerrier frénétique)
 * pour les scénarios de test de l'IA — source UNIQUE consommée par 06-magie, 27-duel-lanceurs et
 * 28-etats-controle. Pas de duplication : tout caster d'un scénario IA passe par ces helpers.
 *
 * « Complet » = roster DATA-DRIVEN entier de la donnée (toutes les Bénédictions ET Miracles d'un culte,
 * tous les Sorts des Domaines arcaniques) → l'IA refondue joue tout l'arsenal, pas un sous-ensemble.
 */
import { pregenParty, PREGEN } from '../../data/pregens';
import { spells, blessingsOf, miraclesOf, findSkill, findTalent, rigSpeciesId } from '../../data';
import { slugId } from '../../data/slug';
import { acquerirTalent, splitLabel } from '../../engine/careerSlots';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import type { Combatant, CharKey, SkillInstance, ItemInstance } from '../../engine/types';

/** Deep-clone d'un pré-tiré (données pures) pour le bricoler sans toucher la base. */
export const clone = (c: Combatant): Combatant => JSON.parse(JSON.stringify(c)) as Combatant;

/** Monte (ou ajoute) une Compétence à un niveau d'avances donné. */
export function boostSkill(c: Combatant, name: string, spec: string | undefined, characteristic: CharKey, advances: number): void {
  const skillId = findSkill(name)?.id ?? slugId(name);
  const s = c.skills.find((x) => x.id === skillId && (spec == null || x.spec === spec));
  if (s) s.advances = Math.max(s.advances, advances);
  else c.skills.push({ id: skillId, spec, characteristic, advances } as SkillInstance);
}

export const setChars = (c: Combatant, over: Partial<Record<CharKey, number>>): void => {
  for (const [k, v] of Object.entries(over)) c.characteristics[k as CharKey] = v as number;
};

/** Ajoute des Talents (libellés concrets) sans doublon. */
export function addTalents(c: Combatant, names: string[]): void {
  for (const name of names) {
    const { name: base, spec } = splitLabel(name);
    const talentId = findTalent(base)?.id ?? slugId(base);
    if (!c.talents.some((t) => t.talentId === talentId && (t.spec ?? '') === (spec ?? ''))) acquerirTalent(c, { id: talentId, spec });
  }
}

/** IDS des sorts d'une école (+ sous-type optionnel) depuis la base — `c.spells` = ids (console → findSpellById). */
export const spellsOf = (ecole: string, subTypes?: (string | null)[]): string[] =>
  spells.filter((s) => s.ecole === ecole && (!subTypes || subTypes.includes(s.subType ?? null))).map((s) => s.id);

/** Prêtre COMPLET d'un culte : Prière + Béni/Invocation (Culte) + TOUTES ses Bénédictions ET Miracles. */
export function makePriest(base: Combatant, id: string, name: string, cult: string, chars: Partial<Record<CharKey, number>>): Combatant {
  const p = clone(base);
  p.id = id; p.label = name;
  setChars(p, chars);
  p.fate = 3; p.fortune = 3;
  boostSkill(p, 'Prière', undefined, 'sociabilite', 50);
  addTalents(p, [`Béni (${cult})`, `Invocation (${cult})`]);
  p.spells = [...blessingsOf(cult), ...miraclesOf(cult)]; // roster COMPLET du culte (data-driven)
  return p;
}

/** Domaines arcaniques par défaut d'une Haute Sorcière elfe (RAW : un sorcier elfe maîtrise plusieurs Vents). */
export const ARC_DOMAINS = ['Feu', 'Mort', 'Cieux', 'Bête', 'Vie'];

/**
 * Haute Sorcière elfe MULTI-DOMAINE + Nécromancie (invocations) — arsenal arcane COMPLET (Magie mineure,
 * Arcanes communs, ses Domaines, Nécromancie). Self-contained (tire son propre pré-tiré sorcier).
 */
export function makeSorceress(id: string, name: string, pos: { x: number; y: number }, domains: string[] = ARC_DOMAINS): Combatant {
  const sorc = clone(pregenParty(PREGEN.sorcier)[0]);
  sorc.id = id;
  sorc.label = name;
  setChars(sorc, { intelligence: 75, 'force-mentale': 70, agilite: 58, dexterite: 52, initiative: 62, endurance: 45 });
  sorc.wounds = { current: 18, max: 18, base: 18 };
  sorc.fate = 4; sorc.fortune = 4; sorc.resilience = 3; sorc.resolve = 3;
  boostSkill(sorc, 'Langue', 'magick', 'intelligence', 55);
  for (const dom of domains) boostSkill(sorc, 'Focalisation', dom, 'force-mentale', 40);
  addTalents(sorc, ['Magie mineure', ...domains.map((d) => `Magie des Arcanes (${d})`), 'Nécromancie']);
  sorc.spells = [
    ...spellsOf('Magie mineure'),
    ...spellsOf('Magie des Arcanes', [null, ...domains, 'Nécromancie']),
  ];
  sorc.appearance = { species: rigSpeciesId('hauts-elfes'), sex: 'F', build: 0.38 };
  sorc.species = 'Hauts Elfes';
  sorc.pos = { ...pos };
  return sorc;
}

/**
 * Prêtre-guerrier FRÉNÉTIQUE (flagellant) : prêtre complet d'un culte + Frénésie + grande hache à deux
 * mains + Caractéristiques de combat — teste l'arbitrage IA invoquer/enchanter PUIS charger en Frénésie.
 */
export function makeFlagellant(base: Combatant, id: string, name: string, cult: string, chars: Partial<Record<CharKey, number>>, pos: { x: number; y: number }): Combatant {
  const f = makePriest(base, id, name, cult, chars);
  addTalents(f, ['Frénésie']);
  boostSkill(f, 'Corps à corps', "Armes d'hast", 'capacite-de-combat', 45);
  const axe = itemFromTrappingById('hache-d-armes');
  if (axe) {
    f.items = [...(f.items ?? []), axe] as ItemInstance[];
    recomputeLoadout(f);
  }
  f.pos = { ...pos };
  return f;
}
