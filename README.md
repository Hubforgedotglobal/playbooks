# HubForge Playbooks

The public playbook library at https://playbooks.hubforgeglobal.com.

GitHub Pages serves the root of the `main` branch. The `CNAME` file associates this repository with the playbooks subdomain, independently of the main HubForge website.

## Adding a playbook

1. Create a folder with a short, readable name.
2. Add the supplied HTML as `index.html` and PDF as `playbook.pdf`.
3. Add a card linking to both files in the root `index.html`.
4. If a separate workbook is supplied, add `workbook/index.html` and `workbook.pdf` within that title's folder.

Only supplied, approved playbooks belong in this library.

## Growing the browsable library

Keep each card as a real linked `article.book` inside `[data-library-grid]`.
Set its `data-slug`, `data-title`, `data-order` (larger means more recently added),
space-separated `data-topics`, and matching pipe-separated `data-topic-labels`.
Search, filters, counts and sorting discover these cards at page load; there is
no separate JavaScript topic list to maintain. Preserve its existing rating form
and download links. Cards remain readable when JavaScript is disabled.

Refresh asset versions after changing library CSS or JavaScript. Do not replace
the shared reader-activity service with browser-only view or rating counts.

## Surveys and Forms package

`designing-surveys-and-forms/` contains the supplied playbook, companion workbook,
both PDFs, the one-page cheat sheet, and two XLSForm examples in `downloads/`.
The workbook saves answers on the reader's device; do not enter identifying or
sensitive respondent data.

After updating discovery or shared assets, run:

```sh
python scripts/build-playbook-social-images.py
python scripts/build-survey-discovery.py
python scripts/version-playbook-assets.py
npm test
python -m unittest discover -s tests -p 'test_*.py' -v
```

These maintenance commands run in the Replit source workspace, not GitHub Pages.
Publish static files to this repository without changing either site's CNAME.
New-title reader activity additionally requires publishing the updated Replit API.
