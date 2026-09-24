#!/usr/bin/env bash
# Build CEF bundles and upload them to a GitHub release.
# Usage: ./scripts/release-cef.sh v0.1.3 [--no-upload]
# Requires: gh CLI authenticated, patchelf in PATH (~/.local/bin ok)

set -euo pipefail

cd "$(dirname "$0")/.."

TAG="${1:-}"
UPLOAD=true
[ "${2:-}" = "--no-upload" ] && UPLOAD=false

VERSION=$(grep -m1 '"version"' tauri-cef-linux/tauri.conf.json | cut -d'"' -f4)
BUNDLE_DIR=tauri-cef-linux/target/release/bundle
OUT_DIR=release-cef
mkdir -p "$OUT_DIR"

pnpm tauri-cef:build

cp "$BUNDLE_DIR/deb/PnlTracker_${VERSION}_amd64.deb" \
	"$OUT_DIR/PnlTracker-CEF_${VERSION}_amd64.deb"
cp "$BUNDLE_DIR/appimage/PnlTracker_${VERSION}_amd64.AppImage" \
	"$OUT_DIR/PnlTracker-CEF_${VERSION}_amd64.AppImage"
chmod +x "$OUT_DIR/PnlTracker-CEF_${VERSION}_amd64.AppImage"

echo "Artifacts in $OUT_DIR:"
ls -lh "$OUT_DIR"

if [ "$UPLOAD" = true ]; then
	[ -z "$TAG" ] && { echo 'error: release tag required (e.g. v0.1.3)' >&2; exit 1; }
	gh release view "$TAG" >/dev/null 2>&1 || \
		gh release create "$TAG" --title "PnlTracker $TAG" --generate-notes
	gh release upload "$TAG" "$OUT_DIR"/PnlTracker-CEF_* --clobber
	echo "Uploaded to release $TAG"
fi
