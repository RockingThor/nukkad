import Link from 'next/link';

export default function Home() {
  return (
    <main className="container" style={{ padding: '4rem 1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 'bold' }}>
          Nukkad
        </h1>
        <p style={{ fontSize: '1.5rem', color: 'var(--color-light-gray)', marginBottom: '3rem' }}>
          The corner store, on Alexa+
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
          <Link
            href="/alexa"
            style={{
              padding: '1rem 2rem',
              background: 'var(--color-white)',
              color: 'var(--color-black)',
              borderRadius: '0.5rem',
              fontWeight: '600',
              display: 'inline-block',
            }}
          >
            Launch Simulated Alexa+
          </Link>
          <Link
            href="/shop/shop-kirana-1"
            style={{
              padding: '1rem 2rem',
              background: 'transparent',
              color: 'var(--color-white)',
              border: '2px solid var(--color-white)',
              borderRadius: '0.5rem',
              fontWeight: '600',
              display: 'inline-block',
            }}
          >
            Shop Console
          </Link>
        </div>

        <div style={{ borderTop: '1px solid var(--color-gray)', paddingTop: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>About</h2>
          <p style={{ color: 'var(--color-light-gray)', marginBottom: '1rem' }}>
            Nukkad brings independent corner stores to Alexa+. Whether it's a kirana in Bangalore,
            a bodega in Queens, or a home bakery down the street, Nukkad makes any shop voice-accessible.
          </p>
          <p style={{ color: 'var(--color-light-gray)', marginBottom: '1rem' }}>
            Order in English or Hinglish, track deliveries, manage khata (store credit), and support
            local businesses—all through voice.
          </p>
          <p style={{ color: 'var(--color-gray)', fontSize: '0.875rem', marginTop: '2rem' }}>
            Built for the Amazon "Build, Ship, Shape" Devpost hackathon, Alexa+ track.
          </p>
        </div>
      </div>
    </main>
  );
}
