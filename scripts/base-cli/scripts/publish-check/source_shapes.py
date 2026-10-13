"""Local record shapes emitted by edition-authoring, without integrity checks."""
import re
from copy_identities import relative_path
from json_identity import HEX, GIT_REVISION

IDENTITY = re.compile(r'[a-zA-Z0-9][a-zA-Z0-9._-]*/[a-zA-Z0-9][a-zA-Z0-9._-]*\Z')


def matches(value, pattern=HEX):
    return isinstance(value, str) and bool(pattern.fullmatch(value))


def pin(value):
    return isinstance(value, dict) and all(matches(value.get(k)) for k in ('key', 'digest', 'sha256'))


def paths(value):
    return isinstance(value, list) and bool(value) and all(relative_path(p) for p in value)


def reference(value, snapshot=False):
    # manifest.origin supplies the identity; snapshotOrigin additionally emits
    # normalized path/paths/excludeSnapshots fields on every retained archive.
    if (not isinstance(value, dict) or not isinstance(value.get('repository'), str)
            or not value['repository'] or value['repository'].startswith('-')):
        return False
    if 'projection' in value:
        projection = value['projection']
        if ('revision' in value or not isinstance(projection, dict)
                or set(projection) != {'schemaVersion', 'originalSha256', 'recipeSha256'}
                or type(projection['schemaVersion']) is not int or projection['schemaVersion'] != 1
                or not all(matches(projection[k]) for k in ('originalSha256', 'recipeSha256'))):
            return False
    elif not matches(value.get('revision'), GIT_REVISION):
        return False
    if snapshot and not {'path', 'paths', 'excludeSnapshots'} <= value.keys():
        return False
    return (('path' not in value or value['path'] == '.' or relative_path(value['path']))
            and (value.get('paths') is None or paths(value['paths']))
            and ('excludeSnapshots' not in value or type(value['excludeSnapshots']) is bool))


def file_records(value, archived=False):
    if not isinstance(value, dict):
        return False
    # Payload bytes need not be present elsewhere or agree with a digest.
    # Empty retained file maps are still metadata.
    return all(relative_path(name) and isinstance(record, dict)
               and type(record.get('executable')) is bool
               and (isinstance(record.get('data'), str) if archived else matches(record.get('sha256')))
               for name, record in value.items())


def archive(value):
    return (isinstance(value, dict) and all(matches(value.get(k)) for k in ('key', 'digest'))
            and reference(value.get('origin'), snapshot=True)
            and file_records(value.get('files'), archived=True)
            and isinstance(value.get('dependencies', []), list)
            and all(pin(dependency) for dependency in value.get('dependencies', [])))


def source(value):
    if not isinstance(value, dict):
        return False
    if value.get('kind') == 'git':
        return reference(value) and relative_path(value.get('destination'))
    if value.get('kind') != 'local' or not paths(value.get('paths')):
        return False
    mappings = value.get('mappings')
    return ((value.get('origin') is None or reference(value['origin']))
            and (mappings is None or (isinstance(mappings, list)
                 and all(isinstance(m, dict) and relative_path(m.get('path'))
                         and relative_path(m.get('originPath')) for m in mappings))))


def lock(value):
    if (not isinstance(value, dict) or type(value.get('schemaVersion')) is not int
            or value['schemaVersion'] != 1 or not matches(value.get('edition'), IDENTITY)
            or not matches(value.get('manifest')) or 'parent' not in value
            or (value['parent'] is not None and not pin(value['parent']))
            or not isinstance(value.get('components'), list) or not file_records(value.get('files'))):
        return False
    toolchain = value.get('toolchain')
    if (not isinstance(toolchain, dict) or toolchain.get('id') != 'runeditrun/edition-authoring'
            or not isinstance(toolchain.get('version'), str) or not toolchain['version']
            or not matches(toolchain.get('sha256'))):
        return False
    return all(isinstance(component, dict) and matches(component.get('id'), IDENTITY)
               and source(component.get('source')) and 'baseline' in component
               and (component['baseline'] is None or pin(component['baseline']))
               for component in value['components'])
