# The Tipping Station July Dashboard

Static July 2026 dashboard for The Tipping Station, styled to sit naturally beside `nexus-tips.com`.

## Preview

Local preview server:

```bash
python3 -m http.server 8098 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8098/
```

## Embed

For a WordPress page or marketing page, host this folder somewhere public and embed it with:

```html
<iframe
  src="https://YOUR-DASHBOARD-URL/"
  width="100%"
  height="1400"
  style="border:0;display:block;width:100%;max-width:100%;"
  loading="lazy"
></iframe>
```

## Data

`dashboard-data.json` is values-only public data generated from the July Tipping Station workbook by `build_dashboard_data.py`.
No spreadsheet formulas are shipped to the website.
