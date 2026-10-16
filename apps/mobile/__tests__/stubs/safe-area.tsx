import { createElement, type ReactNode } from 'react'

export const useSafeAreaInsets = () => ({ top: 44, bottom: 34, left: 0, right: 0 })
export const SafeAreaView = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
export const SafeAreaProvider = SafeAreaView
