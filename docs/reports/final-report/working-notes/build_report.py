"""Builds EventDeck_Final_Report.docx by reusing the Electify report package.

The reference .docx supplies every style, the numbering, headers/footers, page
setup, the cover page, bonafide certificate and acknowledgement. Only the body
content after the front matter is generated, using the same paragraph and table
XML patterns the reference uses. The reference file itself is only read.

Usage: python build_report.py <reference.docx> <output.docx>
"""
import copy
import datetime as dt
import os
import re
import struct
import sys
import zipfile
from xml.sax.saxutils import escape

from lxml import etree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import report_content as C  # noqa: E402

REF, OUT = sys.argv[1], sys.argv[2]
ASSETS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))
WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = "{%s}" % WNS
NS = {"w": WNS}

zin = zipfile.ZipFile(REF)
files = {n: zin.read(n) for n in zin.namelist()}
doc = etree.fromstring(files["word/document.xml"])
body = doc.find("w:body", NS)
K = list(body)
NSDECL = " ".join(f'xmlns:{k}="{v}"' for k, v in doc.nsmap.items() if k)
for k, v in (("a", "http://schemas.openxmlformats.org/drawingml/2006/main"), ("pic", "http://schemas.openxmlformats.org/drawingml/2006/picture")):
    if k not in doc.nsmap:
        NSDECL += f' xmlns:{k}="{v}"'


def frag(xml):
    return list(etree.fromstring(f"<w:body {NSDECL}>{xml}</w:body>"))


def t(s):
    return f'<w:t xml:space="preserve">{escape(s)}</w:t>'


def runs(text, base=""):
    """**bold** and *italic* inline markers -> runs."""
    out = []
    for part in re.split(r"(\*\*.+?\*\*|\*[^*]+?\*)", text):
        if not part:
            continue
        if part.startswith("**"):
            out.append(f"<w:r><w:rPr>{base}<w:b/></w:rPr>{t(part[2:-2])}</w:r>")
        elif part.startswith("*"):
            out.append(f"<w:r><w:rPr>{base}<w:i/></w:rPr>{t(part[1:-1])}</w:r>")
        else:
            out.append(f"<w:r>{f'<w:rPr>{base}</w:rPr>' if base else ''}{t(part)}</w:r>")
    return "".join(out)


SP = '<w:spacing w:line="360" w:lineRule="auto"/>'
bm_id = [500]
toc_entries, lot_entries, lof_entries = [], [], []


def bookmark():
    bm_id[0] += 1
    return bm_id[0], f"_Toc9{bm_id[0]:06d}"


def heading(level, text):
    i, name = bookmark()
    jc = '<w:jc w:val="center"/>' if level == 1 else ""
    pb = '<w:pageBreakBefore w:val="0"/>' if text.startswith("1. ") and level == 1 else ""
    if level < 4:
        toc_entries.append((level, text, name))
    return (
        f'<w:p><w:pPr><w:pStyle w:val="Heading{level}"/>{pb}{SP}{jc}</w:pPr>'
        f'<w:bookmarkStart w:id="{i}" w:name="{name}"/><w:r>{t(text)}</w:r><w:bookmarkEnd w:id="{i}"/></w:p>'
    )


def para(text, style="BodyTextReport"):
    return f'<w:p><w:pPr><w:pStyle w:val="{style}"/>{SP}</w:pPr>{runs(text)}</w:p>'


num_ids = [12]
new_nums = []


def numbered(items):
    num_ids[0] += 1
    new_nums.append(num_ids[0])
    return "".join(
        f'<w:p><w:pPr><w:pStyle w:val="ListNumber"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num_ids[0]}"/></w:numPr>{SP}</w:pPr>{runs(x)}</w:p>'
        for x in items
    )


def bullets(items):
    return "".join(f'<w:p><w:pPr><w:pStyle w:val="ListBullet"/>{SP}</w:pPr>{runs(x)}</w:p>' for x in items)


