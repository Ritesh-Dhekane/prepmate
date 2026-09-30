// Screen 1 — Landing: what PrepMate is, and one clear way in.

import { esc, icon, prefersReducedMotion, ROLE_INFO } from '../ui.js'
import { updateSession, getSession } from '../state.js'

const PREVIEW_QUESTION = 'What is the difference between authentication and authorization?'
const PREVIEW_ANSWER =
  'Authentication verifies who a user is, for example logging in. Authorization decides what they can access…'

const FEATURES = [
  {
    icon: 'volume',
    title: 'Spoken questions',
    text: 'Hear every question read aloud while each word lights up as it is spoken.',
  },
  {
    icon: 'keyboard',
    title: 'Focused answers',
    text: 'Five questions, one at a time, in a calm room with nothing else on screen.',
  },
  {
    icon: 'brain',
    title: 'AI analysis',
    text: 'A score, four skill dimensions, strengths, gaps and notes on every answer.',
  },
]

export function render(container, { navigate }) {
  container.innerHTML = `
    <section class="screen landing">
      <div class="container landing-hero">
        <div class="hero-copy">
          <p class="eyebrow"><span class="pulse-dot"></span>AI-powered interview practice</p>
          <h1 class="hero-title">Prepare. Practice. <span class="gradient-text">Perform.</span></h1>
          <p class="hero-text">
            Practice realistic developer interviews, answer questions, and get AI-powered feedback
            on where you can improve.
          </p>
          <div class="hero-actions">
            <a class="btn btn--primary btn--lg btn--glow" href="#/start">
              Start Your Interview ${icon('arrowRight')}
            </a>
          </div>
          <p class="hero-roles mono">
            ${Object.values(ROLE_INFO)
              .map((role) => `<span>${esc(role.short)}</span>`)
              .join('<span aria-hidden="true">•</span>')}
          </p>
        </div>

        <div class="hero-preview card card--raised" aria-hidden="true">
          <div class="preview-bar">
            <span class="preview-dots"><i></i><i></i><i></i></span>
            <span class="chip chip--ai"><span class="pulse-dot"></span>Preview</span>
          </div>
          <div class="preview-voice">
            <span class="preview-avatar">${icon('sparkles')}</span>
            <span>
              <span class="label">AI interviewer</span>
              <span class="muted small" data-preview-status>Speaking…</span>
            </span>
            <span class="waveform is-active" data-preview-wave>
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
            </span>
          </div>
          <p class="label preview-label">Question 2 of 5</p>
          <p class="preview-question" data-preview-question>
            ${PREVIEW_QUESTION.split(' ')
              .map((word) => `<span class="word">${esc(word)}</span>`)
              .join(' ')}
          </p>
          <div class="preview-answer">
            <p class="label">Your answer</p>
            <p class="mono small" data-preview-answer></p>
          </div>
          <div class="preview-analysis">
            <span class="preview-score"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" /><circle class="fill" cx="18" cy="18" r="15" /></svg></span>
            <span>
              <span class="label">Analysis</span>
              <span class="muted small">Reviewed against the key concepts</span>
            </span>
          </div>
        </div>
      </div>

      <div class="container landing-features">
        ${FEATURES.map(
          (feature, i) => `
          <article class="card feature" style="--delay:${i * 90}ms">
            <span class="feature-icon">${icon(feature.icon)}</span>
            <h2>${esc(feature.title)}</h2>
            <p class="muted">${esc(feature.text)}</p>
          </article>`,
        ).join('')}
      </div>

      <div class="container landing-roles">
        <p class="eyebrow">Choose your track</p>
        <h2 class="section-title">Four developer roles, five questions each session</h2>
        <div class="role-grid">
          ${Object.entries(ROLE_INFO)
            .map(
              ([id, role]) => `
            <button type="button" class="card role-tile" data-role="${id}">
              <span class="role-icon">${icon(role.icon)}</span>
              <span class="role-name">${esc(role.name)}</span>
              <span class="muted small">${esc(role.description)}</span>
              <span class="role-cta">Start practice ${icon('arrowRight')}</span>
            </button>`,
            )
            .join('')}
        </div>
      </div>
    </section>`

  container.querySelectorAll('[data-role]').forEach((button) => {
    button.addEventListener('click', () => {
      updateSession({ setup: { ...getSession().setup, role: button.dataset.role } })
      navigate('/start')
    })
  })

  return playPreview(container)
}

// The hero card acts out a session: words light up as if spoken, then an answer types itself.
function playPreview(container) {
  const words = [...container.querySelectorAll('[data-preview-question] .word')]
  const answer = container.querySelector('[data-preview-answer]')
  const status = container.querySelector('[data-preview-status]')
  const wave = container.querySelector('[data-preview-wave]')
  const card = container.querySelector('.hero-preview')

  if (prefersReducedMotion()) {
    words.forEach((word) => word.classList.add('spoken'))
    answer.textContent = PREVIEW_ANSWER
    card.classList.add('is-analyzed')
    wave.classList.remove('is-active')
    status.textContent = 'Question ready'
    return null
  }

  const timers = []
  const later = (ms, fn) => timers.push(setTimeout(fn, ms))

  function cycle() {
    card.classList.remove('is-analyzed')
    answer.textContent = ''
    words.forEach((word) => word.classList.remove('active', 'spoken'))
    wave.classList.add('is-active')
    status.textContent = 'Speaking…'

    words.forEach((word, i) => {
      later(400 + i * 330, () => {
        words[i - 1]?.classList.replace('active', 'spoken')
        word.classList.add('active')
      })
    })
    const spokenAt = 400 + words.length * 330
    later(spokenAt, () => {
      words.at(-1).classList.replace('active', 'spoken')
      wave.classList.remove('is-active')
      status.textContent = 'Question ready'
    })
    ;[...PREVIEW_ANSWER].forEach((char, i) => {
      later(spokenAt + 500 + i * 28, () => (answer.textContent += char))
    })
    const typedAt = spokenAt + 500 + PREVIEW_ANSWER.length * 28
    later(typedAt + 400, () => card.classList.add('is-analyzed'))
    later(typedAt + 4200, cycle)
  }

  cycle()
  return () => timers.forEach(clearTimeout)
}
