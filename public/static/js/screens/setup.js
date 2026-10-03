// Screen 2 — Onboarding & setup: your details, the role, and the interview settings on one page.

import { ApiError, loadQuestions } from '../api.js'
import { getSession, resetInterview, updateSession } from '../state.js'
import { DIFFICULTY_LABEL, esc, icon, ROLE_INFO } from '../ui.js'

const EXPERIENCE = { fresher: 'Fresher', student: 'Student', experienced: 'Experienced' }
const TYPES = {
  technical: { label: 'Technical', hint: 'Five technical questions for your role.' },
  mixed: { label: 'Mixed', hint: 'Three technical questions plus two general ones.' },
}
const DIFFICULTY_HINT = {
  easy: 'Core definitions and fundamentals.',
  medium: 'Practical understanding and common trade-offs.',
  hard: 'Deeper concepts, design and edge cases.',
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function render(container, { navigate }) {
  const session = getSession()
  const form = {
    ...session.profile,
    ...session.setup,
  }

  container.innerHTML = `
    <section class="screen container setup">
      <header class="setup-head">
        <div>
          <p class="eyebrow"><span class="pulse-dot"></span>Interview setup</p>
          <h1 class="page-title">Let's get you ready.</h1>
          <p class="muted">Three quick steps, then your interview begins.</p>
        </div>
        <ol class="stepper" aria-label="Progress">
          <li data-step="profile"><span>1</span>Profile</li>
          <li data-step="role"><span>2</span>Role</li>
          <li data-step="setup"><span>3</span>Setup</li>
        </ol>
      </header>

      <form class="setup-form" novalidate>
        <section class="card setup-section" aria-labelledby="step-profile">
          <h2 id="step-profile" class="section-heading"><span class="step-num mono">01</span>Tell us a little about yourself</h2>
          <div class="field-grid">
            <label class="field">
              <span class="field-label">Full name</span>
              <span class="input-wrap">${icon('user')}<input name="name" autocomplete="name" maxlength="80" required placeholder="Your name" value="${esc(form.name)}" /></span>
              <span class="field-error" data-error="name"></span>
            </label>
            <label class="field">
              <span class="field-label">Email</span>
              <span class="input-wrap">${icon('mail')}<input name="email" type="email" autocomplete="email" maxlength="120" required placeholder="you@example.com" value="${esc(form.email)}" /></span>
              <span class="field-error" data-error="email"></span>
            </label>
            <fieldset class="field">
              <legend class="field-label">Experience level</legend>
              <div class="segmented" data-group="experience">
                ${Object.entries(EXPERIENCE)
                  .map(
                    ([id, label]) =>
                      `<label><input type="radio" name="experience" value="${id}" ${form.experience === id ? 'checked' : ''} /><span>${label}</span></label>`,
                  )
                  .join('')}
              </div>
            </fieldset>
          </div>
          <p class="privacy-note small muted">${icon('info')} Kept in this browser tab only. Nothing is stored on a server.</p>
        </section>

        <section class="card setup-section" aria-labelledby="step-role">
          <h2 id="step-role" class="section-heading"><span class="step-num mono">02</span>What are you preparing for?</h2>
          <div class="role-cards" role="radiogroup" aria-labelledby="step-role">
            ${Object.entries(ROLE_INFO)
              .map(
                ([id, role]) => `
              <label class="role-card">
                <input type="radio" name="role" value="${id}" ${form.role === id ? 'checked' : ''} />
                <span class="role-card-body">
                  <span class="role-card-top">
                    <span class="role-icon">${icon(role.icon)}</span>
                    <span class="role-check">${icon('check')}</span>
                  </span>
                  <span class="role-name">${esc(role.name)}</span>
                  <span class="muted small">${esc(role.description)}</span>
                  <span class="tags">${role.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</span>
                </span>
              </label>`,
              )
              .join('')}
          </div>
        </section>

        <section class="card setup-section" aria-labelledby="step-setup">
          <h2 id="step-setup" class="section-heading"><span class="step-num mono">03</span>Set up your interview</h2>
          <div class="field-grid field-grid--3">
            <fieldset class="field">
              <legend class="field-label">Difficulty</legend>
              <div class="segmented" data-group="difficulty">
                ${Object.entries(DIFFICULTY_LABEL)
                  .map(
                    ([id, label]) =>
                      `<label><input type="radio" name="difficulty" value="${id}" ${form.difficulty === id ? 'checked' : ''} /><span>${label}</span></label>`,
                  )
                  .join('')}
              </div>
              <span class="small muted" data-hint="difficulty"></span>
            </fieldset>
            <fieldset class="field">
              <legend class="field-label">Interview type</legend>
              <div class="segmented" data-group="type">
                ${Object.entries(TYPES)
                  .map(
                    ([id, type]) =>
                      `<label><input type="radio" name="type" value="${id}" ${form.type === id ? 'checked' : ''} /><span>${type.label}</span></label>`,
                  )
                  .join('')}
              </div>
              <span class="small muted" data-hint="type"></span>
            </fieldset>
            <div class="field">
              <span class="field-label">Questions</span>
              <div class="scope">${icon('clock')}<span><strong>5 questions</strong><span class="muted small"> · about 10–15 min</span></span></div>
              <span class="small muted">Spoken aloud, answered in text.</span>
            </div>
          </div>

          <div class="setup-footer">
            <div class="summary-chip" data-summary></div>
            <button class="btn btn--primary btn--lg btn--glow" type="submit" disabled>
              <span data-start-label>Start Interview</span> ${icon('arrowRight')}
            </button>
          </div>
          <p class="form-error" role="alert" data-form-error></p>
        </section>
      </form>
    </section>`

  const el = container.querySelector('form')
  const startButton = el.querySelector('button[type="submit"]')
  const touched = new Set()

  function read() {
    const data = new FormData(el)
    return {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      experience: data.get('experience') ?? 'student',
      role: data.get('role'),
      difficulty: data.get('difficulty') ?? 'medium',
      type: data.get('type') ?? 'technical',
    }
  }

  function errors(values) {
    return {
      name: values.name.length < 2 ? 'Please enter your name.' : '',
      email: EMAIL.test(values.email) ? '' : 'Please enter a valid email address.',
    }
  }

  function refresh() {
    const values = read()
    const problems = errors(values)
    for (const [field, message] of Object.entries(problems)) {
      const shown = touched.has(field) ? message : ''
      el.querySelector(`[data-error="${field}"]`).textContent = shown
      el.querySelector(`[name="${field}"]`).setAttribute('aria-invalid', shown ? 'true' : 'false')
    }
    const profileDone = !problems.name && !problems.email
    const steps = { profile: profileDone, role: Boolean(values.role), setup: Boolean(values.role) }
    for (const [step, done] of Object.entries(steps)) {
      container.querySelector(`[data-step="${step}"]`).classList.toggle('done', done)
    }
    el.querySelector('[data-hint="difficulty"]').textContent = DIFFICULTY_HINT[values.difficulty]
    el.querySelector('[data-hint="type"]').textContent = TYPES[values.type].hint
    el.querySelector('[data-summary]').innerHTML = values.role
      ? `${icon('sliders')}<span>${esc(ROLE_INFO[values.role].name)} · ${DIFFICULTY_LABEL[values.difficulty]} · ${TYPES[values.type].label}</span>`
      : `<span class="muted">Choose a role to continue</span>`
    startButton.disabled = !(profileDone && values.role)

    updateSession({
      profile: { name: values.name, email: values.email, experience: values.experience },
      setup: { role: values.role ?? null, difficulty: values.difficulty, type: values.type },
    })
    return { values, ok: profileDone && Boolean(values.role) }
  }

  el.addEventListener('input', refresh)
  el.addEventListener('change', refresh)
  el.addEventListener('focusout', (event) => {
    if (event.target.name) touched.add(event.target.name)
    refresh()
  })

  el.addEventListener('submit', async (event) => {
    event.preventDefault()
    touched.add('name').add('email')
    const { values, ok } = refresh()
    if (!ok) {
      el.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    const errorBox = el.querySelector('[data-form-error]')
    errorBox.textContent = ''
    startButton.disabled = true
    startButton.classList.add('is-loading')
    el.querySelector('[data-start-label]').textContent = 'Preparing questions…'
    try {
      const data = await loadQuestions(values)
      resetInterview()
      updateSession({
        interview: {
          role: data.role,
          roleName: data.roleName,
          difficulty: data.difficulty,
          type: data.type,
          questions: data.questions,
          index: 0,
          answers: [],
          startedAt: new Date().toISOString(),
          completedAt: null,
        },
      })
      navigate('/interview')
    } catch (error) {
      errorBox.textContent =
        error instanceof ApiError
          ? error.message
          : "We couldn't load the questions. Please try again."
      startButton.disabled = false
      startButton.classList.remove('is-loading')
      el.querySelector('[data-start-label]').textContent = 'Start Interview'
    }
  })

  refresh()
  return null
}
