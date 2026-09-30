// Screen 5 — AI analysis: score, skill dimensions, summary, strengths, gaps, practice topics and
// a question-by-question review. Shows a clear notice when this is the basic (non-AI) analysis.

import { getSession, resetInterview, updateSession } from '../state.js'
import { DIFFICULTY_LABEL, esc, formatDuration, icon, prefersReducedMotion, ROLE_INFO } from '../ui.js'

const METRICS = [
  { key: 'technicalKnowledge', label: 'Technical Knowledge', icon: 'brain', text: 'Accuracy of concepts and terminology.' },
  { key: 'answerRelevance', label: 'Answer Relevance', icon: 'target', text: 'How directly each answer addressed the question.' },
  { key: 'conceptClarity', label: 'Concept Clarity', icon: 'lightbulb', text: 'How clearly ideas were explained and developed.' },
  { key: 'communication', label: 'Communication', icon: 'keyboard', text: 'Structure and readability of the answers.' },
]

function band(score) {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Strong foundation'
  if (score >= 50) return 'Developing'
  return 'Getting started'
}

export function render(container, { navigate }) {
  const { interview, result } = getSession()
  if (!result || !interview) {
    navigate(interview?.questions?.length ? '/analyzing' : '/start')
    return null
  }

  const isAi = result.source === 'ai'
  const answersById = Object.fromEntries(interview.answers.map((a) => [a.questionId, a]))
  const questionsById = Object.fromEntries(interview.questions.map((q) => [q.id, q]))
  const spent =
    interview.completedAt && interview.startedAt
      ? formatDuration(new Date(interview.completedAt) - new Date(interview.startedAt))
      : null
  const role = ROLE_INFO[interview.role]

  container.innerHTML = `
    <section class="screen container results">
      <header class="results-head">
        <div>
          <p class="eyebrow">${icon(isAi ? 'sparkles' : 'checkCircle')} ${isAi ? 'AI assessment complete' : 'Assessment complete'}</p>
          <h1 class="page-title">${isAi ? 'Your AI Interview Analysis' : 'Your Interview Analysis'}</h1>
          <p class="muted">${esc(interview.roleName)} · ${esc(DIFFICULTY_LABEL[interview.difficulty] ?? '')} difficulty · ${interview.answers.length} questions</p>
        </div>
        ${spent ? `<div class="meta-box mono"><span class="label">Time spent</span><strong>${spent}</strong></div>` : ''}
      </header>

      ${
        isAi
          ? ''
          : `<div class="notice" role="status">${icon('alert')}<div><strong>AI analysis isn't available right now.</strong> <span>${esc(result.notice ?? '')}</span></div></div>`
      }

      <div class="score-row">
        <div class="card score-card">
          <div class="score-ring" data-score="${result.overallScore}">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#818cf8"/></linearGradient></defs>
              <circle class="track" cx="60" cy="60" r="52" />
              <circle class="value" cx="60" cy="60" r="52" />
            </svg>
            <div class="score-number"><strong data-count-to="${result.overallScore}">0</strong><span>/100</span></div>
          </div>
          <p class="sr-only">Overall score ${result.overallScore} out of 100</p>
          <span class="chip chip--ai">${icon('checkCircle')} ${band(result.overallScore)}</span>
          <p class="small muted center">Average of your five question scores.</p>
        </div>
        <div class="metric-grid">
          ${METRICS.map(
            (metric, i) => `
            <article class="card metric" style="--delay:${i * 80}ms">
              <div class="metric-head"><span class="label">Dimension 0${i + 1}</span>${icon(metric.icon)}</div>
              <h2>${metric.label}</h2>
              <p class="small muted">${metric.text}</p>
              <div class="metric-bar"><span style="--value:${result.metrics[metric.key]}%"></span></div>
              <p class="mono metric-value">${result.metrics[metric.key]}%</p>
            </article>`,
          ).join('')}
        </div>
      </div>

      <article class="card summary-card">
        <span class="summary-icon">${icon('sparkles')}</span>
        <div>
          <h2>${isAi ? 'AI Summary' : 'Summary'}</h2>
          <p>${esc(result.summary)}</p>
        </div>
      </article>

      <div class="two-col">
        <article class="card list-card list-card--good">
          <h2>${icon('trendUp')} Your Strengths</h2>
          <ul>${result.strengths.map((s) => `<li>${icon('checkCircle')}<span>${esc(s)}</span></li>`).join('')}</ul>
        </article>
        <article class="card list-card list-card--improve">
          <h2>${icon('flag')} Areas to Improve</h2>
          <ul>${result.improvements.map((s) => `<li>${icon('flag')}<span>${esc(s)}</span></li>`).join('')}</ul>
        </article>
      </div>

      ${
        result.recommendations.length
          ? `<section class="practice">
        <p class="eyebrow">Next steps</p>
        <h2 class="section-title">Recommended Practice</h2>
        <div class="practice-grid">
          ${result.recommendations
            .map(
              (topic, i) => `
            <article class="card practice-card">
              <span class="label">Topic 0${i + 1}</span>
              <h3>${esc(topic)}</h3>
              <p class="small muted">Revisit this topic, then try another ${esc(role?.short ?? '')} interview.</p>
              <button type="button" class="btn btn--ghost btn--sm" data-practice>Practice ${icon('arrowRight')}</button>
            </article>`,
            )
            .join('')}
        </div>
      </section>`
          : ''
      }

      <section class="review">
        <p class="eyebrow">Transcript</p>
        <h2 class="section-title">Question-by-Question Review</h2>
        ${result.questionFeedback
          .map((fb, i) => {
            const question = questionsById[fb.questionId]
            const answer = answersById[fb.questionId]
            return `
          <details class="card review-item" ${i === 0 ? 'open' : ''}>
            <summary>
              <span class="review-num mono">0${i + 1}</span>
              <span class="review-title"><strong>${esc(question?.question ?? fb.questionId)}</strong><span class="small muted">${esc(question?.topic ?? '')}</span></span>
              <span class="review-score mono score-${fb.score >= 7 ? 'good' : fb.score >= 4 ? 'mid' : 'low'}">${fb.score} / 10</span>
              ${icon('chevronDown', 'icon chevron')}
            </summary>
            <div class="review-body">
              <div class="review-block"><p class="label">Your answer</p><p class="answer-text">${esc(answer?.answer ?? '')}</p></div>
              <div class="review-block review-block--ai"><p class="label">${icon('sparkles')} ${isAi ? 'AI feedback' : 'Feedback'}</p><p>${esc(fb.feedback)}</p></div>
              ${
                fb.expectedTopics?.length
                  ? `<div class="review-block"><p class="label">A strong answer covers</p><ul class="covers">${fb.expectedTopics.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`
                  : ''
              }
            </div>
          </details>`
          })
          .join('')}
      </section>

      <div class="results-actions">
        <button type="button" class="btn btn--primary btn--lg btn--glow" data-again>${icon('refresh')} Try Another Interview</button>
        <a class="btn btn--ghost btn--lg" href="#/" data-home>${icon('home')} Back to Home</a>
      </div>
      <p class="disclaimer small muted">${icon('info')} Scores are practice feedback to help you prepare, not an employment evaluation.</p>
    </section>`

  function again() {
    resetInterview()
    navigate('/start')
  }
  container.querySelector('[data-again]').addEventListener('click', again)
  container.querySelectorAll('[data-practice]').forEach((button) => button.addEventListener('click', again))
  container.querySelector('[data-home]').addEventListener('click', () => {
    updateSession({ interview: null, result: null })
  })

  return animateScore(container, result.overallScore)
}

function animateScore(container, score) {
  const ring = container.querySelector('.score-ring')
  const number = container.querySelector('[data-count-to]')
  if (prefersReducedMotion()) {
    ring.style.setProperty('--score', score)
    number.textContent = score
    container.querySelector('.results').classList.add('is-revealed')
    return null
  }
  let frame
  const start = performance.now()
  const duration = 1400
  requestAnimationFrame(() => {
    container.querySelector('.results').classList.add('is-revealed')
    ring.style.setProperty('--score', score)
  })
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    number.textContent = Math.round(score * eased)
    if (t < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
  return () => cancelAnimationFrame(frame)
}
