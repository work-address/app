export class Helper {
  public static toFixedDecimals(value: number, numberDecimals: number) {
    const isValueLessZero = value < 0;

    if (isValueLessZero) {
      value = Math.abs(value);
    }

    const e = Math.floor(Number(`${value}e+${numberDecimals}`));
    let result = Number(`${e}e-${numberDecimals}`);

    if (isValueLessZero) {
      result = -result;
    }

    return result;
  }
}
