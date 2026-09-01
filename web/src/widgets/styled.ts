import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import styled, { css } from 'styled-components'

export const IconImg = styled.img`
  width: 18px;
  height: 18px;
  display: block;
`

export const NavLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-3);
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

  /* The icon is a cue, not a second label: it sits a step back from the text
     and only comes forward with it on the active item. */
  & > svg {
    flex-shrink: 0;
    color: var(--ds-neutral-11);
  }

  &[data-active] > svg,
  &:hover > svg {
    color: var(--ds-accent-11);
  }

  & > svg[data-external] {
    margin-left: -2px;
    align-self: flex-start;
  }

  ${(p) => p.theme.breakpoints.down('lg')} {
    font-size: var(--font-size-2);
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

// Shared by header.tsx's logout button and mobile-menu.tsx's nav items —
// same row shape, each adding its own element-specific rules.
export const mobileMenuRowStyles = css`
  padding: 10px 10px;
  border-radius: 10px;
  color: var(--ds-neutral-12);
  font-size: var(--font-size-3);
  line-height: 22px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;

  &:hover {
    background: var(--c-rgba-28-32-36-0_06);
  }

  & > svg:first-child {
    flex-shrink: 0;
    color: var(--ds-neutral-11);
  }

  &[data-active] > svg:first-child {
    color: var(--ds-accent-11);
  }
`
