import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipStateBlock, PosteDetail, ShipInspectBody } from './ShipSheet';
import type { Combatant, SkillInstance } from '../../engine/types';

const mk = (id: string, dex: number, skills: { id: string; advances: number; spec?: string }[] = [], shipRole?: string): Combatant =>
  ({
    id, label: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: dex, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    skills: skills.map((s) => ({ ...s, characteristic: 'dexterite' }) as SkillInstance),
    conditions: [], talents: [], wounds: { current: 10, max: 10, base: 10 }, shipRole,
  }) as unknown as Combatant;

type Poste = NonNullable<Combatant['postes']>[number];
const poste = (label: string, uid: string, side: string, crewIds: string[]): Poste =>
  ({ item: { label, uid }, side, crewIds }) as unknown as Poste;

describe('ShipSheet — fiche du navire (état · postes · rôles)', () => {
  it('ShipStateBlock : coque, cap, Moral, effectif', () => {
    const crew = [mk('Anna', 60, [{ id: 'voile', advances: 30 }], 'timonier')];
    const ship = { id: 'ship', label: 'La Cogue', wounds: { current: 40, max: 50 }, conditions: [] } as unknown as Combatant;
    const html = renderToStaticMarkup(<ShipStateBlock ship={ship} cap="N" morale={75} crew={crew} />);
    expect(html).toContain('40/50'); // coque
    expect(html).toContain('Nord');  // cap
    expect(html).toContain('1/1');   // effectif apte/total
  });

  it('PosteDetail : le poste sélectionné affiche son bord + son nom + son servant', () => {
    const soldat = mk('Soldat', 50, [{ id: 'projectiles', advances: 20, spec: 'poudre-noire' }]);
    const ship = { id: 'ship', label: 'La Cogue', conditions: [] } as unknown as Combatant;
    const html = renderToStaticMarkup(<PosteDetail hull={ship} poste={poste('Pierrier', 'p1', 'tribord', ['Soldat'])} combatants={[ship, soldat]} />);
    expect(html).toContain('Tribord');
    expect(html).toContain('Pierrier');
    expect(html).toContain('Soldat');
  });

  it('PosteDetail : poste sans servant → « sans servant »', () => {
    const ship = { id: 'ship', label: 'La Cogue', conditions: [] } as unknown as Combatant;
    const html = renderToStaticMarkup(<PosteDetail hull={ship} poste={poste('Couleuvrine', 'p2', 'babord', [])} combatants={[ship]} />);
    expect(html).toContain('Bâbord');
    expect(html).toContain('— sans servant —');
  });

  it('PosteDetail : le détail change avec le poste sélectionné (maître-détail)', () => {
    const ship = { id: 'ship', label: 'La Cogue', conditions: [] } as unknown as Combatant;
    // Le plan/les puces choisissent LE poste ; PosteDetail n'affiche QUE celui-là.
    const p1 = renderToStaticMarkup(<PosteDetail hull={ship} poste={poste('Pierrier', 'p1', 'tribord', [])} combatants={[ship]} />);
    const p2 = renderToStaticMarkup(<PosteDetail hull={ship} poste={poste('Couleuvrine', 'p2', 'babord', [])} combatants={[ship]} />);
    expect(p1).toContain('Pierrier');
    expect(p1).not.toContain('Couleuvrine');
    expect(p2).toContain('Couleuvrine');
    expect(p2).not.toContain('Pierrier');
  });

  // Ce qui est « chargé » = la munition CAPTURÉE au chargement (`loadedAmmoUid`), jamais la sélection du
  // sélecteur — celle-ci dit « à charger au prochain rechargement ».
  it('PosteDetail readOnly (#240) : la munition CHARGÉE est montrée SANS sélecteur (pas d’édition de la pièce d’autrui)', () => {
    const ship = { id: 'ship', label: 'Le Serpent', conditions: [] } as unknown as Combatant;
    const p: Poste = { item: { label: 'Baliste', uid: 'p1' }, side: 'tribord', loaded: true, loadedAmmoUid: 'a1',
      ammoUid: 'a2', ammo: [{ uid: 'a1', label: 'Boulet', qty: 8 }, { uid: 'a2', label: 'Mitraille', qty: 4 }] } as unknown as Poste;
    const rw = renderToStaticMarkup(<PosteDetail hull={ship} poste={p} combatants={[ship]} />);
    const ro = renderToStaticMarkup(<PosteDetail hull={ship} poste={p} combatants={[ship]} readOnly />);
    expect(rw).toContain('<select'); // éditable côté allié
    // La LÉGENDE du sélecteur est à l'écran, pas seulement en infobulle : sans elle, rien ne distingue
    // « ce qui sera chargé » de « ce qui est dans la pièce ».
    expect(rw).toContain('Munition à charger');
    expect(rw.replace(/title="[^"]*"/g, '')).toContain('Munition à charger'); // hors attribut `title`
    expect(ro).not.toContain('<select'); // lecture seule : pas de contrôle
    expect(ro).toContain('Boulet'); // le coup CHARGÉ, pas la sélection à venir (Mitraille)
  });

  it('PosteDetail : une pièce DÉCHARGÉE le dit (aucune munition n’est présentée comme chargée)', () => {
    const ship = { id: 'ship', label: 'Le Serpent', conditions: [] } as unknown as Combatant;
    const p: Poste = { item: { label: 'Baliste', uid: 'p1' }, side: 'tribord', loaded: false, ammoUid: 'a1',
      ammo: [{ uid: 'a1', label: 'Boulet', qty: 8 }] } as unknown as Poste;
    const ro = renderToStaticMarkup(<PosteDetail hull={ship} poste={p} combatants={[ship]} readOnly />);
    expect(ro).toContain('déchargée');
    expect(ro).not.toContain('Boulet');
  });
});

describe('ShipInspectBody — inspection en LECTURE d’une coque ennemie (#240)', () => {
  type Poste = NonNullable<Combatant['postes']>[number];
  // Le Serpent de Sel : raider de classe loup-imperial (ship.traits : bélier/renforcé/solide) portant la
  // Proue-idole de Stromfels (Amélioration d’INSTANCE, #221) sur `upgrades`.
  const serpent = {
    id: 'serpent', label: 'Le Serpent de Sel', kind: 'npc', bodyShape: 'vehicule',
    creatureId: 'loup-imperial', conditions: [], wounds: { current: 60, max: 80 },
    upgrades: [{ id: 'proue-idole-de-stromfels' }],
    postes: [{ item: { label: 'Baliste', uid: 'p1' }, side: 'tribord', crewIds: [] } as unknown as Poste],
  } as unknown as Combatant;

  it('Coque, cap, gréement + postes visibles', () => {
    const html = renderToStaticMarkup(<ShipInspectBody hull={serpent} crew={[]} cap="NE" />);
    expect(html).toContain('Coque');
    expect(html).toContain('60/80');
    expect(html).toContain('Nord-Est'); // cap
    expect(html).toContain('Mixte'); // gréement du loup-imperial
    expect(html).toContain('Baliste'); // poste apparent
    expect(html).toContain('Tribord');
  });

  it('Traits du TYPE + Améliorations d’INSTANCE listés — la Proue-idole de Stromfels apparaît (#221)', () => {
    const html = renderToStaticMarkup(<ShipInspectBody hull={serpent} crew={[]} cap="NE" />);
    expect(html).toContain('Bélier'); // ship.traits du loup-imperial
    expect(html).toContain('Renforcé');
    expect(html).toContain('Solide');
    expect(html).toContain('Proue-idole de Stromfels'); // upgrade d’instance
  });

  it('Moral d’équipage ABSENT (résolve interne, non visible d’une coque ennemie)', () => {
    const html = renderToStaticMarkup(<ShipInspectBody hull={serpent} crew={[]} cap="NE" />);
    expect(html).not.toContain('Moral');
  });
});
