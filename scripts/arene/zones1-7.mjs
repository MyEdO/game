/** Zones 1-7 de l'échelle — refaites en GRAND (24×16 → 32×24), layouts structurés, fouilles,
 *  rencontres enrichies. Ids/flags conservés (`arene-zoneN`, `zoneN_clear`). */
import { scene, P, hero, resetIds, fouille, fightTrigger, zoneVictory, NUEE_DE_RATS, NUEE_DE_RATS_APPEARANCE, flowOf, testNode, remetLeDocument } from '../campagne/lib.mjs';

/** Document du paquet (`narratif.documents`, #679) lu sur la stèle des Ruines. */
export const DOC_STELE_DES_RUINES = {
  id: 'document-stele-des-ruines',
  titre: 'Stèle des Ruines',
  prose: '« Ici tint garnison la III^e bannière du Comte Palatin. Le feu prit la tour une nuit de Geheimnisnacht ; nul ne rebâtit. Que celui qui fouille nos pierres laisse une pièce aux morts. »',
};

// ── Zone 1 — La Cour (24×16, sable) : échauffement, tutoriel du couvert ────────────────────

export function makeZone1() {
  resetIds();
  return scene({
    id: 'arene-zone1',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — La Cour',
    desc: 'La cour d’échauffement de l’arène : du sable, des caisses, de la vermine.',
    startMessage:
      'L’ARÈNE — La Cour. Pour s’échauffer : de la vermine. Utilisez le couvert (tonneaux, caisses, murets) — et fouillez le râtelier avant d’avancer.',
    rows: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#.........##...........#',
      '#.........##...........#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#...........##.........#',
      '#...........##.........#',
      '#......................#',
      '#......................#',
      '#......................#',
      '########################',
    ],
    base: 'sable',
    entities: [
      hero(2, 8),
      P(12, 2, 'statue', { label: 'Le Premier Champion' }),
      P(5, 4, 'mannequin'),
      P(4, 11, 'rack-armes', {
        label: 'Râtelier de l’arène',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'hallebarde' },
          { type: 'journal', desc: 'Une hallebarde réglementaire dort sur le râtelier. Elle est à vous.' },
        ]),
      }),
      P(9, 3, 'tonneau'),
      P(9, 7, 'tonneau'),
      P(13, 7, 'caisse'),
      P(17, 9, 'caisse'),
      P(21, 2, 'etendard'),
      P(2, 13, 'feu-camp'),
      P(6, 6, 'barriere'),
      P(6, 9, 'barriere'),
    ],
    triggers: [fightTrigger('enc-zone1', { x: 7, y: 1, w: 16, h: 14 })],
    encounters: [
      {
        id: 'enc-zone1',
        enemies: [
          { ref: 'snotling', pos: { x: 13, y: 4 } },
          { ref: 'snotling', pos: { x: 15, y: 11 } },
          { ref: 'snotling', pos: { x: 18, y: 5 } },
          { ref: 'gobelin', pos: { x: 16, y: 3 } },
          { ref: 'gobelin', pos: { x: 19, y: 12 }, randomChars: true },
          { ref: 'rat-geant', pos: { x: 12, y: 12 } },
        ],
        onVictory: zoneVictory(1, { money: { silver: 8 }, xp: 100, journal: 'La Cour : vaincue ! Retournez voir le maître d’arène.' }),
      },
    ],
  });
}

// ── Zone 2 — Les Ruines (28×20, dalle) : chambres effondrées + trésor gardé (2ᵉ rencontre) ──

