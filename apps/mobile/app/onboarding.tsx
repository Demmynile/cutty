import { useCallback, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, useWindowDimensions, type ImageSourcePropType } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useAuthStore } from '@/store/authStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import { DARK_THEME_VARS } from '@/lib/theme'

interface Slide {
  image: ImageSourcePropType
  eyebrow: string
  title: string
  subtitle: string
}

const SLIDES: Slide[] = [
  {
    image: require('../assets/onboarding/01.jpg'),
    eyebrow: 'WELCOME TO CUTTY',
    title: 'Your chair is waiting',
    subtitle: 'Book a top stylist in seconds — no calls, no queues.',
  },
  {
    image: require('../assets/onboarding/02.jpg'),
    eyebrow: 'PRECISION',
    title: 'Fresh every single time',
    subtitle: 'Skilled hands, sharp fades, and a finish that lasts.',
  },
  {
    image: require('../assets/onboarding/06.jpg'),
    eyebrow: 'BRAIDS & TWISTS',
    title: 'Braids, done right',
    subtitle: 'Knotless braids, twists, locs and more — book a stylist who knows natural hair.',
  },
  {
    image: require('../assets/onboarding/03.jpg'),
    eyebrow: 'THE SHOP',
    title: 'More than a haircut',
    subtitle: 'Walk into a space built for the culture.',
  },
  {
    image: require('../assets/onboarding/07.jpg'),
    eyebrow: 'WIGS & SILK PRESS',
    title: 'Wig installs, done fresh',
    subtitle: 'Lace fronts, sew-ins and silky blowouts — booked in the same app.',
  },
  {
    image: require('../assets/onboarding/04.jpg'),
    eyebrow: 'GROOMING',
    title: 'Look the part at home',
    subtitle: 'Shop the same premium products your stylist uses.',
  },
  {
    image: require('../assets/onboarding/05.jpg'),
    eyebrow: 'AI TRY-ON',
    title: 'See it before the chair',
    subtitle: 'Preview any hairstyle on your own photo, then book it.',
  },
]

function SlideItem({ slide, index, scrollX, width }: { slide: Slide; index: number; scrollX: SharedValue<number>; width: number }) {
  const insets = useSafeAreaInsets()
  const input = [(index - 1) * width, index * width, (index + 1) * width]

  // Wider-than-screen image so the parallax shift never exposes an edge.
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(scrollX.value, input, [width * 0.2, 0, -width * 0.2], Extrapolation.CLAMP) },
    ],
  }))

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, input, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollX.value, input, [40, 0, 40], Extrapolation.CLAMP) }],
  }))

  return (
    <View style={{ width }} className="flex-1">
      <Animated.View
        style={[{ position: 'absolute', width: width * 1.4, height: '100%', left: -width * 0.2 }, imageStyle]}
      >
        <Image source={slide.image} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </Animated.View>

      <LinearGradient
        colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.55)', 'rgba(10,10,10,0.97)']}
        locations={[0, 0.45, 0.9]}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />

      <Animated.View style={[{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 156 }, textStyle]}>
        <Text className="text-primary-400" style={{ fontSize: 12, fontWeight: '700', letterSpacing: 3 }}>
          {slide.eyebrow}
        </Text>
        <Text className="text-white mt-3" style={{ fontSize: 34, fontWeight: '800', lineHeight: 40 }}>
          {slide.title}
        </Text>
        <Text className="text-dark-200 mt-3" style={{ fontSize: 16, lineHeight: 23 }}>
          {slide.subtitle}
        </Text>
      </Animated.View>
    </View>
  )
}

function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width]
    return {
      width: interpolate(scrollX.value, input, [7, 22, 7], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.35, 1, 0.35], Extrapolation.CLAMP),
    }
  })
  return <Animated.View style={[{ height: 7, borderRadius: 4, backgroundColor: '#F1A91F' }, style]} />
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const scrollX = useSharedValue(0)
  const listRef = useRef<Animated.FlatList<Slide>>(null)
  const [index, setIndex] = useState(0)

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x
  })

  const onMomentumEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
    },
    [width],
  )

  const finish = useCallback(() => {
    useOnboardingStore.getState().markSeen()
    router.replace(isAuthenticated ? '/(tabs)' : '/(auth)')
  }, [isAuthenticated])

  const next = useCallback(() => {
    if (index >= SLIDES.length - 1) {
      finish()
      return
    }
    listRef.current?.scrollToOffset({ offset: (index + 1) * width, animated: true })
  }, [index, width, finish])

  const isLast = index === SLIDES.length - 1

  return (
    <View className="flex-1 bg-dark-900" style={DARK_THEME_VARS}>
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        renderItem={({ item, index: i }) => <SlideItem slide={item} index={i} scrollX={scrollX} width={width} />}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      />

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity
          onPress={finish}
          hitSlop={12}
          style={{ position: 'absolute', top: insets.top + 8, right: 20 }}
          className="px-3 py-1.5 rounded-full bg-black/30"
        >
          <Text className="text-white text-sm font-medium">Skip</Text>
        </TouchableOpacity>
      )}

      {/* Bottom controls */}
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 28 }} className="gap-6">
        <View className="flex-row items-center gap-2">
          {SLIDES.map((_, i) => (
            <Dot key={i} index={i} scrollX={scrollX} width={width} />
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={next}
          className="bg-primary-500 rounded-2xl py-4 flex-row items-center justify-center gap-2"
        >
          <Text className="text-white text-lg font-bold">{isLast ? 'Get Started' : 'Next'}</Text>
          <Ionicons name={isLast ? 'arrow-forward' : 'chevron-forward'} size={18} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  )
}