def table_caption(text):
    i, name = bookmark()
    lot_entries.append((text, name))
    return (
        f'<w:p><w:pPr><w:pStyle w:val="TableCaption"/><w:keepNext/>{SP}<w:jc w:val="center"/></w:pPr>'
        f'<w:bookmarkStart w:id="{i}" w:name="{name}"/><w:r><w:rPr><w:b/></w:rPr>{t(text)}</w:r><w:bookmarkEnd w:id="{i}"/></w:p>'
    )


TBL_PR = etree.tostring(K[242].find("w:tblPr", NS)).decode()
TBL_PR = re.sub(r' xmlns:\w+="[^"]+"', "", TBL_PR)
CODE_PR = re.sub(r' xmlns:\w+="[^"]+"', "", etree.tostring(K[487].find("w:tblPr", NS)).decode())
TEXT_W = 9518


def cell(w, text, header=False, bold=False):
    shd = '<w:shd w:val="clear" w:color="auto" w:fill="1F3864"/>' if header else ""
    keep = "<w:keepNext/>" if header else ""
    base = '<w:color w:val="FFFFFF"/>' if header else ""
    paras = []
    for line in str(text).split("\n"):
        r = runs(f"**{line}**" if (header or bold) and line else line, base)
        paras.append(f'<w:p><w:pPr><w:pStyle w:val="TableText"/>{keep}{SP}</w:pPr>{r}</w:p>')
    return f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{shd}<w:vAlign w:val="center"/></w:tcPr>{"".join(paras)}</w:tc>'


def table(caption, header, rows, weights, bold_first=True):
    tot = sum(weights)
    ws = [round(TEXT_W * x / tot) for x in weights]
    ws[-1] += TEXT_W - sum(ws)
    grid = "".join(f'<w:gridCol w:w="{x}"/>' for x in ws)
    trs = [
        '<w:tr><w:trPr><w:cantSplit/><w:tblHeader/><w:jc w:val="center"/></w:trPr>'
        + "".join(cell(w, h, header=True) for w, h in zip(ws, header))
        + "</w:tr>"
    ]
    for row in rows:
        trs.append(
            '<w:tr><w:trPr><w:cantSplit/><w:jc w:val="center"/></w:trPr>'
            + "".join(cell(w, v, bold=(j == 0 and bold_first)) for j, (w, v) in enumerate(zip(ws, row)))
            + "</w:tr>"
        )
    return (
        table_caption(caption)
        + f"<w:tbl>{TBL_PR}<w:tblGrid>{grid}</w:tblGrid>{''.join(trs)}</w:tbl>"
        + '<w:p><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr></w:p>'
    )


def code(lines):
    ps = "".join(
        f'<w:p><w:pPr><w:pStyle w:val="CodeText"/>{SP}</w:pPr><w:r>{t(l if l else " ")}</w:r></w:p>' for l in lines
    )
    return (
        f'<w:tbl>{CODE_PR}<w:tblGrid><w:gridCol w:w="9509"/></w:tblGrid><w:tr><w:trPr><w:jc w:val="center"/></w:trPr>'
        f'<w:tc><w:tcPr><w:tcW w:w="9518" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr>{ps}</w:tc></w:tr></w:tbl>'
        '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>'
    )


