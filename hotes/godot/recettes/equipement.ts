import { nouvelEntete, ouvrirLaPartie, scenarioDeTest } from '../../../src/hote/partie';
import { projeter, type CombattantProjete } from '../../../src/hote/projection';
import { modelesDesCombattants } from '../pont/equipement';
import type { VueDuPont } from '../pont/pont';
import { CLICS_DU_CHAMP, equipementDEntite, objetDuNarratif } from '../../../src/noyau/index';
import { porteurDObjetDeCampagne } from '../../../src/scenes/fixtures/objetDeCampagne';
import { lancementDuScenario } from '../../../src/scenes/test-scenarios/_shared';

const avecRangement = (equip: ReturnType<typeof equipementDEntite>) => ({ ...equip, rangees: equip.weapons.map(({ hand: _hand, ...arme }) => arme) });

export function figerVueDEquipement(): VueDuPont {
  const ouverte = ouvrirLaPartie(nouvelEntete('dome', { graine: 1 }), () => {});
  try {
    const { hero, narratif } = porteurDObjetDeCampagne('epee_ebrechee');
    hero.id = 'objet-de-campagne';
    ouverte.partie.lancer({ ...lancementDuScenario(scenarioDeTest('dome')), party: [hero], narratif });
    const etat = ouverte.partie.etat();
    const projection = projeter(etat, 0, 0, { autres: Infinity, offres: Infinity, cibles: Infinity, gestes: Infinity, entites: Infinity });
    if (!projection.combat) throw new Error('la fixture doit ouvrir un combat');
    const objetDeCampagne = projection.combat.voisins.liste.find((c) => c.id === hero.id);
    if (!objetDeCampagne) throw new Error('le porteur de campagne doit être projeté');
    const resolveTrapping = objetDuNarratif(etat.campaignNarratif);
    const arme = equipementDEntite(resolveTrapping, undefined, { weapon: 'zweihander' });
    const variante = equipementDEntite(resolveTrapping, undefined, { weapon: 'arme-simple', apparencesObjets: { 'arme-simple': { id: 'epee_ebrechee' } } });
    const teinte = { ...variante, weapons: variante.weapons.map(w => ({ ...w, teinte: 'aethyrique' })) };
    const cas: CombattantProjete[] = [
      { id: 'squelette-arme', nom: 'Squelette armé', camp: 'enemy', pb: [1, 1], avantage: 0, pos: [0, 0], distance: 0, engage: false, etats: [], horsCombat: false, equipement: avecRangement(arme) },
      { id: 'variante-repliee', nom: 'Variante repliée', camp: 'enemy', pb: [1, 1], avantage: 0, pos: [1, 0], distance: 1, engage: false, etats: [], horsCombat: false, equipement: avecRangement(variante) },
      { id: 'sans-modele', nom: 'Sans modèle', camp: 'enemy', pb: [1, 1], avantage: 0, pos: [2, 0], distance: 2, engage: false, etats: [], horsCombat: false, equipement: equipementDEntite(resolveTrapping, undefined, { weapon: 'arme-simple', apparencesObjets: { 'arme-simple': { id: 'hache_naine' } } }) },
      { id: 'chevalier-sans-arme', nom: 'Chevalier sans arme', camp: 'hero', pb: [1, 1], avantage: 0, pos: [3, 0], distance: 3, engage: false, etats: [], horsCombat: false, equipement: equipementDEntite(resolveTrapping, undefined) },
      { id: 'objet-teinte', nom: 'Objet teinté', camp: 'enemy', pb: [1, 1], avantage: 0, pos: [4, 0], distance: 4, engage: false, etats: [], horsCombat: false, equipement: avecRangement(teinte) },
      objetDeCampagne,
    ];
    projection.combat.voisins = { liste: cas, enPlus: 0 };
    projection.combat.actif = null;
    return { projection, ...modelesDesCombattants(cas), fenetre: null, attaque: null, defense: null, panneau: null, cases: [], plateau: null, champ: CLICS_DU_CHAMP };
  } finally {
    ouverte.partie.fermer();
  }
}
