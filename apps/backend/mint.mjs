const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY;
const H={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
const link=await (await fetch(`${base}/auth/v1/admin/generate_link`,{method:'POST',headers:H,body:JSON.stringify({type:'magiclink',email:process.argv[2],should_create_user:true})})).json();
const ver=await (await fetch(`${base}/auth/v1/verify`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({type:link.verification_type||'magiclink',token_hash:link.hashed_token})})).json();
console.log(ver.access_token||'FAILED');
