#!/usr/bin/env python3
"""
Pulls the DM and chat related bits out of a TikTok APK, APKM (bundle) or IPA, and compares two
of them. Only the standard library is used, so there is nothing to install.

  python3 analyze_app.py scan apps/tiktok.apk  --out reports/android.json
  python3 analyze_app.py scan apps/tiktok.ipa  --out reports/ios.json
  python3 analyze_app.py compare reports/android.json reports/ios.json --out reports/compare.md

The reports are small text files. Commit them, never the app files.
"""
import argparse
import io
import json
import plistlib
import re
import sys
import zipfile
from collections import defaultdict

# Feature topics. Each topic is a list of word patterns. A string, file name or class name that
# matches a pattern gets tagged with that topic.
TOPICS = {
    'messages': [r'messag', r'\bdm\b', r'\bdms\b', r'direct[ _]?message', r'inbox', r'conversation', r'\bchat'],
    'voice': [r'voice[ _]?(message|note|memo)', r'audio[ _]?message', r'hold to (record|talk)', r'record(ing)? (a )?voice'],
    'media': [r'send (a )?(photo|video|image|picture)', r'photo', r'camera roll', r'gallery', r'\bgif\b', r'sticker'],
    'reactions': [r'reaction', r'\breact\b', r'double[ -]?tap', r'emoji', r'\blike (this )?message'],
    'reply': [r'\breply\b', r'\bquote\b', r'forward', r'swipe to reply'],
    'edit_delete': [r'unsend', r'\brecall\b', r'retract', r'delete (for|message)', r'\bedit(ed)? message', r'\bedited\b'],
    'status': [r'typing', r'read receipt', r'\bseen\b', r'\bread\b by', r'last seen', r'active now', r'online'],
    'groups': [r'group[ _]?chat', r'\bgroup\b', r'add (members|people)', r'\bmembers?\b', r'invite link'],
    'organize': [r'\bpin(ned)?\b', r'\bmute\b', r'archive', r'\bfolder', r'\bfilter', r'\bsearch (in )?chat', r'mark as (read|unread)'],
    'privacy': [r'who can (send|message)', r'message request', r'\bblock\b', r'restrict', r'disappear', r'vanish', r'self[- ]destruct', r'view once', r'screenshot'],
    'tools': [r'translat', r'schedule', r'auto[- ]?reply', r'quick repl', r'saved repl', r'suggest(ed)? repl', r'smart repl', r'\bnudge\b', r'\bpoke\b'],
    'share': [r'share (to|with|via)', r'send to', r'share (video|post|profile|sound|link)'],
    'calls': [r'voice call', r'video call', r'\bcall\b', r'\bcalls\b'],
    'ai': [r'\bai\b', r'assistant', r'\bbot\b', r'summar', r'my ai'],
}
TOPIC_RE = {t: re.compile('|'.join(p), re.I) for t, p in TOPICS.items()}
ANY_RE = re.compile('|'.join(p for ps in TOPICS.values() for p in ps), re.I)

# Words that mean a code symbol is probably about messaging.
SYMBOL_HINT = re.compile(r'(\bim\b|/im/|_im_|\.im\.|chat|inbox|conversation|message|msg|(?-i:[a-z]Dm[A-Z]|\bDM[A-Z]|_dm_)|/dm/|stranger|reaction|sticker|unsend|recall)', re.I)

MAX_UI = 6000
MAX_SYMBOLS = 4000
MAX_FILES = 4000
CHUNK = 32 * 1024 * 1024
TAIL = 1024

ASCII_RUN = re.compile(rb'[\x20-\x7e]{5,400}')
UTF16_RUN = re.compile(rb'(?:[\x20-\x7e]\x00){5,400}')


def runs(data):
    """Printable text runs, both ASCII and UTF-16 LE."""
    for m in ASCII_RUN.finditer(data):
        yield m.group().decode('ascii', 'ignore')
    for m in UTF16_RUN.finditer(data):
        yield m.group().decode('utf-16le', 'ignore')


def stream_runs(fp):
    """Same as runs() but streams a big file in chunks, so a 300 MB binary is fine."""
    tail = b''
    while True:
        block = fp.read(CHUNK)
        if not block:
            break
        data = tail + block
        yield from runs(data)
        tail = data[-TAIL:]
    if tail:
        yield from runs(tail)


