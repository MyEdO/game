/** Zones 8-13 de l'échelle — le haut du tableau : Fosse, Caverne, Vermine, Cercle, Sépulcre, Dragon. */
import { scene, P, NPC, hero, resetIds, fouille, fightTrigger, zoneVictory, DRAGON_DES_TENEBRES, DRAGON_DES_TENEBRES_APPEARANCE, flowOf, flagWhen, testNode } from '../campagne/lib.mjs';

// ── Zone 8 — La Fosse (30×20, roche) : gouffres, harde du Chaos, gladiateur ALLIÉ ───────────

export function makeZone8() {
  resetIds();
  return scene({
    id: 'arene-zone8',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — La Fosse',
    desc: 'La grande fosse aux bêtes : des gouffres la découpent en passes étroites.',
    startMessage:
      'LA FOSSE. Des gouffres coupent l’arène en passes étroites — et un GLADIATEUR enchaîné combat à vos côtés : la harde a capturé le mauvais homme.',
    rows: [
      '##############################',
      '#............................#',
      '#............................#',
      '#......___...................#',
      '#......___............____...#',
      '#......___............____...#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#...____.....................#',
      '#...____.........___.........#',
      '#................___.........#',
      '#................___.........#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
    ],
    base: 'roche',
    entities: [
      hero(2, 9),
      P(12, 3, 'banniere-chaos'),
      P(22, 15, 'banniere-chaos'),
      P(18, 5, 'trophee-cranes'),
      P(8, 16, 'mare-sang'),
      P(20, 9, 'mare-sang'),
      P(14, 8, 'ossements'),
      P(25, 2, 'ossements'),
      P(5, 6, 'rocher'),
      P(24, 17, 'rocher'),
      P(10, 13, 'crane-monstre'),
      P(27, 7, 'pieu'),
      P(3, 16, 'cage', {
        label: 'Cage brisée',
        ...fouille([
          { type: 'giveMoney', montant: { silver: 16 } },
          { type: 'journal', desc: 'La cage du gladiateur — sa solde y était cachée : 16 pa, qu’il vous abandonne.' },
        ]),
      }),
    ],
    triggers: [fightTrigger('enc-zone8', { x: 7, y: 1, w: 22, h: 18 })],
    encounters: [
      {
        id: 'enc-zone8',
        enemies: [
          // 0 : le gladiateur évadé — un ALLIÉ de scène à pied (vitrine side:'ally' hors monture).
          //     Dépouillé de son armure par la harde : haillons + carrure de lutteur (≠ soldat générique).
          { ref: 'humain', pos: { x: 5, y: 10 }, side: 'ally', weapon: 'epee-batarde', label: 'Gladiateur enchaîné', appearance: { tenue: 'mendiant', build: 0.72 } },
          { ref: 'gor', pos: { x: 14, y: 5 } },
          { ref: 'gor', pos: { x: 22, y: 11 }, optionals: [{ id: 'armure', value: 2 }] },
          { ref: 'gor', pos: { x: 12, y: 16 } },
          { ref: 'ungor', pos: { x: 17, y: 9 } },
          { ref: 'ungor', pos: { x: 24, y: 6 } },
          { ref: 'minotaure', pos: { x: 20, y: 16 } },
        ],
        onVictory: zoneVictory(8, {
          money: { gold: 3 },
          xp: 240,
          journal: 'La Fosse : le Minotaure est tombé ! Le gladiateur vous salue et disparaît par le tunnel des bêtes.',
        }),
      },
    ],
  });
}

// ── Zone 9 — La Caverne du Troll (32×22, pierre) : crevasse, marmite, Ogre au trésor ────────

