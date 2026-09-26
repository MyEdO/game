import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { schema as propsSchema } from './schemas/defs/props';
import { PROPS_VOLUMIQUES } from './schemas/_ids.generated';
import { props, matieresDe, findPropMaterialById, findPropById } from './index';
import { aretesNonAppariees, CAP_IDENTITE_PROP, empreinteDeriveeDuProp, placesLocalesDuProp, polygonesDePrimitive, sommetLocal, validatePropCatalog, type PropData, type PropPrimitive } from './props.types';
import { sceneMetresPerTile } from '../state/scene';

/** Les polygones LOCAUX d'une primitive, réduits aux triplets que mesure `aretesNonAppariees` : la
 *  fermeture est TOPOLOGIQUE, elle ignore le repère — c'est l'appelant qui DIT lequel il mesure. */
const sommetsLocaux = (p: PropPrimitive) => polygonesDePrimitive(p).map((poly) => poly.map(sommetLocal));

const propFixture = (patch: Partial<PropData>): PropData => ({ id: 'x', type: 'props', label: 'X d’épreuve', solid: true, ...patch });

/** L'ÉCHELLE à laquelle ce catalogue est jugé : le défaut du monde (`LDB 15 l.12`), LU à sa source
 *  unique et jamais réécrit — depuis #1509 l'empreinte effective d'un décor à recette en dépend. */
const MPT = sceneMetresPerTile(undefined);

/** La plus petite recette BIEN FORMÉE : ce que des places assises exigent pour entrer au parse. */
const RECETTE_MINIMALE = { capIdentite: 'S', primitives: [{ kind: 'box', center: { xM: 0, yM: 0, hM: 0.5 }, size: { xM: 1, yM: 1, hM: 1 }, material: 'bois-chene' }] };

