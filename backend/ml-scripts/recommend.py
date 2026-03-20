import argparse
import json
import os
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from joblib import load
from pymongo import MongoClient

FEATURES = [
    "region",
    "industry",
    "invoice_amount_usd",
    "num_open_invoices",
    "overdue_days_at_allocation",
    "previous_default_count",
    "previous_recovery_rate",
    "payment_history_score",
    "credit_score_band",
    "contact_attempts_last_30d",
    "last_contact_channel",
    "dispute_flag",
    "promised_to_pay_flag",
    "assigned_dca_id",
    "sla_days",
]

CAT_COLS = ["region", "industry", "credit_score_band", "last_contact_channel", "assigned_dca_id"]

# fallback only (used only if we cannot read any DCA from cases.csv)
DEFAULT_DCAS = [f"DCA-{i:02d}" for i in range(1, 11)]  # DCA-01..DCA-10


def get_available_dcas(mongo_uri: str, capacity_left: Optional[Dict[str, int]] = None) -> List[str]:
    """
    Returns ALL DCAs found in MongoDB cases collection (assigned_dca_id column).
    If capacity_left is provided, keep only DCAs with capacity > 0.
    Also includes any DCAs present in capacity_left even if not in DB.
    """
    dcas: List[str] = []

    # 1) From MongoDB
    try:
        client = MongoClient(mongo_uri)
        db = client.get_default_database()
        cursor = db["cases"].find({"assigned_dca_id": {"$regex": "^DCA"}}, {"_id": 0, "assigned_dca_id": 1})
        dcas = [str(doc["assigned_dca_id"]) for doc in cursor if doc.get("assigned_dca_id")]
        client.close()
    except Exception:
        dcas = []

    # keep only real DCA ids (remove UNKNOWN/blanks)
    dcas = [d for d in dcas if d and d.strip() and d.strip().upper() != "UNKNOWN"]
    dcas = [d for d in dcas if d.upper().startswith("DCA")]  # supports DCA-01, DCA_11, DCA11 etc.

    # 2) If capacity dict exists, include those DCAs too
    if capacity_left is not None:
        cap_dcas = [str(k).strip() for k, v in capacity_left.items() if v and v > 0]
        dcas = list(set(dcas).union(set(cap_dcas)))
        # apply capacity filter
        dcas = [d for d in dcas if capacity_left.get(d, 0) > 0]

    dcas = sorted(set(dcas))

    # fallback if nothing found
    return dcas if dcas else DEFAULT_DCAS


def invoice_bucket(amount: float) -> str:
    # simple bucketing for segment performance
    if amount < 5000:
        return "S"
    if amount < 20000:
        return "M"
    if amount < 80000:
        return "L"
    return "XL"


def build_dca_segment_table(mongo_uri: str) -> Dict:
    """
    Builds historical performance multiplier per:
      (dca_id, region, industry, invoice_bucket)
    Uses recovered_flag recovery rate as performance signal.
    Returns a dict seg_table[key] = {"recovered": int, "total": int}
    """
    client = MongoClient(mongo_uri)
    db = client.get_default_database()
    cases_cursor = db["cases"].find(
        {"assigned_dca_id": {"$regex": "^DCA"}},
        {"_id": 0, "assigned_dca_id": 1, "region": 1, "industry": 1,
         "invoice_amount_usd": 1, "recovered_flag": 1}
    )
    hist_list = list(cases_cursor)
    client.close()

    # Build segment table
    seg_table = {}
    global_recovered = 0
    global_total = 0

    for h in hist_list:
        key = (
            str(h.get("assigned_dca_id", "UNKNOWN")),
            str(h.get("region", "UNKNOWN")),
            str(h.get("industry", "UNKNOWN")),
            invoice_bucket(float(h.get("invoice_amount_usd", 0)))
        )
        if key not in seg_table:
            seg_table[key] = {"recovered": 0, "total": 0}
        seg_table[key]["total"] += 1
        rec = int(h.get("recovered_flag", 0))
        seg_table[key]["recovered"] += rec
        global_total += 1
        global_recovered += rec

    return seg_table, global_recovered / max(global_total, 1)


