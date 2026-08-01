import { contextBridge, ipcRenderer } from 'electron'

const api = {
  process: {
    status: (name: string) => ipcRenderer.invoke('process:status', name),
    kill: (name: string) => ipcRenderer.invoke('process:kill', name),
    restart: (name: string) => ipcRenderer.invoke('process:restart', name),
    launch: (path: string) => ipcRenderer.invoke('process:launch', path),
  },
}

contextBridge.exposeInMainWorld('api', api)
