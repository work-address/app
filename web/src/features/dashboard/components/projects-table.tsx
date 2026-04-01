import { useMemo, useState } from 'react'
import styled from 'styled-components'

import {
  Button,
  ConfirmModal,
  MotionSelect,
  RightDrawer,
} from '@/features/shared'

export type ProjectStatus = 'Active' | 'Paused' | 'Finished'

export type ProjectRow = {
  key: string
  name: string
  earnings: string
  status: ProjectStatus
  timeTotal: string
  timeActive: string
  keyboard: string
  mouse: string
  mouseDistance: string
}

type ProjectsTableProps = {
  rows: ProjectRow[]
}

type SortKey = keyof Pick<
  ProjectRow,
  'name' | 'earnings' | 'keyboard' | 'mouse' | 'mouseDistance'
>
type SortDir = 'asc' | 'desc'

function normalizeNumberLike(value: string) {
  const cleaned = value.replaceAll(/[^\d.]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function getSortValue(row: ProjectRow, key: SortKey) {
  const value = row[key]
  if (
    key === 'earnings' ||
    key === 'keyboard' ||
    key === 'mouse' ||
    key === 'mouseDistance'
  ) {
    return normalizeNumberLike(value)
  }
  return value.toLowerCase()
}

export const ProjectsTable = ({ rows }: ProjectsTableProps) => {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null)
  const [openDrawer, setOpenDrawer] = useState(false)
  const [drawerRow, setDrawerRow] = useState<ProjectRow | null>(null)
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [draftName, setDraftName] = useState('')
  const [draftFolder, setDraftFolder] = useState('')
  const [draftRate, setDraftRate] = useState('')
  const [draftDesc, setDraftDesc] = useState('')

  const folderOptions = useMemo(() => {
    return [{ value: 'Personal', label: 'Personal' }]
  }, [])

  const allSelected = rows.length > 0 && rows.every((r) => selected[r.key])

  const sortedRows = useMemo(() => {
    if (!sort) {
      return rows
    }
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = getSortValue(a, sort.key)
      const bv = getSortValue(b, sort.key)
      if (av < bv) {
        return sort.dir === 'asc' ? -1 : 1
      }
      if (av > bv) {
        return sort.dir === 'asc' ? 1 : -1
      }
      return 0
    })
    return copy
  }, [rows, sort])

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) {
        return { key, dir: 'desc' }
      }
      return { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
    })
  }

  const setAll = (checked: boolean) => {
    const next: Record<string, boolean> = {}
    for (const r of rows) {
      next[r.key] = checked
    }
    setSelected(next)
  }

  const setOne = (key: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [key]: checked }))
  }

  const showDrawer = (row: ProjectRow, mode: 'view' | 'edit') => {
    setDrawerRow(row)
    setDrawerMode(mode)
    setDraftName(row.name)
    setDraftFolder('')
    setDraftRate('0')
    setDraftDesc('')
    setOpenDrawer(true)
  }

  const closeDrawer = () => {
    setOpenDrawer(false)
  }

  const openDelete = () => setConfirmOpen(true)
  const closeDelete = () => setConfirmOpen(false)

  return (
    <Wrap>
      <Scroll>
        <TableEl>
          <Thead>
            <tr>
              <CheckCell>
                <Checkbox
                  checked={allSelected}
                  onChange={(e) => setAll(e.target.checked)}
                />
              </CheckCell>
              <Th>
                <SortBtn
                  $active={sort?.key === 'name'}
                  onClick={() => toggleSort('name')}
                >
                  <Head>
                    Project name
                    <HeadIcon
                      src="/img/icons/question-mark-circled.svg"
                      alt="Info"
                    />
                    <SortArrow
                      src="/img/icons/arrow-down.svg"
                      alt="Sort"
                      $active={sort?.key === 'name'}
                      $dir={sort?.key === 'name' ? sort.dir : undefined}
                    />
                  </Head>
                </SortBtn>
              </Th>
              <Th>
                <SortBtn
                  $active={sort?.key === 'earnings'}
                  onClick={() => toggleSort('earnings')}
                >
                  <Head>
                    Earnings
                    <SortArrow
                      src="/img/icons/arrow-down.svg"
                      alt="Sort"
                      $active={sort?.key === 'earnings'}
                      $dir={sort?.key === 'earnings' ? sort.dir : undefined}
                    />
                  </Head>
                </SortBtn>
              </Th>
              <Th>Status</Th>
              <Th>
                <Head>
                  Time total
                  <HeadIcon
                    src="/img/icons/question-mark-circled.svg"
                    alt="Info"
                  />
                </Head>
              </Th>
              <Th>
                <Head>
                  Time active
                  <HeadIcon
                    src="/img/icons/question-mark-circled.svg"
                    alt="Info"
                  />
                </Head>
              </Th>
              <Th>
                <SortBtn
                  $active={sort?.key === 'keyboard'}
                  onClick={() => toggleSort('keyboard')}
                >
                  <Head>
                    Keyboard
                    <HeadIcon
                      src="/img/icons/question-mark-circled.svg"
                      alt="Info"
                    />
                    <SortArrow
                      src="/img/icons/arrow-down.svg"
                      alt="Sort"
                      $active={sort?.key === 'keyboard'}
                      $dir={sort?.key === 'keyboard' ? sort.dir : undefined}
                    />
                  </Head>
                </SortBtn>
              </Th>
              <Th>
                <SortBtn
                  $active={sort?.key === 'mouse'}
                  onClick={() => toggleSort('mouse')}
                >
                  <Head>
                    Mouse
                    <HeadIcon
                      src="/img/icons/question-mark-circled.svg"
                      alt="Info"
                    />
                    <SortArrow
                      src="/img/icons/arrow-down.svg"
                      alt="Sort"
                      $active={sort?.key === 'mouse'}
                      $dir={sort?.key === 'mouse' ? sort.dir : undefined}
                    />
                  </Head>
                </SortBtn>
              </Th>
              <Th>
                <SortBtn
                  $active={sort?.key === 'mouseDistance'}
                  onClick={() => toggleSort('mouseDistance')}
                >
                  <Head>
                    Mouse distance
                    <HeadIcon
                      src="/img/icons/question-mark-circled.svg"
                      alt="Info"
                    />
                    <SortArrow
                      src="/img/icons/arrow-down.svg"
                      alt="Sort"
                      $active={sort?.key === 'mouseDistance'}
                      $dir={
                        sort?.key === 'mouseDistance' ? sort.dir : undefined
                      }
                    />
                  </Head>
                </SortBtn>
              </Th>
              <ActionsCell />
            </tr>
          </Thead>
          <tbody>
            {sortedRows.map((r) => (
              <Tr key={r.key}>
                <CheckTd>
                  <Checkbox
                    checked={!!selected[r.key]}
                    onChange={(e) => setOne(r.key, e.target.checked)}
                  />
                </CheckTd>
                <Td>
                  <Link
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      showDrawer(r, 'view')
                    }}
                  >
                    {r.name}
                  </Link>
                </Td>
                <Td>{r.earnings}</Td>
                <Td>
                  <StatusPill $status={r.status}>{r.status}</StatusPill>
                </Td>
                <Td>{r.timeTotal}</Td>
                <Td>{r.timeActive}</Td>
                <Td>{r.keyboard}</Td>
                <Td>{r.mouse}</Td>
                <Td>{r.mouseDistance}</Td>
                <TdRight>
                  <Actions>
                    <ActionBtn aria-label="Print">
                      <ActionIcon src="/img/icons/print.svg" alt="Print" />
                    </ActionBtn>
                    <ActionBtn aria-label="Delete">
                      <ActionIcon src="/img/icons/delete.svg" alt="Delete" />
                    </ActionBtn>
                    <ActionBtn
                      aria-label="Edit"
                      onClick={(e) => {
                        e.preventDefault()
                        showDrawer(r, 'edit')
                      }}
                    >
                      <ActionIcon src="/img/icons/edit.svg" alt="Edit" />
                    </ActionBtn>
                  </Actions>
                </TdRight>
              </Tr>
            ))}
          </tbody>
        </TableEl>
      </Scroll>

      <RightDrawer open={openDrawer} onClose={closeDrawer}>
        <DrawerRoot>
          <DrawerHead>
            <DrawerClose type="button" aria-label="Close" onClick={closeDrawer}>
              ×
            </DrawerClose>

            <DrawerHeadRight>
              <DeleteIconBtn
                type="button"
                aria-label="Delete"
                onClick={openDelete}
              >
                <img src="/img/icons/drawer-delete-icon.svg" alt="Delete" />
              </DeleteIconBtn>
              {drawerMode === 'view' ? (
                <>
                  <IconBtn type="button" aria-label="Download">
                    <img src="/img/icons/download-icon.svg" alt="Download" />
                  </IconBtn>
                  <DrawerButton
                    variant="primary"
                    onClick={() => {
                      if (drawerRow) {
                        showDrawer(drawerRow, 'edit')
                      }
                    }}
                  >
                    Edit
                  </DrawerButton>
                </>
              ) : (
                <DrawerButton variant="primary">Save</DrawerButton>
              )}
            </DrawerHeadRight>
          </DrawerHead>

          {drawerMode === 'view' ? (
            <DrawerBody>
              <DrawerTitle>{drawerRow?.name ?? ''}</DrawerTitle>

              <Divider />

              <MetaGrid>
                <MetaLabel>Start date</MetaLabel>
                <MetaValue>Mar 16, 2025 09:28</MetaValue>

                <MetaLabel>Published in</MetaLabel>
                <MetaValue>Personal</MetaValue>

                <MetaLabel>Rate</MetaLabel>
                <MetaValue>20 USD/hour</MetaValue>
              </MetaGrid>

              <Divider />

              <SectionTitle>Description</SectionTitle>
              <DescBox>
                Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </DescBox>
            </DrawerBody>
          ) : (
            <DrawerBody>
              <DrawerTitle>Edit project</DrawerTitle>
              <Divider />
              <Form>
                <Field>
                  <Label>Project name</Label>
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Enter project name"
                  />
                </Field>
                <Field>
                  <Label>Published in</Label>
                  <MotionSelect
                    options={folderOptions}
                    value={draftFolder}
                    onChange={(value) =>
                      setDraftFolder(
                        Array.isArray(value) ? (value[0] ?? '') : value,
                      )
                    }
                    placeholder="Select folder"
                  />
                </Field>
                <Field>
                  <Label>Rate</Label>
                  <Input
                    value={draftRate}
                    onChange={(e) => setDraftRate(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field>
                  <Label>Description</Label>
                  <TextArea
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    placeholder="Enter a brief description of your project"
                  />
                </Field>
              </Form>
            </DrawerBody>
          )}
        </DrawerRoot>
      </RightDrawer>

      <ConfirmModal
        open={confirmOpen}
        title="Delete this project?"
        description="This action cannot be undone. All tracked time and associated data will be permanently removed."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onCancel={closeDelete}
        onConfirm={() => {
          closeDelete()
          closeDrawer()
        }}
      />
    </Wrap>
  )
}