export function makeZone9() {
  resetIds();
  return scene({
    id: 'arene-zone9',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — La Caverne du Troll',
    desc: 'Le garde-manger du troll de l’arène — une crevasse, des os, et un invité de marque.',
    startMessage:
      'LA CAVERNE DU TROLL. Ça pue le rance et la chair faisandée. Au fond, une alcôve murée abrite le magot — et son NOUVEAU propriétaire.',
    rows: [
      '################################',
      '#..............................#',
      '#..............................#',
      '#.....................##########',
      '#.....................#........#',
      '#.....................#........#',
      '#.....................#........#',
      '#......____............#.......#',
      '#......_____...........#.......#',
      '#.......____...........#.......#',
      '#......................#.......#',
      '#.....................##.......#',
      '#.....................########.#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '################################',
    ],
    base: 'pierre',
    entities: [
      hero(2, 18),
      P(6, 3, 'stalagmite'),
      P(14, 12, 'stalagmite'),
      P(26, 16, 'stalagmite'),
      P(10, 5, 'rocher'),
      P(20, 17, 'rocher'),
      P(8, 14, 'ossements'),
      P(16, 4, 'ossements'),
      P(12, 17, 'crane-monstre'),
      P(18, 15, 'mare-sang'),
      P(13, 14, 'marmite', {
        label: 'Marmite du troll',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'potion-de-vitalite' },
          { type: 'giveMoney', montant: { silver: 14 } },
          { type: 'journal', desc: 'Au fond du brouet : une fiole scellée (potion de vitalité !) et 14 pa qui n’ont pas fondu.' },
        ]),
      }),
      P(26, 5, 'coffre', {
        label: 'Magot de la caverne',
        ...fouille([
          { type: 'giveMoney', montant: { gold: 4 } },
          { type: 'giveTrapping', trappingId: 'grande-hache' },
          { type: 'journal', desc: 'Le magot : 4 co et une grande hache au fil intact. L’Ogre ne comptera plus rien.' },
        ]),
      }),
      P(28, 8, 'feu-camp', { label: 'Feu de l’Ogre' }),
    ],
    triggers: [
      fightTrigger('enc-zone9', { x: 5, y: 1, w: 17, h: 19 }),
      fightTrigger('enc-caverne-ogre', { x: 24, y: 4, w: 7, h: 8 }),
    ],
    encounters: [
      {
        id: 'enc-zone9',
        enemies: [
          { ref: 'troll', pos: { x: 12, y: 8 } },
          { ref: 'squig-des-cavernes', pos: { x: 16, y: 14 } },
          { ref: 'squig-des-cavernes', pos: { x: 8, y: 11 }, optionals: [{ id: 'frenesie' }] },
          { ref: 'gor', pos: { x: 18, y: 6 } },
        ],
        onVictory: zoneVictory(9, {
          money: { gold: 3, silver: 10 },
          xp: 260,
          journal: 'La Caverne : le Troll est resté à terre (cette fois pour de bon). L’alcôve du fond vous tend les bras…',
        }),
      },
      {
        // L'invité de marque : un Ogre mercenaire a flairé le magot avant vous.
        id: 'enc-caverne-ogre',
      enemies: [{ ref: 'ogre', pos: { x: 27, y: 9 }, optionals: [{ id: 'affame' }] }],
        onVictory: flowOf([
          { type: 'giveXp', amount: 60 },
          { type: 'journal', desc: 'L’Ogre s’effondre en travers de son feu. Le magot n’attend plus que vous.' },
        ]),
      },
    ],
  });
}

// ── Zone 10 — Le Nid de Vermine (34×24, pavé) : terriers skavens, prisonnier à délivrer ─────

