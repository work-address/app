class RejectedExecutionException extends Error {
  public static NAME = 'RejectedExecutionException';

  constructor(message: string) {
    super();

    Object.setPrototypeOf(this, RejectedExecutionException.prototype);
    this.name = RejectedExecutionException.NAME;
    this.message = message;
  }
}

export default RejectedExecutionException;
