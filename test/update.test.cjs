const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
const tick=()=>new Promise(setImmediate);
test('desktop reload hook saves intent before reloading',async()=>{
 const events=[];vm.runInNewContext(fs.readFileSync(path.join(root,'update.js'),'utf8'),{Date,chrome:{storage:{local:{set:async v=>{events.push(['save',v])}}},runtime:{reload:()=>events.push(['reload'])}},document:{getElementById:()=>({})}});await tick();assert.equal(events[0][0],'save');assert.equal(typeof events[0][1].reopenAfterUpdate,'number');assert.equal(events[1][0],'reload');
});
test('new worker reopens the desk once and clears pending update intent',async()=>{
 const data={reopenAfterUpdate:Date.now()},tabs=[],listeners={};const ctx={Date,URL,Map,AbortSignal,chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:()=>{}},onInstalled:{addListener:fn=>listeners.installed=fn},onStartup:{addListener:fn=>listeners.startup=fn}},storage:{local:{setAccessLevel:async()=>{},get:async()=>({...data}),remove:async k=>{delete data[k]}}},tabs:{create:async v=>tabs.push(v)}}};ctx.importScripts=()=>{};
 vm.runInNewContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),ctx);listeners.installed();await tick();assert.deepEqual(tabs.map(t=>t.url),['chrome-extension://test/sourcing.html?updated=1']);assert.equal(data.reopenAfterUpdate,undefined);
 vm.runInNewContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),{...ctx});listeners.startup();await tick();assert.equal(tabs.length,1);
});