export function makeZone10() {
  resetIds();
  const dlgPrisonnier = {
    id: 'dlg-prisonnier',
    start: 'accueil',
    nodes: [
      {
        id: 'accueil',
        desc: '« Psst ! Par ici ! Les hommes-rats m’engraissent pour leur table — la serrure est grossière, sortez-moi de là ! »',
        choices: [
          {
            label: 'Crocheter la cage.',
            icon: 'ui/lock',
            when: flagWhen('!prisonnier_libre'),
            flow: testNode(
              { skill: { id: 'crochetage' }, difficulty: 'accessible', label: 'Crocheter la cage du garde-manger', stake: { authored: 'Ouvrir la cage du colporteur : sa liberté, sa bourse de 40 pistoles et 50 XP ; raté, le crochet ripe et il reste dedans.' } },
              [
                { type: 'setFlag', flag: 'prisonnier_libre' },
                { type: 'giveMoney', montant: { silver: 40 } },
                { type: 'giveXp', amount: 50 },
                { type: 'journal', desc: 'Le colporteur halfling s’extrait de la cage, vous fourre sa bourse (40 pa) dans les mains et détale vers la surface.' },
                { type: 'endDialogue' },
              ],
              [{ type: 'journal', desc: 'La serrure est grossière mais voilée — le crochet ripe. Réessayez.' }],
            ),
          },
          { label: '« On revient te chercher. » (Plus tard.)', flow: flowOf([{ type: 'endDialogue' }]) },
        ],
      },
    ],
  };
  return scene({
    id: 'arene-zone10',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — Le Nid de Vermine',
    desc: 'Un quartier muré du vieux Bourg, rendu aux skavens — terriers, rouages et cages.',
    startMessage:
      'LE NID DE VERMINE. Les hommes-rats ont percé leurs terriers sous le vieux quartier. Une voix appelle depuis une CAGE — et mille yeux rouges vous regardent.',
    rows: [
      '##################################',
      '#................................#',
      '#................................#',
      '#.......########.....##########..#',
      '#.......#......#.....#...........#',
      '#.......#......#.....#...........#',
      '#.......#......#.....#...........#',
      '#.......#......#.....#...........#',
      '#.......##..####.....######..###.#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#......####..#####...########....#',
      '#.........................#......#',
      '#.........................#......#',
      '#.........................#......#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '##################################',
    ],
    base: 'pave',
    entities: [
      hero(2, 21),
      NPC('prisonnier', 10, 5, 'Prisonnier en cage', {
        dialogueId: 'dlg-prisonnier',
        anim: 'cowering',
        appearance: { species: 'halflings', tenue: 'mendiant', sex: 'M' },
      }),
      P(10, 6, 'cage', { label: 'Cage du garde-manger' }),
      P(12, 5, 'detritus'),
      P(23, 5, 'roue-dentee', { label: 'Machinerie skaven' }),
      P(25, 6, 'roue-dentee'),
      P(6, 10, 'terrier'),
      P(28, 11, 'terrier'),
      P(16, 17, 'terrier'),
      P(4, 15, 'detritus'),
      P(20, 10, 'detritus'),
      P(30, 19, 'detritus'),
      P(9, 18, 'mare-sang'),
      P(24, 16, 'mare-sang'),
      P(14, 11, 'tonneau'),
      P(29, 4, 'caisse'),
      P(31, 17, 'caisse', {
        label: 'Caisse de contrebande',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'lotus-noir' },
          { type: 'journal', desc: 'De la contrebande skavenne : un sachet de lotus noir. À manier avec des gants.' },
        ]),
      }),
      P(18, 4, 'gravats'),
      P(3, 7, 'gravats'),
    ],
    triggers: [
      {
        id: 'voix-cage',
        rect: { x: 7, y: 9, w: 11, h: 3 },
        once: true,
        flow: flowOf([{ type: 'startDialogue', dialogue: 'dlg-prisonnier', speakerId: 'prisonnier' }]),
      },
      fightTrigger('enc-zone10', { x: 12, y: 9, w: 21, h: 13 }),
    ],
    encounters: [
      {
        id: 'enc-zone10',
        enemies: [
          { ref: 'guerrier-des-clans', pos: { x: 16, y: 10 }, randomChars: true },
          { ref: 'guerrier-des-clans', pos: { x: 22, y: 12 }, randomChars: true },
          { ref: 'guerrier-des-clans', pos: { x: 18, y: 19 }, randomChars: true },
          { ref: 'guerrier-des-clans', pos: { x: 28, y: 9 }, optionals: [{ id: 'pisteur' }] },
          { ref: 'vermine-de-choc', pos: { x: 20, y: 15 } },
          { ref: 'vermine-de-choc', pos: { x: 24, y: 20 } },
          { ref: 'rat-ogre', pos: { x: 29, y: 14 } },
          { ref: 'rat-geant', pos: { x: 14, y: 15 } },
          { ref: 'rat-geant', pos: { x: 10, y: 20 } },
        ],
        onVictory: zoneVictory(10, {
          money: { gold: 4 },
          xp: 280,
          journal: 'Le Nid de Vermine : enfumé ! Les terriers resteront silencieux… un temps.',
        }),
      },
    ],
    dialogues: [dlgPrisonnier],
  });
}

