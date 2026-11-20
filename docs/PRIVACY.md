# Privacy (GDPR)

> Status: Phase 1 baseline written by engineering. **Not legal advice** — to be
> reviewed by the data protection officer before any customer pilot. Article
> references: Regulation (EU) 2016/679, https://eur-lex.europa.eu/eli/reg/2016/679/oj

## Roles

| Party                                 | GDPR role                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Customer organisation using CLEAN     | **Controller** of the contact and deal data its sellers record                                    |
| CLEAN (the service provider)          | **Processor** acting on the customer's instructions — needs a data processing agreement (Art. 28) |
| AI or connector providers (Phase 2–3) | Sub-processors, listed and contracted; none in Phase 1 (AI off, no connectors)                    |

## Personal data processed

| Data                                                              | Subjects                            | Source                          | Lawful basis (for the controller)                                                                           |
| ----------------------------------------------------------------- | ----------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Name, email, role of users                                        | Customer's employees                | Sign-up / invitation            | Contract (Art. 6(1)(b)) with the customer                                                                   |
| Business contact details, title, relationship notes, interactions | Customers' and prospects' employees | Entered or pasted by the seller | Legitimate interest in B2B relationship management (Art. 6(1)(f)), subject to the customer's balancing test |
| Pasted notes and emails                                           | People mentioned in them            | The seller                      | Same; processed only to produce proposals (minimisation, Art. 5(1)(c))                                      |

Contacts are usually not collected from the data subject, so the controller owes
them information under **Art. 14**. CLEAN will provide wording the customer can
reuse; meeting that duty is the customer's responsibility.

## Design rules in the product

- **Private by default:** a seller's records are readable only by that seller unless the admin enables team visibility. Enforced in PostgreSQL row-level security, not just the app (D-033). Admins have no implicit access to seller data.
- **Propose, never write:** captures create proposals; nothing changes until the seller approves (rule 3).
- **Minimal storage of pasted text:** a proposal keeps only the line it came from (`capture_proposal.source_excerpt`), not the whole note or email. The full text lives only in the browser during capture unless the seller saves it as an interaction summary.
- **Voice dictation off by default:** in Chrome, the Web Speech API sends audio to an online recognition service (MDN: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). It stays off until a user turns it on after a notice (D-042).
- **No AI in Phase 1.** When enabled (Phase 3), prompts only include data the user can see, and no provider may train on customer data (rule 5).
- **Secrets:** the AI provider key is write-only for the application role; it cannot be read back (tested). Secret columns are removed from the audit trail.
- **EU-first:** database and hosting in an EU region (data_region `eu`).

## Retention (proposed defaults, to confirm)

| Data                                    | Retention                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Capture proposals (with source excerpt) | Excerpt cleared 30 days after the decision; proposal record kept for audit        |
| Interactions, accounts, people, deals   | While the customer's subscription is active, or until deleted by the seller/admin |
| Audit trail                             | 12 months, then deleted                                                           |
| Connector data (Phase 2)                | Deleted when the user disconnects or on request                                   |

## Data subject rights

Access, rectification and erasure (Arts. 15–17) are handled by the controller.
CLEAN supports them by letting the owning seller (or an admin with team
visibility, later) find and delete a person and every linked record; deletes
cascade through relationships, stakeholders and participants.
