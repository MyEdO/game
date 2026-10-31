import { describe, expect, it } from 'vitest';
import { nouvelEntete, ouvrirLaPartie } from '../../../src/hote/partie';
import { combattantsTries } from '../../../src/hote/projection';
import { equipementDessine, findTeinteById } from '../../../src/noyau/index';
import { itemFromGive, weaponFromItem } from '../../../src/engine/items';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import type { ManifesteMontable } from '../asset/montage';
import { estSchema3 } from '../asset/modeles';
import { INDEX_DES_APPARENCES, indexDesApparences, modelesDesCombattants, premierModele } from './equipement';
import { suiteDe, table } from './pont.testkit';
const manifesteDeLame: ManifesteMontable = {
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
  montage: {
    attaches: {
      main: { os: 'poignet_d', position: [0, 0, 0], rotation: [0, 0, 0] },
      off: { os: 'poignet_g', position: [0, 0, 0], rotation: [0, 0, 0] },
      dos: { os: 'torse', position: [0, 0, 0], rotation: [0, 0, 0] },
      ceinture: { os: 'bassin', position: [0, 0, 0], rotation: [0, 0, 0] },
    },
    composants: { droite: { prise: 'main', rangement: 'ceinture', matieres: [{ cle: 'metal', piece: 'Lame_D', surface: 0 }] }, gauche: { prise: 'off', rangement: 'ceinture', matieres: [{ cle: 'metal', piece: 'Lame_G', surface: 0 }] }, garde: { prise: 'off', rangement: 'dos', matieres: [{ cle: 'accent', piece: 'Garde', surface: 0 }] } },
  },
};
const indexDeLame = indexDesApparences([manifesteDeLame]);

function heros(apparence: string, main: 'main' | 'off' = 'main') {
  const ouverte = ouvrirLaPartie(nouvelEntete('dome', { graine: 1 }), () => {});
  const origine = ouverte.partie.etat();
  const etat = { ...origine, battle: structuredClone(origine.battle) };
  ouverte.partie.fermer();
  const c = etat.battle!.combatants.find(c => c.kind === 'hero')!;
  const tenue = { ...itemFromGive({ trappingId: 'arme-simple', apparence: { id: apparence } }), uid: 'tenue-l3' };
  const rangee = { ...itemFromGive({ trappingId: 'arme-simple', apparence: { id: 'epee_ebrechee' } }), uid: 'rangee-l3' };
  const bouclier = { ...itemFromGive({ trappingId: 'bouclier', apparence: { id: 'bouclier_pointes' } }), uid: 'bouclier-l3' };
  c.items = [tenue, rangee, bouclier];
  c.weapons = [weaponFromItem(tenue, main), ...(main === 'main' ? [weaponFromItem(bouclier, 'off')] : [])];
  c.loadouts = [main === 'main' ? { id: 'a', main: tenue.uid, off: bouclier.uid } : { id: 'a', off: tenue.uid }, { id: 'b', main: rangee.uid }];
  c.activeLoadoutId = 'a';
  return { c, projete: combattantsTries(etat).find(p => p.id === c.id)! };
}