describe('props.json — formes strictes de la recette volumique et des places assises', () => {
  it('refuse une primitive inconnue, un matériau absent et un matériau d’un AUTRE domaine — au PARSE', () => {
    // Le `type` d'enveloppe est POSÉ sur chaque sonde négative : sans lui, elles sortiraient rouges
    // pour un `type` manquant et ne mordraient plus la forme qu'elles visent.
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [{ kind: 'sphere' }] } }])).toThrow();
    const avecMatiere = (material: string) => [{
      id: 'x', type: 'props', label: 'X d’épreuve',
      volume: { capIdentite: 'S', primitives: [{ kind: 'box', center: { xM: 0, yM: 0, hM: 0.5 }, size: { xM: 1, yM: 1, hM: 1 }, material }] },
    }];
    // La RÉFÉRENCE est tenue par le SCHÉMA (`idDe('material', 'prop')`) : un id absent du document…
    expect(() => propsSchema.parse(avecMatiere('absent'))).toThrow(/absent/);
    // …et un id BIEN PRÉSENT mais d'un AUTRE domaine (`tuile` couvre un toit) sont refusés tous deux,
    // nommément — c'est ce que la sous-liste discriminée achète sur un simple `z.string()`.
    expect(() => propsSchema.parse(avecMatiere('tuile'))).toThrow(/tuile/);
    expect(() => propsSchema.parse(avecMatiere('bois-chene'))).not.toThrow();
  });

  it('accepte une recette et des places assises bien formées', () => {
    expect(() => propsSchema.parse([{
      id: 'x',
      type: 'props',
      label: 'X d’épreuve',
      solid: true,
      volume: {
        capIdentite: 'S',
        primitives: [
          { kind: 'box', center: { xM: 0, yM: 0, hM: 0.4 }, size: { xM: 1.6, yM: 0.8, hM: 0.08 }, material: 'bois-chene' },
          { kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.2 }, axis: 'h', radiusM: 0.06, longueurM: 0.4, sides: 8, material: 'fer-noirci' },
          { kind: 'prism', center: { xM: 0, yM: 0, hM: 0.9 }, size: { xM: 1, yM: 0.6, hM: 0.3 }, slope: 'y+', material: 'pierre-atre' },
        ],
      },
      seatSlots: [{ id: 'place-1', anchor: { xM: 0, yM: -0.35, hM: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } }],
    }])).not.toThrow();
  });

  /**
   * `foot` EST LA VÉRITÉ D'UN BILLBOARD, ET DE LUI SEUL (#1509). Les cases d'un décor à recette se
   * dérivent de son corps tourné (`empreinteDeriveeDuProp`) : un `foot` posé à côté d'une recette
   * n'est lu par personne, et ment au premier cap E/O — le `foot` ne tourne pas, l'empreinte si. Le
   * refus est À L'ENTRÉE, sans quoi le champ mort reviendrait par le prochain authoring.
   */
  it('refuse un `foot` sur une recette volumique, et l’accepte sur un billboard', () => {
    const billboard = { id: 'x', type: 'props', label: 'X d’épreuve', foot: { w: 2, h: 1 } };
    const echec = propsSchema.safeParse([{ ...billboard, volume: RECETTE_MINIMALE }]);
    expect(echec.success).toBe(false);
    // Le message NOMME l'entrée et la raison — un refus muet n'apprendrait rien à l'auteur.
    expect(JSON.stringify(echec.error?.issues)).toContain('x : `foot` sur une recette volumique');
    // Un BILLBOARD au MÊME `foot` entre sans discuter : c'est bien la CO-PRÉSENCE qui est refusée.
    expect(propsSchema.safeParse([billboard]).success).toBe(true);
  });

  /** PLACES SANS RECETTE : `data/props.types.ts`, CAP D'IDENTITÉ. */
  it('refuse des places assises sur un billboard, et les accepte sur une recette volumique', () => {
    const billboard = {
      id: 'x', type: 'props', label: 'X d’épreuve',
      seatSlots: [{ id: 'place-1', anchor: { xM: 0, yM: -0.35, hM: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } }],
    };
    expect(propsSchema.safeParse([{ ...billboard, volume: RECETTE_MINIMALE }]).success, 'places + recette').toBe(true);
    const echec = propsSchema.safeParse([billboard]);
    expect(echec.success, 'places sans recette').toBe(false);
    expect(JSON.stringify(echec.error?.issues)).toContain('x : places assises sans recette volumique');
  });

  it('refuse une face de cylindre hors barème et une pente inconnue', () => {
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [{ kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.2 }, axis: 'h', radiusM: 0.1, longueurM: 0.4, sides: 10, material: 'fer-noirci' }] } }])).toThrow();
    // 12 côtés : quatre normales latérales à ±45°, l'arête de couteau du modelé de forme (#1680 ligne 9).
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [{ kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.2 }, axis: 'h', radiusM: 0.1, longueurM: 0.4, sides: 12, material: 'fer-noirci' }] } }])).toThrow();
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [{ kind: 'prism', center: { xM: 0, yM: 0, hM: 0.2 }, size: { xM: 1, yM: 1, hM: 1 }, slope: 'z+', material: 'bois-chene' }] } }])).toThrow();
  });

  /**
   * REPÈRE DÉCLARÉ (#1680 ligne 16) : `capIdentite` est le marqueur qui dit dans quel repère la
   * géométrie est écrite. Il est REQUIS — une recette mutée sous l'ancien repère (`N`) ou sans repère
   * du tout ne peut pas entrer, et c'est aussi ce qui rend la migration `2026-09-02-1680-cap-identite-
   * sud.mjs` idempotente : une rotation de 180° est sa propre inverse, aucune FORME ne la distingue.
   */
  /**
   * ID DE PLACE SANS CÔTÉ (#1680 ligne 16) : la clé d'une place porte son RANG, jamais un point
   * cardinal ni une main — un id cardinal ment dès que le repère de la recette bouge, et le côté est
   * déjà porté par `anchor`/`facing`/`approach`, qui tournent avec le cap de l'instance.
   */
  it('refuse un id de place qui porte un CÔTÉ', () => {
    const place = (id: string) => [{
      id: 'x', type: 'props', label: 'X d’épreuve', volume: RECETTE_MINIMALE,
      seatSlots: [{ id, anchor: { xM: 0, yM: -0.35, hM: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } }],
    }];
    for (const cote of ['place-nord', 'place-sud', 'place-est', 'place-ouest', 'place-gauche', 'place-droite'])
      expect(propsSchema.safeParse(place(cote)).success, cote).toBe(false);
    expect(propsSchema.safeParse(place('nord')).success, 'sans le préfixe').toBe(false);
    expect(propsSchema.safeParse(place('place-1')).success, 'place-1').toBe(true);
    expect(propsSchema.safeParse(place('place-12')).success, 'place-12').toBe(true);
  });

  /**
   * UNITÉ DÉCLARÉE (#1507) — une recette est en MÈTRES, et c'est la GRAPHIE des clés qui le dit :
   * `xM`/`yM`/`hM`, `radiusM`. Le verrou est le `z.strictObject` du schéma, SANS alias : une recette
   * restée en cases (`x`/`y`/`h`, `radius`) n'entre pas — c'est ce qui rend impossible de relire une
   * ancienne cote comme une cote métrique, et de la voir doubler en silence.
   */
  it('refuse une cote de recette en CASES (`x`/`y`/`h`, `radius`) — pas d’alias, c’est le verrou d’unité', () => {
    const recette = (primitives: unknown[]) => [{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives } }];
    const metrique = { kind: 'box', center: { xM: 0, yM: 0, hM: 0.5 }, size: { xM: 1, yM: 1, hM: 1 }, material: 'bois-chene' };
    expect(propsSchema.safeParse(recette([metrique])).success, 'la forme MÉTRIQUE entre').toBe(true);
    expect(propsSchema.safeParse(recette([{ ...metrique, center: { x: 0, y: 0, h: 0.5 } }])).success, 'centre en cases').toBe(false);
    expect(propsSchema.safeParse(recette([{ ...metrique, size: { x: 1, y: 1, h: 1 } }])).success, 'dimensions en cases').toBe(false);
    // …et une cote de plus, ajoutée « en douce » à côté de la métrique, ne passe pas davantage.
    expect(propsSchema.safeParse(recette([{ ...metrique, center: { xM: 0, yM: 0, hM: 0.5, x: 0 } }])).success, 'les deux graphies').toBe(false);
    const cylindre = { kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.5 }, axis: 'h', longueurM: 1, sides: 8, material: 'fer-noirci' };
    expect(propsSchema.safeParse(recette([{ ...cylindre, radiusM: 0.3 }])).success, '`radiusM`').toBe(true);
    expect(propsSchema.safeParse(recette([{ ...cylindre, radius: 0.3 }])).success, '`radius` en cases').toBe(false);
    // L'ANCRE d'une place suit la même règle ; son APPROCHE, elle, reste un offset de CASE.
    const place = (anchor: unknown) => [{
      id: 'x', type: 'props', label: 'X d’épreuve', volume: RECETTE_MINIMALE,
      seatSlots: [{ id: 'place-1', anchor, facing: 'S', approach: { x: 0, y: -1 } }],
    }];
    expect(propsSchema.safeParse(place({ xM: 0, yM: -0.7, hM: 0.48 })).success, 'ancre métrique').toBe(true);
    expect(propsSchema.safeParse(place({ x: 0, y: -0.35, h: 0.48 })).success, 'ancre en cases').toBe(false);
  });

  /** La POPULATION livrée le respecte : aucune cote de plan hors des clés à suffixe `M`. */
  it('le catalogue RÉEL n’écrit plus une seule cote en cases', () => {
    const brut = JSON.parse(readFileSync(new URL('./props.json', import.meta.url), 'utf8')) as unknown[];
    const fautes: string[] = [];
    const CLES_MORTES = new Set(['x', 'y', 'h', 'radius', 'radiusTiles']);
    // Deux champs comptent des CASES et non des mètres — ils gardent donc leurs noms nus, et tout ce
    // qui vit dessous avec eux : `approach` (offset de case voisine d'une place) et `foot` (empreinte
    // de grille, `w`×`h` en cases).
    const EN_CASES = new Set(['approach', 'foot']);
    const parcours = (n: unknown, chemin: string, sousCases: boolean) => {
      if (Array.isArray(n)) return n.forEach((v, i) => parcours(v, `${chemin}[${i}]`, sousCases));
      if (!n || typeof n !== 'object') return;
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
        const dansCases = sousCases || EN_CASES.has(k);
        if (!dansCases && CLES_MORTES.has(k)) fautes.push(`${chemin}.${k}`);
        parcours(v, `${chemin}.${k}`, dansCases);
      }
    };
    parcours(brut, 'props.json', false);
    expect(brut.length, 'catalogue vide : ce contrat mesurerait du néant').toBeGreaterThan(100);
    expect(fautes).toEqual([]);
  });

  it('refuse une recette SANS repère déclaré, et une recette restée au repère `N`', () => {
    const recette = (volume: unknown) => [{ id: 'x', type: 'props', label: 'X d’épreuve', volume }];
    const primitives = [{ kind: 'box', center: { xM: 0, yM: 0, hM: 0.5 }, size: { xM: 1, yM: 1, hM: 1 }, material: 'bois-chene' }];
    expect(propsSchema.safeParse(recette({ primitives })).success, 'sans `capIdentite`').toBe(false);
    expect(propsSchema.safeParse(recette({ capIdentite: 'N', primitives })).success, 'repère `N`').toBe(false);
    expect(propsSchema.safeParse(recette({ capIdentite: 'S', primitives })).success, 'repère `S`').toBe(true);
  });
});

