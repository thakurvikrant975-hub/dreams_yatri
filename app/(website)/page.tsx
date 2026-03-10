export const revalidate = 1800 // ISR every 30 minutes
import Hero from "../components/home/hero";
import TrustSignals from "../components/home/trust";

//vercel fix

export default function Home() {

  return (
    <main>
      <Hero />
      <TrustSignals />
    </main>
  )
}
