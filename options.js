'use strict';
const status=document.getElementById('status');
const key=document.getElementById('key');
chrome.storage.local.get('keepaKey').then(data=>{if(data.keepaKey){key.placeholder='A key is saved. Enter a replacement to change it.';status.textContent='Keepa key saved in this Chrome profile.';}});
document.getElementById('settings').addEventListener('submit',async event=>{
  event.preventDefault();
  const value=key.value.trim();
  if(!value){status.textContent='Enter a Keepa API key, or continue using the free Amazon signal.';return;}
  if(value.length<10 || /\s/.test(value)){status.textContent='That does not look like a valid API key.';return;}
  try{
    const granted=await chrome.permissions.request({origins:['https://api.keepa.com/*']});
    if(!granted){status.textContent='Keepa access was not enabled. The free Amazon signal remains available.';return;}
    await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
    await chrome.storage.local.set({keepaKey:value,keepaCache:{}});
    key.value='';key.placeholder='A key is saved. Enter a replacement to change it.';
    status.textContent='Saved. Use Check Keepa data on a product to verify the key and retrieve its signal.';
  }catch{status.textContent='Could not save settings. Please reopen this page and try again.';}
});
document.getElementById('remove').addEventListener('click',async()=>{
  await chrome.storage.local.remove(['keepaKey','keepaCache']);
  await chrome.permissions.remove({origins:['https://api.keepa.com/*']});
  key.value='';key.placeholder='Leave empty to use the free version';status.textContent='Key, cache, and optional Keepa access removed. Free mode is active.';
});
