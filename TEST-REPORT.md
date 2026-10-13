# ASIN Pulse 2.2 verification

Verified on October 13, 2026.

## Automated coverage

The 21-test Node suite covers retailer URL validation, identity/variation conflicts, rank extraction, inclusive price/rank boundaries, unknown-value exclusion, price spread without invented fees, CSV import/export, scan checkpoints and resume, pagination/deduplication, Carter’s exact-size expansion, and sourcing-desk filtering/export/settings persistence.

Parser regressions include real page fragments from Carter’s and Boscov’s. These are local replay tests, not assertions that future retailer pages will never change.

The release workflow loads the packaged extension in isolated Chromium to verify its real storage, filters, and self-reload/reopen behavior. It also runs the packaged Windows installer twice: a fresh installation and an update preserving the stable installation path and rollback copy. Only successful runs publish a release.

## Live observations

- Carter’s baby-gear category: 48 readable product cards, displayed total 391, Load More detected.
- Carter’s Magic Wand: $9.00, Skip Hop, pink, model 9K176510, UPC 194135313606, in stock.
- Carter’s sleep-bag style: four distinct size-specific SKUs and UPCs exposed and parsed.
- Boscov’s toys category: 36 readable cards, displayed total 2,042, next-page button detected.
- Boscov’s Mega Bloks Chomp Dinosaur: $21.99, UPC 194735379385, readable product data.
- Amazon search for that UPC in Zen: matching product result B0G43TKPJW displayed at $14.98. This is not a lower-retail-price opportunity.
- The separate automated test browser received Amazon’s “Sorry! Something went wrong!” response. The scanner treats this as a blocked/interrupted read rather than a completed search with no match.

- The separate test browser received Kohl’s “Access Denied” response for its toys category; this is not a successful Kohl’s scan.

## Remaining boundaries

No successful exhaustive, uninterrupted live category scan across all five retailers is claimed. No installation or verification on Jeffrey’s own Windows/Chrome profile has occurred. Site access checks, region/variant differences, and future markup changes may require attention. Walmart, Target, and Kohl’s were inherited adapters and must not be treated as freshly certified end to end merely because the new unit tests pass.

The GitHub/desktop update flow requires one initial Load unpacked action in Chrome. Automatic desktop downloads require a public repository; private-repository users must download the release while signed in and run its bundled setup. Chrome Web Store publishing is not configured.
