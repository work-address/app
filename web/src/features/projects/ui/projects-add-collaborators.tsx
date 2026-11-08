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

import { ProjectsFormSelect } from './projects-form-select'

import type { CollaboratorRole, ProjectFormValues } from '../model'

import {
  Button,
  Hint,
  Input,
  isValidAccountAddress,
  normalizeAddress,
  Text,
  Tooltip,
  type InputProps,
} from '@/shared'

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
  // The API refuses a worker past the free limit, since only it can see the
  // owner's other projects. An owner can always remove someone.
  const fieldsDisabled = Boolean(disabled || readOnly)
  const removeDisabled = fieldsDisabled

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

  const addLabel = t(
    fields.length > 0
      ? 'project.createModal.collaborators.addMore'
      : 'project.createModal.collaborators.add',
  )

  const getRoleLabel = (role: CollaboratorRole) =>
    roleOptions.find((option) => option.value === role)?.label ?? role

  const validateAddress = (value: string) => {
    const address = value?.trim() ?? ''

    if (!address) {
      return t('project.createModal.collaborators.errorRequired')
    }

    if (!isValidAccountAddress(address)) {
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

  const addButton = readOnly ? null : (
    <Button
      size="s"
      variant="soft"
      color="neutral"
      iconLeft={<PlusIcon />}
      disabled={fieldsDisabled}
      onClick={() => append({ address: '', role: 'Viewer' })}
    >
      {addLabel}
    </Button>
  )

  return (
    <Flex direction={'column'} gap={'3'}>
      {/* The add action ends the heading's line instead of taking its own. */}
      <Header>
        <Title>
          <Text size={'2'} weight={'medium'}>
            {t(
              readOnly
                ? 'project.createModal.collaborators.viewTitle'
                : 'project.form.collaborators',
            )}
          </Text>
          <Hint content={t('project.form.hint.collaborators')} size={13} />
        </Title>
        {addButton}
      </Header>
      {fields.map((field, index) => {
        const addressError = errors.collaborators?.[index]?.address

        return (
          <Flex key={field.id} direction={'column'} gap={'1'}>
            <Flex gap={'4'} align={'end'}>
              <AddressField>
                <Input
                  label={t('project.createModal.collaborators.walletAddress')}
                  hint={t('project.form.hint.walletAddress')}
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
                    hint={t('project.form.hint.role')}
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
                    hint={t('project.form.hint.role')}
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
                <Tooltip
                  content={t('project.createModal.collaborators.remove')}
                >
                  <span>
                    <IconButton
                      style={{ cursor: 'pointer' }}
                      type={'button'}
                      variant={'ghost'}
                      color={'red'}
                      radius={'full'}
                      mb={'1'}
                      disabled={removeDisabled}
                      aria-label={t('project.createModal.collaborators.remove')}
                      onClick={() => remove(index)}
                    >
                      <TrashIcon width={18} height={18} />
                    </IconButton>
                  </span>
                </Tooltip>
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
    </Flex>
  )
}

const AddressField = styled.div`
  flex: 1;
  min-width: 0;
`

/* Wide enough for the longest role label, Japanese "Contributor". On a phone
   the address field needs the room more, and the open list shows it in full. */
const RoleField = styled.div`
  width: 196px;
  flex-shrink: 0;

  @media (max-width: 480px) {
    width: 160px;
  }
`

const Header = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-space-3);
  min-height: var(--ui-space-6);
`

const Title = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: var(--ui-space-2);
`
