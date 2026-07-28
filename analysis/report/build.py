#!/usr/bin/env python3
"""Inline every asset into a single self-contained page.

A published artifact has no network access, so all CSS, JS and data must be
embedded. Paths resolve relative to this file, not the working directory.

Usage:  python report/build.py            # from anywhere
Env:    ANALYSIS_DIR (default: parent of this file), OUT (default: report.html)
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.environ.get('ANALYSIS_DIR', os.path.join(HERE, '..')).rstrip('/') + '/'
here = lambda f: open(os.path.join(HERE, f)).read()

missing = [f for f in ('report_data_compact.json', 'findings_extra.json', 'lookup_data.json')
           if not os.path.exists(A + f)]
if missing:
    sys.exit('Missing generated input(s): ' + ', '.join(missing) +
             '\nRun:  python build_report_data.py <export.csv>'
             '\n      python build_lookup.py <export.csv> -o lookup_data.json')

head   = here('head.html')
acss   = here('account_css.html')
body   = here('body.html')
method = here('method.html')
app    = here('app.js')
acct   = here('account.js')
rd     = open(A+'report_data_compact.json').read()
extra  = open(A+'findings_extra.json').read()
lookup = open(A+'lookup_data.json').read()

# Inject data. The methodology markup goes in as a JS string literal so it is
# rendered by the same code path as the charts it contains.
app = (app.replace('__RD__', rd)
          .replace('__EXTRA__', extra)
          .replace('__METHOD__', json.dumps(method)))

safe = lookup.replace('<', '\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
assert '</script>' not in safe

out = (head + acss + body
       + '<script type="application/json" id="lookup-data">' + safe + '</script>\n'
       + '<script>\n' + app + '\n' + acct + '\n</script>\n')
out_path = os.environ.get('OUT', os.path.join(HERE,'report.html'))
open(out_path,'w').write(out)
print('wrote', out_path)
print('bytes:', len(out))
