import { useEffect, useState } from 'react'

type UpdateState = 'idle' | 'available' | 'downloaded'

export default function UpdateIndicator() {
  const [state, setState] = useState<UpdateState>('idle')

  useEffect(() => {
    return window.api.updates.onStatus((s) => {
      if (s === 'idle' || s === 'available' || s === 'downloaded') {
        setState(s)
      }
    })
  }, [])

  if (state === 'idle') {
    return (
      <div className="update-indicator up-to-date" title="Up to date">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    )
  }

  if (state === 'available') {
    return (
      <div
        className="update-indicator has-update"
        title="Update available — click to download"
        onClick={() => window.api.updates.download()}
        role="button"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="update-dot" />
      </div>
    )
  }

  return (
    <div
      className="update-indicator ready-to-install"
      title="Update ready — click to restart"
      onClick={() => window.api.updates.install()}
      role="button"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span className="update-dot ready" />
    </div>
  )
}
