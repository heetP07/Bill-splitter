# Bill Splitter

A grocery bill splitter that runs in your browser. [Open the app](https://heetp07.github.io/Bill-splitter/).

Upload a receipt photo or PDF, check the items it finds, and choose who shares each one. You can add or correct items by hand. Mark the items that are taxable, set the tax rate, and the app works out what each person owes.

The 10% and 20% switches are **discounts**, not tax rates. If you turn on both, the app takes 30% off each item before calculating tax.

## Good to know

- Bills are saved in the browser you're using. They don't sync between devices.
- Receipt scanning runs in your browser, but it needs an internet connection to load the scanning tools.
- Check scanned descriptions and prices against the receipt before splitting the bill.
- PDFs are limited to 10 pages.

## Run locally

From the repository folder, run:

```sh
python3 -m http.server 8000 --directory web
```

Then open `http://localhost:8000`. To run the tests, use `cd web && npm test`.

## Deployment

The workflow in `.github/workflows/deploy.yml` publishes the `web/` folder to GitHub Pages whenever `main` changes.