images = []  # (rId, media name, source path)
doc_pr = [100]


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def figure(rel_path, caption, width_in=6.0, max_h_in=8.3):
    src = os.path.join(ASSETS, rel_path)
    pw, ph = png_size(src)
    w_in = width_in
    h_in = w_in * ph / pw
    if h_in > max_h_in:
        h_in = max_h_in
        w_in = h_in * pw / ph
    cx, cy = int(w_in * 914400), int(h_in * 914400)
    rid = f"rId{200 + len(images)}"
    media = f"eventdeck_{len(images) + 1:02d}.png"
    images.append((rid, media, src))
    doc_pr[0] += 1
    i, name = bookmark()
    num, _, rest = caption.partition(" ")
    num2, _, title = rest.partition(" ")
    lof_entries.append((caption, name))
    pic = (
        f'<w:p><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="0" w:line="360" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>'
        f'<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{doc_pr[0]}" name="Picture {doc_pr[0]}" descr="{escape(title)}"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
        f'<pic:nvPicPr><pic:cNvPr id="0" name="{media}"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>"
    )
    cap = (
        f'<w:p><w:pPr><w:pStyle w:val="FigureCaption"/>{SP}</w:pPr><w:bookmarkStart w:id="{i}" w:name="{name}"/>'
        f'<w:r><w:rPr><w:b/></w:rPr>{t(num + " " + num2 + " ")}</w:r><w:r>{t(title)}</w:r><w:bookmarkEnd w:id="{i}"/></w:p>'
    )
    return pic + cap


def reference(n, text):
    return (
        '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="648"/></w:tabs><w:spacing w:after="120" w:line="360" w:lineRule="auto"/>'
        f'<w:ind w:left="648" w:hanging="648"/></w:pPr><w:r>{t(f"[{n}]")}</w:r><w:r><w:tab/></w:r>{runs(text)}</w:p>'
    )


TOC_RPR = (
    '<w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>'
    '{b}<w:noProof/><w:color w:val="auto"/><w:kern w:val="2"/><w:szCs w:val="24"/><w:lang w:val="en-IN" w:eastAsia="en-GB"/></w:rPr>'
)


def toc_field(entries, instr):
    out = []
    for k, (style, text, anchor) in enumerate(entries):
        start = (
            f'<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r>'
            '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
            if k == 0
            else ""
        )
        rpr = TOC_RPR.format(b='<w:b w:val="0"/>' if style == "TOC1" else "")
        wh = "<w:rPr><w:noProof/><w:webHidden/></w:rPr>"
        out.append(
            f'<w:p><w:pPr><w:pStyle w:val="{style}"/>{rpr}</w:pPr>{start}'
            f'<w:hyperlink w:anchor="{anchor}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:noProof/></w:rPr>{t(text)}</w:r>'
            f'<w:r>{wh}<w:tab/></w:r><w:r>{wh}<w:fldChar w:fldCharType="begin"/></w:r>'
            f'<w:r>{wh}<w:instrText xml:space="preserve"> PAGEREF {anchor} \\h </w:instrText></w:r>'
            f'<w:r>{wh}<w:fldChar w:fldCharType="separate"/></w:r><w:r>{wh}<w:t>1</w:t></w:r><w:r>{wh}<w:fldChar w:fldCharType="end"/></w:r>'
            "</w:hyperlink></w:p>"
        )
    out.append('<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>')
    return "".join(out)


# ---------------------------------------------------------------- body content
chapters = []
for block in C.BODY:
    kind = block[0]
    if kind in ("h1", "h2", "h3"):
        chapters.append(heading(int(kind[1]), block[1]))
    elif kind == "p":
        chapters.append(para(block[1]))
    elif kind == "num":
        chapters.append(numbered(block[1]))
    elif kind == "bul":
        chapters.append(bullets(block[1]))
    elif kind == "table":
        _, cap, head, rows, weights = block[:5]
        chapters.append(table(cap, head, rows, weights, *block[5:]))
    elif kind == "fig":
        chapters.append(figure(*block[1:]))
    elif kind == "code":
        chapters.append(code(block[1]))
    elif kind == "refs":
        chapters.append("".join(reference(i + 1, r) for i, r in enumerate(block[1])))
    else:
        raise ValueError(kind)
chapter_xml = "".join(chapters)