describe('validatePropCatalog — invariants de données du décor', () => {
  it('refuse dimensions non positives, nombres non finis et slots ambigus', () => {
    const bad = propFixture({
      volume: { capIdentite: 'S', primitives: [{ kind: 'box', center: { xM: 0, yM: 0, hM: 0 }, size: { xM: 0, yM: 1, hM: 1 }, material: 'bois-chene' }] },
      seatSlots: [
        { id: 'place-1', anchor: { xM: 0, yM: -0.35, hM: 0.48 }, facing: 'S', approach: { x: 0, y: 1 } },
        { id: 'place-1', anchor: { xM: 0.3, yM: 0, hM: 0.48 }, facing: 'O', approach: { x: 0, y: 1 } },
      ],
    });
    expect(validatePropCatalog([bad], MPT)).toEqual(expect.arrayContaining([
      expect.stringContaining('dimension non positive'),
      expect.stringContaining('slot dupliqué « place-1 »'),
    ]));
    // …et PAS d'anomalie d'abord : ces deux places tombent dans la MÊME case de siège (0,0) à
    // 2 m/case, donc leur abord commun ne désigne qu'un siège — rien à départager (contrat suivant).
    expect(validatePropCatalog([bad], MPT).filter((m) => m.includes('abord'))).toEqual([]);
  });

  /**
   * ABORD AMBIGU — la règle UNIQUE que le catalogue tient sur les abords, et elle porte sur ce que la
   * case désigne : un abord qui dessert DEUX SIÈGES DISTINCTS ne dit plus où l'on s'assoit. Deux places
   * qui s'effondrent dans la MÊME case de siège sont légitimes — c'est l'état de TOUT meuble à N places
   * aux échelles grossières (10 m/case, la barge du sel et le Loup & Saumure) — et `state/seating.ts`
   * les sert l'une après l'autre (contrat `seating-abord-effondre.test.ts`). La règle précédente, qui
   * refusait tout abord RÉPÉTÉ, interdisait ces meubles-là dès qu'une scène les posait à 10 m/case.
   */
  it('l’abord n’est AMBIGU que s’il dessert deux sièges distincts — deux places d’une même case ne le sont pas', () => {
    // MORSURE : deux sièges dans DEUX cases distinctes de l'empreinte 2×1, un seul et même abord
    // résolu (1,-1) — le pas qui mène là ne dit plus sur laquelle des deux on s'assoit.
    const ambigu = propFixture({
      foot: { w: 2, h: 1 },
      seatSlots: [
        { id: 'gauche', anchor: { xM: -1, yM: 0, hM: 0.48 }, facing: 'S', approach: { x: 1, y: -1 } },
        { id: 'droite', anchor: { xM: 1, yM: 0, hM: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } },
      ],
    });
    expect(validatePropCatalog([ambigu], MPT))
      .toEqual(['x: abord AMBIGU (1,-1) — il dessert deux sièges distincts, (0,0) et (1,0)']);

    // TÉMOIN : les MÊMES deux places, une case chacune, chacune SON abord — rien à signaler.
    const distinctes = propFixture({
      foot: { w: 2, h: 1 },
      seatSlots: [
        { id: 'gauche', anchor: { xM: -1, yM: 0, hM: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } },
        { id: 'droite', anchor: { xM: 1, yM: 0, hM: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } },
      ],
    });
    expect(validatePropCatalog([distinctes], MPT)).toEqual([]);

    // EFFONDREMENT, sur la donnée RÉELLE : à 10 m/case le corps de la table murale tient sur UNE case,
    // ses deux places y tombent ensemble et partagent leur abord — aucun siège à départager, donc
    // aucune anomalie. C'est l'état que les scènes à 10 m/case donnent à TOUT meuble à N places.
    const murale = findPropById('table-murale-2-tabourets')!;
    expect(placesLocalesDuProp(murale, CAP_IDENTITE_PROP, 10).map((pl) => `${pl.siege.x},${pl.siege.y}|${pl.abord.x},${pl.abord.y}`))
      .toEqual(['0,0|0,-1', '0,0|0,-1']);
    expect(validatePropCatalog([murale], 10)).toEqual([]);
  });

  it('distingue un slot SANS id d’un slot DUPLIQUÉ (deux causes, deux messages)', () => {
    const sansId = propFixture({ seatSlots: [{ id: '  ', anchor: { xM: 0, yM: -0.35, hM: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } }] });
    expect(validatePropCatalog([sansId], MPT)).toEqual(['x: slot sans id']);
  });

  it('refuse une coordonnée non finie, sur une boîte comme sur un cylindre', () => {
    const boite = propFixture({ volume: { capIdentite: 'S', primitives: [{ kind: 'box', center: { xM: Number.NaN, yM: 0, hM: 0.5 }, size: { xM: 1, yM: 1, hM: 1 }, material: 'bois-chene' }] } });
    const cylindre = propFixture({ volume: { capIdentite: 'S', primitives: [{ kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.5 }, axis: 'h', radiusM: Number.POSITIVE_INFINITY, longueurM: 1, sides: 16, material: 'fer-noirci' }] } });
    expect(validatePropCatalog([boite], MPT)).toContain('x: coordonnée non finie');
    expect(validatePropCatalog([cylindre], MPT)).toContain('x: coordonnée non finie');
  });

  /**
   * L'abord est jugé sur la case que le RUNTIME posera (`placesLocalesDuProp`) : celle du SIÈGE, plus
   * `approach`. Sur une empreinte 2×1 le siège n'est pas le coin NO — l'ancre du décor est à une
   * demi-case de lui —, donc c'est le SENS de l'approche qui décide, pas sa distance au coin. Jugé
   * dans un repère à part, le validateur admettait `(-1,0)`, qui tombe sur le meuble, et refusait
   * `(1,0)`, qui en sort.
   */
  it('refuse une approche qui tombe DANS l’empreinte d’un décor solide — empreinte 2×1 comprise', () => {
    const unSurUn = propFixture({ seatSlots: [{ id: 'place-1', anchor: { xM: 0, yM: 0, hM: 0.48 }, facing: 'S', approach: { x: 0, y: 0 } }] });
    expect(validatePropCatalog([unSurUn], MPT))
      .toContain('x: approche « place-1 » (0,0) tombe sur la case (0,0) de l’empreinte 1×1 à 2 m/case');

    // Siège en (1,0) — la seconde case de l'empreinte : l'approche qui revient vers le coin NO tombe
    // sur la première, donc sur le meuble.
    const versLeMeuble = propFixture({
      foot: { w: 2, h: 1 },
      seatSlots: [{ id: 'place-1', anchor: { xM: 1, yM: 0, hM: 0.48 }, facing: 'O', approach: { x: -1, y: 0 } }],
    });
    expect(validatePropCatalog([versLeMeuble], MPT))
      .toContain('x: approche « place-1 » (-1,0) tombe sur la case (0,0) de l’empreinte 2×1 à 2 m/case');

    // …et l'approche qui s'en éloigne sort du meuble par sa case (2,0), quoique son offset soit le
    // même en valeur absolue.
    const degage = propFixture({
      foot: { w: 2, h: 1 },
      seatSlots: [{ id: 'place-1', anchor: { xM: 1, yM: 0, hM: 0.48 }, facing: 'O', approach: { x: 1, y: 0 } }],
    });
    expect(validatePropCatalog([degage], MPT)).toEqual([]);
  });

  it('refuse une recette dont le REPÈRE déclaré n’est pas celui qu’implémente `rotatePropLocal`', () => {
    const primitives: PropPrimitive[] = [{ kind: 'box', center: { xM: 0, yM: 0, hM: 0.5 }, size: { xM: 1, yM: 1, hM: 1 }, material: 'bois-chene' }];
    const auNord = propFixture({ volume: { capIdentite: 'N', primitives } as unknown as PropData['volume'] });
    expect(validatePropCatalog([auNord], MPT)).toContain('x: recette au repère « N » (seul S est implémenté)');
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives } })], MPT)).toEqual([]);
  });

  it('un décor NON solide se laisse aborder sur sa propre case', () => {
    const traversable = propFixture({ solid: false, seatSlots: [{ id: 'place-1', anchor: { xM: 0, yM: 0, hM: 0.48 }, facing: 'S', approach: { x: 0, y: 0 } }] });
    expect(validatePropCatalog([traversable], MPT)).toEqual([]);
  });

  /**
   * PROVENANCE PAR CHAMP (#1680 ligne 5) — `props.json` est exempté de provenance au DATASET
   * (`SANS_LIVRE` : c'est de l'art), mais trois de ses champs portent des concepts que le canon
   * chiffre : `light` (LDB 74 l.43/56/58), `cover` et `opaque` (LDB 14 l.72/81/86). Ce que ces
   * sondes mordent est l'ANGLE MORT que l'exemption ouvrait : une valeur de règle écrite sans dire
   * d'où elle vient, invisible de tout lecteur de provenance.
   */
  it.each(['light', 'cover', 'opaque'] as const)('refuse une entrée qui porte `%s` SANS provenance', (champ) => {
    const valeur = { light: { radiusM: 4 }, cover: 'moyenne', opaque: true }[champ];
    const nu = { id: 'x', type: 'props', label: 'X d’épreuve', solid: true, [champ]: valeur, ...(champ === 'opaque' ? { cover: 'totale' } : {}) };
    expect(() => propsSchema.parse([nu])).toThrow(/sans provenance/);
    // Les DEUX régimes passent : le folio quand il en existe un, l'arbitrage sinon.
    expect(() => propsSchema.parse([{ ...nu, maison: 'valeur maison d’épreuve' }])).not.toThrow();
    expect(() => propsSchema.parse([{ ...nu, source: { book: 'livre-de-base', page: 308 } }])).not.toThrow();
    // Un `maison` VIDE ne dit aucune raison : il ne vaut pas provenance.
    expect(() => propsSchema.parse([{ ...nu, maison: '' }])).toThrow(/sans provenance/);
  });

  it('un décor SANS champ de règle n’exige AUCUNE provenance (le document reste de l’art)', () => {
    // `solid` est un fait physique de l'objet : aucune table ne chiffre qu'un tonneau bloque le pas.
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', solid: true, foot: { w: 2, h: 1 } }])).not.toThrow();
  });

  /**
   * FOYER DÉCLARÉ (#1680 ligne 5) — la lumière d'un décor VOLUMIQUE se pose sur une primitive nommée,
   * jamais devinée. Les trois anomalies sont les trois façons dont `emet` et `light` se contredisent.
   */
  it('refuse DEUX primitives « emet » dans une même recette', () => {
    const deux = (emet: boolean): PropData => propFixture({
      light: { radiusM: 3 },
      volume: { capIdentite: 'S', primitives: [
        { kind: 'box', center: { xM: 0, yM: 0, hM: 0.2 }, size: { xM: 0.4, yM: 0.4, hM: 0.4 }, material: 'braises', emet: true },
        { kind: 'box', center: { xM: 0, yM: 0, hM: 0.8 }, size: { xM: 0.4, yM: 0.4, hM: 0.4 }, material: 'braises', ...(emet ? { emet: true } as const : {}) },
      ] },
    });
    expect(validatePropCatalog([deux(true)], MPT).join(' ')).toMatch(/2 primitives « emet » — une source ponctuelle n’a qu’UN foyer/);
    expect(validatePropCatalog([deux(false)], MPT)).toEqual([]);
  });

  it('refuse un foyer SANS source, et une source volumique SANS foyer', () => {
    const braises = (emet: boolean): PropPrimitive =>
      ({ kind: 'box', center: { xM: 0, yM: 0, hM: 0.2 }, size: { xM: 0.4, yM: 0.4, hM: 0.4 }, material: 'braises', ...(emet ? { emet: true } as const : {}) });
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives: [braises(true)] } })], MPT).join(' '))
      .toMatch(/primitive « emet » sans `light`/);
    expect(validatePropCatalog([propFixture({ light: { radiusM: 3 }, volume: { capIdentite: 'S', primitives: [braises(false)] } })], MPT).join(' '))
      .toMatch(/sans primitive « emet » — le foyer d’un volume se DÉCLARE/);
    // Un BILLBOARD qui éclaire (aucune recette) n'a pas de primitive où poser son foyer : il garde le
    // défaut nommé du rendu, et ce n'est pas une anomalie.
    expect(validatePropCatalog([propFixture({ light: { radiusM: 3 } })], MPT)).toEqual([]);
  });

  it('`emet: false` n’entre pas — l’absence dit déjà l’absence', () => {
    expect(() => propsSchema.parse([{
      id: 'x', type: 'props', label: 'X d’épreuve',
      volume: { capIdentite: 'S', primitives: [{ kind: 'box', center: { xM: 0, yM: 0, hM: 0.2 }, size: { xM: 1, yM: 1, hM: 1 }, material: 'braises', emet: false }] },
    }])).toThrow();
  });

  /**
   * ÉCHELLES EN USAGE — l'intégrité d'un catalogue dépend de l'ÉCHELLE depuis #1509 (l'empreinte
   * effective d'un décor à recette s'en déduit, et avec elle la case de chaque siège et de chaque
   * abord). Le juger à la seule échelle par défaut laisse passer ce qu'une scène LIVRÉE fait vraiment :
   * la barge du sel et le Loup & Saumure sont à 10 m/case, où tout meuble à N places tient sur une case.
   * La liste est DÉRIVÉE des documents (glob des `*-projet.json`) plus le défaut du monde — une scène
   * qui adopte une nouvelle échelle entre sous garde par sa seule déclaration.
   */
  const ECHELLES_EN_USAGE = (() => {
    const vues = new Set<number>([MPT]);
    const racine = new URL('../scenes/', import.meta.url);
    const projets = listerArbre(fileURLToPath(racine), {
      descendre: (rel) => !rel.includes('/'),
      filtre: (rel) => rel.includes('/') && rel.endsWith('-projet.json'),
    });
    for (const rel of projets) {
      const doc = JSON.parse(readFileSync(new URL(rel, racine), 'utf8')) as { scenes?: { metresPerTile?: number }[] };
      for (const sc of doc.scenes ?? []) if (typeof sc.metresPerTile === 'number') vues.add(sc.metresPerTile);
    }
    return [...vues].sort((a, b) => a - b);
  })();

  it('le catalogue RÉEL est intègre à CHAQUE échelle en usage dans les documents livrés', () => {
    // La liste est mesurée, pas écrite : si elle retombait à une seule échelle, ce contrat mesurerait seulement le défaut du monde — et c'est précisément le trou qu'il ferme.
    expect(ECHELLES_EN_USAGE.length, 'échelles en usage').toBeGreaterThan(1);
    expect(ECHELLES_EN_USAGE).toContain(MPT);
    const anomalies = ECHELLES_EN_USAGE.flatMap((mpt) => validatePropCatalog(props, mpt));
    expect(anomalies).toEqual([]);
  });
});

