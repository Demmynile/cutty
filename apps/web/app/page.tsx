import { Nav } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { TextReveal } from '@/components/TextReveal'
import { FeatureScroll } from '@/components/FeatureScroll'
import { ZoomScene } from '@/components/ZoomScene'
import { StylesGallery } from '@/components/StylesGallery'
import { Bento } from '@/components/Bento'
import { ProSection } from '@/components/ProSection'
import { Waitlist } from '@/components/Waitlist'
import { Footer } from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <TextReveal />
        <FeatureScroll />
        <ZoomScene />
        <StylesGallery />
        <Bento />
        <ProSection />
        <Waitlist />
      </main>
      <Footer />
    </>
  )
}
