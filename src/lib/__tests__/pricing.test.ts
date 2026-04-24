/**
 * Pricing Logic Unit Tests
 * Run with: pnpm test
 *
 * These tests verify the DISPLAY-side price calculation.
 * The authoritative calculation lives in stop_session() database function.
 * Both must produce identical results.
 */

import { describe, it, expect } from 'vitest'
import { calculateSessionPrice } from '../sessions'

describe('calculateSessionPrice', () => {
  describe('Basic calculations', () => {
    it('charges a minimum of 1 minute even for very short sessions', () => {
      // 10 seconds at 60 EGP/hr → should charge for 1 minute = 1 EGP
      const price = calculateSessionPrice(10, 60)
      const expected = (1 / 60) * 60 // 1 minute at 60 EGP/hr
      expect(price).toBeCloseTo(expected, 2)
    })

    it('rounds UP partial minutes (ceil, not floor)', () => {
      // 1 min 30 sec → 2 minutes (ceil)
      // 2 minutes at 60 EGP/hr = 2 EGP
      const price = calculateSessionPrice(90, 60)
      const expected = (2 / 60) * 60 // 2 EGP
      expect(price).toBeCloseTo(expected, 2)
    })

    it('calculates correctly for exactly 1 hour', () => {
      // 3600 seconds = 1 hour at 60 EGP/hr = 60 EGP
      const price = calculateSessionPrice(3600, 60)
      expect(price).toBeCloseTo(60, 2)
    })

    it('calculates correctly for 30 minutes', () => {
      // 1800 seconds = 30 minutes at 60 EGP/hr = 30 EGP
      const price = calculateSessionPrice(1800, 60)
      expect(price).toBeCloseTo(30, 2)
    })

    it('calculates correctly for 45 minutes', () => {
      // 2700 seconds = 45 minutes at 30 EGP/hr = 22.5 EGP
      const price = calculateSessionPrice(2700, 30)
      expect(price).toBeCloseTo(22.5, 2)
    })
  })

  describe('Edge cases — financial safety', () => {
    it('never returns a negative price', () => {
      const price = calculateSessionPrice(-500, 60)
      expect(price).toBeGreaterThanOrEqual(0)
    })

    it('returns 0 when hourly rate is 0', () => {
      const price = calculateSessionPrice(3600, 0)
      expect(price).toBe(0)
    })

    it('handles zero duration correctly (minimum 1 minute)', () => {
      const price = calculateSessionPrice(0, 60)
      expect(price).toBeCloseTo(1, 2) // 1 minute at 60 EGP/hr
    })

    it('handles negative duration correctly (treated as 0, minimum 1 minute)', () => {
      const price = calculateSessionPrice(-1000, 60)
      expect(price).toBeCloseTo(1, 2) // 1 minute at 60 EGP/hr
    })

    it('handles negative hourly rate correctly (treated as 0)', () => {
      const price = calculateSessionPrice(3600, -50)
      expect(price).toBe(0)
    })
  })

  describe('High-value sessions', () => {
    it('handles high-value sessions correctly', () => {
      // 3 hours at 120 EGP/hr = 360 EGP
      const price = calculateSessionPrice(10800, 120)
      expect(price).toBeCloseTo(360, 2)
    })

    it('handles 8-hour sessions correctly', () => {
      // 8 hours at 100 EGP/hr = 800 EGP
      const price = calculateSessionPrice(28800, 100)
      expect(price).toBeCloseTo(800, 2)
    })

    it('handles 24-hour sessions correctly', () => {
      // 24 hours at 50 EGP/hr = 1200 EGP
      const price = calculateSessionPrice(86400, 50)
      expect(price).toBeCloseTo(1200, 2)
    })
  })

  describe('Floating point precision', () => {
    it('does not produce floating point drift on common durations', () => {
      // 45 min at 30 EGP/hr = 22.5 EGP exactly
      const price = calculateSessionPrice(2700, 30)
      // Must be representable without drift
      expect(price.toString()).not.toContain('999')
      expect(price.toString()).not.toContain('001')
      expect(price).toBe(22.5)
    })

    it('rounds correctly to 2 decimal places', () => {
      // 1 min 1 sec at 33 EGP/hr → 2 min (ceil) = 1.1 EGP
      const price = calculateSessionPrice(61, 33)
      expect(price).toBe(1.1)
    })

    it('handles fractional rates correctly', () => {
      // 30 min at 25.5 EGP/hr = 12.75 EGP
      const price = calculateSessionPrice(1800, 25.5)
      expect(price).toBeCloseTo(12.75, 2)
    })

    it('handles very small rates correctly', () => {
      // 1 hour at 0.5 EGP/hr = 0.5 EGP
      const price = calculateSessionPrice(3600, 0.5)
      expect(price).toBeCloseTo(0.5, 2)
    })

    it('handles very large rates correctly', () => {
      // 1 hour at 999.99 EGP/hr = 999.99 EGP
      const price = calculateSessionPrice(3600, 999.99)
      expect(price).toBeCloseTo(999.99, 2)
    })
  })

  describe('Rounding behavior', () => {
    it('rounds 0.5 up to 1 minute', () => {
      // 30 seconds → 1 minute (ceil)
      const price = calculateSessionPrice(30, 60)
      expect(price).toBeCloseTo(1, 2)
    })

    it('rounds 1.1 minutes up to 2 minutes', () => {
      // 66 seconds → 2 minutes (ceil)
      const price = calculateSessionPrice(66, 60)
      expect(price).toBeCloseTo(2, 2)
    })

    it('rounds 1.9 minutes up to 2 minutes', () => {
      // 114 seconds → 2 minutes (ceil)
      const price = calculateSessionPrice(114, 60)
      expect(price).toBeCloseTo(2, 2)
    })

    it('does not round down', () => {
      // 61 seconds → 2 minutes (NOT 1)
      const price = calculateSessionPrice(61, 60)
      expect(price).toBeCloseTo(2, 2)
    })
  })

  describe('Real-world scenarios', () => {
    it('calculates price for a typical 30-minute gaming session', () => {
      // 30 min at 50 EGP/hr = 25 EGP
      const price = calculateSessionPrice(1800, 50)
      expect(price).toBeCloseTo(25, 2)
    })

    it('calculates price for a typical 1-hour gaming session', () => {
      // 1 hour at 50 EGP/hr = 50 EGP
      const price = calculateSessionPrice(3600, 50)
      expect(price).toBeCloseTo(50, 2)
    })

    it('calculates price for a quick 5-minute session', () => {
      // 5 min at 60 EGP/hr = 5 EGP
      const price = calculateSessionPrice(300, 60)
      expect(price).toBeCloseTo(5, 2)
    })

    it('calculates price for a 2-hour session', () => {
      // 2 hours at 40 EGP/hr = 80 EGP
      const price = calculateSessionPrice(7200, 40)
      expect(price).toBeCloseTo(80, 2)
    })

    it('calculates price for a 15-minute session', () => {
      // 15 min at 60 EGP/hr = 15 EGP
      const price = calculateSessionPrice(900, 60)
      expect(price).toBeCloseTo(15, 2)
    })
  })
})
