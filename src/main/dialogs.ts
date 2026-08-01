import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron'

// Opens a native file picker limited to executables.
// Returns the selected path, or null when cancelled.
export async function selectExecutable(): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: 'Select executable',
    properties: ['openFile'],
    filters: [
      { name: 'Executables', extensions: ['exe'] },
      { name: 'All files', extensions: ['*'] },
    ],
  }

  const window = BrowserWindow.getFocusedWindow()
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
}

// Opens a native file picker limited to common image formats.
// Returns the selected path, or null when cancelled.
export async function selectImage(): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: 'Select image',
    properties: ['openFile'],
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'],
      },
      { name: 'All files', extensions: ['*'] },
    ],
  }

  const window = BrowserWindow.getFocusedWindow()
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
}