# ---------------------------------------------------------------- front matter
def set_text(p, text, bold=True, size=None):
    for r in p.findall("w:r", NS):
        p.remove(r)
    rpr = "<w:rPr>" + ("<w:b/>" if bold else "") + (f'<w:sz w:val="{size}"/>' if size else "") + "</w:rPr>"
    p.extend(frag(f"<w:r>{rpr}{t(text)}</w:r>"))


front = [copy.deepcopy(K[i]) for i in range(0, 40)]
set_text(front[0], C.TITLE, size=32)
bona = front[19]
title_run = [r for r in bona.findall("w:r", NS) if r.find("w:rPr/w:b", NS) is not None][0]
title_run.find("w:t", NS).text = C.TITLE

toc_list = [({1: "TOC1", 2: "TOC2", 3: "TOC3"}[lvl], text, anchor) for lvl, text, anchor in toc_entries]
new_children = (
    front
    + frag(toc_field(toc_list, 'TOC \\o "1-3" \\h \\z \\u'))
    + [copy.deepcopy(K[130])]
    + frag("".join(para(x) for x in C.ABSTRACT))
    + [copy.deepcopy(K[132])]
    + frag(toc_field([("TOC1", x, a) for x, a in lot_entries], 'TOC \\h \\z \\t "Table Caption,1"'))
    + [copy.deepcopy(K[160])]
    + frag(toc_field([("TOC1", x, a) for x, a in lof_entries], 'TOC \\h \\z \\t "Figure Caption,1"'))
    + [copy.deepcopy(K[188])]
    + frag(chapter_xml)
    + [copy.deepcopy(K[528])]
)
for el in list(body):
    body.remove(el)
body.extend(new_children)
for el in body.iter(W + "lastRenderedPageBreak"):
    el.getparent().remove(el)
files["word/document.xml"] = etree.tostring(doc, xml_declaration=True, encoding="UTF-8", standalone=True)

# ---------------------------------------------------------------- relationships & media
rels = etree.fromstring(files["word/_rels/document.xml.rels"])
for r in list(rels):
    if r.get("Type").endswith("/image") and r.get("Id") != "rId8":
        files.pop("word/" + r.get("Target"), None)
        rels.remove(r)
for rid, media, src in images:
    el = etree.SubElement(rels, "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
    el.set("Id", rid)
    el.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image")
    el.set("Target", f"media/{media}")
    with open(src, "rb") as f:
        files[f"word/media/{media}"] = f.read()
files["word/_rels/document.xml.rels"] = etree.tostring(rels, xml_declaration=True, encoding="UTF-8", standalone=True)

# ---------------------------------------------------------------- numbering: one restart per numbered list
num = files["word/numbering.xml"].decode()
extra = "".join(
    f'<w:num w:numId="{n}"><w:abstractNumId w:val="7"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>'
    for n in new_nums
    if f'w:numId="{n}"' not in num
)
num = num.replace("</w:numbering>", extra + "</w:numbering>")
files["word/numbering.xml"] = num.encode()

# ---------------------------------------------------------------- metadata
now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
core = files["docProps/core.xml"].decode()
core = re.sub(r"<dc:title>.*?</dc:title>", "<dc:title>EventDeck Final Project Report</dc:title>", core)
core = re.sub(r"(<dcterms:(created|modified)[^>]*>).*?(</dcterms:\2>)", rf"\g<1>{now}\3", core)
files["docProps/core.xml"] = core.encode()
files["docProps/app.xml"] = files["docProps/app.xml"].decode().replace("Electify Mini Project Report", "EventDeck Final Project Report").encode()

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for n in zin.namelist():
        if n in files:
            z.writestr(n, files[n])
    for n, data in files.items():
        if n not in zin.namelist():
            z.writestr(n, data)

text = etree.tostring(doc, encoding="unicode", method="text")
assert "lectify" not in text, "reference project name leaked into the output"
print(f"wrote {OUT}: {len(toc_entries)} headings, {len(lot_entries)} tables, {len(lof_entries)} figures, {len(images)} images")
