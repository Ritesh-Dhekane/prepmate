// Calls to our Flask API. Errors come back as friendly messages, never raw details.

export class ApiError extends Error {}

async function request(url, options) {
  let response
  try {
    response = await fetch(url, options)
  } catch {
    throw new ApiError("We couldn't reach PrepMate. Check your connection and try again.")
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(body?.error ?? 'Something went wrong. Please try again.')
  }
  return body
}

export function loadQuestions({ role, difficulty, type }) {
  const query = new URLSearchParams({ role, difficulty, type })
  return request(`/api/questions?${query}`)
}

export function analyzeInterview({ role, difficulty, answers }) {
  return request('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, difficulty, answers }),
  })
}
