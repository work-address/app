import moment from 'moment-timezone';

export class DateHelper {
  public static getWeekdayUTC(unix: number): number {
    return moment.unix(unix).utc().weekday();
  }

  public static formatDatePST(date: Date): string {
    return moment(date).tz('America/Los_Angeles').format('LLLL z');
  }

  public static guessFirstDay(givenMonth: number, givenYear: number, tz: string = 'UTC'): number {
    let dayThis = moment().date();
    let monthThis = moment().month() + 1;
    let yearThis = moment().year();
    let day = 1;

    if (tz) {
      dayThis = moment.tz(tz).date();
      monthThis = moment.tz(tz).month() + 1;
      yearThis = moment.tz(tz).year();
    }

    if (monthThis === givenMonth && givenYear === yearThis) {
      day = dayThis;
    }

    return day;
  }

  public static tzDifferenceHours(date: string, tz: string): number {
    return moment.tz(date, tz).utcOffset() / 60;
  }

  public static isDST(date: string, tz: string): boolean {
    return moment(date).tz(tz).isDST();
  }

  public static getDST(date: string, tz: string): string {
    if (tz === 'UTC') {
      return 'summer';
    }

    const isDST = moment(date).tz(tz).isDST();

    return isDST ? 'summer' : 'winter';
  }

  public static calcIntervalByType(
    date: Date,
    duration: moment.unitOfTime.StartOf,
    tz: string = 'UTC'
  ): {
    from: Date;
    to: Date;
  } {
    let from = moment.utc(date).startOf(duration).utc().toDate();
    const now = moment.tz(tz).utc().toDate();

    if (now >= from) {
      from = now;
    }

    return {
      from,
      to: moment.utc(date).endOf(duration).utc().toDate(),
    };
  }

  public static dateDifferenceMinutes(from: Date, to: Date) {
    const toDate = moment.utc(to);
    const fromDate = moment.utc(from);

    return toDate.diff(fromDate, 'minutes');
  }
}
