declare module 'react-simple-maps' {
  import { ReactNode, SVGProps, MouseEventHandler } from 'react'

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: Record<string, unknown>
    style?: React.CSSProperties
    children?: ReactNode
  }
  export function ComposableMap(props: ComposableMapProps): JSX.Element

  interface GeographiesProps {
    geography: string | object
    children: (args: { geographies: any[] }) => ReactNode
  }
  export function Geographies(props: GeographiesProps): JSX.Element

  interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: any
    style?: { default?: React.CSSProperties; hover?: React.CSSProperties; pressed?: React.CSSProperties }
  }
  export function Geography(props: GeographyProps): JSX.Element

  interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
  }
  export function Marker(props: MarkerProps): JSX.Element

  interface SphereProps extends SVGProps<SVGPathElement> {
    id: string
  }
  export function Sphere(props: SphereProps): JSX.Element

  interface GraticuleProps extends SVGProps<SVGPathElement> {}
  export function Graticule(props: GraticuleProps): JSX.Element

  interface ZoomableGroupProps {
    children?: ReactNode
    center?: [number, number]
    zoom?: number
  }
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element
}