def looks_like_ui_text(s):
    s = s.strip()
    if len(s) < 6 or len(s) > 200 or ' ' not in s:
        return False
    letters = sum(c.isalpha() for c in s)
    if letters < len(s) * 0.6:
        return False
    if re.search(r'[{}<>;=\\]|https?://|\.(java|kt|so|xml)\b', s):
        return False
    return True


def topics_for(s):
    return [t for t, rx in TOPIC_RE.items() if rx.search(s)]


class Collector:
    def __init__(self):
        self.ui = {}        # text -> topics
        self.symbols = {}   # symbol -> topics
        self.files = {}     # path -> topics
        self.notes = []

    def add_ui(self, s):
        s = re.sub(r'^[^A-Za-z0-9]+', '', s.strip())
        if s in self.ui or not looks_like_ui_text(s):
            return
        tp = topics_for(s)
        if tp and len(self.ui) < MAX_UI:
            self.ui[s] = tp

    def add_symbol(self, s):
        if s in self.symbols or len(self.symbols) >= MAX_SYMBOLS:
            return
        if not SYMBOL_HINT.search(s):
            return
        if not re.fullmatch(r'[A-Za-z0-9_/\.\$\-\[\]<>;:]{6,200}', s):
            return
        self.symbols[s] = topics_for(s) or ['code']

    def add_file(self, path):
        if path in self.files or len(self.files) >= MAX_FILES:
            return
        tp = topics_for(path.replace('_', ' ').replace('-', ' '))
        if tp or SYMBOL_HINT.search(path):
            self.files[path] = tp or ['code']

    def feed_runs(self, it):
        for s in it:
            self.add_ui(s)
            self.add_symbol(s)

    def result(self, platform, source):
        return {
            'platform': platform,
            'source': source,
            'notes': self.notes,
            'ui_strings': [{'text': k, 'topics': v} for k, v in sorted(self.ui.items())],
            'symbols': [{'name': k, 'topics': v} for k, v in sorted(self.symbols.items())],
            'files': [{'path': k, 'topics': v} for k, v in sorted(self.files.items())],
        }


def scan_apk(zf, col, label=''):
    for info in zf.infolist():
        n = info.filename
        col.add_file(label + n)
        base = n.rsplit('/', 1)[-1]
        if n == 'resources.arsc' or n == 'AndroidManifest.xml' or n.startswith('res/') and n.endswith('.xml'):
            with zf.open(info) as fp:
                col.feed_runs(stream_runs(fp))
        elif re.fullmatch(r'classes\d*\.dex', base):
            with zf.open(info) as fp:
                col.feed_runs(stream_runs(fp))
        elif n.startswith('assets/') and re.search(r'\.(json|txt|xml|properties|html|js)$', n):
            if info.file_size < 8 * 1024 * 1024:
                with zf.open(info) as fp:
                    col.feed_runs(stream_runs(fp))


def parse_strings_file(raw):
    """Localizable.strings can be a binary plist, an XML plist or the old text format."""
    try:
        d = plistlib.loads(raw)
        if isinstance(d, dict):
            return {str(k): str(v) for k, v in d.items()}
    except Exception:
        pass
    out = {}
    for enc in ('utf-8', 'utf-16'):
        try:
            text = raw.decode(enc)
            break
        except Exception:
            text = ''
    for m in re.finditer(r'"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;', text):
        out[m.group(1)] = m.group(2)
    return out


def scan_ipa(zf, col):
    app_dirs = sorted({n.split('/')[1] for n in zf.namelist() if n.startswith('Payload/') and n.count('/') >= 2 and n.split('/')[1].endswith('.app')})
    if not app_dirs:
        col.notes.append('No Payload/*.app found. Is this really an IPA?')
        return
    app = app_dirs[0]
    prefix = 'Payload/' + app + '/'
    main_binary = prefix + app[:-4]
    for info in zf.infolist():
        n = info.filename
        col.add_file(n)
        if not n.startswith(prefix):
            continue
        rel = n[len(prefix):]
        lang = rel.split('/')[0]
        if rel.endswith('.strings') and (lang in ('en.lproj', 'Base.lproj') or '/' not in rel):
            with zf.open(info) as fp:
                for k, v in parse_strings_file(fp.read()).items():
                    col.add_ui(v)
                    col.add_ui(k.replace('_', ' '))
        elif n == main_binary:
            with zf.open(info) as fp:
                col.feed_runs(stream_runs(fp))
        elif rel.startswith('Frameworks/') and rel.count('/') == 2 and not rel.endswith('/'):
            # Frameworks/Name.framework/Name is the framework binary
            fw = rel.split('/')[1]
            if fw.endswith('.framework') and rel.endswith('/' + fw[:-10]) and re.search(r'(chat|message|im|inbox|dm)', fw, re.I):
                with zf.open(info) as fp:
                    col.feed_runs(stream_runs(fp))


