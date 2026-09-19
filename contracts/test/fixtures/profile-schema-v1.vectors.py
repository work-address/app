#!/usr/bin/env python3
"""
Independent encoder for profile schema v1 (docs/profile-schema-v1.md).

It writes test/fixtures/profile-schema-v1.vectors.json:

    python3 test/fixtures/profile-schema-v1.vectors.py > test/fixtures/profile-schema-v1.vectors.json

This file shares no code with the TypeScript that consumes the vectors. It
uses the Python standard library only, and carries its own Keccak-256, ABI
encoding, RFC 8785 (JCS) serializer, EIP-55 checksum, CREATE address,
secp256k1 signing with RFC 6979 nonces (EIP-191) and Ed25519 (RFC 8032), so a
mistake in the TypeScript cannot confirm itself through the fixture. The
Hardhat test recomputes every tree output again in Solidity, and
packages/identity must reproduce every output, documents and signatures
included, byte for byte.

The salts, fillers and signing keys here are derived from labels so the file
regenerates byte for byte. Real salts and fillers are 32 bytes from a CSPRNG,
drawn per slot and per published version; a derived salt is guessable by
construction, and the derived keys hold nothing and sign nothing but these
vectors.
"""

import hashlib
import hmac
import json
import sys
import unicodedata

# --------------------------------------------------------------- Keccak-256

_RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
    0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]

# Rotation offsets r[x][y].
_ROT = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14],
]

_MASK = (1 << 64) - 1


def _rol(value, shift):
    shift %= 64
    return ((value << shift) | (value >> (64 - shift))) & _MASK if shift else value


