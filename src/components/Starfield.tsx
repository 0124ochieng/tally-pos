import { useEffect, useRef } from 'react'
import { useTheme } from '../app/ThemeContext'

// A quiet decorative background for the login/activation screens only — the
// main app never renders this behind real work. Canvas-based (one draw call
// per frame for all stars, not one DOM node each) specifically so it stays
// cheap: capped particle count, capped device-pixel-ratio, paused when the
// tab is hidden, and skipped entirely under prefers-reduced-motion or in
// light theme.
const DISTURB_RADIUS = 100
const DISTURB_RADIUS_SQ = DISTURB_RADIUS * DISTURB_RADIUS
const MAX_SPEED = 0.285

interface Star {
  baseX: number
  baseY: number
  vx: number
  vy: number
  size: number
  alpha: number
  dx: number
  dy: number
  blur: number // 0 = crisp, >0 = soft glow radius
  pulseSpeed: number
  pulsePhase: number
  trail: { x: number; y: number }[] | null
}

export function Starfield() {
  const { theme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (theme !== 'dark') return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let stars: Star[] = []
    let mouseX = -9999
    let mouseY = -9999
    let raf = 0

    function sizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function makeStars() {
      // Scales gently with screen size but stays capped — plenty dense
      // without ever taxing a frame budget.
      const count = Math.min(280, Math.max(80, Math.round((width * height) / 7000)))
      const trailBudget = Math.min(10, Math.max(3, Math.round(count * 0.06)))
      let trailsAssigned = 0
      stars = Array.from({ length: count }, () => {
        const pick = Math.random()
        const size = pick < 0.5 ? 0.5 : pick < 0.85 ? 1 : 2
        const isSoft = Math.random() < 0.3
        const givesTrail = trailsAssigned < trailBudget && Math.random() < 0.08
        if (givesTrail) trailsAssigned++
        return {
          baseX: Math.random() * width,
          baseY: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.288,
          vy: (Math.random() - 0.5) * 0.288,
          size,
          alpha: 0.35 + Math.random() * 0.5,
          dx: 0,
          dy: 0,
          blur: isSoft ? 2 + Math.random() * 3 : 0,
          pulseSpeed: 0.0006 + Math.random() * 0.0018,
          pulsePhase: Math.random() * Math.PI * 2,
          trail: givesTrail ? [] : null,
        }
      })
    }

    sizeCanvas()
    makeStars()

    function handleResize() {
      sizeCanvas()
      makeStars()
    }
    function handleMouseMove(e: MouseEvent) {
      mouseX = e.clientX
      mouseY = e.clientY
    }
    function handleMouseLeave() {
      mouseX = -9999
      mouseY = -9999
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible' && !reduceMotion) {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(draw)
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('visibilitychange', handleVisibility)

    function draw(time: number) {
      ctx!.clearRect(0, 0, width, height)
      for (const s of stars) {
        // Organic wandering: an occasional small random nudge to velocity,
        // clamped to a max speed so it stays a drift, not a dart.
        if (Math.random() < 0.02) {
          s.vx += (Math.random() - 0.5) * 0.3
          s.vy += (Math.random() - 0.5) * 0.3
          const speed = Math.hypot(s.vx, s.vy)
          if (speed > MAX_SPEED) {
            s.vx = (s.vx / speed) * MAX_SPEED
            s.vy = (s.vy / speed) * MAX_SPEED
          }
        }

        s.baseX += s.vx
        s.baseY += s.vy
        if (s.baseX < 0) s.baseX = width
        else if (s.baseX > width) s.baseX = 0
        if (s.baseY < 0) s.baseY = height
        else if (s.baseY > height) s.baseY = 0

        const cx = s.baseX + s.dx
        const cy = s.baseY + s.dy
        const distX = cx - mouseX
        const distY = cy - mouseY
        const distSq = distX * distX + distY * distY

        // Push away like a hand trailing through water — stronger the
        // closer the cursor sits, then eases back via the decay below.
        if (distSq < DISTURB_RADIUS_SQ) {
          const dist = Math.sqrt(distSq) || 0.01
          const force = (1 - dist / DISTURB_RADIUS) * 14
          s.dx += (distX / dist) * force * 0.15
          s.dy += (distY / dist) * force * 0.15
        }
        s.dx *= 0.9
        s.dy *= 0.9

        const drawX = s.baseX + s.dx
        const drawY = s.baseY + s.dy

        // Gentle shimmer/pulse — each star breathes at its own phase/speed.
        const twinkle = 0.55 + 0.45 * Math.sin(time * s.pulseSpeed + s.pulsePhase)
        const alpha = s.alpha * twinkle

        if (s.trail) {
          s.trail.unshift({ x: drawX, y: drawY })
          if (s.trail.length > 6) s.trail.length = 6
          for (let i = s.trail.length - 1; i >= 0; i--) {
            const fade = (1 - i / s.trail.length) * alpha * 0.5
            ctx!.beginPath()
            ctx!.arc(s.trail[i].x, s.trail[i].y, Math.max(0.3, s.size / 2 - i * 0.15), 0, Math.PI * 2)
            ctx!.fillStyle = `rgba(245, 245, 247, ${fade})`
            ctx!.fill()
          }
        }

        ctx!.beginPath()
        ctx!.arc(drawX, drawY, s.size / 2, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(245, 245, 247, ${alpha})`
        if (s.blur > 0) {
          ctx!.shadowBlur = s.blur
          ctx!.shadowColor = `rgba(245, 245, 247, ${alpha})`
        } else {
          ctx!.shadowBlur = 0
        }
        ctx!.fill()
      }
      ctx!.shadowBlur = 0
      if (document.visibilityState === 'visible') raf = requestAnimationFrame(draw)
    }

    if (reduceMotion) {
      draw(0) // one static frame, no loop
    } else {
      raf = requestAnimationFrame(draw)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [theme])

  if (theme !== 'dark') return null

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />
}
