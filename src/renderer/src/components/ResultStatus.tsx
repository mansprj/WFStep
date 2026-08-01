import type { Result } from '../result'

interface ResultStatusProps {
  result: Result
}

function ResultStatus({ result }: ResultStatusProps) {
  if (result.kind === 'idle') {
    return null
  }

  if (result.kind === 'working') {
    return <p className="status working">{result.label}</p>
  }

  return <p className={`status ${result.kind}`}>{result.message}</p>
}

export default ResultStatus