/**
 * EMPREINTE DÉRIVÉE — ce dont elle DÉPEND, et donc ce que sa mémoïsation doit distinguer (#1509).
 * Deux données la décident : la RECETTE (le corps mesuré) et les PLACES (ce qui en est exclu,
 * `placeAssiseDe`). Deux `PropData` peuvent partager la MÊME recette — un spread la recopie par
 * RÉFÉRENCE — et différer par leurs places : ils rendent alors des empreintes DIFFÉRENTES. Un cache
 * qui ne retiendrait que la recette servirait la valeur du premier appelant au second, en silence,
 * dans les DEUX ordres.
 *
 * La table ronde le montre en clair : ses quatre tabourets débordent du plateau, donc ils comptent
 * dans le corps dès qu'ils ne sont plus des sièges. Mesuré à 1 m/case, où l'écart est franc.
 */
describe('empreinte dérivée — la RECETTE et les PLACES la décident toutes les deux', () => {
  const ronde = findPropById('table-ronde-4-tabourets')!;

  it('une recette PARTAGÉE rend deux empreintes selon les places, dans les deux ordres d’appel', () => {
    // Deux paires, chacune sur une COPIE de la recette : la seconde part d'un cache froid, ce qui
    // mesure l'ordre INVERSE (sans elle, un cache fautif ne serait vu que dans un sens).
    const avecPlaces = { ...ronde, volume: { ...ronde.volume! } };
    const sansPlaces = { ...avecPlaces, seatSlots: [] };
    expect(sansPlaces.volume, 'la recette doit être PARTAGÉE : sinon ce contrat ne mesure aucun cache').toBe(avecPlaces.volume);
    expect(empreinteDeriveeDuProp(avecPlaces, 'S', 1), 'places d’abord : les tabourets sont exclus du corps').toEqual({ w: 2, h: 2 });
    expect(empreinteDeriveeDuProp(sansPlaces, 'S', 1), 'même recette, SANS place : les tabourets redeviennent du corps').toEqual({ w: 3, h: 3 });

    const froidSansPlaces = { ...ronde, volume: { ...ronde.volume! }, seatSlots: [] };
    const froidAvecPlaces = { ...froidSansPlaces, seatSlots: ronde.seatSlots };
    expect(empreinteDeriveeDuProp(froidSansPlaces, 'S', 1)).toEqual({ w: 3, h: 3 });
    expect(empreinteDeriveeDuProp(froidAvecPlaces, 'S', 1)).toEqual({ w: 2, h: 2 });
  });

  it('deux décors SANS place partagent bien leur entrée de cache (l’absence de place est UNE clé, pas N)', () => {
    // Sans jeu de places CANONIQUE, `?? []` fabriquerait une clé neuve par appel et le cache serait
    // mort pour tout le catalogue sans siège. Mesuré par l'IDENTITÉ du résultat, que seul un cache rend.
    const a = { ...ronde, volume: { ...ronde.volume! }, seatSlots: undefined };
    const b = { ...a };
    expect(empreinteDeriveeDuProp(b, 'S', 1)).toBe(empreinteDeriveeDuProp(a, 'S', 1));
  });
});

