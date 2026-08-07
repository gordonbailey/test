/* Guide embeds, inside a sandboxed iframe with no allow-same-origin.
 *
 *   node analysis/report/qa/serve.js &   # serves the real report.html, read fresh
 *   node analysis/report/qa/guides.js
 *
 * The two guides are base64 payloads hydrated into srcdoc iframes, which is the
 * one part of the page that cannot be tested from file:// -- a sandboxed frame
 * refuses to load one. Checks each guide mounts, styles itself, and still
 * responds to its own navigation two frames deep.
 *
 * The nav target is deliberately NOT the guide's default view: clicking the
 * already-open tab changes nothing, and the test would pass on a dead frame.
 */
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:1440,height:1000}});
  const errs=[],cwarn=[];
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message.slice(0,140)));
  p.on('console',m=>{if(m.type()==='error')cwarn.push(m.text().slice(0,140))});
  // run inside a sandboxed iframe without allow-same-origin, like the artifact host
      await p.goto('http://127.0.0.1:8199/');
  await p.waitForTimeout(1500);
  const shell=p.frames().find(f=>f.parentFrame()===p.mainFrame());
  const out={sandboxed:!!shell,guides:[]};
  for (const [id,firstBtn] of [['guide-dataarch','System map'],['guide-nonfunc','Requirements']]){
    await shell.evaluate(i=>location.hash='#/'+i,id);
    await shell.waitForTimeout(2500);
    const box=await shell.$eval(`[data-view="${id}"] .gembed`,e=>({loaded:e.dataset.loaded,
      hasFrame:!!e.querySelector('iframe.gframe'),loaderGone:!e.querySelector('.gload'),
      h:Math.round(e.getBoundingClientRect().height)}));
    // reach into the guide's own document
    const gf=p.frames().filter(f=>f.parentFrame()===shell);
    const g=gf[gf.length-1];
    let inner={};
    if(g){
      inner.title=await g.title().catch(()=>'?');
      inner.bodyText=(await g.evaluate(()=>document.body.innerText.slice(0,60)).catch(()=>'')).replace(/\n/g,' ');
      inner.navButtons=await g.evaluate(()=>[...document.querySelectorAll('button')].length).catch(()=>0);
      inner.styled=await g.evaluate(()=>getComputedStyle(document.body).backgroundColor).catch(()=>'?');
      // click a nav button and confirm the view changes
      const before=await g.evaluate(()=>document.body.innerText.length).catch(()=>0);
      await g.click(`text=${firstBtn}`).catch(e=>inner.clickErr=e.message.slice(0,60));
      await shell.waitForTimeout(700);
      const after=await g.evaluate(()=>document.body.innerText.length).catch(()=>0);
      inner.interactive = before!==after;
      inner.before=before; inner.after=after;
    }
    out.guides.push({id,...box,...inner});
  }
  out.pageErrors=errs; out.consoleErrors=cwarn.slice(0,6);
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
