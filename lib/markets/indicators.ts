// Pure technical-indicator + volume maths for the Markets focus chart. Everything
// here is deterministic, isomorphic and node-testable — the chart component only
// projects these arrays to SVG. No fabrication: an indicator is `null` wherever
// there isn't enough history to compute it honestly.

import type { Candle } from "@/lib/markets/chart";

/** Simple moving average, aligned to `values`; null until `period` samples exist. */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export interface Band { mid: number | null; upper: number | null; lower: number | null }
/** Bollinger bands: SMA(period) ± mult·σ over a trailing window (population σ). */
export function bollinger(values: number[], period = 20, mult = 2): Band[] {
  const out: Band[] = values.map(() => ({ mid: null, upper: null, lower: null }));
  if (period <= 0) return out;
  for (let i = period - 1; i < values.length; i++) {
    let mean = 0;
    for (let j = i - period + 1; j <= i; j++) mean += values[j];
    mean /= period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - mean) ** 2;
    const sd = Math.sqrt(variance / period);
    out[i] = { mid: mean, upper: mean + mult * sd, lower: mean - mult * sd };
  }
  return out;
}

/** Wilder's RSI (0..100), aligned to `values`; null for the first `period` samples. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1 || period <= 0) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  const rsiAt = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  out[period] = rsiAt(avgGain, avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = rsiAt(avgGain, avgLoss);
  }
  return out;
}

export interface VolBin { lo: number; hi: number; volume: number }
/** Volume-by-price profile: `bins` equal price buckets across the range, each
 *  summing the volume of candles whose typical price ((h+l+c)/3) lands in it.
 *  The max-volume bin is the point-of-control (high-density support/resistance). */
export function volumeProfile(candles: Candle[], bins = 24): VolBin[] {
  if (candles.length === 0 || bins <= 0) return [];
  let lo = Infinity, hi = -Infinity;
  for (const k of candles) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; }
  if (!(hi > lo)) return [];
  const step = (hi - lo) / bins;
  const out: VolBin[] = Array.from({ length: bins }, (_, i) => ({ lo: lo + i * step, hi: lo + (i + 1) * step, volume: 0 }));
  for (const k of candles) {
    const price = (k.h + k.l + k.c) / 3;
    let idx = Math.floor((price - lo) / step);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    out[idx].volume += Math.max(0, k.v);
  }
  return out;
}

/** Index of the highest-volume bin (point of control); -1 for an empty profile. */
export function pointOfControl(profile: VolBin[]): number {
  let best = -1, max = -Infinity;
  for (let i = 0; i < profile.length; i++) if (profile[i].volume > max) { max = profile[i].volume; best = i; }
  return best;
}

/** Min-max rescale a series into [outLo, outHi] — used to overlay a benchmark's
 *  SHAPE on the instrument's price axis for correlation (not a price claim). */
export function rescaleShape(values: number[], outLo: number, outHi: number): number[] {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!Number.isFinite(lo) || hi === lo) return values.map(() => (outLo + outHi) / 2);
  const m = (outHi - outLo) / (hi - lo);
  return values.map((v) => outLo + (v - lo) * m);
}

export interface Anomaly { t: number; idx: number; pct: number; up: boolean }
/** Data-driven event anchors: bars whose single-step return is ≥ k·σ from the mean
 *  return — the abrupt moves worth flagging on the time axis. No external dataset,
 *  so nothing is invented; each anchor carries the real % move and its timestamp. */
export function anomalyFlags(candles: Candle[], k = 2.5): Anomaly[] {
  if (candles.length < 8) return [];
  const rets: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].c;
    rets.push(prev !== 0 ? (candles[i].c - prev) / prev : 0);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
  if (sd === 0) return [];
  const out: Anomaly[] = [];
  for (let i = 0; i < rets.length; i++) {
    if (Math.abs(rets[i] - mean) >= k * sd) {
      out.push({ t: candles[i + 1].t, idx: i + 1, pct: rets[i] * 100, up: rets[i] >= 0 });
    }
  }
  return out;
}
