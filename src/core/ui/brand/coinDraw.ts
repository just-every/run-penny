import { createElement, type ReactNode } from 'react'
import type { SvgElement } from './coinSmall'

// SVG spells its presentation attributes in kebab case (clip-path); React spells them in camel case (clipPath). An id, and
// a url(#id) reference to it, take the drawing's prefix, so two drawings on one page never share a clip.
const reactName = (name: string) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
const scoped = (name: string, value: string | number, prefix: string) =>
  name === 'id' ? `${prefix}-${value}` : typeof value === 'string' ? value.replace(/url\(#([\w-]+)\)/g, `url(#${prefix}-$1)`) : value

export const draw = (elements: readonly SvgElement[], prefix: string): ReactNode[] =>
  elements.map(({ tag, attrs, children }, index) =>
    createElement(tag, { key: index, ...Object.fromEntries(Object.entries(attrs).map(([name, value]) => [reactName(name), scoped(name, value, prefix)])) }, children ? draw(children, prefix) : undefined))
