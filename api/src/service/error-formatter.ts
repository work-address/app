import { ValidationError } from 'class-validator'

export class ErrorFormatter {
  public static format(error: unknown): {
    name: string
    message: string
    errors?: unknown
  } {
    const src = error as Error & {
      errors?: unknown[]
      violations?: ValidationError[]
    }
    const errorFormatted: {
      message: string
      name: string
      errors?: unknown[]
    } = {
      message: src.message || src.name,
      name: src.name || 'Error',
    }

    if (src.errors && src.errors.length > 0) {
      errorFormatted.errors = src.errors
    }

    if (src.violations && src.violations.length > 0) {
      errorFormatted.errors = src.violations.map((e: ValidationError) => {
        return {
          value: e.value,
          property: e.property,
          constraints: e.constraints,
          children: e.children,
        }
      })
    }

    return errorFormatted
  }
}
