export class Calc {
  public static rateTotal(minutes: number, rateHour: number): number {
    return Number(rateHour) * (Number(minutes) / 60);
  }
}
