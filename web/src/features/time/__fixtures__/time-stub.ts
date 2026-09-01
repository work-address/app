import type { Time } from '@/entities/time'

const BASE: Time = {
  id: 'time-1',
  fromAt: '2026-09-01T09:00:00.000Z',
  toAt: '2026-09-01T09:10:00.000Z',
  minutesActive: 6,
  keyboardKeys: 401,
  mouseKeys: 189,
  mouseDistance: 4383.6,
  note: 'Index the IB driver so the bus stops dropping frames',
  isPaid: false,
  project: {
    id: 'project-1',
    title: 'Frozen Silk Bike',
    text: '',
    state: 'active',
  },
}

/** A tracked ten-minute slot. Override only what the case under test cares about. */
export const createTimeStub = (partial: Partial<Time> = {}): Time => ({
  ...BASE,
  ...partial,
})
