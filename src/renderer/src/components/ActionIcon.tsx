import type { ReactElement } from 'react'
import type { ActionKind } from '../actionForm'

const ICONS: Record<ActionKind, ReactElement> = {
  start: (
    <svg viewBox="0 0 16 16">
      <path d="M4 2l10 6-10 6z" fill="currentColor" />
    </svg>
  ),
  stop: (
    <svg viewBox="0 0 16 16">
      <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" />
    </svg>
  ),
  restart: (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        d="M13.5 8A5.5 5.5 0 1 1 8 2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13 1.5v3.2H9.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  delay: (
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 5v3.5l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  shell: (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        d="M2 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  openUrl: (
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M2 8h12M8 2c2 1.7 2 10.3 0 12M8 2c-2 1.7-2 10.3 0 12"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  openFolder: (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 2h4.5A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

interface ActionIconProps {
  kind: ActionKind
}

function ActionIcon({ kind }: ActionIconProps) {
  return <span className="action-icon">{ICONS[kind]}</span>
}

export default ActionIcon
