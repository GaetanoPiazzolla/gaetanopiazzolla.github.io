#!/usr/bin/env python3
"""
Converts a Jekyll post to Medium-ready HTML and opens it in the browser.
Select All (Cmd+A) → Copy (Cmd+C) → Paste into Medium's editor.

Usage:
    python3 medium_export.py _posts/2026-30-07-modulith-gcp-pubsub.md
    python3 medium_export.py _posts/2026-30-07-modulith-gcp-pubsub.md --out export.html

No external dependencies.
"""

import argparse
import html
import re
import subprocess
import sys
import tempfile
import webbrowser
from datetime import datetime
from pathlib import Path

SITE_URL = "https://gaetanopiazzolla.github.io"

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  body {{
    max-width: 740px;
    margin: 40px auto;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    line-height: 1.7;
    color: #222;
    padding: 0 20px;
    padding-top: 60px;
  }}
  h1 {{ font-size: 2em; margin-bottom: 0.3em; }}
  h2 {{ font-size: 1.5em; margin-top: 1.8em; }}
  h3 {{ font-size: 1.25em; margin-top: 1.5em; }}
  img {{ max-width: 100%; height: auto; display: block; margin: 1.5em auto; }}
  pre {{
    background: #f5f5f5;
    padding: 16px;
    overflow-x: auto;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.45;
  }}
  pre code {{ background: none; padding: 0; font-size: inherit; }}
  code {{
    background: #f0f0f0;
    padding: 2px 5px;
    border-radius: 3px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.85em;
  }}
  blockquote {{
    border-left: 3px solid #ccc;
    margin: 1.5em 0;
    padding: 0.5em 1em;
    color: #555;
  }}
  hr {{ border: none; border-top: 1px solid #ddd; margin: 2em 0; }}
  a {{ color: #1a8917; }}
  table {{ border-collapse: collapse; width: 100%; margin: 1.5em 0; }}
  th, td {{ border: 1px solid #ddd; padding: 8px 12px; text-align: left; }}
  th {{ background: #f5f5f5; }}
  .canonical {{ font-style: italic; color: #666; margin-bottom: 2em; }}
  #copy-bar {{
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #1a8917;
    padding: 10px 20px;
    text-align: center;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }}
  #copy-btn {{
    background: #fff;
    color: #1a8917;
    border: none;
    padding: 8px 28px;
    font-size: 16px;
    font-weight: 700;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s;
  }}
  #copy-btn:hover {{ background: #f0f0f0; }}
  #copy-btn.copied {{
    background: #222;
    color: #fff;
  }}
</style>
</head>
<body>
<div id="copy-bar">
  <button id="copy-btn" onclick="copyArticle()">📋 Copy All for Medium</button>
</div>
<div id="article">
{body}
</div>
<script>
function copyArticle() {{
  var article = document.getElementById('article');
  var range = document.createRange();
  range.selectNodeContents(article);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('copy');
  sel.removeAllRanges();
  var btn = document.getElementById('copy-btn');
  btn.textContent = '✅ Copied! Paste into Medium';
  btn.classList.add('copied');
  setTimeout(function() {{
    btn.textContent = '📋 Copy All for Medium';
    btn.classList.remove('copied');
  }}, 3000);
}}
</script>
</body>
</html>"""


def parse_front_matter(content: str) -> tuple[dict, str]:
    if not content.startswith("---"):
        return {}, content
    end = content.index("---", 3)
    raw = content[3:end]
    body = content[end + 3:].lstrip("\n")

    meta = {}
    current_key = None
    list_values = []

    for line in raw.splitlines():
        if not line.strip():
            continue
        list_match = re.match(r"^\s*-\s+(.+)$", line)
        if list_match:
            list_values.append(list_match.group(1).strip())
            if current_key:
                meta[current_key] = list_values
            continue

        kv = re.match(r"^(\w[\w_-]*):\s*(.*)?$", line)
        if kv:
            current_key = kv.group(1)
            val = (kv.group(2) or "").strip().strip('"').strip("'")
            list_values = []
            meta[current_key] = val if val else ""

    return meta, body


def build_canonical_url(meta: dict, filename: str) -> str:
    date_str = meta.get("date", "")
    try:
        dt = datetime.strptime(date_str.split("+")[0].strip(), "%Y-%m-%d %H:%M:%S")
    except (ValueError, IndexError):
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})", filename)
        if m:
            dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        else:
            dt = datetime.now()

    categories = meta.get("categories", [])
    if isinstance(categories, str):
        categories = categories.split()
    cat_path = "/".join(c.lower() for c in categories) if categories else ""

    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", Path(filename).stem)
    parts = [SITE_URL]
    if cat_path:
        parts.append(cat_path)
    parts.append(f"{dt.year}/{dt.month:02d}/{dt.day:02d}")
    parts.append(f"{slug}.html")
    return "/".join(parts)


def resolve_url(url: str) -> str:
    if url.startswith(("http://", "https://", "//")):
        return url
    if url.startswith("/"):
        return SITE_URL + url
    return SITE_URL + "/" + url


def convert_image_includes(body: str) -> str:
    def replace_include(m):
        full = m.group(0)
        src = m.group(1)
        alt = m.group(2) if m.group(2) else ""
        caption_match = re.search(r'caption="([^"]*)"', full)
        caption = caption_match.group(1) if caption_match else alt
        if caption and caption != "false":
            return f'![{alt}]({resolve_url(src)} "{caption}")'
        return f"![{alt}]({resolve_url(src)})"

    return re.sub(
        r'\{%\s*include\s+image\.html\s+src="([^"]+)"\s+alt="([^"]*)"[^%]*%\}',
        replace_include,
        body,
    )


def resolve_relative_images(body: str) -> str:
    def replace_md_img(m):
        alt, url = m.group(1), m.group(2)
        return f"![{alt}]({resolve_url(url)})"

    return re.sub(r"!\[([^\]]*)\]\((/[^)]+)\)", replace_md_img, body)


def md_to_html(md_text: str) -> str:
    lines = md_text.split("\n")
    html_parts = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Fenced code blocks
        code_match = re.match(r"^(\s*)```(\w*)\s*$", line)
        if code_match:
            indent = code_match.group(1)
            lang = code_match.group(2)
            code_lines = []
            i += 1
            while i < len(lines):
                if re.match(rf"^{indent}```\s*$", lines[i]):
                    break
                code_lines.append(lines[i])
                i += 1
            code_content = html.escape("\n".join(code_lines))
            # Medium splits <pre> at blank lines; a non-breaking space keeps the block intact
            code_content = re.sub(r"\n\n", "\n\u00a0\n", code_content)
            
            if lang:
                html_parts.append(f'<pre data-language="{lang}"><code class="language-{lang}">{code_content}</code></pre>')
            else:
                html_parts.append(f"<pre><code>{code_content}</code></pre>")
            i += 1
            continue

        # Blank line
        if not line.strip():
            i += 1
            continue

        # Headings
        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            level = len(heading.group(1))
            text = inline_format(heading.group(2))
            html_parts.append(f"<h{level}>{text}</h{level}>")
            i += 1
            continue

        # Horizontal rule
        if re.match(r"^---+\s*$", line) or re.match(r"^\*\*\*+\s*$", line):
            html_parts.append("<hr>")
            i += 1
            continue

        # Images (standalone line) — with optional title as caption
        img = re.match(r'^!\[([^\]]*)\]\(([^\s"]+)(?:\s+"([^"]*)")?(\))\s*$', line)
        if img:
            alt = html.escape(img.group(1))
            src = html.escape(img.group(2))
            caption = img.group(3) or ""
            if caption:
                html_parts.append(
                    f'<img src="{src}" alt="{alt}">'
                    f'<p style="text-align: center; font-style: italic; color: #666; font-size: 0.8em; margin-top: -1em; margin-bottom: 2em;">{caption}</p>'
                )
            else:
                html_parts.append(f'<img src="{src}" alt="{alt}">')
            i += 1
            continue

        # Unordered list
        if re.match(r"^\s*[-*]\s+", line):
            items, i = collect_list(lines, i, unordered=True)
            html_parts.append(render_list(items, "ul"))
            continue

        # Ordered list
        if re.match(r"^\s*\d+\.\s+", line):
            items, i = collect_list(lines, i, unordered=False)
            html_parts.append(render_list(items, "ol"))
            continue

        # Table
        if "|" in line and i + 1 < len(lines) and re.match(r"^\s*\|?\s*[-:]+", lines[i + 1]):
            table_html, i = parse_table(lines, i)
            html_parts.append(table_html)
            continue

        # Blockquote
        if line.startswith(">"):
            bq_lines = []
            while i < len(lines) and lines[i].startswith(">"):
                bq_lines.append(re.sub(r"^>\s?", "", lines[i]))
                i += 1
            bq_content = inline_format(" ".join(bq_lines))
            html_parts.append(f"<blockquote><p>{bq_content}</p></blockquote>")
            continue

        # Paragraph — collect consecutive non-blank, non-special lines
        para_lines = []
        while i < len(lines) and lines[i].strip() and not is_block_start(lines[i]):
            para_lines.append(lines[i])
            i += 1
        if para_lines:
            text = inline_format(" ".join(para_lines))
            html_parts.append(f"<p>{text}</p>")

    return "\n".join(html_parts)


def is_block_start(line: str) -> bool:
    if re.match(r"^#{1,6}\s+", line):
        return True
    if re.match(r"^---+\s*$", line) or re.match(r"^\*\*\*+\s*$", line):
        return True
    if re.match(r"^\s*```", line):
        return True
    if re.match(r"^!\[", line):
        return True
    return False


def inline_format(text: str) -> str:
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*\*(.+?)\*\*\*", r"<strong><em>\1</em></strong>", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", text)
    text = re.sub(r"_([^_]+)_", r"<em>\1</em>", text)
    text = re.sub(
        r"!\[([^\]]*)\]\(([^)]+)\)",
        lambda m: f'<img src="{html.escape(m.group(2))}" alt="{html.escape(m.group(1))}">',
        text,
    )
    text = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>',
        text,
    )
    return text


def collect_list(lines: list[str], i: int, unordered: bool) -> tuple[list[str], int]:
    pattern = r"^\s*[-*]\s+(.*)" if unordered else r"^\s*\d+\.\s+(.*)"
    items = []
    while i < len(lines):
        m = re.match(pattern, lines[i])
        if m:
            items.append(m.group(1))
            i += 1
        elif lines[i].startswith("  ") and items:
            items[-1] += " " + lines[i].strip()
            i += 1
        else:
            break
    return items, i


def render_list(items: list[str], tag: str) -> str:
    li = "".join(f"<li>{inline_format(item)}</li>" for item in items)
    return f"<{tag}>{li}</{tag}>"


def parse_table(lines: list[str], i: int) -> tuple[str, int]:
    def split_row(line):
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        return cells

    header = split_row(lines[i])
    i += 2  # skip separator row
    rows = []
    while i < len(lines) and "|" in lines[i]:
        rows.append(split_row(lines[i]))
        i += 1

    thead = "".join(f"<th>{inline_format(c)}</th>" for c in header)
    tbody = ""
    for row in rows:
        tbody += "<tr>" + "".join(f"<td>{inline_format(c)}</td>" for c in row) + "</tr>"

    return f"<table><thead><tr>{thead}</tr></thead><tbody>{tbody}</tbody></table>", i



def build_html(meta: dict, body_md: str, canonical_url: str) -> str:
    title = meta.get("title", "Untitled")
    excerpt = meta.get("excerpt", "")

    body_parts = [f"<h1>{html.escape(title)}</h1>"]
    if excerpt:
        body_parts.append(f"<h4>{html.escape(excerpt)}</h4>")
    body_parts.append(
        f'<p class="canonical"><em>Originally published at '
        f'<a href="{html.escape(canonical_url)}">{html.escape(SITE_URL)}</a></em></p>'
    )
    body_parts.append("<hr>")
    body_parts.append(md_to_html(body_md))

    return HTML_TEMPLATE.format(
        title=html.escape(title),
        body="\n".join(body_parts),
    )


def main():
    parser = argparse.ArgumentParser(
        description="Export a Jekyll post as Medium-ready HTML"
    )
    parser.add_argument("post", help="Path to the Jekyll .md post file")
    parser.add_argument("--out", help="Output HTML file path (default: opens in browser)")
    args = parser.parse_args()

    post_path = Path(args.post)
    if not post_path.exists():
        sys.exit(f"File not found: {post_path}")

    content = post_path.read_text(encoding="utf-8")
    meta, body = parse_front_matter(content)
    canonical_url = build_canonical_url(meta, post_path.name)

    body = convert_image_includes(body)
    body = resolve_relative_images(body)

    result = build_html(meta, body, canonical_url)

    if args.out:
        out_path = Path(args.out)
        out_path.write_text(result, encoding="utf-8")
        print(f"Written to {out_path}")
    else:
        with tempfile.NamedTemporaryFile(
            suffix=".html", prefix="medium_", delete=False, mode="w", encoding="utf-8"
        ) as f:
            f.write(result)
            tmp_path = f.name
        webbrowser.open(f"file://{tmp_path}")
        print(f"Opened in browser. Now:")
        print(f"  1. Cmd+A (Select All)")
        print(f"  2. Cmd+C (Copy)")
        print(f"  3. Paste into Medium's editor")
        print(f"\nCanonical URL: {canonical_url}")
        print(f"Temp file: {tmp_path}")


if __name__ == "__main__":
    main()
