// PrepMate AI — tiny hash router. Each screen module exports render(container) and may return a
// cleanup function (stop audio, timers) that runs when you leave the screen.

import * as interview from './screens/interview.js'
import * as landing from './screens/landing.js'
import * as notFound from './screens/not-found.js'
import * as setup from './screens/setup.js'

const ROUTES = {
  '/': { screen: landing, title: 'Prepare. Practice. Perform.' },
  '/start': { screen: setup, title: 'Set up your interview' },
  '/interview': { screen: interview, title: 'Interview', focus: true },
}

const app = document.getElementById('app')
let cleanup = null

export function navigate(path) {
  if (location.hash === `#${path}`) render()
  else location.hash = path
}

function currentPath() {
  // Plain anchors like "#app" (the skip link) aren't routes.
  return location.hash.startsWith('#/') ? location.hash.slice(1) : '/'
}

let shown = null

function render() {
  const path = currentPath()
  const route = ROUTES[path] ?? { screen: notFound, title: 'Not found' }

  if (typeof cleanup === 'function') cleanup()
  document.body.classList.toggle('focus-mode', Boolean(route.focus))
  document.title = `${route.title} · PrepMate AI`
  app.innerHTML = ''
  cleanup = route.screen.render(app, { navigate })
  shown = path

  window.scrollTo(0, 0)
  // Move focus to the new screen for keyboard and screen-reader users.
  app.focus({ preventScroll: true })
}

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/') || location.hash === '' || shown === null) render()
})
render()
