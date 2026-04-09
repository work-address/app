import { Flex, Grid } from '@radix-ui/themes'

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
  const { isMobile } = useBreakpoints()

  const inputProps: InputProps = {
    rows: 'auto 1fr',
    columns: '1fr',
    gap: '2',
  }

  return (
    <AdaptiveDialog
      desktopPadding={'var(--space-5)'}
      desktopWidth={'450px'}
      onOpenChange={onOpenChange}
      open={open}
      title={<>Start a New Project</>}
      description={
        isMobile ? (
          <Grid gap={'3'} columns={'1fr 1fr'}>
            <Button
              themeVariant={'secondary'}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button themeVariant={'primary'}>Create project</Button>
          </Grid>
        ) : (
          <Flex gap={'3'} justify={'end'}>
            <Button
              themeVariant={'secondary'}
              size={'3'}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button themeVariant={'primary'} size={'3'}>
              Create project
            </Button>
          </Flex>
        )
      }
    >
      <Flex gap={'5'} direction={'column'}>
        <Text color={isMobile ? 'gray' : undefined} size={isMobile ? '2' : '3'}>
          You&#39;re creating a personal project to track your time and
          progress. This project is private meaning freelancers won&#39;t see
          it, and you won&#39;t be able to assign it to anyone
        </Text>

        <Flex gap={'4'} direction={'column'}>
          <Input
            label={'Project name'}
            id={'projectName'}
            placeholder={'E.g., "Website Redesign" or "Marketing Strategy"'}
            {...inputProps}
          />

          <Input
            label={'Rate'}
            id={'rate'}
            placeholder={'Enter your hourly rate'}
            addonRight={'$'}
            {...inputProps}
          />

          <TextArea
            label={'Description'}
            id={'description'}
            placeholder={'Briefly describe your project goals and tasks'}
            rows={7}
          />
        </Flex>
      </Flex>
    </AdaptiveDialog>
  )
}