const Wrap = styled.div`
  border: 1px solid rgba(0, 0, 45, 0.09);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 1px 4px 0 rgba(0, 0, 45, 0.09),
    0 2px 1px -1px rgba(0, 0, 0, 0.05),
    0 1px 3px 0 rgba(0, 0, 0, 0.05);
`

const Scroll = styled.div`
  width: 100%;
  overflow: auto;
`

const TableEl = styled.table`
  width: 100%;
  min-width: 1120px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  color: var(--primary);
`

const Thead = styled.thead`
  background: #f9f9fb;
`

const Th = styled.th`
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: rgba(28, 32, 36, 0.75);
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 0, 47, 0.15);
  white-space: nowrap;
`

const ThRight = styled(Th)`
  text-align: right;
`

const Td = styled.td`
  padding: 14px;
  border-bottom: 1px solid rgba(0, 0, 47, 0.15);
  white-space: nowrap;
  color: #60646c;
  font-weight: 400;
  font-size: 14px;
  line-height: 143%;
`

const TdRight = styled(Td)`
  text-align: right;
`

const Tr = styled.tr`
  &:hover ${Td} {
    background: rgba(0, 52, 130, 0.04);
  }
`

const CheckCell = styled(Th)`
  width: 44px;
  padding-left: 16px;
  padding-right: 8px;
  vertical-align: middle;
`

