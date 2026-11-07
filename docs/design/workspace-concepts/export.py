#!/usr/bin/env python3
"""Export the saved concepts using the installed Visualize renderer."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--renderer', required=True, type=Path)
    args = parser.parse_args()
    renderer = args.renderer.resolve()
    if not renderer.is_file():
        parser.error('--renderer must point to the Visualize scripts/render.py')

    directory = Path(__file__).resolve().parent
    manifest = json.loads((directory / 'manifest.json').read_text())
    marker = 'restore(window.openai?.widgetState)'

    for source in manifest['sources']:
        content = (directory / source['file']).read_bytes()
        if hashlib.sha256(content).hexdigest() != source['sha256']:
            raise ValueError(f"Source differs from saved reference: {source['file']}")

    with tempfile.TemporaryDirectory(prefix='workspace-concept-export-') as temp:
        for page in manifest['pages']:
            source = (directory / page['source']).read_text()
            if source.count(marker) != 1:
                raise ValueError(f"Expected one initial state call: {page['source']}")

            # Each preview opens its named page. The reference fragment stays exact.
            initial_state = json.dumps({'modelContent': page['state']})
            fragment = source.replace(marker, f'restore({initial_state})', 1)
            temporary_source = Path(temp) / f"{page['id']}.html"
            temporary_source.write_text(fragment)
            output = directory / page['preview']
            output.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                [sys.executable, str(renderer), str(temporary_source), str(output),
                 '--title', page['title'], '--force'],
                check=True,
            )


if __name__ == '__main__':
    main()
