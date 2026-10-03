// The interview session, kept in sessionStorage so a refresh doesn't lose answers.
// It lives only in this browser tab and is never sent anywhere except /api/analyze.

const KEY = 'prepmate-session'

const EMPTY = {
  profile: { name: '', email: '', experience: 'student' },
  setup: { role: null, difficulty: 'medium', type: 'technical' },
  interview: null, // { roleName, questions, index, answers, startedAt, completedAt }
  result: null,
}

function read() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    return saved ? { ...structuredClone(EMPTY), ...saved } : structuredClone(EMPTY)
  } catch {
    return structuredClone(EMPTY)
  }
}

let session = read()

export function getSession() {
  return session
}

export function updateSession(changes) {
  session = { ...session, ...changes }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Storage can be unavailable (private mode); the session still works until the tab closes.
  }
  return session
}

// Start again but keep who you are and your last setup.
export function resetInterview() {
  return updateSession({ interview: null, result: null })
}
