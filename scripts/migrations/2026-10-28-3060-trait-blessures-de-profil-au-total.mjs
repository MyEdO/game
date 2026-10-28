/**
 * Migration #3060 (lot Trait, #1463) — les Blessures de profil « au total » : un « +N Blessures » imprimé à
 * côté d'un changement de Caractéristique est le changement TOTAL des Blessures max que produit la source
 * (lecture révisable consignée sur #3060).
 *
 * GESTES :
 *  1. `trappings.json › bonnet-de-fou` : son `attrMod` de Blessures +4 devient `auTotal` (LDB 71 l.20).
 *  2. `maneuvers.json › forme-hybride-ulric` : la forme hybride gagne l'`attrMod` de Blessures +4 `auTotal`
 *     de son profil (Middenheim 04 l.27), et son enjeu le dit.
 *
 * ENTRÉES : écrites — `src/data/trappings.json`, `src/data/maneuvers.json`.
 * FORME D'AVANT SEULE : chaque geste n'agit que sur l'entrée ENTIÈRE à sa forme d'avant exacte, quel que soit
 * l'ordre de ses clés ; une entrée déjà à la forme cible, révisée après la migration, ou absente, est laissée
 * telle quelle.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne final).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as egal } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const F = { trappings: 'src/data/trappings.json', maneuvers: 'src/data/maneuvers.json' };

const fautes = [];
const docs = new Map();
for (const rel of Object.values(F)) {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte });
}
let gestes = 0;

/** Remplace, à sa place dans `liste`, l'entrée d'id `id` qui vaut EXACTEMENT `avant` (quel que soit l'ordre de
 *  ses clés) par `apres` ; une entrée révisée ou absente est laissée telle quelle. */
const remplacer = (liste, id, avant, apres) => {
  const i = liste.findIndex((e) => e.id === id);
  if (i < 0 || !egal(liste[i], avant)) return;
  liste[i] = apres;
  gestes++;
};

// 1. trappings.json
const BONNET_AVANT = {
  "id": "bonnet-de-fou",
  "type": "trappings",
  "label": "Bonnet de fou",
  "categorie": "trapping",
  "subType": "drogues-et-poisons",
  "enc": 0,
  "availability": "Exotique",
  "reach": null,
  "loc": null,
  "pa": null,
  "damage": null,
  "qualities": [],
  "desc": "Ces champignons hallucinogènes sont consommés par les gobelins fanatiques avant la bataille. Ils induisent une rage berserk, ajoutant +10 en Force, +4 Blessures et le Talent Frénésie. Quand l'effet se dissipe, l'utilisateur perd 1d10 Points de Blessure. Tous ceux qui ne sont pas des peaux-vertes doivent aussi réussir un Test de Résistance Intermédiaire (+0) ou contracter une Infection mineure. Durée: actif tant qu'il est mâché plus 2d10 minutes supplémentaires.",
  "price": {
    "gold": 5,
    "silver": 0,
    "brass": 0
  },
  "source": {
    "book": "livre-de-base",
    "page": 306
  },
  "consumable": {
    "kind": "seq",
    "steps": [
      {
        "kind": "do",
        "effect": {
          "type": "ops",
          "ops": [
            {
              "op": "charMod",
              "char": "force",
              "mod": 10
            },
            {
              "op": "attrMod",
              "attr": "wounds",
              "mod": 4
            },
            {
              "op": "grantTalent",
              "talent": {
                "id": "frenesie"
              }
            },
            {
              "op": "delayed",
              "afterDuration": true,
              "ops": [
                {
                  "op": "wounds",
                  "amount": {
                    "dice": {
                      "n": 1,
                      "sides": 10
                    }
                  },
                  "ignoreTB": true,
                  "ignoreAP": true
                }
              ]
            }
          ]
        }
      },
      {
        "kind": "test",
        "test": {
          "skill": {
            "id": "resistance"
          },
          "difficulty": "intermediaire",
          "exceptGroups": [
            "peau-verte"
          ],
          "label": "Bonnet de fou"
        },
        "success": {
          "kind": "seq",
          "steps": []
        },
        "fail": {
          "kind": "do",
          "effect": {
            "type": "ops",
            "ops": [
              {
                "op": "contractDisease",
                "disease": "infection-mineure"
              }
            ]
          }
        }
      }
    ]
  },
  "consumableDuration": {
    "minutes": {
      "dice": {
        "n": 2,
        "sides": 10
      }
    }
  }
};
const bonnetApres = structuredClone(BONNET_AVANT);
const opsDuBonnet = bonnetApres.consumable.steps[0].effect.ops;
opsDuBonnet[opsDuBonnet.findIndex((o) => o.op === 'attrMod')] = { op: 'attrMod', attr: 'wounds', mod: 4, auTotal: true };
remplacer(docs.get(F.trappings).doc, 'bonnet-de-fou', BONNET_AVANT, bonnetApres);

