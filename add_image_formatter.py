import os
import re
from pathlib import Path

POSTS_DIR = Path('_posts')
DEFAULT_IMAGE = '/assets/favicon/android-chrome-512x512.png'

def find_first_image(content):
    md_img = re.search(r'!\[.*?\]\((.*?)\)', content)
    if md_img:
        return md_img.group(1)
    html_img = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content)
    if html_img:
        return html_img.group(1)
    return None

def add_image_to_frontmatter(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    if not lines or not lines[0].strip().startswith('---'):
        return False

    # Find end of front matter
    for i, line in enumerate(lines[1:], 1):
        if line.strip() == '---':
            end_idx = i
            break
    else:
        return False  # No closing --- found

    frontmatter = lines[:end_idx]  # up to but not including closing ---
    closing = lines[end_idx]       # the closing --- line
    body = ''.join(lines[end_idx+1:])

    # Skip if image already present
    if any(line.strip().startswith('image:') for line in frontmatter):
        return False

    image_url = find_first_image(body) or DEFAULT_IMAGE

    # Find the title line and insert image after it
    new_frontmatter = []
    image_inserted = False
    for line in frontmatter:
        new_frontmatter.append(line)
        if line.strip().startswith('title:') and not image_inserted:
            new_frontmatter.append(f'image: {image_url}\n')
            image_inserted = True

    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_frontmatter)
        f.write(closing)  # Write the closing ---
        f.write('\n')
        f.write(body)
    return True

def main():
    changed = 0
    for mdfile in POSTS_DIR.glob('*.md'):
        if add_image_to_frontmatter(mdfile):
            print(f'Updated: {mdfile}')
            changed += 1
    print(f'Done. {changed} files updated.')

if __name__ == '__main__':
    main()