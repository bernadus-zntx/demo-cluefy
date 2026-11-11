// Generate the static Sales entry from the existing JSX and CSS, not a second design.
import { readFile, writeFile } from 'node:fs/promises';
async function output(path, data) {
  const url = new URL(path, import.meta.url);
  if (process.argv.includes('--check')) {
    const current = await readFile(url);
    if (!current.equals(Buffer.from(data))) throw Error(`Generated asset stale: ${path}`);
  } else await writeFile(url, data);
}
const root = new URL('../', import.meta.url);
const page = await readFile(new URL('app/page.tsx', root), 'utf8');
let login = page.match(/function Login\([\s\S]*?  return (.*?)\n}/)?.[1];
if (!login) throw Error('Existing Login markup not found; review source changes.');
const replacements = [
  ['<div className="login-page">', '<div className="login-page" id="demo-login">'],
  ['<form onSubmit={e=>{e.preventDefault();onLogin(account,role)}}>', '<form id="login-form">'],
  ['value={account} onChange={e=>setAccount(e.target.value)}', 'id="organization"'],
  ['{account==="government"&&<label', '<label id="role-field"'],
  ['</small></label>}', '</small></label>'],
  ['value={role} onChange={e=>setRole(e.target.value)}', 'id="role"'],
  ['defaultValue={account==="government"?"admin@badung.go.id":account==="validation"?"validation@olx.co.id":"admin@cluebeauty.id"} key={account}', 'id="email" value="admin@badung.go.id"'],
  ['defaultValue="cluefy-demo"', 'value="cluefy-demo"'],
  ['defaultChecked', 'checked'],
  ['Live data mode — dashboard tidak menampilkan fallback dummy.', 'Login simulasi — belum memverifikasi identitas; akses data production terkunci.'],
];
for (const [from, to] of replacements) {
  if (!login.includes(from)) throw Error(`Existing login changed: missing ${from}`);
  login = login.replace(from, to);
}
login = login.replaceAll('className=', 'class=');
if (/[{}]/.test(login)) throw Error('Unhandled JSX in existing Login.');
const template = await readFile(new URL('public/shell.html', import.meta.url), 'utf8');
await output('public/index.html', template.replace('<!-- EXISTING_LOGIN -->', login));
const css = await readFile(new URL('app/globals.css', root), 'utf8');
const lines = css.split('\n');
const selected = lines.filter(line => line.startsWith(':root{') || line.startsWith('.login-page{') || line.startsWith('@media(max-width:850px){.login-page') || line.startsWith('.brand-image img,.login-logo-crop img'));
if (selected.length !== 4) throw Error('Existing login CSS changed; review extraction.');
await output('public/existing-login.css', '/* Generated from app/globals.css; run node sales/sync-existing-login.mjs */\n' + selected.join('\n') + '\n');
await output('public/cluefy-icon-exact.png', await readFile(new URL('public/cluefy-icon-exact.png', root)));
