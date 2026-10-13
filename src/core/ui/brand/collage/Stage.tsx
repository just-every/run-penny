import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'

type Size = { width: number; height: number }
const StageSize = createContext<Size>({ width: 0, height: 0 })

type StageProps = Size & {
  /**
   * The drawing's accessible description. Everything inside is decorative and hidden from assistive technology; without a
   * label the whole drawing is decoration and hidden too.
   */
  label?: string
  className?: string
  children: ReactNode
}

/**
 * A collage drawing: a box of the drawing's aspect ratio whose children share one coordinate system of `width` × `height`
 * units. SVG layers use it as their viewBox and paper notes are placed in the same units (`--u` is one unit in CSS pixels),
 * so torn shapes, ink and notes stay aligned at any size while note text keeps a readable minimum.
 */
export function Stage({ label, width, height, className = '', children }: StageProps) {
  if (width <= 0 || height <= 0) throw new Error('A collage stage needs a positive width and height.')
  const style = { '--vbw': width, '--vbh': height } as CSSProperties
  return (
    <div className={`pl-drawing ${className}`.trim()} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })} style={style}>
      <div className="pl-drawing-art" aria-hidden="true">
        <StageSize.Provider value={{ width, height }}>{children}</StageSize.Provider>
      </div>
    </div>
  )
}

/** An SVG layer spanning the whole stage. `front` layers sit above the paper notes. */
export function Layer({ front = false, children }: { front?: boolean; children: ReactNode }) {
  const { width, height } = useContext(StageSize)
  if (!width) throw new Error('A collage layer must sit inside a Stage.')
  return (
    <svg className={front ? 'pl-layer pl-layer--front' : 'pl-layer'} viewBox={`0 0 ${width} ${height}`} focusable="false">
      {children}
    </svg>
  )
}
