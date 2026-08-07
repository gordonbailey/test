/* Local host for the sandboxed-iframe tests: a page whose only content is a
 * sandboxed iframe pointing at report.html, matching the artifact's own
 * sandbox flags. Reads the built file on every request rather than copying it,
 * because a copy goes stale silently and the tests keep passing against it.
 *
 *   node analysis/report/qa/serve.js &
 */
const http=require('http'),fs=require('fs');
const R='/home/user/test/analysis/report/report.html';
http.createServer((q,s)=>{
  if(q.url.startsWith('/report')){s.writeHead(200,{'Content-Type':'text/html'});s.end(fs.readFileSync(R));}
  else if(q.url==='/'){s.writeHead(200,{'Content-Type':'text/html'});
    s.end(`<!doctype html><body style="margin:0"><iframe id="h"
      sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads"
      style="width:1440px;height:1000px;border:0" src="/report.html"></iframe></body>`);}
  else {s.writeHead(404);s.end();}
}).listen(8199,'127.0.0.1',()=>console.log('serving on 8199'));
