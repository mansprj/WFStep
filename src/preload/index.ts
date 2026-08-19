import { contextBridge, ipcRenderer } from 'electron'
import type { AutomationAction } from '@shared/actions'
import type { LogEntry } from '@shared/logs'
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
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  },
  icons: {
    get: (path: string) => ipcRenderer.invoke('icon:get', path),
  },
  favicons: {
    get: (url: string) => ipcRenderer.invoke('favicon:get', url),
  },
  pages: {
    title: (url: string) => ipcRenderer.invoke('page:title', url),
  },
  actions: {
    run: (action: AutomationAction) => ipcRenderer.invoke('action:run', action),
  },
  logs: {
    list: () => ipcRenderer.invoke('logs:list'),
    clear: () => ipcRenderer.invoke('logs:clear'),
    onEntry: (callback: (entry: LogEntry) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry): void => {
        callback(entry)
      }
      ipcRenderer.on('log:entry', listener)
      return () => {
        ipcRenderer.removeListener('log:entry', listener)
      }
    },
    onCleared: (callback: () => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('log:cleared', listener)
      return () => {
        ipcRenderer.removeListener('log:cleared', listener)
      }
    },
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
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (value: Partial<{ autostart: boolean }>) =>
      ipcRenderer.invoke('settings:set', value),
  },
  updates: {
    download: () => ipcRenderer.send('updates:download'),
    install: () => ipcRenderer.send('updates:install'),
    onStatus: (callback: (status: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: string): void => {
        callback(status)
      }
      ipcRenderer.on('update:status', listener)
      return () => {
        ipcRenderer.removeListener('update:status', listener)
      }
    },
  },
}

contextBridge.exposeInMainWorld('api', api)
