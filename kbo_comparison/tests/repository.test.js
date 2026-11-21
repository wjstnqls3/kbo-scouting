const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../repository.js'),'utf8');
function repository(protocol,fetch){
 const context={location:{protocol},fetch,battingData:[{Id:'bundled'}],battingMetadata:{packaged_at:'fixture'}};
 vm.runInNewContext(script,context);return context.KBORepository;
}
test('파일 직접 열기와 API 없는 정적 호스팅은 동봉 자료를 사용',async()=>{
 const local=await repository('file:',()=>{throw Error('호출 금지');}).load();
 assert.equal(local.records[0].Id,'bundled');
 for(const status of [404,405]){
  const data=await repository('https:',async()=>({ok:false,status})).load();
  assert.equal(data.records[0].Id,'bundled');assert.equal(data.metadata.packaged_at,'fixture');
 }
});
test('API가 있으면 API 자료 사용, 서버 장애와 잘못된 응답은 숨기지 않음',async()=>{
 const data=await repository('http:',async url=>({ok:true,status:200,json:async()=>url==='api/players'?[{Id:'live'}]:{original_source:'fixture'}})).load();
 assert.equal(data.records[0].Id,'live');assert.equal(data.metadata.original_source,'fixture');
 await assert.rejects(repository('http:',async()=>({ok:false,status:500})).load(),/API 요청 실패/);
 await assert.rejects(repository('http:',async()=>({ok:true,status:200,json:async()=>({error:'bad shape'})})).load(),/선수 기록/);
 await assert.rejects(repository('http:',async()=>{throw Error('네트워크 장애');}).load(),/네트워크 장애/);
});
