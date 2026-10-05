import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  allBuiltinCampaigns, areneCampaign, builtinCampaigns, campagneALancer, campagneDuJeu, copieDuJeu, diligenceCampaign, documentDuJeu, paquetDuJeu,
  type BuiltinCampaign,
} from './campaign';
import { parseProject, projetVersDepot, ProjetRefuse, type ProjectDoc } from '../state/worldMap';
import { allAxes } from '../data';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
// @ts-expect-error - résolveur ESM JS (pas de types) — même convention que `vite.config.ts`
import { materialiser } from '../../scripts/source/resoudre.mjs';
import areneProjet from './arene/arene-projet.json';

/**
 * Registre des campagnes du jeu (#211) : « Nouvelle partie → Changer » les liste toutes via
 * `CampaignSelect` (`ui/PartyScreen.tsx`), au MÊME mécanisme que les projets publiés de l'éditeur
 * (`pendingCampaign` + `loadProject`) — jamais un chemin parallèle.
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

/** #1692 : à l'import, une campagne du jeu n'est que son identité et son paquet NON PARSÉ ; la porte
 *  `parseProject` se passe au geste. */
describe('campagne du jeu — identité à l’import, paquet parsé au geste', () => {
  it('l’identité est lue à la racine du paquet, le paquet est le JSON commité lui-même', () => {
    expect(areneCampaign.paquet).toBe(areneProjet);
    expect(areneCampaign.id).toBe(areneProjet.id);
    expect(areneCampaign.label).toBe(areneProjet.label);
    expect(areneCampaign.icon).toBe(areneProjet.icon);
    expect(Object.keys(areneCampaign).sort()).toEqual(['fichier', 'icon', 'id', 'label', 'maison', 'paquet', 'type', 'versionContenu']);
  });

  it('un paquet que la porte refuse : jouer, ouvrir et exporter lèvent `ProjetRefuse`', () => {
    const [premiere, ...autres] = areneProjet.scenes;
    const refusee: BuiltinCampaign = {
      ...areneCampaign,
      paquet: { ...areneProjet, scenes: [{ ...premiere, entities: [...premiere.entities, { id: 'x', kind: 'prop', ref: 'decor-inconnu', pos: { x: 0, y: 0 } }] }, ...autres] },
    };
    expect(() => campagneDuJeu(refusee)).toThrow(ProjetRefuse);
    expect(() => copieDuJeu(refusee)).toThrow(ProjetRefuse);
    expect(() => documentDuJeu(refusee)).toThrow(ProjetRefuse);
  });

  it('sans choix, « Lancer » lance l’Arène par `campagneDuJeu` ; un choix est lancé tel quel', () => {
    expect(campagneALancer(null)).toEqual(campagneDuJeu(areneCampaign));
    const choisie = campagneDuJeu(builtinCampaigns[0]);
    expect(campagneALancer(choisie)).toBe(choisie);
  });
});

/** `activeAxes` (#409) suit la campagne du jeu comme une entrée de bibliothèque (`campagneDeLEntree`) :
 *  présent seulement s'il est déclaré. */
describe('activeAxes — porté du paquet à la campagne lancée', () => {
  const axes = allAxes.filter((a) => !a.core).map((a) => a.id);
  const avecAxes: BuiltinCampaign = { ...areneCampaign, paquet: { ...areneProjet, activeAxes: axes } as BuiltinCampaign['paquet'] };

  it('le registre porte des axes hors socle', () => {
    expect(axes.length).toBeGreaterThan(0);
  });

  it('un paquet qui n’en déclare pas : aucune clé `activeAxes`', () => {
    expect('activeAxes' in campagneDuJeu(areneCampaign)).toBe(false);
  });

  it('une campagne du jeu qui en déclare : la fabrique les transmet', () => {
    expect(campagneDuJeu(avecAxes).activeAxes).toEqual(axes);
  });

  it('une campagne du jeu qui en déclare : sa COPIE ouverte à l’éditeur les porte', () => {
    expect(copieDuJeu(avecAxes).activeAxes).toEqual(axes);
    expect('activeAxes' in copieDuJeu(areneCampaign)).toBe(false);
  });

  it('une campagne du jeu qui en déclare : son EXPORT les écrit, et le document repasse la porte avec eux', () => {
    const doc = documentDuJeu(avecAxes);
    expect(doc.activeAxes).toEqual(axes);
    expect(parseProject(doc).activeAxes).toEqual(axes);
    expect('activeAxes' in documentDuJeu(areneCampaign)).toBe(false);
  });
});

