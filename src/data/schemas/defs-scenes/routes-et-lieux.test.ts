/**
 * #2968 L13 — les extrémités d'une route (`a`, `b`), son sens unique (`from`) et le départ d'un billet (`depuis`)
 * désignent un lieu par `ref(portee)` : `{ id }` jugé au parse contre la collection `places` de la MÊME carte, que
 * `worldMapSchema` ouvre (`ouvrirPortees`) ; la suite d'un billet, des routes de la même carte par `refs(portee)`.
 * Fixtures : référence connue, inconnue, écrite en id nu, d'une portée ÉTRANGÈRE (un lieu d'un autre projet),
 * liste, et portée locale.
 */
import { describe, expect, it } from 'vitest';
import { routePerilSchema, worldMapSchema } from './worldmap';
import { DIALOGUES_DE_LA_SCENE } from './communs';
import { idsDeLaPortee } from '../grammaire/collection-cle';
import { mesureDuParse } from '../grammaire/ref';
import { IDS_PAR_ESPACE } from '../_ids.generated';
import areneProjet from '../../../scenes/arene/arene-projet.json';
import bargeDuSelProjet from '../../../scenes/barge-du-sel/barge-du-sel-projet.json';
import diligenceProjet from '../../../scenes/diligence/diligence-projet.json';
import loupEtSaumureProjet from '../../../scenes/loup-et-saumure/loup-et-saumure-projet.json';

type Carte = typeof diligenceProjet.worldMap;

/** Rangs des routes de la diligence : la première porte le billet et sa suite, la dernière n'en porte aucun. */
const BILLETTEE = 0;
const LIBRE = 2;

