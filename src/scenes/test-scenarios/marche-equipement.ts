import { createHero } from '../../engine/character';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import { rigSpeciesId } from '../../data';
import { Combatant } from '../../engine/types';
import { flowFromEffects } from '../../state/flow';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';
import { t } from '../../i18n';
import type { Scene } from '../../state/scene';

/**
 * « Marché & équipement » : tout le cycle objets en une échoppe. Réunit le Marchand (Acheter/Vendre/
 * Marchander/Évaluer/Réparer), les Trois marchands (armurier en direct + herboriste ouverte DEPUIS un
 * dialogue + maquignon en direct, trois archétypes) et l'Équipement (écran d'EMPLACEMENTS : couches d'armure, sets d'armes, cape).
 * Le groupe = un Négociant (épée magique non identifiée + maille endommagée + dague à vendre) et un
 * Maître d'armes (sac garni à équiper).
 */

/** Négociant : épée magique NON identifiée (qualité cachée + skin), maille endommagée, dague à vendre,
 *  selle et harnais (charger une monture/déplacer vers la mule, DoD Possessions testable). */
function negociant(): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Négociant (test)', motivation: 'Test', seed: 2510, id: 'test-negociant' });
  // Épée bâtarde « légendaire » : qualité MAGIQUE cachée (« De plaies atroces », ADE II) + skin bleuté ;
  // identified:false → masquée tant qu'une Évaluation ne l'a pas révélée (mais ACTIVE en combat).
  const epee = itemFromTrappingById('epee-batarde')!;
  epee.qualities = [...epee.qualities, { id: 'de-plaies-atroces' }];
  epee.identified = false;
  epee.skin = { metal: '#7faaff' };
  epee.equipped = true;
  const maille = itemFromTrappingById('chemise-de-mailles')!;
  maille.damageTaken = 2; // 2 PA perdus → réparable (10 %/PA, LDB 63)
  maille.equipped = true;
  const dague = itemFromTrappingById('dague')!; // un objet à vendre
  const selle = itemFromTrappingById('selle-et-harnais')!;
  h.items = [epee, maille, dague, selle];
  recomputeLoadout(h);
  h.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'M', build: 0.5 };
  return h;
}

/** Maître d'armes : sac garni pour l'écran d'EMPLACEMENTS (couches d'armure LDB 63 + 2 sets d'armes + cape). */
function maitreArmes(): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: "Maître d'armes (test)", motivation: 'Test', seed: 2606, id: 'test-equipement' });
  const take = (id: string, equipped = false) => {
    const it = itemFromTrappingById(id)!;
    it.equipped = equipped;
    return it;
  };
  h.items = [
    take('justaucorps-de-cuir', true), // la Veste (même couche) doit l'ÉCHANGER à l'équipement
    take('veste-de-cuir'),
    take('chemise-de-mailles'), // Flexible : se superpose au cuir souple ET à la plate
    take('plastron'), // couche extérieure rigide
    take('calotte-de-cuir'),
    take('jambieres-en-cuir'),
    take('cape'), // emplacement cosmétique (visible dans le dos du rig)
    take('rapiere', true), // Set I mêlée
    take('bouclier', true),
    take('epee-batarde'), // 2M au sac → grisage du slot secondaire
    take('arc', true), // Set II distance
    take('fleche'),
  ];
  h.loadouts = undefined; // inventaire de carrière REMPLACÉ → régénérer les sets par défaut
  h.activeLoadoutId = undefined;
  recomputeLoadout(h);
  h.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'M', build: 0.5 };
  return h;
}