/** `copieDuJeu` : ce que l'éditeur OUVRE d'une campagne du jeu (#367). */
describe('copieDuJeu — la copie d’une campagne du jeu', () => {
  const paquet = paquetDuJeu(areneCampaign);

  it('le départ est la première scène du paquet, le reste garde son ordre', () => {
    const copie = copieDuJeu(areneCampaign);
    expect(copie.depart.id).toBe(paquet.scenes[0].id);
    expect(copie.autresScenes.map((s) => s.id)).toEqual(paquet.scenes.slice(1).map((s) => s.id));
  });

  it('tout est copié en profondeur : deux ouvertures ne partagent aucun nœud', () => {
    const a = copieDuJeu(areneCampaign);
    const b = copieDuJeu(areneCampaign);
    expect(a.depart).toEqual(b.depart);
    expect(a.depart).not.toBe(b.depart);
    expect(a.narratif).not.toBe(b.narratif);
    expect(a.worldMap).not.toBe(b.worldMap);
    expect(a.worldMap).toEqual(paquet.worldMap);
  });

  it('l’identité est celle du paquet parsé, entière, sans le `label`', () => {
    const { scenes: _sc, worldMap: _wm, activeAxes: _aa, narratif: _na, label: _lb, ...identite } = paquet;
    expect(copieDuJeu(areneCampaign).identite).toEqual(identite);
  });
});

/**
 * L'export PORTABLE d'une campagne livrée garde `desc` ET `descRef` : il se relit sans le `Source/`,
 * et sa FORME DÉPÔT (`projetVersDepot`) est le fichier committé, octet pour octet, pour chaque projet livré (#680).
 */
describe('export portable d’une campagne livrée — la prose ADRESSÉE fait l’aller-retour (#680)', () => {
  const DISQUE = readFileSync(join(__dirname, 'diligence/diligence-projet.json'), 'utf8');
  type Preset = { id: string; profil?: { desc?: unknown; descRef?: unknown } };
  const adresses = (JSON.parse(DISQUE).narratif.presetsPnj as Preset[]).filter((p) => p.profil?.descRef !== undefined);
  const exporte = (): Record<string, unknown> => JSON.parse(JSON.stringify(documentDuJeu(diligenceCampaign)));

  it('documentDuJeu → JSON → parseProject : chaque preset adressé revient AVEC son texte', () => {
    expect(adresses.length, 'aucun preset adressé — l’aller-retour ne mesurerait rien').toBeGreaterThan(0);
    const relus = parseProject(exporte()).narratif.presetsPnj as Preset[];
    const sansTexte = adresses
      .filter((a) => {
        const desc = relus.find((p) => p.id === a.id)?.profil?.desc;
        return typeof desc !== 'string' || desc === '';
      })
      .map((a) => a.id);
    expect(sansTexte).toEqual([]);
  });

  /** Chaque campagne du jeu et SON fichier livré, appariés par l'`id` du document. */
  const livrees = listerProjetsLivres().map((rel) => {
    const texte = readFileSync(join(__dirname, rel), 'utf8');
    const id = (JSON.parse(texte) as { id: string }).id;
    const campagne = allBuiltinCampaigns.find((c) => c.id === id);
    if (!campagne) throw new Error(`${rel} : aucune campagne du jeu d’id « ${id} »`);
    return [rel, campagne, texte] as const;
  });

  it.each(livrees)('%s : la campagne du registre nomme SON fichier (`fichier`)', (rel, campagne) => {
    expect(campagne.fichier).toBe(rel.split('/').pop());
  });

  it.each(livrees)('%s : la FORME DÉPÔT de l’export (`projetVersDepot`, format du dépôt) EST le fichier committé, à l’octet', (_rel, campagne, texte) => {
    const exporte = JSON.parse(JSON.stringify(documentDuJeu(campagne))) as ProjectDoc;
    expect(`${JSON.stringify(projetVersDepot(exporte), null, 1)}\n`).toBe(texte);
  });

  it('`materialiser` sur l’export LÈVE, en nommant le nœud : il porte déjà son texte', () => {
    expect(() => materialiser(exporte())).toThrow(/desc-et-descRef : narratif\.presetsPnj\[\d+\]\.profil/);
  });
});
