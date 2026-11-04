import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { LogoLabel } from '@/shared'

type Props = {
  className?: string
}

const TICK_COUNT = 60
/** The bright stretch of the dial: a run of tracked time. */
const TRACKED_TICKS = 18

const TICKS = Array.from({ length: TICK_COUNT }, (_, index) => index)

const SPARK_PATH =
  'M12 0C12.8 7 17 11.2 24 12C17 12.8 12.8 17 12 24C11.2 17 7 12.8 0 12C7 11.2 11.2 7 12 0Z'

const SPARKS = [
  { top: '11%', left: '14%', size: 22, tone: 'accent' },
  { top: '8%', left: '74%', size: 14, tone: 'white' },
  { top: '24%', left: '88%', size: 26, tone: 'white' },
  { top: '66%', left: '8%', size: 16, tone: 'white' },
  { top: '72%', left: '90%', size: 18, tone: 'accent' },
]

/**
 * The sign-in screen's brand side: the wordmark on a dial, since time is what the
 * product is about, over a line saying who it's for. Decoration, so a phone has
 * none of it and the sign-in options come first.
 */
export const AuthBrandPanel = ({ className }: Props) => {
  const { t } = useTranslation()

  return (
    <Root className={className}>
      {SPARKS.map((spark) => (
        <Spark
          key={`${spark.top}-${spark.left}`}
          data-tone={spark.tone}
          style={{ top: spark.top, left: spark.left }}
          width={spark.size}
          height={spark.size}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d={SPARK_PATH} />
        </Spark>
      ))}
      <Dial>
        <DialTicks viewBox="0 0 400 400" aria-hidden="true">
          {TICKS.map((tick) => (
            <Tick
              key={tick}
              data-tracked={tick < TRACKED_TICKS || undefined}
              x={tick % 5 === 0 ? 195 : 197}
              y={8}
              width={tick % 5 === 0 ? 10 : 6}
              height={tick % 5 === 0 ? 52 : 34}
              rx={tick % 5 === 0 ? 5 : 3}
              transform={`rotate(${(tick * 360) / TICK_COUNT} 200 200)`}
            />
          ))}
        </DialTicks>
        <DialLogo src={LogoLabel} alt="" />
      </Dial>
      <Tagline>
        {t('signIn.panel.line1')}
        <strong>{t('signIn.panel.line2')}</strong>
      </Tagline>
    </Root>
  )
}

const Root = styled.aside`
  position: relative;
  overflow: hidden;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  justify-items: center;
  gap: var(--space-5);
  padding: var(--space-7);
  border-radius: var(--radius-5);
  background: var(--c-253854);
  color: var(--white);
`

const Spark = styled.svg`
  position: absolute;
  fill: var(--c-rgba-255-255-255-0_92);

  &[data-tone='accent'] {
    fill: var(--ds-accent-3);
    opacity: 0.7;
  }
`

const Dial = styled.div`
  position: relative;
  align-self: center;
  width: min(100%, 460px);
  max-height: 100%;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
`

const DialTicks = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`

const Tick = styled.rect`
  fill: var(--c-rgba-255-255-255-0_2);

  &[data-tracked] {
    fill: var(--ds-accent-3);
  }
`

/* The wordmark is one flat colour, so this turns it white for the panel. */
const DialLogo = styled.img`
  position: relative;
  width: 44%;
  height: auto;
  filter: brightness(0) invert(1);
`

const Tagline = styled.p`
  position: relative;
  margin: 0;
  display: grid;
  gap: var(--space-1);
  text-align: center;
  font-size: var(--font-size-6);
  font-weight: 400;
  line-height: 1.25;
  color: var(--c-rgba-255-255-255-0_92);

  & > strong {
    font-weight: 700;
    color: var(--white);
  }
`
