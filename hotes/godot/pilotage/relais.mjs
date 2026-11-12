#!/usr/bin/env node
/**
 * @contrat Transport
 * - Sous une recette native (#3945), le pont du processus est `hotes/godot/pilotage/relais.mjs` : il recopie son entrée
 *   sur la socket locale dont l'environnement dit le port (`WFRP_RELAIS`), et ce qu'elle rend sur sa sortie. Le lanceur
 *   de la recette (`hotes/godot/pilotage/natif.mjs`) y sert le protocole (`servirLeCanal`), le pont, le serveur du jeu
 *   et le parcours dans son propre processus.
 */
import { connect } from 'node:net'

const canal = connect(Number(process.env.WFRP_RELAIS), '127.0.0.1')
process.stdin.pipe(canal).pipe(process.stdout)