def score_case_for_dca(case: dict, dca_id: str, clf, reg_amt, reg_days) -> dict:
    # Make a copy and set DCA
    row = dict(case)
    row["assigned_dca_id"] = dca_id

    # Fill missing categorical safely
    for c in CAT_COLS:
        if c not in row or row[c] is None:
            row[c] = "UNKNOWN"

    # Fill missing numeric keys safely (to avoid KeyError)
    row.setdefault("invoice_amount_usd", 0.0)
    row.setdefault("num_open_invoices", 0)
    row.setdefault("overdue_days_at_allocation", 0)
    row.setdefault("previous_default_count", 0)
    row.setdefault("previous_recovery_rate", 0.0)
    row.setdefault("payment_history_score", 0.0)
    row.setdefault("contact_attempts_last_30d", 0)
    row.setdefault("dispute_flag", 0)
    row.setdefault("promised_to_pay_flag", 0)
    row.setdefault("sla_days", 14)

    # Build dataframe in correct feature order
    X = pd.DataFrame([row])[FEATURES]

    prob = float(clf.predict_proba(X)[:, 1][0])
    exp_amt = float(max(0.0, reg_amt.predict(X)[0]))
    exp_days = float(max(0.0, reg_days.predict(X)[0]))

    return {"prob": prob, "exp_amt": exp_amt, "exp_days": exp_days}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifacts_dir", default="artifacts")
    ap.add_argument("--mongo_uri", required=True, help="MongoDB URI")
    ap.add_argument("--input_json", required=True, help="New case features as JSON string")
    ap.add_argument("--top_k", type=int, default=3)
    ap.add_argument("--capacity_json", default=None, help="Optional: {'DCA-01':120, ...} active capacity left")
    args = ap.parse_args()

    # Load models (must run train.py first)
    clf = load(os.path.join(args.artifacts_dir, "model_recovery_prob.joblib"))
    reg_amt = load(os.path.join(args.artifacts_dir, "model_recovery_amount.joblib"))
    reg_days = load(os.path.join(args.artifacts_dir, "model_recovery_days.joblib"))

    case = json.loads(args.input_json)

    # Fill required keys with defaults if missing
    for c in CAT_COLS:
        case.setdefault(c, "UNKNOWN")
    case.setdefault("sla_days", 14)

    # Optional capacity constraints
    capacity_left = None
    if args.capacity_json:
        capacity_left = json.loads(args.capacity_json)

    # Build historical DCA segment multipliers
    seg_table, global_rate = build_dca_segment_table(args.mongo_uri)

    # Get available DCAs
    dcas = get_available_dcas(args.mongo_uri, capacity_left)

    # Score each DCA
    per_dca = {}
    probs, amts, days_list = [], [], []

    for dca_id in dcas:
        row = dict(case)
        row["assigned_dca_id"] = dca_id
        X = pd.DataFrame([row])[FEATURES]

        prob = float(clf.predict_proba(X)[:, 1][0])
        exp_amt = float(max(0.0, reg_amt.predict(X)[0]))
        exp_days = float(max(0.0, reg_days.predict(X)[0]))

        per_dca[dca_id] = {"prob": prob, "exp_amt": exp_amt, "exp_days": exp_days}
        probs.append(prob)
        amts.append(exp_amt)
        days_list.append(exp_days)

    # Normalize
    prob_min, prob_max = min(probs), max(probs)
    amt_min, amt_max = min(amts), max(amts)
    day_min, day_max = min(days_list), max(days_list)

    def norm(x, a, b):
        return 0.0 if b - a < 1e-9 else (x - a) / (b - a)

    results = []
    region = str(case.get("region", "UNKNOWN"))
    industry = str(case.get("industry", "UNKNOWN"))
    bucket = invoice_bucket(float(case.get("invoice_amount_usd", 0)))

    for dca_id, s in per_dca.items():
        p_n = norm(s["prob"], prob_min, prob_max)
        a_n = norm(s["exp_amt"], amt_min, amt_max)
        d_n = norm(s["exp_days"], day_min, day_max)

        base = 0.6 * p_n + 0.2 * a_n - 0.2 * d_n

        seg_key = (dca_id, region, industry, bucket)
        seg_data = seg_table.get(seg_key)
        mult = 1.0
        reason_mult = "No historical data for this segment, using 1.0x multiplier"
        if seg_data and seg_data["total"] >= 5:  # min 5 cases for reliability
            seg_rate = seg_data["recovered"] / seg_data["total"]
            mult = seg_rate / global_rate if global_rate > 0 else 1.0
            mult = max(0.5, min(2.0, mult))  # clip
            reason_mult = f"Historical segment rate {seg_rate:.3f} vs global {global_rate:.3f} = {mult:.2f}x"

        final_score = base * mult

        results.append({
            "dca_id": dca_id,
            "final_score": float(final_score),
            "prob_60d": s["prob"],
            "exp_amt": s["exp_amt"],
            "exp_days": s["exp_days"],
            "reason": reason_mult,
        })

    results.sort(key=lambda x: x["final_score"], reverse=True)
    top = results[: args.top_k]

    output = {
        "recommendations": top,
        "best_dca": top[0]["dca_id"] if top else None
    }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
