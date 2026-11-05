import { shell } from '../server/generated-shell.mjs';
export const dynamic='force-dynamic';
export function GET(){return new Response(shell,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});}
