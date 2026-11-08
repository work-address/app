import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LuAlignLeft } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import {
  $isAuthenticatedUserProfile,
  $profile,
  $profileLoading,
} from '../../model'

import {
  ProfileViewSection,
  ProfileViewSectionHead,
} from './profile-view-section'

import { routes } from '@/routes'
import { Button, sanitizeRichText } from '@/shared'

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
      <ProfileViewSection>
        <Skeleton width="120px" height="30px" />
        <Skeleton width="100%" height="48px" />
        <Skeleton width="240px" height="32px" />
      </ProfileViewSection>
    )
  }

  const hasAbout = Boolean(bio) || skills.length > 0

  // A title alone is already said on the identity sheet.
  if (!hasAbout && hasDetails) {
    return null
  }

  // Bio and skills share one panel, parted by a rule, as one introduction.
  return (
    <ProfileViewSection>
      <ProfileViewSectionHead
        title={t('profile.view.about')}
        icon={<LuAlignLeft aria-hidden />}
      />
      {hasAbout ? (
        <>
          {bio && <Bio dangerouslySetInnerHTML={{ __html: bio }} />}
          {skills.length > 0 && (
            <SkillsGroup data-ruled={bio ? true : undefined}>
              <SkillsTitle>{t('profile.view.skills')}</SkillsTitle>
              <Skills>
                {skills.map((skill) => (
                  <Skill key={skill}>{skill}</Skill>
                ))}
              </Skills>
            </SkillsGroup>
          )}
        </>
      ) : isOwn ? (
        <EmptyOwn>
          <Muted>{t('profile.view.empty.detailsOwn')}</Muted>
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
        <Muted>{t('profile.view.empty.details')}</Muted>
      )}
    </ProfileViewSection>
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
`

const SkillsGroup = styled.div`
  display: grid;
  gap: var(--ui-space-3);

  &[data-ruled] {
    padding-top: var(--ui-section-gap);
    border-top: var(--ui-border-width) solid var(--ui-line);
  }
`

const SkillsTitle = styled.h3`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
`

const Skill = styled.span`
  padding: 6px var(--ui-space-3);
  border-radius: var(--ui-control-radius);
  background: var(--ui-inset);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

const Muted = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
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
