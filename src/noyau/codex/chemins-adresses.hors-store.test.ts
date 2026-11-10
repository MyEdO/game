/**
 * CÂBLAGE de `CHEMINS_ADRESSES` (`./chemins-adresses.ts`) ⇄ porteurs réellement émis par le registre du
 * Codex (`CODEX`, sections d'un statbloc de combattant `combatantSections`), puis ⇄ sites de déclaration
 * des chemins de PROJET dans les defs de scène. #1392
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { CODEX, combatantSections, type CodexRow, type CodexSection } from './registry';
import { CHEMINS_ADRESSES } from './chemins-adresses';
import { porteurDeRangee, type Porteur } from './porteur';
import { adressesDesEntreesEmbarquees } from '../../data/schemas/grammaire/document';
import { projetSchema } from '../../data/schemas/defs-scenes/projet';
import { HEROS_DE_SCENARIO, herosDeScenario, type RoleDeScenario } from '../../scenes/test-scenarios/_heros';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { cheminsProseNommee } from '../../../scripts/guards/lib/proseNommee.mjs';
import { detenteur } from '../../lib/detenteur.testkit';

/** Les porteurs des rangées `t:'text'` de TOUT le catalogue et des statblocs d'inspection (rendus SANS entrée). */
function porteursEmis(): Porteur[] {
  const acc: Porteur[] = [];
  const balaye = (rows: CodexRow[], entree?: { type: string; id: string }) => {
    for (const r of rows) {
      const porteur = porteurDeRangee(r, entree);
      if (porteur) acc.push(porteur);
    }
  };
  for (const c of CODEX) {
    for (const it of c.items) {
      const entree = { type: c.key, id: it.id };
      const secs: CodexSection[] = [...(it.sections ?? []), ...(it.tabs ?? []).flatMap((t) => t.sections)];
      for (const s of secs) balaye(s.rows, entree);
      if (it.statblock) balaye(it.statblock.traits, entree);
    }
  }
  for (const key of Object.keys(HEROS_DE_SCENARIO) as RoleDeScenario[]) {
    for (const s of combatantSections(herosDeScenario(idsDeTest, key))) balaye(s.rows);
  }
  return acc;
}

describe('câblage `CHEMINS_ADRESSES` ⇄ porteurs réellement émis (#1392 §10)', () => {
  /** Un chemin émis, ramené à sa forme DÉCLARÉE : les index et les clés variables sont génériques. */
  const forme = (chemin: string): string => chemin.replace(/\[\d+\]/g, '[]').replace(/bySpecies\.[^.]+$/, 'bySpecies.<espèce>');
  const EMIS = detenteur(() => new Set(porteursEmis().map((p) => `${p.type}|${forme(p.chemin)}`)));

  it('tout porteur émis par le registre est DANS la liste fermée', () => {
    expect(EMIS().size, 'le registre n’émet plus aucun porteur : le câblage ne mesure rien').toBeGreaterThan(0);
    const declares = new Set(CHEMINS_ADRESSES.map((c) => `${c.type}|${c.chemin}`));
    const generiques = new Set(CHEMINS_ADRESSES.filter((c) => c.type === '*').map((c) => c.chemin));
    const hors = [...EMIS()].filter((e) => {
      const [, chemin] = e.split('|');
      return !declares.has(e) && !generiques.has(chemin);
    }).sort();
    expect(hors).toEqual([]);
  });

  /* CÂBLAGE des chemins de PROJET : l'inventaire (`CHAMPS_PROSE_DE_SCENE`) ne vaut que si CHAQUE
   * chemin a son SITE DE DÉCLARATION dans les defs de scène ou la grammaire qu'elles composent.
   * Recopier le triplet attendu ici ne prouverait que la recopie ; on le confronte donc au CODE RÉEL
   * (corpus partagé). */
  const DEFS_SCENES = detenteur(() => readCorpus(['src/data/schemas/defs-scenes', 'src/data/schemas/grammaire']));
  const DECLARES = detenteur(
    () => new Set(cheminsProseNommee(DEFS_SCENES())),
  );

  it('chaque chemin de PROJET est composé par `proseNommee()` dans une def de scène, hors enveloppes des entrées embarquées', () => {
    const embarquees = adressesDesEntreesEmbarquees([projetSchema]);
    expect(embarquees.length, 'la projection des entrées embarquées est vide').toBeGreaterThan(0);
    const projets = CHEMINS_ADRESSES.filter((c) => c.type === 'projet').map((c) => c.chemin);
    expect(projets.some((c) => DECLARES().has(c))).toBe(true);
    const enveloppes = embarquees.flatMap((a) => CHEMINS_ADRESSES.filter((x) => x.type === '*').map((x) => `${a}.${x.chemin}`));
    expect(projets.filter((c) => !DECLARES().has(c)).sort()).toEqual(enveloppes.sort());
  });

  it('aucune def de scène ne déclare un chemin HORS inventaire', () => {
    const projets = new Set(CHEMINS_ADRESSES.filter((c) => c.type === 'projet').map((c) => c.chemin));
    expect([...DECLARES()].filter((c) => !projets.has(c)).sort()).toEqual([]);
  });
});
