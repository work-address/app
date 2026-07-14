export const SKILLS_SUGGESTIONS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'UI/UX Design',
  'Figma',
  'Graphic Design',
  'Java',
  'Go',
  'Copywriting',
  'Content Writing',
  'SEO',
  'Vue.js',
  'Angular',
  'Social Media Marketing',
  'Email Marketing',
  'Rust',
  'C++',
  'C#',
  'PHP',
  'Ruby',
  'Swift',
  'Kotlin',
  'Video Editing',
  'Motion Graphics',
  'After Effects',
  'Premiere Pro',
  'Next.js',
  'Express.js',
  'NestJS',
  'Django',
  'FastAPI',
  'Spring Boot',
  'Illustration',
  'Brand Identity',
  'Logo Design',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'GraphQL',
  'REST API',
  'Docker',
  'Kubernetes',
  'AWS',
  'Google Cloud',
  'Azure',
  'GitHub',
  'CI/CD',
  'Unit Testing',
  'WebSockets',
  'Solidity',
  'Web3',
  'Smart Contracts',
  'Project Management',
  'Scrum',
  'Agile',
  'Technical Writing',
  'Data Analysis',
  'Machine Learning',
  'Data Visualization',
  'Excel',
  'Power BI',
  'Tableau',
  'Photoshop',
  'Illustrator',
  'Sketch',
  'WordPress',
  'Shopify',
  'Webflow',
  'Mobile Development',
  'iOS',
  'Android',
  'Flutter',
  'React Native',
  'Game Development',
  'Unity',
  'Unreal Engine',
  '3D Modeling',
  'Blender',
  'Voice Over',
  'Transcription',
  'Translation',
  'Legal Writing',
  'Business Analysis',
  'Financial Modeling',
  'Accounting',
  'Blockchain',
  'NFT',
  'Cybersecurity',
  'Penetration Testing',
  'DevOps',
  'Linux',
  'Networking',
]

export const SOCIAL_LINKS = [
  {
    name: 'facebook',
    labelKey: 'profile.links.facebook',
    domain: 'facebook.com',
  },
  {
    name: 'linkedIn',
    labelKey: 'profile.links.linkedin',
    domain: 'linkedin.com',
  },
  {
    name: 'telegram',
    labelKey: 'profile.links.telegram',
    domain: 't.me',
  },
  {
    name: 'twitter',
    labelKey: 'profile.links.twitter',
    domain: 'twitter.com',
  },
  {
    name: 'instagram',
    labelKey: 'profile.links.instagram',
    domain: 'instagram.com',
  },
  {
    name: 'youtube',
    labelKey: 'profile.links.youtube',
    domain: 'youtube.com',
  },
] as const

export type SocialLinkField = (typeof SOCIAL_LINKS)[number]['name']

export const SOCIAL_DOMAIN_BY_FIELD: Record<SocialLinkField, string> =
  Object.fromEntries(
    SOCIAL_LINKS.map(({ name, domain }) => [name, domain]),
  ) as Record<SocialLinkField, string>

export const normalizeLink = (prefix: string, value: string) =>
  value
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(new RegExp(`^${prefix}`), '')
    .replace(/\/$/, '')
    .replace(/^\//, '')

// Проверяем вхождение хоста именно как домена, а не подстроки:
// "x.com" не должен матчиться в "max.com".
export const containsHost = (text: string, host: string) => {
  const escaped = host.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`)
  return new RegExp(`(^|[/@.\\s])${escaped}`, 'i').test(text)
}