// 2. maneuvers.json
const HYBRIDE_AVANT = {
  "id": "forme-hybride-ulric",
  "type": "maneuvers",
  "label": "Prendre forme hybride",
  "kind": "hurlement",
  "activation": "action",
  "advantageCost": 0,
  "targeting": "self",
  "effects": [
    {
      "trigger": "onHit",
      "on": "self",
      "flow": {
        "kind": "do",
        "effect": {
          "type": "ops",
          "on": "target",
          "ops": [
            {
              "op": "transform",
              "tag": "ulric-hybride",
              "morphRef": "enfant-d-ulric",
              "ops": [
                {
                  "op": "charMod",
                  "char": "capacite-de-combat",
                  "mod": 10
                },
                {
                  "op": "charMod",
                  "char": "force",
                  "mod": 10
                },
                {
                  "op": "charMod",
                  "char": "endurance",
                  "mod": 10
                },
                {
                  "op": "charMod",
                  "char": "initiative",
                  "mod": 10
                },
                {
                  "op": "charMod",
                  "char": "agilite",
                  "mod": 10
                },
                {
                  "op": "charMod",
                  "char": "dexterite",
                  "mod": -10
                },
                {
                  "op": "charMod",
                  "char": "intelligence",
                  "mod": -10
                },
                {
                  "op": "charMod",
                  "char": "sociabilite",
                  "mod": -20
                },
                {
                  "op": "moveMod",
                  "mod": 1
                },
                {
                  "op": "grantTrait",
                  "trait": {
                    "id": "arme",
                    "value": {
                      "sum": [
                        {
                          "bonusOf": "force"
                        },
                        4
                      ]
                    }
                  }
                },
                {
                  "op": "grantTrait",
                  "trait": {
                    "id": "armure",
                    "value": 2
                  }
                },
                {
                  "op": "grantTrait",
                  "trait": {
                    "id": "morsure",
                    "value": {
                      "sum": [
                        {
                          "bonusOf": "force"
                        },
                        3
                      ]
                    }
                  }
                },
                {
                  "op": "grantTrait",
                  "trait": {
                    "id": "peur",
                    "value": 2
                  }
                },
                {
                  "op": "grantTrait",
                  "trait": {
                    "id": "pisteur"
                  }
                },
                {
                  "op": "grantTrait",
                  "trait": {
                    "id": "vision-nocturne"
                  }
                }
              ]
            },
            {
              "op": "loseTurn",
              "what": "action"
            }
          ]
        }
      }
    }
  ],
  "source": {
    "book": "middenheim",
    "page": 116
  },
  "stake": "Sur soi : la forme hybride prend — Capacité de Combat, Force, Endurance, Initiative et Agilité +10, Dextérité et Intelligence −10, Sociabilité −20, Mouvement +1, et les Traits Arme (BF +4), Armure 2, Morsure (BF +3), Peur 2, Pisteur, Vision nocturne — au prix de l’Action du tour.",
  "stakeForm": "descripteur"
};
const hybrideApres = structuredClone(HYBRIDE_AVANT);
const transform = hybrideApres.effects[0].flow.effect.ops[0];
transform.ops.splice(transform.ops.findIndex((o) => o.op === 'moveMod') + 1, 0, { op: 'attrMod', attr: 'wounds', mod: 4, auTotal: true });
hybrideApres.stake = hybrideApres.stake.replace('Mouvement +1, et', 'Mouvement +1, Blessures +4 au total, et');
remplacer(docs.get(F.maneuvers).doc, 'forme-hybride-ulric', HYBRIDE_AVANT, hybrideApres);

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc, avant }] of docs) {
  const apres = serializeDataset(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 3060 Blessures de profil au total : ${gestes} geste(s).`);
