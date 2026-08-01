import { contextBridge, ipcRenderer } from 'electron'

const api = {
  restartDiscord: () => ipcRenderer.invoke('discord:restart'),
}

contextBridge.exposeInMainWorld('api', api)
