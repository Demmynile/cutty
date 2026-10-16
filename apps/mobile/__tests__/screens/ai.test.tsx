// @vitest-environment jsdom
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRY_ON_STYLES } from '@cutty/types'
import { router, setParams } from '../stubs/expo-router'
import { Alert } from '../stubs/react-native'
import { isAvailableAsync, shareAsync, writeAsStringAsync } from '../stubs/misc-expo'
import { pressAlertButton, renderScreen } from '../helpers/screen'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn() }))
vi.mock('@/lib/ai', () => ({ analyzePhoto: vi.fn(), sendChatMessage: vi.fn(), tryOnStyle: vi.fn(), aiSearch: vi.fn() }))
vi.mock('@/lib/imagePrep', () => ({ captureFromCamera: vi.fn(), pickFromLibrary: vi.fn() }))

const { api, ApiError } = await import('@/lib/api')
const { analyzePhoto, sendChatMessage, tryOnStyle, aiSearch } = await import('@/lib/ai')
const { captureFromCamera, pickFromLibrary } = await import('@/lib/imagePrep')
const { useAIChatStore } = await import('@/store/aiChatStore')
const { queryClient } = await import('@/lib/data')

const exact = (label: string) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
const photo = { uri: 'file:///me.jpg', base64: 'bWU=', mediaType: 'image/jpeg' as const }
const alert = vi.mocked(Alert.alert)

beforeEach(() => {
  document.body.innerHTML = ''
  setParams({})
  vi.mocked(captureFromCamera).mockResolvedValue(photo)
  vi.mocked(pickFromLibrary).mockResolvedValue(photo)
})

describe('ai/analyze', () => {
  const analysis = {
    faceShapeRead: 'appears oval', hairTypeRead: 'coily 4C',
    recommendations: [
      { style: 'Taper fade', reasoning: 'Balances an oval face', maintenanceTips: 'Line up every 2 weeks', matchedServiceCategory: 'haircut' },
      { style: 'Twists', reasoning: 'Protective', maintenanceTips: 'Moisturise' },
    ],
    generalMaintenanceTips: ['Sleep on satin'],
    disclaimer: 'AI suggestion, not a consultation.',
  }

  it('needs a photo, then analyzes it with optional notes and shows the results', async () => {
    vi.mocked(analyzePhoto).mockResolvedValue(analysis as never)
    const { default: Analyze } = await import('@/app/ai/analyze')
    const s = await renderScreen(<Analyze />)
    expect(s.button(/^Analyze$/).disabled).toBe(true)

    await s.press('Add a photo')
    await pressAlertButton(alert, 'Take Photo')
    expect(s.images()).toContain('file:///me.jpg')
    await s.type('e.g. low maintenance', '  wedding  ')
    await s.press(/^Analyze$/)
    expect(analyzePhoto).toHaveBeenCalledWith({ image: { base64: 'bWU=', mediaType: 'image/jpeg' }, notes: 'wedding' })
    for (const t of ['appears oval', 'coily 4C', 'Taper fade', 'Line up every 2 weeks', '• Sleep on satin', 'AI suggestion']) expect(s.text()).toContain(t)

    await s.press('Find a stylist for this')
    expect(router.push).toHaveBeenCalledWith('/booking/new')
    expect(s.text().match(/Find a stylist for this/g)).toHaveLength(1) // only for matched categories
    await s.press('Analyze another photo')
    expect(s.text()).toContain('Add a photo')
  })

  it('shows analysis errors inline and picker errors in an alert', async () => {
    vi.mocked(analyzePhoto).mockRejectedValue(new Error('AI service is busy'))
    vi.mocked(pickFromLibrary).mockRejectedValueOnce(new Error('Photo library permission was denied'))
    const { default: Analyze } = await import('@/app/ai/analyze')
    const s = await renderScreen(<Analyze />)
    await s.press('Add a photo')
    await pressAlertButton(alert, 'Choose from Library')
    expect(alert).toHaveBeenLastCalledWith('Error', 'Photo library permission was denied')
    await s.press('Add a photo')
    await pressAlertButton(alert, 'Take Photo')
    await s.press(/^Analyze$/)
    expect(analyzePhoto).toHaveBeenCalledWith(expect.objectContaining({ notes: undefined }))
    expect(s.text()).toContain('AI service is busy')
  })
})

