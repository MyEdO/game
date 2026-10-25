import { describe, it, expect } from 'vitest';
import { creatures, findCareerById, findClassById, findGodById, findTalentById, findTraitById } from '../data';
import { groupsFor } from './groups';
import { norm } from '../lib/normalize';

/**
 * Garde ANTI-RÉGRESSION du portage #1357 : la dérivation des Groupes par MOT-CLÉ DE DOSSIER
 * (`FOLDER_RULES`) et par TABLE DE TRAIT (`TRAIT_RULES`) est morte — les Groupes sont désormais
 * DÉCLARÉS en donnée (`CreatureData.grantGroups`, `TraitData.capabilities.grantGroups`).
 *
 * Les deux tables sont GELÉES ci-dessous en fixture (recopiées de l'état d'avant le portage) et
 * rejouées sur tout le bestiaire : les Groupes qu'elles produisaient doivent être
 * EXACTEMENT ceux que la donnée déclare aujourd'hui — mêmes ids, MÊME ORDRE. Une entrée ajoutée à un
 * dossier « historique » sans porter son `grantGroups`, ou un `grantGroups` amputé par un
 * renommage, rougit ici en nommant la créature.
 *
 * Ce n'est PAS un contrat pour l'avenir (un nouveau dossier n'a aucune obligation de mot-clé) : c'est
 * la preuve, rejouable, que la migration n'a rien perdu.
 */

/** GELÉ — `FOLDER_RULES` d'avant #1357 (ordonnées, la plus spécifique d'abord). */
const FOLDER_RULES_GELEES: { kw: string; group: string }[] = [
  { kw: 'peaux-vertes', group: 'peau-verte' },
  { kw: 'morts sans repos', group: 'mort-vivant' },
  { kw: 'hommes-betes', group: 'homme-bete' },
  { kw: 'hommes-rats', group: 'skaven' },
  { kw: 'demon', group: 'demon' },
  { kw: 'cultistes', group: 'cultiste' },
  { kw: 'betes', group: 'bete' },
];

/** GELÉ — `TRAIT_RULES` d'avant #1357. */
const TRAIT_RULES_GELEES: { traitId: string; group: string }[] = [
  { traitId: 'mort-vivant', group: 'mort-vivant' },
  { traitId: 'demoniaque', group: 'demon' },
];

const groupeDuDossier = (folder?: string | null): string | null => {
  if (!folder) return null;
  const n = norm(folder);
  return FOLDER_RULES_GELEES.find((r) => n.includes(r.kw))?.group ?? null;
};

/** Copie VERBATIM de `groupsFor` d'AVANT #1357 (tables vivantes, `folder` en entrée). */
function groupsForAvant(src: {
  folder?: string | null;
  traits?: { id: string }[];
  talents?: { talentId: string; spec?: string }[];
  extras?: string[];
}): string[] {
  const out: string[] = [];
  const push = (g?: string | null) => {
    if (g && !out.includes(g)) out.push(g);
  };
  const pushAll = (gs?: string[]) => {
    for (const g of gs ?? []) push(g);
  };
  if (src.folder) push(groupeDuDossier(src.folder));
  for (const t of src.traits ?? []) {
    const rule = TRAIT_RULES_GELEES.find((r) => r.traitId === t.id);
    if (rule) push(rule.group);
    // AVANT le portage, `mort-vivant`/`demoniaque` ne portaient PAS de `capabilities.grantGroups` :
    // on rejoue la lecture telle qu'elle était en neutralisant les deux entrées migrées.
    if (!rule) pushAll(findTraitById(t.id)?.capabilities?.grantGroups);
  }
  for (const t of src.talents ?? []) {
    if (!t.spec || !findTalentById(t.talentId)?.grantSpecGroups) continue;
    pushAll(findGodById(norm(t.spec))?.grantGroups);
  }
  (src.extras ?? []).forEach(push);
  return out;
}

describe('#1357 — portage des Groupes vers la donnée : parité avec les tables mortes', () => {
  it('les 490 entrées du bestiaire rendent les MÊMES Groupes, dans le MÊME ordre', () => {
    const ecarts: string[] = [];
    for (const c of creatures) {
      const talents = c.talents.map((t) => ({ talentId: t.id, spec: t.spec }));
      // `grantGroups` d'AVANT la migration = ceux d'aujourd'hui moins la catégorie que le dossier dérivait.
      const categorie = groupeDuDossier(c.folder);
      const extrasAvant = (c.grantGroups ?? []).filter((g) => g !== categorie);
      const avant = groupsForAvant({ folder: c.folder, extras: extrasAvant, traits: c.traits, talents });
      const apres = groupsFor({ extras: c.grantGroups, traits: c.traits, talents });
      if (avant.join(',') !== apres.join(',')) {
        ecarts.push(`${c.id} [${c.folder}] : tables [${avant}] ≠ donnée [${apres}]`);
      }
    }
    expect(ecarts, `Groupes perdus/ajoutés par le portage :\n${ecarts.join('\n')}`).toEqual([]);
    expect(creatures.length).toBeGreaterThan(0); // le corpus mesuré n'est pas vide
  });

  it('la mesure MORD : les dossiers historiques et les porteurs de Trait sont bien dans le corpus mesuré', () => {
    const dossiers = new Set<string>();
    let porteursDeTrait = 0;
    for (const c of creatures) {
      if (groupeDuDossier(c.folder)) dossiers.add(c.folder!);
      if ((c.traits ?? []).some((t) => TRAIT_RULES_GELEES.some((r) => r.traitId === t.id))) porteursDeTrait += 1;
    }
    expect(dossiers.size).toBeGreaterThanOrEqual(10);
    expect(porteursDeTrait).toBeGreaterThanOrEqual(22);
  });

  it('les deux Traits migrés déclarent leur Groupe en donnée (le canal de remplacement EXISTE)', () => {
    expect(findTraitById('mort-vivant')?.capabilities?.grantGroups).toEqual(['mort-vivant']);
    expect(findTraitById('demoniaque')?.capabilities?.grantGroups).toEqual(['demon']);
    expect(findCareerById('soldat')?.grantGroups).toBeDefined(); // le canal carrière, lui, n'a pas bougé
    expect(findClassById('roublards')?.grantGroups).toBeDefined();
  });
});
