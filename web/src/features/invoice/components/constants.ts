type InfoFields = Record<
  string,
  { value: string; desc?: string; name?: string }
>

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
})

const numberFormatter = new Intl.NumberFormat('ru-RU')

export const infoFields: InfoFields = {
  'Issue date': {
    value: dateFormatter.format(new Date()),
  },
  'Time total': { value: '4 hr 10 min', desc: 'Time total description' },
  'Time active': { value: '2 hr 10 min', desc: 'Time active description' },
  Keyboard: {
    value: numberFormatter.format(4983),
    desc: 'Keyboard description',
  },
  Mouse: { value: numberFormatter.format(1834), desc: 'Mouse description' },
  'Mouse Distance': {
    value: numberFormatter.format(2_385_910),
    desc: 'Mouse distance description',
  },
}
