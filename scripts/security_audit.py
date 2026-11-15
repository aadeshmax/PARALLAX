import os
import re

patterns = [
    re.compile(r'bearer\s+[a-zA-Z0-9_\-\.]{25,}', re.IGNORECASE),
    re.compile(r'earthdata.*token.*[\'\"][a-zA-Z0-9_\-\.]{25,}[\'\"]', re.IGNORECASE),
    re.compile(r'password\s*=\s*[\'\"][^\'\"]+[\'\"]', re.IGNORECASE),
    re.compile(r'client_secret\s*=\s*[\'\"][^\'\"]+[\'\"]', re.IGNORECASE),
]

exclude_dirs = {'.git', 'node_modules', 'dist', 'venv', '__pycache__', '.pytest_cache'}

found = []
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for f in files:
        if f.endswith(('.py', '.ts', '.tsx', '.json', '.md', '.html', '.js')):
            fpath = os.path.join(root, f)
            if '.env' in fpath:
                continue
            try:
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
                    for i, line in enumerate(fp, 1):
                        for p in patterns:
                            if p.search(line):
                                # check if placeholder
                                if 'dummy' in line.lower() or 'placeholder' in line.lower() or 'none' in line.lower() or 'secret_key' in line.lower() or 'example' in line.lower():
                                    continue
                                found.append((fpath, i, line.strip()))
            except Exception:
                pass

print(f"Total potential credential leaks: {len(found)}")
for f, i, l in found:
    print(f"  {f}:{i} -> {l}")
