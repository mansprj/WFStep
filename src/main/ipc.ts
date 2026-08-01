import { ipcMain } from 'electron'
import { restartProcess } from './processManager'

const DISCORD_PROCESS_NAME = 'Discord'

export function registerIpcHandlers(): void {
  ipcMain.handle('discord:restart', () => restartProcess(DISCORD_PROCESS_NAME))
}
