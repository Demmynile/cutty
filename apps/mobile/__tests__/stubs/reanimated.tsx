import { createElement, forwardRef } from 'react'
import { FlatList, View } from './react-native'

const builder: any = new Proxy(() => builder, { get: () => builder })
export const FadeIn = builder
export const FadeInDown = builder
export const FadeInUp = builder
export const Extrapolation = { CLAMP: 'clamp' }
export const interpolate = (v: number) => v
export const useSharedValue = <T,>(value: T) => ({ value })
export const useAnimatedStyle = (fn: () => unknown) => fn()
export const useAnimatedScrollHandler = (h: unknown) => h
export const withTiming = <T,>(v: T) => v
export const withSpring = <T,>(v: T) => v
const AnimatedView = forwardRef<unknown, any>((p, ref) => createElement(View, { ...p, ref }))
const Animated = { View: AnimatedView, FlatList, Text: AnimatedView, ScrollView: AnimatedView }
export default Animated
