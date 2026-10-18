import { expect } from 'chai'
import { RecordingPrivacy } from '@/service/recording-privacy'

describe('RecordingPrivacy', () => {
  it('excludes recording payloads, settings and credentials from error telemetry', () => {
    for (const path of [
      '/api/time',
      '/api/time/id',
      '/api/statistics/apps/titles',
      '/api/agents',
      '/api/agent-tracking/events',
      '/api/agent-tracking/credentials',
      '/api/user/settings',
    ]) {
      for (const spelling of [
        path,
        path.toUpperCase(),
        `${path.toUpperCase()}/`,
      ]) {
        expect(RecordingPrivacy.sensitive(spelling), spelling).to.equal(true)
        expect(
          RecordingPrivacy.sensitive(
            `https://example.test${spelling}?ignored=1`,
          ),
          spelling,
        ).to.equal(true)
      }
    }
    expect(RecordingPrivacy.sensitive('/api/project')).to.equal(false)
    expect(RecordingPrivacy.sensitive(undefined)).to.equal(false)
    expect(
      RecordingPrivacy.ingest(
        'https://example.test/API/AGENT-TRACKING/EVENTS/?ignored=1',
      ),
    ).to.equal(true)
    expect(RecordingPrivacy.ingest('/api/agent-tracking/credentials')).to.equal(
      false,
    )
  })
})
