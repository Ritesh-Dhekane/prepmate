// Screen 4 — Interview complete: send the answers for analysis while an AI "thinking" sequence
// plays, then go to the results. Failures keep the answers and offer a retry.

import { analyzeInterview } from '../api.js'
import { getSession, updateSession } from '../state.js'
import { icon, prefersReducedMotion } from '../ui.js'

const STEPS = [
  'Reading your answers',
  'Checking key concepts',
  'Scoring each answer',
  'Writing your feedback',
]
const MIN_MS = 3200 // long enough to read, short enough not to feel slow

export function render(container, { navigate }) {
  const { interview, result } = getSession()
  if (!interview?.questions?.length || interview.answers.length < interview.questions.length) {
    navigate(interview?.questions?.length ? '/interview' : '/start')
    return null
  }
  if (result) {
    navigate('/results')
    return null
  }

  let timers = []
  let cancelled = false

  function showProgress() {
    container.innerHTML = `
      <section class="screen container state-page analyzing">
        <div class="ai-core" aria-hidden="true">
          <span class="ring ring-1"></span><span class="ring ring-2"></span><span class="ring ring-3"></span>
          <span class="core">${icon('sparkles')}</span>
          ${Array.from({ length: 8 }, (_, i) => `<span class="orbit-dot" style="--i:${i}"></span>`).join('')}
        </div>
        <p class="eyebrow"><span class="pulse-dot"></span>Interview complete</p>
        <h1 class="page-title">Interview complete.</h1>
        <p class="muted">Your responses are being analyzed by PrepMate AI.</p>
        <ol class="ai-steps" aria-live="polite">
          ${STEPS.map((step) => `<li><span class="step-icon"></span>${step}</li>`).join('')}
        </ol>
      </section>`

    const items = [...container.querySelectorAll('.ai-steps li')]
    const every = prefersReducedMotion() ? 0 : MIN_MS / STEPS.length
    items.forEach((item, i) => {
      timers.push(
        setTimeout(() => {
          items[i - 1]?.classList.replace('active', 'done')
          item.classList.add('active')
        }, i * every),
      )
    })
    return items
  }

  function showError(message) {
    container.innerHTML = `
      <section class="screen container state-page">
        <div class="card state-card">
          <span class="state-icon state-icon--warn">${icon('alert')}</span>
          <h1>We couldn't complete the analysis</h1>
          <p class="muted">${message} Your answers are still safe.</p>
          <div class="state-actions">
            <button type="button" class="btn btn--primary" data-retry>${icon('refresh')} Try again</button>
            <a class="btn btn--ghost" href="#/">${icon('home')} Back to Home</a>
          </div>
        </div>
      </section>`
    container.querySelector('[data-retry]').addEventListener('click', run)
  }

  async function run() {
    timers.forEach(clearTimeout)
    timers = []
    const items = showProgress()
    const started = Date.now()
    try {
      const data = await analyzeInterview({
        role: interview.role,
        difficulty: interview.difficulty,
        answers: interview.answers.map(({ questionId, answer }) => ({ questionId, answer })),
      })
      const remaining = prefersReducedMotion() ? 0 : Math.max(0, MIN_MS - (Date.now() - started))
      await wait(remaining)
      if (cancelled) return
      items.forEach((item) => item.classList.remove('active') || item.classList.add('done'))
      await wait(prefersReducedMotion() ? 0 : 450)
      if (cancelled) return
      updateSession({ result: { ...data, analyzedAt: new Date().toISOString() } })
      navigate('/results')
    } catch {
      if (cancelled) return
      timers.forEach(clearTimeout)
      showError('The analysis service is having trouble right now.')
    }
  }

  run()
  return () => {
    cancelled = true
    timers.forEach(clearTimeout)
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
