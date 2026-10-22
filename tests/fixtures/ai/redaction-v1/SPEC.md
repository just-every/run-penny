# redaction-v1 label specification

Version: 1.0.0. Written before the detector and its first evaluation run.
All excerpts are synthetic and carry synthetic-penny-<n> identifiers. No real
customer record, provider-formatted key or provider call belongs in this set.

The immutable initial set contains 210 excerpts: 40 US SSN positives, 40
Luhn-valid payment-card positives, 30 phone positives, 30 email positives,
30 invented credential-assignment positives, and 40 hard-negative excerpts.
Each positive has one labeled half-open character span and a kind. A span
contains the sensitive value including its internal separators, excluding the
surrounding label, punctuation and assignment delimiter. Negatives have no
sensitive spans. An exact kind and span is a true positive; unmatched detections
are false positives and unmatched labels are false negatives. Report per-kind
TP/FP/FN/TN, precision, recall and F1; TN counts excerpts with neither a label nor
a detection of that kind. Also report micro totals and the set byte hash.

SSNs have valid area/group/serial ranges and dashed, spaced or explicitly
SSN-labeled nine-digit notation. Unlabeled nine-digit order IDs are negatives.
Cards have 13–19 digits, are Luhn-valid, and use compact, space or dash grouping.
Numbers failing Luhn and long order/tracking IDs are negatives. Phone examples
use reserved fictional NANP 202-555-01xx numbers, optional +1 and parentheses,
spaces, dashes or periods. Emails use example.test addresses and include plus
tags. Credential labels contain only an invented synthetic-penny value assigned
to password, secret, api_key, access_token or credential; assignment names are
not themselves sensitive. Ordinary status/credential words and non-secret
identifiers are negatives. Dates and semantic version strings are negatives.

The default-kind bars are SSN/card recall >=0.99, phone/email/credential recall
>=0.95, and precision >=0.90 for every default kind. The runner exits nonzero if
any bar is missed. Custom patterns are proved separately through capture doors.
Never shrink or relabel this set to improve a score, special-case its identifiers,
or tune a rule to one excerpt. Changes require a new documented set version.
