#!/usr/bin/env python3
"""
不依赖 Tauri 的可直接运行 Demo，验证你这个 784204124 歌单的完整链路
已验证： /api/v6/playlist/detail + /api/song/detail + /api/song/enhance/player/url/v1
用法： python3 scripts/ncm_demo.py "https://music.163.com/playlist?id=784204124"
"""
import re, json, urllib.request, urllib.parse, time, sys, os
from pathlib import Path

HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://music.163.com/"}

def extract_id(url): 
    m=re.search(r"[?&]id=(\d+)", url)
    return int(m.group(1)) if m else None

def fetch_json(url):
    req=urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def fetch_playlist(pid):
    j=fetch_json(f"https://music.163.com/api/v6/playlist/detail?id={pid}")
    pl=j["playlist"]
    print(f"歌单: {pl['name']} / {pl['creator']['nickname']} / {pl['trackCount']}首")
    return pl["trackIds"]

def fetch_songs(ids):
    # 200 一批
    url=f"https://music.163.com/api/song/detail?ids=[{','.join(map(str, ids))}]"
    j=fetch_json(url)
    return j.get("songs",[])

def fetch_url(sid, cookie=""):
    headers={**HEADERS}
    if cookie: headers["Cookie"]=cookie
    url=f"https://music.163.com/api/song/enhance/player/url/v1?ids=[{sid}]&level=standard&encodeType=mp3"
    req=urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as r:
        j=json.loads(r.read())
        return (j.get("data") or [{}])[0].get("url")

if __name__=="__main__":
    share = sys.argv[1] if len(sys.argv)>1 else "https://music.163.com/playlist?id=784204124"
    pid=extract_id(share)
    print("playlist id", pid)
    trackIds=fetch_playlist(pid)
    ids=[x["id"] for x in trackIds]
    print(f"共 {len(ids)} 唯一id，去重后 {len(set(ids))}")
    # 模拟已下载记录
    db_path=Path("/tmp/ncm_downloaded.json")
    downloaded=set(json.loads(db_path.read_text()) if db_path.exists() else [])
    print(f"已下载 {len(downloaded)}")

    # 拉前 400 首演示
    for i in range(0, min(400, len(ids)), 200):
        chunk=ids[i:i+200]
        songs=fetch_songs(chunk)
        print(f"[{i}:{i+len(chunk)}] 拉到 {len(songs)} 首")
        for s in songs[:3]:
            print(" ", s["id"], s["name"], ",".join(a["name"] for a in s["artists"][:2]))
        # 演示取下载链接（需登录 cookie 才能拿 VIP 歌曲，否则 url 为 None）
        for s in songs[:1]:
            url=fetch_url(s["id"])
            print("   player url:", url[:80] if url else "None(需登录/无版权)")
        time.sleep(0.5)

    # 演示增量下载判断
    undone=[x for x in ids if x not in downloaded]
    print(f"未下载 {len(undone)} 首，按 id 去重，若要下载执行：")
    print(f"  # 写入已下载示例: downloaded.add({undone[0]}) if undone else ...")