// ── Zone 11 — Le Cercle Maudit (34×22, terre/sang) : sorciers ennemis, démons, corruption ───

export function makeZone11() {
  resetIds();
  return scene({
    id: 'arene-zone11',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — Le Cercle Maudit',
    desc: 'L’ancien sanctuaire du culte sous l’arène — l’idole noire y saigne encore.',
    startMessage:
      'LE CERCLE MAUDIT. Le culte psalmodie autour de l’idole noire — leur CHAMANE tisse déjà ses sorts et l’air vous corrompt la moelle. Frappez vite.',
    rows: [
      '##################################',
      '#................................#',
      '#................................#',
      '#................................#',
      '#..............sss...............#',
      '#.............sssss..............#',
      '#.............sssss..............#',
      '#..............sss...............#',
      '#................................#',
      '#................................#',
      '#......##................##......#',
      '#......##................##......#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#...............s................#',
      '#..............sss...............#',
      '#...............s................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '##################################',
    ],
    base: 'terre',
    legend: { s: 'sang' },
    entities: [
      hero(2, 18),
      P(16, 5, 'idole-chaos', { label: 'L’Idole noire' }),
      P(16, 16, 'autel', { label: 'Autel des sacrifices' }),
      P(14, 8, 'cercle-runique'),
      P(19, 8, 'cercle-runique'),
      P(8, 4, 'banniere-chaos'),
      P(25, 4, 'banniere-chaos'),
      P(12, 13, 'pieu'),
      P(21, 13, 'pieu'),
      P(6, 16, 'crane-monstre'),
      P(27, 17, 'ossements'),
      P(10, 9, 'mare-sang'),
      P(23, 11, 'mare-sang'),
      P(4, 8, 'brasero'),
      P(29, 8, 'brasero'),
      P(28, 14, 'coffre', {
        label: 'Coffre du célébrant',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'grimoire' },
          { type: 'learnSpell', spell: 'eblouissant' },
          { type: 'journal', desc: 'Le grimoire du célébrant — votre sorcier en déchiffre déjà un charme (Éblouissant) ; le reste se lira au calme.' },
        ]),
      }),
    ],
    triggers: [
      {
        id: 'souffle-idole',
        rect: { x: 13, y: 3, w: 8, h: 6 },
        once: true,
        flow: flowOf([
          { type: 'corruptionExposure', level: 'mineure', skill: { id: 'calme' } },
          { type: 'journal', desc: 'L’idole noire CHANTE dans vos crânes — une influence corruptrice à l’état pur.' },
        ]),
      },
      fightTrigger('enc-zone11', { x: 6, y: 1, w: 27, h: 20 }),
    ],
    encounters: [
      {
        id: 'enc-zone11',
        enemies: [
          { ref: 'chamane-brey', pos: { x: 17, y: 3 }, spells: ['flechette', 'la-lance-d-ambre', 'serres-d-ambre'] },
          { ref: 'cultiste', pos: { x: 13, y: 10 }, spells: ['flechette'], optionals: [{ id: 'lanceur-de-sorts', arg: 'chaos' }] },
          { ref: 'cultiste', pos: { x: 21, y: 10 }, randomChars: true },
          { ref: 'cultiste', pos: { x: 17, y: 12 }, randomChars: true },
          { ref: 'mutant', pos: { x: 10, y: 6 } },
          { ref: 'mutant', pos: { x: 24, y: 6 } },
          { ref: 'sanguinaire-de-khorne', pos: { x: 15, y: 14 } },
          { ref: 'horreur-rose', pos: { x: 19, y: 14 } },
          { ref: 'horreur-bleue', pos: { x: 22, y: 16 } },
        ],
        onVictory: zoneVictory(11, {
          money: { gold: 5 },
          xp: 300,
          journal: 'Le Cercle Maudit : le chant s’est tu. L’idole n’est plus qu’une pierre — fouillez le coffre du célébrant.',
        }),
      },
    ],
  });
}

