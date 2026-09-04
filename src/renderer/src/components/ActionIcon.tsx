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
  activateWindow: (
    <svg viewBox="0 0 16 16" fill="none">
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M1.5 5.5h13"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6 8h4M6 10.5h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  waitForWindow: (
    <svg viewBox="0 0 16 16" fill="none">
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M8 6.5v2.5l1.8 1.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  clickText: (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        d="M4 3l3.5 8.5L9 8l3-1.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 3.5V1M12.5 8.5v-2.5M9.25 3.5h6.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
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