describe('ai/chat/[mode]', () => {
  beforeEach(() => {
    useAIChatStore.getState().clearAll()
  })

  it('uses the grooming copy for ?mode=grooming and styling otherwise', async () => {
    const { default: Chat } = await import('@/app/ai/chat/[mode]')
    setParams({ mode: 'grooming' })
    expect((await renderScreen(<Chat />)).text()).toContain('Grooming & Care Guide')
    setParams({ mode: 'anything' })
    expect((await renderScreen(<Chat />)).text()).toContain('What haircut suits a round face?')
  })

  it('sends the conversation and appends the reply', async () => {
    setParams({ mode: 'styling' })
    vi.mocked(sendChatMessage).mockResolvedValue({ reply: 'Try a high-top fade.' })
    const { default: Chat } = await import('@/app/ai/chat/[mode]')
    const s = await renderScreen(<Chat />)
    await s.type('Type a message...', '  What suits me?  ')
    await s.press(s.iconButton('arrow-up'))
    expect(sendChatMessage).toHaveBeenCalledWith({ mode: 'styling', messages: [{ role: 'user', content: 'What suits me?' }], image: undefined })
    expect(s.text()).toContain('What suits me?')
    expect(s.text()).toContain('Try a high-top fade.')
    expect(useAIChatStore.getState().history.styling).toHaveLength(2)
  })

  it('attaches a photo to the next message only', async () => {
    setParams({ mode: 'styling' })
    vi.mocked(sendChatMessage).mockResolvedValue({ reply: 'ok' })
    const { default: Chat } = await import('@/app/ai/chat/[mode]')
    const s = await renderScreen(<Chat />)
    await s.press(s.iconButton('camera'))
    await pressAlertButton(alert, 'Choose from Library')
    expect(s.text()).toContain('Photo attached')
    await s.type('Type a message...', 'this one')
    await s.press(s.iconButton('arrow-up'))
    expect(vi.mocked(sendChatMessage).mock.calls[0][0].image).toEqual({ base64: 'bWU=', mediaType: 'image/jpeg' })
    expect(s.text()).not.toContain('Photo attached')
  })

  it('offers a retry after a failed send, keeping the same history', async () => {
    setParams({ mode: 'styling' })
    vi.mocked(sendChatMessage).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ reply: 'Back online.' })
    const { default: Chat } = await import('@/app/ai/chat/[mode]')
    const s = await renderScreen(<Chat />)
    await s.type('Type a message...', 'hello')
    await s.press(s.iconButton('arrow-up'))
    expect(s.text()).toContain('Failed to send. Tap retry.')
    expect(s.input('Type a message...').readOnly).toBe(true)
    await s.press('Retry')
    expect(vi.mocked(sendChatMessage).mock.calls[1][0]).toEqual(vi.mocked(sendChatMessage).mock.calls[0][0])
    expect(s.text()).toContain('Back online.')
  })

  it('only sends the last 20 messages', async () => {
    setParams({ mode: 'grooming' })
    for (let i = 0; i < 25; i++) useAIChatStore.getState().addMessage('grooming', { role: i % 2 ? 'assistant' : 'user', content: `m${i}` })
    vi.mocked(sendChatMessage).mockResolvedValue({ reply: 'ok' })
    const { default: Chat } = await import('@/app/ai/chat/[mode]')
    const s = await renderScreen(<Chat />)
    await s.type('Type a message...', 'latest')
    await s.press(s.iconButton('arrow-up'))
    const sentMessages = vi.mocked(sendChatMessage).mock.calls[0][0].messages
    expect(sentMessages).toHaveLength(20)
    expect(sentMessages.at(-1)).toEqual({ role: 'user', content: 'latest' })
  })

  it('confirms before clearing the history', async () => {
    setParams({ mode: 'styling' })
    useAIChatStore.getState().addMessage('styling', { role: 'user', content: 'old' })
    const { default: Chat } = await import('@/app/ai/chat/[mode]')
    const s = await renderScreen(<Chat />)
    await s.press(s.iconButton('trash-outline'))
    await pressAlertButton(alert, 'Clear')
    expect(useAIChatStore.getState().history.styling).toEqual([])
  })
})

describe('ai/search', () => {
  const result = {
    query: 'knotless braids', summary: 'Ada does knotless on Saturdays.', styles: ['knotless-braids', 'not-a-style'],
    stylists: [{ reason: 'Knotless ₦25,000', stylist: { _id: 'st1', name: 'Ada', rating: 4.86 } }],
    products: [{ reason: 'For edges', product: { _id: 'p1', name: 'Edge gel', price: 300_000, slug: { current: 'edge-gel' } } }],
  }

  it('runs a search and shows stylists, looks and products', async () => {
    vi.mocked(api).mockResolvedValue({ personalized: false })
    vi.mocked(aiSearch).mockResolvedValue(result as never)
    const { default: Search } = await import('@/app/ai/search')
    const s = await renderScreen(<Search />)
    expect(s.text()).toContain('Try:')
    await s.type('What are you looking for?', '  knotless braids ')
    await s.press(s.iconButton('sparkles'))
    expect(aiSearch).toHaveBeenCalledWith('knotless braids')
    for (const t of ['Ada does knotless on Saturdays.', 'Ada ★ 4.9', 'Knotless Braids', 'Edge gel', '₦3,000']) expect(s.text()).toContain(t)
    await s.press('Knotless ₦25,000')
    expect(router.push).toHaveBeenCalledWith('/stylist/st1')
    await s.press('Edge gel')
    expect(router.push).toHaveBeenCalledWith('/product/edge-gel')
    await s.press(/^Knotless Braids$/)
    expect(router.push).toHaveBeenCalledWith('/ai/tryon?styleId=knotless-braids')
  })

  it('shows the last personalized search on open and runs example queries', async () => {
    vi.mocked(api).mockResolvedValue({ ...result, personalized: true })
    vi.mocked(aiSearch).mockResolvedValue({ query: 'x', summary: 'Nothing', stylists: [], products: [], styles: [] } as never)
    const { default: Search } = await import('@/app/ai/search')
    const s = await renderScreen(<Search />)
    expect(s.text()).toContain('Ada does knotless on Saturdays.')

    queryClient.clear() // a later session, before any search
    vi.mocked(api).mockResolvedValue({ personalized: false })
    const fresh = await renderScreen(<Search />)
    await fresh.press('A barber who does clean skin fades after work')
    expect(aiSearch).toHaveBeenCalledWith('A barber who does clean skin fades after work')
    expect(fresh.text()).toContain('Nothing matched closely')
  })

  it('ignores one-character queries and alerts search errors', async () => {
    vi.mocked(api).mockRejectedValue(new Error('offline'))
    vi.mocked(aiSearch).mockRejectedValue(new ApiError(429, 'Too many requests.'))
    const { default: Search } = await import('@/app/ai/search')
    const s = await renderScreen(<Search />)
    await s.type('What are you looking for?', 'a')
    expect(s.iconButton('sparkles').disabled).toBe(true)
    await s.type('What are you looking for?', 'fade')
    await s.press(s.iconButton('sparkles'))
    expect(alert).toHaveBeenCalledWith('Search', 'Too many requests.')
  })
})

