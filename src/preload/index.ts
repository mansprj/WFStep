import { contextBridge, ipcRenderer } from 'electron'
import type { AutomationAction } from '@shared/actions'
import type { AppInput } from '@shared/apps'
import type { WorkflowInput, WorkflowProgress } from '@shared/workflows'

const api = {
  process: {
    status: (name: string) => ipcRenderer.invoke('process:status', name),
    kill: (name: string) => ipcRenderer.invoke('process:kill', name),
    restart: (name: string) => ipcRenderer.invoke('process:restart', name),
    killByPath: (path: string) => ipcRenderer.invoke('process:killExe', path),
    restartByPath: (path: string) => ipcRenderer.invoke('process:restartExe', path),
    launch: (path: string) => ipcRenderer.invoke('process:launch', path),
  },
  dialogs: {
    selectExecutable: () => ipcRenderer.invoke('dialog:selectExecutable'),
    selectImage: () => ipcRenderer.invoke('dialog:selectImage'),
  },
  icons: {
    get: (path: string) => ipcRenderer.invoke('icon:get', path),
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
  workflows: {
    list: () => ipcRenderer.invoke('workflows:list'),
    add: (input: WorkflowInput) => ipcRenderer.invoke('workflows:add', input),
    update: (id: string, input: WorkflowInput) =>
      ipcRenderer.invoke('workflows:update', id, input),
    remove: (id: string) => ipcRenderer.invoke('workflows:remove', id),
    run: (id: string) => ipcRenderer.invoke('workflows:run', id),
    cancel: () => ipcRenderer.invoke('workflows:cancel'),
    onProgress: (callback: (progress: WorkflowProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: WorkflowProgress) => {
        callback(progress)
      }
      ipcRenderer.on('workflow:progress', listener)
      return () => {
        ipcRenderer.removeListener('workflow:progress', listener)
      }
    },
  },
}

contextBridge.exposeInMainWorld('api', api)