describe('FERMETURE — une primitive est une COQUILLE CLOSE', () => {
  const UNE_DE_CHAQUE: readonly (readonly [string, PropPrimitive])[] = [
    ['boîte', { kind: 'box', center: { xM: 0, yM: 0, hM: 0.5 }, size: { xM: 1, yM: 0.6, hM: 1 }, material: 'bois-chene' }],
    ['cylindre 8 debout', { kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.5 }, axis: 'h', radiusM: 0.3, longueurM: 1, sides: 8, material: 'fer-noirci' }],
    ['cylindre 16 debout', { kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.5 }, axis: 'h', radiusM: 0.3, longueurM: 1, sides: 16, material: 'fer-noirci' }],
    ['cylindre 8 couché est-ouest', { kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.3 }, axis: 'x', radiusM: 0.3, longueurM: 1, sides: 8, material: 'fer-noirci' }],
    ['cylindre 16 couché nord-sud', { kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.3 }, axis: 'y', radiusM: 0.3, longueurM: 0.1, sides: 16, material: 'fer-noirci' }],
    ['prisme', { kind: 'prism', center: { xM: 0, yM: 0, hM: 0.5 }, size: { xM: 1, yM: 0.8, hM: 1 }, slope: 'y+', material: 'pierre-atre' }],
  ];

  it.each(UNE_DE_CHAQUE)(
    '%s : chaque arête portée par exactement 2 faces, en sens opposés',
    (_nom, primitive) => {
      expect(aretesNonAppariees(sommetsLocaux(primitive))).toEqual([]);
    },
  );

  it('une coquille PERCÉE est nommée arête par arête (le prédicat ne rend pas `[]` par défaut)', () => {
    const [[, boite]] = UNE_DE_CHAQUE;
    const polys = sommetsLocaux(boite);
    expect(polys).toHaveLength(6);
    // Une face en moins : les 4 arêtes qu'elle portait ont un seul sens.
    const percée = aretesNonAppariees(polys.slice(1));
    expect(percée).toHaveLength(4);
    for (const { sens, contreSens } of percée) expect([sens, contreSens]).toEqual([1, 0]);
    expect(percée.map((d) => d.arete)).toContain('-0.5,-0.3,0→-0.5,-0.3,1');
  });

  it('le CATALOGUE réel ne porte aucune arête non appariée', () => {
    const primitives = props.flatMap((p) => p.volume?.primitives ?? []);
    expect(primitives.length, 'aucune primitive : ce contrat mesurerait du néant').toBeGreaterThan(100);
    expect(primitives.filter((p) => aretesNonAppariees(sommetsLocaux(p)).length > 0)).toEqual([]);
  });

  it('le validateur refuse un cylindre à 12 côtés arrivé par la DONNÉE (le JSON n’est pas typé à l’exécution)', () => {
    const douze = { kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.5 }, axis: 'h', radiusM: 0.3, longueurM: 1, sides: 12, material: 'fer-noirci' } as unknown as PropPrimitive;
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives: [douze] } })], MPT))
      .toEqual(['x: cylindre à 12 côtés (admis : 8 ou 16)']);
    const huit: PropPrimitive = { ...(douze as { kind: 'cylinder' } & PropPrimitive), sides: 8 };
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives: [huit] } })], MPT)).toEqual([]);
  });
});

