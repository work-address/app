import { Controller, type Control, type FieldPath } from 'react-hook-form'

import type { ProjectFormValues } from '../model'

import { Select, type InputProps, type SelectOption } from '@/shared'

type ProjectsFormSelectProps = {
  control: Control<ProjectFormValues>
  name: FieldPath<ProjectFormValues>
  options: SelectOption[]
  label?: string
  id?: string
  disabled?: boolean
  hasError?: boolean
  /** Value used when the field is empty. */
  fallbackValue?: string
  inputProps?: InputProps
}

/**
 * Controller-bound Select that hides the react-hook-form boilerplate and the
 * single-vs-multi value guard shared across project forms.
 */
const ID_PREFIX = 'project-form-'

export const ProjectsFormSelect = ({
  control,
  name,
  options,
  label,
  id,
  disabled,
  hasError,
  fallbackValue,
  inputProps,
}: ProjectsFormSelectProps) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <Select
        label={label}
        options={options}
        value={
          typeof field.value === 'string' && field.value
            ? field.value
            : (fallbackValue ?? '')
        }
        onChange={(value) => {
          if (!Array.isArray(value)) {
            field.onChange(value)
          }
        }}
        inputProps={{
          ...inputProps,
          disabled,
          state: hasError ? 'error' : 'valid',
          id: id ? `${ID_PREFIX}${id}` : undefined,
        }}
      />
    )}
  />
)
