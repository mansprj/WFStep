import { contextBridge, ipcRenderer } from 'electron'
import type { AutomationAction } from '@shared/actions'
import type { AppInput } from '@shared/apps'

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
  apps: {
    list: () => ipcRenderer.invoke('apps:list'),
    add: (input: AppInput) => ipcRenderer.invoke('apps:add', input),
    update: (id: string, input: AppInput) =>
      ipcRenderer.invoke('apps:update', id, input),
    remove: (id: string) => ipcRenderer.invoke('apps:remove', id),
  },
}

contextBridge.exposeInMainWorld('api', api)