describe('équipement publié au pont Godot (#2948 L3)', () => {
  it('résout la teinte des objets tenus et rangés par le lecteur du noyau, sans modifier les autres instances', () => {
    const { projete } = heros('epee_ebrechee');
    projete.equipement.weapons[0].teinte = 'aethyrique';
    projete.equipement.rangees[0].teinte = 'shyish';
    const avant = structuredClone(projete);
    const dessin = modelesDesCombattants([projete], indexDeLame).equipements[projete.id];
    expect(dessin.tenues[0].palette).toEqual(findTeinteById('aethyrique')!.palette);
    expect(dessin.rangees[0].palette).toEqual(findTeinteById('shyish')!.palette);
    expect(dessin.tenues[1].palette).toBeNull();
    expect(projete).toEqual(avant);
  });

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

  it.each([['main', 'droite'], ['off', 'gauche']] as const)('épée tenue : %s monte uniquement %s', (main, attendu) => {
    const { projete } = heros('epee_ebrechee', main);
    expect(modelesDesCombattants([projete], indexDeLame).equipements[projete.id].tenues[0].modele?.composants.map(c => c.composant)).toEqual([attendu]);
  });

  it('une épée rangée prend le premier composant déclarant un rangement, indépendamment de sa prise', () => {
    const m = { ...manifesteDeLame, components: { gauche: manifesteDeLame.components.gauche, droite: manifesteDeLame.components.droite, garde: manifesteDeLame.components.garde } };
    const { projete } = heros('epee_ebrechee');
    expect(modelesDesCombattants([projete], indexDesApparences([m])).equipements[projete.id].rangees[0].modele?.composants.map(c => c.composant)).toEqual(['gauche']);
  });

  it('une variante incompatible laisse essayer sa racine compatible', () => {
    const m = { ...manifesteDeLame, components: { ...manifesteDeLame.components, gauche: { ...manifesteDeLame.components.gauche, apparence: 'epee_ebrechee' } } };
    const choix = premierModele(['epee_ebrechee', 'epee'], indexDesApparences([m]), { emplacement: 'tenues', main: 'main' });
    expect(choix?.apparence).toBe('epee');
    expect(choix?.composants.map(c => c.composant)).toEqual(['droite']);
  });

  it('aucun composant compatible produit une absence portant tous les candidats', () => {
    const m: ManifesteMontable = {
      ...manifesteDeLame,
      components: { gauche: manifesteDeLame.components.gauche, garde: manifesteDeLame.components.garde },
      pieces: { gauche: manifesteDeLame.pieces.gauche, garde: manifesteDeLame.pieces.garde },
      montage: { ...manifesteDeLame.montage, composants: { gauche: manifesteDeLame.montage.composants.gauche, garde: manifesteDeLame.montage.composants.garde } },
    };
    const { projete } = heros('epee_ebrechee');
    const resultat = modelesDesCombattants([projete], indexDesApparences([m]));
    expect(resultat.equipements[projete.id].tenues[0].modele).toBeNull();
    expect(resultat.couverture.absences).toEqual([{ porteur: projete.id, emplacement: 'tenues', position: 0, candidats: ['epee_ebrechee', 'epee'] }]);
  });

  it('une arme à deux mains publie un seul montage dans sa main directrice', () => {
    const arme = equipementDessine({ weapons: [weaponFromItem(itemFromGive({ trappingId: 'zweihander' }))], items: [], armour: {} } as unknown as Parameters<typeof equipementDessine>[0]).weapons[0];
    expect([arme.hand, arme.hands]).toEqual(['main', 2]);
    expect(premierModele(arme.candidats, INDEX_DES_APPARENCES, { emplacement: 'tenues', main: arme.hand })?.composants).toHaveLength(1);
  });

  it('un composant sans pièce ne constitue pas un modèle disponible', () => {
    const sansPieces = { ...manifesteDeLame, pieces: {} };
    expect(premierModele(['epee'], indexDesApparences([sansPieces]), { emplacement: 'tenues', main: 'main' })).toBeNull();
  });

  it('découvre chaque composant d’objet de chaque manifeste schéma 2 commité', () => {
    const dossier = new URL('../projet/modeles/', import.meta.url);
    const fichiers = listerDossier(fileURLToPath(dossier)).filter(f => f.endsWith('.manifeste.json'));
    expect(fichiers.length).toBeGreaterThan(0);
    for (const fichier of fichiers) {
      const brut: unknown = JSON.parse(readFileSync(new URL(fichier, dossier), 'utf8'));
      if (estSchema3(brut)) continue;
      const m = brut as ManifesteMontable;
      for (const [composant, c] of Object.entries(m.components)) {
        const pieces = Object.values(m.pieces).filter(p => p.component === composant).map(p => p.node);
        if (c.apparence === null || !pieces.length) continue;
        expect(INDEX_DES_APPARENCES.get(c.apparence), fichier).toEqual(expect.arrayContaining([{ modele: m.model, composant, pieces, portage: m.montage.composants[composant] ?? null }]));
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
