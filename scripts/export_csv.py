#!/usr/bin/env python3
import json, csv, urllib.request
headers={"User-Agent":"Mozilla/5.0","Referer":"https://music.163.com/"}
def fetch(url):
    import urllib.request, json
    req=urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

pid=784204124
j=fetch(f"https://music.163.com/api/v6/playlist/detail?id={pid}")
trackIds=j["playlist"]["trackIds"]
ids=[x["id"] for x in trackIds]
# 拉前200演示写入csv
songs=[]
for i in range(0, min(200,len(ids)), 200):
    chunk=ids[i:i+200]
    sj=fetch(f"https://music.163.com/api/song/detail?ids=[{','.join(map(str,chunk))}]")
    for s in sj["songs"]:
        songs.append({"id":s["id"], "name":s["name"], "artists":"/".join(a["name"] for a in s["artists"] or s["ar"] or []), "album":(s["album"] or s["al"] or {}).get("name",""), "dt":s.get("duration") or s.get("dt")})
with open("/tmp/playlist_784204124.csv","w",newline="",encoding="utf-8") as f:
    w=csv.DictWriter(f, fieldnames=["id","name","artists","album","dt"])
    w.writeheader()
    w.writerows(songs)
print(f"wrote {len(songs)} rows to /tmp/playlist_784204124.csv")
print(open("/tmp/playlist_784204124.csv").read().splitlines()[:5])
