/**
 * CÂBLAGE de l'ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`) — de la donnée committée jusqu'à la fiche.
 *
 * Un Rituel EST un Sort (`VDM 02 l.363`) : il vit dans `spells.json` et se résout comme un Sort
 * (`l.379`). Ce qu'il imprime EN PLUS, ce sont les rubriques de `SpellData.ritual`. Un champ n'est
 * admis au schéma qu'avec un CONSOMMATEUR : la fiche Codex des Sorts (`ui/compendium/registry.ts`)
 * pour les rubriques de prose, `eligibleTalent` (`engine/grimoire.ts`) pour la LISTE de Domaines de
 * la rubrique **Type** (`l.381`). Ce test part de la donnée réelle et assène le résultat sur ces
 * consommateurs : débrancher `ritualSection`, le fait `NI`/`PX` ou `arcaneDomainsOf` le rend rouge.
 */
import { describe, it, expect } from 'vitest';
import { spells, domains } from './index';
import { schema as spellsSchema } from './schemas/defs/spells';
import { CODEX } from '../ui/compendium/registry';
import type { CodexItem } from '../ui/compendium/registry';
import { arcaneDomainsOf, eligibleTalent, learnableSpells, spellCost } from '../engine/grimoire';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const RITUELS = spells.filter((s) => s.isRitual);
const items = new Map<string, CodexItem>(CODEX.find((c) => c.key === 'spells')!.items.map((i) => [i.id, i]));
const textOf = (item: CodexItem): string =>
  (item.sections ?? []).filter((s) => s.title === 'Rituel').flatMap((s) => s.rows).map((r) => (r.t === 'text' ? r.text : '')).join('\n');
const factOf = (item: CodexItem, label: string): string | undefined => (item.meta ?? []).find((f) => f.label === label)?.value;

/** Lanceur témoin : un Talent Magie des Arcanes sur `domainId`, plus les Talents supplémentaires
 *  fournis (Magie du Chaos pour la clause `chaosMagic` d'une valeur réduite). */
const sorcierDe = (domainId: string, plus: { talentId: string; spec?: string; times?: number }[] = []): Combatant =>
  (blessuresSurLeProfil({
    id: 'w', label: 'Sorcier', kind: 'hero', size: 'moyenne', advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 },
    conditions: [], traits: [], groups: [], weapons: [], movement: 4, wounds: blessuresDeBase(12),
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'langue', spec: 'magick', advances: 30 }],
    talents: [{ talentId: 'magie-des-arcanes', spec: domainId, times: 1 }, ...plus],
    spells: [],
  })) as unknown as Combatant;
const rituel = (id: string) => spells.find((s) => s.id === id)!;

describe('donnée — les Rituels de VDM portent leur anatomie', () => {
  it('les 17 Rituels curés valident le schéma et portent les rubriques imprimées', () => {
    expect(RITUELS.length).toBe(17);
    expect(spellsSchema.safeParse(spells).success).toBe(true);
    for (const r of RITUELS) {
      expect(r.ritual, r.id).toBeTruthy();
      expect(r.ritual!.type.length, r.id).toBeGreaterThan(0);
      expect(r.ritual!.xp, r.id).toBeGreaterThan(0);
      for (const k of ['components', 'conditions', 'sacrifices', 'consequences'] as const) {
        expect(r.ritual![k].length, `${r.id}.${k}`).toBeGreaterThan(0);
      }
      // Rubrique NI (`l.379`) : un nombre, ou son texte imprimé quand elle porte une formule sur la cible.
      expect(r.cn != null || !!r.ritual!.cnFrom, r.id).toBe(true);
    }
  });

  it('`ritual` est STRICT : une rubrique inventée est refusée', () => {
    const base = JSON.parse(JSON.stringify(spells.find((s) => s.id === 'art-de-la-malediction')));
    expect(spellsSchema.safeParse([base]).success).toBe(true);
    const inconnue = { ...base, ritual: { ...base.ritual, sacrificeOps: [] } };
    expect(spellsSchema.safeParse([inconnue]).success).toBe(false);
  });
});

describe('fiche Codex — chaque rubrique admise atteint le lecteur', () => {
  it('les quatre rubriques de prose sont rendues VERBATIM, pour les 17', () => {
    for (const r of RITUELS) {
      const item = items.get(r.id)!;
      expect(item, r.id).toBeTruthy();
      const md = textOf(item);
      for (const k of ['type', 'components', 'conditions', 'sacrifices', 'consequences'] as const) {
        expect(md, `${r.id}.${k}`).toContain(r.ritual![k]);
      }
    }
  });

  it('les PX d’apprentissage sont un fait d’en-tête, pour les 17', () => {
    for (const r of RITUELS) {
      const attendu = r.ritual!.reduced ? `${r.ritual!.xp} (${r.ritual!.reduced.xp})` : String(r.ritual!.xp);
      expect(factOf(items.get(r.id)!, 'PX d’apprentissage'), r.id).toBe(attendu);
    }
  });

  it('NI : le nombre imprimé, ou le texte de la rubrique quand elle vise la cible', () => {
    // `VDM 02 l.398` : « **NI :** 50 (25) » — la parenthèse de difficulté réduite est imprimée.
    expect(factOf(items.get('art-de-la-malediction')!, 'NI')).toBe('50 (25)');
    expect(factOf(items.get('art-de-la-malediction')!, 'PX d’apprentissage')).toBe('200 (100)');
    const variable = RITUELS.filter((r) => r.cn == null);
    expect(variable.map((r) => r.id)).toEqual(['les-faux-croisees', 'invocation-de-demon', 'lier-une-bete-monstrueuse']);
    for (const r of variable) expect(factOf(items.get(r.id)!, 'NI'), r.id).toBe(r.ritual!.cnFrom);
  });
});