export function makeZone2() {
  resetIds();
  return scene({
    id: 'arene-zone2',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — Les Ruines',
    desc: 'Un pan de forteresse effondrée annexé par l’arène — et squatté par des peaux-vertes.',
    startMessage:
      'LES RUINES. Des gobelins nichent dans les chambres effondrées. On murmure qu’une salle au nord-est garde encore son trésor… et son gardien.',
    rows: [
      '############################',
      '#..........................#',
      '#...t....#........##########',
      '#........#........#........#',
      '#........#........#........#',
      '#.................#........#',
      '#........#.................#',
      '#........#........#........#',
      '#........#........##########',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#####..####.....############',
      '#..........................#',
      '#...t......................#',
      '#..........................#',
      '#..............t...........#',
      '#..........................#',
      '#..........................#',
      '############################',
    ],
    base: 'dalle',
    legend: { t: 'terre' },
    entities: [
      hero(2, 17),
      P(5, 12, 'arche-ruine', { label: 'Porche effondré' }),
      P(10, 6, 'gravats'),
      P(14, 11, 'gravats'),
      P(5, 13, 'gravats'),
      P(19, 9, 'gravats'),
      P(21, 5, 'colonne-brisee'),
      P(23, 2, 'colonne-brisee'),
      P(13, 3, 'colonne-brisee'),
      P(3, 3, 'panneau', {
        label: 'Stèle gravée',
        ...fouille([
          remetLeDocument(DOC_STELE_DES_RUINES),
          { type: 'journal', desc: 'La stèle parle d’une garnison brûlée une nuit de Geheimnisnacht…' },
        ]),
      }),
      P(25, 3, 'coffre', {
        label: 'Coffre de la garnison',
        ...fouille([
          { type: 'giveMoney', montant: { gold: 3 } },
          { type: 'giveTrapping', trappingId: 'bouclier' },
          { type: 'journal', desc: 'Le coffre de la garnison : 3 co et un bouclier frappé du Comte Palatin.' },
        ]),
      }),
      P(3, 8, 'tonneau'),
      P(12, 16, 'feu-camp', { label: 'Feu gobelin' }),
      P(13, 15, 'detritus'),
    ],
    triggers: [
      fightTrigger('enc-zone2', { x: 1, y: 9, w: 18, h: 8 }),
      fightTrigger('enc-ruines-tresor', { x: 19, y: 2, w: 8, h: 6 }),
    ],
    encounters: [
      {
        id: 'enc-zone2',
        enemies: [
          { ref: 'gobelin', pos: { x: 8, y: 10 }, randomChars: true },
          { ref: 'gobelin', pos: { x: 13, y: 9 }, randomChars: true },
          { ref: 'gobelin', pos: { x: 6, y: 4 } },
          { ref: 'gobelin', pos: { x: 15, y: 14 } },
          { ref: 'orc', pos: { x: 12, y: 5 } },
        ],
        onVictory: zoneVictory(2, { money: { silver: 12 }, xp: 120, journal: 'Les Ruines : nettoyées ! (La salle au trésor, au nord-est, n’a pas dit son dernier mot.)' }),
      },
      {
        // Le gardien du trésor : on le SURPREND dans sa salle (embuscade des héros).
        id: 'enc-ruines-tresor',
        surprise: 'enemies',
        enemies: [
          { ref: 'orc', pos: { x: 22, y: 4 }, optionals: [{ id: 'insensible-a-la-douleur' }] },
          { ref: 'gobelin', pos: { x: 20, y: 3 } },
          { ref: 'gobelin', pos: { x: 24, y: 6 } },
        ],
        onVictory: flowOf([
          { type: 'giveXp', amount: 50 },
          { type: 'journal', desc: 'Le gardien du trésor est tombé — la salle est à vous. Fouillez le coffre !' },
        ]),
      },
    ],
  });
}

// ── Zone 3 — Les Égouts (30×18, sol) : canal, passerelles, miasmes (maladie) ────────────────

