import type { Plugin } from 'vite'

const moduleId = 'virtual:penny-operator-preloads'

/** Start's route manifest lists direct chunks. Include their static dependency
 * graph on private documents so hydration does not discover another asset wave. */
export function operatorPreloads(): Plugin {
  let serve = false
  let routes: Record<string, string[]> | undefined
  return {
    name: 'penny:operator-preloads',
    configResolved(config) { serve = config.command === 'serve' },
    resolveId(id) { if (id === moduleId) return '\0' + id },
    load(id) {
      if (id !== '\0' + moduleId) return
      if (!serve && !routes) this.error('The client asset graph must be built before the Worker.')
      return `export default ${JSON.stringify(routes ?? {})}`
    },
    generateBundle(_, bundle) {
      if (this.environment.name !== 'client') return
      routes = {}
      const dependencies = (name: string, found = new Set<string>()) => {
        if (found.has(name)) return found
        const chunk = bundle[name]
        if (!chunk || chunk.type !== 'chunk') return found
        found.add(name)
        for (const dependency of chunk.imports) dependencies(dependency, found)
        return found
      }
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        const paths = new Set(Object.keys(chunk.modules).flatMap(id => {
          const match = /\/src\/routes\/(app(?:\.[^/]+)?)\.tsx(?:\?|$)/.exec(id)
          return match ? ['/' + match[1].replace(/\.index$/, '').replaceAll('.', '/')] : []
        }))
        for (const path of paths) routes[path] = [...new Set([...(routes[path] ?? []), ...[...dependencies(chunk.fileName)].map(name => '/' + name)])]
      }
    },
  }
}
