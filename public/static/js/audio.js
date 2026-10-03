// Plays a question's audio and reports which word is being spoken, using the word timings
// generated with the audio (see scripts/generate_audio.py). No speech recognition involved.

export class QuestionPlayer {
  // onState(state): 'loading' | 'playing' | 'done' | 'blocked' (needs a tap) | 'error'
  // onWord(index): index of the word being spoken, or -1 when nothing is
  constructor({ src, timings, onState, onWord }) {
    this.timings = timings ?? []
    this.destroyed = false
    // Ignore anything the audio element reports after this player is thrown away.
    this.onState = (state) => !this.destroyed && onState(state)
    this.onWord = (index) => !this.destroyed && onWord(index)
    this.frame = null
    this.current = -1
    this.audio = new Audio()
    this.audio.preload = 'auto'
    this.audio.addEventListener('playing', () => {
      this.onState('playing')
      this.tick()
    })
    this.audio.addEventListener('ended', () => this.finish())
    this.audio.addEventListener('error', () => {
      this.stop()
      this.onState('error')
    })
    this.onState('loading')
    this.audio.src = src
  }

  async play() {
    this.setWord(-1)
    this.onState('loading')
    try {
      this.audio.currentTime = 0
      await this.audio.play()
    } catch (error) {
      // Browsers block sound until the user has interacted with the page.
      if (error?.name === 'NotAllowedError') this.onState('blocked')
      else if (error?.name !== 'AbortError') this.onState('error')
    }
  }

  tick = () => {
    const time = this.audio.currentTime
    let index = -1
    for (let i = 0; i < this.timings.length; i++) {
      if (time >= this.timings[i].start) index = i
      else break
    }
    this.setWord(index)
    this.frame = requestAnimationFrame(this.tick)
  }

  setWord(index) {
    if (index !== this.current) {
      this.current = index
      this.onWord(index)
    }
  }

  finish() {
    this.stop()
    this.setWord(this.timings.length) // everything spoken
    this.onState('done')
  }

  stop() {
    cancelAnimationFrame(this.frame)
    this.frame = null
  }

  destroy() {
    this.destroyed = true
    this.stop()
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
  }
}