export function makeZone3() {
  resetIds();
  return scene({
    id: 'arene-zone3',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — Les Égouts',
    desc: 'Le collecteur sous l’arène : un canal d’eau croupie, deux passerelles, de la vermine.',
    startMessage:
      'LES ÉGOUTS. Un canal d’eau croupie coupe le collecteur — deux passerelles de planches le franchissent. Retenez votre souffle : les miasmes rendent MALADE.',
    rows: [
      '##############################',
      '#............................#',
      '#............................#',
      '#...~~.......................#',
      '#...~~.......................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#~~~~~~=~~~~~~~~~~~~=~~~~~~~~#',
      '#~~~~~~=~~~~~~~~~~~~=~~~~~~~~#',
      '#............................#',
      '#............................#',
      '#.................~~~........#',
      '#.................~~~........#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
    ],
    base: 'sol',
    entities: [
      hero(2, 15),
      P(28, 8, 'grille', { label: 'Grille d’évacuation' }),
      P(5, 11, 'detritus'),
      P(12, 2, 'detritus'),
      P(25, 14, 'detritus'),
      P(3, 6, 'tonneau'),
      P(26, 2, 'tonneau'),
      P(27, 16, 'roue-dentee', { label: 'Vanne du collecteur' }),
      P(16, 12, 'cadavre', {
        label: 'Égoutier noyé',
        ...fouille([
          { type: 'giveMoney', montant: { silver: 12 } },
          { type: 'journal', desc: 'L’égoutier n’avait plus besoin de sa paie : 12 pa.' },
        ]),
      }),
      P(14, 10, 'mare-sang'),
      P(22, 16, 'champignon'),
    ],
    triggers: [
      {
        id: 'miasmes',
        rect: { x: 1, y: 7, w: 28, h: 1 },
        once: true,
        flow: testNode(
          { skill: { id: 'resistance' }, difficulty: 'facile', label: 'Miasmes des égouts', stake: { authored: 'Tenir le coup dans l’air des égouts : sinon la Fièvre du Rongeur vous prend.' } },
          [{ type: 'journal', desc: 'L’air est irrespirable, mais vous gardez vos tripes — et votre santé.' }],
          [
            { type: 'inflictDisease', disease: 'Fièvre du Rongeur' },
            { type: 'journal', desc: 'Quelque chose se glisse dans vos poumons avec l’odeur… La Fièvre du Rongeur couve.' },
          ],
        ),
      },
      fightTrigger('enc-zone3', { x: 1, y: 1, w: 28, h: 6 }),
    ],
    encounters: [
      {
        id: 'enc-zone3',
        enemies: [
          { ref: 'rat-geant', pos: { x: 10, y: 4 } },
          { ref: 'rat-geant', pos: { x: 24, y: 3 } },
          { statblock: NUEE_DE_RATS, appearance: NUEE_DE_RATS_APPEARANCE, pos: { x: 8, y: 6 } },
          { statblock: NUEE_DE_RATS, appearance: NUEE_DE_RATS_APPEARANCE, pos: { x: 22, y: 5 } },
          { ref: 'snotling', pos: { x: 15, y: 3 } },
          { ref: 'snotling', pos: { x: 18, y: 6 } },
        ],
        onVictory: zoneVictory(3, { money: { silver: 16 }, xp: 140, journal: 'Les Égouts : purgés ! Remontez respirer au Bourg.' }),
      },
    ],
  });
}

// ── Zone 4 — Le Charnier (28×20, ossuaire) : embuscade des morts, crépuscule, cauchemars ────

