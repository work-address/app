/**
 * Client address handling for the time-tracker pairing nonce.
 *
 * A nonce is pinned to the address that created it, so a later step arriving
 * from somewhere else is refused. The pin has to tolerate the ways one client
 * legitimately changes address between two requests, or it locks out the very
 * users it is meant to protect:
 *
 *   - A dual-stack client races IPv4 and IPv6 (Happy Eyeballs) and does not
 *     reliably leave on the same family twice; the first call after a page
 *     load often goes out over IPv6 and the next over IPv4.
 *   - IPv6 privacy extensions (RFC 4941) rotate the interface identifier, so
 *     the same host reappears under a different address inside its own /64.
 *
 * Neither is correlatable from the address alone, so both are accepted. The
 * nonce itself stays the secret that gates the exchange; this is one weak
 * check on top of it, and it is not worth failing real sign-ins over.
 */
export class ClientIp {
  /** Hextets of an IPv6 address that name the network rather than the host. */
  private static readonly PREFIX_GROUPS = 4

  /**
   * Node reports IPv4 peers on a dual-stack socket as IPv4-mapped IPv6
   * addresses (e.g. "::ffff:172.19.0.1"). Strip that prefix so stored and
   * compared addresses use a consistent IPv4 form.
   */
  public static normalize(ip: string): string {
    return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip
  }

  /**
   * Whether two addresses are plausibly the same client: the same address, a
   * switch between address families, or two IPv6 addresses sharing a /64.
   */
  public static sameClient(stored: string, current: string): boolean {
    if (stored === current) {
      return true
    }

    const storedIsV6 = ClientIp.isIpv6(stored)

    if (storedIsV6 !== ClientIp.isIpv6(current)) {
      // One leg went out over IPv4 and the other over IPv6. Nothing in either
      // address ties it to the other, so the pin cannot speak to this case.
      return true
    }

    if (!storedIsV6) {
      return false
    }

    const storedPrefix = ClientIp.prefix(stored)

    return storedPrefix !== null && storedPrefix === ClientIp.prefix(current)
  }

  private static isIpv6(ip: string): boolean {
    return ip.includes(':')
  }

  /** The /64 of an IPv6 address, or `null` when it does not parse as one. */
  private static prefix(ip: string): string | null {
    const groups = ClientIp.explode(ip)

    if (!groups) {
      return null
    }

    return groups.slice(0, ClientIp.PREFIX_GROUPS).join(':')
  }

  /**
   * The eight hextets of an IPv6 address, with `::` filled back in and any
   * leading zeroes dropped, so two spellings of one address compare equal.
   */
  private static explode(ip: string): string[] | null {
    // A zone index ("%eth0") names a local interface, not part of the address.
    let text = ip.split('%')[0].toLowerCase()
    const embedded = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)

    if (embedded) {
      // A trailing dotted quad ("::ffff:10.0.0.1") occupies the last two
      // hextets; fold it in so the group count comes out right.
      const octets = embedded[1].split('.').map(Number)

      if (octets.some((octet) => octet > 255)) {
        return null
      }

      const high = ((octets[0] << 8) | octets[1]).toString(16)
      const low = ((octets[2] << 8) | octets[3]).toString(16)

      text = `${text.slice(0, embedded.index)}${high}:${low}`
    }

    const halves = text.split('::')

    if (halves.length > 2) {
      return null
    }

    const head = halves[0] === '' ? [] : halves[0].split(':')
    const tail =
      halves.length === 1 || halves[1] === '' ? [] : halves[1].split(':')
    const filled = halves.length === 1 ? 0 : 8 - head.length - tail.length

    if (filled < 0 || (halves.length === 1 && head.length !== 8)) {
      return null
    }

    const groups = [...head, ...new Array<string>(filled).fill('0'), ...tail]

    if (
      groups.length !== 8 ||
      !groups.every((group) => /^[\da-f]{1,4}$/.test(group))
    ) {
      return null
    }

    return groups.map((group) => group.replace(/^0+(?=.)/, ''))
  }
}
