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
              <Badge key={skill} color="gray" size="2" radius="full">
                <Text weight="medium" size="2">
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

/* The page runs full width; a paragraph that did too would be hard to read. */
const Bio = styled.div`
  max-width: 80ch;
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  color: var(--ui-text);
  overflow-wrap: anywhere;

  p {
    margin: 0;
  }

  /* Doubled: it has to outrank the zero margins set on p, ul and ol here. */
  && > * + * {
    margin-top: var(--ui-space-2);
  }

  /* What the editor's toolbar can produce: the app's reset strips these. */
  a {
    color: var(--ui-blue);
    text-decoration: underline;
  }

  ul,
  ol {
    margin-block: 0;
    padding-left: var(--ui-space-5);
  }

  ul {
    list-style: disc;
  }

  ol {
    list-style: decimal;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--ui-meta-size);
    line-height: var(--ui-meta-line-height);
  }
`

const Skills = styled.div`
  display: flex;
  /* Chips of any width, each row as full as it can get: auto-fill would force
     them into equal columns. */
  flex-wrap: wrap;
  gap: var(--ui-space-2);
`

const EmptyOwn = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
  }
`
