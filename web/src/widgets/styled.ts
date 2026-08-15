import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const IconImg = styled.img`
  width: 18px;
  height: 18px;
  display: block;
`

export const NavLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 400;
  position: relative;
  color: var(--ds-neutral-12);
  opacity: 0.8;

  &:after {
    transition: 0.25s;
    content: '';
    display: block;
    background: var(--c-rgba-0-0-0-0_12);
    height: 2px;
    width: 100%;
    position: absolute;
    bottom: -6px;
    opacity: 0;
  }

  &[data-download] {
    color: var(--download);
    opacity: 1;
  }

  &[data-active] {
    opacity: 1;

    &:after {
      opacity: 1;
    }
  }

  ${(p) => p.theme.breakpoints.down('lg')} {
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
    background: var(--c-rgba-28-32-36-0_06);
  }
`

export const MobileMenuNav = styled(motion.nav)`
  display: flex;
  flex-direction: column;
  gap: 6px;
`
