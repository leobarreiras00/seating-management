#!/usr/bin/env python3
"""Summarise Roslyn code-metrics warnings (CA1501/CA1502/CA1505/CA1506) from a build log.
Usage: python3 parse_metrics.py build.log"""
import re, sys, statistics as st
log = open(sys.argv[1], encoding="utf-8", errors="ignore").read().splitlines()
seen = set()
cc, mi, cbo_t, cbo_m, dit = {}, {}, {}, {}, {}
for l in log:
    if l in seen:
        continue
    seen.add(l)
    m = re.search(r"CA1502.*?'([^']+)' has a cyclomatic complexity of '(\d+)'", l)
    if m: cc[m.group(1)] = int(m.group(2)); continue
    m = re.search(r"CA1505.*?'([^']+)' has a maintainability index of '(\d+)'", l)
    if m: mi[m.group(1)] = int(m.group(2)); continue
    m = re.search(r"CA1506.*?'([^']+)' is coupled with '(\d+)' different types", l)
    if m:
        name, n = m.group(1), int(m.group(2))
        (cbo_m if "(" in name else cbo_t)[name] = n; continue
    m = re.search(r"CA1501.*?'([^']+)' has an object hierarchy '(\d+)' levels deep", l)
    if m: dit[m.group(1)] = int(m.group(2))
def block(title, d, top=12):
    if not d: print(f"\n{title}: no data"); return
    v = list(d.values())
    print(f"\n{title}: n={len(v)} mean={st.mean(v):.2f} median={st.median(v)} max={max(v)}")
    for k, x in sorted(d.items(), key=lambda i: -i[1])[:top]: print(f"  {x:>4}  {k}")
block("Cyclomatic complexity per method (CA1502)", cc)
over = [k for k, v in cc.items() if v > 10]
print(f"  methods with V(G) > 10: {len(over)}")
block("Class coupling per type (CA1506)", cbo_t)
block("Class coupling per method (CA1506)", cbo_m, 5)
block("Maintainability index (CA1505, lower = worse)", mi, 8)
block("Inheritance depth inside the project (CA1501; types not listed have depth 0)", dit, 8)
