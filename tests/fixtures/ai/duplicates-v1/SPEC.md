# duplicates-v1 label specification

Version 1.0.0. Authored before the first evaluation, without scoring or relabeling
to favor the matcher. All requests are invented; identifiers use synthetic-penny.
No customer data, address, credential or provider call belongs in this corpus.

There are 300 labeled request pairs across 100 distinct software needs. Each
candidate has a lexical positive, a hard negative, and a paraphrase positive:
200 positives, 100 hard negatives (one third of all pairs), and 100 paraphrases.
Pairs are authored judgments, not independent samples of customer traffic.
The three related pairs form a cluster; this is a reproducible evaluation set,
not a statistical estimate of deployment accuracy.

A duplicate asks for the same user outcome. A hard negative shares whole terms
but changes the requested operation or result: downloading invoices versus
correcting them, for example. A paraphrase asks for the same outcome without
sharing any whole term of length greater than one after Unicode letter and
number tokenization and lowercasing. Titles carry the complete need; descriptions
are intentionally empty. The public suggestion door takes the query title.

## Evaluation through Penny

Build first, then run:

    pnpm run eval:ai -- --set duplicates-v1
    pnpm run eval:ai -- --set duplicates-v1 --output /tmp/duplicates-report.json

The command migrates fresh temporary D1 storage and loads the 100 distinct
candidate requests as approved public requests. Every query goes through
/api/public/requests/suggestions, the emitted production Worker, and
./src/core/features/requests/suggestions.ts. No alternative matcher or model
adapter supplies predictions. The runtime has no provider credentials, refuses
outbound traffic, and deletes only its own temporary store on exit. It never
opens the installation database or reads private local settings.

For each labeled pair, a prediction is positive when that candidate occurs in
the native response: at least one matched term, ranked within the route's five
returned suggestions. Every query competes against the same 100 candidates.
Other returned candidates are unlabeled for that query; they are not silently
counted as false positives. TP, FP, FN and TN therefore count labeled pairs.
Precision is TP divided by TP plus FP, recall is TP divided by TP plus FN, and
F1 is twice TP divided by twice TP plus FP plus FN. Undefined ratios are null.
Top-five recall counts positive pairs returned in the first five; it equals
recall for this bounded production door. Paraphrase recall uses only the labeled
paraphrase positives. Per-pair observations permit independent reconciliation.

Reports include version, SHA-256 of the original corpus bytes, corpus counts,
confusion matrix, metrics, top-five and paraphrase recall, zero provider cost,
and the inapplicability of model and prompt versions. AI-001's precision, recall
and top-five bars are shown as comparisons, not lexical quality gates. Its
paraphrase improvement bar needs a configured semantic model on this same set.
A weak lexical score is the floor to beat, not a command failure or a semantic
capability claim. Malformed labels, insufficient mix, route failures, unexpected
provider attempts and report-write failures do fail the command.

Keep this initial corpus stable. Never remove, shrink or relabel cases based on
scores. Changes to examples or judgments require a new documented version.
This set does not satisfy the other AI-011 corpora, configured-model reports,
degraded-model gate, dated model receipts or R-13 theme adjudication.

The existing command journey also writes a temporary control corpus beside its
temporary report. Six identical export needs compete for five response slots;
correction requests are labeled as different needs. Known returned ranks and
the excluded sixth candidate exercise true positives, false positives, false
negatives and true negatives independently of the scorer's formulas. The
authored corpus above stays unchanged; this command control does not contribute
to its reported quality or label counts.