const CheckTd = styled(Td)`
  width: 44px;
  padding-left: 16px;
  padding-right: 8px;
  vertical-align: middle;
`

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 16px;
  height: 16px;
  border: 1px solid rgba(0, 6, 46, 0.2);
  border-radius: 3px;
  background: #fff;
  appearance: none;
  -webkit-appearance: none;
  display: block;
  box-sizing: border-box;
  position: relative;

  &:checked {
    background: var(--download, #003482);
    border-color: var(--download, #003482);
  }

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    width: 9px;
    height: 5px;
    border: 2px solid #fff;
    border-top: 0;
    border-right: 0;
    margin-top: -1px;
    opacity: 0;
  }

  &:checked::after {
    opacity: 1;
  }
`

const Link = styled.a`
  color: var(--download, #003482);
  font-weight: 500;
`

const StatusPill = styled.span<{ $status: ProjectStatus }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;

  background: ${(p) => {
    if (p.$status === 'Active') {
      return 'rgba(0, 164, 51, 0.1)'
    }
    if (p.$status === 'Finished') {
      return 'rgba(0, 52, 130, 0.12)'
    }
    return 'rgba(0, 0, 51, 0.06)'
  }};

  color: ${(p) => {
    if (p.$status === 'Active') {
      return 'rgba(0, 113, 63, 0.87)'
    }
    if (p.$status === 'Finished') {
      return 'var(--download, #003482)'
    }
    return 'rgba(0, 7, 20, 0.62)'
  }};
`

const SortBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: ${(p) =>
    p.$active ? 'rgba(28, 32, 36, 0.88)' : 'rgba(28, 32, 36, 0.75)'};

  &:hover {
    color: rgba(28, 32, 36, 0.92);
  }
`

const Head = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`

const HeadIcon = styled.img`
  width: 16px;
  height: 16px;
  display: inline-block;
`

const SortArrow = styled.img<{ $active?: boolean; $dir?: SortDir }>`
  width: 16px;
  height: 16px;
  display: inline-block;
  opacity: ${(p) => (p.$active ? 1 : 0.55)};
  transform: ${(p) =>
    p.$active && p.$dir === 'asc' ? 'rotate(180deg)' : 'none'};
`

const ActionsCell = styled(ThRight)`
  width: 108px;
`

const Actions = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
`

const ActionBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  width: 32px;
  height: 32px;

  &:hover {
    background: rgba(0, 0, 51, 0.06);
  }
`

const ActionIcon = styled.img`
  display: block;
`

const DrawerRoot = styled.div`
  width: 100%;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
`

const DrawerHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
`

const DrawerClose = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  background: #fff;
  color: rgba(0, 7, 20, 0.72);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }
`

const DrawerHeadRight = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

const IconBtn = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }

  img {
    width: 16px;
    height: 16px;
    display: block;
  }
`

const DeleteIconBtn = styled(IconBtn)`
  border-color: rgba(210, 0, 5, 0.44);

  &:hover {
    background: rgba(210, 0, 5, 0.06);
  }
`

const DrawerBody = styled.div`
  display: flex;
  flex-direction: column;
`

const DrawerTitle = styled.h3`
  font-weight: 500;
  font-size: 24px;
  line-height: 125%;
  letter-spacing: 0em;
  color: #1c2024;
`

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 0px;
  row-gap: 10px;
  font-size: 16px;
`

const MetaLabel = styled.div`
  font-weight: 400;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.62);
`

const MetaValue = styled.div`
  font-weight: 500;
  line-height: 150%;
  color: #1c2024;
  text-align: left;
`

const Divider = styled.div`
  height: 1px;
  background: rgba(0, 0, 51, 0.12);
  margin: 12px 0;
`

const SectionTitle = styled.div`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
  margin-bottom: 12px;
`

const DescBox = styled.div`
  font-weight: 400;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
  border: 1px solid rgba(0, 0, 47, 0.15);
  border-radius: 8px;
  padding: 16px;
  background: #f9f9fb;
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const Label = styled.label`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
`

const Input = styled.input`
  height: 40px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  background: #fff;
  color: rgba(0, 7, 20, 0.72);
  outline: none;
  font-weight: 400;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;

  &::placeholder {
    font-weight: 400;
    font-size: 16px;
    line-height: 150%;
    color: rgba(0, 5, 29, 0.45);
  }
`

const TextArea = styled.textarea`
  min-height: 74px;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  background: #fff;
  font-size: 12px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.72);
  outline: none;
  resize: vertical;
  font-family: 'Inter', sans-serif;

  &::placeholder {
    font-weight: 400;
    font-size: 16px;
    line-height: 150%;
    color: rgba(0, 5, 29, 0.45);
  }
`

const DrawerButton = styled(Button)`
  height: 40px !important;
  padding: 0 30px !important;
`