export function makeZone4() {
  resetIds();
  return scene({
    id: 'arene-zone4',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — Le Charnier',
    desc: 'La fosse commune de l’arène, murée en cryptes — les pensionnaires se relèvent.',
    startMessage:
      'LE CHARNIER. Les vaincus de l’arène finissent ici… et n’y restent pas. Les morts SURGISSENT — attendez-vous à être surpris.',
    rows: [
      '############################',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#.....######......######...#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#.....######......######...#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '############################',
    ],
    base: 'ossuaire',
    entities: [
      hero(2, 17),
      P(7, 4, 'sarcophage'),
      P(19, 4, 'sarcophage'),
      P(7, 11, 'sarcophage'),
      P(20, 11, 'sarcophage'),
      P(4, 7, 'tombe'),
      P(24, 8, 'tombe'),
      P(10, 13, 'tombe'),
      P(13, 5, 'ossements'),
      P(18, 12, 'ossements'),
      P(5, 15, 'ossements'),
      P(15, 9, 'mare-sang'),
      P(3, 3, 'urne'),
      P(13, 16, 'brasero'),
      P(15, 16, 'brasero'),
      P(9, 15, 'cadavre', {
        label: 'Fossoyeur mort',
        ...fouille(testNode(
          { skill: { id: 'resistance' }, difficulty: 'intermediaire', label: 'Fouiller les morts du charnier', stake: { authored: 'Fouiller sans se blesser : 18 pistoles dans la bourse du fossoyeur, sinon une Blessure Purulente.' } },
          [
            { type: 'giveMoney', montant: { silver: 18 } },
            { type: 'journal', desc: 'Le fossoyeur serrait encore sa bourse : 18 pa, et rien d’attrapé.' },
          ],
          [
            { type: 'inflictDisease', disease: 'Blessure Purulente' },
            { type: 'journal', desc: 'Un os brisé vous entaille la paume. La plaie sent déjà mauvais…' },
          ],
        )),
      }),
      P(24, 2, 'coffre', {
        label: 'Reliquaire descellé',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'chemise-de-mailles' },
          { type: 'journal', desc: 'Sous les os : une chemise de mailles, intacte. Les morts n’en font rien.' },
        ]),
      }),
    ],
    triggers: [
      {
        id: 'crepuscule',
        rect: { x: 1, y: 14, w: 26, h: 4 },
        once: true,
        flow: flowOf([
          { type: 'setTime', phase: 'crepuscule' },
          { type: 'journal', desc: 'Le jour décline sur le charnier — les ombres s’allongent entre les cryptes.' },
        ]),
      },
      fightTrigger('enc-zone4', { x: 1, y: 1, w: 26, h: 12 }),
    ],
    encounters: [
      {
        id: 'enc-zone4',
        surprise: 'party',
        enemies: [
          { ref: 'squelette', pos: { x: 8, y: 3 } },
          { ref: 'squelette', pos: { x: 16, y: 7 } },
          { ref: 'squelette', pos: { x: 22, y: 3 }, optionals: [{ id: 'territorial' }] },
          { ref: 'zombie', pos: { x: 10, y: 8 } },
          { ref: 'zombie', pos: { x: 14, y: 3 } },
          { ref: 'zombie', pos: { x: 20, y: 8 } },
          { ref: 'goule-de-crypte', pos: { x: 12, y: 6 } },
        ],
        onVictory: zoneVictory(4, {
          money: { gold: 1 },
          xp: 160,
          journal: 'Le Charnier : recouché ! Mais certaines images ne s’oublient pas…',
          extra: [{ type: 'inflictNightmares' }],
        }),
      },
    ],
  });
}

// ── Zone 5 — Les Lices (34×16, terre, pluie) : cavalerie, monture alliée ────────────────────

export function makeZone5() {
  resetIds();
  return scene({
    id: 'arene-zone5',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — Les Lices',
    desc: 'Le champ de joute de l’arène, sous la pluie — duels montés et lances de cavalerie.',
    weather: 'pluie',
    startMessage:
      'LES LICES, sous la pluie battante. Des cavaliers vous attendent — un destrier SELLÉ broute près de la barrière : enfourchez-le ! (Et fouillez le râtelier de lances.)',
    rows: [
      '##################################',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '##################################',
    ],
    base: 'terre',
    entities: [
      hero(2, 8),
      P(4, 1, 'etendard'),
      P(29, 1, 'etendard'),
      P(9, 8, 'barriere'),
      P(12, 8, 'barriere'),
      P(15, 8, 'barriere'),
      P(18, 8, 'barriere'),
      P(21, 8, 'barriere'),
      P(24, 8, 'barriere'),
      P(3, 12, 'rack-lances', {
        label: 'Râtelier de joute',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'lance-de-cavalerie' },
          { type: 'journal', desc: 'Une lance de cavalerie de tournoi — parfaite depuis une selle.' },
        ]),
      }),
      P(29, 12, 'abreuvoir'),
      P(30, 3, 'tas-foin'),
      P(4, 13, 'tas-foin'),
    ],
    triggers: [fightTrigger('enc-zone5', { x: 10, y: 1, w: 23, h: 14 })],
    encounters: [
      {
        id: 'enc-zone5',
        enemies: [
          // 0 : destrier LIBRE côté héros — enfourchable (vitrine du combat monté).
          { ref: 'cheval', pos: { x: 6, y: 11 }, mount: true, side: 'ally' },
          // 1-2 : le champion mutant, pré-monté.
          { ref: 'cheval', pos: { x: 22, y: 4 }, mount: true },
          { ref: 'mutant', pos: { x: 22, y: 4 }, rides: 1 },
          // 3-4 : lancier gobelin, pré-monté.
          { ref: 'cheval', pos: { x: 26, y: 10 }, mount: true },
          { ref: 'gobelin', pos: { x: 26, y: 10 }, rides: 3 },
          // 5 : piquier à pied derrière la barrière.
          { ref: 'gobelin', pos: { x: 18, y: 6 } },
        ],
        onVictory: zoneVictory(5, { money: { gold: 1, silver: 10 }, xp: 180, journal: 'Les Lices : remportées sous la pluie ! Le Bourg parle déjà de votre charge.' }),
      },
    ],
  });
}

