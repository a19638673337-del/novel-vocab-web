/** Only explicitly packaged member resources may cross this boundary. */
export async function serveMemberResource(request, env, resources, authorize) {
 const path=new URL(request.url).pathname;
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
 if(!Object.hasOwn(resources,path))return new Response('Not found',{status:404,headers});
 try {await authorize(request,env);} catch(error) {
  if(error instanceof Response){const response=new Response(error.body,{status:error.status,headers:error.headers});for(const [key,value] of Object.entries(headers))response.headers.set(key,value);return response;}
  return new Response('暂时无法验证账号，请稍后重试。',{status:503,headers});
 }
 const resource=resources[path];headers['Content-Type']=resource.type;
 const bytes=Uint8Array.from(atob(resource.body),c=>c.charCodeAt(0));
 headers['Content-Length']=String(bytes.length);
 return new Response(request.method==='HEAD'?null:bytes,{headers});
}
