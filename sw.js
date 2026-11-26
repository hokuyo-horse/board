/* 牧場 治療・直検ボード — 画面そのものをこの端末に残しておくための仕組み。
   これがあると、電波がなくてもアプリを開けます。

   ・index.html は「まずネット、だめならこの端末の控え」。
     こうすると、更新したときに次に開いた時点で新しくなります。
   ・それ以外（アイコン、Firebase の部品）は「まずこの端末の控え」。
   ・Firestore との通信（googleapis.com）には一切手を出しません。 */

var CACHE = "board-v2-12";

var ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      /* 1つでも取れないと全部失敗してしまうので、1つずつ入れる */
      return Promise.all(ASSETS.map(function(u){
        return c.add(new Request(u, { cache: "reload" })).catch(function(){ });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return (k === CACHE) ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function putInCache(req, res){
  if(!res || !res.ok) return;
  var copy = res.clone();
  caches.open(CACHE).then(function(c){ c.put(req, copy); });
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }

  /* データのやり取りには触らない（Firestore が自分で面倒をみる） */
  if(url.hostname.indexOf("googleapis.com") >= 0 ||
     url.hostname.indexOf("firebaseio.com") >= 0 ||
     url.hostname.indexOf("firebaseapp.com") >= 0) return;

  var mine = (url.origin === self.location.origin);
  var vendor = (url.hostname === "www.gstatic.com");
  if(!mine && !vendor) return;

  var isPage = (req.mode === "navigate") ||
               (mine && /\.html$/.test(url.pathname)) ||
               (mine && url.pathname.slice(-1) === "/");

  if(isPage){
    /* まずネット。4秒で返ってこなければ控えを出す */
    e.respondWith(new Promise(function(resolve){
      var done = false;
      var timer = setTimeout(function(){
        if(done) return;
        caches.match(req, { ignoreSearch: true }).then(function(hit){
          if(hit && !done){ done = true; resolve(hit); }
        });
      }, 4000);
      fetch(req).then(function(res){
        clearTimeout(timer);
        putInCache(req, res);
        if(!done){ done = true; resolve(res); }
      }).catch(function(){
        clearTimeout(timer);
        caches.match(req, { ignoreSearch: true }).then(function(hit){
          if(done) return;
          done = true;
          resolve(hit || new Response(
            "<meta charset=\"utf-8\"><p style=\"font-family:sans-serif;padding:24px\">" +
            "電波がないため開けませんでした。電波の入る場所でもう一度お試しください。</p>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          ));
        });
      });
    }));
    return;
  }

  /* それ以外はまず控えから。裏で新しいものを取り直しておく */
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        putInCache(req, res);
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
