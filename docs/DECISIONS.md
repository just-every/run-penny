# The decision loop

This page is for the person who runs Penny: the operator. It follows one piece of customer feedback from the first note to a published release, using the operator app at `/app`. Invited operators share product access; the installation owner manages installation controls.

The operator app has these sections: Overview, Feedback (your evidence inbox), Moderation, Decisions, Roadmap, Releases, Accounts, Feedback settings and Data. Start on **Overview**, which lists what needs you: requests to moderate, evidence awaiting review, decisions ready to commit, status updates waiting to be published and shipped items with no release.

## 1. Record evidence

Evidence is something a customer or prospect said, kept in their own words. Open **Feedback** and choose **Record evidence**. Each item holds:

- **Source:** a sales call, a support conversation, an interview, an email, or a free-text label you write.
- **Original wording:** what was said, pasted as it came.
- **Observed time:** when it happened, as a date and time.
- **Named speaker and account:** both optional. You supply them. Penny never guesses who said something or which account they belong to.

Requests that customers submit through the portal arrive here too, as unreviewed evidence with the visitor's original wording.

On any evidence item, **Review and link evidence** lets you:

- link it to a request, or to a candidate bet in a decision, as **Supports** or **Contradicts**;
- mark it reviewed with a reason, and return it to unreviewed later;
- create a request or a decision straight from it.

Linking does not mark anything reviewed, and linking or unlinking never changes the evidence itself. One item can back several bets. When recording evidence, you can select its account, requests and bets together; they appear together as soon as the evidence is saved. You can also connect new evidence to a published release.

An evidence item can have private attachments and later wording versions. Editing wording keeps the item's identity and all earlier versions. Only operators can read these versions and files, even when a linked request is public. The Accounts page shows commercial context, requesters, evidence in observed-time order, and linked requests and decisions. None of this private context is copied to the portal or requester email.

Before a request is public, someone needs to approve it in **Moderation**. That page, and what customers see, is covered in [The public portal](/docs/portal).

## Assign follow-up

Every request and evidence item has an optional **Accountable owner**. Select an
active operator and **Save owner**, or choose **Unassigned**. Reassignment keeps
the record and its history intact. Ownership stays private.

In **Feedback settings → Capture ownership**, choose a default for each board.
New requests and their captured evidence take that owner. For manually recorded,
unlinked evidence, choose **Capture board (optional)** to use its default. A
changed default applies only to future captures; an inactive operator is never
assigned automatically. Theme defaults are not available yet.

**Feedback → My queue** shows your assigned requests, unreviewed evidence and
requester comments. A reassignment moves work between operators' queues. Review
held comments in Moderation, then use **Mark handled** when a public comment no
longer needs your attention. Ownership and handled-comment history travel in a
product backup, without granting operator sign-in authority.

## 2. Build a decision

A decision is a question your team has to answer, such as "How should customers export their data?" Open **Decisions** and choose **Create decision**, or create one from an evidence item.

Give it an owner, then add **candidate bets**, the options you could commit to. For each bet, open **Manage this bet** to:

- set its **urgency**, **delivery shape** and **observable success measure**;
- link evidence, marking each item as supporting or contradicting that bet.

Every bet in the brief shows the same dimensions, side by side: the requesters and accounts affected, how much supporting evidence it has and the most recent time that evidence was observed, its contradicting evidence, urgency, delivery shape and success measure. Penny shows no combined score and no ranking. The comparison is there for you to judge.

A decision stays a draft until it has a question, an owner, at least one candidate bet and at least one piece of linked evidence. Then it becomes ready to commit.

## 3. Commit one bet

When you are ready, use **Commit decision**. You choose the selected bet and record:

- a **rationale**;
- an **owner** and a **confidence** level: low, medium or high;
- a **review date**.

With fewer than two bets, you also record why there was no viable alternative. Committing saves the options you declined and a snapshot of the evidence as it stood, without changing the evidence. It also creates an internal roadmap item for the bet, set to Planned.

