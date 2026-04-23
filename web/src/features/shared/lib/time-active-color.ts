import { match, P } from 'ts-pattern'

import type { BadgeProps } from '@radix-ui/themes'

export const getTimeActiveColor = (minutesActive: number) =>
  match<number, BadgeProps['color']>(minutesActive)
    .with(
      P.when((n) => n > 0 && n <= 2),
      () => 'red',
    )
    .with(
      P.when((n) => n >= 3 && n <= 5),
      () => 'orange',
    )
    .otherwise(() => 'green')
