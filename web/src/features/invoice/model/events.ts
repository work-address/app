import { createEvent } from 'effector'

export const fetchInvoice = createEvent<{ id: string }>()

export const resetInvoice = createEvent()
