/** Web Audio 合成音效，无需素材文件。iOS 需在首次用户交互时调用 ensure()。 */
export class Sfx {
  private ctx: AudioContext | null = null
  muted = false

  ensure(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AC) this.ctx = new AC()
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}
  ): void {
    if (this.muted || !this.ctx) return
    const { type = 'sine', gain = 0.15, delay = 0, slideTo } = opts
    const ctx = this.ctx
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  swap(): void {
    this.tone(560, 0.08, { type: 'triangle', gain: 0.1, slideTo: 720 })
  }

  invalid(): void {
    this.tone(180, 0.16, { type: 'square', gain: 0.06, slideTo: 120 })
  }

  select(): void {
    this.tone(880, 0.05, { type: 'sine', gain: 0.07 })
  }

  /** 消除音，音调随连击升高 */
  pop(combo: number): void {
    const f = 420 + Math.min(combo, 8) * 90
    this.tone(f, 0.13, { type: 'sine', gain: 0.18, slideTo: f * 2 })
    this.tone(f * 1.5, 0.1, { type: 'triangle', gain: 0.08, delay: 0.04 })
  }

  /** 连击成就音：上扬琶音 */
  fanfare(combo: number): void {
    const base = 520 + Math.min(combo, 6) * 40
    ;[0, 4, 7, 12].forEach((semi, i) => {
      this.tone(base * Math.pow(2, semi / 12), 0.12, { type: 'triangle', gain: 0.1, delay: i * 0.07 })
    })
  }

  land(): void {
    this.tone(240, 0.06, { type: 'sine', gain: 0.05 })
  }

  shuffle(): void {
    for (let i = 0; i < 6; i++) {
      this.tone(300 + i * 60, 0.05, { type: 'triangle', gain: 0.05, delay: i * 0.05 })
    }
  }
}
