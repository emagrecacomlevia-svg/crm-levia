/**
 * HUB-05 server-side catalog. Auth verifies the JWT, PostgreSQL verifies the
 * live session AND exact catalog scope. No public CORS or direct table grants.
 * Test-time dependency injection exists only in this unexposed handler module.
 */
import postgres from "npm:postgres@3.4.7";
import { edgeConfiguration, verifiedSessionId, boundedJson } from "../_shared/configuration.ts";

const actions = new Set(["snapshot","create-item","create-version","create-table",
  "add-price","select-table","create-campaign","link-campaign"]);
function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body,{status,headers:{"cache-control":"no-store"}});
}
const uuid=(v:unknown):v is string=>typeof v==="string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text=(v:unknown,min=1,max=160):v is string=>
  typeof v==="string" && v.trim().length>=min && v.trim().length<=max;
const day=(v:unknown):v is string=>{
  if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const d=new Date(v+"T00:00:00Z");
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
};
export function validCatalogInput(p:Record<string,unknown>):boolean{
  if(!actions.has(p.action as string))return false;
  switch(p.action){
  case "snapshot": return true;
  case "create-item":return typeof p.sku==="string"&&/^DEMO-[A-Z0-9-]{1,35}$/.test(p.sku);
  case "create-version":return uuid(p.itemId)&&text(p.name)&&text(p.presentation)&&
    text(p.segment)&&text(p.documentRef);
  case "create-table":return text(p.audience)&&day(p.validFrom)&&day(p.validUntil)&&
    p.validFrom<p.validUntil&&text(p.terms,5,500);
  case "add-price":return uuid(p.commercialVersionId)&&uuid(p.catalogVersionId)&&
    typeof p.amountMinor==="number"&&Number.isSafeInteger(p.amountMinor)&&
    p.amountMinor>0&&p.amountMinor<=999999999;
  case "select-table":return uuid(p.commercialVersionId)&&day(p.selectedOn)&&text(p.reason,15,500);
  case "create-campaign":return typeof p.code==="string"&&/^DEMO-[A-Z0-9-]{1,35}$/.test(p.code)&&
    text(p.name)&&text(p.purpose,5,500)&&["interno","instagram","facebook","tiktok"].includes(p.channel as string)&&
    day(p.startsOn)&&day(p.endsOn)&&p.startsOn<p.endsOn&&typeof p.utmCampaign==="string"&&
    /^demo-[a-z0-9-]{1,60}$/.test(p.utmCampaign);
  case "link-campaign":return uuid(p.campaignId)&&uuid(p.commercialVersionId)&&uuid(p.catalogVersionId);
  default:return false;
  }
}
// Static SQL strings. tx.unsafe uses positional bind arguments ($1...) and
// NEVER concatenates user text into SQL syntax.
const readQueries = {
  items:'select id::text as id,sku from hub_catalog_private.catalog_items order by sku',
  versions:'select id::text as id,item_id::text as "itemId",revision,name,presentation,segment,document_ref as "documentRef" from hub_catalog_private.catalog_versions order by item_id,revision',
  tables:'select id::text as id,revision,audience,currency,valid_from::text as "validFrom",valid_until::text as "validUntil",terms from hub_catalog_private.commercial_versions order by revision',
  prices:'select id::text as id,commercial_version_id::text as "commercialVersionId",catalog_version_id::text as "catalogVersionId",amount_minor as "amountMinor" from hub_catalog_private.price_items order by commercial_version_id,id',
  selections:'select s.id::text as id,s.commercial_version_id::text as "commercialVersionId",s.selected_on::text as "selectedOn",s.reason,s.decision_order as "decisionOrder",a.actor_snapshot::text as actor from hub_catalog_private.selections s left join hub_catalog_private.audit_events a on a.entity=$1 and a.object_id=s.id order by s.decision_order',
  campaigns:'select id::text as id,code,name,purpose,channel,starts_on::text as "startsOn",ends_on::text as "endsOn",utm_campaign as "utmCampaign" from hub_catalog_private.campaigns order by code',
  references:'select campaign_id::text as "campaignId",commercial_version_id::text as "commercialVersionId",catalog_version_id::text as "catalogVersionId" from hub_catalog_private.campaign_references order by campaign_id,id',
  audit:'select id::text as id,entity,object_id::text as "objectId",recorded_at::text as "recordedAt",actor_snapshot::text as actor,auth_session_id::text as "sessionId" from hub_catalog_private.audit_events order by recorded_at desc,id desc limit 500',
} as const;

