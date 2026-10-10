#!/usr/bin/env python3
"""Read-only frozen source gate; optional deterministic runtime ZIP reproduction."""
import argparse
import hashlib
import json
import pathlib
import re
import struct
import sys
import zipfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
RUNTIME_MANIFEST_SHA = '4d4601b1303bffa695fd2a72ff89c54b406b76601cd1b38d8560c32d0d2cb024'
BASELINE_MANIFEST_SHA = '369d9ad608bd8674740946287848ee0428ab3d28805c1553202005c293b5ae1f'
RUNTIME_ZIP_SHA = '4c5d9a6be87aa9433b11e00c08e79a27f3d38e7d05b627d007e025a1b6fb2734'
IDENTITY_PROJECTION_SHA = '8f464693b2621726f7cd7fce59fe869367ccd1e7e428d5e0ae7e572dd0833ad9'
PNG = 'public/assets/canopy-wet-stock-rgba8.png'
PNG_SHA = '0a24cc230df5a22bfd5cf0ff36c4c0ff39eadf688539dee8f384ca2760f5e5fa'
PATTERNS = {
    'privatePath': re.compile(r'/(?:workspace|home|Users|root|opt/codex|tmp)/'),
    'privateChat': re.compile(r'codex:\x2f\x2fthreads\x2f|chatgpt\.com/c/|thread_[A-Za-z0-9]+|Sentinel_[A-Za-z0-9]+|msg_[A-Za-z0-9]{12,}|session_[A-Za-z0-9]{12,}'),
    'privateKey': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'githubToken': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b'),
    'providerKey': re.compile(r'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b'),
    'awsKey': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'slackToken': re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{16,}\b'),
    'credentialUrl': re.compile(r'''https?://[^\s/<>:"']+:[^\s/<>"']+@'''),
}
BLOCKED_SUFFIXES = {'.blend', '.blend1', '.f32', '.bin', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.zip', '.patch', '.bundle'}
BLOCKED_PARTS = {'private-recovery', 'user-feedback', '.artifacts', 'dream_notes', 'agent_notes', 'user_notes', 'node_modules', '.git'}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read_json(name, expected_sha=None):
    raw = (ROOT / name).read_bytes()
    if expected_sha:
        assert sha(raw) == expected_sha, f'Frozen manifest changed: {name}'
    return json.loads(raw)

def safe_path(name):
    p = pathlib.PurePosixPath(name)
    assert name and not p.is_absolute() and '..' not in p.parts and '\\' not in name, f'Unsafe path: {name}'
    return ROOT.joinpath(*p.parts)

def verify_record(record, key='path'):
    path = safe_path(record[key])
    assert path.is_file() and not path.is_symlink(), f'Expected plain file: {record[key]}'
    data = path.read_bytes()
    assert len(data) == record['bytes'], f'Byte length changed: {record[key]}'
    assert sha(data) == record['sha256'], f'SHA-256 changed: {record[key]}'

def source_files():
    out = []
    for p in ROOT.rglob('*'):
        relative = p.relative_to(ROOT)
        assert not p.is_symlink(), f'Symlink prohibited: {relative}'
        if relative.parts[:2] == ('qa', 'results'):
            continue
        assert not any(part in BLOCKED_PARTS for part in relative.parts), f'Blocked directory: {relative}'
        if p.is_file():
            out.append(relative.as_posix())
    return sorted(out)

def verify_png(data):
    assert sha(data) == PNG_SHA and len(data) == 227080
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    offset, chunks = 8, []
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack('>I', data[offset + 8 + length:offset + 12 + length])[0]
        assert zlib.crc32(kind + payload) & 0xffffffff == crc
        chunks.append(kind.decode('ascii'))
        if kind == b'IHDR':
            assert struct.unpack('>IIBBBBB', payload) == (1024, 512, 8, 6, 0, 0, 0)
        offset += length + 12
    assert offset == len(data) and chunks[0] == 'IHDR' and chunks[-1] == 'IEND'
    assert set(chunks) <= {'IHDR', 'IDAT', 'IEND'}, 'No color profile or ancillary payload permitted'
    return {'width': 1024, 'height': 512, 'bitDepth': 8, 'colorType': 'RGBA', 'chunks': chunks}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reproduce-runtime-zip', action='store_true')
    args = parser.parse_args()
    runtime = read_json('RUNTIME-ALLOWLIST.json', RUNTIME_MANIFEST_SHA)
    assert len(runtime['files']) == 26
    expected_runtime = sorted('public/' + r['path'] for r in runtime['files'])
    actual_runtime = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'public').rglob('*') if p.is_file())
    assert actual_runtime == expected_runtime, 'Runtime must contain exactly its 26 approved files'
    for r in runtime['files']:
        verify_record({**r, 'path': 'public/' + r['path']})
    baseline = read_json('SOURCE-FROZEN-SHA256.json', BASELINE_MANIFEST_SHA)
    assert len(baseline['files']) == 22
    projection = [{k: f[k] for k in ('relative', 'bytes', 'sha256')} for f in baseline['files']]
    assert sha(json.dumps(projection, separators=(',', ':'), ensure_ascii=False).encode()) == IDENTITY_PROJECTION_SHA
    for f in baseline['files']:
        verify_record(f, 'source')
    inventory = read_json('PUBLIC-SOURCE-ALLOWLIST.json')
    assert inventory['schema'] == 'sanitized-three-weather-public-source-v1'
    names = [r['path'] for r in inventory['files']]
    assert len(names) == len(set(names)) and names == sorted(names)
    assert source_files() == sorted(names + ['PUBLIC-SOURCE-ALLOWLIST.json']), 'Public source file inventory changed'
    for record in inventory['files']:
        verify_record(record)
    for name in names + ['PUBLIC-SOURCE-ALLOWLIST.json']:
        p = ROOT / name
        assert p.suffix.lower() not in BLOCKED_SUFFIXES, f'Blocked artifact: {name}'
        assert p.suffix.lower() != '.png' or name == PNG, f'Unapproved image: {name}'
        assert not p.name.startswith('.env'), f'Environment file prohibited: {name}'
        text = p.read_bytes().decode('utf-8', errors='replace')
        for label, pattern in PATTERNS.items():
            assert not pattern.search(text), f'Public-source pattern {label}: {name}'
    png = verify_png((ROOT / PNG).read_bytes())
    extraction = read_json('source/wet-map-provenance/extraction-manifest.json')
    material = read_json('source/wet-map-provenance/stock-material-manifest.json')
    assert material['extractionManifestSHA256'] == extraction['sanitization']['originalManifestSHA256']
    assert material['portableRGBA8Fallback']['sha256'] == PNG_SHA
    assert material['glbSHA256'] == extraction['inputGLBSHA256'] == '11d01c348cae82681e11e63393e953e535ceaad52e14ab7fea435505e94a6c89'
    assert material['sourceSHA256'] == extraction['sourceSHA256'] == 'a440dc770b88e8f692efb328856856498af8ace84d5457672f635b30c0a16cb2'
    report = {'passed': True, 'runtimeFiles': 26, 'originalSourceSnapshotAnchors': 22, 'publicSourceFiles': len(names) + 1, 'png': png, 'privateSourceReextracted': False, 'privateOriginalLocationsRechecked': False, 'webglVerified': False, 'privacyScan': 'Heuristic scan; does not certify absence of secrets'}
    if args.reproduce_runtime_zip:
        output = ROOT / 'qa/results/three-weather-r1-runtime.zip'
        output.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for record in runtime['files']:
                info = zipfile.ZipInfo(record['path'], date_time=(2026, 10, 10, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, (ROOT / 'public' / record['path']).read_bytes())
        with zipfile.ZipFile(output) as archive:
            assert archive.testzip() is None
            assert archive.namelist() == [r['path'] for r in runtime['files']]
            for record in runtime['files']:
                data = archive.read(record['path'])
                assert len(data) == record['bytes'] and sha(data) == record['sha256']
        actual_zip_sha = sha(output.read_bytes())
        compressor = {'python': sys.version.split()[0], 'zlibBuild': zlib.ZLIB_VERSION, 'zlibRuntime': zlib.ZLIB_RUNTIME_VERSION}
        assert actual_zip_sha == RUNTIME_ZIP_SHA, f'Archive binary reproducibility failed after all 26 entry contents passed: expected {RUNTIME_ZIP_SHA}, actual {actual_zip_sha}, compressor {compressor}. This is an archive serialization/compression gate, not evidence of runtime-content drift.'
        report['archiveCompressor'] = compressor
        report['runtimeZipSHA256'] = RUNTIME_ZIP_SHA
        report['runtimeZipEntriesAndHashesVerified'] = True
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