describe('NI — la nature Rituel mord sur les modificateurs de la donnée committée', () => {
  it('aucun Rituel curé n’est routé en Test de Prière (la `family` seule en décide)', async () => {
    const { castInfo } = await import('../engine/magic');
    for (const r of RITUELS) expect(castInfo(r).skill, r.id).toBe('langue');
  });

  it('le grimoire quadruple le NI d’un Rituel là où il double celui d’un Sort', async () => {
    const { castingNumberOf } = await import('../engine/magic');
    const { GRIMOIRE_NI_MODS } = await import('../noyau/combatFlow');
    const r = spells.find((s) => s.id === 'creer-une-pierre-de-pouvoir')!;
    expect(castingNumberOf(r, false, {}, GRIMOIRE_NI_MODS)).toBe(r.cn! * 4);
    expect(castingNumberOf({ ...r, isRitual: false }, false, {}, GRIMOIRE_NI_MODS)).toBe(r.cn! * 2);
  });
});

/**
 * Rubrique **Type** (`VDM 02 l.381`) : « Un lanceur de sorts qui ne pratique pas l'un des Domaines
 * listés ne peut pas y prendre part. » La restriction est une LISTE — un Rituel ouvert à cinq
 * Domaines reste interdit au sixième.
 */
describe('Type — la LISTE de Domaines admis gouverne qui peut y prendre part', () => {
  it('les Huit Vents sont DÉRIVÉS de `domains.json`, jamais recopiés à la main', () => {
    const vents = domains.filter((d) => d.wind && d.id !== 'dhar').map((d) => d.id).sort();
    expect(vents.length).toBe(8);
    for (const id of ['creer-une-pierre-de-pouvoir', 'impregner-un-baton', 'lier-un-esprit-a-une-pierre-de-pouvoir']) {
      expect([...rituel(id).ritual!.domains!].sort(), id).toEqual(vents);
    }
  });

  it('« plusieurs Domaines » n’est JAMAIS représenté par « aucun »', () => {
    // 6 ouverts (liste vide) · 6 mono · 1 aux deux Domaines sombres · 1 à cinq · 3 aux Huit Vents.
    const taille = (n: number) => RITUELS.filter((r) => r.ritual!.domains.length === n).length;
    expect({ ouvert: taille(0), mono: taille(1), deux: taille(2), cinq: taille(5), huit: taille(8) })
      .toEqual({ ouvert: 6, mono: 6, deux: 1, cinq: 1, huit: 3 });
    // Aucun Rituel ne se dispense de dire ses Domaines : la rubrique est TOUJOURS exécutable.
    expect(RITUELS.filter((r) => r.ritual!.domains == null).map((r) => r.id)).toEqual([]);
    expect(arcaneDomainsOf(rituel('materialiser-le-marais-vivant'))).toEqual(['mort', 'vie', 'ombres', 'magie-naturelle', 'sorcellerie']);
    expect(arcaneDomainsOf(rituel('lever-une-malediction'))).toBeNull(); // « N'importe quel Domaine »
  });

  it('le Talent d’un Domaine HORS liste ne rend pas le Rituel apprenable', () => {
    const marais = rituel('materialiser-le-marais-vivant');
    expect(eligibleTalent(sorcierDe('mort'), marais)).toBeTruthy();
    expect(eligibleTalent(sorcierDe('sorcellerie'), marais)).toBeTruthy();
    expect(eligibleTalent(sorcierDe('feu'), marais)).toBeFalsy();
    const pierre = rituel('creer-une-pierre-de-pouvoir'); // Huit Vents
    expect(eligibleTalent(sorcierDe('feu'), pierre)).toBeTruthy();
    expect(eligibleTalent(sorcierDe('necromancie'), pierre)).toBeFalsy();
    const ouvert = rituel('lever-une-malediction');
    expect(eligibleTalent(sorcierDe('necromancie'), ouvert)).toBeTruthy();
  });

  /**
   * « N'importe quel Domaine sombre » (`VDM 02 l.414`) : la catégorie est celle du chapitre de
   * Magie noire du Livre de base (`LDB 50`, cf. `LDB 47 l.309`) — Démonologie et Nécromancie.
   */
  it('« N’importe quel Domaine sombre » se résout aux deux Domaines du chapitre de Magie noire', () => {
    const pierre = rituel('corrompre-une-pierre-gardienne');
    expect(arcaneDomainsOf(pierre)).toEqual(['demonologie', 'necromancie']);
    expect(eligibleTalent(sorcierDe('necromancie'), pierre)).toBeTruthy();
    expect(eligibleTalent(sorcierDe('demonologie'), pierre)).toBeTruthy();
    expect(eligibleTalent(sorcierDe('vie'), pierre)).toBeFalsy(); // un sorcier de Ghyran
    expect(eligibleTalent(sorcierDe('sorcellerie'), pierre)).toBeFalsy();
    expect(learnableSpells(sorcierDe('vie')).map((x) => x.spell.id)).not.toContain(pierre.id);
    expect(learnableSpells(sorcierDe('necromancie')).map((x) => x.spell.id)).toContain(pierre.id);
  });

  it('un Sort ordinaire garde son unique Domaine (non-régression)', () => {
    const caresse = spells.find((s) => s.id === 'caresse-de-laniph')!; // Domaine de la Mort
    expect(arcaneDomainsOf(caresse)).toEqual(['mort']);
    expect(eligibleTalent(sorcierDe('mort'), caresse)).toBeTruthy();
    expect(eligibleTalent(sorcierDe('feu'), caresse)).toBeFalsy();
  });
});

