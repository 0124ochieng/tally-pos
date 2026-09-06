// Short, synthesized notification sounds — generated in code with the Web
// Audio API rather than shipped as audio files, so there's no extra binary
// weight in the installer and nothing to load over a slow disk. Every
// sound is under a third of a second and deliberately soft: this plays on
// a shared shop till, often near customers, so nothing here should feel
// like a game or an alarm.

import { getSoundEnabled, setSoundEnabled } from './settings'

type SoundKind = 'success' | 'error' | 'info' | 'tick'

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  // Browsers suspend a freshly-created context until a user gesture — any
  // call here already happens in response to one (a click, a completed
  // sale), so just make sure it's actually running.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(audio: AudioContext, startAt: number, freq: number, durationSec: number, peakGain: number) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, startAt)
  osc.connect(gain)
  gain.connect(audio.destination)

  // Quick fade in, gentle fade out — avoids the harsh "click" a hard
  // on/off edge would make on cheap speakers.
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec)

  osc.start(startAt)
  osc.stop(startAt + durationSec + 0.02)
}

export { getSoundEnabled as isSoundEnabled, setSoundEnabled }

export function playSound(kind: SoundKind) {
  if (!getSoundEnabled()) return
  const audio = getContext()
  if (!audio) return
  const now = audio.currentTime

  switch (kind) {
    case 'success':
      // A short, friendly two-note rise.
      tone(audio, now, 660, 0.11, 0.05)
      tone(audio, now + 0.08, 880, 0.16, 0.05)
      break
    case 'error':
      // A single low, brief tone — noticeable, not alarming.
      tone(audio, now, 300, 0.18, 0.05)
      break
    case 'info':
      tone(audio, now, 523, 0.13, 0.04)
      break
    case 'tick':
      // Very short and quiet — the "item landed in the cart" click.
      tone(audio, now, 1046, 0.045, 0.03)
      break
  }
}