/**
 * AXE DU CYLINDRE (#1343 lot C) — `axis` REQUIS, une valeur de `REPERE_D_AXE`, et la cote le long de
 * lui s'appelle `longueurM` : une seule graphie du cylindre vertical, aucune survivance de `heightM`.
 */
describe('AXE — un cylindre dit son axe, et un cylindre couché ne passe pas sous le sol', () => {
  const recette = (primitive: unknown) => [{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [primitive] } }];
  const debout = { kind: 'cylinder', center: { xM: 0, yM: 0, hM: 0.5 }, axis: 'h', radiusM: 0.3, longueurM: 1, sides: 8, material: 'fer-noirci' };

  it('le schéma exige `axis` parmi les clés de la table et refuse l’ancienne cote `heightM`', () => {
    expect(propsSchema.safeParse(recette(debout)).success, 'la forme REQUISE entre').toBe(true);
    for (const axis of ['x', 'y']) expect(propsSchema.safeParse(recette({ ...debout, axis })).success, `axe ${axis}`).toBe(true);
    const sansAxe = Object.fromEntries(Object.entries(debout).filter(([cle]) => cle !== 'axis'));
    expect(propsSchema.safeParse(recette(sansAxe)).success, 'sans axe').toBe(false);
    expect(propsSchema.safeParse(recette({ ...debout, axis: 'z' })).success, 'axe inconnu').toBe(false);
    const { longueurM, ...sansLongueur } = debout;
    expect(propsSchema.safeParse(recette({ ...sansLongueur, heightM: longueurM })).success, '`heightM`').toBe(false);
  });

  it('le validateur refuse un axe inconnu arrivé par la DONNÉE (le JSON n’est pas typé à l’exécution)', () => {
    const z = { ...debout, axis: 'z' } as unknown as PropPrimitive;
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives: [z] } })], MPT))
      .toEqual(['x: cylindre d’axe « z » (admis : h, x, y)']);
  });

  it.each(['x', 'y'] as const)('couché d’axe %s : admis centre à hauteur de rayon, refusé au-dessous', (axis) => {
    const roue = (hM: number): PropPrimitive => ({ kind: 'cylinder', center: { xM: 0, yM: 0, hM }, axis, radiusM: 0.54, longueurM: 0.06, sides: 16, material: 'fer-noirci' });
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives: [roue(0.54)] } })], MPT)).toEqual([]);
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives: [roue(0.5)] } })], MPT))
      .toEqual([expect.stringMatching(/^x: primitive cylinder « fer-noirci » — descend à -0\.04\d* m, sous le sol de sa case$/)]);
  });

  it('une primitive SOUS LE SOL garde une géométrie : l’empreinte et l’abord restent contrôlés', () => {
    const enfouie = propFixture({
      volume: { capIdentite: 'S', primitives: [{ kind: 'box', center: { xM: 0, yM: 0, hM: 0.2 }, size: { xM: 1, yM: 1, hM: 1 }, material: 'bois-chene' }] },
      seatSlots: [{ id: 'place-1', anchor: { xM: 0, yM: 0, hM: 0.48 }, facing: 'S', approach: { x: 0, y: 0 } }],
    });
    expect(validatePropCatalog([enfouie], MPT)).toEqual([
      expect.stringMatching(/^x: primitive box « bois-chene » — descend à -0\.3\d* m, sous le sol de sa case$/),
      expect.stringMatching(/^x: approche « place-1 » \(0,0\) tombe sur la case \(0,0\) de l’empreinte 1×1/),
    ]);
  });
});

