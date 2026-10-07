#!/usr/bin/env python3
"""Seatly DevOps metrics (read-only). Uses `git log` and the PUBLIC GitHub API (no token needed for a public repo).
Usage (from the repository root):  python3 scripts/devops-metrics.py [--since 2026-07-23] [--ref origin/main] > docs/metrics/devops-metrics-YYYY-MM-DD.txt
Definitions
  Deployment            = a pull request merged into main (Render and Vercel deploy from main automatically).
  Lead time             = first commit of the PR range -> merge into main (git author/commit dates).
  Change failure        = a merged PR whose commits are ALL fix/hotfix types AND whose title is NOT in the exclusion list
                          (security hardening, accessibility, lint-only) -> heuristic, single rater; the list is printed.
  Time to restore proxy = time between the previous merge to main and the corrective merge.
"""
import argparse, collections, datetime as dt, json, re, statistics as st, subprocess, sys, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("--since", default="2026-07-23")
ap.add_argument("--ref", default="origin/main")
ap.add_argument("--repo", default="leobarreiras00/seating-management")
ap.add_argument("--no-api", action="store_true")
a = ap.parse_args()
since = dt.datetime.fromisoformat(a.since).replace(tzinfo=dt.timezone.utc)

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout

def api(path):
    req = urllib.request.Request(f"https://api.github.com/repos/{a.repo}{path}",
                                 headers={"User-Agent": "seatly-metrics", "Accept": "application/vnd.github+json"})
    return json.load(urllib.request.urlopen(req, timeout=30))

def pct(v, p):
    v = sorted(v); return v[min(len(v) - 1, int(len(v) * p))]

print(f"== Seatly DevOps metrics | generated {dt.datetime.now(dt.timezone.utc):%Y-%m-%d %H:%M} UTC | window from {a.since} | ref {a.ref}")

# ---- repository
print("\n[Repository]")
all_commits = git("rev-list", "--count", a.ref).strip()
nm = [l.split("|", 1) for l in git("log", a.ref, "--no-merges", f"--since={a.since}", "--format=%an|%s").splitlines()]
print(f"commits on {a.ref} (all history): {all_commits}")
print(f"non-merge commits since {a.since}: {len(nm)} (by author: {dict(collections.Counter(x[0] for x in nm))})")
conv = re.compile(r"^(feat|fix|chore|refactor|style|ci|ui|perf|docs|build|test|security|sec|change|revert)(\([^)]*\))?!?: ")
ok = sum(1 for _, s in nm if conv.match(s))
print(f"Conventional-Commit conformance: {ok}/{len(nm)} = {100*ok/len(nm):.0f}%")
types = collections.Counter((conv.match(s).group(1) if conv.match(s) else "other") for _, s in nm)
print("types:", dict(types.most_common()))
print("tracked files:", len(git("ls-files").splitlines()))
print("tags:", len(git("tag").splitlines()), "| remote branches:", len([l for l in git("branch", "-r").splitlines() if "->" not in l]))
try:
    ahead, behind = git("rev-list", "--left-right", "--count", "origin/main...origin/develop").split()
    print(f"develop vs main: main has {ahead} commits not in develop; develop has {behind} not in main")
except Exception as e:
    print("develop vs main: n/a", e)

# ---- deployments (PR merges into main)
merges = []
for l in git("log", a.ref, "--first-parent", "--merges", "--format=%H|%ct|%s").splitlines():
    h, ct, s = l.split("|", 2)
    m = re.match(r"Merge pull request #(\d+)", s)
    if m and dt.datetime.fromtimestamp(int(ct), dt.timezone.utc) >= since:
        merges.append((int(ct), int(m.group(1)), h))
merges.sort()
print("\n[DORA - deployments = PR merges into main]")
n = len(merges)
span_days = (merges[-1][0] - since.timestamp()) / 86400
print(f"deployments: {n} between {a.since} and {dt.datetime.fromtimestamp(merges[-1][0], dt.timezone.utc):%Y-%m-%d} ({span_days/7:.1f} weeks) = {n/(span_days/7):.1f} per week")
days = sorted({dt.datetime.fromtimestamp(c, dt.timezone.utc).date() for c, _, _ in merges})
print(f"deployment days: {len(days)}")
wk = collections.Counter(dt.datetime.fromtimestamp(c, dt.timezone.utc).isocalendar()[1] for c, _, _ in merges)
print("merges per ISO week:", dict(sorted(wk.items())))

