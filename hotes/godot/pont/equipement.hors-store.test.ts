import { describe, expect, it } from 'vitest';
import { nouvelEntete, ouvrirLaPartie } from '../../../src/hote/partie';
import { combattantsTries } from '../../../src/hote/projection';
import { equipementDessine } from '../../../src/noyau/index';
import { itemFromGive, weaponFromItem } from '../../../src/engine/items';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import type { ManifesteDePersonnage } from '../asset/manifeste';
import { INDEX_DES_APPARENCES, indexDesApparences, modelesDesCombattants, premierModele } from './equipement';
import { suiteDe, table } from './pont.testkit';
const manifesteDeLame: ManifesteDePersonnage = {
  schema_version: 2, model: 'Lame.glb', default_head: null, head_options: [],
  pieces: {
    droite: { node: 'Lame_D', component: 'droite', headVariant: null, hiddenBy: [] },
    gauche: { node: 'Lame_G', component: 'gauche', headVariant: null, hiddenBy: [] },
    garde: { node: 'Garde', component: 'garde', headVariant: null, hiddenBy: [] },
  },
  components: {
    droite: { label_fr: 'Lame droite', apparence: 'epee' },
    gauche: { label_fr: 'Lame gauche', apparence: 'epee' },
    garde: { label_fr: 'Bouclier', apparence: 'bouclier_pointes' },
  },
  incompatibilities: [], defaults: [], presets: {}, clips: {},
};
const indexDeLame = indexDesApparences([manifesteDeLame]);

function heros(apparence: string) {
  const ouverte = ouvrirLaPartie(nouvelEntete('dome', { graine: 1 }));
  const origine = ouverte.partie.etat();
  const etat = { ...origine, battle: structuredClone(origine.battle) };
  ouverte.partie.fermer();
  const c = etat.battle!.combatants.find(c => c.kind === 'hero')!;
  const tenue = { ...itemFromGive({ trappingId: 'arme-simple' }), uid: 'tenue-l3', apparence };
  const rangee = { ...itemFromGive({ trappingId: 'arme-simple' }), uid: 'rangee-l3', apparence: 'epee_ebrechee' };
  const bouclier = { ...itemFromGive({ trappingId: 'bouclier' }), uid: 'bouclier-l3', apparence: 'bouclier_pointes' };
  c.items = [tenue, rangee, bouclier];
  c.weapons = [weaponFromItem(tenue, 'main'), weaponFromItem(bouclier, 'off')];
  c.loadouts = [{ id: 'a', main: tenue.uid, off: bouclier.uid }, { id: 'b', main: rangee.uid }];
  c.activeLoadoutId = 'a';
  return { c, projete: combattantsTries(etat).find(p => p.id === c.id)! };
}

describe('équipement publié au pont Godot (#2948 L3)', () => {
  it('projette sans recalcul les candidats ordonnés, les rangées et le bouclier', () => {
    const { c, projete } = heros('epee_ebrechee');
    expect(projete.equipement).toEqual(equipementDessine(c));
    expect(projete.equipement.weapons.map(w => w.candidats)).toEqual([['epee_ebrechee', 'epee'], ['bouclier_pointes', 'rond']]);
    expect(projete.equipement.rangees[0].candidats).toEqual(['epee_ebrechee', 'epee']);
    expect(projete.equipement.shield?.candidats).toEqual(['bouclier_pointes', 'rond']);
  });

  it('une variante sans modèle prend sa racine, y compris pour une arme rangée', () => {
    const { projete } = heros('epee_ebrechee');
    const resultat = modelesDesCombattants([projete], indexDeLame);
    expect(resultat.equipements[projete.id].tenues[0].modele?.apparence).toBe('epee');
    expect(resultat.equipements[projete.id].rangees[0].modele?.apparence).toBe('epee');
    expect(resultat.equipements[projete.id].tenues[1].modele?.apparence).toBe('bouclier_pointes');
    expect(resultat.couverture).toEqual({ demandes: 3, absences: [] });
  });

  it('un manifeste déclarant la variante la fait passer avant sa racine', () => {
    const variante = { ...manifesteDeLame, components: { ...manifesteDeLame.components, droite: { ...manifesteDeLame.components.droite, apparence: 'epee_ebrechee' } } };
    const index = indexDesApparences([variante]);
    const { projete } = heros('epee_ebrechee');
    expect(modelesDesCombattants([projete], index).equipements[projete.id].tenues[0].modele).toEqual({
      apparence: 'epee_ebrechee', composants: [{ modele: 'Lame.glb', composant: 'droite', pieces: ['Lame_D'] }],
    });
  });

  it('une absence totale est comptée et désigne le porteur et tous ses candidats', () => {
    const { projete } = heros('hache_naine');
    const resultat = modelesDesCombattants([projete], indexDeLame);
    expect(resultat.equipements[projete.id].tenues[0].modele).toBeNull();
    expect(resultat.couverture).toEqual({ demandes: 3, absences: [{ porteur: projete.id, emplacement: 'tenues', position: 0, candidats: ['hache_naine', 'hache'] }] });
  });

  it('conserve tous les composants qui dessinent le même id, sans confondre main et apparence', () => {
    expect(premierModele(['epee'], indexDeLame)?.composants.map(c => c.composant)).toEqual(['droite', 'gauche']);
  });

  it('un composant sans pièce ne constitue pas un modèle disponible', () => {
    const sansPieces = { ...manifesteDeLame, pieces: {} };
    expect(premierModele(['epee'], indexDesApparences([sansPieces]))).toBeNull();
  });

  it('découvre chaque composant d’objet de chaque manifeste commité', () => {
    const dossier = new URL('../projet/modeles/', import.meta.url);
    const fichiers = listerDossier(fileURLToPath(dossier)).filter(f => f.endsWith('.manifeste.json'));
    expect(fichiers.length).toBeGreaterThan(0);
    for (const fichier of fichiers) {
      const m = JSON.parse(readFileSync(new URL(fichier, dossier), 'utf8')) as ManifesteDePersonnage;
      for (const [composant, c] of Object.entries(m.components)) {
        const pieces = Object.values(m.pieces).filter(p => p.component === composant).map(p => p.node);
        if (c.apparence === null || !pieces.length) continue;
        expect(INDEX_DES_APPARENCES.get(c.apparence), fichier).toEqual(expect.arrayContaining([{ modele: m.model, composant, pieces }]));
      }
    }
  });

  it('chaque réponse du transport publie les sélections et le rapport de couverture', () => {
    const t = table();
    const suite = suiteDe(t.appel('demarrer', { scenario: 'dome', graine: 1 }));
    const combattants = suite.vue.projection.combat!.voisins.liste;
    expect(combattants.length).toBeGreaterThan(0);
    expect(suite.vue.equipements).toEqual(modelesDesCombattants(combattants).equipements);
    expect(suite.vue.couverture).toEqual(modelesDesCombattants(combattants).couverture);
    for (const c of combattants) expect(c.equipement).toHaveProperty('rangees');
  });
});
