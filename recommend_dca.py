import argparse
import json
import os
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from joblib import load

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


def get_available_dcas(cases_csv_path: str, capacity_left: Optional[Dict[str, int]] = None) -> List[str]:
    """
    Returns ALL DCAs found in cases_csv (assigned_dca_id column).
    If capacity_left is provided, keep only DCAs with capacity > 0.
    Also includes any DCAs present in capacity_left even if not in CSV.
    """
    dcas: List[str] = []

    # 1) From cases.csv
    try:
        df = pd.read_csv(cases_csv_path, usecols=["assigned_dca_id"])
        dcas = (
            df["assigned_dca_id"]
            .dropna()
            .astype(str)
            .str.strip()
            .unique()
            .tolist()
        )
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


def build_dca_segment_table(cases_csv_path: str) -> pd.DataFrame:
    """
    Builds historical performance multiplier per:
      (dca_id, region, industry, invoice_bucket)
    Uses recovered_flag recovery rate as performance signal.
    """
    cases = pd.read_csv(cases_csv_path)

    # clean
    cases["region"] = cases["region"].fillna("UNKNOWN")
    cases["industry"] = cases["industry"].fillna("UNKNOWN")
    cases["assigned_dca_id"] = cases["assigned_dca_id"].fillna("UNKNOWN")

    cases["invoice_bucket"] = cases["invoice_amount_usd"].apply(invoice_bucket)
    cases["recovered_flag"] = cases["recovered_flag"].fillna(0).astype(int)

    # Only use rows that actually had a DCA assignment (skip UNKNOWN)
    # (use startswith("DCA") so it works even if ids are like DCA_11 or DCA11)
    hist = cases[cases["assigned_dca_id"].astype(str).str.startswith("DCA")].copy()

    grp = (
        hist.groupby(["assigned_dca_id", "region", "industry", "invoice_bucket"])["recovered_flag"]
        .agg(["mean", "count"])
        .reset_index()
        .rename(columns={"assigned_dca_id": "dca_id", "mean": "recovery_rate", "count": "n"})
    )

    # Convert recovery_rate into a multiplier around 1.0
    global_rate = hist["recovered_flag"].mean() if len(hist) else 0.5
    grp["multiplier"] = (grp["recovery_rate"] / max(global_rate, 1e-6)).clip(0.6, 1.6)

    return grp


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
    ap.add_argument("--cases_csv", default="data/fedex_dca_synthetic_dataset/cases.csv")
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
    seg = build_dca_segment_table(args.cases_csv)

    # Evaluate each DCA
    results = []

    inv_amt = float(case.get("invoice_amount_usd", 0.0))
    seg_key = (
        case.get("region", "UNKNOWN"),
        case.get("industry", "UNKNOWN"),
        invoice_bucket(inv_amt),
    )

    # normalization helpers for suitability
    probs, amts, days_list = [], [], []
    per_dca_scores = {}

    # ✅ THIS is the important line: get ALL DCAs from CSV (and apply capacity filter if provided)
    dcas_to_check = get_available_dcas(args.cases_csv, capacity_left=capacity_left)

    for dca in dcas_to_check:
        # (extra safety: capacity check still here)
        if capacity_left is not None and capacity_left.get(dca, 0) <= 0:
            continue

        s = score_case_for_dca(case, dca, clf, reg_amt, reg_days)
        per_dca_scores[dca] = s
        probs.append(s["prob"])
        amts.append(s["exp_amt"])
        days_list.append(s["exp_days"])

    if not per_dca_scores:
        raise RuntimeError("No DCAs available (capacity constraints removed all).")

    # Normalize amount/days for suitability score
    prob_min, prob_max = min(probs), max(probs)
    amt_min, amt_max = min(amts), max(amts)
    day_min, day_max = min(days_list), max(days_list)

    def norm(x, a, b):
        return 0.0 if b - a < 1e-9 else (x - a) / (b - a)

    for dca, s in per_dca_scores.items():
        # base suitability from ML
        p_n = norm(s["prob"], prob_min, prob_max)
        a_n = norm(s["exp_amt"], amt_min, amt_max)
        d_n = norm(s["exp_days"], day_min, day_max)

        # Higher is better: probability & amount high, days low
        base_suitability = 0.6 * p_n + 0.2 * a_n - 0.2 * d_n

        # segment multiplier lookup
        region, industry, bucket = seg_key
        match = seg[
            (seg["dca_id"] == dca)
            & (seg["region"] == region)
            & (seg["industry"] == industry)
            & (seg["invoice_bucket"] == bucket)
        ]

        if len(match) == 0:
            multiplier = 1.0
            reason_mult = "No history for this segment → multiplier=1.0"
        else:
            multiplier = float(match["multiplier"].iloc[0])
            rr = float(match["recovery_rate"].iloc[0])
            n = int(match["n"].iloc[0])
            reason_mult = f"Segment history: recovery_rate={rr:.2f} over n={n} → multiplier={multiplier:.2f}"

        final_score = base_suitability * multiplier

        results.append(
            {
                "dca_id": dca,
                "final_score": float(final_score),
                "ml_prob_60d": s["prob"],
                "ml_exp_amount": s["exp_amt"],
                "ml_exp_days": s["exp_days"],
                "multiplier_reason": reason_mult,
            }
        )

    results.sort(key=lambda x: x["final_score"], reverse=True)
    top = results[: args.top_k]

    print("\n=== Top DCA Recommendations ===")
    for i, r in enumerate(top, 1):
        print(f"\n#{i} {r['dca_id']}  final_score={r['final_score']:.4f}")
        print(
            f"   ML: prob_60d={r['ml_prob_60d']:.4f}, exp_amt=${r['ml_exp_amount']:.2f}, exp_days={r['ml_exp_days']:.1f}"
        )
        print(f"   {r['multiplier_reason']}")

    print("\n✅ Recommended assignment:", top[0]["dca_id"])


if __name__ == "__main__":
    main()