// ── Zone 12 — Le Sépulcre (32×20, marbre) : nuit forcée, bans hurleurs, butin MAGIQUE ───────

export function makeZone12() {
  resetIds();
  return scene({
    id: 'arene-zone12',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — Le Sépulcre',
    desc: 'Le tombeau d’un seigneur oublié, sous l’arène — il reçoit, à la nuit tombée.',
    startMessage:
      'LE SÉPULCRE. La porte se referme : il fera NUIT, quoi qu’en dise le soleil. Le seigneur des lieux apprécie les visites — ses gens hurlent déjà.',
    rows: [
      '################################',
      '#..............................#',
      '#..............................#',
      '#....##....##....##....##......#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#....##....##....##....##......#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#....##....##....##....##......#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '################################',
    ],
    base: 'marbre',
    entities: [
      hero(2, 17),
      P(7, 2, 'gargouille'),
      P(24, 2, 'gargouille'),
      P(7, 13, 'gargouille'),
      P(24, 13, 'gargouille'),
      P(4, 5, 'brasero'),
      P(27, 5, 'brasero'),
      P(4, 15, 'brasero'),
      P(27, 15, 'brasero'),
      P(10, 5, 'sarcophage'),
      P(18, 5, 'sarcophage'),
      P(10, 9, 'sarcophage'),
      P(14, 16, 'chandelier'),
      P(16, 16, 'chandelier'),
      P(12, 2, 'urne'),
      P(20, 9, 'urne'),
      P(8, 16, 'ossements'),
      P(22, 16, 'mare-sang'),
      P(18, 9, 'sarcophage', {
        label: 'Sarcophage du seigneur',
        ...fouille([
          { type: 'giveTrapping', trappingId: 'epee-batarde', qualities: ['magique', 'de-plaies-atroces'], identified: false },
          { type: 'journal', desc: 'Entre les mains du gisant : une épée bâtarde au fil GLACIAL. Quelque chose dort dans cet acier — faites-la évaluer.' },
        ]),
      }),
    ],
    triggers: [
      {
        id: 'nuit-sepulcre',
        rect: { x: 1, y: 14, w: 30, h: 4 },
        once: true,
        flow: flowOf([
          { type: 'setTime', phase: 'nuit' },
          { type: 'journal', desc: 'La porte claque derrière vous. Dans le Sépulcre, il est TOUJOURS minuit.' },
        ]),
      },
      fightTrigger('enc-zone12', { x: 1, y: 1, w: 30, h: 12 }),
    ],
    encounters: [
      {
        id: 'enc-zone12',
        enemies: [
          { ref: 'squelette', pos: { x: 8, y: 4 } },
          { ref: 'squelette', pos: { x: 22, y: 4 } },
          { ref: 'fantome', pos: { x: 12, y: 8 } },
          { ref: 'fantome', pos: { x: 20, y: 12 } },
          { ref: 'banshee', pos: { x: 16, y: 2 } },
          { ref: 'spectre-de-cairn', pos: { x: 14, y: 12 } },
          { ref: 'vampire', pos: { x: 16, y: 8 }, optionals: [{ id: 'champion' }] },
        ],
        onVictory: zoneVictory(12, {
          money: { gold: 6 },
          xp: 320,
          journal: 'Le Sépulcre : le seigneur est recouché, ses gens dispersés. Son épée, elle, ne dort pas — fouillez le sarcophage.',
          extra: [{ type: 'inflictNightmares' }],
        }),
      },
    ],
  });
}

// ── Zone 13 — L'Antre du Dragon (40×28, cendre/lave) : la finale, l'or, le réveil ───────────

