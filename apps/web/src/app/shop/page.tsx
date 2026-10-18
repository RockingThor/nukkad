'use client';
import { useEffect, useState, useCallback } from 'react';
import Nav from '@/components/Nav';
import s from './shop.module.css';

const SHOPS = [
  { id: 'shop-kirana-1', label: 'Kirana' },
  { id: 'shop-bakery-1', label: 'Bakery' },
  { id: 'shop-dairy-1', label: 'Dairy' },
];
const FLOW = ['pending', 'accepted', 'ready', 'delivered'] as const;
const LABEL: Record<string, string> = { pending: 'New', accepted: 'Accepted', ready: 'Packed', delivered: 'Delivered', cancelled: 'Cancelled' };
const NEXT: Record<string, { to: string; label: string }> = {
  pending: { to: 'accepted', label: 'Accept order' }, accepted: { to: 'ready', label: 'Mark packed' }, ready: { to: 'delivered', label: 'Mark delivered' },
};
const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
};

export default function ShopPage() {
  const [shopId, setShopId] = useState(SHOPS[0].id);
  const [data, setData] = useState<any>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [known, setKnown] = useState<Set<string> | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/shop/${shopId}`, { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    setData(d);
    setKnown((k) => {
      const ids = new Set<string>(d.orders.map((o: any) => o.id));
      if (k) { const n = [...ids].filter((i) => !k.has(i)); if (n.length) setFresh((f) => new Set([...f, ...n])); }
      return ids;
    });
  }, [shopId]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('id');
    if (q && SHOPS.some((x) => x.id === q)) setShopId(q);
  }, []);
  useEffect(() => { setData(null); setKnown(null); setFresh(new Set()); }, [shopId]);
  useEffect(() => { load(); const t = setInterval(load, 2500); return () => clearInterval(t); }, [load]);

  const advance = async (id: string, to: string) => {
    await fetch(`/api/orders/${id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: to }) });
    setFresh((f) => { const n = new Set(f); n.delete(id); return n; });
    load();
  };

  const open = data?.orders.filter((o: any) => o.status !== 'delivered' && o.status !== 'cancelled') ?? [];
  const done = data?.orders.filter((o: any) => o.status === 'delivered') ?? [];

  return (
    <div className={s.page}>
      <Nav active="shop" />
      <div className={s.wrap}>
        <header className={s.head}>
          <div>
            <div className={s.kicker}>Shop console</div>
            <h1>{data?.shop.name ?? ' '}</h1>
            <div className={s.sub}>{data ? `${data.shop.address}. Open ${data.shop.openHours}` : ' '}</div>
          </div>
          <div className={s.tabs}>
            {SHOPS.map((x) => <button key={x.id} className={x.id === shopId ? s.tabOn : ''} onClick={() => setShopId(x.id)}>{x.label}</button>)}
          </div>
        </header>

        <div className={s.stats}>
          <div><span>Orders today</span><b>{data?.stats.ordersToday ?? 0}</b></div>
          <div><span>Sales today</span><b>{inr(data?.stats.revenueToday)}</b></div>
          <div><span>Open orders</span><b className={open.length ? s.g : ''}>{data?.stats.open ?? 0}</b></div>
          <div><span>On khata today</span><b>{inr(data?.stats.onKhata)}</b></div>
        </div>

        <div className={s.grid}>
          <section>
            <div className={s.secHead}><h2>Live orders</h2><span className="pill g live"><span className="dot" />From Alexa+</span></div>
            <div className={s.list}>
              {open.map((o: any) => {
                const k = FLOW.indexOf(o.status);
                return (
                  <article key={o.id} className={`${s.order} ${fresh.has(o.id) ? s.fresh : ''}`}>
                    <div className={s.oTop}>
                      <div>
                        <div className={s.oId}>{o.id}{fresh.has(o.id) && <span className="pill r">New</span>}</div>
                        <div className={s.oWho}>{o.customerName ?? 'Customer'}, {ago(o.createdAt)}{o.deliverBy ? `, deliver ${o.deliverBy}` : ''}</div>
                      </div>
                      <div className={s.oAmt}>{inr(o.total)}<span className={`pill ${o.paymentMethod === 'khata' ? 'r' : ''}`}>{o.paymentMethod === 'khata' ? 'Khata' : o.paymentMethod.toUpperCase()}</span></div>
                    </div>
                    <ul className={s.items}>
                      {o.items.map((i: any) => <li key={i.productId}><span>{i.productName}</span><span>x{i.quantity}</span></li>)}
                    </ul>
                    <div className={s.oFoot}>
                      <div className={s.track}>{FLOW.map((f, i) => <span key={f} className={i <= k ? s.on : ''}>{LABEL[f]}</span>)}</div>
                      {NEXT[o.status] && <button className="btn pri" onClick={() => advance(o.id, NEXT[o.status].to)}>{NEXT[o.status].label}</button>}
                    </div>
                  </article>
                );
              })}
              {data && open.length === 0 && (
                <div className={s.calm}>
                  <b>All caught up.</b>
                  <span>New orders from Alexa+ appear here within seconds. Try the party order in the simulator.</span>
                </div>
              )}
            </div>
          </section>
          <aside className={s.side}>
            <div className={s.box}>
              <h3>Running low</h3>
              {(data?.lowStock ?? []).length ? data.lowStock.map((p: any) => (
                <div key={p.name} className={s.low}><span>{p.name}</span><span className={p.stock <= 3 ? s.r : ''}>{p.stock} {p.unit}</span></div>
              )) : <div className={s.low}><span>Stock is healthy</span><span className={s.g}>OK</span></div>}
            </div>
            <div className={s.box}>
              <h3>Delivered today</h3>
              {done.slice(0, 6).map((o: any) => (
                <div key={o.id} className={s.low}><span>{o.id} <em>{o.customerName}</em></span><span>{inr(o.total)}</span></div>
              ))}
              {!done.length && <div className={s.low}><span>Nothing delivered yet</span><span /></div>}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
