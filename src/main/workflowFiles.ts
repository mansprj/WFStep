import { readFileSync, writeFileSync } from 'node:fs'
import { isValidWorkflowInput } from '@shared/workflows'
import type { WorkflowInput } from '@shared/workflows'
import type { ActionResult } from '@shared/types'
import { selectJsonOpen, selectJsonSave } from './dialogs'

interface ExportResult extends ActionResult {
  path?: string
}

interface ImportResult extends ActionResult {
  input?: WorkflowInput
}

function safeWorkflowName(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim().replace(/[ ]+/g, ' ')
}

export async function exportWorkflow(input: WorkflowInput): Promise<ExportResult> {
  if (!isValidWorkflowInput(input)) {
    return { success: false, message: 'Invalid workflow data.' }
  }
  const path = await selectJsonSave(`${safeWorkflowName(input.name)}.json`)
  if (path === null) {
    return { success: false, message: 'Export cancelled.' }
  }
  try {
    writeFileSync(
      path,
      JSON.stringify({ format: 'wfstep-workflow', version: 1, workflow: input }, null, 2),
      'utf-8',
    )
    return { success: true, message: `Exported to ${path}.`, path }
  } catch (error) {
    return { success: false, message: `Failed to write ${path}: ${error instanceof Error ? error.message : String(error)}` }
  }
}

export async function importWorkflow(): Promise<ImportResult> {
  const path = await selectJsonOpen()
  if (path === null) {
    return { success: false, message: 'Import cancelled.' }
  }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return { success: false, message: `"${path}" is not valid JSON.` }
  }
  const candidate = asWorkflowInput(raw)
  if (!isValidWorkflowInput(candidate)) {
    return { success: false, message: `"${path}" does not contain a valid workflow.` }
  }
  return { success: true, message: `Imported ${candidate.name}.`, input: candidate }
}

// Accepts both a bare workflow object and the exported wrapper
// { format: "wfstep-workflow", version: 1, workflow: {...} }.
function asWorkflowInput(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return value
  }
  const record = value as Record<string, unknown>
  if (
    record.format === 'wfstep-workflow' &&
    typeof record.workflow === 'object' &&
    record.workflow !== null
  ) {
    return record.workflow
  }
  return value
}