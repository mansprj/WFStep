import { execFile } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface WindowMatch {
  title: string
  process: string
}

// Runs a PowerShell script and returns its stdout trimmed. Using
// -EncodedCommand (base64, UTF-16LE) avoids all quoting/escaping issues.
async function runPowershell(script: string, timeoutMs = 15000): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: timeoutMs },
  )
  return stdout.trim()
}

// Lists visible windows as { title, process } pairs using Get-Process.
export async function listWindows(): Promise<WindowMatch[]> {
  const ps = `
    Get-Process | Where-Object { $_.MainWindowTitle } |
      Select-Object @{n='title';e={$_.MainWindowTitle}}, @{n='process';e={$_.ProcessName}} |
      ConvertTo-Json -Compress
  `
  try {
    const out = await runPowershell(ps)
    if (out.length === 0) {
      return []
    }
    const parsed = JSON.parse(out)
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    return arr.map((item: Record<string, unknown>) => ({
      title: String(item.title ?? ''),
      process: String(item.process ?? ''),
    }))
  } catch {
    return []
  }
}

// Brings the window (matched by title or process name, case-insensitive
// substring) to the foreground. Returns success and a message.
export async function activateWindow(window: string): Promise<{ success: boolean; message: string }> {
  const token = window.trim()
  if (token.length === 0) {
    return { success: false, message: 'Enter a window title or program name.' }
  }
  const escaped = token.replace(/\\/g, '\\\\').replace(/'/g, "''")
  const ps = `
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
      [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
      [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
      [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    }
"@
    $token = '${escaped}'
    $proc = Get-Process | Where-Object {
      $_.MainWindowHandle -ne 0 -and (
        ($_.MainWindowTitle -and $_.MainWindowTitle.IndexOf($token, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) -or
        ($_.ProcessName.IndexOf($token, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
      )
    } | Select-Object -First 1
    if (-not $proc) { Write-Output 'NOT_FOUND'; exit }
    $h = $proc.MainWindowHandle
    [Win32]::ShowWindow($h, 9) | Out-Null
    [Win32]::SetForegroundWindow($h) | Out-Null
    if ([Win32]::GetForegroundWindow() -eq $h) {
      Write-Output 'OK'
    } else {
      Write-Output 'FAILED'
    }
  `
  try {
    const out = await runPowershell(ps)
    if (out === 'NOT_FOUND') {
      return { success: false, message: `No window found for "${token}".` }
    }
    if (out === 'OK') {
      return { success: true, message: `Activated window "${token}".` }
    }
    return { success: false, message: `Could not activate window "${token}".` }
  } catch (error) {
    return {
      success: false,
      message: `Failed to activate window: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Waits until a window whose title or process name matches appears, or the
// timeout elapses. Polls every 200 ms.
export async function waitForWindow(
  window: string,
  timeoutMs: number,
): Promise<{ success: boolean; message: string }> {
  const token = window.trim()
  const limit = isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000
  if (token.length === 0) {
    return { success: false, message: 'Enter a window title or program name.' }
  }
  const escaped = token.replace(/\\/g, '\\\\').replace(/'/g, "''")
  const started = Date.now()
  while (Date.now() - started < limit) {
    const ps = `
      $token = '${escaped}'
      $found = Get-Process | Where-Object {
        ($_.MainWindowTitle -and $_.MainWindowTitle.IndexOf($token, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) -or
        ($_.ProcessName.IndexOf($token, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
      }
      if ($found) { Write-Output 'FOUND' } else { Write-Output 'WAIT' }
    `
    try {
      const out = await runPowershell(ps, 5000)
      if (out === 'FOUND') {
        return { success: true, message: `Window "${token}" appeared.` }
      }
    } catch {
      // ignore transient errors; keep polling
    }
    await delay(200)
  }
  return { success: false, message: `Timed out waiting for window "${token}".` }
}

// Clicks an element whose accessible name equals the given text using .NET
// UIAutomation (reliable for buttons, links, menu items). Optionally scopes to
// a window by title/process and waits up to timeoutMs for the element.
export async function clickText(
  text: string,
  window?: string,
  timeoutMs?: number,
): Promise<{ success: boolean; message: string }> {
  const name = text.trim()
  const limit =
    typeof timeoutMs === 'number' && isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : 5000
  if (name.length === 0) {
    return { success: false, message: 'Enter the element text to click.' }
  }
  const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "''")
  const escapedWindow = (window ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")

  const ps = `
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $name = '${escapedName}'
    $winToken = '${escapedWindow}'

    $rootEl = [System.Windows.Automation.AutomationElement]::RootElement
    $scopeEl = $rootEl
    if ($winToken -ne '') {
      $winProc = Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and (
          ($_.MainWindowTitle -and $_.MainWindowTitle.IndexOf($winToken, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) -or
          ($_.ProcessName.IndexOf($winToken, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
        )
      } | Select-Object -First 1
      if (-not $winProc) { Write-Output 'WINDOW_NOT_FOUND'; exit }
      try {
        $scopeEl = [System.Windows.Automation.AutomationElement]::FromHandle($winProc.MainWindowHandle)
      } catch {
        $scopeEl = $null
      }
      if (-not $scopeEl) { Write-Output 'WINDOW_NOT_FOUND'; exit }
    }

    $nameCond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::NameProperty, $name)

    $deadline = [DateTime]::Now.AddMilliseconds(${limit})
    $found = $null
    while ([DateTime]::Now -lt $deadline) {
      try {
        $found = $scopeEl.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $nameCond)
      } catch { $found = $null }
      if ($found) { break }
      Start-Sleep -Milliseconds 150
    }
    if (-not $found) { Write-Output 'ELEMENT_NOT_FOUND'; exit }

    $clicked = $false
    foreach ($patternId in @(
        [System.Windows.Automation.InvokePattern]::Pattern,
        [System.Windows.Automation.SelectionItemPattern]::Pattern,
        [System.Windows.Automation.TogglePattern]::Pattern)) {
      try {
        $pattern = $found.GetCurrentPattern($patternId)
        if ($pattern) {
          if ($patternId -eq [System.Windows.Automation.InvokePattern]::Pattern) { $pattern.Invoke() }
          elseif ($patternId -eq [System.Windows.Automation.SelectionItemPattern]::Pattern) { $pattern.Select() }
          elseif ($patternId -eq [System.Windows.Automation.TogglePattern]::Pattern) { $pattern.Toggle() }
          $clicked = $true
          break
        }
      } catch {}
    }
    if ($clicked) { Write-Output 'CLICKED' } else { Write-Output 'NO_PATTERN' }
  `
  try {
    const out = await runPowershell(ps, Math.min(limit + 5000, 60000))
    if (out === 'WINDOW_NOT_FOUND') {
      return { success: false, message: `Window "${window}" not found.` }
    }
    if (out === 'ELEMENT_NOT_FOUND') {
      return { success: false, message: `Element "${name}" not found (or not on screen).` }
    }
    if (out === 'CLICKED') {
      return { success: true, message: `Clicked "${name}".` }
    }
    return { success: false, message: `Found "${name}" but it has no clickable action.` }
  } catch (error) {
    return {
      success: false,
      message: `Failed to click "${name}": ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
