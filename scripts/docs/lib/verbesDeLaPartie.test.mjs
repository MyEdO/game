// Un nom, un type désigné (`unNomUnTypeDesigne`) et les littéraux en mots du lexique (`litterauxDuLexique`),
// .claude/rules/verbes-du-noyau.md, sur des tables de verbes forgées.
import test from 'node:test'
import assert from 'node:assert/strict'
import { litterauxDuLexique, unNomUnTypeDesigne } from './verbesDeLaPartie.mjs'

const designe = (cle) => ({ genre: 'chaine', designe: { cle, mot: cle } })
const parametre = (nom, forme) => ({ nom, optionnel: false, type: 'string', forme })
const objet = (type, champs) => ({ genre: 'objet', type, champs: champs.map(([nom, forme]) => ({ nom, optionnel: false, forme })) })

test('un nom qui désigne deux types lève, en nommant le nom, chaque clé et un verbe de chacune', () => {
  assert.throws(
    () => unNomUnTypeDesigne({ armer: [parametre('actionId', designe('IdDIntention'))], agir: [parametre('actionId', designe('IdDAction'))] }),
    /`actionId` : `IdDIntention` \(armer\), `IdDAction` \(agir\)/,
  )
})

test('le champ d’un objet anonyme compte, à travers tableaux et unions', () => {
  const role = { genre: 'union', membres: [{ genre: 'null' }, { genre: 'tableau', element: objet('{ heroId: string; }', [['heroId', designe('IdDeCombattant')]]) }] }
  assert.throws(() => unNomUnTypeDesigne({ affecter: [parametre('role', role)], renvoyer: [parametre('heroId', designe('IdDeHeros'))] }), /`heroId`/)
})

test('une union de désignations est sa propre clé, quel que soit l’ordre de ses membres', () => {
  const union = (a, b) => ({ genre: 'union', membres: [designe(a), designe(b), { genre: 'null' }] })
  assert.doesNotThrow(() => unNomUnTypeDesigne({ a: [parametre('aEvaluer', union('IdDObjet', 'IdDeLigne'))], b: [parametre('aEvaluer', union('IdDeLigne', 'IdDObjet'))] }))
})

test('un champ de type nommé, un membre d’union discriminée et un nom non désigné se qualifient hors de la carte', () => {
  const discriminee = { genre: 'union', membres: [
    objet('{ kind: "hero"; id: string; }', [['kind', { genre: 'litteral', valeur: 'hero' }], ['id', designe('IdDeHeros')]]),
    objet('{ kind: "npc"; id: string; }', [['kind', { genre: 'litteral', valeur: 'npc' }], ['id', designe('IdDePnj')]]),
  ] }
  assert.doesNotThrow(() => unNomUnTypeDesigne({
    talent: [parametre('talent', objet('RefDesignee', [['id', designe('IdDeTalent')]]))],
    competence: [parametre('skill', objet('RefDesignee', [['id', designe('IdDeCompetence')]]))],
    taverne: [parametre('opponent', discriminee)],
    flux: [parametre('mode', { genre: 'litteral', valeur: 'detection' })],
    armer: [parametre('mode', designe('IdDeMode'))],
  }))
})

const litteral = (valeur) => ({ genre: 'litteral', valeur })
const LEXIQUE = new Set(['brouillon', 'trot', 'galop', 'bras', 'droit'])

test('un littéral de paramètre, à travers champs, unions et types récursifs, en mots du lexique passe', () => {
  const allure = { genre: 'union', membres: [litteral('trot'), litteral('galop'), { genre: 'null' }] }
  assert.doesNotThrow(() => litterauxDuLexique(
    { partir: [parametre('opts', objet('{ allure: Allure; }', [['allure', allure], ['localisation', { genre: 'ref', type: 'Loc' }]]))] },
    { Loc: { genre: 'union', membres: [litteral('brasDroit'), { genre: 'tableau', element: { genre: 'ref', type: 'Loc' } }] } },
    LEXIQUE,
    [],
  ))
})

test('un littéral de paramètre hors du lexique lève, en nommant le verbe, le paramètre, le membre et ses mots en faute', () => {
  assert.throws(
    () => litterauxDuLexique({ partir: [parametre('opts', objet('{ allure: Allure; }', [['allure', { genre: 'union', membres: [litteral('trot'), litteral('gallopFast')] }]]))] }, {}, LEXIQUE, []),
    /partir\(opts\)\.allure `gallopFast` \(gallop, fast\)/,
  )
})

test('une union qui recopie un espace d’ids est une donnée, hors du lexique', () => {
  const caracteristique = { genre: 'union', membres: [litteral('force'), litteral('capacite-de-tir')] }
  assert.doesNotThrow(() => litterauxDuLexique({ acheter: [parametre('char', caracteristique)] }, {}, LEXIQUE, [new Set(['force', 'capacite-de-tir', 'endurance'])]))
  assert.throws(() => litterauxDuLexique({ acheter: [parametre('char', caracteristique)] }, {}, LEXIQUE, [new Set(['force'])]), /acheter\(char\) `force`/)
})