/**
 * REGISTRE GÉNÉRÉ des décors À RECETTE (`PROPS_VOLUMIQUES`, `schemas/_ids.generated.ts`) — le
 * canal par lequel le schéma de scène sait, au parse, qu'un `ref` désigne un volume. Ce contrat le tient ÉGAL à
 * la mesure sur `props.json` : une recette ajoutée sans `npm run gen` est rouge ici, et le verrou de
 * cap du schéma ne peut donc pas se périmer en silence.
 */
describe('PROPS_VOLUMIQUES — le registre généré == la mesure sur props.json', () => {
  it('exactement les ids qui portent des primitives, triés', () => {
    const mesure = props
      .filter((p) => (p.volume?.primitives.length ?? 0) > 0)
      .map((p) => p.id)
      .sort();
    expect(mesure.length, 'aucune recette : ce contrat mesurerait du néant').toBeGreaterThan(10);
    expect([...PROPS_VOLUMIQUES]).toEqual(mesure);
  });

  it('un décor SANS recette n’y figure pas (le registre n’est pas la liste des props)', () => {
    const billboards = props.filter((p) => !p.volume?.primitives.length).map((p) => p.id);
    expect(billboards.length).toBeGreaterThan(10);
    expect(billboards.filter((id) => PROPS_VOLUMIQUES.includes(id))).toEqual([]);
  });
});

