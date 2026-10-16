import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const CONTACT_OPTIONS: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  action: () => void
}[] = [
  {
    icon: 'call-outline',
    label: 'Call Us',
    value: '+234 800 123 4567',
    action: () => Linking.openURL('tel:+2348001234567'),
  },
  {
    icon: 'logo-whatsapp',
    label: 'WhatsApp',
    value: 'Chat with support',
    action: () => Linking.openURL('https://wa.me/2348001234567'),
  },
  {
    icon: 'mail-outline',
    label: 'Email Us',
    value: 'support@cutty.app',
    action: () => Linking.openURL('mailto:support@cutty.app'),
  },
]

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'How do I book an appointment?',
    answer:
      'Go to the Home or Bookings tab and tap "Book an Appointment". Pick a stylist on the map or search by name, area or style, choose the style you want, select a date and time, then confirm.',
  },
  {
    question: 'Can I cancel or reschedule a booking?',
    answer:
      'Yes. Open the booking from "My Bookings" and use the cancel or reschedule option. Changes made less than 2 hours before your appointment may not be eligible.',
  },
  {
    question: 'How does the wallet work?',
    answer:
      'Your wallet lets you top up funds and pay for bookings or products instantly at checkout, without re-entering card details every time.',
  },
  {
    question: 'How do I earn and redeem loyalty points?',
    answer:
      'You earn points automatically on completed bookings and purchases. Redeem them for discounts on the Rewards tab once you have enough points.',
  },
  {
    question: 'What is your return policy on products?',
    answer:
      'Unopened products can be returned within 7 days of delivery. Contact support with your order number to start a return.',
  },
]

export default function SupportScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <ScrollView className="flex-1 bg-dark-900" contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} className="text-fg" />
        </TouchableOpacity>
        <Text className="text-fg text-xl font-bold">Help & Support</Text>
      </View>

      {/* Intro */}
      <View className="mx-5 mt-6 mb-2">
        <Text className="text-fg text-lg font-bold">How can we help?</Text>
        <Text className="text-dark-400 text-sm mt-1">
          Reach our team directly or browse answers to common questions below.
        </Text>
      </View>

      {/* Contact options */}
      <View className="mx-5 mt-4 gap-3">
        {CONTACT_OPTIONS.map(({ icon, label, value, action }) => (
          <TouchableOpacity
            key={label}
            activeOpacity={0.85}
            className="flex-row items-center bg-dark-800 border border-dark-700 rounded-2xl px-4 py-4 gap-4"
            onPress={action}
          >
            <View className="w-11 h-11 bg-primary-500/10 rounded-xl items-center justify-center">
              <Ionicons name={icon} size={20} color="#F1A91F" />
            </View>
            <View className="flex-1">
              <Text className="text-fg text-base font-semibold">{label}</Text>
              <Text className="text-dark-400 text-xs mt-0.5">{value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} className="text-dark-600" />
          </TouchableOpacity>
        ))}
      </View>

      {/* FAQs */}
      <Text className="text-dark-400 text-xs font-semibold mx-5 mt-8 mb-2" style={{ letterSpacing: 1 }}>
        FREQUENTLY ASKED QUESTIONS
      </Text>
      <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        {FAQS.map(({ question, answer }, i) => {
          const isOpen = openIndex === i
          return (
            <View key={question} className={i < FAQS.length - 1 ? 'border-b border-dark-700' : ''}>
              <TouchableOpacity
                activeOpacity={0.85}
                className="flex-row items-center px-4 py-4 gap-3"
                onPress={() => setOpenIndex(isOpen ? null : i)}
              >
                <Text className="text-fg text-sm font-medium flex-1">{question}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#F1A91F" />
              </TouchableOpacity>
              {isOpen && (
                <Text className="text-dark-300 text-sm px-4 pb-4 leading-5">{answer}</Text>
              )}
            </View>
          )
        })}
      </View>

      <Text className="text-dark-500 text-xs text-center mt-8">
        Still need help? Reach us anytime at support@cutty.app
      </Text>
    </ScrollView>
  )
}
