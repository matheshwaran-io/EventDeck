import zipfile,re,html,sys,json
def paras(path):
    x=zipfile.ZipFile(path).read('word/document.xml').decode()
    return [t for t in (html.unescape(''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', p))).strip() for p in re.findall(r'<w:p[ >].*?</w:p>', x, re.S)) if t]
ev=paras(sys.argv[1]); el=paras(sys.argv[2])
def toks(s): return re.findall(r"[a-z0-9]+", s.lower())
N=7; el_sh=set()
for p in el:
    t=toks(p); el_sh.update(tuple(t[i:i+N]) for i in range(len(t)-N+1))
ref_start=max(i for i,p in enumerate(ev) if p=="10. REFERENCES"); toc_end=next(i for i,p in enumerate(ev) if p=="1. INTRODUCTION" and i>100)
cat={"front":[0,0],"body":[0,0],"refs":[0,0]}; rows=[]
for i,p in enumerate(ev):
    t=toks(p); n=max(0,len(t)-N+1); h=sum(1 for k in range(n) if tuple(t[k:k+N]) in el_sh)
    key="front" if i<toc_end else ("refs" if i>ref_start and re.match(r"\[\d+\]",p) else "body")
    cat[key][0]+=h; cat[key][1]+=n
    if h and key=="body" and len(p)>50: rows.append((h,p[:110]))
tot=sum(v[0] for v in cat.values()); n=sum(v[1] for v in cat.values())
print(f"overall {tot}/{n} = {tot/n:.1%}"); [print(f"  {k}: {v[0]}/{v[1]} = {v[0]/max(v[1],1):.1%}") for k,v in cat.items()]
print("body paragraphs still sharing 7-word runs:"); [print("  ",h,p) for h,p in sorted(rows,reverse=True)[:25]]