const construireScene = (): Scene => buildScene({
  id: 'test-marchand',
  label: 'Marché & équipement',
  desc: 'Arène de test.',
  size: [16, 9],
  terrain: 'herbe',
  heroStart: [2, 4],
  startMessage:
    { texte: 'Trois échoppes : un armurier (parlez-lui directement), une herboriste (engagez la conversation puis demandez ' +
    'à voir ses marchandises) et un maquignon (parlez-lui directement, il vend montures et véhicules). Faites ' +
    'évaluer l’épée mystérieuse du Négociant, marchandez, réparez sa maille, vendez sa dague. Ouvrez la fiche du ' +
    `Maître d’armes (onglet ${t('sheet.tab.possessions')}) pour l’écran d’emplacements (couches d’armure, cape, bascule Set I/Set II).` },
  entities: [
    // Armurier : interaction directe → la boutique s'ouvre tout de suite.
    { id: 'armurier', kind: 'personnage', ref: 'humain', label: 'Armurier', pos: { x: 7, y: 2 }, appearance: { species: 'humains-reiklander' }, merchant: { archetype: 'armurier' } },
    // Herboriste : DIALOGUE d'abord, puis un choix ouvre sa boutique via openMerchant (vend +25 % : village isolé).
    { id: 'herboriste', kind: 'personnage', ref: 'humain', label: 'Herboriste', pos: { x: 12, y: 6 }, appearance: { species: 'humains-reiklander' }, dialogueId: 'dlg-herbo', merchant: { archetype: 'herboriste', buyMarkup: 1.25 } },
    // Maquignon : interaction directe — vend montures/véhicules (stock DÉRIVÉ de merchants.json + unitKinds).
    { id: 'maquignon', kind: 'personnage', ref: 'humain', label: 'Maquignon', pos: { x: 13, y: 2 }, appearance: { species: 'humains-reiklander' }, merchant: { archetype: 'maquignon' } },
    // Aubergiste : DIALOGUE d'abord, puis un choix ouvre les jeux de taverne via l'Effet openTavernGames.
    { id: 'aubergiste', kind: 'personnage', ref: 'humain', label: 'Aubergiste', pos: { x: 3, y: 7 }, appearance: { species: 'humains-reiklander' }, dialogueId: 'dlg-taverne' },
  ],
  dialogues: [
    {
      id: 'dlg-herbo',
      start: 'accueil',
      nodes: [
        {
          id: 'accueil',
          desc: 'Bonjour, voyageur. Cherchez-vous des remèdes… ou seulement à bavarder ?',
          choices: [
            { label: 'Montrez-moi vos marchandises.', flow: flowFromEffects([{ type: 'openMerchant', entityId: 'herboriste' }]) },
            { label: 'Une autre fois. (Partir)' },
          ],
        },
      ],
    },
    {
      id: 'dlg-taverne',
      start: 'accueil',
      nodes: [
        {
          id: 'accueil',
          desc: 'La salle est chaude et les dés roulent. Une partie, l’ami ?',
          choices: [
            { label: 'Volontiers — proposez-nous une partie.', flow: flowFromEffects([{ type: 'openTavernGames' }]) },
            { label: 'Plus tard. (Partir)' },
          ],
        },
      ],
    },
  ],
  triggers: [
    // Bourse de départ (la nouvelle partie réinitialise l'argent à 0) — versée en s'avançant vers les échoppes.
    { id: 'bourse', rect: { x: 3, y: 3, w: 8, h: 4 }, once: true, flow: flowFromEffects([{ type: 'giveMoney', montant: { gold: 60 } }, { type: 'journal', desc: 'Vous disposez de 60 couronnes.' }]) },
  ],
});

export const scenario: TestScenario = {
  id: 'marche-equipement',
  order: 7,
  category: 'marche',
  icon: 'scenario/market',
  title: 'Marché & équipement',
  tests:
    'Acheter/Vendre + Marchander (Test opposé −10/−20 %) + Évaluer (révèle la qualité cachée) + Réparer (10 %/PA) ; ' +
    'trois archétypes (armurier direct + herboriste via dialogue, Effet openMerchant + maquignon direct, montures/' +
    'véhicules) ; écran d’EMPLACEMENTS (couches ' +
    'd’armure LDB 63 souple/Flexible/rigide avec échange auto, cape cosmétique, 2 sets d’armes) ; Troc (onglet du ' +
    'panneau marchand : ratio de Disponibilité, échange objet↔objet sans argent) ; Aubergiste → jeux de taverne ' +
    '(Effet openTavernGames, option `tavern-games` pré-activée, NADJ 16).',
  partyNote: 'Négociant (épée non identifiée + maille endommagée + dague) + Maître d’armes (sac garni)',
  // Jeux de taverne pré-activés (NADJ 16) — modifiable au panneau Règles maison, comme le Voyage par Étapes.
  rules: { 'tavern-games': true },
  construire: () => ({ party: [negociant(), maitreArmes()], scene: construireScene() }),
};
