import {
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

/**
 * Highest unix second a milestone period may name. Past it `new Date` loses
 * precision, and no milestone is delivered in the year 275760.
 */
const MAX_UNIX_SECONDS = 8640000000000

/**
 * The largest sum `Invoice.amountCents` can hold: it is a Postgres `integer`,
 * so anything past 2^31 - 1 would be refused by the insert as a 500 rather
 * than by this DTO as the 400 it is.
 */
const MAX_AMOUNT_CENTS = 2147483647

/**
 * A milestone both sides agreed was delivered: bill it as a FIXED invoice on
 * the project the contract opened.
 *
 * No hours are named, because there are none - a fixed-price milestone is an
 * agreed sum for a named piece of work, and `Time` is the only record of work
 * (SPEC.md), so nothing here may invent entries to stand behind the amount.
 *
 * Every field is required and typed, because the controller verifies the HMAC
 * over its own re-serialisation of the parsed DTO: a field the DTO drops is a
 * field the signature no longer covers. The wire format is pinned to
 * test/fixture/marketplace-milestone-invoice.contract.json, which the
 * marketplace holds a byte-identical copy of and asserts it produces.
 */
export class MarketplaceMilestoneInvoiceDto {
  /** The marketplace contract, the same id the hire opened the project under. */
  @IsUUID()
  contractId: string

  /**
   * The marketplace's id for this milestone, and the idempotency key: the
   * same reference pushed again answers with the invoice the first push
   * raised rather than billing the sum twice.
   */
  @IsUUID()
  milestoneRef: string

  /** Who bills it: the hired freelancer, by this instance's `User.id`. */
  @IsUUID()
  freelancerId: string

  /**
   * The agreed sum in whole cents. Cents, never dollars, and an integer -
   * `Invoice.amountCents` is the money record and a float cannot hold every
   * cent exactly.
   */
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_CENTS)
  amountCents: number

  /**
   * What the milestone is, in the words the parties agreed. A fixed invoice
   * has no lines, so this is the whole of what it says it is billing for and
   * an empty one is refused.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string

  /** When the milestone's work began, in unix seconds. */
  @IsInt()
  @Min(0)
  @Max(MAX_UNIX_SECONDS)
  workStart: number

  /** When it ended. The invoice's period is exactly this span. */
  @IsInt()
  @Min(1)
  @Max(MAX_UNIX_SECONDS)
  workEnd: number

  /** Unix seconds. Outside the replay window the call is refused. */
  @IsInt()
  issuedAt: number

  @IsString()
  nonce: string
}
