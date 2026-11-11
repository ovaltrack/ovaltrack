#!/usr/bin/env python3
"""Genera el subconjunto de las fuentes de íconos (Bootstrap Icons y Tabler) con solo los íconos que usa la app.

Salida (se commitea; el build no depende de este script):
  src/icons/bootstrap-icons.woff2
  src/icons/tabler-icons.woff2
  src/icons/icons.css

Cuándo correrlo: al agregar o quitar un ícono `bi-*` / `ti-*` en una plantilla o en un .ts.
`npm run build` falla (scripts/check-icons.mjs) si falta uno.

Requisitos: python3 con `fonttools` y `brotli` (pip install fonttools brotli) y las fuentes de node_modules.
node_modules vive en el contenedor, no en el host: copiarlo con `./ds sync-node` o pasar --node-modules.

Uso (desde la raíz del repo):
  python3 frontend/scripts/icons/build-icon-subset.py [--node-modules frontend/node_modules]
"""
import argparse
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FRONTEND = Path(__file__).resolve().parents[2]
SRC = FRONTEND / 'src'
OUT = SRC / 'icons'
TOKEN = re.compile(r'(?<![\w-])((?:bi|ti)-[a-z0-9]+(?:-[a-z0-9]+)*)')


def used_tokens():
    tokens = set()
    for path in SRC.rglob('*'):
        if path.suffix in ('.html', '.ts') and not path.name.endswith('.spec.ts'):
            tokens.update(TOKEN.findall(path.read_text(encoding='utf-8')))
    return tokens


def library_icons(css, pattern):
    return {name: int(code, 16) for name, code in re.findall(pattern, css)}


def write_subset(font_path, codepoints, out_path):
    options = subset.Options()
    options.layout_features = []
    options.notdef_outline = False
    options.glyph_names = False
    options.drop_tables += ['GSUB', 'GPOS', 'GDEF']
    font = TTFont(font_path, lazy=True)
    for table in ('GSUB', 'GPOS', 'GDEF'):
        if table in font:
            del font[table]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(codepoints))
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(out_path)


def bootstrap_icons_css(css, names, icons):
    base = re.search(r'\.bi::before,[^{]*\{[^}]*\}', css).group(0)
    rules = ''.join(f'.{name}::before {{ content: "\\{icons[name]:x}"; }}\n' for name in names)
    face = ('@font-face {\n  font-display: block;\n  font-family: "bootstrap-icons";\n'
            '  src: url("./bootstrap-icons.woff2") format("woff2");\n}\n')
    return f'{face}\n{base}\n\n{rules}'


def tabler_css(css, names, icons):
    body = re.search(r'\.ti\{([^}]*)\}', css).group(1)
    declarations = [d.split(':', 1) for d in body.split(';') if d.strip()]
    base = '.ti {\n' + ''.join(f'  {prop.strip()}: {value.strip()};\n' for prop, value in declarations) + '}\n'
    rules = ''.join(f'.{name}:before {{ content: "\\{icons[name]:x}"; }}\n' for name in names)
    face = ('@font-face {\n  font-family: "tabler-icons";\n  font-style: normal;\n  font-weight: 400;\n'
            '  src: url("./tabler-icons.woff2") format("woff2");\n}\n')
    return f'{face}\n{base}\n{rules}'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--node-modules', default=str(FRONTEND / 'node_modules'))
    modules = Path(parser.parse_args().node_modules)

    bi_dir = modules / 'bootstrap-icons' / 'font'
    ti_dir = modules / '@tabler' / 'icons-webfont' / 'dist'
    bi_css = (bi_dir / 'bootstrap-icons.css').read_text(encoding='utf-8')
    ti_css = (ti_dir / 'tabler-icons.min.css').read_text(encoding='utf-8')
    bi_all = library_icons(bi_css, r'\.(bi-[a-z0-9-]+)::before\s*\{\s*content:\s*"\\([0-9a-f]+)"')
    ti_all = library_icons(ti_css, r'\.(ti-[a-z0-9-]+):before\{content:"\\([0-9a-f]+)"')

    tokens = used_tokens()
    bi_names = sorted(n for n in tokens if n in bi_all)
    ti_names = sorted(n for n in tokens if n in ti_all)

    OUT.mkdir(parents=True, exist_ok=True)
    write_subset(bi_dir / 'fonts' / 'bootstrap-icons.woff2', [bi_all[n] for n in bi_names], OUT / 'bootstrap-icons.woff2')
    write_subset(ti_dir / 'fonts' / 'tabler-icons.woff2', [ti_all[n] for n in ti_names], OUT / 'tabler-icons.woff2')

    header = ('/* Generado por scripts/icons/build-icon-subset.py: no editar a mano.\n'
              '   Solo los íconos usados de Bootstrap Icons (MIT) y Tabler Icons (MIT). */\n')
    (OUT / 'icons.css').write_text(
        header + '\n' + bootstrap_icons_css(bi_css, bi_names, bi_all) + '\n' + tabler_css(ti_css, ti_names, ti_all),
        encoding='utf-8')
    print(f'Bootstrap Icons: {len(bi_names)} íconos | Tabler: {len(ti_names)} íconos')


main()
