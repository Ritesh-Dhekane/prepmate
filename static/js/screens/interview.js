// Screen 3 — Interview room: hear the question, read it with the spoken word highlighted, answer.

import { QuestionPlayer } from '../audio.js'
import { getSession, updateSession } from '../state.js'
import { DIFFICULTY_LABEL, esc, icon, ROLE_INFO } from '../ui.js'

const MAX_CHARS = 2000
const STATUS = {
  loading: { text: 'Preparing question…', wave: false },
  playing: { text: 'Interviewer is speaking', wave: true },
  done: { text: 'Question ready', wave: false },
  blocked: { text: 'Tap play to hear the question', wave: false },
  error: { text: "Question audio couldn't be loaded. You can still read the question below.", wave: false },
}

export function render(container, { navigate }) {
  const interview = getSession().interview
  if (!interview?.questions?.length) {
    container.innerHTML = `
      <section class="screen container state-page">
        <div class="card state-card">
          <span class="state-icon">${icon('info')}</span>
          <h1>No interview in progress</h1>
          <p class="muted">Set up an interview to get your five questions.</p>
          <a class="btn btn--primary" href="#/start">Set up an interview ${icon('arrowRight')}</a>
        </div>
      </section>`
    return null
  }
  if (interview.index >= interview.questions.length) {
    navigate('/analyzing')
    return null
  }

  const total = interview.questions.length
  const roleShort = ROLE_INFO[interview.role]?.short ?? interview.roleName

  container.innerHTML = `
    <section class="screen interview">
      <div class="container">
        <header class="room-bar card">
          <a class="brand" href="#/" data-exit aria-label="Leave the interview">
            <img src="/static/img/logo.svg" alt="" /><span>PrepMate <span class="accent">AI</span></span>
          </a>
          <div class="room-progress">
            <div class="room-progress-text mono">
              <span>Question <strong data-q-number></strong> of ${total}</span>
              <span class="accent" data-q-percent></span>
            </div>
            <div class="segments" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" data-progress>
              ${'<span></span>'.repeat(total)}
            </div>
          </div>
          <span class="chip">${icon(ROLE_INFO[interview.role]?.icon ?? 'layers')} ${esc(roleShort)} · ${esc(DIFFICULTY_LABEL[interview.difficulty] ?? '')}</span>
        </header>

        <div class="room" data-room>
          <article class="card question-card">
            <div class="voice-bar" data-voice>
              <span class="voice-icon" data-voice-icon>${icon('volume')}</span>
              <span class="voice-status" data-voice-status aria-live="polite"></span>
              <span class="waveform" data-wave aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></span>
              <button type="button" class="btn btn--ghost btn--sm" data-replay>${icon('replay')} Replay</button>
            </div>
            <p class="label"><span class="pulse-dot"></span>Question</p>
            <h1 class="question-text" data-question></h1>
            <footer class="question-meta small">
              <span data-topic></span>
              <span class="mono muted" data-qid></span>
            </footer>
          </article>

          <form class="card answer-card" novalidate>
            <div class="answer-head">
              <label for="answer" class="answer-title"><span class="dot"></span>Your Answer</label>
              <span class="mono small muted" data-count></span>
            </div>
            <textarea id="answer" name="answer" maxlength="${MAX_CHARS}" placeholder="Type your answer here..." aria-describedby="answer-hint answer-error"></textarea>
            <p id="answer-hint" class="small muted answer-hint">${icon('lightbulb')} Answer in your own words. Explain the idea, then give an example if you can.</p>
            <p id="answer-error" class="form-error" role="alert" data-answer-error></p>
            <div class="answer-actions">
              <span class="small muted kbd-hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit</span>
              <button class="btn btn--primary btn--lg btn--glow" type="submit" data-submit></button>
            </div>
          </form>
        </div>
      </div>
    </section>`

  const $ = (selector) => container.querySelector(selector)
  const textarea = $('#answer')
  const form = $('.answer-card')
  let player = null
  let words = []
  let busy = false

  function showQuestion() {
    const { index, questions } = getSession().interview
    const question = questions[index]
    const isLast = index === total - 1

    $('[data-q-number]').textContent = String(index + 1).padStart(2, '0')
    $('[data-q-percent]').textContent = `${Math.round((index / total) * 100)}% completed`
    $('[data-progress]').setAttribute('aria-valuenow', index)
    $('[data-progress]').setAttribute('aria-label', `Question ${index + 1} of ${total}`)
    container.querySelectorAll('[data-progress] span').forEach((segment, i) => {
      segment.className = i < index ? 'done' : i === index ? 'current' : ''
    })

    const tokens = question.wordTimings?.length
      ? question.wordTimings.map((timing) => timing.word)
      : question.question.split(' ')
    $('[data-question]').innerHTML = tokens
      .map((word) => `<span class="word">${esc(word)}</span>`)
      .join(' ')
    words = [...container.querySelectorAll('[data-question] .word')]
    $('[data-topic]').innerHTML = `${icon('target')} ${esc(question.topic)}`
    $('[data-qid]').textContent = `ID: ${question.id}`

    textarea.value = ''
    textarea.disabled = false
    updateCount()
    $('[data-answer-error]').textContent = ''
    $('[data-submit]').innerHTML = isLast
      ? `Finish Interview ${icon('check')}`
      : `Submit Answer ${icon('arrowRight')}`

    player?.destroy()
    player = new QuestionPlayer({
      src: question.audio,
      timings: question.wordTimings,
      onState: setVoiceState,
      onWord: highlight,
    })
    player.play()
  }

  function setVoiceState(state) {
    const status = STATUS[state]
    $('[data-voice]').dataset.state = state
    $('[data-voice-status]').textContent = status.text
    $('[data-wave]').classList.toggle('is-active', status.wave)
    $('[data-voice-icon]').innerHTML = icon(state === 'error' ? 'volumeOff' : 'volume')
    const replay = $('[data-replay]')
    replay.innerHTML = state === 'blocked' ? `${icon('play')} Play` : `${icon('replay')} Replay`
    replay.hidden = state === 'error'
    $('[data-question]').classList.toggle('is-speaking', state === 'playing')
  }

  function highlight(index) {
    words.forEach((word, i) => {
      word.classList.toggle('active', i === index)
      word.classList.toggle('spoken', i < index)
    })
  }

  function updateCount() {
    $('[data-count]').textContent = `${textarea.value.length} / ${MAX_CHARS}`
  }

  async function submit() {
    if (busy) return
    const answer = textarea.value.trim()
    if (!answer) {
      $('[data-answer-error]').textContent = 'Please enter your answer before continuing.'
      textarea.focus()
      return
    }
    busy = true
    const session = getSession()
    const { index, questions, answers } = session.interview
    const question = questions[index]
    const nextAnswers = [
      ...answers.filter((a) => a.questionId !== question.id),
      {
        questionId: question.id,
        question: question.question,
        answer,
        submittedAt: new Date().toISOString(),
      },
    ]
    const nextIndex = index + 1
    const done = nextIndex >= questions.length
    updateSession({
      interview: {
        ...session.interview,
        answers: nextAnswers,
        index: nextIndex,
        completedAt: done ? new Date().toISOString() : null,
      },
    })

    textarea.disabled = true
    player?.destroy()
    $('[data-submit]').innerHTML = `${icon('check')} Saved`
    const room = $('[data-room]')
    room.classList.add('is-leaving')
    await wait(380)
    if (done) {
      navigate('/analyzing')
      return
    }
    room.classList.remove('is-leaving')
    room.classList.add('is-entering')
    showQuestion()
    textarea.focus({ preventScroll: true })
    await wait(420)
    room.classList.remove('is-entering')
    busy = false
  }

  textarea.addEventListener('input', () => {
    updateCount()
    if (textarea.value.trim()) $('[data-answer-error]').textContent = ''
  })
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
    }
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submit()
  })
  $('[data-replay]').addEventListener('click', () => player?.play())
  $('[data-exit]').addEventListener('click', (event) => {
    if (!confirm('Leave the interview? Your answers so far will be kept in this tab.')) {
      event.preventDefault()
    }
  })

  showQuestion()
  return () => player?.destroy()
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
