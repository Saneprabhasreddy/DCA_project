import argparse
import json
import numpy as np
import pandas as pd
from joblib import load

DEFAULT_ARTIFACTS_DIR = "artifacts"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifacts_dir", default=DEFAULT_ARTIFACTS_DIR)
    ap.add_argument("--input_json", required=True, help="JSON string with case features")
    args = ap.parse_args()

    # Load models
    clf = load(f"{args.artifacts_dir}/model_recovery_prob.joblib")
    amt_reg = load(f"{args.artifacts_dir}/model_recovery_amount.joblib")
    days_reg = load(f"{args.artifacts_dir}/model_recovery_days.joblib")

    case = json.loads(args.input_json)

    # IMPORTANT: must include exactly the features used in training
    features = [
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

    # fill missing categorical fields safely
    for c in ["region", "industry", "credit_score_band", "last_contact_channel", "assigned_dca_id"]:
        if c not in case or case[c] is None:
            case[c] = "UNKNOWN"

    # fill missing numeric fields
    for c in features:
        if c not in case:
            case[c] = np.nan

    X = pd.DataFrame([case])[features]

    prob = clf.predict_proba(X)[:, 1][0]
    exp_amt = max(0.0, amt_reg.predict(X)[0])
    exp_days = max(0.0, days_reg.predict(X)[0])

    result = {
        "prob_60d": round(float(prob), 4),
        "exp_amt": round(float(exp_amt), 2),
        "exp_days": round(float(exp_days), 1),
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()