describe('ai/tryon', () => {
  const style = TRY_ON_STYLES[0]
  const other = TRY_ON_STYLES[1]
  const generated = (id: string) => ({ image: { base64: `gen-${id}`, mediaType: 'image/png' }, styleId: id, caption: '' })

  async function withPhoto() {
    const { default: TryOn } = await import('@/app/ai/tryon')
    const s = await renderScreen(<TryOn />)
    await s.press('Add a photo')
    await pressAlertButton(alert, 'Take Photo')
    return s
  }

  it('generates a preview per style, caching results', async () => {
    vi.mocked(tryOnStyle).mockImplementation(async ({ styleId }) => generated(styleId) as never)
    const s = await withPhoto()
    expect(s.text()).toContain('Pick a style to try')
    await s.press(exact(style.label))
    expect(tryOnStyle).toHaveBeenCalledWith({ image: { base64: 'bWU=', mediaType: 'image/jpeg' }, styleId: style.id })
    expect(s.images()).toContain(`data:image/png;base64,gen-${style.id}`)
    expect(s.text()).toContain(style.blurb)

    await s.press(exact(other.label))
    await s.press(exact(style.label))
    expect(tryOnStyle).toHaveBeenCalledTimes(2)
  })

  it('compares with the original while held', async () => {
    vi.mocked(tryOnStyle).mockResolvedValue(generated(style.id) as never)
    const s = await withPhoto()
    await s.press(exact(style.label))
    const hold = s.button('Hold to compare')
    await act(async () => { hold.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(s.images()).toContain('file:///me.jpg')
    expect(s.text()).toContain('Original')
    await act(async () => { hold.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })) })
    expect(s.images()).toContain(`data:image/png;base64,gen-${style.id}`)
  })

  it('auto-runs a style passed in ?styleId= once the photo arrives', async () => {
    setParams({ styleId: other.id })
    vi.mocked(tryOnStyle).mockResolvedValue(generated(other.id) as never)
    const { default: TryOn } = await import('@/app/ai/tryon')
    const s = await renderScreen(<TryOn />)
    expect(s.text()).toContain(`Ready to preview ${other.label}`)
    await s.press('Add a photo')
    await pressAlertButton(alert, 'Choose from Library')
    expect(tryOnStyle).toHaveBeenCalledWith(expect.objectContaining({ styleId: other.id }))
  })

  it('shows errors with a retry', async () => {
    vi.mocked(tryOnStyle).mockRejectedValueOnce(new Error("Couldn't generate a preview")).mockResolvedValueOnce(generated(style.id) as never)
    const s = await withPhoto()
    await s.press(exact(style.label))
    expect(s.text()).toContain("Couldn't generate a preview")
    await s.press('Retry')
    expect(tryOnStyle).toHaveBeenCalledTimes(2)
    expect(s.images()).toContain(`data:image/png;base64,gen-${style.id}`)
  })

  it('shares the generated image and books a stylist for that style', async () => {
    vi.mocked(tryOnStyle).mockResolvedValue(generated(style.id) as never)
    const s = await withPhoto()
    await s.press(exact(style.label))
    await s.press(/^Share$/)
    expect(writeAsStringAsync).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^file:///cache/cutty-tryon-${style.id}-\\d+\\.png$`)), `gen-${style.id}`, { encoding: 'base64' })
    expect(shareAsync).toHaveBeenCalledWith(expect.any(String), { mimeType: 'image/png', dialogTitle: 'Share your try-on' })

    isAvailableAsync.mockResolvedValueOnce(false)
    await s.press(/^Share$/)
    expect(alert).toHaveBeenLastCalledWith('Sharing unavailable', expect.any(String))

    await s.press('Book this style')
    expect(router.push).toHaveBeenCalledWith(`/booking/new?style=${style.id}`)
  })
})
