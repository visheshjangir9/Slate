#!/usr/bin/env python3
"""Regression tests for .claude/hooks/capture.py, replayed against a REAL transcript."""
import os, sys, json, glob, shutil, importlib.util, datetime, tempfile

REAL = os.path.expanduser(
    "~/.claude/projects/-Users-visheshjangir-Desktop-higgsfield/"
    "32ae6650-2f65-4021-8b77-0fcb8641895d.jsonl")
SRC = "/Users/visheshjangir/Desktop/higgsfield/.claude/hooks/capture.py"
os.environ["CAPTURE_POLL_ATTEMPTS"] = "2"   # keep the negative test fast

PASS, FAIL = [], []
def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print("  %s %s%s" % ("PASS" if cond else "FAIL", name, "" if cond else "  -> " + detail))

def load_mod(repo):
    spec = importlib.util.spec_from_file_location("cap", os.path.join(repo, ".claude/hooks/capture.py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def make_repo():
    d = tempfile.mkdtemp()
    os.makedirs(os.path.join(d, ".claude/hooks")); os.makedirs(os.path.join(d, ".agent-logs"))
    shutil.copy(SRC, os.path.join(d, ".claude/hooks/capture.py"))
    json.dump({"author": "visheshjangir9", "project": "test"},
              open(os.path.join(d, ".agent-logs/config.json"), "w"))
    return d

entries = [json.loads(l) for l in open(REAL, errors="replace") if l.strip()]

def is_real_user_prompt(e):
    if e.get("type") != "user" or e.get("isSidechain"): return False
    c = (e.get("message") or {}).get("content")
    if isinstance(c, str): return bool(c.strip())
    if isinstance(c, list):
        return any(b.get("type") == "text" for b in c if isinstance(b, dict)) and \
               not any(b.get("type") == "tool_result" for b in c if isinstance(b, dict))
    return False

def text_of(e):
    return "\n".join(b.get("text","") for b in (e.get("message") or {}).get("content", [])
                     if isinstance(b, dict) and b.get("type")=="text" and b.get("text")).strip()

# Build turns: (prompt_idx, prompt_ts, final_assistant_idx, expected_text)
bounds = [i for i,e in enumerate(entries) if is_real_user_prompt(e)]
turns = []
for n, start in enumerate(bounds):
    end = bounds[n+1] if n+1 < len(bounds) else len(entries)
    last = None
    for i in range(start+1, end):
        e = entries[i]
        if e.get("type")=="assistant" and not e.get("isSidechain") and text_of(e):
            last = i
    if last is not None:
        turns.append((start, entries[start].get("timestamp"), last, text_of(entries[last])))

print("Replaying %d real turns from session 32ae6650\n" % len(turns))

def seed_log(mod, repo, sid, prompts):
    """Write a log with PROMPT entries stamped at their REAL historical times."""
    path = mod.create_log(sid, "claude-sonnet-5")
    for n,(ts,txt) in enumerate(prompts, 1):
        short = sid.split("-")[0]
        open(path,"a").write("[LOG_ENTRY type=PROMPT num=%d session=%s]\ntimestamp: %s\nmodel: claude-sonnet-5\n\n%s\n\n\n"
                             % (n, short, ts, txt))
    return path

print("TEST 1 - correct pairing, each turn gets ITS OWN response")
for n,(pi, pts, ai, expected) in enumerate(turns, 1):
    repo = make_repo(); mod = load_mod(repo)
    sid = "test%04d-0000-0000-0000-00000000000%d" % (n, n)
    tpath = os.path.join(repo, "t.jsonl")
    # transcript truncated to exactly this turn's final assistant message
    with open(tpath,"w") as f:
        for e in entries[:ai+1]: f.write(json.dumps(e)+"\n")
    prompts = [(entries[b].get("timestamp"), text_of(entries[b]) or "prompt") for b in [t[0] for t in turns[:n]]]
    path = seed_log(mod, repo, sid, prompts)
    mod.handle_response({"session_id": sid, "transcript_path": tpath})
    body = open(path).read()
    got = body.split("[LOG_ENTRY type=RESPONSE num=%d" % n)[-1].split("\n\n",1)[-1].strip()
    check("turn %d response matches that turn's own text" % n,
          got.startswith(expected[:120]), "got=%r" % got[:120])
    shutil.rmtree(repo)

print("\nTEST 2 - THE REGRESSION: turn's own text not yet flushed")
pi, pts, ai, expected = turns[-1]
prev_expected = turns[-2][3]
repo = make_repo(); mod = load_mod(repo)
sid = "race0000-0000-0000-0000-000000000000"
tpath = os.path.join(repo, "t.jsonl")
first_text = next(i for i in range(pi+1, len(entries))
                  if entries[i].get("type") == "assistant"
                  and not entries[i].get("isSidechain") and text_of(entries[i]))
with open(tpath,"w") as f:            # NO text from this turn at all, so the ONLY
    for e in entries[:first_text]:    # candidate is the PREVIOUS turn's answer
        f.write(json.dumps(e)+"\n")
prompts = [(entries[b].get("timestamp"), text_of(entries[b]) or "p") for b in [t[0] for t in turns]]
path = seed_log(mod, repo, sid, prompts)
mod.handle_response({"session_id": sid, "transcript_path": tpath})
body = open(path).read()
check("does NOT paste previous turn's answer", prev_expected[:120] not in body,
      "previous turn's text leaked into the log")
check("falls back to the honest placeholder", "(no final text response captured" in body)
shutil.rmtree(repo)

print("\nTEST 3 - duplicate guard + content purity")
repo = make_repo(); mod = load_mod(repo)
sid = "dupe0000-0000-0000-0000-000000000000"
tpath = os.path.join(repo, "t.jsonl")
with open(tpath,"w") as f:
    for e in entries[:turns[-1][2]+1]: f.write(json.dumps(e)+"\n")
prompts = [(entries[b].get("timestamp"), text_of(entries[b]) or "p") for b in [t[0] for t in turns]]
path = seed_log(mod, repo, sid, prompts[:1])
mod.handle_response({"session_id": sid, "transcript_path": tpath})   # answer turn 1 normally
blk = ("[LOG_ENTRY type=PROMPT num=2 session=dupe0000]\n"
       "timestamp: " + prompts[-1][0] + "\nmodel: claude-sonnet-5\n\n"
       + prompts[-1][1] + "\n\n\n")
open(path, "a").write(blk)                                            # leave turn 2 open
for _ in range(3):
    mod.handle_response({"session_id": sid, "transcript_path": tpath})
body = open(path).read()
check("3 Stop events on one open prompt -> exactly 1 new response",
      body.count("[LOG_ENTRY type=RESPONSE") == 2,
      "count=%d (expected 2: one per prompt)" % body.count("[LOG_ENTRY type=RESPONSE"))

thinks = [b.get("thinking","") for e in entries if e.get("type")=="assistant"
          for b in (e.get("message") or {}).get("content",[]) if isinstance(b,dict) and b.get("type")=="thinking"]
leaked = [t[:80] for t in thinks if len(t) > 80 and t[:80] in body]
check("no thinking blocks in log", not leaked, "leaked: %s" % leaked[:1])

tools = [json.dumps(b.get("input",{}))[:80] for e in entries if e.get("type")=="assistant"
         for b in (e.get("message") or {}).get("content",[]) if isinstance(b,dict) and b.get("type")=="tool_use"]
tleak = [t for t in tools if len(t) > 40 and t[:60] in body]
check("no tool_use payloads in log", not tleak, "leaked: %s" % tleak[:1])
check("no tool_result markers in log", "tool_result" not in body)
shutil.rmtree(repo)

print("\n%s  %d passed, %d failed" % ("ALL GREEN" if not FAIL else "FAILURES", len(PASS), len(FAIL)))
sys.exit(1 if FAIL else 0)
