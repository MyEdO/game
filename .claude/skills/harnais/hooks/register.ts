// Mod `harnais` (#2278) : un fichier par fonction, chacune enregistrée ici.
import type { Register } from 'claude-code'
import { suivi } from './suivi'
import { vigie } from './vigie'

export const register: Register = (on) => {
  suivi(on)
  vigie(on)
}
