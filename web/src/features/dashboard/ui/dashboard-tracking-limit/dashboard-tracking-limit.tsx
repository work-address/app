import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { TrackingWorkersDto } from '@/shared/api/generated'

import {
  Button,
  Checkbox,
  Text,
  baseApi,
  billingUrl,
  runApiData,
  useBreakpoint,
} from '@/shared'

/**
 * Who keeps tracking once an owner's Premium has ended. Appears only then, and
 * only when more workers are listed than the free plan includes: the API falls
 * back to the first listed until a choice is saved, so ignoring this never stops
 * every worker at once.
 */
export const DashboardTrackingLimit = () => {
  const { t, i18n } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const [state, setState] = useState<TrackingWorkersDto | null>(null)
  const [kept, setKept] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const show = (next: TrackingWorkersDto) => {
    setState(next)
    setKept(
      next.workers
        .filter((worker) => worker.tracking)
        .map((worker) => worker.address),
    )
  }

  useEffect(() => {
    let current = true

    runApiData(() => baseApi.userControllerTrackingWorkers())
      .then((next) => {
        if (current) {
          show(next as TrackingWorkersDto)
        }
      })
      // Nothing was asked for, so a failed read has nothing to report.
      .catch(() => {})

    return () => {
      current = false
    }
  }, [])

  if (!state?.limited) {
    return null
  }

  const toggle = (address: string) => {
    setFailed(false)
    setKept((current) =>
      current.includes(address)
        ? current.filter((other) => other !== address)
        : [...current, address],
    )
  }

  const save = async () => {
    setSaving(true)
    setFailed(false)

    try {
      show(
        (await runApiData(() =>
          baseApi.userControllerKeepWorkers({ body: { addresses: kept } }),
        )) as TrackingWorkersDto,
      )
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Root>
      <Text weight={'medium'} size={'2'}>
        {t('dashboard.trackingLimit.title')}
      </Text>
      <Text size={'1'} color={'gray'}>
        {t('dashboard.trackingLimit.description', { limit: state.limit })}
      </Text>
      <Workers>
        {state.workers.map((worker) => {
          const checked = kept.includes(worker.address)

          return (
            <Worker key={worker.address}>
              <Checkbox
                checked={checked}
                disabled={!checked && kept.length >= state.limit}
                onCheckedChange={() => toggle(worker.address)}
              />
              <WorkerName>
                <Text size={'2'}>{worker.name || worker.address}</Text>
                {worker.connected ? null : (
                  <Text size={'1'} color={'gray'}>
                    {t('dashboard.trackingLimit.notSignedIn')}
                  </Text>
                )}
              </WorkerName>
            </Worker>
          )
        })}
      </Workers>
      {failed ? (
        <Text size={'1'} color={'red'} role="alert">
          {t('dashboard.trackingLimit.error')}
        </Text>
      ) : null}
      <Actions>
        <Button
          size={isDesktop ? 'm' : 's'}
          loading={saving}
          onClick={() => void save()}
        >
          {t('dashboard.trackingLimit.save')}
        </Button>
        <a
          href={billingUrl(i18n.language)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size={isDesktop ? 'm' : 's'} variant="soft" color="neutral">
            {t('dashboard.premiumBanner.cta')}
          </Button>
        </a>
      </Actions>
    </Root>
  )
}

const Root = styled.section`
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3) var(--ui-space-4);
  margin-bottom: var(--ui-section-gap);
  border-radius: var(--ui-control-radius);
  border: var(--ui-border-width) solid var(--ui-line);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);
`

const Workers = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-1);
`

const Worker = styled.label`
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  min-width: 0;
`

const WorkerName = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--ui-space-2);
  min-width: 0;
  overflow-wrap: anywhere;
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-1);
`
