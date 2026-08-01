import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { isValidWorkflow, isValidWorkflowInput } from '@shared/workflows'
import type {
  Workflow,
  WorkflowInput,
  WorkflowMutationResult,
} from '@shared/workflows'

function storeFile(): string {
  return join(app.getPath('userData'), 'workflows.json')
}

let cache: Workflow[] | null = null

function readWorkflows(): Workflow[] {
  if (cache !== null) {
    return cache
  }
  const file = storeFile()
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as unknown
    cache = Array.isArray(raw) ? raw.filter(isValidWorkflow) : []
  } catch {
    cache = []
  }
  return cache
}

function writeWorkflows(workflows: Workflow[]): void {
  const file = storeFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(workflows, null, 2))
  cache = workflows
}

function sanitizeInput(value: unknown): WorkflowInput | null {
  if (!isValidWorkflowInput(value)) {
    return null
  }
  let iconPath: string | null = value.iconPath?.trim() ?? null
  if (iconPath !== null && iconPath.length === 0) {
    iconPath = null
  }
  return { name: value.name.trim(), actions: value.actions, iconPath }
}

export function listWorkflows(): Workflow[] {
  return readWorkflows()
}

export function addWorkflow(value: unknown): WorkflowMutationResult {
  const input = sanitizeInput(value)
  if (input === null) {
    return { success: false, message: 'Invalid workflow data.' }
  }

  const workflows = readWorkflows()
  if (
    workflows.some((workflow) => workflow.name.toLowerCase() === input.name.toLowerCase())
  ) {
    return {
      success: false,
      message: `Workflow "${input.name}" already exists.`,
    }
  }

  const entry: Workflow = { id: randomUUID(), ...input }
  writeWorkflows([...workflows, entry])
  return { success: true, message: `Added ${entry.name}.`, workflow: entry }
}

export function updateWorkflow(id: unknown, value: unknown): WorkflowMutationResult {
  if (typeof id !== 'string') {
    return { success: false, message: 'Invalid workflow id.' }
  }

  const input = sanitizeInput(value)
  if (input === null) {
    return { success: false, message: 'Invalid workflow data.' }
  }

  const workflows = readWorkflows()
  const index = workflows.findIndex((workflow) => workflow.id === id)
  if (index === -1) {
    return { success: false, message: 'Workflow not found.' }
  }

  const duplicate = workflows.find(
    (workflow) =>
      workflow.id !== id && workflow.name.toLowerCase() === input.name.toLowerCase(),
  )
  if (duplicate !== undefined) {
    return {
      success: false,
      message: `Workflow "${input.name}" already exists.`,
    }
  }

  const updated: Workflow = { ...workflows[index], ...input }
  workflows[index] = updated
  writeWorkflows(workflows)
  return { success: true, message: `Updated ${updated.name}.`, workflow: updated }
}

export function removeWorkflow(id: unknown): WorkflowMutationResult {
  if (typeof id !== 'string') {
    return { success: false, message: 'Invalid workflow id.' }
  }

  const workflows = readWorkflows()
  const entry = workflows.find((workflow) => workflow.id === id)
  if (entry === undefined) {
    return { success: false, message: 'Workflow not found.' }
  }

  writeWorkflows(workflows.filter((workflow) => workflow.id !== id))
  return { success: true, message: `Removed ${entry.name}.` }
}
