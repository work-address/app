import { motion } from 'motion/react'
import styled from 'styled-components'
import { Drawer } from 'vaul'

import { Button, MotionSelect, Search } from '@/features/shared'

export const Top = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
`

export const TitleRow = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  gap: 10px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: start;
  }
`

export const TopRight = styled.div`
  margin-left: auto;
`

export const TitleBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

export const Title = styled.h1`
  font-weight: 500;
  font-size: 24px;
  line-height: 125%;
  letter-spacing: 0em;
  color: #1c2024;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`

export const Counter = styled.span`
  border-radius: 4px;
  padding: 4px 8px;
  font-weight: 500;
  font-size: 12px;
  line-height: 133%;
  color: rgba(0, 7, 20, 0.62);
  background: rgba(0, 0, 51, 0.06);
`

export const DashboardSearch = styled(Search)`
  width: 280px;
`

export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`

export const TabsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  margin-left: 20px;
`

export const Tabs = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  border-bottom: 1px solid rgba(0, 8, 48, 0.12);
`

export const ActiveIndicator = styled(motion.div)`
  position: absolute;
  left: 0;
  bottom: -1px;
  height: 2px;
  border-radius: 999px;
  background: var(--download, #003482);
  pointer-events: none;
`

export const Tab = styled.button<{ $active?: boolean }>`
  padding: 8px 0;
  font-size: 13px;
  line-height: 16px;
  font-weight: 500;
  color: ${(p) => (p.$active ? 'var(--ds-primary)' : 'rgba(28, 32, 36, 0.62)')};
  border-bottom: 2px solid transparent;

  &:hover {
    color: var(--ds-primary);
  }
`

export const TableArea = styled.div`
  padding-top: 4px;
`

export const Content = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;

  &:has(> :nth-child(2)) {
    grid-template-columns: 64% 35%;
  }
`

export const Left = styled.section`
  min-width: 0;

  @media (max-width: 1024px) {
    grid-column: 1 / -1;
    padding-right: 8px;
  }
`

export const Right = styled.section`
  min-width: 0;

  @media (max-width: 1024px) {
    display: none;
  }
`

export const Section = styled.section`
  margin-top: 48px;
  margin-bottom: 48px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-bottom: 0;
  }
`

export const SectionTitle = styled.h2`
  font-weight: 500;
  font-size: 24px;
  line-height: 125%;
  letter-spacing: 0em;
  color: #1c2024;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`

export const CreateProjectButton = styled(Button)`
  @media (max-width: 768px) {
    padding: 6px 10px;
    gap: 0;

    svg {
      width: 18px;
      height: 18px;
    }
  }
`

export const CreateProjectText = styled.span`
  @media (max-width: 768px) {
    display: none;
  }
`

export const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`

export const DesktopOnly = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
`

export const MobileOnly = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
`

export const FiltersButton = styled.button`
  font-weight: 500;
  font-size: 12px;
  line-height: 133%;
  letter-spacing: 0em;
  color: #60646c;
  border: 1px solid rgba(0, 8, 48, 0.27);
  border-radius: 3px;
  padding: 0px 8px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  img {
    width: 16px;
    height: 16px;
    display: block;
  }

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }
`

export const FilterImage = styled.img`
  width: 16px;
  height: 16px;
  display: block;
`

export const DrawerOverlay = styled(Drawer.Overlay)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 50;
`

export const DrawerContent = styled(Drawer.Content)`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 51;
  outline: none;
`

export const NestedDrawerOverlay = styled(Drawer.Overlay)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 60;
`

export const NestedDrawerContent = styled(Drawer.Content)`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 61;
  outline: none;
`

export const Sheet = styled.div`
  background: #fff;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  padding: 16px;
  max-height: 85vh;
  overflow: auto;
`

export const SheetHandle = styled.div`
  width: 48px;
  height: 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  margin: 0 auto 10px;
`

export const SheetTitle = styled.div`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
  text-align: center;
  margin-bottom: 12px;
`

export const SheetSubTitle = styled.div`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
  margin-bottom: 12px;
`

export const MobileFilters = styled.div`
  display: flex;
  flex-direction: column;
  /* gap: 12px; */
`

export const SheetFooter = styled.div`
  margin-top: 14px;
`

export const SheetApply = styled.button`
  width: 100%;
  height: 32px;
  border-radius: 4px;
  background: #3f67a4;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
`

export const ProjectsTrigger = styled.button`
  width: 100%;
  height: 34px;
  border-radius: 4px;
  border: 1px solid rgba(0, 8, 48, 0.12);
  padding: 0 10px;
  background: #fff;
  font-size: 13px;
  color: var(--ds-primary);
  text-align: left;
`

export const ProjectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const ProjectRowButton = styled.button<{ $selected?: boolean }>`
  width: 100%;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${(p) => (p.$selected ? 'rgba(5, 86, 205, 0.0588)' : '')};

  &:hover {
    background: rgba(0, 0, 0, 0.08);
  }
`

export const ProjectRowLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #1c2024;
`

export const CheckIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  background: url('/img/icons/check-icon.svg') no-repeat center;
  background-size: contain;
`

export const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
  margin-bottom: var(--space-4);
`

export const FilterMotionSelect = styled(MotionSelect)`
  --ms-height: 34px;
`

export const Field = styled.div<{ $basis?: number }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 ${(p) => (p.$basis ? `${p.$basis}px` : '70px')};
  min-width: 130px;
`

export const Label = styled.div`
  font-size: 14px;
  line-height: 14px;
  color: #1c2024;
  font-weight: 500;
`

export const Control = styled.input`
  width: 100%;
  height: 34px;
  border-radius: 4px;
  border: 1px solid rgba(0, 8, 48, 0.12);
  padding: 0 10px;
  background: #fff;
  font-size: 13px;
  color: var(--ds-primary);
  outline: none;

  &::placeholder {
    color: rgba(0, 5, 29, 0.45);
  }

  &:focus {
    border-color: rgba(0, 52, 130, 0.55);
  }
`

export const Range = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`
