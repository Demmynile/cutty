import { forwardRef, useImperativeHandle, type ReactNode } from 'react'

// Renders children only; camera calls are no-ops.
const MapView = forwardRef(function MapView({ children }: { children?: ReactNode }, ref) {
  useImperativeHandle(ref, () => ({ animateToRegion() {}, fitToCoordinates() {} }))
  return <div data-testid="map">{children}</div>
})
export default MapView
export const Marker = ({ children }: { children?: ReactNode }) => <div>{children}</div>
export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }
