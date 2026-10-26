# duplicates-v1 label specification

Version: 1.0.0. Written on 2026-10-26 before the first model evaluation run.
All content is synthetic. No real customer, company, person, provider-formatted
secret, or provider call belongs in this set.

The immutable initial set contains 80 independent software-feature requests and
320 labeled query/candidate pairs: 80 paraphrase positives, 80 lexical positives,
120 hard negatives, and 40 easy negatives. Each corpus request has one positive
of each kind and at least one hard negative. The first 40 requests have a second
hard negative; the remaining 40 have an easy negative. IDs are globally unique
across corpus requests and pairs and follow synthetic-penny-<n>. A pair's
requestId references a corpus ID. IDs carry no semantic information.

The JSON schema is {version, corpus, pairs}. A corpus row contains {id, title,
description, evidence?}; a pair contains {id, queryTitle, requestId, duplicate,
subset}. Version is the string 1.0.0. Duplicate is a boolean. Subset is exactly
paraphrase-positive, lexical-positive, hard-negative, or easy-negative. Evidence
is optional synthetic supporting context, never an alternative source of lexical
terms. This version uses title and description only, with no evidence fields.

A duplicate asks for substantially the same user-visible capability, on the same
object, for the same purpose. Different wording, specificity that does not change
the need, and synonyms do not create a new need. Sharing a topic, screen, object,
or technical noun is insufficient. A request for a different action, audience,
constraint, lifecycle step, or outcome remains separate when shipping one would
leave the other unsatisfied. Labels reflect the stated need, without assuming
unstated requirements. These are feature requests, not existing product claims.

Use the product's exported lexicalTerms from
src/core/features/requests/suggestions.ts: lowercase Unicode letter/number runs,
deduplicated, retaining terms longer than one character. Candidate terms come
from title + newline + description. There is no stemming or stopword removal.
Every paraphrase positive has ZERO shared lexicalTerms, including common words.
Every lexical positive has at least one shared term of length >=4. Every hard
negative shares at least one such key term while expressing a different need.
Hard negatives form 37.5% of all pairs, exceeding the 30% minimum. Easy negatives
express clearly unrelated needs and have zero shared lexicalTerms. Key terms
mean whole product lexicalTerms with length >=4, not substrings.

Evaluate pair classification independently for every labeled pair, with the full
candidate title and description and the query title. Report TP, FP, FN, TN,
precision, recall and F1 overall and per subset, with zero-denominator handling
stated. The deterministic lexical baseline predicts duplicate iff overlap >0.
This construction deliberately makes that baseline miss every paraphrase and
accept every hard negative: overlap alone is not semantic equivalence.

Evaluate retrieval against the WHOLE 80-request corpus for every positive query,
never a filtered subset, pair-only candidate pool, or preselected five. The
labeled requestId is the relevant item for that query. Return at most five
distinct corpus IDs. Report recall@5 overall and separately for paraphrase and
lexical positives (hit queries / queries), plus returned-ID validity. Pair
negatives are classification probes and do not imply an exhaustive relevance
labeling for their queries across the corpus. For the lexical retrieval baseline,
retain only candidates with overlap >0, sort by overlap count descending then
corpus ID lexicographically ascending (the corpus ID serves as the product slug),
and take the first five. Do not force five results when fewer match.

Report the fixture SHA-256 with every evaluation. Validate schema, global ID
uniqueness, references, subset counts, labels and lexical constraints before a
provider run. Keep evaluation failures visible. Freeze this set before the first
model run: do not tune queries, corpus wording, labels, subset membership or
counts against model scores. Do not special-case IDs or memorize fixture text.
Any correction or addition requires a new documented set version and its own
pre-run specification; retain this version for comparable historical results.
Fixture-only checks and lexical measurements do not constitute model evidence.
