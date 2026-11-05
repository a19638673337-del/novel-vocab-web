import { env } from 'cloudflare:workers';
import { requireMember } from '../../server/auth.mjs';
import { serveMemberResource } from '../../server/member-resources.mjs';
import { resources } from '../../server/generated-resources.mjs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => serveMemberResource(request,env,resources,requireMember);
export const HEAD = GET;
