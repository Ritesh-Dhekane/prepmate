import { icon } from '../ui.js'

export function render(container) {
  container.innerHTML = `
    <section class="screen container state-page">
      <div class="card state-card">
        <span class="state-icon">${icon('info')}</span>
        <h1>This page doesn't exist</h1>
        <p class="muted">Let's get you back to practising.</p>
        <a class="btn btn--primary" href="#/">${icon('home')} Back to Home</a>
      </div>
    </section>`
  return null
}
