// HUB-05 renewal approver endpoint: all Auth/DB responses are MOCKED; no network.
import assert from "node:assert/strict";
import type postgres from "npm:postgres@3.4.7";
import { hubCatalogRenewalApprovalHandler } from "../functions/hub-catalog-renew-approve/handler.ts";

const origin = "https://dfhjfajbmnsgrklhqtjk.supabase.co";
const approver = "e0000000-0000-4000-8000-000000000001";
const subject = "e0000000-0000-4000-8000-000000000002";
const session = "e1000000-0000-4000-8000-000000000001";
const ref = "LEVIA-HUB05R-APPROVERQA0001";

function setup() {
  Deno.env.delete("LEVIA_DB_URL");
  Deno.env.set("SUPABASE_URL",origin);
  Deno.env.set("SUPABASE_PUBLISHABLE_KEY","sb_publishable_synthetic_not_secret");
  Deno.env.set("SUPABASE_PUBLISHABLE_KEYS","{}");
  Deno.env.set("SUPABASE_DB_URL","postgresql://postgres:MOCK@db.dfhjfajbmnsgrklhqtjk.supabase.co:5432/postgres");
}
function jwt() {
  const encode=(x:unknown)=>btoa(JSON.stringify(x)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
  return encode({alg:"HS256",typ:"JWT"})+"."+
    encode({sub:approver,session_id:session,exp:Math.floor(Date.now()/1000)+900})+
    ".SYNTHETIC";
}
function validUntil(){return new Date(Date.now()+2*24*3600*1000).toISOString().replace(/\.\d{3}Z$/,"Z")}
const input=()=>({action:"approve-renewal",requestRef:ref,subject,validUntil:validUntil()});
function req(payload:unknown,token=true,method="POST"){
  return new Request(origin+"/functions/v1/hub-catalog-renew-approve",{
    method,headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+jwt()}:{})},
    ...(method==="POST"?{body:JSON.stringify(payload)}:{})
  });
}
const auth=(code=200):typeof fetch=>async()=>new Response(code===200?JSON.stringify({id:approver}):"{}",{status:code});
function db(errorCode?:string){
  const calls:{sql:string;args:unknown[]}[]=[];
  const tx={unsafe:async(sql:string,args:unknown[]=[])=>{
    calls.push({sql,args});
    if(errorCode)throw Object.assign(new Error("MOCK policy denied"),{code:errorCode});
    return [];
  }};
  const driver={begin:async(fn:(tx:typeof tx)=>Promise<unknown>)=>fn(tx),end:async()=>undefined};
  return {connect:(()=>driver) as unknown as typeof postgres,calls};
}
Deno.test("MOCK independent renewal approval rejects GET and missing bearer",async()=>{
  setup();const mock=db();
  assert.equal((await hubCatalogRenewalApprovalHandler(req(input(),true,"GET"),{connect:mock.connect,fetcher:auth()})).status,405);
  assert.equal((await hubCatalogRenewalApprovalHandler(req(input(),false),{connect:mock.connect,fetcher:auth()})).status,401);
  assert.equal(mock.calls.length,0);
});
Deno.test("MOCK Auth rejects invalid token before any DB access",async()=>{
  setup();const mock=db();
  const res=await hubCatalogRenewalApprovalHandler(req(input()),{connect:mock.connect,fetcher:auth(401)});
  assert.equal(res.status,401);assert.equal(mock.calls.length,0);
});
Deno.test("MOCK invalid payload cannot insert an independent approval",async()=>{
  setup();const mock=db();
  for(const bad of [
    {action:"renew-grants",requestRef:ref,subject,validUntil:validUntil()},
    {...input(),subject:approver,extra:"forged"}, // rejects extra parameter
    {...input(),requestRef:"OWNER-BOGUS"},
    {...input(),validUntil:new Date(Date.now()+9*24*3600*1000).toISOString().replace(/\.\d{3}Z$/,"Z")},
    {...input(),subject:"invalid"},
  ]){
    const res=await hubCatalogRenewalApprovalHandler(req(bad),{connect:mock.connect,fetcher:auth()});
    assert.equal(res.status,400);
  }
  assert.equal(mock.calls.length,0);
});
Deno.test("MOCK verified independent approval records ONLY approval, never grants",async()=>{
  setup();const mock=db();
  const res=await hubCatalogRenewalApprovalHandler(req(input()),{connect:mock.connect,fetcher:auth()});
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,approvalRecorded:true});
  assert.equal(mock.calls.length,1);
  assert.match(mock.calls[0].sql,/hub_private\.approve_catalog_renewal/);
  assert.deepEqual(mock.calls[0].args.slice(0,4),[approver,session,subject,ref]);
  assert.equal(mock.calls.some(x=>/insert into hub_private.permission_grants/.test(x.sql)),false);
});
Deno.test("MOCK DB denies different approver or inactive session",async()=>{
  setup();const mock=db("42501");
  const res=await hubCatalogRenewalApprovalHandler(req(input()),{connect:mock.connect,fetcher:auth()});
  assert.equal(res.status,403);
  assert.deepEqual(await res.json(),{ok:false});
});
Deno.test("MOCK duplicate request requires new approval ref; no auto-renew",async()=>{
  setup();const mock=db("23505");
  const res=await hubCatalogRenewalApprovalHandler(req(input()),{connect:mock.connect,fetcher:auth()});
  assert.equal(res.status,409);
});
Deno.test("MOCK configuration missing refuses approval without attempting SQL",async()=>{
  setup();Deno.env.delete("SUPABASE_DB_URL");
  const mock=db();
  const res=await hubCatalogRenewalApprovalHandler(req(input()),{connect:mock.connect,fetcher:auth()});
  assert.equal(res.status,503);
  assert.equal(mock.calls.length,0);
  setup();
});
