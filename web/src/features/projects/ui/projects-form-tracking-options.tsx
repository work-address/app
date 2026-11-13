import {
  Controller,
  useController,
  useWatch,
  type Control,
  type ControllerRenderProps,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { reviewWindowHourChoices } from '../lib/tracking-options'

import type { ProjectFormValues } from '../model'

import { Checkbox, Hint, Select, Text } from '@/shared'

type ProjectsFormTrackingOptionsProps = {
  control: Control<ProjectFormValues>
  disabled?: boolean
  /** Suffix keeps checkbox ids unique when several forms share a page. */
  idSuffix?: string
}

const ID_PREFIX = 'project-form-'
const REVIEW_WINDOW_SELECT_WIDTH = '96px'

// Titles and domains need apps, and location a phone, so each follows the
// switch it needs, nested beneath it.
const OPTIONS = [
  {
    name: 'trackScreenshots',
    labelKey: 'project.createModal.trackScreenshots',
    hintKey: 'project.form.hint.trackScreenshots',
  },
  {
    name: 'trackAgents',
    labelKey: 'project.createModal.trackAgents',
    hintKey: 'project.form.hint.trackAgents',
  },
  {
    name: 'allowManualTime',
    labelKey: 'project.createModal.allowManualTime',
    hintKey: 'project.form.hint.allowManualTime',
  },
  {
    name: 'allowMobileTime',
    labelKey: 'project.createModal.allowMobileTime',
    hintKey: 'project.form.hint.allowMobileTime',
  },
  {
    name: 'trackLocation',
    labelKey: 'project.createModal.trackLocation',
    hintKey: 'project.form.hint.trackLocation',
  },
  {
    name: 'trackProcesses',
    labelKey: 'project.createModal.trackProcesses',
    hintKey: 'project.form.hint.trackProcesses',
  },
  {
    name: 'trackWindowTitles',
    labelKey: 'project.createModal.trackWindowTitles',
    hintKey: 'project.form.hint.trackWindowTitles',
  },
  {
    name: 'trackBrowserDomains',
    labelKey: 'project.createModal.trackBrowserDomains',
    hintKey: 'project.form.hint.trackBrowserDomains',
  },
] as const

type SwitchName = (typeof OPTIONS)[number]['name']
type SwitchField = ControllerRenderProps<ProjectFormValues, SwitchName>

export const ProjectsFormTrackingOptions = ({
  control,
  disabled,
  idSuffix = '',
}: ProjectsFormTrackingOptionsProps) => {
  const { t } = useTranslation()
  const apps = useWatch({ control, name: 'trackProcesses' })
  const phone = useWatch({ control, name: 'allowMobileTime' })
  // Titles and domains require apps, and location a phone. They are held
  // here, outside the loop, so switching what they need off can switch them
  // off too: the form then shows exactly what the server will store instead
  // of a checked box that cannot be used.
  const titles = useController({ control, name: 'trackWindowTitles' })
  const domains = useController({ control, name: 'trackBrowserDomains' })
  const location = useController({ control, name: 'trackLocation' })
  const detailFields: Partial<Record<SwitchName, SwitchField>> = {
    trackWindowTitles: titles.field,
    trackBrowserDomains: domains.field,
    trackLocation: location.field,
  }
  const needed: Partial<Record<SwitchName, boolean>> = {
    trackWindowTitles: apps,
    trackBrowserDomains: apps,
    trackLocation: phone,
  }

  const renderSwitch = (name: SwitchName, id: string, field: SwitchField) => (
    <Checkbox
      id={id}
      checked={field.value}
      disabled={disabled || needed[name] === false}
      onCheckedChange={(checked) => {
        const on = checked === true
        field.onChange(on)
        if (name === 'trackProcesses' && !on) {
          titles.field.onChange(false)
          domains.field.onChange(false)
        }
        if (name === 'allowMobileTime' && !on) {
          location.field.onChange(false)
        }
      }}
    />
  )

  const headingId = `${ID_PREFIX}recording${idSuffix}`
  const reviewId = `${ID_PREFIX}reviewWindowHours${idSuffix}`

  return (
    <Root role="group" aria-labelledby={headingId}>
      <Text id={headingId} size={'2'} weight={'medium'}>
        {t('project.form.recording')}
      </Text>
      {/* One card, one row per setting: the review window is a recording
          rule too, so it closes the list instead of standing apart. */}
      <List>
        {OPTIONS.map(({ name, labelKey, hintKey }) => {
          const id = `${ID_PREFIX}${name}${idSuffix}`
          const held = detailFields[name]

          return (
            <Row key={name} data-nested={held ? true : undefined}>
              {held ? (
                renderSwitch(name, id, held)
              ) : (
                <Controller
                  control={control}
                  name={name}
                  render={({ field }) => renderSwitch(name, id, field)}
                />
              )}
              <Text as="label" htmlFor={id} size={'2'}>
                <LabelWithHint label={t(labelKey)} hint={t(hintKey)} />
              </Text>
              {name === 'trackLocation' && (
                <Notice role="note">
                  {t('project.form.trackLocationNotice')}
                </Notice>
              )}
            </Row>
          )
        })}
        <Row data-kind="select">
          <Text as="label" htmlFor={reviewId} size={'2'}>
            <LabelWithHint
              label={t('project.createModal.reviewWindowHours')}
              hint={t('project.form.hint.reviewWindowHours')}
            />
          </Text>
          <Controller
            control={control}
            name="reviewWindowHours"
            render={({ field }) => (
              <Select
                options={reviewWindowHourChoices(field.value).map((hours) => ({
                  value: String(hours),
                  label: String(hours),
                }))}
                value={String(field.value)}
                onChange={(value) => {
                  if (!Array.isArray(value)) {
                    field.onChange(Number(value))
                  }
                }}
                inputProps={{
                  // Two-digit hours need no more; the full width read as a text field.
                  style: { width: REVIEW_WINDOW_SELECT_WIDTH },
                  disabled,
                  id: reviewId,
                }}
              />
            )}
          />
        </Row>
      </List>
    </Root>
  )
}

/**
 * The hint follows the label's last word, so a wrapping label never leaves the
 * question mark alone on a line or pushed to the row's far edge.
 */
const LabelWithHint = ({ label, hint }: { label: string; hint: string }) => {
  const split = label.lastIndexOf(' ')
  return (
    <>
      {split > 0 ? `${label.slice(0, split)} ` : null}
      <span style={{ whiteSpace: 'nowrap' }}>
        {split > 0 ? label.slice(split + 1) : label}{' '}
        <Hint content={hint} size={13} />
      </span>
    </>
  )
}

const Root = styled.div`
  display: grid;
  align-content: start;
  gap: var(--ui-space-2);
  min-width: 0;
`

// Outlined inside its box, as the fields beside it are, so both columns end
// on the same pixel.
const List = styled.div`
  display: grid;
  border-radius: var(--ui-filter-radius);
  box-shadow: inset 0 0 0 1px var(--ui-line);
`

const Row = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--ui-space-2);
  min-height: var(--ui-space-7);
  padding: var(--ui-space-1) var(--ui-space-3);

  & + & {
    border-top: 1px solid var(--ui-inset);
  }

  /* A checkbox's width plus the gap: the nested box sits under the label,
     with no line between it and the switch it depends on. */
  &[data-nested] {
    padding-left: calc(
      var(--ui-space-3) + var(--ui-space-4) + var(--ui-space-2)
    );
    border-top-color: transparent;
  }

  /* Label first, the dropdown at the row's end. */
  &[data-kind='select'] {
    grid-template-columns: minmax(0, 1fr) auto;
  }
`

// The owner's duty, said where they turn location on, under its label.
const Notice = styled.p`
  grid-column: 2;
  margin: 0;
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  color: var(--ui-muted);
`
