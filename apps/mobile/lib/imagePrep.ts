import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type { AIImageInput } from '@cutty/types'

const MAX_DIMENSION = 1024
const JPEG_QUALITY = 0.7

export interface PreparedImage extends AIImageInput {
  uri: string
}

async function prepareAsset(uri: string): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(uri)
  const rendered = await context.resize({ width: MAX_DIMENSION }).renderAsync()
  const result = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true })

  if (!result.base64) {
    throw new Error('Failed to prepare image')
  }

  return { uri: result.uri, base64: result.base64, mediaType: 'image/jpeg' }
}

export async function captureFromCamera(): Promise<PreparedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') {
    throw new Error('Camera permission was denied')
  }

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
  if (result.canceled || !result.assets?.[0]) return null

  return prepareAsset(result.assets[0].uri)
}

export async function pickFromLibrary(): Promise<PreparedImage | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    throw new Error('Photo library permission was denied')
  }

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
  if (result.canceled || !result.assets?.[0]) return null

  return prepareAsset(result.assets[0].uri)
}
