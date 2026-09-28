import { describe, it, expect } from 'vitest';
import {
  allBuiltinCampaigns, areneCampaign, builtinCampaigns, campagneALancer, campagneDuJeu, copieDuJeu, documentDuJeu, paquetDuJeu,
  type BuiltinCampaign,
} from './campaign';
import { parseProject, ProjetRefuse } from '../state/worldMap';
import { allAxes } from '../data';
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
    expect(Object.keys(areneCampaign).sort()).toEqual(['icon', 'id', 'label', 'maison', 'paquet', 'type', 'versionContenu']);
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
