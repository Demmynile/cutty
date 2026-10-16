import { describe, expect, it } from 'vitest'
import { LOYALTY_REWARDS, TRY_ON_STYLES, WEEKDAYS } from '../index'

// Runtime constants shared by the app and the API. The API validates ids
// against these lists, so their shape is part of the contract.

const SERVICE_CATEGORIES = ['haircut', 'shave', 'styling', 'treatment', 'combo', 'braiding', 'wig']

describe('TRY_ON_STYLES', () => {
  it('has unique, URL-safe ids', () => {
    const ids = TRY_ON_STYLES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('every style is complete and maps to a bookable service category', () => {
    for (const s of TRY_ON_STYLES) {
      expect(s.label.trim(), s.id).not.toBe('')
      expect(s.blurb.trim(), s.id).not.toBe('')
      expect(s.prompt.length, s.id).toBeGreaterThan(20)
      expect(SERVICE_CATEGORIES, s.id).toContain(s.serviceCategory)
      expect(['male', 'female', 'unisex'], s.id).toContain(s.gender)
    }
  })

  it('offers styles in both gallery sections', () => {
    const men = TRY_ON_STYLES.filter((s) => s.gender !== 'female')
    const women = TRY_ON_STYLES.filter((s) => s.gender !== 'male')
    expect(men.length).toBeGreaterThan(5)
    expect(women.length).toBeGreaterThan(5)
  })
})

describe('LOYALTY_REWARDS', () => {
  it('has unique ids and positive costs, cheapest first', () => {
    const ids = LOYALTY_REWARDS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    const points = LOYALTY_REWARDS.map((r) => r.points)
    expect(points.every((p) => Number.isInteger(p) && p > 0)).toBe(true)
    expect([...points].sort((a, b) => a - b)).toEqual(points)
  })

  it('has sane values: percentages within 1–100, fixed amounts in whole kobo', () => {
    for (const r of LOYALTY_REWARDS) {
      if (r.type === 'percentage') expect(r.value, r.id).toBeGreaterThan(0)
      if (r.type === 'percentage') expect(r.value, r.id).toBeLessThanOrEqual(100)
      if (r.type === 'fixed') expect(Number.isInteger(r.value) && r.value >= 100, r.id).toBe(true)
    }
  })

  it('labels state the fixed value they grant', () => {
    for (const r of LOYALTY_REWARDS.filter((x) => x.type === 'fixed')) {
      expect(r.label.replace(/,/g, ''), r.id).toContain(`₦${r.value / 100}`)
    }
  })
})

describe('WEEKDAYS', () => {
  it('lists the seven days Monday first, in lower case', () => {
    expect(WEEKDAYS).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  })
})
