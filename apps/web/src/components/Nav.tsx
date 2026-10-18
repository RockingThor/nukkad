import Link from 'next/link';

export default function Nav({ active }: { active: 'home' | 'alexa' | 'shop' }) {
  return (
    <nav className="nav">
      <Link href="/" className="brand"><i />Nukkad</Link>
      <div className="navlinks">
        <Link href="/" className={active === 'home' ? 'on' : ''}>Overview</Link>
        <Link href="/alexa" className={active === 'alexa' ? 'on' : ''}>Alexa+ simulator</Link>
        <Link href="/shop" className={active === 'shop' ? 'on' : ''}>Shop console</Link>
      </div>
    </nav>
  );
}
