import { env } from 'cloudflare:workers';
import { handleAuth } from '../../../server/auth.mjs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleAuth(request, env);
export const POST = (request: Request) => handleAuth(request, env);
