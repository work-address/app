#!/usr/bin/env python3
"""
Independent encoder for profile schema v1 (docs/profile-schema-v1.md).

It writes test/fixtures/profile-schema-v1.vectors.json:

    python3 test/fixtures/profile-schema-v1.vectors.py > test/fixtures/profile-schema-v1.vectors.json

This file shares no code with the TypeScript that consumes the vectors. It
uses the Python standard library only, and carries its own Keccak-256, ABI
encoding, RFC 8785 (JCS) serializer, EIP-55 checksum and CREATE address, so a
mistake in the TypeScript cannot confirm itself through the fixture. The
Hardhat test recomputes every output again in Solidity.

The salts and fillers here are derived from labels so the file regenerates
byte for byte. Real salts and fillers are 32 bytes from a CSPRNG, drawn per
slot and per published version; a derived salt is guessable by construction.
"""

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


def build_case(name, key, subject, values, source):
    """One vector: every filled slot's leaf and proof, fillers elsewhere, root and commitment."""
    prefix = 'work-address/profile-schema-v1/vectors/%s' % key
    leaves = []
    fields = []

    for slot in range(LEAF_COUNT):
        if slot in values:
            pointer = BY_SLOT[slot][0]
            value = values[slot]
            value_text = jcs(value)
            salt = label_hash('%s/salt/%d' % (prefix, slot))
            path_hash, value_hash, leaf = leaf_hash(subject, slot, pointer, value_text, salt)
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
        'subject': 'did:pkh:eip155:%d:%s' % (CHAIN_ID, checksum_address(subject)),
        'leafSubject': checksum_address(subject),
        'source': source,
        'fields': fields,
        'fillers': [{'slot': slot, 'leaf': hex0x(leaves[slot])} for slot in range(LEAF_COUNT) if slot not in filled],
        'leaves': [hex0x(leaf) for leaf in leaves],
        'root': hex0x(root),
        'commitment': hex0x(profile_commitment(CHAIN_ID, REGISTRY, subject, root)),
    }


def subject_for(key):
    return label_hash('work-address/profile-schema-v1/vectors/%s/subject' % key)[12:]


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


def main():
    full = build_case(
        'full profile: every schema v1 field from the app public projection',
        'full',
        subject_for('full'),
        values_from_app_user(FULL_USER),
        FULL_USER,
    )
    sparse = build_case(
        'sparse profile: two fields, thirty fillers; a zero rate and empty text are absent',
        'sparse',
        subject_for('sparse'),
        values_from_app_user(SPARSE_USER),
        SPARSE_USER,
    )
    unicode_case = build_case(
        'non-ASCII input in NFD with padding: committed as trimmed NFC, JCS escapes only what it must',
        'unicode',
        subject_for('unicode'),
        values_from_app_user(UNICODE_USER),
        UNICODE_USER,
    )

    assert len(sparse['fields']) == 2
    assert all(len(field['proof']) == DEPTH for case in (full, sparse, unicode_case) for field in case['fields'])

    fixture = {
        'format': (
            'Profile schema v1 test vectors (docs/profile-schema-v1.md), written by '
            'test/fixtures/profile-schema-v1.vectors.py, an independent standard-library Python encoder. '
            'leaf = keccak256(keccak256(abi.encode(leafTypehash, uint32 schemaId, address subject, uint16 slot, '
            'keccak256(utf8(pointer)), keccak256(utf8(valueJcs)), bytes32 salt))); a slot with no field holds a '
            '32-byte filler as its leaf; leaves[i] is slot i; internal nodes are keccak256 of the sorted pair; '
            'root is the top of the 32-leaf tree; commitment = keccak256(abi.encode(commitmentTypehash, chainId, '
            'registry, subject, schemaId, root)). source is the app public User projection each case maps from '
            '(tz is read and dropped). Salts and fillers here are derived from labels so the file regenerates; '
            'real ones are CSPRNG bytes. registry is the first CREATE of registryDeployer on chainId, where the '
            'Hardhat test deploys IdentityRegistry. A change to any output is a new schema id, not an edit.'
        ),
        'schemaId': SCHEMA_ID,
        'leafType': LEAF_TYPE,
        'leafTypehash': hex0x(LEAF_TYPEHASH),
        'commitmentType': COMMITMENT_TYPE,
        'commitmentTypehash': hex0x(COMMITMENT_TYPEHASH),
        'chainId': CHAIN_ID,
        'registryDeployer': hex0x(REGISTRY_DEPLOYER),
        'registry': checksum_address(REGISTRY),
        'slots': [
            {'slot': slot, 'pointer': pointer, 'pathHash': hex0x(keccak256(pointer.encode('utf-8')))}
            for slot, pointer, _, _ in SLOTS
        ],
        'cases': [full, sparse, unicode_case],
    }

    sys.stdout.write(json.dumps(fixture, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
