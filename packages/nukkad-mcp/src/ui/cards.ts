/**
 * MCP Apps views. Each is a self contained HTML document served as a ui://
 * resource with mime type text/html;profile=mcp-app. The host renders it in a
 * sandboxed iframe and pushes the tool result in over postMessage JSON-RPC.
 */
export const MCP_APP_MIME = 'text/html;profile=mcp-app';

const shell = (title: string, render: string) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{--bg:#0a0a0a;--line:#232323;--mute:#8a8a8a;--fg:#fff;--red:#e5484d;--green:#30a46c}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.card{border:1px solid var(--line);border-radius:14px;padding:18px 18px 16px;background:#0a0a0a}
.hd{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.ttl{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.big{font-size:22px;font-weight:650;letter-spacing:-.01em}
.pill{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;border:1px solid var(--line);color:var(--mute);white-space:nowrap}
.pill.g{color:var(--green);border-color:rgba(48,164,108,.45);background:rgba(48,164,108,.08)}
.pill.r{color:var(--red);border-color:rgba(229,72,77,.45);background:rgba(229,72,77,.08)}
.grp{border-top:1px solid var(--line);padding:12px 0 4px}
.grp:first-of-type{border-top:0;padding-top:0}
.gh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;font-weight:600}
.row{display:grid;grid-template-columns:1fr 44px 72px;gap:8px;padding:4px 0;color:#d6d6d6;font-variant-numeric:tabular-nums}
.row .q{color:var(--mute);text-align:right}.row .p{text-align:right}
.sub{margin:10px 0 2px;padding:10px 12px;border-radius:10px;border:1px solid rgba(229,72,77,.35);background:rgba(229,72,77,.06);font-size:13px}
.sub b{color:var(--fg)}.sub .x{color:var(--red);font-weight:600;margin-right:6px}
.tot{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--line);margin-top:12px;padding-top:12px}
.tot .v{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0 4px}
.st{height:4px;border-radius:4px;background:var(--line)}.st.on{background:var(--green)}
.lbls{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:11px;color:var(--mute)}
.lbls .on{color:var(--fg)}
.mute{color:var(--mute)}.g{color:var(--green)}.r{color:var(--red)}
.bar{height:6px;border-radius:6px;background:var(--line);overflow:hidden;margin:8px 0 6px}.bar i{display:block;height:100%;background:var(--green)}
.bar i.hi{background:var(--red)}
.ent{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:#cfcfcf;font-variant-numeric:tabular-nums}
</style></head><body><div id="root" class="card"><div class="mute">Loading</div></div>
<script>
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr=n=>'₹'+Math.round(n||0).toLocaleString('en-IN');
function size(){parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:document.documentElement.scrollHeight}},'*')}
function show(result){const d=(result&&result.structuredContent)||result||{};$('#root').innerHTML=render(d);size()}
function render(d){${render}}
window.addEventListener('message',e=>{const m=e.data||{};
 if(m.method==='ui/notifications/tool-result')show(m.params);
 if(m.id===1&&m.result){parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized'},'*')}});
parent.postMessage({jsonrpc:'2.0',id:1,method:'ui/initialize',params:{protocolVersion:'2025-11-25',appInfo:{name:'${title}',version:'1.0.0'},appCapabilities:{}}},'*');
new ResizeObserver(size).observe(document.body);
</script></body></html>`;

export const cartCard = shell('Nukkad cart', `
 const subs=(d.substitutions||[]).map(s=>'<div class="sub"><span class="x">Swapped</span><b>'+esc(s.original)+'</b> is short, only '+esc(s.originalStock)+' left. Using <b>'+esc(s.substitute)+'</b> from '+esc(s.substituteShop)+'.</div>').join('');
 const groups=(d.byShop||[]).map(g=>'<div class="grp"><div class="gh"><span>'+esc(g.shopName)+'</span><span class="mute">'+inr(g.subtotal)+'</span></div>'+
   g.items.map(i=>'<div class="row"><span>'+esc(i.name)+'</span><span class="q">x'+i.quantity+'</span><span class="p">'+inr(i.lineTotal)+'</span></div>').join('')+'</div>').join('');
 const ok=d.allAvailable!==false;
 return '<div class="hd"><div><div class="ttl">Cart</div><div class="big">'+(d.byShop||[]).length+' shops, '+(d.itemCount||0)+' items</div></div>'+
  '<span class="pill '+(d.substitutions&&d.substitutions.length?'r':'g')+'">'+esc(d.note||'Ready')+'</span></div>'+groups+subs+
  '<div class="tot"><span class="mute">Total</span><span class="v">'+inr(d.total)+'</span></div>';
`);

export const orderTrackerCard = shell('Nukkad order tracker', `
 const flow=['pending','accepted','ready','delivered'];const names=['Placed','Accepted','Packed','Delivered'];
 const os=(d.orders||[]).map(o=>{const k=Math.max(0,flow.indexOf(o.status));
  return '<div class="grp"><div class="gh"><span>'+esc(o.shopName)+' <span class="mute">'+esc(o.orderId)+'</span></span><span>'+inr(o.total)+'</span></div>'+
  '<div class="mute" style="font-size:13px">'+o.itemCount+' items, '+(o.paymentMethod==='khata'?'on khata':esc(o.paymentMethod))+(o.deliverBy?', for '+esc(o.deliverBy):'')+'</div>'+
  '<div class="steps">'+flow.map((_,i)=>'<div class="st '+(i<=k?'on':'')+'"></div>').join('')+'</div>'+
  '<div class="lbls">'+names.map((n,i)=>'<span class="'+(i<=k?'on':'')+'">'+n+'</span>').join('')+'</div></div>'}).join('');
 return '<div class="hd"><div><div class="ttl">Orders</div><div class="big">'+(d.count||0)+' order'+(d.count===1?'':'s')+' placed</div></div><span class="pill g">Live</span></div>'+os+
  '<div class="tot"><span class="mute">Total</span><span class="v">'+inr(d.total)+'</span></div>';
`);

export const khataCard = shell('Nukkad khata', `
 const acc=(d.accounts||[]).map(a=>{const pct=Math.min(100,Math.round(a.due/a.creditLimit*100));
  return '<div class="grp"><div class="gh"><span>'+esc(a.shopName)+'</span><span>'+inr(a.due)+' <span class="mute">due</span></span></div>'+
  '<div class="bar"><i class="'+(pct>80?'hi':'')+'" style="width:'+Math.max(2,pct)+'%"></i></div>'+
  '<div class="mute" style="font-size:12px;margin-bottom:6px">'+inr(a.availableCredit)+' credit left of '+inr(a.creditLimit)+'</div>'+
  (a.entries||[]).slice(0,3).map(e=>'<div class="ent"><span>'+esc(e.description)+'</span><span class="'+(e.type==='credit'?'g':'r')+'">'+(e.type==='credit'?'+':'-')+inr(e.amount)+'</span></div>').join('')+'</div>'}).join('');
 return '<div class="hd"><div><div class="ttl">Khata</div><div class="big">'+inr(d.totalDue)+' due</div></div><span class="pill '+(d.totalDue>0?'r':'g')+'">'+(d.accounts||[]).length+' shops</span></div>'+acc;
`);

export const UI_RESOURCES = [
  { uri: 'ui://nukkad/cart', name: 'Cart', description: 'Cart grouped by shop with substitutions and total', html: cartCard },
  { uri: 'ui://nukkad/order-tracker', name: 'Order tracker', description: 'Live order status per shop', html: orderTrackerCard },
  { uri: 'ui://nukkad/khata', name: 'Khata ledger', description: 'Store credit due, limits and recent entries', html: khataCard },
];
