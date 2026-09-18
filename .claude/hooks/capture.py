#!/usr/bin/env python3
"""
8x assignment agent-capture hook.

Fires automatically from .claude/settings.json:
  UserPromptSubmit -> capture.py prompt    (records the verbatim prompt)
  Stop             -> capture.py response  (records the final assistant response)

Design notes:
  * Stateless. Every counter/timestamp is re-derived by parsing the existing
    log file, so there is no sidecar state file to drift or get gitignored.
  * Only PROMPT + final RESPONSE are written. Thinking blocks, tool calls,
    tool results and subagent (sidechain) traffic are all skipped on purpose.
  * Failures are swallowed and traced to .agent-logs/.capture-errors.log so a
    broken hook can never block the session. That trace file is committed too.
"""
import json
import os
import re
import sys
import glob
import datetime
import traceback

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOG_DIR = os.path.join(REPO, ".agent-logs")
ERR_LOG = os.path.join(LOG_DIR, ".capture-errors.log")
CONFIG = os.path.join(LOG_DIR, "config.json")


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") \
        + "%03dZ" % (datetime.datetime.now(datetime.timezone.utc).microsecond // 1000)


def cfg():
    try:
        with open(CONFIG) as f:
            return json.load(f)
    except Exception:
        return {}


def note_error(msg):
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        with open(ERR_LOG, "a") as f:
            f.write("[%s] %s\n" % (now_iso(), msg))
    except Exception:
        pass


def find_log(session_id):
    """Existing log file for this session, or None."""
    hits = glob.glob(os.path.join(LOG_DIR, "*_%s.md" % session_id))
    return hits[0] if hits else None


def read_transcript(path):
    """Parse a Claude Code JSONL transcript into a list of dicts."""
    out = []
    if not path or not os.path.exists(path):
        return out
    with open(path, "r", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except Exception:
                continue
    return out


def final_assistant(entries):
    """
    The final response for the turn = the last non-sidechain assistant message
    that carries at least one text block. Returns (text, model).

    Thinking blocks and tool_use blocks are dropped: the brief asks for the
    prompt and the final answer, nothing in between.
    """
    for e in reversed(entries):
        if e.get("type") != "assistant" or e.get("isSidechain"):
            continue
        msg = e.get("message") or {}
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        texts = [
            b.get("text", "")
            for b in content
            if isinstance(b, dict) and b.get("type") == "text" and b.get("text")
        ]
        if texts:
            return "\n".join(texts).strip(), msg.get("model") or "unknown"
    return None, None


def last_model(entries):
    for e in reversed(entries):
        if e.get("type") == "assistant" and not e.get("isSidechain"):
            m = (e.get("message") or {}).get("model")
            if m:
                return m
    return None


def model_from_log(path):
    if not path or not os.path.exists(path):
        return None
    hits = re.findall(r"^model: (.+)$", open(path, errors="replace").read(), re.M)
    return hits[-1].strip() if hits else None


def count_entries(path, kind):
    if not path or not os.path.exists(path):
        return 0
    body = open(path, errors="replace").read()
    return len(re.findall(r"^\[LOG_ENTRY type=%s num=" % kind, body, re.M))


def refresh_frontmatter(path, session_id, model):
    """Rewrite the YAML frontmatter so the counters stay accurate."""
    body = open(path, errors="replace").read()
    parts = body.split("---\n", 2)
    if len(parts) < 3:
        return
    fm, rest = parts[1], parts[2]

    n = len(re.findall(r"^\[LOG_ENTRY type=PROMPT num=", rest, re.M))
    stamps = re.findall(r"^timestamp: (.+)$", rest, re.M)

    def setk(text, key, val):
        if re.search(r"^%s:" % key, text, re.M):
            return re.sub(r"^%s:.*$" % key, "%s: %s" % (key, val), text, flags=re.M)
        return text + "%s: %s\n" % (key, val)

    fm = setk(fm, "total_exchanges", n)
    if stamps:
        fm = setk(fm, "first_prompt_time", stamps[0].strip())
        fm = setk(fm, "last_prompt_time", stamps[-1].strip())
    if model and model != "unknown":
        fm = setk(fm, "model", model)

    open(path, "w").write("---\n" + fm + "---\n" + rest)


def create_log(session_id, model):
    c = cfg()
    ts = datetime.datetime.now(datetime.timezone.utc)
    fname = "%s_%s.md" % (ts.strftime("%Y-%m-%d_%H-%M-%S"), session_id)
    path = os.path.join(LOG_DIR, fname)
    short = session_id.split("-")[0]
    author = c.get("author", "unknown")
    project = c.get("project", os.path.basename(REPO))
    head = (
        "---\n"
        "session_id: %s\n"
        "date: %s\n"
        "author: %s\n"
        "model: %s\n"
        "tool: claude-code\n"
        "project: %s\n"
        "total_exchanges: 0\n"
        "first_prompt_time: \n"
        "last_prompt_time: \n"
        "---\n\n"
        "# Session Log - %s\n\n"
        "Session: `%s` | Project: `%s` | Author: `%s`\n\n"
        "---\n\n"
    ) % (session_id, ts.strftime("%Y-%m-%d"), author, model or "unknown",
         project, ts.strftime("%Y-%m-%d"), short, project, author)
    os.makedirs(LOG_DIR, exist_ok=True)
    open(path, "w").write(head)
    return path


def append(path, kind, num, session_id, model, text):
    short = session_id.split("-")[0]
    block = (
        "[LOG_ENTRY type=%s num=%d session=%s]\n"
        "timestamp: %s\n"
        "model: %s\n\n"
        "%s\n\n\n"
    ) % (kind, num, short, now_iso(), model or "unknown", text)
    with open(path, "a") as f:
        f.write(block)


def handle_prompt(data):
    sid = data.get("session_id") or "nosession"
    prompt = data.get("prompt")
    if prompt is None:
        # Be loud about an unexpected payload rather than silently logging nothing.
        note_error("UserPromptSubmit had no 'prompt'. keys=%s" % sorted(data.keys()))
        prompt = data.get("user_prompt") or data.get("message") or ""
    if not str(prompt).strip():
        return

    entries = read_transcript(data.get("transcript_path"))
    path = find_log(sid)
    model = last_model(entries) or model_from_log(path) or "unknown"
    if not path:
        path = create_log(sid, model)

    num = count_entries(path, "PROMPT") + 1
    append(path, "PROMPT", num, sid, model, str(prompt).rstrip())
    refresh_frontmatter(path, sid, model)


def handle_response(data):
    sid = data.get("session_id") or "nosession"
    path = find_log(sid)
    if not path:
        # A Stop with no prompt recorded means nothing to pair against.
        return

    n_prompt = count_entries(path, "PROMPT")
    n_resp = count_entries(path, "RESPONSE")
    if n_resp >= n_prompt:
        return  # Stop fired twice for one turn; don't double-write.

    entries = read_transcript(data.get("transcript_path"))
    text, model = final_assistant(entries)
    if text is None:
        note_error("Stop: no assistant text found. transcript=%s" % data.get("transcript_path"))
        text = "(no final text response captured for this turn)"
        model = model_from_log(path) or "unknown"

    append(path, "RESPONSE", n_prompt, sid, model, text)
    refresh_frontmatter(path, sid, model)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        note_error("unparseable stdin for mode=%s: %s" % (mode, raw[:400]))
        return
    if mode == "prompt":
        handle_prompt(data)
    elif mode == "response":
        handle_response(data)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        note_error("crash: " + traceback.format_exc().replace("\n", " | "))