lt, rows = [], []
for ct, num, h in merges:
    p = git("log", "-1", "--format=%P", h).split()
    if len(p) < 2: continue
    cs = [l.split("|", 1) for l in git("log", f"{p[0]}..{p[1]}", "--no-merges", "--format=%ct|%s").splitlines() if l]
    if not cs: continue
    first = min(int(c[0]) for c in cs)
    lt.append((ct - first) / 3600)
    rows.append((ct, num, [c[1] for c in cs]))
print(f"lead time (n={len(lt)} PRs with new commits): median {st.median(lt):.2f} h, p90 {pct(lt,.9):.2f} h, max {max(lt):.1f} h, mean {st.mean(lt):.2f} h; mean excluding >200 h outliers {st.mean([x for x in lt if x<200]):.2f} h; under 24 h: {sum(x<24 for x in lt)}/{len(lt)}")

fixre = re.compile(r"^(fix|hotfix)\b")
EXCLUDE_TITLE = re.compile(r"(a11y|security|sec\b|swagger|lint|npm audit|remediate|rate limit|password policy|password length|6-char)", re.I)
fails, restore = [], []
prev = None
for ct, num, subs in rows:
    allfix = all(fixre.match(s) for s in subs)
    if allfix and not any(EXCLUDE_TITLE.search(s) for s in subs):
        fails.append((ct, num, subs[0]))
        gap = (ct - prev) / 3600 if prev else None
        restore.append((num, gap))
    prev = ct
print(f"change failures (heuristic: fix-only PR, not security/lint/a11y hardening): {len(fails)}/{len(rows)} = {100*len(fails)/len(rows):.1f}%")
for ct, num, s in fails:
    print(f"   #{num} {dt.datetime.fromtimestamp(ct, dt.timezone.utc):%d/%m %H:%M} {s[:80]}")
gaps = [g for _, g in restore if g is not None]
print(f"restore proxy (gap to previous merge): median {st.median(gaps):.2f} h; under 6 h: {sum(g<6 for g in gaps)}/{len(gaps)}")

# ---- GitHub API (public)
if not a.no_api:
    print("\n[GitHub API]")
    try:
        runs = []
        for pg in range(1, 6):
            d = api(f"/actions/runs?per_page=100&page={pg}")["workflow_runs"]
            runs += d
            if len(d) < 100: break
        by = collections.defaultdict(collections.Counter); dur = collections.defaultdict(list)
        for r in runs:
            if r["name"] not in ("CI", "CodeQL"): continue
            by[r["name"]][r["conclusion"] or r["status"]] += 1
            if r["conclusion"] == "success":
                s = dt.datetime.fromisoformat(r["run_started_at"].replace("Z", "+00:00")); e = dt.datetime.fromisoformat(r["updated_at"].replace("Z", "+00:00"))
                dur[r["name"]].append((e - s).total_seconds())
        for nme, c in by.items():
            d = dur[nme]
            print(f"{nme}: {sum(c.values())} runs {dict(c)}; successful duration median {st.median(d):.0f}s p90 {pct(d,.9):.0f}s max {max(d):.0f}s")
        fl = collections.Counter(("dependabot" if "dependabot" in r["head_branch"] else "developer branch") for r in runs if r["name"] == "CI" and r["conclusion"] == "failure")
        print("CI failures by origin:", dict(fl))
        prs = []
        for pg in range(1, 6):
            d = api(f"/pulls?state=all&per_page=100&page={pg}"); prs += d
            if len(d) < 100: break
        mg = [p for p in prs if p["merged_at"]]
        print(f"pull requests: {len(prs)} total, {len(mg)} merged ({sum(p['base']['ref']=='main' for p in mg)} into main, {sum(p['base']['ref']=='develop' for p in mg)} into develop), "
              f"{sum(1 for p in prs if p['state']=='closed' and not p['merged_at'])} closed unmerged, {sum(p['user']['login'].startswith('dependabot') for p in prs)} by Dependabot")
        print("releases:", len(api("/releases")), "| tags:", len(api("/tags")))
        rs = api("/rulesets")
        for r in rs:
            d = api(f"/rulesets/{r['id']}")
            print(f"ruleset '{d['name']}' enforcement={d['enforcement']} bypass_actors={d.get('bypass_actors')}")
            for x in d["rules"]:
                p = x.get("parameters", {})
                if x["type"] == "required_status_checks":
                    print("   required checks:", [c["context"] for c in p["required_status_checks"]], "strict:", p["strict_required_status_checks_policy"])
                elif x["type"] == "pull_request":
                    print("   pull request: required approvals =", p["required_approving_review_count"])
                else:
                    print("   rule:", x["type"])
    except Exception as e:
        print("API unavailable:", e)
