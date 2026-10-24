import { useMemo } from 'react'
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ProjectsAddCollaborators } from './projects-add-collaborators'
import { ProjectsFormSelect } from './projects-form-select'
import { ProjectsFormTrackingOptions } from './projects-form-tracking-options'

import type { ProjectFormValues } from '../model'

import { BASE_CURRENCY, Input, Text, TextArea, type InputProps } from '@/shared'

// Label above the field, as every input in both project dialogs has it.
const STACKED_INPUT: InputProps = {
  rows: 'auto auto',
  columns: '1fr',
  gap: '2',
}

type Props = {
  control: Control<ProjectFormValues>
  register: UseFormRegister<ProjectFormValues>
  errors: FieldErrors<ProjectFormValues>
  disabled?: boolean
  premiumLocked?: boolean
  /** Keeps ids unique when the create and edit forms share a page. */
  idSuffix?: string
}

/**
 * The project form both dialogs show: details beside recording, collaborators
 * across both columns. The drawer stacks them in that order.
 */
export const ProjectsFormFields = ({
  control,
  register,
  errors,
  disabled,
  premiumLocked,
  idSuffix = '',
}: Props) => {
  const { t } = useTranslation()

  const stateOptions = useMemo(
    () => [
      { value: 'Active', label: t('dashboard.projectsTable.status.active') },
      { value: 'Inactive', label: t('dashboard.page.tabs.inactive') },
    ],
    [t],
  )

  return (
    <Root>
      <Details>
        <Input
          label={t('dashboard.projectsTable.form.projectName')}
          hint={t('project.form.hint.title')}
          id={`projectName${idSuffix}`}
          placeholder={t('project.createModal.projectNamePlaceholder')}
          disabled={disabled}
          state={errors.title ? 'error' : 'valid'}
          errorMessage={t('project.form.error.title')}
          {...STACKED_INPUT}
          {...register('title', { required: true })}
        />
        <Pair>
          <Input
            label={t('dashboard.projectsTable.form.rate')}
            hint={t('project.form.hint.rate')}
            id={`rate${idSuffix}`}
            // The $ beside it and the label say the rest; a sentence here is cut off.
            placeholder={'0.00'}
            addonLeft={
              <Text size={'2'} color={'gray'}>
                {BASE_CURRENCY.symbol}
              </Text>
            }
            inputMode="decimal"
            disabled={disabled}
            state={errors.rateHour ? 'error' : 'valid'}
            errorMessage={t('project.form.error.rate')}
            {...STACKED_INPUT}
            {...register('rateHour', { required: true })}
          />
          <ProjectsFormSelect
            control={control}
            name="state"
            label={t('dashboard.projectsTable.form.status')}
            hint={t('project.form.hint.state')}
            options={stateOptions}
            fallbackValue={'Active'}
            id={`state${idSuffix}`}
            disabled={disabled}
            hasError={Boolean(errors.state)}
            inputProps={STACKED_INPUT}
          />
        </Pair>
        <TextArea
          label={t('dashboard.projectsTable.form.description')}
          hint={t('project.form.hint.description')}
          id={`description${idSuffix}`}
          placeholder={t('project.createModal.descriptionPlaceholder')}
          rows={3}
          grow
          disabled={disabled}
          state={errors.text ? 'error' : 'valid'}
          errorMessage={t('project.form.error.description')}
          {...register('text', { required: true })}
        />
      </Details>
      <ProjectsFormTrackingOptions
        control={control}
        disabled={disabled}
        idSuffix={idSuffix}
      />
      {/* Address, role and remove need a full row; a column squeezes the address. */}
      <Collaborators>
        <ProjectsAddCollaborators
          control={control}
          register={register}
          errors={errors}
          disabled={disabled}
          premiumLocked={premiumLocked}
          inputProps={STACKED_INPUT}
        />
      </Collaborators>
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-5);

  ${(p) => p.theme.breakpoints.up('md')} {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: var(--space-6);
  }
`

const Details = styled.div`
  display: grid;
  align-content: start;
  gap: var(--space-4);
  min-width: 0;

  /* Beside the recording card the description takes the rest of the height,
     so both columns end on one line. */
  ${(p) => p.theme.breakpoints.up('md')} {
    grid-template-rows: auto auto minmax(0, 1fr);
    align-content: stretch;
  }
`

// Rate and status are short values; side by side they keep the column short.
const Pair = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  /* An error under one field must not push its neighbour's label down. */
  align-items: start;
  gap: var(--space-3);
`

const Collaborators = styled.div`
  grid-column: 1 / -1;
  min-width: 0;
  padding-top: var(--space-4);
  border-top: 1px solid var(--gray-a4);
`
