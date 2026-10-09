import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../src/lib/store';
import {PATCH} from '../src/app/api/comments/bulk-decision/route';
const dir=mkdtempSync(join(tmpdir(),'bulk-'));
const path=join(dir,'test.db');
const oldPath=process.env.MODERATION_DB_PATH;
before(()=>{process.env.MODERATION_DB_PATH=path;});
after(()=>{if(oldPath===undefined) delete process.env.MODERATION_DB_PATH; else process.env.MODERATION_DB_PATH=oldPath;rmSync(dir,{recursive:true,force:true});});
const request=(body:unknown,origin='http://localhost')=>new Request('http://localhost/api/comments/bulk-decision',{method:'PATCH',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
for(const decision of ['approved','rejected'] as const) test('Toplu '+decision+' ilk öneriyi korur ve geçmişe kaydeder',async()=>{
 const store=openStore(path);
 const text=decision==='approved'?'Teşekkürler':'Sen aptalsın';
 const comments=[store.create(text),store.create(text)];store.close();
 const response=await PATCH(request({ids:comments.map(c=>c.id),decision}));
 assert.equal(response.status,200);
 const updated=await response.json();
 const reopened=openStore(path);
 try{for(const c of comments){const result=reopened.get(c.id)!;assert.equal(result.decision,decision);assert.equal(result.history.length,1);assert.deepEqual(result.assessment,c.assessment);assert.match(result.history[0].note,/toplu/);assert.deepEqual(updated.find((u:{id:string})=>u.id===c.id),result);}}finally{reopened.close();}
 assert.equal((await PATCH(request({ids:comments.map(c=>c.id),decision}))).status,409);
});
test('Karışık sonuç, inceleme, olmayan ve önceden karar verilen kayıt tüm işlemi durdurur',async()=>{
 const store=openStore(path);
 try{
 const pending=store.create('Teşekkürler');const bad=store.create('Sen aptalsın');const review=store.create('Tamina');const decided=store.create('Teşekkürler');store.decide(decided.id,'approved');
 for(const id of [bad.id,review.id,decided.id,'missing']){
   assert.equal((await PATCH(request({ids:[pending.id,id],decision:'approved'}))).status,409);
   assert.equal(store.get(pending.id)?.decision,null);assert.equal(store.get(pending.id)?.history.length,0);
 }
 }finally{store.close();}
});
test('Toplu API sınırları, yinelenen kimlik ve dış kaynak doğrulaması',async()=>{
 for(const ids of [[],['a','a'],[1],[''],Array.from({length:101},(_,i)=>String(i)),null])assert.equal((await PATCH(request({ids,decision:'approved'}))).status,400);
 assert.equal((await PATCH(request({ids:['a'],decision:'invalid'}))).status,400);
 assert.equal((await PATCH(request({ids:['a'],decision:'approved'},'https://example.com'))).status,403);
});
test('İkinci kayıt yazılamazsa ilk karar ve iki geçmiş kaydı da geri alınır',()=>{
 const store=openStore(path);
 const a=store.create('Teşekkürler');const b=store.create('Çok iyi');
 const db=new DatabaseSync(path);
 db.exec(`CREATE TRIGGER fail_bulk BEFORE UPDATE ON comments WHEN OLD.id = '${b.id}' BEGIN SELECT RAISE(ABORT, 'test'); END;`);
 try{assert.throws(()=>store.bulkDecide([a.id,b.id],'approved'));assert.deepEqual(store.get(a.id),a);assert.deepEqual(store.get(b.id),b);}finally{db.exec('DROP TRIGGER fail_bulk');db.close();store.close();}
});