export function makeZone13() {
  resetIds();
  return scene({
    id: 'arene-zone13',
    rest: {}, // on ne bivouaque pas dans l'arène
    label: 'Arène — L’Antre du Dragon',
    desc: 'Le secret du Maître : sous la treizième porte dort un dragon des ténèbres, sur son or.',
    startMessage:
      'L’ANTRE DU DRAGON. La chaleur racle la gorge, l’or scintille entre les coulées de lave. Le dragon DORT. On peut chiper une poignée d’or sans le réveiller… en théorie.',
    rows: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#...LLL................................#',
      '#...LLLL...............................#',
      '#....LLL...............................#',
      '#......LL..............................#',
      '#.......LL.............................#',
      '#........LL............................#',
      '#.........LL...........................#',
      '#..........LL..........................#',
      '#..........LL..........................#',
      '#..........LL..........................#',
      '#.........LL...........................#',
      '#........LL............................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#..................LLLL................#',
      '#.................LLLLLL...............#',
      '#..................LLLL................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '########################################',
    ],
    base: 'cendre',
    legend: { L: 'lave' },
    entities: [
      hero(2, 22),
      P(30, 8, 'tas-or'),
      P(33, 12, 'tas-or'),
      P(29, 14, 'tas-or'),
      P(31, 4, 'oeuf-dragon'),
      P(34, 6, 'oeuf-dragon'),
      P(24, 20, 'crane-monstre'),
      P(8, 20, 'stalagmite'),
      P(15, 6, 'stalagmite'),
      P(25, 3, 'stalagmite'),
      P(5, 16, 'feu-camp', { label: 'Bivouac des servants' }),
      P(6, 17, 'cadavre'),
      P(14, 22, 'ossements'),
      P(22, 8, 'ossements'),
      P(16, 12, 'mare-sang'),
      P(13, 17, 'tas-or', {
        label: 'Or épars (le dragon DORT…)',
        ...fouille(testNode(
          { skill: { id: 'discretion' }, difficulty: 'difficile', label: 'Chiper l’or sous l’œil clos du dragon', stake: { authored: 'Prendre l’or sans un tintement : 8 couronnes ; un seul bruit et le dragon se réveille — combat.' } },
          [
            { type: 'giveMoney', montant: { gold: 8 } },
            { type: 'journal', desc: 'Huit couronnes glissées sans un tintement. Le dragon ronfle toujours.' },
          ],
          [
            { type: 'journal', desc: 'UNE PIÈCE TINTE. L’œil du dragon s’ouvre — d’or en fusion.' },
            { type: 'startCombat', encounter: 'enc-zone13' },
          ],
        ), true),
      }),
      P(36, 22, 'coffre', {
        label: 'Coffre du trésor',
        ...fouille([
          { type: 'giveMoney', montant: { gold: 6 } },
          { type: 'giveTrapping', trappingId: 'arc-elfique' },
          { type: 'journal', desc: 'Dans le coffre d’un pillard digéré : 6 co et un arc elfique que le feu n’a jamais mordu.' },
        ]),
      }),
    ],
    triggers: [fightTrigger('enc-zone13', { x: 22, y: 1, w: 17, h: 26 })],
    encounters: [
      {
        id: 'enc-zone13',
        enemies: [
          { statblock: DRAGON_DES_TENEBRES, appearance: DRAGON_DES_TENEBRES_APPEARANCE, pos: { x: 28, y: 9 } },
          { ref: 'gobelin', pos: { x: 24, y: 5 } },
          { ref: 'gobelin', pos: { x: 26, y: 16 } },
          { ref: 'gobelin', pos: { x: 21, y: 12 }, randomChars: true },
          { ref: 'gobelin', pos: { x: 33, y: 18 } },
          { ref: 'cultiste', pos: { x: 30, y: 3 }, optionals: [{ id: 'armure', value: 1 }] },
        ],
        onVictory: zoneVictory(13, {
          money: { gold: 10 },
          xp: 450,
          journal: 'LE DRAGON EST TOMBÉ. L’arène entière retient son souffle — puis HURLE. Allez réclamer votre titre au Maître !',
        }),
      },
    ],
  });
}
