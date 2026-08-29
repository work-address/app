import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { ClientIp } from '@/service/auth/client-ip'

@suite()
export class ClientIpTest {
  @test()
  normalizeUnwrapsIpv4MappedAddresses() {
    expect(ClientIp.normalize('::ffff:172.19.0.1')).to.be.equal('172.19.0.1')
    expect(ClientIp.normalize('10.0.0.1')).to.be.equal('10.0.0.1')
    expect(ClientIp.normalize('2a0c:5d00:3002::1')).to.be.equal(
      '2a0c:5d00:3002::1',
    )
  }

  @test()
  sameClientAcceptsTheSameAddress() {
    expect(ClientIp.sameClient('91.186.222.245', '91.186.222.245')).to.be.true
    expect(ClientIp.sameClient('2a0c:5d00:3002::1', '2a0c:5d00:3002::1')).to.be
      .true
    expect(ClientIp.sameClient('', '')).to.be.true
  }

  @test()
  sameClientRejectsAnEntirelyDifferentIpv4Address() {
    expect(ClientIp.sameClient('91.186.222.245', '203.0.113.7')).to.be.false
  }

  /** The dual-stack race that was locking users out of pairing. */
  @test()
  sameClientAcceptsASwitchBetweenAddressFamilies() {
    expect(ClientIp.sameClient('2a0c:5d00:3002::1:ddaa:57f5', '91.186.222.245'))
      .to.be.true
    expect(ClientIp.sameClient('91.186.222.245', '2a0c:5d00:3002::1:ddaa:57f5'))
      .to.be.true
  }

  /** Privacy extensions rotate the host half, leaving the /64 intact. */
  @test()
  sameClientAcceptsAnotherAddressInTheSameIpv6Prefix() {
    expect(
      ClientIp.sameClient(
        '2a0c:5d00:3002::1:ddaa:57f5',
        '2a0c:5d00:3002:0:aaaa:bbbb:cccc:dddd',
      ),
    ).to.be.true
  }

  @test()
  sameClientRejectsAnIpv6AddressFromAnotherPrefix() {
    expect(ClientIp.sameClient('2a0c:5d00:3002::1', '2a0c:5d00:9999::1')).to.be
      .false
  }

  @test()
  sameClientReadsCompressedAndPaddedSpellingsAlike() {
    expect(ClientIp.sameClient('2001:db8:0:0:0:0:0:1', '2001:db8::2')).to.be
      .true
    expect(ClientIp.sameClient('2001:0db8:0000:0000::1', '2001:db8::2')).to.be
      .true
    expect(ClientIp.sameClient('2a0c:5d00:3002::1%eth0', '2a0c:5d00:3002::2'))
      .to.be.true
  }

  @test()
  sameClientFoldsInATrailingDottedQuad() {
    // ::ffff:10.0.0.1 and ::ffff:a00:1 are two spellings of one address, and
    // both sit in the same /64 as any other ::ffff: address.
    expect(ClientIp.sameClient('::ffff:10.0.0.1', '::ffff:a00:1')).to.be.true
  }

  @test()
  sameClientRejectsAddressesItCannotRead() {
    expect(ClientIp.sameClient('zzzz::1', 'yyyy::1')).to.be.false
    expect(ClientIp.sameClient('2001:db8::1::2', '2001:db8::3')).to.be.false
  }
}
