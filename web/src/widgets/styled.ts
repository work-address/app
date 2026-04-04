import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const IconImg = styled.img`
  width: 18px;
  height: 18px;
  display: block;
`

export const NavLink = styled(Link)<{ $active?: boolean; $download?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 400;
  position: relative;

  &:after {
    transition: .25s;
    content: '';
    display: block;
    background: rgba(0,0,0,0.12);
    height: 2px;
    width: 100%;
    position: absolute;
    bottom: -6px;
    opacity: 0;
  }

  color: ${(p) => {
    if (p.$download) {
      return 'var(--download, #003482)'
    }
    return 'var(--ds-primary)'
  }};

  ${(p) =>
    p.$active &&
    `&:after {
      opacity: 1;
    }`}

  opacity: ${(p) => {
    // eslint-disable-next-line
  return p.$download
    ? 1
    : (p.$active
      ? 1
      : 0.8)
  }}}

  @media (max-width: 1024px) {
    font-size: 14px;
  }

  &:hover {
    opacity: 1;
  }
`

export const IconLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(28, 32, 36, 0.06);
  }
`

export const MobileMenuNav = styled(motion.nav)`
  display: flex;
  flex-direction: column;
  gap: 6px;
`
