#!/usr/bin/env sh
set -e

# Ensure Node dependencies exist (fallback for misconfigured builds).
node -e "require.resolve('express')" >/dev/null 2>&1 || npm ci --omit=dev

resolve_python() {
    if [ -x "./.venv/bin/python3" ]; then
        echo "./.venv/bin/python3"
        return
    fi

    if [ -x "../.venv/bin/python3" ]; then
        echo "../.venv/bin/python3"
        return
    fi

    if [ -n "${PYTHON_BIN:-}" ]; then
        case "$PYTHON_BIN" in
            /*|./*|../*)
                if [ -x "$PYTHON_BIN" ]; then
                    echo "$PYTHON_BIN"
                    return
                fi
                ;;
            *)
                if command -v "$PYTHON_BIN" >/dev/null 2>&1; then
                    echo "$PYTHON_BIN"
                    return
                fi
                ;;
        esac
    fi

    if command -v python3 >/dev/null 2>&1; then
        echo "python3"
        return
    fi

    if command -v python >/dev/null 2>&1; then
        echo "python"
        return
    fi

    echo ""
}

PY_CMD="$(resolve_python)"
if [ -z "$PY_CMD" ]; then
    echo "Python executable not found. ML endpoints require Python runtime."
    exit 1
fi

# Install ML dependencies only when missing.
"$PY_CMD" -c "import numpy,pandas,sklearn,joblib,pymongo" >/dev/null 2>&1 || \
    (
        "$PY_CMD" -m pip install --no-cache-dir -r requirements.txt || \
        "$PY_CMD" -m pip install --user --no-cache-dir -r requirements.txt || \
        "$PY_CMD" -m pip install --break-system-packages --no-cache-dir -r requirements.txt
    )
