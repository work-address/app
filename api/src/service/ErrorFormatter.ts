import {ValidationError} from 'class-validator';

export class ErrorFormatter {
  public static format(error: any): {
    name: string;
    message: string;
    errors?: any;
  } {
    const errorFormatted: {
      message: string;
      name: string;
      errors?: any[];
    } = {
      message: error.message || error.name,
      name: error.name || 'Error',
    };

    if (error.errors && error.errors.length > 0) {
      errorFormatted.errors = error.errors;
    }

    if (error.violations && error.violations.length > 0) {
      errorFormatted.errors = error.violations.map((e: ValidationError) => {
        return {
          value: e.value,
          property: e.property,
          constraints: e.constraints,
          children: e.children,
        };
      });
    }

    return errorFormatted;
  }
}
