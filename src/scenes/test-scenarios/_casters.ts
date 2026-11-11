/**
 * Fabrique PARTAGÉE de lanceurs (Hautes Sorcières + Prêtres complets + prêtre-guerrier frénétique)
 * pour les scénarios de test de l'IA — source UNIQUE consommée par 06-magie, 27-duel-lanceurs et
 * 28-etats-controle. Pas de duplication : tout caster d'un scénario IA passe par ces helpers.
 *
 * « Complet » = roster DATA-DRIVEN entier de la donnée (toutes les Bénédictions ET Miracles d'un culte,
 * tous les Sorts des Domaines arcaniques) → l'IA refondue joue tout l'arsenal, pas un sous-ensemble.
 */
import type { FabriqueDId } from '../../engine/fabriqueDId';
import { herosDeScenario } from './_heros';
import { spells, blessingsOf, miraclesOf, byId, findTalentById, specCatalogOf, especeDApparence } from '../../data';
import { refCouvre, memeSpecialisation, type RefDesignee } from '../../data/schemas/grammaire/ref';
import { acquerirTalent } from '../../engine/careerSlots';
import { contexteDeNaissanceDObjet, itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import type { Combatant, CharKey, SkillInstance, ItemInstance } from '../../engine/types';
import { blessuresPosees } from '../../engine/characteristics';

/** La référence `ref` à une entrée de `def` (`quoi` la nomme), vérifiée : l'id désigne une entrée, la spécialisation
 *  une de son registre. Un scénario s'écrit en ids : une faute de frappe lève au lieu d'inventer une entrée. */
function verifiee(quoi: string, def: Parameters<typeof specCatalogOf>[0] | undefined, ref: RefDesignee): RefDesignee {
  if (!def) throw new Error(`${quoi} : « ${ref.id} » n'est l'id d'aucune entrée`);
  const registre = specCatalogOf(def);
  if (ref.spec !== undefined && registre.length && !registre.includes(ref.spec)) throw new Error(`${quoi} : « ${ref.spec} » n'est aucune spécialisation de « ${ref.id} » (${registre.join(', ')})`);
  return ref;
}

/** Monte (ou ajoute) la Compétence `ref` (ids) à un niveau d'avances donné. */
export function boostSkill(c: Combatant, ref: RefDesignee, characteristic: CharKey, advances: number): void {
  const { id: skillId, spec } = verifiee('boostSkill', byId('skill', ref.id), ref);
  const s = c.skills.find((x) => refCouvre({ id: skillId, spec }, x));
  if (s) s.advances = Math.max(s.advances, advances);
  else c.skills.push({ id: skillId, spec, characteristic, advances } as SkillInstance);
}

export const setChars = (c: Combatant, over: Partial<Record<CharKey, number>>): void => {
  for (const [k, v] of Object.entries(over)) c.characteristics[k as CharKey] = v as number;
};

/** Ajoute les Talents `refs` (ids) sans doublon. */
export function addTalents(c: Combatant, refs: RefDesignee[]): void {
  for (const ref of refs) {
    const { id, spec } = verifiee('addTalents', findTalentById(ref.id), ref);
    if (!c.talents.some((t) => t.talentId === id && memeSpecialisation(t.spec, spec))) acquerirTalent(c, { id, spec });
  }
}

/** IDS des sorts d'une famille (`family`), et, pour l'Arcane, de ses Domaines (`domainId`, `null` : les sorts sans
 *  Domaine) — `c.spells` = ids (console → findSpellById). */
export const spellsOf = (family: string, domaines?: (string | null)[]): string[] =>
  spells.filter((s) => s.family === family && (!domaines || domaines.includes(s.domainId?.id ?? null))).map((s) => s.id);

/** Prêtre COMPLET d'un culte, bâti sur un pré-tiré prêtre neuf (ses objets aux ids de `idNeuf`) : Prière +
 *  Béni/Invocation (Culte) + TOUTES ses Bénédictions ET Miracles. */
export function makePriest(idNeuf: FabriqueDId, id: string, name: string, cult: string, chars: Partial<Record<CharKey, number>>): Combatant {
  const p = herosDeScenario(idNeuf, 'pretre');
  p.id = id; p.label = name;
  setChars(p, chars);
  p.fate = 3; p.fortune = 3;
  boostSkill(p, { id: 'priere' }, 'sociabilite', 50);
  addTalents(p, [{ id: 'beni', spec: cult }, { id: 'invocation', spec: cult }]);
  p.spells = [...blessingsOf(cult), ...miraclesOf(cult)]; // roster COMPLET du culte (data-driven)
  return p;
}

/** Domaines arcaniques par défaut d'une Haute Sorcière elfe (RAW : un sorcier elfe maîtrise plusieurs Vents), en ids
 *  de `domains.json`. */
export const ARC_DOMAINS = ['feu', 'mort', 'cieux', 'bete', 'vie'];

/**
 * Haute Sorcière elfe MULTI-DOMAINE + Nécromancie (invocations) — arsenal arcane COMPLET (Magie mineure,
 * Arcanes communs, ses Domaines et la Nécromancie, chacun son talent Magie des Arcanes). Self-contained (tire son
 * propre pré-tiré sorcier).
 */
export function makeSorceress(idNeuf: FabriqueDId, id: string, name: string, pos: { x: number; y: number }, domains: string[] = ARC_DOMAINS): Combatant {
  const sorc = herosDeScenario(idNeuf, 'sorcier');
  sorc.id = id;
  sorc.label = name;
  setChars(sorc, { intelligence: 75, 'force-mentale': 70, agilite: 58, dexterite: 52, initiative: 62, endurance: 45 });
  sorc.wounds = blessuresPosees(sorc);
  sorc.fate = 4; sorc.fortune = 4; sorc.resilience = 3; sorc.resolve = 3;
  boostSkill(sorc, { id: 'langue', spec: 'magick' }, 'intelligence', 55);
  for (const dom of domains) boostSkill(sorc, { id: 'focalisation', spec: dom }, 'force-mentale', 40);
  addTalents(sorc, [{ id: 'magie-mineure' }, ...[...domains, 'necromancie'].map((spec) => ({ id: 'magie-des-arcanes', spec }))]);
  sorc.spells = [
    ...spellsOf('mineure'),
    ...spellsOf('arcane', [null, ...domains, 'necromancie']),
  ];
  sorc.appearance = { species: especeDApparence('hauts-elfes'), sex: 'F' };
  sorc.species = 'hauts-elfes';
  sorc.pos = { ...pos };
  return sorc;
}

/**
 * Prêtre-guerrier FRÉNÉTIQUE (flagellant) : prêtre complet d'un culte + Frénésie + grande hache à deux
 * mains + Caractéristiques de combat — teste l'arbitrage IA invoquer/enchanter PUIS charger en Frénésie.
 */
export function makeFlagellant(idNeuf: FabriqueDId, id: string, name: string, cult: string, chars: Partial<Record<CharKey, number>>, pos: { x: number; y: number }): Combatant {
  const f = makePriest(idNeuf, id, name, cult, chars);
  addTalents(f, [{ id: 'frenesie' }]);
  boostSkill(f, { id: 'corps-a-corps', spec: 'armes-d-hast' }, 'capacite-de-combat', 45);
  const axe = itemFromTrappingById('hache-d-armes', idNeuf, undefined, contexteDeNaissanceDObjet(f));
  if (axe) {
    f.items = [...(f.items ?? []), axe] as ItemInstance[];
    recomputeLoadout(f);
  }
  f.pos = { ...pos };
  return f;
}