// ── Zone 6 — Le Marais (32×24, boue, brouillard) : embuscade bestiale, Fimir ────────────────

export function makeZone6() {
  resetIds();
  return scene({
    id: 'arene-zone6',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — Le Marais',
    desc: 'La fondrière au pied des murs — hommes-bêtes et loups y chassent dans la brume.',
    weather: 'brouillard',
    startMessage:
      'LE MARAIS, noyé de brouillard. La harde chasse en silence et l’eau cache pire encore. Restez groupés — l’embuscade est CERTAINE.',
    rows: [
      '################################',
      '#bb..........bb...........bbbb.#',
      '#b.........~~~~~...............#',
      '#..........~~~~~.........b.....#',
      '#.............~~.........b.....#',
      '#......hh......................#',
      '#......hh............~~~.......#',
      '#....................~~~~......#',
      '#bb...................~~.......#',
      '#bbb...........................#',
      '#bb............................#',
      '#.........~~~..................#',
      '#.........~~~~........hh.......#',
      '#..........~~..................#',
      '#..............................#',
      '#..............b...............#',
      '#.....hh.......bb..............#',
      '#..............b........~~~....#',
      '#........................~~~...#',
      '#..............................#',
      '#..............................#',
      '#..bb..........................#',
      '#..bbb.........................#',
      '################################',
      '################################',
    ],
    base: 'boue',
    legend: { b: 'bois', h: 'herbe' },
    entities: [
      hero(2, 19),
      P(12, 2, 'roseaux'),
      P(16, 3, 'roseaux'),
      P(21, 7, 'roseaux'),
      P(10, 12, 'roseaux'),
      P(13, 2, 'nenuphars'),
      P(22, 6, 'nenuphars'),
      P(11, 11, 'nenuphars'),
      P(25, 17, 'nenuphars'),
      P(6, 3, 'arbre-mort'),
      P(27, 9, 'arbre-mort'),
      P(18, 19, 'arbre-mort'),
      P(20, 4, 'menhir'),
      P(16, 9, 'trophee-cranes', { label: 'Totem de la harde' }),
      P(5, 9, 'souche'),
      P(24, 13, 'souche'),
      P(7, 14, 'champignon'),
      P(8, 16, 'cheval-mort', {
        label: 'Monture éventrée',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'faxtoryll' },
          { type: 'journal', desc: 'Les fontes du cavalier disparu contenaient du faxtoryll — encore sec.' },
        ]),
      }),
      P(26, 18, 'barque', {
        label: 'Barque embourbée',
        ...fouille([
          { type: 'giveMoney', montant: { silver: 10 } },
          { type: 'journal', desc: 'Sous le banc de nage : une bourse oubliée (10 pa).' },
        ]),
      }),
    ],
    triggers: [fightTrigger('enc-zone6', { x: 5, y: 1, w: 26, h: 20 })],
    encounters: [
      {
        id: 'enc-zone6',
        surprise: 'party',
        enemies: [
          { ref: 'gor', pos: { x: 14, y: 6 } },
          { ref: 'gor', pos: { x: 20, y: 16 }, optionals: [{ id: 'armure', value: 2 }] },
          { ref: 'ungor', pos: { x: 17, y: 7 } },
          { ref: 'ungor', pos: { x: 22, y: 10 } },
          { ref: 'loup-funeste', pos: { x: 10, y: 14 } },
          { ref: 'loup-funeste', pos: { x: 25, y: 5 } },
          { ref: 'fimir', pos: { x: 18, y: 12 } },
        ],
        onVictory: zoneVictory(6, { money: { gold: 2 }, xp: 200, journal: 'Le Marais : la harde est brisée — et son Fimir avec. Le brouillard se lève enfin.' }),
      },
    ],
  });
}

