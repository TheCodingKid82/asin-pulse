# ASIN Pulse 2.1 — Sales & Sourcing

A Chrome extension with an Amazon monthly purchase panel and a retail category sourcing desk. The source lives in C:\Users\jweir\OneDrive\Documents\asin-pulse.

## Scan a category

1. Open **Sourcing desk** from the extension popup or **Retail sourcing desk** from its Amazon product panel.
2. Choose **Target, Walmart, Kohl’s, Macy’s, or JCPenney** and a category such as toys or clothing. You can also paste a specific category URL from that store.
3. Leave **All products in category** selected for a whole-category attempt. The 10/50/100 options are explicitly limited scans.
4. Click **Start scan** and allow Chrome access to the selected store. Keep the sourcing desk open and your computer awake.
5. The extension follows readable subcategories, pagination, Load more buttons, and lazy-loaded cards. Department carousels do not count as a complete category. It deduplicates product URLs, then opens retail details and Amazon search/product pages in one helper tab. Large categories may take hours. Product reading starts when the relevant data settles, without waiting for ads to finish. Brand/model searches and repeated-ASIN caching reduce unnecessary navigation. The dashboard shows measured time per checked product.
6. A verification page pauses the scan. Use **Open scan tab**, handle the page yourself, then **Resume scan**. Saved checkpoints preserve collected products. **Match collected products** deliberately ends discovery early and marks coverage incomplete.
7. Enter your costs, filter results, and use **Review** to inspect identifiers, sizes, colors, packs, prices, stock, and match evidence. Confirm matches after checking both listings; star opportunities to save them. **Export results** exports the current filtered rows. **Export scan audit** saves all candidates, rejected search matches, costs and page timings as JSON. **Recheck collected products** creates a new scan of the collected list and preserves the original scan.

**Live limitations:** these are browser-based adapters, not licensed retailer feeds. The installed version 2.0 collected 146 Target landing-page products and checked nine before pausing. Seven of its nine selected candidates were inaccurate. Version 2.1 addresses those cases, but the live rescan in an isolated test profile paused at Target verification. A successful complete live category scan and a profitable live opportunity have not yet been demonstrated. Whole-category mode attempts every readable result. Inaccessible pages, unavailable pagination, and inventory hidden by a retailer can prevent full coverage. “Reached the end of readable category results” describes the traversal, not a guarantee that every SKU was exposed. Category listings can group clothing variations; the extension does not enumerate every size/color combination. Unresolved variations require review.

This implements the requested core sourcing workflow. It does not reproduce Tactical Arbitrage’s store coverage, licensed datasets, infrastructure, or commercial service guarantees.

## Matches and profit

- **UPC / GTIN match:** a shared valid identifier with no detected attribute conflicts. Still inspect both listings.
- **Brand + model match:** the brand and model agree with no detected variation conflicts. LEGO set numbers are recognized in titles. UPC evidence is still preferable.
- **Needs review:** similar title or incomplete variation information. These candidates require confirmation before price differences and profit appear.
- **Weak candidate:** excluded from opportunity filters until manually confirmed.
- **Conflict:** different identifiers, pack quantities, sizes, brands, models, or colors. Excluded from profit opportunities.
- **Confirmed:** you checked the match yourself. This does not verify your Amazon selling eligibility.

Enter the **FBA fulfillment fee** before relying on net profit. No default FBA fee is invented. The initial 15% referral rate and $0.30 minimum are editable assumptions, not retrieved fees. Categories have different fee schedules. Review offers per-product FBA/referral overrides. See [Amazon’s fee information](https://sell.amazon.com/pricing).

The calculation uses USD prices only:

**Acquisition** = retail price × (1 − discount %) × (1 + purchase tax %) + retail shipping + prep + inbound shipping.

**Estimated profit** = Amazon price − acquisition − max(referral %, minimum referral) − FBA fee − other costs.

**ROI** = estimated profit ÷ acquisition × 100.

Add storage, closing fees, returns allowances, and other relevant expenses to your assumptions. Membership prices, coupon eligibility, shipping allocations, tax treatment, sale restrictions, and selling eligibility need your checks. Prices and signals are snapshots. The extension does not purchase items, add to carts, verify eligibility, estimate your Buy Box share, or retrieve exact Amazon fulfillment fees.

## Monthly demand on Amazon

On an English Amazon.com, Amazon.ca, or Amazon.co.uk product page, click the green **ASIN Pulse** button. It shows the selected ASIN, monthly purchase badge, sales rank, price, and source. A badge such as “1K+ bought in past month” displays as “1,000+”. This is an approximate purchase signal, **not exact units sold per month**. Missing data is unavailable, never zero. Rank is not converted to an invented sales estimate.

Select a variation first. If Amazon leaves the previous variation’s badge unchanged, refresh the product page. The sourcing desk uses Amazon.com/USD; the monthly panel also supports Canada and the UK.

No subscription is needed for visible page data. Optional Keepa access requires an API key, which has not been provided or configured. A Keepa account alone may not include API access. **Check Keepa data** makes an explicit request, may consume tokens, and caches a count for 24 hours or missing data for 1 hour. Keepa’s monthlySold is a purchase bracket, not an independent exact-sales figure. The sourcing scanner does not automatically call Keepa.

## CSV and saved work

Import a UTF-8 CSV with title, url, price, currency and optional upc, brand, model, pack, color, size, asin columns. URLs must belong to the five supported retailers; specify USD. UPC checksums must be valid. Imports accept up to 500 rows and 5 MB. PRODUCT-IMPORT-TEMPLATE.csv contains headers only. An imported or captured page is a supplied product list, not a whole category.

Scans, reviews, stars, and cost assumptions remain in this Chrome profile across dashboard reloads. Keep the dashboard open to run a scan. Closing it interrupts work; reopen to resume. Only one category scan runs at a time. Export important results before uninstalling, which removes the extension’s Chrome storage.

## Privacy and permissions

- Automatic content scripts are limited to HTTPS www.amazon.com, www.amazon.ca, and www.amazon.co.uk. The panel appears only on product pages.
- Retail access is optional and requested per store when starting/resuming. activeTab allows deliberate popup capture; scripting reads supported pages. No all-sites or browsing-history permission is requested.
- Sourcing sends product titles, models, or UPCs to Amazon search and opens retailer/product URLs in your normal browser session. Normal site cookies and requests apply. Images load from their supplied hosts. The monthly panel itself needs no external data request.
- storage and unlimitedStorage hold scans, assumptions, reviews, and optional Keepa key/cache locally. Access is restricted to trusted extension pages and the worker; content scripts cannot read the key. Data is not Chrome-synced or encrypted by this extension. OneDrive syncs the source folder according to your settings, not Chrome’s extension storage.
- Optional api.keepa.com access is enabled only when configuring a key; requests omit cookies. There is no analytics service, remote executable code, cart manipulation, or automated checkout.

## References

- [Amazon Sales trend explanation](https://sellercentral.amazon.com/seller-forums/discussions/t/04f56c0edc15e6ae30621c88bfce1bdf)
- [Keepa product fields](https://keepa.com/api-docs/product-object.html)
- [Keepa product request](https://keepa.com/api-docs/product.html)
- [Chrome installation and reload guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

See SETUP.md and TEST-REPORT.md for setup status and test coverage.