Committing publishes nothing. The roadmap item and its mappings stay private until you approve them in the next step.

After commitment, a change of rationale or selected bet creates a revision. Earlier rationale, declined bets and evidence snapshots stay readable. Choosing another bet returns the previous bet's roadmap item to Exploring; an approved item loses its approval and gets a private status-update draft in the same transaction.

When the review date passes in the workspace timezone, the decision becomes review due. Calendar dates expire at the end of that workspace day; timestamps need an explicit timezone. Its owner gets one email and one in-app notification; the notification stays until dismissed. This changes no bet or roadmap status. Complete the review with a note and a new review date, or with a revision. A review revision retaining the date completes that schedule; change the date to schedule another reminder. Dismissing the notification alone does not complete the review.

## 4. Approve customer-safe wording and mappings

Open **Roadmap** and find the item. Your internal title, summary, notes, account impact and confidence are private. To make the item public, fill in **Approve public projection**:

- an **approved title** and **approved summary**, written for customers;
- the **public board** it belongs to;
- each **published request** it maps to. Penny suggests requests linked to the selected bet. You tick each mapping you want, and a published request can have only one approved mapping.

Approval is publication. Approving puts the item on the public roadmap and shows its status on each mapped request. Only the approved title, summary, board and status are exposed. If you change your mind, **Withdraw approval** removes the item and its request statuses from the public side and keeps every internal record.

## 5. Move the item and tell followers

Use **Move roadmap item** to change the status between Exploring, Planned, In progress, Shipped and Dropped, giving a reason each time. You can move backward, and every move is recorded. For public purposes Exploring appears as Under review, and a Dropped item leaves the public roadmap.

Each move of an approved item prepares a private draft status update naming the new status, written from your approved wording. Nothing is sent yet. Open **Releases**, and under **Pending status updates** choose **Publish status update**. Publishing:

- adds the update to the history of every mapped request;
- queues one email per eligible follower, subject to hourly coalescing and quiet hours. See [Email and notifications](/docs/email).

If you change the approval or mappings after a draft is prepared, that draft becomes stale and cannot be published. Discard it, then make the next roadmap move to prepare a fresh one.

You can also post a status update straight onto a request from its controls in **Moderation**, choosing any of the six public statuses or an internal status mapped to one, optionally pinning it above the comments and adding a public month or quarter ETA. The comment is optional except when declining. A saved status with no comment or ETA change publishes nothing. The latest direct change or approved mapped roadmap change supplies the request’s public status.

## 6. Publish a release

When items have shipped, open **Releases** and create a release draft:

- a customer-safe **title** and **body**;
- a **type**: New, Improved or Fixed;
- a publication date, an author and an optional setup or usage link;
- at least one **private tag**, created beforehand in **Feedback settings** (tags are for your own filtering; customers never see them);
- one or more **targets**, which are roadmap items that you have approved.

A release can be published only when it has a title, a body and a target, and every target is Shipped. Publishing puts it on `/portal/updates` and queues one email for each eligible recipient. The release page shows delivery counts as they are processed.

Published wording is never overwritten. Correcting it creates a new version and marks it as the current portal version; operators can still read every earlier version. A correction sends no email until you explicitly send that version as a new delivery. Sending the same version again creates no duplicate delivery command.

Requesters in the original publication snapshot can answer Adopted, Partly adopted or Not yet for each target, including after muting or unsubscribing. A changed answer records a revision; an identical answer does not. The release page shows counts, coverage and private individual context. Coverage divides current responses by the original snapshot's recipient count, both for each target and for the whole release. With several targets, whole-release coverage can exceed 100% because one recipient can answer several targets.

Outcomes and evidence recorded against a linked release appear on its decisions as post-release evidence. They do not change the evidence snapshot that supported the commitment.

## What customers are never shown

Throughout the loop, the public sees only the wording you approved. Accounts, evidence, rationale, declined bets, confidence and internal dates stay in the operator app.