def _keccak_f(a):
    for round_constant in _RC:
        c = [a[x][0] ^ a[x][1] ^ a[x][2] ^ a[x][3] ^ a[x][4] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rol(c[(x + 1) % 5], 1) for x in range(5)]
        a = [[a[x][y] ^ d[x] for y in range(5)] for x in range(5)]
        b = [[0] * 5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                b[y][(2 * x + 3 * y) % 5] = _rol(a[x][y], _ROT[x][y])
        a = [[b[x][y] ^ ((~b[(x + 1) % 5][y]) & b[(x + 2) % 5][y]) for y in range(5)] for x in range(5)]
        a[0][0] ^= round_constant
    return a


def keccak256(data: bytes) -> bytes:
    """Keccak-256 as Ethereum uses it: the original 0x01 padding, not SHA3-256's 0x06."""
    rate = 136
    padded = bytearray(data)
    padded.append(0x01)
    while len(padded) % rate:
        padded.append(0)
    padded[-1] |= 0x80

    state = [[0] * 5 for _ in range(5)]
    for offset in range(0, len(padded), rate):
        block = padded[offset:offset + rate]
        for i in range(rate // 8):
            state[i % 5][i // 5] ^= int.from_bytes(block[8 * i:8 * i + 8], 'little')
        state = _keccak_f(state)

    return b''.join(state[i % 5][i // 5].to_bytes(8, 'little') for i in range(4))


assert keccak256(b'').hex() == 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
assert keccak256(b'abc').hex() == '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45'

# ------------------------------------------------------------ encodings


def hex0x(data: bytes) -> str:
    return '0x' + data.hex()


def label_hash(label: str) -> bytes:
    return keccak256(label.encode('utf-8'))


def checksum_address(address: bytes) -> str:
    """EIP-55."""
    assert len(address) == 20
    lower = address.hex()
    digest = keccak256(lower.encode('ascii')).hex()
    return '0x' + ''.join(
        ch.upper() if ch.isalpha() and int(digest[i], 16) >= 8 else ch for i, ch in enumerate(lower)
    )


def create_address(deployer: bytes, nonce: int) -> bytes:
    """The address a CREATE from `deployer` at `nonce` lands on; RLP spelled out for nonce 0."""
    assert nonce == 0 and len(deployer) == 20
    return keccak256(bytes([0xD6, 0x94]) + deployer + bytes([0x80]))[12:]


def abi_word_uint(value: int) -> bytes:
    return value.to_bytes(32, 'big')


def abi_word_address(address: bytes) -> bytes:
    return bytes(12) + address


def jcs_string(text: str) -> str:
    """RFC 8785 section 3.2.2.2: ECMAScript JSON.stringify string escaping."""
    short = {'"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t'}
    out = ['"']
    for ch in text:
        code = ord(ch)
        if 0xD800 <= code <= 0xDFFF:
            raise ValueError('a lone surrogate has no canonical form')
        if ch in short:
            out.append(short[ch])
        elif code < 0x20:
            out.append('\\u%04x' % code)
        else:
            out.append(ch)
    out.append('"')
    return ''.join(out)


def jcs(value) -> str:
    """RFC 8785 for null, booleans, safe integers, strings, arrays and objects."""
    if value is None:
        return 'null'
    if value is True:
        return 'true'
    if value is False:
        return 'false'
    if isinstance(value, int):
        if abs(value) > 2 ** 53 - 1:
            raise ValueError('only safe integers are canonical here')
        return str(value)
    if isinstance(value, str):
        return jcs_string(value)
    if isinstance(value, list):
        return '[' + ','.join(jcs(item) for item in value) + ']'
    if isinstance(value, dict):
        # Keys sort by UTF-16 code unit; big-endian UTF-16 bytes compare the same way.
        keys = sorted(value, key=lambda key: key.encode('utf-16-be'))
        return '{' + ','.join(jcs_string(key) + ':' + jcs(value[key]) for key in keys) + '}'
    raise TypeError('no canonical JSON form for %r' % (value,))


# ------------------------------------------- secp256k1, for EIP-191 only

_P = 2 ** 256 - 2 ** 32 - 977
_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
_G = (
    0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
    0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8,
)


def _ec_add(p, q):
    if p is None:
        return q
    if q is None:
        return p
    if p[0] == q[0] and (p[1] + q[1]) % _P == 0:
        return None
    if p == q:
        slope = 3 * p[0] * p[0] * pow(2 * p[1], -1, _P) % _P
    else:
        slope = (q[1] - p[1]) * pow(q[0] - p[0], -1, _P) % _P
    x = (slope * slope - p[0] - q[0]) % _P
    return (x, (slope * (p[0] - x) - p[1]) % _P)


def _ec_mul(k, point):
    result = None
    while k:
        if k & 1:
            result = _ec_add(result, point)
        point = _ec_add(point, point)
        k >>= 1
    return result


def evm_address(private_key: int) -> bytes:
    x, y = _ec_mul(private_key, _G)
    return keccak256(x.to_bytes(32, 'big') + y.to_bytes(32, 'big'))[12:]


def _hmac256(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha256).digest()


def _rfc6979_nonce(private_key: int, digest: bytes) -> int:
    """RFC 6979 section 3.2 with HMAC-SHA256. qlen equals hlen, so bits2octets is one reduction mod n."""
    x = private_key.to_bytes(32, 'big')
    h = (int.from_bytes(digest, 'big') % _N).to_bytes(32, 'big')
    v = bytes([1]) * 32
    k = bytes(32)
    k = _hmac256(k, v + bytes([0]) + x + h)
    v = _hmac256(k, v)
    k = _hmac256(k, v + bytes([1]) + x + h)
    v = _hmac256(k, v)
    while True:
        v = _hmac256(k, v)
        candidate = int.from_bytes(v, 'big')
        if 1 <= candidate < _N:
            return candidate
        k = _hmac256(k, v + bytes([0]))
        v = _hmac256(k, v)


def eip191_sign(private_key: int, message: str) -> bytes:
    """personal_sign: ECDSA over keccak256(0x19 "Ethereum Signed Message:" 0x0a len message), low s, v 27 or 28."""
    data = message.encode('utf-8')
    digest = keccak256(bytes([0x19]) + b'Ethereum Signed Message:' + bytes([0x0A]) + str(len(data)).encode('ascii') + data)
    k = _rfc6979_nonce(private_key, digest)
    point = _ec_mul(k, _G)
    r = point[0] % _N
    s = pow(k, -1, _N) * (int.from_bytes(digest, 'big') + r * private_key) % _N
    recovery = (point[1] & 1) | (2 if point[0] >= _N else 0)
    if s > _N // 2:
        s = _N - s
        recovery ^= 1
    assert r and s and recovery < 2
    return r.to_bytes(32, 'big') + s.to_bytes(32, 'big') + bytes([27 + recovery])


# ------------------------------------------------ Ed25519 (RFC 8032)

_Q = 2 ** 255 - 19
_L = 2 ** 252 + 27742317777372353535851937790883648493
_D = -121665 * pow(121666, -1, _Q) % _Q
_SQRT_M1 = pow(2, (_Q - 1) // 4, _Q)


def _ed_recover_x(y):
    xx = (y * y - 1) * pow(_D * y * y + 1, -1, _Q)
    x = pow(xx, (_Q + 3) // 8, _Q)
    if (x * x - xx) % _Q != 0:
        x = x * _SQRT_M1 % _Q
    if x % 2 != 0:
        x = _Q - x
    return x


_ED_BY = 4 * pow(5, -1, _Q) % _Q
_ED_B = (_ed_recover_x(_ED_BY), _ED_BY)


def _ed_add(p, q):
    x1, y1 = p
    x2, y2 = q
    t = _D * x1 * x2 * y1 * y2
    return (
        (x1 * y2 + x2 * y1) * pow(1 + t, -1, _Q) % _Q,
        (y1 * y2 + x1 * x2) * pow(1 - t, -1, _Q) % _Q,
    )


def _ed_mul(e, point):
    result = (0, 1)
    while e:
        if e & 1:
            result = _ed_add(result, point)
        point = _ed_add(point, point)
        e >>= 1
    return result


def _ed_encode(point) -> bytes:
    x, y = point
    return (y | ((x & 1) << 255)).to_bytes(32, 'little')


def _ed_secret(seed: bytes):
    digest = hashlib.sha512(seed).digest()
    scalar = int.from_bytes(digest[:32], 'little')
    scalar &= (1 << 254) - 8
    scalar |= 1 << 254
    return scalar, digest[32:]


def ed25519_public_key(seed: bytes) -> bytes:
    return _ed_encode(_ed_mul(_ed_secret(seed)[0], _ED_B))


def ed25519_sign(seed: bytes, message: bytes) -> bytes:
    scalar, prefix = _ed_secret(seed)
    public = _ed_encode(_ed_mul(scalar, _ED_B))
    r = int.from_bytes(hashlib.sha512(prefix + message).digest(), 'little') % _L
    encoded_r = _ed_encode(_ed_mul(r, _ED_B))
    k = int.from_bytes(hashlib.sha512(encoded_r + public + message).digest(), 'little') % _L
    return encoded_r + ((r + k * scalar) % _L).to_bytes(32, 'little')


# RFC 8032 section 7.1, test 1.
_RFC8032_SEED = bytes.fromhex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60')
assert ed25519_public_key(_RFC8032_SEED).hex() == 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a'
assert ed25519_sign(_RFC8032_SEED, b'').hex() == (
    'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b'
)

_BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'


def base58(data: bytes) -> str:
    number = int.from_bytes(data, 'big')
    text = ''
    while number:
        number, remainder = divmod(number, 58)
        text = _BASE58[remainder] + text
    return '1' * (len(data) - len(data.lstrip(bytes(1)))) + text


# ------------------------------------------------------------- schema v1

SCHEMA_ID = 1
CHAIN_ID = 31337
LEAF_COUNT = 32
DEPTH = 5

LEAF_TYPE = 'ProfileLeaf(uint32 schemaId,address subject,uint16 slot,bytes32 pathHash,bytes32 valueHash,bytes32 salt)'
COMMITMENT_TYPE = 'ProfileCommitment(uint256 chainId,address registry,address subject,uint32 schemaId,bytes32 merkleRoot)'
LEAF_TYPEHASH = label_hash(LEAF_TYPE)
COMMITMENT_TYPEHASH = label_hash(COMMITMENT_TYPE)

# The key-less address whose first CREATE the Hardhat test uses for the registry.
REGISTRY_DEPLOYER = bytes.fromhex('0000000000000000000000000000000000001de0')
REGISTRY = create_address(REGISTRY_DEPLOYER, 0)

# slot, pointer, kind, max length in code points (for 'strings': per item, and max items)
SLOTS = [
    (0, '/name', 'string', 256),
    (1, '/title', 'string', 256),
    (2, '/company', 'string', 256),
    (3, '/bio', 'string', 16384),
    (4, '/rate', 'rate', None),
    (5, '/skills', 'strings', (64, 128)),
    (6, '/location/city', 'string', 256),
    (7, '/location/country', 'country', 2),
    (8, '/social/facebook', 'string', 256),
    (9, '/social/linkedIn', 'string', 256),
    (10, '/social/twitter', 'string', 256),
    (11, '/social/instagram', 'string', 256),
    (12, '/social/youtube', 'string', 256),
    (13, '/social/telegram', 'string', 256),
]
BY_SLOT = {slot: (pointer, kind, limit) for slot, pointer, kind, limit in SLOTS}

# The app User columns each slot is read from (app/api/src/entity/user.ts).
APP_COLUMNS = {
    0: 'name', 1: 'title', 2: 'company', 3: 'bio', 4: 'rate', 5: 'skills', 6: 'city', 7: 'country',
    8: 'facebook', 9: 'linkedIn', 10: 'twitter', 11: 'instagram', 12: 'youtube', 13: 'telegram',
}

# ECMAScript WhiteSpace and LineTerminator: exactly what String.prototype.trim removes.
_JS_TRIM = {chr(code) for code in (
    0x09, 0x0B, 0x0C, 0x20, 0xA0, 0xFEFF,  # WhiteSpace, outside Zs
    0x0A, 0x0D, 0x2028, 0x2029,  # LineTerminator
    0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
    0x202F, 0x205F, 0x3000,  # the rest of Zs
)}


def js_trim(text: str) -> str:
    start, end = 0, len(text)
    while start < end and text[start] in _JS_TRIM:
        start += 1
    while end > start and text[end - 1] in _JS_TRIM:
        end -= 1
    return text[start:end]


def canonical_text(raw, limit):
    """NFC of the trimmed text, or None when nothing is left."""
    if raw is None:
        return None
    text = unicodedata.normalize('NFC', js_trim(raw))
    if text == '':
        return None
    assert len(text) <= limit, 'over the slot maximum'
    return text


def rate_cents(raw):
    """The app's decimal(6,2) rate as whole cents; 0 or empty means no rate."""
    if raw is None:
        return None
    text = js_trim(str(raw))
    if text == '':
        return None
    whole, _, fraction = text.partition('.')
    assert whole.isdigit() and (fraction == '' or (fraction.isdigit() and len(fraction) <= 2))
    cents = int(whole) * 100 + int((fraction + '00')[:2])
    if cents == 0:
        return None
    assert cents <= 999999
    return cents


def values_from_app_user(user):
    """Schema v1 values, keyed by slot, from the app's public User projection."""
    values = {}
    for slot, (pointer, kind, limit) in BY_SLOT.items():
        raw = user.get(APP_COLUMNS[slot])
        if kind == 'string':
            value = canonical_text(raw, limit)
        elif kind == 'country':
            value = canonical_text(raw, 2)
            assert value is None or (len(value) == 2 and value.isascii() and value.isupper())
        elif kind == 'rate':
            cents = rate_cents(raw)
            value = None if cents is None else {'currency': 'USDT', 'rateHourCents': cents}
        elif kind == 'strings':
            max_items, max_length = limit
            items = [] if raw is None else [canonical_text(part, max_length) for part in raw.split(',')]
            items = [item for item in items if item is not None]
            assert len(items) <= max_items
            value = items or None
        if value is not None:
            values[slot] = value
    return values


def leaf_hash(subject: bytes, slot: int, pointer: str, value_text: str, salt: bytes):
    path_hash = keccak256(pointer.encode('utf-8'))
    value_hash = keccak256(value_text.encode('utf-8'))
    encoded = (
        LEAF_TYPEHASH
        + abi_word_uint(SCHEMA_ID)
        + abi_word_address(subject)
        + abi_word_uint(slot)
        + path_hash
        + value_hash
        + salt
    )
    return path_hash, value_hash, keccak256(keccak256(encoded))


def hash_pair(a: bytes, b: bytes) -> bytes:
    """OpenZeppelin Hashes.commutativeKeccak256: the smaller word first."""
    return keccak256(a + b) if a < b else keccak256(b + a)


def tree_levels(leaves):
    levels = [list(leaves)]
    while len(levels[-1]) > 1:
        level = levels[-1]
        levels.append([hash_pair(level[i], level[i + 1]) for i in range(0, len(level), 2)])
    return levels


def proof_for(levels, index):
    proof = []
    for level in levels[:-1]:
        proof.append(level[index ^ 1])
        index //= 2
    return proof


def profile_commitment(chain_id: int, registry: bytes, subject: bytes, root: bytes) -> bytes:
    return keccak256(
        COMMITMENT_TYPEHASH
        + abi_word_uint(chain_id)
        + abi_word_address(registry)
        + abi_word_address(subject)
        + abi_word_uint(SCHEMA_ID)
        + root
    )


def build_case(name, key, subject_did, leaf_subject, values, source):
    """One vector: every filled slot's leaf and proof, fillers elsewhere, and the root."""
    prefix = 'work-address/profile-schema-v1/vectors/%s' % key
    leaves = []
    fields = []

    for slot in range(LEAF_COUNT):
        if slot in values:
            pointer = BY_SLOT[slot][0]
            value = values[slot]
            value_text = jcs(value)
            salt = label_hash('%s/salt/%d' % (prefix, slot))
            path_hash, value_hash, leaf = leaf_hash(leaf_subject, slot, pointer, value_text, salt)
            fields.append({
                'slot': slot,
                'pointer': pointer,
                'value': value,
                'valueJcs': value_text,
                'salt': hex0x(salt),
                'pathHash': hex0x(path_hash),
                'valueHash': hex0x(value_hash),
                'leaf': hex0x(leaf),
            })
            leaves.append(leaf)
        else:
            leaves.append(label_hash('%s/filler/%d' % (prefix, slot)))

    levels = tree_levels(leaves)
    assert len(levels) == DEPTH + 1
    root = levels[-1][0]

    for field in fields:
        proof = proof_for(levels, field['slot'])
        assert len(proof) == DEPTH
        field['proof'] = [hex0x(node) for node in proof]

    filled = {field['slot'] for field in fields}

    return {
        'name': name,
        'subject': subject_did,
        'leafSubject': checksum_address(leaf_subject),
        'source': source,
        'fields': fields,
        'fillers': [{'slot': slot, 'leaf': hex0x(leaves[slot])} for slot in range(LEAF_COUNT) if slot not in filled],
        'leaves': [hex0x(leaf) for leaf in leaves],
        'root': hex0x(root),
    }


def subject_for(key):
    return label_hash('work-address/profile-schema-v1/vectors/%s/subject' % key)[12:]


def evm_did(chain_id, address):
    return 'did:pkh:eip155:%d:%s' % (chain_id, checksum_address(address))


# ------------------------------------------------------------ documents

CREATED_AT = '2026-09-19T12:00:00.000Z'
PRESENTATION_FORMAT = 'work-address/profile-presentation'
EXPORT_FORMAT = 'work-address/profile-export'
FORMAT_VERSION = 1
SELF_SIGNED_DOMAIN = 'work-address/profile-self-signed/v1'

# CAIP-2 reference of Solana mainnet: the first 32 characters of its genesis hash.
SOLANA_MAINNET = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'


def disclosure(case, slot):
    field = next(field for field in case['fields'] if field['slot'] == slot)
    return {
        'slot': slot,
        'pointer': field['pointer'],
        'value': field['value'],
        'salt': field['salt'],
        'proof': field['proof'],
    }


def presentation_text(case, disclose, anchor, commitment, signature):
    """The presentation document's JCS text: chosen slots only, each with its salt and proof."""
    return jcs({
        'format': PRESENTATION_FORMAT,
        'formatVersion': FORMAT_VERSION,
        'schemaId': SCHEMA_ID,
        'subject': case['subject'],
        'anchor': anchor,
        'root': case['root'],
        'commitment': commitment,
        'signature': signature,
        'createdAt': CREATED_AT,
        'disclosures': [disclosure(case, slot) for slot in sorted(disclose)],
    })


def export_text(case):
    """The private export's JCS text: every value, salt and filler, enough to rebuild the tree."""
    return jcs({
        'format': EXPORT_FORMAT,
        'formatVersion': FORMAT_VERSION,
        'schemaId': SCHEMA_ID,
        'subject': case['subject'],
        'root': case['root'],
        'createdAt': CREATED_AT,
        'fields': [
            {'slot': field['slot'], 'pointer': field['pointer'], 'value': field['value'], 'salt': field['salt']}
            for field in case['fields']
        ],
        'fillers': case['fillers'],
    })


def self_signed_message(subject_did, root_hex):
    """What a wallet signs in self-signed mode: UTF-8, lines joined by LF, no trailing newline."""
    return '\n'.join([
        'Work Address profile, self-signed',
        'domain: ' + SELF_SIGNED_DOMAIN,
        'schemaId: %d' % SCHEMA_ID,
        'subject: ' + subject_did,
        'root: ' + root_hex,
    ])


def anchored_case(name, key, user, disclose):
    subject = subject_for(key)
    case = build_case(name, key, evm_did(CHAIN_ID, subject), subject, values_from_app_user(user), user)
    commitment = hex0x(profile_commitment(CHAIN_ID, REGISTRY, subject, bytes.fromhex(case['root'][2:])))
    anchor = {'chainId': CHAIN_ID, 'registry': checksum_address(REGISTRY), 'version': 1}

    case['commitment'] = commitment
    case['presentation'] = {
        'disclose': sorted(disclose),
        'text': presentation_text(case, disclose, anchor, commitment, None),
    }
    case['export'] = {'text': export_text(case)}
    return case


# ----------------------------------------------------------------- cases

FULL_USER = {
    'name': 'Ada Lovelace',
    'title': 'Smart contract engineer',
    'company': 'Analytical Engines Ltd',
    'bio': '<p>Ten years of <b>Solidity</b> &amp; TypeScript. Audits, escrow and "boring" payments.</p>',
    'rate': '85.50',
    'skills': 'Solidity, TypeScript, Rust, Formal verification',
    'city': 'London',
    'country': 'GB',
    'tz': 'Europe/London',
    'facebook': 'ada.lovelace',
    'linkedIn': 'ada-lovelace',
    'twitter': 'ada_codes',
    'instagram': 'ada.engines',
    'youtube': '@adalovelace',
    'telegram': 'ada_l',
}

SPARSE_USER = {
    'name': 'Grace',
    'title': None,
    'company': '',
    'bio': None,
    'rate': '0.00',
    'skills': ' , ',
    'city': None,
    'country': 'US',
    'tz': 'America/New_York',
    'facebook': None,
    'linkedIn': '',
    'twitter': None,
    'instagram': None,
    'youtube': None,
    'telegram': None,
}

# Decomposed (NFD) input with padding to trim; the committed values are NFC.
UNICODE_USER = {
    'name': unicodedata.normalize('NFD', '  José Müller-Ångström \N{NO-BREAK SPACE}'),
    'title': unicodedata.normalize('NFD', 'Désignér · 設計者'),
    'company': 'Ōkami 株式会社',
    'bio': unicodedata.normalize('NFD', 'Line one\nLine "two"\tand a backslash \\ \x01 plus \N{LINE SEPARATOR} and 👩\N{ZERO WIDTH JOINER}💻 — café'),
    'rate': '120.5',
    'skills': unicodedata.normalize('NFD', 'Rust, , 日本語 ,Ñandú , Rust'),
    'city': unicodedata.normalize('NFD', 'São Paulo'),
    'country': 'BR',
    'tz': 'America/Sao_Paulo',
    'facebook': None,
    'linkedIn': None,
    'twitter': None,
    'instagram': None,
    'youtube': None,
    'telegram': 'jose_müller',
}

EVM_SELF_SIGNED_USER = {
    'name': 'Linus',
    'title': 'Kernel maintainer',
    'company': None,
    'bio': None,
    'rate': '150',
    'skills': 'C, Git',
    'city': 'Portland',
    'country': 'US',
    'tz': 'America/Los_Angeles',
    'facebook': None,
    'linkedIn': None,
    'twitter': None,
    'instagram': None,
    'youtube': None,
    'telegram': None,
}

SOLANA_SELF_SIGNED_USER = {
    'name': 'Anatoly',
    'title': 'Validator operator',
    'company': 'Proof of History Co',
    'bio': None,
    'rate': None,
    'skills': 'Rust, Anchor',
    'city': None,
    'country': 'PT',
    'tz': 'Europe/Lisbon',
    'facebook': None,
    'linkedIn': None,
    'twitter': 'anatoly_sol',
    'instagram': None,
    'youtube': None,
    'telegram': None,
}


def self_signed_evm_case():
    """An EVM wallet that has not anchored: EIP-191 over the root. The DID names mainnet; the leaf binds the address."""
    key = 'self-signed-evm'
    private_key = int.from_bytes(label_hash('work-address/profile-schema-v1/vectors/%s/test-key' % key), 'big') % _N
    address = evm_address(private_key)
    case = build_case(
        'self-signed EVM subject: no anchor, an EIP-191 signature over schema, subject and root',
        key,
        evm_did(1, address),
        address,
        values_from_app_user(EVM_SELF_SIGNED_USER),
        EVM_SELF_SIGNED_USER,
    )
    message = self_signed_message(case['subject'], case['root'])
    signature = {'scheme': 'eip191', 'value': hex0x(eip191_sign(private_key, message))}

    case['selfSigned'] = {'signer': checksum_address(address), 'message': message, 'signature': signature}
    case['presentation'] = {'disclose': [0, 7], 'text': presentation_text(case, [0, 7], None, None, signature)}
    case['export'] = {'text': export_text(case)}
    return case


def self_signed_solana_case():
    """A Solana wallet: it cannot anchor, so it signs with Ed25519, and the leaf binds a hash of its DID."""
    key = 'self-signed-solana'
    seed = label_hash('work-address/profile-schema-v1/vectors/%s/test-seed' % key)
    public_key = ed25519_public_key(seed)
    did = 'did:pkh:solana:%s:%s' % (SOLANA_MAINNET, base58(public_key))
    leaf_subject = keccak256(did.encode('utf-8'))[12:]
    case = build_case(
        'self-signed Solana subject: Ed25519 over the same message; the leaf subject is keccak256(did) low 20 bytes',
        key,
        did,
        leaf_subject,
        values_from_app_user(SOLANA_SELF_SIGNED_USER),
        SOLANA_SELF_SIGNED_USER,
    )
    message = self_signed_message(case['subject'], case['root'])
    signature = {'scheme': 'ed25519', 'value': hex0x(ed25519_sign(seed, message.encode('utf-8')))}

    case['selfSigned'] = {'signer': base58(public_key), 'message': message, 'signature': signature}
    case['presentation'] = {'disclose': [0, 1], 'text': presentation_text(case, [0, 1], None, None, signature)}
    case['export'] = {'text': export_text(case)}
    return case


def main():
    full = anchored_case(
        'full profile: every schema v1 field from the app public projection',
        'full',
        FULL_USER,
        [0, 1, 4, 5, 9],
    )
    sparse = anchored_case(
        'sparse profile: two fields, thirty fillers; a zero rate and empty text are absent',
        'sparse',
        SPARSE_USER,
        [0],
    )
    unicode_case = anchored_case(
        'non-ASCII input in NFD with padding: committed as trimmed NFC, JCS escapes only what it must',
        'unicode',
        UNICODE_USER,
        [0, 3, 5, 6],
    )
    self_signed = [self_signed_evm_case(), self_signed_solana_case()]

    assert len(sparse['fields']) == 2
    assert all(
        len(field['proof']) == DEPTH
        for case in [full, sparse, unicode_case] + self_signed
        for field in case['fields']
    )

    fixture = {
        'format': (
            'Profile schema v1 test vectors (docs/profile-schema-v1.md), written by '
            'test/fixtures/profile-schema-v1.vectors.py, an independent standard-library Python encoder. '
            'leaf = keccak256(keccak256(abi.encode(leafTypehash, uint32 schemaId, address leafSubject, uint16 slot, '
            'keccak256(utf8(pointer)), keccak256(utf8(valueJcs)), bytes32 salt))); a slot with no field holds a '
            '32-byte filler as its leaf; leaves[i] is slot i; internal nodes are keccak256 of the sorted pair; '
            'root is the top of the 32-leaf tree; commitment = keccak256(abi.encode(commitmentTypehash, chainId, '
            'registry, leafSubject, schemaId, root)). source is the app public User projection each case maps from '
            '(tz is read and dropped). presentation.text and export.text are the RFC 8785 texts of the two '
            'documents, created at ' + CREATED_AT + '. cases are anchored to registry, the first CREATE of '
            'registryDeployer on chainId, where the Hardhat test deploys IdentityRegistry; selfSignedCases have '
            'no anchor and sign selfSigned.message (EIP-191, or Ed25519 over its UTF-8) with a test key derived '
            'from a label. Salts and fillers are derived from labels so the file regenerates; real ones are '
            'CSPRNG bytes. A change to any output is a new schema id, not an edit.'
        ),
        'schemaId': SCHEMA_ID,
        'leafType': LEAF_TYPE,
        'leafTypehash': hex0x(LEAF_TYPEHASH),
        'commitmentType': COMMITMENT_TYPE,
        'commitmentTypehash': hex0x(COMMITMENT_TYPEHASH),
        'chainId': CHAIN_ID,
        'registryDeployer': hex0x(REGISTRY_DEPLOYER),
        'registry': checksum_address(REGISTRY),
        'presentationFormat': PRESENTATION_FORMAT,
        'exportFormat': EXPORT_FORMAT,
        'selfSignedDomain': SELF_SIGNED_DOMAIN,
        'slots': [
            {'slot': slot, 'pointer': pointer, 'pathHash': hex0x(keccak256(pointer.encode('utf-8')))}
            for slot, pointer, _, _ in SLOTS
        ],
        'cases': [full, sparse, unicode_case],
        'selfSignedCases': self_signed,
    }

    sys.stdout.write(json.dumps(fixture, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
