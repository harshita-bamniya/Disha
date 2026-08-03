#!/bin/sh
# Run all integration test scripts inside the container.
# All files already copied — no more docker cp needed.
set -e
cd /app

echo "============================================"
echo " STEP 1: Setup test data"
echo "============================================"
python setup_test_data.py

echo ""
echo "============================================"
echo " STEP 2: Run integration tests"
echo "============================================"
python integration_test.py
