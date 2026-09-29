import json
import base64
import gzip
import os
import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Extract script with type="__bundler/manifest"
m = re.search(r'<script type="__bundler/manifest">([\s\S]*?)</script>', content)
if not m:
    print("Manifest not found")
    exit(1)

manifest_json = m.group(1).strip()
manifest = json.loads(manifest_json)
print(f"Found {len(manifest)} bundles in manifest")

os.makedirs('scratch/extracted_manifest', exist_ok=True)

for key, item in manifest.items():
    data_b64 = item.get('data', '')
    compressed = item.get('compressed', False)
    raw_bytes = base64.b64decode(data_b64)
    if compressed:
        decompressed_bytes = gzip.decompress(raw_bytes)
    else:
        decompressed_bytes = raw_bytes
    
    filename = f"scratch/extracted_manifest/{key}.js"
    with open(filename, 'wb') as out_f:
        out_f.write(decompressed_bytes)
    print(f"Extracted {filename}: {len(decompressed_bytes)} bytes")
