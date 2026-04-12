import { Flex, Grid } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import {
  AdaptiveDialog,
  Button,
  Input,
  type InputProps,
  Text,
  TextArea,
  useBreakpoints,
} from '@/features/shared'

type CreateProjectPayload = {
  name: string
  rate: string
  description: string
}

type CreateProjectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (payload: CreateProjectPayload) => void
}

export const CreateProjectModal = ({
  open,
  onOpenChange,
}: CreateProjectModalProps) => {
  const { t } = useTranslation()
  const { isMobile } = useBreakpoints()

  const inputProps: InputProps = {
    rows: 'auto 1fr',
    columns: '1fr',
    gap: '2',
    size: '3',
  }

  return (
    <AdaptiveDialog
      desktopPadding={'var(--space-5)'}
      desktopWidth={'450px'}
      onOpenChange={onOpenChange}
      open={open}
      title={<>{t('project.createModal.title')}</>}
      description={
        isMobile ? (
          <Grid gap={'3'} columns={'1fr 1fr'}>
            <Button
              themeVariant={'secondary'}
              onClick={() => onOpenChange(false)}
            >
              {t('dashboard.projectsTable.confirmDelete.cancel')}
            </Button>
            <Button themeVariant={'primary'}>
              {t('dashboard.page.createProject')}
            </Button>
          </Grid>
        ) : (
          <Flex gap={'3'} justify={'end'}>
            <Button
              themeVariant={'secondary'}
              size={'3'}
              onClick={() => onOpenChange(false)}
            >
              {t('dashboard.projectsTable.confirmDelete.cancel')}
            </Button>

            <Button themeVariant={'primary'} size={'3'}>
              {t('dashboard.page.createProject')}
            </Button>
          </Flex>
        )
      }
    >
      <Flex gap={'5'} direction={'column'}>
        <Text color={isMobile ? 'gray' : undefined} size={isMobile ? '2' : '3'}>
          {t('project.createModal.intro')}
        </Text>

        <Flex gap={'4'} direction={'column'}>
          <Input
            label={t('dashboard.projectsTable.form.projectName')}
            id={'projectName'}
            placeholder={t('project.createModal.projectNamePlaceholder')}
            {...inputProps}
          />

          <Input
            label={t('dashboard.projectsTable.form.rate')}
            id={'rate'}
            placeholder={t('project.createModal.ratePlaceholder')}
            addonRight={'$'}
            {...inputProps}
          />

          <TextArea
            label={t('dashboard.projectsTable.form.description')}
            id={'description'}
            placeholder={t('project.createModal.descriptionPlaceholder')}
            rows={isMobile ? 7 : 3}
          />
        </Flex>
      </Flex>
    </AdaptiveDialog>
  )
}
