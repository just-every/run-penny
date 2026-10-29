# Capture from Chrome or Edge

Penny Capture adds a selected passage and an optional screenshot to your private
feedback inbox. It uses your current Penny operator session. It never reads your
cookies, saves an API key, publishes feedback or subscribes a customer to mail.

## Install for your workspace

1. Download your Penny source and keep `integrations/browser-extension` together.
2. In Chrome open `chrome://extensions`, or in Edge open `edge://extensions`.
   Turn on Developer mode, choose **Load unpacked**, and select that folder.
3. Pin Penny Capture. On an ordinary web page open the extension and enter your
   Penny workspace origin, such as `https://penny.example.com`. Grant access to
   that installation. HTTP is allowed only on localhost for development.
4. Sign in to that workspace as an operator. No browser-store listing is needed
   for unpacked installation; Chrome Web Store and Edge Add-ons review have not
   been performed.

## Review and save

Select the passage on the page, open Penny Capture and choose **Review capture**.
For a screenshot, select **Include a screenshot of the visible tab** first. A
screenshot-only capture is also supported. Browser-internal pages and protected
browser-store pages cannot be read by an extension; use their ordinary source
page instead. Only the selected top-frame text and visible tab are captured;
there is no whole-page crawler, automatic capture or iframe traversal. Form
fields, including passwords, are never used as selected text.

Penny opens its own signed-in review page. Review the original URL, excerpt,
source author and source time (capture time is prefilled when the source time
is unknown). Remove private URL parameters yourself. Current installation
redaction rules apply before text is stored. Screenshots keep their original
bytes and can contain private information; inspect the preview or remove it.

Optionally search for and explicitly select a customer and a request. Selecting
a customer does not verify an address or grant email permission. To cast a proxy
vote, select both and check **Record a proxy vote from this excerpt**. Repeated
votes from that customer count once. The private attribution names the recorder
and captured source; the public portal sees only the aggregate vote total.

Choose **Save to inbox**. The evidence arrives unreviewed with a private screenshot
attachment. Completion runs on the next scheduled Worker event (normally within a
minute). Choose **Check completion** or **Refresh progress** to confirm it. The
capture’s owner is the operator who queued or explicitly resumed it. Each request
and completion transaction rechecks the operator’s current native session.

## Interrupted or stopped work

Keep the review open until completion is confirmed. **Resume last review** in the
extension restores its draft for this browser session. The draft lives only in
extension session storage; closing the browser clears it. Saving again uses the
same capture identity and cannot create another inbox item or vote. Choices lock
once the evidence checkpoint is confirmed. To change them, start a new capture.

The inbox and capture page show unfinished work and its failure. An interrupted
upload or completion is marked failed after five minutes. Retry deliberately;
there is no silent replay of a failed job. If an upload writer was interrupted,
first stop the prior upload, then use the evidence card’s upload recovery to
release that writer and reattach the original screenshot. **Stop capture** stops
unfinished completion; the evidence already captured remains available. A vote
already committed before a stop remains a vote and is visible in attribution.

Signing out refuses the next extension save and unfinished background completion.
Sign in again and resume deliberately. **Disconnect workspace** clears the saved
workspace permission and extension draft; sign out in Penny to end its session.

## Check a source and its retention

Open the exact captured source page, select the same passage (or the same visible
area for a screenshot-only capture), and choose **Check a saved source**. This
explicit action checks only that selected URL in the browser, including its HEAD
response. In Penny choose the matching capture. A changed selection marks the
source changed without replacing its captured version. A 401, 403, 404 or 410
marks it removed. Other failures ask for a deliberate retry. Penny does not crawl
source pages or monitor them while the extension is closed. A previously removed
source cannot be restored by a late response.

The owner’s review sets how many days a removed source’s excerpt is retained (default
30, from 0 to 365). Other operators use the default 30-day window. Scheduled work purges all its captured text versions after that
window and records an audit event. Binary screenshot originals remain private
attachments; use the Data evidence erasure preview to remove those originals too.
Source links and hashes remain provenance until erasure. Archives include captures
and original attachments but exclude operator sessions and extension settings.
Restored unfinished captures are held for signed-in review and cannot restart
themselves. A source rollback keeps the additive database schema; stop the old
Worker before upgrading and reconcile held work before resuming.
