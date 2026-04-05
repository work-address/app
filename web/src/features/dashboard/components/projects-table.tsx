import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'
import { Drawer } from 'vaul'

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

export const ProjectsTable = ({ rows }: ProjectsTableProps) => {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null)
  const [openDrawer, setOpenDrawer] = useState(false)
  const [drawerRow, setDrawerRow] = useState<ProjectRow | null>(null)
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [openMobile, setOpenMobile] = useState<Record<string, boolean>>({})

  const { breakpoints } = useTheme()
  const isMobile = useMediaQuery(breakpoints.down('md'))

  const statusLabel = (status: ProjectStatus) => {
    if (status === 'Active') {
      return t('dashboard.projectsTable.status.active')
    }
    if (status === 'Paused') {
      return t('dashboard.projectsTable.status.paused')
    }
    return t('dashboard.projectsTable.status.finished')
  }

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

  const toggleMobileRow = (key: string) => {
    setOpenMobile((prev) => ({ ...prev, [key]: !prev[key] }))
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
      <MobileList>
        {sortedRows.map((r) => {
          const expanded = Boolean(openMobile[r.key])
          return (
            <MobileCard key={r.key}>
              <MobileHeader>
                <MobileLeft>
                  <Checkbox
                    checked={!!selected[r.key]}
                    onChange={(e) => setOne(r.key, e.target.checked)}
                  />
                  <MobileTitleBox>
                    <MobileTitleRow>
                      <MobileLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          showDrawer(r, 'view')
                        }}
                      >
                        {r.name}
                      </MobileLink>
                      <StatusPill $status={r.status}>
                        {statusLabel(r.status)}
                      </StatusPill>
                    </MobileTitleRow>
                    <MobileSub>{r.earnings}</MobileSub>
                  </MobileTitleBox>
                </MobileLeft>

                <MobileExpand
                  type="button"
                  aria-expanded={expanded}
                  aria-label={t('dashboard.projectsTable.aria.info')}
                  onClick={() => toggleMobileRow(r.key)}
                >
                  <ExpandIcon $open={expanded} aria-hidden="true" />
                </MobileExpand>
              </MobileHeader>

              {expanded ? (
                <MobileBody>
                  <MobileStats>
                    <StatRow>
                      <StatLabel>
                        {t('dashboard.projectsTable.head.timeTotal')}
                        <img
                          src="/img/icons/question-mark-circled.svg"
                          alt={t('dashboard.projectsTable.aria.info')}
                          width={14}
                          height={14}
                        />
                      </StatLabel>
                      <StatValue>{r.timeTotal}</StatValue>
                    </StatRow>
                    <StatRow>
                      <StatLabel>
                        {t('dashboard.projectsTable.head.timeActive')}
                        <img
                          src="/img/icons/question-mark-circled.svg"
                          alt={t('dashboard.projectsTable.aria.info')}
                          width={14}
                          height={14}
                        />
                      </StatLabel>
                      <StatValue>{r.timeActive}</StatValue>
                    </StatRow>
                    <StatRow>
                      <StatLabel>
                        {t('dashboard.projectsTable.head.keyboard')}
                        <img
                          src="/img/icons/question-mark-circled.svg"
                          alt={t('dashboard.projectsTable.aria.info')}
                          width={14}
                          height={14}
                        />
                      </StatLabel>
                      <StatValue>{r.keyboard}</StatValue>
                    </StatRow>
                    <StatRow>
                      <StatLabel>
                        {t('dashboard.projectsTable.head.mouse')}
                        <img
                          src="/img/icons/question-mark-circled.svg"
                          alt={t('dashboard.projectsTable.aria.info')}
                          width={14}
                          height={14}
                        />
                      </StatLabel>
                      <StatValue>{r.mouse}</StatValue>
                    </StatRow>
                    <StatRow>
                      <StatLabel>
                        {t('dashboard.projectsTable.head.mouseDistance')}
                        <img
                          src="/img/icons/question-mark-circled.svg"
                          alt={t('dashboard.projectsTable.aria.info')}
                          width={14}
                          height={14}
                        />
                      </StatLabel>
                      <StatValue>{r.mouseDistance}</StatValue>
                    </StatRow>
                  </MobileStats>

                  <MobileActions>
                    <MobileDeleteBtn
                      type="button"
                      onClick={() => {
                        setDrawerRow(r)
                        openDelete()
                      }}
                    >
                      {t('dashboard.projectsTable.actions.delete')}
                      <img
                        src="/img/icons/trash.svg"
                        alt={t('dashboard.projectsTable.actions.delete')}
                      />
                    </MobileDeleteBtn>
                    <MobileEditBtn
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        showDrawer(r, 'edit')
                      }}
                    >
                      {t('dashboard.projectsTable.actions.edit')}
                      <img
                        src="/img/icons/pencil-icon-edit.svg"
                        alt={t('dashboard.projectsTable.actions.edit')}
                      />
                    </MobileEditBtn>
                  </MobileActions>
                </MobileBody>
              ) : null}
            </MobileCard>
          )
        })}
      </MobileList>

      <DesktopTable>
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
                      {t('dashboard.projectsTable.head.projectName')}
                      <HeadIcon
                        src="/img/icons/question-mark-circled.svg"
                        alt={t('dashboard.projectsTable.aria.info')}
                      />
                      <SortArrow
                        src="/img/icons/arrow-down.svg"
                        alt={t('dashboard.projectsTable.aria.sort')}
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
                      {t('dashboard.projectsTable.head.earnings')}
                      <SortArrow
                        src="/img/icons/arrow-down.svg"
                        alt={t('dashboard.projectsTable.aria.sort')}
                        $active={sort?.key === 'earnings'}
                        $dir={sort?.key === 'earnings' ? sort.dir : undefined}
                      />
                    </Head>
                  </SortBtn>
                </Th>
                <Th>{t('dashboard.projectsTable.head.status')}</Th>
                <Th>
                  <Head>
                    {t('dashboard.projectsTable.head.timeTotal')}
                    <HeadIcon
                      src="/img/icons/question-mark-circled.svg"
                      alt={t('dashboard.projectsTable.aria.info')}
                    />
                  </Head>
                </Th>
                <Th>
                  <Head>
                    {t('dashboard.projectsTable.head.timeActive')}
                    <HeadIcon
                      src="/img/icons/question-mark-circled.svg"
                      alt={t('dashboard.projectsTable.aria.info')}
                    />
                  </Head>
                </Th>
                <Th>
                  <SortBtn
                    $active={sort?.key === 'keyboard'}
                    onClick={() => toggleSort('keyboard')}
                  >
                    <Head>
                      {t('dashboard.projectsTable.head.keyboard')}
                      <HeadIcon
                        src="/img/icons/question-mark-circled.svg"
                        alt={t('dashboard.projectsTable.aria.info')}
                      />
                      <SortArrow
                        src="/img/icons/arrow-down.svg"
                        alt={t('dashboard.projectsTable.aria.sort')}
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
                      {t('dashboard.projectsTable.head.mouse')}
                      <HeadIcon
                        src="/img/icons/question-mark-circled.svg"
                        alt={t('dashboard.projectsTable.aria.info')}
                      />
                      <SortArrow
                        src="/img/icons/arrow-down.svg"
                        alt={t('dashboard.projectsTable.aria.sort')}
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
                      {t('dashboard.projectsTable.head.mouseDistance')}
                      <HeadIcon
                        src="/img/icons/question-mark-circled.svg"
                        alt={t('dashboard.projectsTable.aria.info')}
                      />
                      <SortArrow
                        src="/img/icons/arrow-down.svg"
                        alt={t('dashboard.projectsTable.aria.sort')}
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
                    <StatusPill $status={r.status}>
                      {statusLabel(r.status)}
                    </StatusPill>
                  </Td>
                  <Td>{r.timeTotal}</Td>
                  <Td>{r.timeActive}</Td>
                  <Td>{r.keyboard}</Td>
                  <Td>{r.mouse}</Td>
                  <Td>{r.mouseDistance}</Td>
                  <TdRight>
                    <Actions>
                      <ActionBtn
                        aria-label={t('dashboard.projectsTable.actions.print')}
                      >
                        <ActionIcon
                          src="/img/icons/print.svg"
                          alt={t('dashboard.projectsTable.actions.print')}
                        />
                      </ActionBtn>
                      <ActionBtn
                        aria-label={t('dashboard.projectsTable.actions.delete')}
                      >
                        <ActionIcon
                          src="/img/icons/delete.svg"
                          alt={t('dashboard.projectsTable.actions.delete')}
                        />
                      </ActionBtn>
                      <ActionBtn
                        aria-label={t('dashboard.projectsTable.actions.edit')}
                        onClick={(e) => {
                          e.preventDefault()
                          showDrawer(r, 'edit')
                        }}
                      >
                        <ActionIcon
                          src="/img/icons/edit.svg"
                          alt={t('dashboard.projectsTable.actions.edit')}
                        />
                      </ActionBtn>
                    </Actions>
                  </TdRight>
                </Tr>
              ))}
            </tbody>
          </TableEl>
        </Scroll>
      </DesktopTable>

      {isMobile ? (
        <Drawer.Root open={openDrawer} onOpenChange={setOpenDrawer}>
          <Drawer.Portal>
            <MobileDrawerOverlay />
            <MobileDrawerContent>
              <MobileSheet>
                <MobileSheetHandle />
                <DrawerRoot>
                  {/* TODO */}
                  {/* eslint-disable-next-line */}
                  {drawerMode === 'edit' ? (
                    <DrawerHead>
                      <DrawerTitle>{drawerRow?.name ?? ''}</DrawerTitle>
                      <DrawerHeadRight>
                        <DeleteIconBtn
                          type="button"
                          aria-label={t(
                            'dashboard.projectsTable.drawer.delete',
                          )}
                          onClick={openDelete}
                        >
                          <img
                            src="/img/icons/drawer-delete-icon.svg"
                            alt={t('dashboard.projectsTable.drawer.delete')}
                          />
                        </DeleteIconBtn>
                      </DrawerHeadRight>
                    </DrawerHead>
                  ) : (
                    <DrawerHead>
                      <DrawerTitle>{drawerRow?.name ?? ''}</DrawerTitle>
                      <DrawerHeadRight>
                        <DeleteIconBtn
                          type="button"
                          aria-label={t(
                            'dashboard.projectsTable.drawer.delete',
                          )}
                          onClick={openDelete}
                        >
                          <img
                            src="/img/icons/drawer-delete-icon.svg"
                            alt={t('dashboard.projectsTable.drawer.delete')}
                          />
                        </DeleteIconBtn>
                      </DrawerHeadRight>
                    </DrawerHead>
                  )}

                  {drawerMode === 'view' ? (
                    <DrawerBody>
                      <MetaGrid>
                        <MetaLabel>
                          {t('dashboard.projectsTable.drawer.meta.startDate')}
                        </MetaLabel>
                        <MetaValue>Mar 16, 2025, 09:28</MetaValue>

                        <MetaLabel>
                          {t('dashboard.projectsTable.drawer.meta.publishedIn')}
                        </MetaLabel>
                        <MetaValue>Personal</MetaValue>

                        <MetaLabel>
                          {t('dashboard.projectsTable.drawer.meta.rate')}
                        </MetaLabel>
                        <MetaValue>20 USD/hour</MetaValue>
                      </MetaGrid>

                      <Divider />

                      <MobileViewStats>
                        <MobileViewStatRow>
                          <MobileViewStatLabel>
                            {t('dashboard.projectsTable.head.timeTotal')}
                            <img
                              src="/img/icons/question-mark-circled.svg"
                              alt={t('dashboard.projectsTable.aria.info')}
                              width={14}
                              height={14}
                            />
                          </MobileViewStatLabel>
                          <MobileViewStatValue>
                            {drawerRow?.timeTotal ?? ''}
                          </MobileViewStatValue>
                        </MobileViewStatRow>
                        <MobileViewStatRow>
                          <MobileViewStatLabel>
                            {t('dashboard.projectsTable.head.timeActive')}
                            <img
                              src="/img/icons/question-mark-circled.svg"
                              alt={t('dashboard.projectsTable.aria.info')}
                              width={14}
                              height={14}
                            />
                          </MobileViewStatLabel>
                          <MobileViewStatValue>
                            {drawerRow?.timeActive ?? ''}
                          </MobileViewStatValue>
                        </MobileViewStatRow>
                        <MobileViewStatRow>
                          <MobileViewStatLabel>
                            {t('dashboard.projectsTable.head.keyboard')}
                            <img
                              src="/img/icons/question-mark-circled.svg"
                              alt={t('dashboard.projectsTable.aria.info')}
                              width={14}
                              height={14}
                            />
                          </MobileViewStatLabel>
                          <MobileViewStatValue>
                            {drawerRow?.keyboard ?? ''}
                          </MobileViewStatValue>
                        </MobileViewStatRow>
                        <MobileViewStatRow>
                          <MobileViewStatLabel>
                            {t('dashboard.projectsTable.head.mouse')}
                            <img
                              src="/img/icons/question-mark-circled.svg"
                              alt={t('dashboard.projectsTable.aria.info')}
                              width={14}
                              height={14}
                            />
                          </MobileViewStatLabel>
                          <MobileViewStatValue>
                            {drawerRow?.mouse ?? ''}
                          </MobileViewStatValue>
                        </MobileViewStatRow>
                        <MobileViewStatRow>
                          <MobileViewStatLabel>
                            {t('dashboard.projectsTable.head.mouseDistance')}
                            <img
                              src="/img/icons/question-mark-circled.svg"
                              alt={t('dashboard.projectsTable.aria.info')}
                              width={14}
                              height={14}
                            />
                          </MobileViewStatLabel>
                          <MobileViewStatValue>
                            {drawerRow?.mouseDistance ?? ''}
                          </MobileViewStatValue>
                        </MobileViewStatRow>
                      </MobileViewStats>

                      <Divider />

                      <SectionTitle>
                        {t(
                          'dashboard.projectsTable.drawer.section.description',
                        )}
                      </SectionTitle>
                      <DescBox>
                        Lorem ipsum dolor sit amet, consectetur adipisicing
                        elit, sed do eiusmod tempor incididunt ut labore et
                        dolore magna aliqua.
                      </DescBox>

                      <MobileViewFooter>
                        <MobileViewAction
                          type="button"
                          onClick={() => {
                            closeDrawer()
                          }}
                        >
                          <img
                            src="/img/icons/download-icon.svg"
                            alt={t('dashboard.projectsTable.drawer.download')}
                          />
                          {t('dashboard.projectsTable.drawer.invoice', {
                            defaultValue: 'Invoice',
                          })}
                        </MobileViewAction>
                        <MobileViewAction
                          type="button"
                          $primary
                          onClick={() => {
                            if (drawerRow) {
                              showDrawer(drawerRow, 'edit')
                            }
                          }}
                        >
                          <img
                            src="/img/icons/pencil-icon.svg"
                            alt={t('dashboard.projectsTable.actions.edit')}
                          />
                          {t('dashboard.projectsTable.drawer.edit')}
                        </MobileViewAction>
                      </MobileViewFooter>
                    </DrawerBody>
                  ) : (
                    <DrawerBody>
                      <Form>
                        <Field>
                          <Label>
                            {t('dashboard.projectsTable.form.projectName')}
                          </Label>
                          <Input
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder={t(
                              'dashboard.projectsTable.form.projectNamePlaceholder',
                            )}
                          />
                        </Field>
                        <Field>
                          <Label>
                            {t('dashboard.projectsTable.form.publishedIn')}
                          </Label>
                          <MotionSelect
                            options={folderOptions}
                            value={draftFolder}
                            onChange={(value) =>
                              setDraftFolder(
                                Array.isArray(value) ? (value[0] ?? '') : value,
                              )
                            }
                            placeholder={t(
                              'dashboard.projectsTable.form.publishedInPlaceholder',
                            )}
                          />
                        </Field> 
                        <Field>
                          <Label>
                            {t('dashboard.projectsTable.form.rate')}
                          </Label>
                          <Input
                            value={draftRate}
                            onChange={(e) => setDraftRate(e.target.value)}
                            placeholder="0"
                          />
                        </Field>

                        <Divider2 />

                        <Field>
                          <Label>
                            {t('dashboard.projectsTable.form.description')}
                          </Label>
                          <TextArea
                            value={draftDesc}
                            onChange={(e) => setDraftDesc(e.target.value)}
                            placeholder={t(
                              'dashboard.projectsTable.form.descriptionPlaceholder',
                            )}
                          />
                        </Field>
                      </Form>

                      <MobileEditFooter>
                        <MobileFooterBtn type="button" onClick={closeDrawer}>
                          {t('dashboard.projectsTable.drawer.cancel', {
                            defaultValue: 'Cancel',
                          })}
                        </MobileFooterBtn>
                        <MobileFooterBtn
                          type="button"
                          $primary
                          onClick={() => {
                            closeDrawer()
                          }}
                        >
                          {t('dashboard.projectsTable.drawer.save')}
                        </MobileFooterBtn>
                      </MobileEditFooter>
                    </DrawerBody>
                  )}
                </DrawerRoot>
              </MobileSheet>
            </MobileDrawerContent>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        <RightDrawer open={openDrawer} onClose={closeDrawer}>
          <DrawerRoot>
            <DrawerHead>
              <DrawerClose
                type="button"
                aria-label={t('dashboard.projectsTable.drawer.close')}
                onClick={closeDrawer}
              >
                ×
              </DrawerClose>

              <DrawerHeadRight>
                <DeleteIconBtn
                  type="button"
                  aria-label={t('dashboard.projectsTable.drawer.delete')}
                  onClick={openDelete}
                >
                  <img
                    src="/img/icons/drawer-delete-icon.svg"
                    alt={t('dashboard.projectsTable.drawer.delete')}
                  />
                </DeleteIconBtn>
                {drawerMode === 'view' ? (
                  <>
                    <IconBtn
                      type="button"
                      aria-label={t('dashboard.projectsTable.drawer.download')}
                    >
                      <img
                        src="/img/icons/download-icon.svg"
                        alt={t('dashboard.projectsTable.drawer.download')}
                      />
                    </IconBtn>
                    <DrawerButton
                      themeVariant="primary"
                      onClick={() => {
                        if (drawerRow) {
                          showDrawer(drawerRow, 'edit')
                        }
                      }}
                    >
                      {t('dashboard.projectsTable.drawer.edit')}
                    </DrawerButton>
                  </>
                ) : (
                  <DrawerButton themeVariant="primary">
                    {t('dashboard.projectsTable.drawer.save')}
                  </DrawerButton>
                )}
              </DrawerHeadRight>
            </DrawerHead>

            {drawerMode === 'view' ? (
              <DrawerBody>
                <DrawerTitle>{drawerRow?.name ?? ''}</DrawerTitle>

                <Divider />

                <MetaGrid>
                  <MetaLabel>
                    {t('dashboard.projectsTable.drawer.meta.startDate')}
                  </MetaLabel>
                  <MetaValue>Mar 16, 2025 09:28</MetaValue>

                  <MetaLabel>
                    {t('dashboard.projectsTable.drawer.meta.publishedIn')}
                  </MetaLabel>
                  <MetaValue>Personal</MetaValue>

                  <MetaLabel>
                    {t('dashboard.projectsTable.drawer.meta.rate')}
                  </MetaLabel>
                  <MetaValue>20 USD/hour</MetaValue>
                </MetaGrid>

                <Divider />

                <SectionTitle>
                  {t('dashboard.projectsTable.drawer.section.description')}
                </SectionTitle>
                <DescBox>
                  Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed
                  do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </DescBox>
              </DrawerBody>
            ) : (
              <DrawerBody>
                <DrawerTitle>
                  {t('dashboard.projectsTable.drawer.editProjectTitle')}
                </DrawerTitle>
                <Divider />
                <Form>
                  <Field>
                    <Label>
                      {t('dashboard.projectsTable.form.projectName')}
                    </Label>
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder={t(
                        'dashboard.projectsTable.form.projectNamePlaceholder',
                      )}
                    />
                  </Field>
                  <Field>
                    <Label>
                      {t('dashboard.projectsTable.form.publishedIn')}
                    </Label>
                    <MotionSelect
                      options={folderOptions}
                      value={draftFolder}
                      onChange={(value) =>
                        setDraftFolder(
                          Array.isArray(value) ? (value[0] ?? '') : value,
                        )
                      }
                      placeholder={t(
                        'dashboard.projectsTable.form.publishedInPlaceholder',
                      )}
                    />
                  </Field>
                  <Field>
                    <Label>{t('dashboard.projectsTable.form.rate')}</Label>
                    <Input
                      value={draftRate}
                      onChange={(e) => setDraftRate(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <Field>
                    <Label>
                      {t('dashboard.projectsTable.form.description')}
                    </Label>
                    <TextArea
                      value={draftDesc}
                      onChange={(e) => setDraftDesc(e.target.value)}
                      placeholder={t(
                        'dashboard.projectsTable.form.descriptionPlaceholder',
                      )}
                    />
                  </Field>
                </Form>
              </DrawerBody>
            )}
          </DrawerRoot>
        </RightDrawer>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={t('dashboard.projectsTable.confirmDelete.title')}
        description={t('dashboard.projectsTable.confirmDelete.description')}
        cancelLabel={t('dashboard.projectsTable.confirmDelete.cancel')}
        confirmLabel={t('dashboard.projectsTable.confirmDelete.confirm')}
        onCancel={closeDelete}
        onConfirm={() => {
          closeDelete()
          closeDrawer()
        }}
      />
    </Wrap>
  )
}

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

  @media (max-width: 768px) {
    box-shadow: none;
  }
`

const MobileViewStats = styled.div`
  display: grid;
  gap: 14px;

  img {
    opacity: 0.75;
  }
`

const MobileViewStatRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
`

const MobileViewStatLabel = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  line-height: 18px;
  color: rgba(0, 7, 20, 0.62);
`

const MobileViewStatValue = styled.div`
  font-size: 14px;
  line-height: 18px;
  font-weight: 500;
  color: rgba(0, 7, 20, 0.82);
`

const MobileViewFooter = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  position: fixed;
  bottom: 0px;
  left: 0px;
  right: 0px;
padding: 8px 16px 25px;
border-top: 1px solid rgba(0, 0, 47, 0.15);
  gap: 10px;
  background-color: #fff;
  margin-top: 16px;
`

const MobileViewAction = styled.button<{ $primary?: boolean }>`
  height: 32px;
  border-radius: 4px;
  border: 1px solid rgba(0, 8, 48, 0.27);
  background: ${(p) => (p.$primary ? '#3b66a6' : '#fff')};
  color: ${(p) => (p.$primary ? '#fff' : '#60646c')};
  font-size: 14px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &:hover {
    background: ${(p) => (p.$primary ? '#355c98' : 'rgba(0, 0, 51, 0.04)')};
  }

  img {
    width: 13px;
    height: 13px;
    object-fit: cover;
    filter: ${(p) => (p.$primary ? 'brightness(0) invert(1)' : 'none')};
  }
`

const DesktopTable = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
`

const MobileList = styled.div`
  display: none;
  padding: 6px;

  @media (max-width: 768px) {
    display: grid;
    gap: 8px;
  }
`

const MobileCard = styled.div`
  background: #fff;
  overflow: hidden;
  border-bottom: 1px solid rgba(0, 0, 45, 0.09);
  &:last-child {
    border-bottom: none;
  }
`

const MobileHeader = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
`

const MobileLeft = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
`

const MobileTitleBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const MobileTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

const MobileLink = styled.a`
  color: var(--download, #003482);
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const MobileSub = styled.div`
  font-size: 12px;
  line-height: 16px;
  color: rgba(0, 7, 20, 0.62);
`

const MobileExpand = styled.button`
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 6px;

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }
`

const ExpandIcon = styled.span<{ $open: boolean }>`
  width: 9px;
  height: 9px;
  border-right: 2px solid rgba(0, 7, 20, 0.72);
  border-bottom: 2px solid rgba(0, 7, 20, 0.72);
  transform: ${(p) => (p.$open ? 'rotate(225deg)' : 'rotate(45deg)')};
  transition: transform 160ms ease;
  margin-top: ${(p) => (p.$open ? '2px' : '-2px')};
`

const MobileBody = styled.div`
  padding: 0 10px 10px;
`

const MobileStats = styled.div`
  display: grid;
  gap: 8px;
  padding: 8px 0 10px;
  border-top: 1px solid rgba(0, 0, 51, 0.12);

  img {
    opacity: 0.75;
  }
`

const StatRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`

const StatLabel = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 16px;
  color: rgba(0, 7, 20, 0.62);
`

const StatValue = styled.div`
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  color: rgba(0, 7, 20, 0.82);
`

const MobileActions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`

const MobileActionBtn = styled.button`
  height: 32px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 47, 0.15);
  background: #fff;
  font-size: 14px;
  line-height: 16px;
  font-weight: 500;
  color: var(--ds-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.5s ease;

  img {
    width: 16px;
    height: 16px;
    display: block;
  }
`

const MobileDeleteBtn = styled(MobileActionBtn)`
  border-color: #ce2c31;
  color: #ce2c31;

  &:hover {
    background: rgba(210, 0, 5, 0.06);
  }

  img {
    width: 16px;
    height: 16px;
  }
`

const MobileEditBtn = styled(MobileActionBtn)`
  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }
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
  color: var(--ds-primary);
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
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }

  img {
    width: 13px;
    height: 13px;
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
  padding-bottom: 70px;
  max-height: 700px;
  overflow: auto;
`

const DrawerTitle = styled.h3`
  font-weight: 500;
  font-size: 18px;
  line-height: 144%;
  letter-spacing: 0em;
  color: #1c2024;
`

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 0px;
  row-gap: 10px;
  font-size: 14px;
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
  margin: 16px 0;
`

const Divider2 = styled.div`
  height: 0.5px;
  background: rgba(0, 0, 51, 0.12);
`

const SectionTitle = styled.div`
  font-weight: 500;
  font-size: 14px;
  line-height: 150%;
  color: #1c2024;
  margin-bottom: 12px;
`

const DescBox = styled.div`
  font-weight: 400;
  font-size: 14px;
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
  font-size: 14px;
  line-height: 143%;
  color: #1c2024;
`

const Input = styled.input`
  height: 32px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 47, 0.15);
  background: #fff;
  color: rgba(0, 7, 20, 0.72);
  outline: none;
  font-weight: 400;
  font-size: 14px;
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

const MobileDrawerOverlay = styled(Drawer.Overlay)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 200;
`

const MobileDrawerContent = styled(Drawer.Content)`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 201;
  outline: none;
`

const MobileSheet = styled.div`
  background: #fff;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -10px 35px rgba(0, 0, 0, 0.12);
  max-height: 92vh;
  overflow: auto;
`

const MobileSheetHandle = styled.div`
  width: 52px;
  height: 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  margin: 10px auto 0;
`

const MobileEditFooter = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  border-top: 1px solid rgba(0, 0, 47, 0.15);
  padding: 8px 16px 25px;
  gap: 10px;
  margin-top: 16px;
`

const MobileFooterBtn = styled.button<{ $primary?: boolean }>`
  height: 32px;
  border-radius: 4px;
  background: ${(p) => (p.$primary ? '#3b66a6' : 'rgba(0, 0, 51, 0.06)')};
  color: ${(p) => (p.$primary ? '#fff' : 'rgba(0, 7, 20, 0.72)')};
  font-size: 14px;
  font-weight: 500;

  &:hover {
    background: ${(p) => (p.$primary ? '#355c98' : '#e9edf2')};
  }
`
