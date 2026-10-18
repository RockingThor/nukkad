import Link from 'next/link';
import Nav from '@/components/Nav';
import s from './home.module.css';

export default function Home() {
  return (
    <div>
      <Nav active="home" />
      <main className={s.wrap}>
        <section className={s.hero}>
          <span className="pill g"><span className="dot" />Built on MCP 2025-11-25</span>
          <h1>The corner store,<br />on Alexa+.</h1>
          <p>Big brands get Alexa+ integrations. The kirana down the road does not. Nukkad is one multi tenant MCP server that puts every independent shop on the street into Alexa+, with the usual order, party scaling, live stock and khata built in.</p>
          <div className={s.cta}>
            <Link href="/alexa" className="btn pri">Try the Alexa+ simulator</Link>
            <Link href="/shop" className="btn sec">Open the shop console</Link>
          </div>
        </section>

        <section className={s.quote}>
          <span className={s.say}>You say</span>
          <p>&ldquo;I&rsquo;m having six friends over on Saturday for chai and snacks. Get what I usually get, enough for everyone, and put it on my khata.&rdquo;</p>
          <div className={s.flow}>
            {['get_usual', 'build_cart x3', 'check_stock_and_substitute', 'place_order', 'khata_balance'].map((t, i) => (
              <span key={t}><b className="mono">{t}</b>{i < 4 && <i>→</i>}</span>
            ))}
          </div>
          <span className={s.say}>Three shops get an order. One item is short, so it is swapped. All of it lands on the khata.</span>
        </section>

        <section className={s.grid}>
          <div><h3>One server, every shop</h3><p>Shops join Nukkad, not Alexa. A kirana, a bakery and a dairy share one MCP endpoint, and one sentence can order from all three.</p></div>
          <div><h3>Khata, natively</h3><p>Store credit is how neighbourhood retail runs. Nukkad checks each shop&rsquo;s credit limit before it orders and writes every entry to the ledger.</p></div>
          <div><h3>MCP Apps cards</h3><p>Cart, order tracker and khata are ui:// views served by the MCP server and rendered by the host in a sandboxed frame.</p></div>
          <div><h3>Serverless on AWS</h3><p>Stateless Streamable HTTP on a Lambda Function URL with DynamoDB on demand. The adapter ships as <span className={s.nw}>mcp-lambda-kit</span>, MIT licensed.</p></div>
        </section>
      </main>
      <footer className={s.foot}>Nukkad. Demo data only. Shop names and people are fictional.</footer>
    </div>
  );
}