export async function hubCatalogHandler(
 request:Request, dependencies:{fetcher?:typeof fetch;connect?:typeof postgres}={}
){
  if(request.method!=="POST")return reply(405,{ok:false});
  const bearer=request.headers.get("authorization")??"";
  if(!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer))return reply(401,{ok:false});
  const cfg=edgeConfiguration();
  if(!cfg)return reply(503,{ok:false});
  let p:Record<string,unknown>;
  try{
    const v:unknown=await boundedJson(request,8192);
    if(!v||typeof v!=="object"||Array.isArray(v))return reply(400,{ok:false});
    p=v as Record<string,unknown>;
  }catch(e){return reply(e instanceof RangeError?413:400,{ok:false});}
  if(!validCatalogInput(p))return reply(400,{ok:false});

  let actor:string;
  try{
    const auth=await (dependencies.fetcher??fetch)(cfg.authOrigin+"/auth/v1/user",{
      headers:{apikey:cfg.key,authorization:bearer},cache:"no-store",signal:AbortSignal.timeout(8000)
    });
    if(!auth.ok)return reply(401,{ok:false});
    const verified:unknown=await auth.json();
    actor=(verified as {id?:unknown})?.id as string;
    if(!uuid(actor))return reply(401,{ok:false});
  }catch{return reply(503,{ok:false});}
  const session=verifiedSessionId(bearer);
  if(!session)return reply(401,{ok:false});
  const params = p as Record<string, string | number>;
  const sql=(dependencies.connect??postgres)(cfg.rawUrl,{
    password:cfg.password,ssl:{rejectUnauthorized:true,...(cfg.ca?{ca:cfg.ca}:{})},
    max:1,prepare:false,connect_timeout:8,idle_timeout:3
  });
  try{
    const data=await sql.begin(async tx=>{
      const write=params.action!=="snapshot";
      if(write){
        await tx.unsafe("select id from auth.sessions where id=$1::uuid and user_id=$2::uuid for share",[session,actor]);
        await tx.unsafe("select auth_user_id from hub_private.admin_accounts where auth_user_id=$1::uuid for share",[actor]);
        await tx.unsafe("select id from hub_private.permission_grants where subject_user_id=$1::uuid for share",[actor]);
      }
      const cap=write?"catalog.write":"catalog.read";
      const a=await tx.unsafe("select hub_catalog_private.actor_has_access($1::uuid,$2::uuid,$3) as allowed",[actor,session,cap]);
      if(a[0]?.allowed!==true)throw Object.assign(new Error("Permission denied"),{code:"42501"});
      if(write){
        await tx.unsafe("select pg_catalog.set_config('levia.hub05_actor',$1,true)",[actor]);
        await tx.unsafe("select pg_catalog.set_config('levia.hub05_session',$1,true)",[session]);
        let result;
        switch(params.action){
        case "create-item":
          result=await tx.unsafe("insert into hub_catalog_private.catalog_items(sku) values($1) returning id",[params.sku]);break;
        case "create-version":
          await tx.unsafe("select id from hub_catalog_private.catalog_items where id=$1::uuid for update",[params.itemId]);
          result=await tx.unsafe("insert into hub_catalog_private.catalog_versions(item_id,revision,name,presentation,segment,document_ref) select $1::uuid,coalesce(max(revision),0)+1,$2,$3,$4,$5 from hub_catalog_private.catalog_versions where item_id=$1::uuid returning id",
            [params.itemId,params.name,params.presentation,params.segment,params.documentRef]);break;
        case "create-table":
          await tx.unsafe("select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('hub05-commercial-revision'))");
          result=await tx.unsafe("insert into hub_catalog_private.commercial_versions(revision,audience,valid_from,valid_until,terms) select coalesce(max(revision),0)+1,$1,$2::date,$3::date,$4 from hub_catalog_private.commercial_versions returning id",
            [params.audience,params.validFrom,params.validUntil,params.terms]);break;
        case "add-price":
          result=await tx.unsafe("insert into hub_catalog_private.price_items(commercial_version_id,catalog_version_id,item_id,amount_minor) select $1::uuid,v.id,v.item_id,$3::integer from hub_catalog_private.catalog_versions v where v.id=$2::uuid returning id",
            [params.commercialVersionId,params.catalogVersionId,params.amountMinor]);break;
        case "select-table":
          result=await tx.unsafe("insert into hub_catalog_private.selections(decision_order,commercial_version_id,selected_on,reason) values(0,$1::uuid,$2::date,$3) returning id",
            [params.commercialVersionId,params.selectedOn,params.reason]);break;
        case "create-campaign":
          result=await tx.unsafe("insert into hub_catalog_private.campaigns(code,name,purpose,channel,starts_on,ends_on,utm_campaign) values($1,$2,$3,$4,$5::date,$6::date,$7) returning id",
            [params.code,params.name,params.purpose,params.channel,params.startsOn,params.endsOn,params.utmCampaign]);break;
        case "link-campaign":
          result=await tx.unsafe("insert into hub_catalog_private.campaign_references(campaign_id,commercial_version_id,catalog_version_id) values($1::uuid,$2::uuid,$3::uuid) returning id",
            [params.campaignId,params.commercialVersionId,params.catalogVersionId]);break;
        }
        if(!result?.[0]?.id)throw Object.assign(new Error("No row inserted"),{code:"23503"});
        return {id:String(result[0].id)};
      }
      const items=await tx.unsafe(readQueries.items);
      const versions=await tx.unsafe(readQueries.versions);
      const tables=await tx.unsafe(readQueries.tables);
      const prices=await tx.unsafe(readQueries.prices);
      const selections=await tx.unsafe(readQueries.selections,["selections"]);
      const campaigns=await tx.unsafe(readQueries.campaigns);
      const references=await tx.unsafe(readQueries.references);
      const audit=await tx.unsafe(readQueries.audit);
      return {items,versions,tables,prices,selections,campaigns,references,audit};
    });
    return reply(200,{ok:true,...data});
  }catch(e){
    const code=(e as {code?:unknown})?.code;
    if(code==="42501")return reply(403,{ok:false});
    if(["23503","23505","23514","23502","22P02","22007"].includes(String(code)))
      return reply(409,{ok:false,message:"Dados duplicados, inválidos ou referências indisponíveis."});
    return reply(503,{ok:false});
  }finally{await sql.end({timeout:2});}
}
