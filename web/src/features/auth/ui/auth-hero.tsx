import { CheckIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const POINTS = ['point1', 'point2', 'point3'] as const

/**
 * The brand half of the sign-in screen: what the product is, in three lines,
 * on the panel a visitor sees before they pick a wallet. Rendered in the same
 * slot as the per-network guide, which takes over while a sign-in option is
 * hovered.
 */
export const AuthHero = () => {
  const { t } = useTranslation()

  return (
    <Root>
      <Title>{t('signIn.hero.title')}</Title>
      <Subtitle>{t('signIn.hero.subtitle')}</Subtitle>
      <Points>
        {POINTS.map((point) => (
          <Point key={point}>
            <PointIcon aria-hidden="true">
              <CheckIcon width={14} height={14} />
            </PointIcon>
            <span>{t(`signIn.hero.${point}`)}</span>
          </Point>
        ))}
      </Points>
    </Root>
  )
}

const Root = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  color: var(--white);
`

const Title = styled.h2`
  font-size: 44px;
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: var(--white);
  margin: 0 0 18px;
  text-wrap: balance;

  @media (min-width: 1280px) {
    font-size: 52px;
  }
`

const Subtitle = styled.p`
  font-size: var(--font-size-4);
  line-height: 1.5;
  color: var(--c-rgba-255-255-255-0_92);
  max-width: 34ch;
  margin: 0;
`

/* Spacing alone separates the points from the subtitle: the panel's one rule
   belongs to the wallet caption beneath, and a second one read as clutter. */
const Points = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 36px 0 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-3);
  line-height: 1.5;
`

const Point = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`

const PointIcon = styled.span`
  flex: 0 0 24px;
  height: 24px;
  margin-top: 1px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--c-rgba-255-255-255-0_2);
  color: var(--white);
`
