/**
 * GARDE — une entité ENRÔLÉE dans une rencontre porte un NOM, jamais une légende (#1882).
 *
 * QUESTION : le `label` d'un personnage membre d'une rencontre est-il le nom du combattant, ou une
 * légende d'authoring (« Gobelin de la stalle voisine », « Guetteur du corps de garde ») qui s'affiche en combat,
 * au journal et au jet comme si c'était son nom ? C'est son NOM : le label d'entité gagne sur la fiche
 * (`state/sceneNpc.ts › fiche`). Une légende va dans un commentaire, jamais dans le `label`.
 * Motif : label d'entité enrôlée, différent du nom de sa fiche, de plus de `MOTS_MAX` mots hors article initial.
 * Exemptés au SITE (`scène|entité`) : un nom propre plus long, avec sa raison.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { parseProject } from '../state/worldMap';
import { ficheDEntite } from '../state/sceneNpc';
import { useGame } from '../state/store';
import { testScenarios } from './test-scenarios';
import type { Scene } from '../state/scene';
import type { NarratifBlock } from '../state/campaignNarratif';

const EXEMPTES = new Map<string, string>([
  ['ls-abordage-cogue|chef-cogue', 'nom propre : le chef de l’équipage de la Dent de Manann'],
]);

const MOTS_MAX = 3;
const ARTICLE = /^(?:les?|la|l[’'])\s*/i;
const legende = (label: string): boolean => label.trim().replace(ARTICLE, '').split(/\s+/).length > MOTS_MAX;

/** Chaque paquet de scènes avec le bloc narratif qui résout ses presets de PNJ. */
function paquets(): { scenes: Scene[]; narratif?: NarratifBlock }[] {
  const out: { scenes: Scene[]; narratif?: NarratifBlock }[] = testScenarios.map((s) => ({ scenes: [s.scene, ...(s.extraScenes ?? [])], narratif: s.narratif }));
  for (const rel of listerArbre(__dirname, { filtre: (r: string) => r.endsWith('-projet.json') }))
    out.push(parseProject(JSON.parse(readFileSync(join(__dirname, rel), 'utf8'))));
  return out;
}

function enroles(): { site: string; label: string; nomDeFiche: string }[] {
  const out: { site: string; label: string; nomDeFiche: string }[] = [];
  for (const { scenes, narratif } of paquets()) {
    useGame.setState({ campaignNarratif: narratif ?? null });
    for (const sc of scenes) for (const enc of sc.encounters)
      for (const m of enc.members ?? []) {
        const ent = sc.entities.find((e) => e.id === m.entityId && e.kind === 'personnage');
        if (!ent?.label) continue;
        out.push({ site: `${sc.id}|${ent.id}`, label: ent.label, nomDeFiche: ficheDEntite({ ...ent, label: undefined }).label });
      }
  }
  useGame.setState({ campaignNarratif: null });
  return out;
}

describe('legende-enrolee-guard (#1882)', () => {
  const vus = enroles();

  it('aucune entité enrôlée ne porte une légende pour nom', () => {
    const fautes = vus
      .filter((v) => legende(v.label) && v.label !== v.nomDeFiche && !EXEMPTES.has(v.site))
      .map((v) => `${v.site} « ${v.label} » (fiche : « ${v.nomDeFiche} »)`);
    expect(fautes, 'donner un NOM au label (la légende va en commentaire), ou exempter le SITE d’un nom propre').toEqual([]);
  });

  it('PEUPLEMENT : le scan lit des entités enrôlées nommées, et chaque exemption est VUE', () => {
    expect(vus.length).toBeGreaterThan(0);
    const sites = new Set(vus.map((v) => v.site));
    expect([...EXEMPTES.keys()].filter((e) => !sites.has(e))).toEqual([]);
  });
});
