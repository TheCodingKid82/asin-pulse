# ASIN Pulse

Compare Walmart, Target, Kohl’s, Carter’s, and Boscov’s products with the same products on Amazon. Find lower retail prices and narrow the results by price and Amazon sales rank. Macy’s and JCPenney are also retained from the original app.

## Jeffrey: install once

**[Download ASIN-Pulse-Setup.cmd](https://github.com/TheCodingKid82/asin-pulse/releases/latest/download/ASIN-Pulse-Setup.cmd)** on your Windows computer and double-click it.

The helper downloads the latest tested version and opens a short setup guide. In Chrome:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked**.
3. Select `%LOCALAPPDATA%\ASINPulse\extension` (the guide shows your full folder path).

Two shortcuts appear on your desktop:

- **ASIN Pulse** opens the app.
- **Update ASIN Pulse** downloads the latest version, reloads the extension, and reopens the app. Finish or pause any running scan before updating.

Your saved scans and settings remain in the same Chrome profile. Keep using the same install folder and profile. No Git commands, Node, or development tools are needed. Chrome may display a Developer mode reminder. This is a locally installed extension, not a Chrome Web Store listing.

If the repository is private, first sign in to GitHub, open **[Latest release](https://github.com/TheCodingKid82/asin-pulse/releases/latest)**, download **ASIN-Pulse.zip**, extract it, and double-click the included **ASIN-Pulse-Setup.cmd**. Use that download-and-run path for each update; unattended downloads require a public repository.

On a Mac, download and extract ASIN-Pulse.zip, then load its `extension` folder through `chrome://extensions`. The desktop setup helper is Windows-only.

## Find products

1. Choose a retailer and category, or paste a category/product URL.
2. Choose a quick check or the whole-category option (clothing styles may expand into separate size variants), then **Start scan**. Allow access to that retailer when Chrome asks.
3. Keep the sourcing desk and scan tab open. If a website asks for a check, the scan pauses. Complete the check yourself and choose **Resume scan**.
4. Set **Result type → Retail price is lower**.
5. Set a retail or Amazon price range, minimum dollar difference, and/or Amazon sales-rank range. Lower BSR is better **within the same category**; use the rank-category field when needed. Products with unknown ranks are excluded from rank-filtered results.
6. Review the two listings. Size, color, quantity, model, and identifiers matter. Weak or uncertain candidates do not become price opportunities until reviewed and confirmed; known conflicts remain excluded.

Carter’s clothing styles that publish exact size SKUs are expanded into separate comparisons. Other retailers may not expose every variant. Unknown data stays unknown.

## Prices and profit

The **Difference** column is Amazon price minus retail price, in USD. A lower retail price alone does not mean a profitable resale. Enter your own fees and costs to calculate estimated net profit and ROI. No FBA fee is invented.

Prices, stock, rank, and purchase signals are snapshots from readable pages. The app does not verify your eligibility to sell a product, buy anything, add to carts, or guarantee that every SKU in a store is exposed. Website changes and checks can interrupt scans. The app reports incomplete coverage rather than calling it a complete scan.

The optional Keepa key is only for the Amazon monthly purchase panel. A paid API subscription is not required for the page-based sourcing workflow. A purchase badge is an approximate signal, not exact unit sales.

## Saved work and privacy

Scans, filters, cost assumptions, and reviews are stored locally in this Chrome profile. CSV export contains the currently filtered results; the audit export contains the scan evidence. Export important work before removing the extension or deleting the browser profile.

Retailer access is requested per store. Product queries go to Amazon and product pages open in your browser session. No analytics service or remote executable code is used. The updater downloads releases from this repository, verifies the archive checksum, keeps the previous extension files as a rollback copy, and never deletes Chrome profile data.

## Andrew: publish an update

Edit the source, then commit and push to `main`. GitHub Actions:

1. Runs the parser, matching, filter, and scan-engine tests.
2. Builds the install package.
3. Loads the packaged extension in Chromium and tests price/rank filters, costs, review, CSV export, and update/reload persistence.
4. Tests a fresh Windows install, a second update, desktop shortcuts, and the installed extension in Windows Chromium, including a path with spaces and Unicode.
5. Publishes a new release only if all checks pass.

The **Latest release** and **Setup.cmd** links above always point to the latest successful build. The release includes its source revision, so Jeffrey can report exactly which version he is using. For user-facing version changes, bump `manifest.json` and `package.json` together.

Developer checks:

```sh
npm ci --ignore-scripts
npm test
python3 scripts/package.py
```

See [TEST-REPORT.md](TEST-REPORT.md) for the current verification boundary.
