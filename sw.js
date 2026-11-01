/* 最小限のサービスワーカー。Androidで「アプリをインストール」を出すために必要。
   中身はGoogle側にあるので、ここではキャッシュしない。 */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(){ /* 素通し */ });
