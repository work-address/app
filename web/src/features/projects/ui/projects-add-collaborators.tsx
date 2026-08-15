import { PlusIcon, TrashIcon } from '@radix-ui/react-icons'
import { Flex, IconButton } from '@radix-ui/themes'
import { useMemo } from 'react'
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { isValidWalletAddress, normalizeAddress } from '../model'

import { ProjectsFormSelect } from './projects-form-select'

import type { CollaboratorRole, ProjectFormValues } from '../model'

import { Button, Input, Text, type InputProps } from '@/shared'

const ID_PREFIX = 'add-collaborators-'

type Props = {
  control: Control<ProjectFormValues>
  register: UseFormRegister<ProjectFormValues>
  errors: FieldErrors<ProjectFormValues>
  disabled?: boolean
  /** View mode: hide add/remove and render fields read-only. */
  readOnly?: boolean
  inputProps?: InputProps
}

export const ProjectsAddCollaborators = ({
  control,
  register,
  errors,
  disabled,
  readOnly,
  inputProps,
}: Props) => {
  const { t } = useTranslation()
  const fieldsDisabled = Boolean(disabled || readOnly)

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'collaborators',
  })

  const watchedCollaborators = useWatch({ control, name: 'collaborators' })

  const roleOptions = useMemo(
    () => [
      {
        value: 'Worker' satisfies CollaboratorRole,
        label: t('project.createModal.collaborators.role.worker'),
      },
      {
        value: 'Viewer' satisfies CollaboratorRole,
        label: t('project.createModal.collaborators.role.viewer'),
      },
    ],
    [t],
  )

  const getRoleLabel = (role: CollaboratorRole) =>
    roleOptions.find((option) => option.value === role)?.label ?? role

  const validateAddress = (value: string) => {
    const address = value?.trim() ?? ''

    if (!address) {
      return t('project.createModal.collaborators.errorRequired')
    }

    if (!isValidWalletAddress(address)) {
      return t('project.createModal.collaborators.errorInvalid')
    }

    const normalized = normalizeAddress(address)
    const occurrences = (watchedCollaborators ?? []).filter(
      (row) => normalizeAddress(row.address) === normalized,
    ).length

    if (occurrences > 1) {
      return t('project.createModal.collaborators.errorDuplicate')
    }

    return true
  }

  return (
    <Flex direction={'column'} gap={'4'}>
      <Text size={'3'} weight={'medium'}>
        {t(
          readOnly
            ? 'project.createModal.collaborators.viewTitle'
            : 'project.createModal.collaborators.title',
        )}
      </Text>
      {fields.map((field, index) => {
        const addressError = errors.collaborators?.[index]?.address

        return (
          <Flex key={field.id} direction={'column'} gap={'1'}>
            <Flex gap={'4'} align={'end'}>
              <AddressField>
                <Input
                  label={t('project.createModal.collaborators.walletAddress')}
                  id={`${ID_PREFIX}address-${index}`}
                  placeholder={t(
                    'project.createModal.collaborators.walletPlaceholder',
                  )}
                  disabled={fieldsDisabled}
                  state={addressError ? 'error' : 'valid'}
                  {...inputProps}
                  {...register(`collaborators.${index}.address`, {
                    validate: validateAddress,
                  })}
                />
              </AddressField>
              <RoleField>
                {readOnly ? (
                  <Input
                    label={t('project.createModal.collaborators.role')}
                    id={`${ID_PREFIX}role-${index}`}
                    value={getRoleLabel(field.role)}
                    disabled
                    {...inputProps}
                  />
                ) : (
                  <ProjectsFormSelect
                    control={control}
                    name={`collaborators.${index}.role`}
                    label={t('project.createModal.collaborators.role')}
                    options={roleOptions}
                    fallbackValue={'Viewer'}
                    id={`role-${index}`}
                    disabled={fieldsDisabled}
                    hasError={Boolean(errors.collaborators?.[index]?.role)}
                    inputProps={inputProps}
                  />
                )}
              </RoleField>
              {!readOnly && (
                <IconButton
                  style={{ cursor: 'pointer' }}
                  type={'button'}
                  variant={'ghost'}
                  color={'red'}
                  radius={'full'}
                  mb={'1'}
                  disabled={fieldsDisabled}
                  aria-label={t('project.createModal.collaborators.remove')}
                  onClick={() => remove(index)}
                >
                  <TrashIcon width={18} height={18} />
                </IconButton>
              )}
            </Flex>
            {!readOnly && addressError?.message && (
              <Text size={'1'} color={'red'}>
                {addressError.message}
              </Text>
            )}
          </Flex>
        )
      })}
      {!readOnly && (
        <AddMoreButton
          variant="ghost"
          color="neutral"
          iconLeft={<PlusIcon />}
          disabled={fieldsDisabled}
          onClick={() => append({ address: '', role: 'Viewer' })}
        >
          {t('project.createModal.collaborators.addMore')}
        </AddMoreButton>
      )}
    </Flex>
  )
}

const AddressField = styled.div`
  flex: 1;
  min-width: 0;
`

const RoleField = styled.div`
  width: 160px;
  flex-shrink: 0;
`

const AddMoreButton = styled(Button)`
  margin-left: 12px;
  align-self: flex-start;
  color: var(--gray-11);
  padding-inline: 0;

  &:hover:not(:disabled) {
    background: transparent;
    color: var(--gray-12);
  }
`
