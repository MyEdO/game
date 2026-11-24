import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { allBuiltinCampaigns, builtinCampaigns, diligenceCampaign } from './campaign';
import { campagneDuJeu, ouvrirLEdition, paquetDuJeu, texteAEnregistrer, type BuiltinCampaign } from '../noyau/index';
import { parseProject } from '../noyau/worldMap';
import { campagnesLivrees as livrees } from './projetsLivres.testkit';
// @ts-expect-error - résolveur ESM JS (pas de types) — même convention que `vitest.config.ts`
import { materialiser } from '../../scripts/source/resoudre.mjs';

/**
 * Registre des campagnes du jeu (#211) : « Nouvelle partie → Changer » les liste toutes, au MÊME mécanisme que les
 * projets publiés de l'éditeur (`pendingCampaign` + `chargerLeProjet`) — jamais un chemin parallèle.
 */
describe('builtinCampaigns — registre des campagnes exposées au picker', () => {
  it('« Le Loup et la Saumure » y est enregistrée, projet valide', () => {
    const loup = builtinCampaigns.find((c) => c.id === 'loup-et-saumure');
    expect(loup).toBeTruthy();
    const lancee = campagneDuJeu(loup!);
    expect(lancee.scenes.length).toBeGreaterThan(0);
    expect(lancee.startSceneId).toBe(lancee.scenes[0].id);
    expect(lancee.worldMap).toBeTruthy();
  });

  it('chaque campagne du jeu a un id unique', () => {
    const ids = allBuiltinCampaigns.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/** Le texte qu'écrit l'enregistrement de l'éditeur ouvert sur la campagne `c` (`texteAEnregistrer`), sans geste. */
function texteEnregistre(c: BuiltinCampaign): string {
  const passe = texteAEnregistrer(ouvrirLEdition(paquetDuJeu(c), false));
  if (!passe.ok) throw new Error(passe.refus);
  return passe.valeur;
}

/**
 * L'enregistrement d'une campagne livrée ouverte à l'éditeur écrit sa FORME DÉPÔT : le fichier committé, octet pour
 * octet, dont la prose ADRESSÉE revient avec son texte au service du dépôt (`lireProjetLivre`, `hotes/godot/servir.mjs`)
 * (#680).
 */
describe('enregistrement d’une campagne livrée — forme dépôt et prose adressée (#680)', () => {
  type Preset = { id: string; profil?: { desc?: unknown; descRef?: unknown } };

  it('enregistrement → `materialiser` → parseProject : chaque preset adressé revient AVEC son texte', () => {
    const disque = readFileSync(join(__dirname, 'diligence/diligence-projet.json'), 'utf8');
    const adresses = (JSON.parse(disque).narratif.presetsPnj as Preset[]).filter((p) => p.profil?.descRef !== undefined);
    expect(adresses.length, 'aucun preset adressé — l’aller-retour ne mesurerait rien').toBeGreaterThan(0);
    const relus = parseProject(materialiser(JSON.parse(texteEnregistre(diligenceCampaign))).racine).narratif.presetsPnj as Preset[];
    const sansTexte = adresses
      .filter((a) => {
        const desc = relus.find((p) => p.id === a.id)?.profil?.desc;
        return typeof desc !== 'string' || desc === '';
      })
      .map((a) => a.id);
    expect(sansTexte).toEqual([]);
  });

  it.each(livrees)('%s : la campagne du registre nomme SON fichier (`fichier`)', (rel, campagne) => {
    expect(campagne.fichier).toBe(rel.split('/').pop());
  });

  it.each(livrees)('%s : l’enregistrement EST le fichier committé, à l’octet', (_rel, campagne, texte) => {
    expect(texteEnregistre(campagne)).toBe(texte);
  });
});
