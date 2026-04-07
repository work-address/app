import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons'
import { Flex, Separator } from '@radix-ui/themes'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useMemo, useState } from 'react'
import styled from 'styled-components'

import { Card } from '../card'
import { Checkbox } from '../checkbox.tsx'
import { IconButton } from '../icon-button.tsx'

import { MobileBodyComponent } from './mobile-body-component'
import { MobileHeaderComponent } from './mobile-header-component'
import { useSelection } from './use-selection.ts'

import type { MobileBodyRenderProps } from './mobile-body-component'
import type { MobileHeaderRenderProps } from './mobile-header-component'
import type {
  DataProps,
  MobileDataTableConfig,
  AnyRecord,
  MobileAddonBottomProps,
} from './types.ts'

export type MobileDataTableProps<T extends AnyRecord> = {
  config: MobileDataTableConfig<T>
  HeaderComponent?: (props: MobileHeaderRenderProps<T>) => ReactNode
  BodyComponent?: (props: MobileBodyRenderProps<T>) => ReactNode
  AddonBottomComponent?: (props: MobileAddonBottomProps<T>) => ReactNode
  initialExpandedId?: string
} & DataProps<T>

export const MobileDataTable = <T extends AnyRecord>(
  props: MobileDataTableProps<T>,
) => {
  const {
    data,
    HeaderComponent = MobileHeaderComponent,
    BodyComponent = MobileBodyComponent,
    AddonBottomComponent,
    getRowId,
    config,
    initialExpandedId,
    allowSelection,
  } = props

  const selectedIds = 'selectedIds' in props ? props.selectedIds : undefined
  const onSelectedIdsChange =
    'onSelectedIdsChange' in props ? props.onSelectedIdsChange : undefined

  const { handleSelectedChange } = useSelection({
    data,
    selectedIds,
    onSelectedIdsChange,
    getRowId,
  })

  const [expanded, setExpanded] = useState(() =>
    data.reduce(
      (acc, row) => {
        const id = getRowId(row)
        acc[id] = id.toString() === initialExpandedId?.toString()
        return acc
      },
      {} as Record<string, boolean>,
    ),
  )

  const headerConfig = useMemo(
    () => config.find((configItem) => configItem.isTitle),
    [config],
  )

  const configWithoutHeader = useMemo(
    () => config.filter((configItem) => !configItem.isTitle),
    [config],
  )

  if (!headerConfig) {
    throw new Error(
      'You should set "isTitle" prop at least to one item in config.',
    )
  }

  return (
    <CardWrapper shadow={false}>
      {data.map((row) => {
        const rowId = getRowId(row)

        return (
          <CardContent key={rowId}>
            <Flex gap={'3'}>
              {allowSelection && (
                <CheckboxWrapper>
                  <Checkbox
                    checked={selectedIds?.[rowId] ?? false}
                    onCheckedChange={() =>
                      handleSelectedChange(rowId.toString())
                    }
                  />
                </CheckboxWrapper>
              )}

              <Header
                onClick={() =>
                  setExpanded((expanded) => ({
                    ...expanded,
                    [rowId]: !expanded[rowId],
                  }))
                }
              >
                <Flex justify={'between'} align={'center'}>
                  <HeaderComponent
                    data={row}
                    dataKey={
                      'dataKey' in headerConfig
                        ? headerConfig.dataKey
                        : headerConfig.customKey
                    }
                    DefaultHeaderCellComponent={MobileHeaderComponent}
                  />

                  <Flex alignSelf={'end'}>
                    <IconButton
                      variant={'ghost'}
                      size={'2'}
                      radius={'full'}
                      color={'gray'}
                    >
                      {expanded[rowId] ? (
                        <ChevronUpIcon width={20} height={20} />
                      ) : (
                        <ChevronDownIcon width={20} height={20} />
                      )}
                    </IconButton>
                  </Flex>
                </Flex>
              </Header>
            </Flex>

            <AnimatePresence initial={false}>
              {expanded[rowId] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <Separator size={'4'} />

                  <FlexFields direction={'column'} gap={'3'}>
                    {configWithoutHeader.map((configItem) => (
                      <div
                        key={`${getRowId(row)}-${'dataKey' in configItem ? String(configItem.dataKey) : configItem.customKey}`}
                      >
                        <BodyComponent
                          description={configItem.description}
                          data={row}
                          DefaultBodyComponent={MobileBodyComponent}
                          columnConfig={configItem}
                          dataKey={
                            'dataKey' in configItem
                              ? configItem.dataKey
                              : undefined
                          }
                          customKey={
                            'customKey' in configItem
                              ? configItem.customKey
                              : undefined
                          }
                        />
                      </div>
                    ))}
                  </FlexFields>

                  {AddonBottomComponent && (
                    <AddonWrapper>
                      <AddonBottomComponent data={row} />
                    </AddonWrapper>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        )
      })}
    </CardWrapper>
  )
}

const CardContent = styled.div``

const CardWrapper = styled(Card)`
  padding: 8px 12px;

  ${CardContent}:not(:last-child) {
    border-bottom: 1px solid var(--ds-neutral-alpha-6);
  }
`

const Header = styled.div`
  margin: 8px 0;
  cursor: pointer;
  width: 100%;
`

const FlexFields = styled(Flex)`
  padding: 16px 16px 16px 28px;
`

const AddonWrapper = styled.div`
  margin-bottom: var(--space-4);
`

const CheckboxWrapper = styled.div`
  margin-top: var(--space-3);
`

export {
  type MobileDataTableConfig,
  type MobileAddonBottomProps,
} from './types.ts'

export { type MobileBodyRenderProps } from './mobile-body-component'
export { type MobileHeaderRenderProps } from './mobile-header-component.tsx'
