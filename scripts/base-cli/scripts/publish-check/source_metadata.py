"""Digest fields in the formats emitted by edition-authoring cli/sources.mjs.

This recognizes metadata, not its freshness or integrity. Authoring's check
owns those validations; a retained, unselected archive is still metadata.
Only enumerated JSON value locations qualify, never arbitrary nested names.
"""
import re
from json_identity import HEX, GIT_REVISION
import source_shapes

ARCHIVE = re.compile(r'\.edition/sources/([a-f0-9]{64})\.json\Z')


def fields(value, pointer, names, pattern=HEX):
    if isinstance(value, dict):
        for name in names:
            if isinstance(value.get(name), str) and pattern.fullmatch(value[name]):
                yield (*pointer, name)


def pin(value, pointer):
    # sources.mjs and cli.mjs emit this same three-digest reference shape.
    if source_shapes.pin(value):
        yield from fields(value, pointer, ('key', 'digest', 'sha256'))


def origin(value, pointer):
    # snapshotOrigin in projection-lock.mjs copies one immutable identity.
    if not source_shapes.reference(value):
        return
    if 'projection' not in value:
        yield from fields(value, pointer, ('revision',), GIT_REVISION)
    else:
        yield from fields(value['projection'], (*pointer, 'projection'), ('originalSha256', 'recipeSha256'))


def source_pointers(path, value):
    if not isinstance(value, dict):
        return
    if path == 'sources.lock.json':
        if not source_shapes.lock(value):
            return
        yield from fields(value, (), ('manifest',))
        yield from fields(value['toolchain'], ('toolchain',), ('sha256',))
        yield from pin(value.get('parent'), ('parent',))
        for index, component in enumerate(value['components']):
            pointer = ('components', index)
            yield from pin(component.get('baseline'), (*pointer, 'baseline'))
            source = component['source']
            if source['kind'] == 'git':
                yield from origin(source, (*pointer, 'source'))
            else:
                yield from origin(source.get('origin'), (*pointer, 'source', 'origin'))
        for name, entry in value['files'].items():
            yield from fields(entry, ('files', name), ('sha256',))
    elif ARCHIVE.fullmatch(path):
        if not source_shapes.archive(value):
            return
        yield from fields(value, (), ('key', 'digest'))
        yield from origin(value['origin'], ('origin',))
        for index, dependency in enumerate(value.get('dependencies', [])):
            yield from pin(dependency, ('dependencies', index))
