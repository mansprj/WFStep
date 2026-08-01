import { contextBridge, ipcRenderer } from 'electron'
import type { AutomationAction } from '@shared/actions'

const api = {
  process: {
    status: (name: string) => ipcRenderer.invoke('process:status', name),
    kill: (name: string) => ipcRenderer.invoke('process:kill', name),
    restart: (name: string) => ipcRenderer.invoke('process:restart', name),
    launch: (path: string) => ipcRenderer.invoke('process:launch', path),
  },
  dialogs: {
    selectExecutable: () => ipcRenderer.invoke('dialog:selectExecutable'),
  },
  actions: {
    run: (action: AutomationAction) => ipcRenderer.invoke('action:run', action),
  },
}

contextBridge.exposeInMainWorld('api', api)
