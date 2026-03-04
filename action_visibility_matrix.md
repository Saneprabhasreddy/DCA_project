# Action Visibility Matrix

Below defines precisely what components and actions are visible based on user Roles versus the current Case Stage.

| Component Action           | Role            | Visible/Enabled Stages                        | Description                                                                 |
|----------------------------|-----------------|-----------------------------------------------|-----------------------------------------------------------------------------|
| **Predict**                | Admin, Manager  | `New`, `Allocated`, `In Progress`, `PTP`, `Dispute`, `Escalated` | Refresh ML likelihood predictions. Disabled if case is `Closed`. |
| **Recommend DCA**          | Admin, Manager  | `New`, `Allocated`, `In Progress`, `PTP`, `Dispute`, `Escalated` | Hits ML endpoint constraints to rank DCAs. Disabled if `Closed`. |
| **Assign DCA**             | Admin, Manager  | `New`, `Allocated`, `In Progress`, `PTP`, `Dispute`, `Escalated` | Blocked if `Customer Contact` info is missing. Disabled if `Closed`. If already assigned, requires explicitly entering "Reassign" flow. |
| **Add Note/Interaction**   | Admin, Manager  | `New`, `Allocated`, `In Progress`, `PTP`, `Dispute`, `Escalated` | Add system notes or external emails. Disabled upon case closure. |
| **Update Outcome / Close** | DCA User        | `Allocated`, `In Progress`, `PTP`, `Dispute`, `Escalated` | DCA users can attach an Outcome (e.g. Paid in Full) when raising a stage update note. |
| **Add External Touch**     | DCA User        | `Allocated`, `In Progress`, `PTP`, `Dispute`, `Escalated` | Call script/Email interaction entry. |

*Note*: Any case inside the **`Closed`** stage explicitly enforces universally `Read-Only` rendering semantics for the entire page body regardless of Role.
