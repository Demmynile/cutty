// Google Maps styles (Android) tuned to the app palette: charcoal land, muted
// roads and gold accents in dark mode; soft greys in light mode. iOS uses
// Apple Maps, which follows `userInterfaceStyle` instead.

export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#161616' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111111' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#282828' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#C8C8C8' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#A8A8A8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1B1E18' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#262626' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6B6B6B' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2E2E2E' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A3022' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#B88A4A' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B1116' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#484848' }] },
]

export const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F4F4F5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B6B6B' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#333333' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E3EBDD' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F6E3C2' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#9B490F' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D6E2EA' }] },
]