def scan(path):
    col = Collector()
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        if any(n.startswith('Payload/') for n in names):
            platform = 'ios'
            scan_ipa(zf, col)
        else:
            platform = 'android'
            if 'AndroidManifest.xml' in names:
                scan_apk(zf, col)
            else:
                nested = [n for n in names if n.endswith('.apk')]
                col.notes.append('Bundle with %d split APKs' % len(nested))
                for n in nested:
                    with zf.open(n) as fp:
                        data = fp.read()
                    with zipfile.ZipFile(io.BytesIO(data)) as inner:
                        scan_apk(inner, col, label=n + ':')
    return col.result(platform, path.rsplit('/', 1)[-1])


def norm(s):
    s = re.sub(r'%\d*\$?[sdf@]|\{\d*\}|\{[a-z_]+\}|%[sd@]', '#', s.lower())
    return re.sub(r'[^a-z# ]+', '', s).strip()


def compare(a, b):
    def by_norm(rep):
        d = defaultdict(list)
        for item in rep['ui_strings']:
            d[norm(item['text'])].append(item)
        return d
    A, B = by_norm(a), by_norm(b)
    only_a = sorted(k for k in A if k and k not in B)
    only_b = sorted(k for k in B if k and k not in A)
    both = sorted(k for k in A if k in B and k)

    lines = []
    lines.append('# %s vs %s' % (a['platform'], b['platform']))
    lines.append('')
    lines.append('Sources: %s and %s' % (a['source'], b['source']))
    lines.append('')

    def topic_counts(rep):
        c = defaultdict(int)
        for it in rep['ui_strings']:
            for t in it['topics']:
                c[t] += 1
        return c
    ca, cb = topic_counts(a), topic_counts(b)
    lines.append('## UI strings per topic')
    lines.append('')
    lines.append('| topic | %s | %s |' % (a['platform'], b['platform']))
    lines.append('|---|---|---|')
    for t in TOPICS:
        lines.append('| %s | %d | %d |' % (t, ca.get(t, 0), cb.get(t, 0)))
    lines.append('')

    def section(title, keys, src):
        lines.append('## %s (%d)' % (title, len(keys)))
        lines.append('')
        by_topic = defaultdict(list)
        for k in keys:
            it = src[k][0]
            by_topic[(it['topics'] or ['other'])[0]].append(it['text'])
        for t in TOPICS:
            if by_topic.get(t):
                lines.append('### %s' % t)
                for text in by_topic[t][:120]:
                    lines.append('- ' + text)
                lines.append('')

    section('Only in %s' % a['platform'], only_a, A)
    section('Only in %s' % b['platform'], only_b, B)
    lines.append('## Shared strings: %d' % len(both))
    lines.append('')
    lines.append('## Layout, class and file names that mention messaging')
    lines.append('')
    for rep in (a, b):
        lines.append('### %s files (%d)' % (rep['platform'], len(rep['files'])))
        for it in rep['files'][:300]:
            lines.append('- %s' % it['path'])
        lines.append('')
        lines.append('### %s code symbols (%d)' % (rep['platform'], len(rep['symbols'])))
        for it in rep['symbols'][:300]:
            lines.append('- %s' % it['name'])
        lines.append('')
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('scan')
    s.add_argument('app')
    s.add_argument('--out', required=True)
    c = sub.add_parser('compare')
    c.add_argument('a')
    c.add_argument('b')
    c.add_argument('--out', required=True)
    args = ap.parse_args()

    if args.cmd == 'scan':
        rep = scan(args.app)
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump(rep, f, indent=1, ensure_ascii=False)
        print('%s: %d UI strings, %d symbols, %d files -> %s' % (
            rep['platform'], len(rep['ui_strings']), len(rep['symbols']), len(rep['files']), args.out))
        for n in rep['notes']:
            print('note:', n)
    else:
        a = json.load(open(args.a, encoding='utf-8'))
        b = json.load(open(args.b, encoding='utf-8'))
        text = compare(a, b)
        with open(args.out, 'w', encoding='utf-8') as f:
            f.write(text)
        print('wrote', args.out, '(%d bytes)' % len(text))


if __name__ == '__main__':
    sys.exit(main())
