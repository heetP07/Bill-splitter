# Grocery Bill Splitter

This repository contains a mobile-friendly web app in [`web/`](web/). A companion Excel workbook that opens in Apple Numbers was delivered separately; it is not in this public repository because it retains the original bill data. Both split each item's price among its selected people. A taxable Yes/No choice on each item controls which items receive tax when the global Tax switch is on. The 10% and 20% controls are **discounts**; enabling both gives a combined 30% discount before tax.

## Workbook

Open the separately delivered `Grocery_Bill_Splitter_Taxable_Items.xlsx` in Excel or Apple Numbers. In **Bill Splitter**, select `Yes` under each person sharing an item, then select `Yes` in the new **Taxable?** column only for taxable items. The global **Tax** control and **Tax Rate** remain at the top. The workbook retains the original 8-person, 50-item layout and existing bill data.

## Web app

Open `web/index.html` through a local web server or GitHub Pages. Add people, upload receipt photos or PDFs, review every extracted line, choose sharers and taxable items, then read the totals. You can also add items manually. The bill is saved only in that browser's local storage; it does not sync across devices. Prices display in Canadian dollars.

Digital PDFs use browser-side text extraction. Photos and scanned PDFs use browser-side OCR. The app does not send receipt files to a server or use API keys. It downloads its pinned OCR and PDF libraries, an OCR language model, and fonts from public CDNs, so the first scan needs an internet connection. OCR can miss or misread items; compare the extracted list against the receipt before relying on the totals. PDFs are limited to 10 pages.

The web app applies the combined discount to each item, rounds that item's discounted price and tax to cents, then distributes every cent among its selected sharers. The spreadsheet retains its original unrounded formula style, so a few cents of difference can occur on bills with many split items.

## Run locally

From the project root:

```sh
python3 -m http.server 8000 --directory web
```

Visit `http://localhost:8000`. Run calculation and parsing tests with `cd web && npm test` (no package installation needed).

## Deploy on GitHub Pages

1. Push this project to the `main` branch of [heetP07/Bill-splitter](https://github.com/heetP07/Bill-splitter).
2. In the repository's **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
3. The included workflow at `.github/workflows/deploy.yml` publishes `web/` after a push to `main`. Watch the repository's **Actions** tab for the deployment result and Pages URL.
4. Open the Pages URL on your phone. Use the same URL on other devices, but note that browser-local bills do not sync.

Deployment is not verified until the GitHub Actions run succeeds and the Pages URL opens.
