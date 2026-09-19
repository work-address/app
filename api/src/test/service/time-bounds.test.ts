import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { TimeCreateDto } from '@/model/dto/time'
import { TimeBounds } from '@/service/time-bounds'

/**
 * The future bound against a fixed server clock, so each edge is exact.
 *
 * The desktop tracker's upload is the case that matters: it sends a
 * ten-minute bucket with `toAt` at the bucket's planned end, including the
 * bucket still in progress, and treats a refusal as final.
 */
@suite()
export class TimeBoundsTest {
  /** The server's clock: four and a half minutes into the 10:00 bucket. */
  private static readonly now = new Date('2026-01-01T10:04:30.000Z')

  private static at(time: string): Date {
    return new Date(`2026-01-01T${time}.000Z`)
  }

  private static rules(
    fromAt: string,
    toAt: string,
    minutesActive: number,
  ): Record<string, string[]> {
    const slice = {
      fromAt: TimeBoundsTest.at(fromAt),
      toAt: TimeBoundsTest.at(toAt),
    }
    const item: TimeCreateDto = {
      fromIndex: 1,
      toIndex: 2,
      note: null,
      keyboardKeys: 1,
      mouseKeys: 1,
      mouseDistance: 1,
      minutesActive,
      fromAt: slice.fromAt.toISOString(),
      toAt: slice.toAt.toISOString(),
      projectId: 'project',
    }

    return Object.fromEntries(
      TimeBounds.violations(item, slice, TimeBoundsTest.now).map((error) => [
        error.property,
        Object.keys(error.constraints ?? {}),
      ]),
    )
  }

  /**
   * Stop at 10:04:30 uploads the 10:00-10:10 bucket with the minutes
   * recorded so far - up to five, the minute under way included. This row
   * was refused while `toAt` itself was bounded, and the tracker then
   * dropped those minutes for good.
   */
  @test()
  bucketInProgress_isAccepted() {
    expect(TimeBoundsTest.rules('10:00:00', '10:10:00', 4)).to.deep.equal({})
    expect(TimeBoundsTest.rules('10:00:00', '10:10:00', 5)).to.deep.equal({})
  }

  /**
   * What the bucket may claim runs to five minutes past the server's clock:
   * from 10:02:30 that is seven minutes, while the bucket is ten long.
   */
  @test()
  activeMinutes_stopAtFiveMinutesPastTheClock() {
    expect(TimeBoundsTest.rules('10:02:30', '10:12:30', 7)).to.deep.equal({})
    expect(TimeBoundsTest.rules('10:02:30', '10:12:30', 8)).to.deep.equal({
      minutesActive: ['maxElapsedMinutes'],
    })
    expect(TimeBoundsTest.rules('10:02:30', '10:12:30', 10)).to.deep.equal({
      minutesActive: ['maxElapsedMinutes'],
    })
  }

  /** A part minute counts, as the tracker counts the minute under way. */
  @test()
  activeMinutes_roundAPartMinuteUp() {
    // 10:09:30 minus 10:03:00 is six and a half minutes.
    expect(TimeBoundsTest.rules('10:03:00', '10:13:00', 7)).to.deep.equal({})
    expect(TimeBoundsTest.rules('10:03:00', '10:13:00', 8)).to.deep.equal({
      minutesActive: ['maxElapsedMinutes'],
    })
  }

  /** A slice that ended before the clock is bounded by its own span. */
  @test()
  finishedSlice_isBoundedByItsSpan() {
    expect(TimeBoundsTest.rules('09:50:00', '10:00:00', 10)).to.deep.equal({})
    expect(TimeBoundsTest.rules('09:50:00', '10:00:00', 11)).to.deep.equal({
      minutesActive: ['maxSpanMinutes'],
    })
  }

  /**
   * A slice may start up to five minutes past the clock - skew between the
   * tracker and the server - and claim only what reaches that far.
   */
  @test()
  start_mayBeWithinTheSkewOnly() {
    expect(TimeBoundsTest.rules('10:09:30', '10:19:30', 0)).to.deep.equal({})
    expect(TimeBoundsTest.rules('10:09:30', '10:19:30', 1)).to.deep.equal({
      minutesActive: ['maxElapsedMinutes'],
    })
    expect(TimeBoundsTest.rules('10:08:00', '10:18:00', 2)).to.deep.equal({})
    expect(TimeBoundsTest.rules('10:09:31', '10:19:31', 0)).to.deep.equal({
      fromAt: ['notInFuture'],
    })
    expect(TimeBoundsTest.rules('10:14:30', '10:24:30', 5)).to.deep.equal({
      fromAt: ['notInFuture'],
    })
  }

  /**
   * `toAt` is no longer bounded against the clock on its own: the span rule
   * keeps it within an hour of `fromAt`, and the claim is bounded above.
   */
  @test()
  end_isBoundedBySpanNotByClock() {
    expect(TimeBoundsTest.rules('10:00:00', '11:00:00', 5)).to.deep.equal({})
    expect(TimeBoundsTest.rules('10:00:00', '11:00:01', 5)).to.deep.equal({
      toAt: ['maxSpan'],
    })
  }
}
