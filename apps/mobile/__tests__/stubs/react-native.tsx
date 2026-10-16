import { createElement, forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { vi } from 'vitest'

// A tiny DOM rendering of the React Native primitives the app uses, so screens
// can render under jsdom. Only behaviour tests rely on is modelled: text,
// presses, text input, lists, modals and switches. Styles are dropped.

type P = Record<string, any> & { children?: ReactNode }

const pass = ({ testID, accessibilityLabel, className, nativeID }: P) => ({
  'data-testid': testID, 'aria-label': accessibilityLabel, className, id: nativeID,
})

export const View = forwardRef<unknown, P>((p, _ref) => createElement('div', pass(p), p.children))
export const SafeAreaView = View
export const KeyboardAvoidingView = View

export const Text = (p: P) =>
  createElement('span', { ...pass(p), onClick: p.onPress, 'data-lines': p.numberOfLines }, p.children)

function Touchable(p: P) {
  return createElement(
    'button',
    {
      ...pass(p), type: 'button', disabled: !!p.disabled,
      onClick: p.disabled ? undefined : p.onPress,
      onMouseDown: p.disabled ? undefined : p.onPressIn,
      onMouseUp: p.disabled ? undefined : p.onPressOut,
    },
    typeof p.children === 'function' ? (p.children as (s: { pressed: boolean }) => ReactNode)({ pressed: false }) : p.children,
  )
}
export const TouchableOpacity = Touchable
export const Pressable = Touchable
export const TouchableWithoutFeedback = Touchable

export const ScrollView = forwardRef<unknown, P>((p, ref) => {
  useImperativeHandle(ref, () => ({ scrollTo: vi.fn(), scrollToEnd: vi.fn() }))
  return createElement('div', { ...pass(p), 'data-scroll': true }, p.refreshControl, p.children)
})

export const RefreshControl = (p: P) =>
  createElement('button', { type: 'button', 'data-testid': 'refresh-control', onClick: p.onRefresh, 'aria-busy': !!p.refreshing })

export const ActivityIndicator = (p: P) => createElement('div', { ...pass(p), role: 'progressbar' })

export const TextInput = forwardRef<unknown, P>((p, ref) => {
  useImperativeHandle(ref, () => ({ focus: vi.fn(), blur: vi.fn(), clear: vi.fn() }))
  return createElement(p.multiline ? 'textarea' : 'input', {
    ...pass(p),
    value: p.value ?? undefined,
    defaultValue: p.defaultValue,
    placeholder: p.placeholder,
    type: p.secureTextEntry ? 'password' : 'text',
    readOnly: p.editable === false,
    maxLength: p.maxLength,
    onChange: (e: { target: { value: string } }) => p.onChangeText?.(e.target.value),
    onBlur: p.onBlur,
    onFocus: p.onFocus,
    onKeyDown: (e: { key: string }) => { if (e.key === 'Enter') p.onSubmitEditing?.() },
  })
})

export const Switch = (p: P) =>
  createElement('input', { ...pass(p), type: 'checkbox', role: 'switch', checked: !!p.value, disabled: p.disabled, onChange: () => p.onValueChange?.(!p.value) })

export const Modal = (p: P) => (p.visible === false ? null : createElement('div', { role: 'dialog' }, p.children))

/** Props of every FlatList rendered, latest last (for scroll callbacks etc.). */
export const renderedLists: P[] = []

const element = (c: any) => (c == null ? null : typeof c === 'function' ? createElement(c) : c)

export const FlatList = forwardRef<unknown, P>((p, ref) => {
  useImperativeHandle(ref, () => ({ scrollToIndex: vi.fn(), scrollToOffset: vi.fn(), scrollToEnd: vi.fn() }))
  renderedLists.push(p)
  const data: unknown[] = p.data ?? []
  const items = (p.inverted ? [...data].reverse() : data).map((item, index) =>
    createElement('div', { key: p.keyExtractor ? p.keyExtractor(item, index) : String(index) }, p.renderItem({ item, index })),
  )
  return createElement(
    'div',
    { ...pass(p), 'data-list': true },
    p.refreshControl,
    element(p.ListHeaderComponent),
    data.length ? items : element(p.ListEmptyComponent),
    element(p.ListFooterComponent),
  )
})

export const Alert = { alert: vi.fn() }
export const Linking = { openURL: vi.fn(async (_url: string) => true), canOpenURL: vi.fn(async (_url: string) => true) }
export const Platform = { OS: 'ios', select: <T,>(o: { ios?: T; default?: T }) => o.ios ?? o.default }
export const Dimensions = { get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }) }
export const useWindowDimensions = () => ({ width: 390, height: 844, scale: 3, fontScale: 1 })
export const useColorScheme = vi.fn(() => 'dark' as 'dark' | 'light' | null)
export const StyleSheet = { create: <T,>(s: T) => s, absoluteFillObject: {}, hairlineWidth: 1 }
export const Keyboard = { dismiss: vi.fn() }
export const AppState = { currentState: 'active', addEventListener: vi.fn((_e: string, _h: (s: string) => void) => ({ remove: vi.fn() })) }
export type ImageSourcePropType = unknown
export type TextInputProps = P