describe('materials.json, domaine `prop` — les matières du décor', () => {
  it('porte les matières du décor, en couleur hexadécimale et sans émission', () => {
    expect(matieresDe('prop').map((m) => m.id)).toEqual([
      'bois-chene', 'pierre-atre', 'fer-noirci', 'braises', 'prop-ardoise', 'toile-rouge', 'laiton-dore',
      'albatre', 'feuillage',
    ]);
    for (const m of matieresDe('prop')) {
      expect(m.color, m.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(m.roughness, m.id).toBeGreaterThanOrEqual(0);
      expect(m.roughness, m.id).toBeLessThanOrEqual(1);
      expect(m.metalness, m.id).toBeGreaterThanOrEqual(0);
      expect(m.metalness, m.id).toBeLessThanOrEqual(1);
      expect(m.domain, m.id).toBe('prop');
      expect(Object.keys(m).sort(), m.id).toEqual(['color', 'domain', 'id', 'label', 'metalness', 'roughness', 'type']);
    }
  });

  it('les braises ne portent AUCUNE émission — la lumière de cheminée vient de `light`', () => {
    const braises = findPropMaterialById('braises');
    expect(braises).toBeDefined();
    expect(braises).not.toHaveProperty('emissive');
    expect(findPropMaterialById('inconnu')).toBeUndefined();
  });
});
