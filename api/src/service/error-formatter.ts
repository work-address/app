import { ValidationError } from 'class-validator'

import ProjectUnavailableException from '@/exception/project-unavailable-exception'
import RetentionExceededException from '@/exception/retention-exceeded-exception'

/** All a client learns of an error nobody meant it to read. */
const UNEXPECTED = {
  name: 'InternalServerError',
  message: 'Something went wrong on the server',
}

export class ErrorFormatter {
  /**
   * Whether an error was raised for whoever made the request to read. Anything
   * else, such as a database or driver failure, can carry SQL, column names or
   * values in its message, so its text stays on the server.
   */
  public static expected(error: unknown): boolean {
    const { httpCode, status } = error as {
      httpCode?: unknown
      status?: unknown
    }

    return (
      typeof httpCode === 'number' ||
      // What the body parsers raise for a request they refuse.
      (typeof status === 'number' && status >= 400 && status < 500) ||
      // Refusals of one uploaded entry, reported in its row of a 200.
      error instanceof ProjectUnavailableException ||
      error instanceof RetentionExceededException
    )
  }

  public static format(error: unknown): {
    name: string
    message: string
    errors?: unknown
  } {
    if (!ErrorFormatter.expected(error)) {
      return { ...UNEXPECTED }
    }

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

  /**
   * An unexpected error as the logs may hold it. Never its query or parameters,
   * and on a recording route not its message or stack either: a database message
   * can quote the value it rejected, and logs leave for a third party.
   */
  public static forLog(error: unknown, sensitive: boolean): object {
    const { name, code, message, stack } = error as Error & { code?: unknown }

    return sensitive ? { name, code } : { name, code, message, stack }
  }
}
