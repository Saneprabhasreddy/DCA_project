"""
SmartDCA ML (offline scoring)
Loads trained artifacts and scores:
- a random sample of N cases from cases.csv
- or a specific case_id

Outputs predictions to console and (optionally) CSV.
"""
from __future__ import annotations

import argparse
import json
import os
import zipfile

import numpy as np
import pandas as pd
from joblib import load

DEFAULT_DATASET = "data/fedex_dca_synthetic_dataset/cases.csv"
DEFAULT_ARTIFACTS_DIR = "artifacts"


def load_cases(dataset_path: str) -> pd.DataFrame:
    """
    Accepts either:
    - a .zip that contains cases.csv at top level
    - a direct path to cases.csv
    """
    if dataset_path.endswith(".zip"):
        with zipfile.ZipFile(dataset_path, "r") as z:
            with z.open("cases.csv") as f:
                return pd.read_csv(f)
    return pd.read_csv(dataset_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset_zip", default=DEFAULT_DATASET)
    ap.add_argument("--artifacts_dir", default=DEFAULT_ARTIFACTS_DIR)
    ap.add_argument("--n", type=int, default=10, help="Number of random cases to score")
    ap.add_argument("--case_id", default=None, help="Score a specific case_id (overrides --n)")
    ap.add_argument("--out_csv", default=None, help="Optional path to save predictions as CSV")
    args = ap.parse_args()

    meta_path = os.path.join(args.artifacts_dir, "metadata.json")
    if not os.path.exists(meta_path):
        raise FileNotFoundError("metadata.json not found. Run train.py first.")

    with open(meta_path, "r") as f:
        meta = json.load(f)

    features = meta["features"]

    clf = load(os.path.join(args.artifacts_dir, "model_recovery_prob.joblib"))
    amt = load(os.path.join(args.artifacts_dir, "model_recovery_amount.joblib"))
    days = load(os.path.join(args.artifacts_dir, "model_recovery_days.joblib"))

    cases = load_cases(args.dataset_zip)

    if args.case_id:
        df = cases[cases["case_id"] == args.case_id].copy()
        if df.empty:
            raise ValueError(f"case_id not found: {args.case_id}")
    else:
        df = cases.sample(n=min(args.n, len(cases)), random_state=42).copy()

    X = df[features].copy()

    prob = clf.predict_proba(X)[:, 1]
    exp_amount = np.maximum(0, amt.predict(X))
    exp_days = np.maximum(0, days.predict(X))

    out = df[["case_id", "region", "industry", "invoice_amount_usd", "overdue_days_at_allocation"]].copy()
    out["pred_recovery_prob_60d"] = prob.round(4)
    out["pred_expected_recovered_amount_usd"] = exp_amount.round(2)
    out["pred_expected_recovery_days"] = exp_days.round(1)

    print(out.to_string(index=False))

    if args.out_csv:
        out.to_csv(args.out_csv, index=False)
        print(f"\n✅ Saved: {args.out_csv}")


if __name__ == "__main__":
    main()
