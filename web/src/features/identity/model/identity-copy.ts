import {
  IDENTITY_ACTION_MESSAGE_KEY,
  IDENTITY_VIEW_MESSAGE_KEY,
} from './identity-state'

import type { FieldKey } from '@/shared/vendor/identity'

/**
 * The profile form's own label for each schema v1 field. The slots commit the
 * columns of the profile edit form, so the preview names them exactly as the
 * form does - a second set of labels would eventually disagree with it about
 * what the holder is publishing.
 */
export const IDENTITY_FIELD_LABEL_KEY: Record<FieldKey, string> = {
  name: 'profile.form.name',
  title: 'profile.form.title',
  company: 'profile.form.company',
  bio: 'profile.form.bio',
  rate: 'profile.form.rate',
  skills: 'profile.form.skills',
  city: 'profile.form.city',
  country: 'profile.form.country',
  facebook: 'profile.links.facebook',
  linkedIn: 'profile.links.linkedin',
  twitter: 'profile.links.twitter',
  instagram: 'profile.links.instagram',
  youtube: 'profile.links.youtube',
  telegram: 'profile.links.telegram',
}

/** Every string this feature adds, for the locale completeness test. */
export const IDENTITY_COPY_KEYS = [
  'identity.card.title',
  'identity.card.description',
  'identity.card.custody',
  'identity.permanence.title',
  'identity.permanence.body',
  'identity.permanence.acknowledge',
  'identity.preview.title',
  'identity.preview.committed',
  'identity.preview.empty',
  'identity.preview.unusable',
  'identity.preview.nothing',
  'identity.actions.publish',
  'identity.actions.republish',
  'identity.actions.withdraw',
  'identity.actions.remove',
  'identity.actions.export',
  'identity.export.title',
  'identity.export.hint',
  'identity.history.title',
  'identity.history.empty',
  'identity.history.unavailable',
  'identity.history.published',
  'identity.history.withdrawn',
  'identity.chip.title',
  'identity.withdraw.title',
  'identity.withdraw.description',
  'identity.withdraw.confirm',
  'identity.relay.label',
  'identity.relay.hint',
  ...Object.values(IDENTITY_VIEW_MESSAGE_KEY),
  ...Object.values(IDENTITY_ACTION_MESSAGE_KEY),
] as const
