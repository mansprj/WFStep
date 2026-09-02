import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { isValidMacro, isValidMacroInput } from '@shared/macros'
import type { Macro, MacroInput, MacroMutationResult } from '@shared/macros'

function storeFile(): string {
  return join(app.getPath('userData'), 'macros.json')
}

let cache: Macro[] | null = null

function readMacros(): Macro[] {
  if (cache !== null) {
    return cache
  }
  const file = storeFile()
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as unknown
    cache = Array.isArray(raw) ? raw.filter(isValidMacro) : []
  } catch {
    cache = []
  }
  return cache
}

function writeMacros(macros: Macro[]): void {
  const file = storeFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(macros, null, 2))
  cache = macros
}

function sanitizeInput(value: unknown): MacroInput | null {
  if (!isValidMacroInput(value)) {
    return null
  }
  let hotkey: string | null = value.hotkey?.trim() ?? null
  if (hotkey !== null && hotkey.length === 0) {
    hotkey = null
  }
  return { name: value.name.trim(), steps: value.steps, hotkey }
}

export function listMacros(): Macro[] {
  return readMacros()
}

export function addMacro(value: unknown): MacroMutationResult {
  const input = sanitizeInput(value)
  if (input === null) {
    return { success: false, message: 'Invalid macro data.' }
  }

  const macros = readMacros()
  if (
    macros.some((macro) => macro.name.toLowerCase() === input.name.toLowerCase())
  ) {
    return {
      success: false,
      message: `Macro "${input.name}" already exists.`,
    }
  }

  const entry: Macro = { id: randomUUID(), ...input }
  writeMacros([...macros, entry])
  return { success: true, message: `Saved ${entry.name}.`, macro: entry }
}

export function updateMacro(id: unknown, value: unknown): MacroMutationResult {
  if (typeof id !== 'string') {
    return { success: false, message: 'Invalid macro id.' }
  }

  const input = sanitizeInput(value)
  if (input === null) {
    return { success: false, message: 'Invalid macro data.' }
  }

  const macros = readMacros()
  const index = macros.findIndex((macro) => macro.id === id)
  if (index === -1) {
    return { success: false, message: 'Macro not found.' }
  }

  const duplicate = macros.find(
    (macro) => macro.id !== id && macro.name.toLowerCase() === input.name.toLowerCase(),
  )
  if (duplicate !== undefined) {
    return {
      success: false,
      message: `Macro "${input.name}" already exists.`,
    }
  }

  const updated: Macro = { ...macros[index], ...input }
  macros[index] = updated
  writeMacros(macros)
  return { success: true, message: `Updated ${updated.name}.`, macro: updated }
}

export function removeMacro(id: unknown): MacroMutationResult {
  if (typeof id !== 'string') {
    return { success: false, message: 'Invalid macro id.' }
  }

  const macros = readMacros()
  const entry = macros.find((macro) => macro.id === id)
  if (entry === undefined) {
    return { success: false, message: 'Macro not found.' }
  }

  writeMacros(macros.filter((macro) => macro.id !== id))
  return { success: true, message: `Removed ${entry.name}.` }
}
