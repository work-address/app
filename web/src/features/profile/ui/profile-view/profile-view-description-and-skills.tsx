import { Badge, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import {
  $isAuthenticatedUserProfile,
  $profile,
  $profileLoading,
} from '../../model'

import { ProfileViewSection } from './profile-view-section'

import { routes } from '@/routes'
import { Button, sanitizeRichText, SectionTitle, Text } from '@/shared'

export const ProfileViewDescriptionAndSkills = () => {
  const { t } = useTranslation()

  const navigate = useNavigate()

  const { user, profileLoading, isOwn } = useUnit({
    user: $profile,
    profileLoading: $profileLoading,
    isOwn: $isAuthenticatedUserProfile,
  })

  const skills = useMemo(
    () =>
      user?.skills
        ?.split(',')
        .map((skill) => skill.trim())
        .filter(Boolean) ?? [],
    [user?.skills],
  )
  // The API cleans a bio as well, but this is the line that puts someone else's
  // text into the page, so it does not take anyone's word for it.
  const bio = useMemo(() => sanitizeRichText(user?.bio ?? ''), [user?.bio])
  const name = user?.name || user?.title
  const hasJobTitle = Boolean(user?.title && user.title !== name)
  const hasDetails = hasJobTitle || Boolean(bio) || skills.length > 0

  if (profileLoading) {
    return (
      <>
        <ProfileViewSection>
          <Skeleton width="80px" height="30px" />
          <Skeleton width="100%" height="48px" />
        </ProfileViewSection>
        <ProfileViewSection>
          <Skeleton width="80px" height="30px" />
          <Skeleton width="240px" height="24px" />
        </ProfileViewSection>
      </>
    )
  }

  return (
    <>
      {bio && (
        <ProfileViewSection>
          <SectionTitle>{t('profile.form.bio')}</SectionTitle>
          <Bio dangerouslySetInnerHTML={{ __html: bio }} />
        </ProfileViewSection>
      )}
      {skills.length > 0 && (
        <ProfileViewSection>
          <SectionTitle>{t('profile.form.skills')}</SectionTitle>
          <Skills>
            {skills.map((skill) => (
              <Badge key={skill} color="gray" size={{ initial: '1', md: '2' }}>
                <Text weight="medium" size="1">
                  {skill}
                </Text>
              </Badge>
            ))}
          </Skills>
        </ProfileViewSection>
      )}
      {!hasDetails && (
        <ProfileViewSection>
          {isOwn ? (
            <EmptyOwn>
              <Text color="gray">{t('profile.view.empty.detailsOwn')}</Text>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    routes.profile.children.edit.build({
                      id: user?.id ?? '',
                    }),
                  )
                }
              >
                {t('profile.view.empty.addDetails')}
              </Button>
            </EmptyOwn>
          ) : (
            <Text color="gray">{t('profile.view.empty.details')}</Text>
          )}
        </ProfileViewSection>
      )}
    </>
  )
}

const Bio = styled.div`
  font-size: var(--font-size-3);
  line-height: var(--line-height-3);
  color: var(--ds-neutral-12);
  overflow-wrap: anywhere;

  p {
    margin: 0;
  }

  /* Doubled: it has to outrank the zero margins set on p, ul and ol here. */
  && > * + * {
    margin-top: var(--space-2);
  }

  /* What the editor's toolbar can produce: the app's reset strips these. */
  a {
    color: var(--ds-accent-11);
    text-decoration: underline;
  }

  ul,
  ol {
    margin-block: 0;
    padding-left: var(--space-5);
  }

  ul {
    list-style: disc;
  }

  ol {
    list-style: decimal;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--font-size-2);
    line-height: var(--line-height-2);
  }
`

const Skills = styled.div`
  display: flex;
  /* Chips of any width, each row as full as it can get: auto-fill would force
     them into equal columns. */
  flex-wrap: wrap;
  gap: var(--space-2);
`

const EmptyOwn = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
  }
`
