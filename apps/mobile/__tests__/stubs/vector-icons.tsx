import { createElement } from 'react'

export const Ionicons = ({ name, onPress }: { name: string; onPress?: () => void }) => createElement('i', { 'data-icon': name, onClick: onPress })