// ── Zone 7 — Le Nid (30×22, tourbe) : grotte aux araignées, cocons piégés, Vouivre ──────────

export function makeZone7() {
  resetIds();
  return scene({
    id: 'arene-zone7',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — Le Nid',
    desc: 'Une grotte tendue de toiles sous l’arène — et le perchoir d’une vouivre.',
    startMessage:
      'LE NID. Toiles, cocons… et un sifflement de VOUIVRE au fond. Les cocons cachent des trésors — et des morsures. Prudence en fouillant.',
    rows: [
      '##############################',
      '#............#######.........#',
      '#..............####..........#',
      '#...............##...........#',
      '#............................#',
      '#............................#',
      '#####........................#',
      '###..........................#',
      '#............................#',
      '#............................#',
      '#...........####.............#',
      '#...........####.............#',
      '#............##..............#',
      '#............................#',
      '#............................#',
      '#####........................#',
      '######.......................#',
      '#####........................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
    ],
    base: 'tourbe',
    entities: [
      hero(2, 19),
      P(8, 3, 'toile'),
      P(18, 8, 'toile'),
      P(10, 15, 'toile'),
      P(24, 16, 'toile'),
      P(6, 5, 'cocon', {
        label: 'Cocon frémissant',
        ...fouille(testNode(
          { skill: { id: 'athletisme' }, difficulty: 'intermediaire', label: 'Éventrer le cocon sans s’y prendre', stake: { authored: 'Ouvrir la soie sans se faire mordre : une potion de guérison intacte, sinon une Infection Mineure.' } },
          [
            { type: 'giveTrapping', trappingId: 'potion-de-guerison' },
            { type: 'journal', desc: 'Dans la soie : la besace d’une victime, potion intacte.' },
          ],
          [
            { type: 'inflictDisease', disease: 'Infection Mineure' },
            { type: 'journal', desc: 'Quelque chose vous mord à travers la soie avant de fuir. La plaie gonfle déjà.' },
          ],
        )),
      }),
      P(21, 13, 'cocon', {
        label: 'Cocon lourd',
        ...fouille([
          { type: 'giveMoney', montant: { silver: 24 } },
          { type: 'journal', desc: 'Le cocon rend une bourse poisseuse : 24 pa.' },
        ]),
      }),
      P(15, 17, 'cocon'),
      P(4, 12, 'champignon'),
      P(26, 4, 'champignon', {
        label: 'Chapeaux moirés',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'bonnet-de-fou' },
          { type: 'journal', desc: 'Des chapeaux moirés de Bonnet de fou — l’apothicaire en donnerait cher.' },
        ]),
      }),
      P(12, 7, 'champignon'),
      P(9, 9, 'stalagmite'),
      P(23, 10, 'stalagmite'),
      P(5, 16, 'ossements'),
      P(17, 14, 'cadavre', {
        label: 'Chasseur momifié',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'arc' },
          { type: 'journal', desc: 'Le chasseur n’aura plus besoin de son arc. Sa corde est encore bonne.' },
        ]),
      }),
      P(7, 11, 'tonneau', { label: 'Vieux camp' }),
    ],
    triggers: [fightTrigger('enc-zone7', { x: 6, y: 1, w: 23, h: 19 })],
    encounters: [
      {
        id: 'enc-zone7',
        enemies: [
          { ref: 'araignee-geante', pos: { x: 12, y: 6 } },
          { ref: 'araignee-geante', pos: { x: 18, y: 14 } },
          { ref: 'araignee-geante', pos: { x: 8, y: 12 }, optionals: [{ id: 'armure', value: 1 }] },
          { ref: 'serpent', pos: { x: 20, y: 6 } },
          { ref: 'serpent', pos: { x: 14, y: 16 } },
          { ref: 'basilic', pos: { x: 22, y: 18 } },
          { ref: 'vouivre', pos: { x: 24, y: 5 } }, // empreinte 3×3 : (24,4) chevaucherait les « Chapeaux moirés » (26,4), désormais bloquants
        ],
        onVictory: zoneVictory(7, { money: { gold: 2, silver: 10 }, xp: 220, journal: 'Le Nid : brûlé ! La vouivre ne sifflera plus sous l’arène.' }),
      },
    ],
  });
}