/**
 * Rubrique **PX d'apprentissage** (`VDM 02 l.383`) : « Un lanceur de sorts peut acquérir un Rituel
 * en dépensant le nombre de PX indiqués. » Le nombre EST celui de la rubrique — pas les bandes de
 * Bonus d'Intelligence des Sorts de Domaine (LDB 10 l.680-686).
 */
describe('PX d’apprentissage — le nombre imprimé gouverne le coût réel', () => {
  it('chaque Rituel apprenable coûte SES PX, jamais la bande d’Arcane', () => {
    const feu = sorcierDe('feu');
    const paye = new Map(learnableSpells(feu).map((x) => [x.spell.id, x.cost]));
    const rituelsOfferts = RITUELS.filter((r) => paye.has(r.id));
    expect(rituelsOfferts.length).toBeGreaterThan(0);
    for (const r of rituelsOfferts) expect(paye.get(r.id), r.id).toBe(r.ritual!.xp);
    // La sonde de réfutation : ces quatre-là valaient 100 PX quand `ritual.xp` n’était qu’un affichage.
    expect(spellCost(feu, rituel('art-de-la-malediction'))).toBe(200);
    expect(spellCost(sorcierDe('necromancie'), rituel('corrompre-une-pierre-gardienne'))).toBe(450);
    expect(spellCost(feu, rituel('invocation-de-jack-des-cendres'))).toBe(500);
    expect(spellCost(feu, rituel('lier-un-esprit-a-une-pierre-de-pouvoir'))).toBe(600);
  });

  it('les Sorts ordinaires gardent leurs bandes (non-régression)', () => {
    const feu = sorcierDe('feu'); // Bonus d’Intelligence 4, aucun Sort connu
    const caresse = spells.find((s) => s.id === 'caresse-de-laniph')!;
    expect(spellCost(sorcierDe('mort'), caresse)).toBe(100);
    const ordinaires = learnableSpells(feu).filter((x) => !x.spell.isRitual);
    expect(ordinaires.length).toBeGreaterThan(0);
    for (const x of ordinaires) expect(x.cost, x.spell.id).toBe(100);
  });

  /**
   * `VDM 02 l.398`/`l.400` : « **NI :** 50 (25) », « **PX d'apprentissage :** 200 (100) », la
   * rubrique **Type** désignant « les lanceurs de sorts qui pratiquent l'un des Domaines suivants :
   * Sorcellerie, Démonologie, Nécromancie ou Chaos ». La clause vise le LANCEUR.
   */
  it('la valeur réduite ne s’ouvre qu’aux Domaines que la rubrique Type désigne', async () => {
    const { castingNumberOf } = await import('../engine/magic');
    const malediction = rituel('art-de-la-malediction');
    for (const d of ['sorcellerie', 'demonologie', 'necromancie']) {
      expect(spellCost(sorcierDe(d), malediction), d).toBe(100);
      expect(castingNumberOf(malediction, false, {}, [], sorcierDe(d)), d).toBe(25);
    }
    const chaotique = sorcierDe('feu', [{ talentId: 'magie-du-chaos', spec: 'tzeentch', times: 1 }]);
    expect(spellCost(chaotique, malediction)).toBe(100);
    expect(castingNumberOf(malediction, false, {}, [], chaotique)).toBe(25);
    // Hors clause : la valeur pleine, et un lanceur non fourni laisse le NI imprimé intact.
    expect(spellCost(sorcierDe('vie'), malediction)).toBe(200);
    expect(castingNumberOf(malediction, false, {}, [], sorcierDe('vie'))).toBe(50);
    expect(castingNumberOf(malediction)).toBe(50);
    // Un Rituel sans parenthèse ne bouge pas, quel que soit le lanceur.
    const marais = rituel('materialiser-le-marais-vivant');
    expect(castingNumberOf(marais, false, {}, [], sorcierDe('sorcellerie'))).toBe(marais.cn);
    expect(spellCost(sorcierDe('sorcellerie'), marais)).toBe(400);
  });
});