const messages = (carte: unknown): string[] => {
  const r = worldMapSchema.safeParse(carte);
  expect(r.success, 'la carte a parsé alors qu’elle devait être REFUSÉE').toBe(false);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`);
};

/** La carte de la diligence, retouchée par `retouche` sur une copie. */
const carte = (retouche: (copie: Carte) => void): Carte => {
  const copie = structuredClone(diligenceProjet.worldMap);
  retouche(copie);
  return copie;
};

const billet = (c: Carte) => c.routes[BILLETTEE].billets!.diligence;

const LIEUX = 'lieux de la carte';
const PORTEURS = [
  {
    porteur: 'worldMap.routes[].a', chemin: `routes.${LIBRE}.a`, connue: 'auberge-des-sept-rayons',
    avec: (v: unknown) => carte((c) => Object.assign(c.routes[LIBRE], { a: v })),
  },
  {
    porteur: 'worldMap.routes[].b', chemin: `routes.${LIBRE}.b`, connue: 'la-diligence',
    avec: (v: unknown) => carte((c) => Object.assign(c.routes[LIBRE], { b: v })),
  },
  {
    porteur: 'worldMap.routes[].from', chemin: `routes.${LIBRE}.from`, connue: 'auberge-des-sept-rayons',
    avec: (v: unknown) => carte((c) => Object.assign(c.routes[LIBRE], { from: v })),
  },
  {
    porteur: 'worldMap.routes[].billets{}.depuis', chemin: `routes.${BILLETTEE}.billets.diligence.depuis`, connue: 'la-diligence',
    avec: (v: unknown) => carte((c) => Object.assign(billet(c), { depuis: v })),
  },
];

describe('#2968 L13 — routes et lieux de la carte désignés par `ref(portee)`', () => {
  it('les cartes réelles parsent, et leurs références sont des slots `local:places` / `local:routes` au parse de mesure', () => {
    const compte = (projet: { worldMap: unknown }) => {
      expect(worldMapSchema.safeParse(projet.worldMap).success).toBe(true);
      const reperes = mesureDuParse(worldMapSchema, projet.worldMap).reperes;
      return [reperes.filter((r) => r.type === 'local:places').length, reperes.filter((r) => r.type === 'local:routes').length];
    };
    expect(compte(areneProjet)).toEqual([4 + 4, 0]);
    expect(compte(bargeDuSelProjet)).toEqual([1 + 1, 0]);
    expect(compte(diligenceProjet)).toEqual([3 + 3 + 3, 1]);
    expect(compte(loupEtSaumureProjet)).toEqual([2 + 2 + 2, 0]);
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ avec, connue }) => {
    expect(worldMapSchema.safeParse(avec({ id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée à son path, sa collection et son id nommés', ({ avec, chemin }) => {
    expect(messages(avec({ id: 'lieu-inexistant' }))).toContain(
      `${chemin}.id « lieu-inexistant » est absent du catalogue des ${LIEUX} (collection « places » du document).`,
    );
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ avec, connue }) => {
    expect(worldMapSchema.safeParse(avec(connue)).success).toBe(false);
  });

  it.each(PORTEURS)('$porteur : le lieu d’un AUTRE projet est refusé', ({ avec }) => {
    expect(messages(avec({ id: 'salzenmund' })).join(' ')).toContain(`« salzenmund » est absent du catalogue des ${LIEUX}`);
  });

  describe('worldMap.routes[].billets{}.suite : liste de routes (`refs(portee)`)', () => {
    const avecSuite = (suite: unknown) => carte((c) => Object.assign(billet(c), { suite }));

    it('une suite de routes connues parse', () => {
      expect(worldMapSchema.safeParse(avecSuite(['route-route-principale-sept-rayons', 'route-sept-rayons-altdorf'])).success).toBe(true);
    });

    it('une route inconnue ou d’un autre projet est refusée à son rang, seule faute', () => {
      expect(messages(avecSuite(['route-route-principale-sept-rayons', 'route-salzenmund-erengrad-aller']))).toEqual([
        `routes.${BILLETTEE}.billets.diligence.suite.1 « route-salzenmund-erengrad-aller » est absent du catalogue des routes de la carte (collection « routes » du document).`,
      ]);
    });

    it('une route écrite en `{ id }` est refusée', () => {
      expect(worldMapSchema.safeParse(avecSuite([{ id: 'route-route-principale-sept-rayons' }])).success).toBe(false);
    });
  });

  it('la portée est LOCALE : un lieu ajouté à la carte est désignable, un lieu retiré ne l’est plus', () => {
    const ajoute = carte((c) => {
      c.places.push({ ...structuredClone(c.places[0]), id: 'lieu-neuf', label: 'Lieu neuf' });
      Object.assign(c.routes[LIBRE], { b: { id: 'lieu-neuf' } });
    });
    expect(worldMapSchema.safeParse(ajoute).success).toBe(true);
    const sansAltdorf = carte((c) => {
      c.places = c.places.filter((p) => p.id !== 'altdorf');
    });
    expect(messages(sansAltdorf)).toContain(`routes.${LIBRE}.b.id « altdorf » est absent du catalogue des ${LIEUX} (collection « places » du document).`);
  });

  it('un id local n’entre dans aucun espace de l’INDEX DES IDS', () => {
    expect(Object.keys(IDS_PAR_ESPACE).filter((c) => /worldMap|places|routes/.test(c))).toEqual([]);
  });
});

describe('`routePerilSchema` — un péril de route n’a pas de scène : il en ouvre les portées VIDES (`ouvrirPortees`, source `\'vide\'`)', () => {
  const avecPeril = (effet: unknown) => carte((c) => Object.assign(c.routes[LIBRE], { perils: [{ label: 'Péripétie', chancePct: 10, effects: [effet] }] }));
  const ouvrir = { type: 'startDialogue', dialogue: { id: 'dlg' } };
  const differe = (effet: unknown) => ({ type: 'delayedEffect', afterMinutes: 5, flow: { kind: 'effet', effet } });
  const journal = { type: 'journal', desc: 'Un colporteur partage la route.' };

  it('un `startDialogue` est absent du catalogue, au premier niveau du péril comme sous un `delayedEffect`', () => {
    expect(messages(avecPeril(ouvrir))).toEqual([`routes.${LIBRE}.perils.0.effects.0.dialogue.id « dlg » est absent du catalogue des dialogues de la scène (collection « dialogues » du document).`]);
    expect(messages(avecPeril(differe(ouvrir)))).toEqual([`routes.${LIBRE}.perils.0.effects.0.flow.effet.dialogue.id « dlg » est absent du catalogue des dialogues de la scène (collection « dialogues » du document).`]);
  });

  it('un `startCombat` est absent du catalogue des rencontres : un péril n’a aucune rencontre de scène (#3606 M4a)', () => {
    expect(messages(avecPeril({ type: 'startCombat', encounter: { id: 'enc-brigands' } }))).toEqual([`routes.${LIBRE}.perils.0.effects.0.encounter.id « enc-brigands » est absent du catalogue des rencontres de la scène (collection « encounters » du document).`]);
  });

  it('un effet sans référence locale parse, au premier niveau comme sous un `delayedEffect`', () => {
    expect(worldMapSchema.safeParse(avecPeril(journal)).success).toBe(true);
    expect(worldMapSchema.safeParse(avecPeril(differe(journal))).success).toBe(true);
  });

  it('l’offre d’une référence locale dans un péril est vide, par la lecture du parse (`idsDeLaPortee`)', () => {
    const peril = { label: 'Péripétie', chancePct: 10, effects: [ouvrir] };
    expect(idsDeLaPortee(routePerilSchema, peril, DIALOGUES_DE_LA_SCENE)).toEqual([]);
  });
});
