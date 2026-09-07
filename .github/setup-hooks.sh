#!/bin/sh
# Run this once from the repo root: sh .github/setup-hooks.sh

HOOK=".git/hooks/post-commit"

cat > "$HOOK" << 'EOF'
#!/bin/sh
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)
echo "[post-commit] Auto-pushing $BRANCH to origin..."
git push origin "$BRANCH" --quiet && echo "[post-commit] Pushed." || echo "[post-commit] Push failed — run 'git push' manually."
EOF

chmod +x "$HOOK"
echo "✓ post-commit hook installed. Every commit will auto-push to origin."
