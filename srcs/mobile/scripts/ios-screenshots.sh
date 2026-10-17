#!/usr/bin/env bash
# Boots an iPhone simulator, installs the app and saves a screenshot per
# screen (CI, macOS). The app must be built with
# CAP_SERVER_URL=http://localhost:4000: the first screenshot is taken
# before anything listens there (the bundled offline page), then
# scripts/route-proxy.mjs starts in front of Next.js on :3000.
#   scripts/ios-screenshots.sh <App.app> <output dir> <route file> <screen...>
# A screen is "name=/path".
set -euo pipefail
APP=$1 OUT=$2 ROUTE=$3
shift 3
BUNDLE=com.itnyang.app
mkdir -p "$OUT"

DEVICE=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = [d for runtime, ds in json.load(sys.stdin)["devices"].items() if "iOS" in runtime for d in ds]
iphones = [d for d in devices if d["name"].startswith("iPhone") and "SE" not in d["name"]]
print((iphones or devices)[-1]["udid"])')
echo "simulator: $DEVICE"
xcrun simctl boot "$DEVICE" || true
xcrun simctl bootstatus "$DEVICE" -b
xcrun simctl install "$DEVICE" "$APP"

n=0
shot() {
	n=$((n + 1))
	xcrun simctl io "$DEVICE" screenshot "$OUT/$(printf '%02d' $n)-$1.png" >/dev/null
	echo "saved $1"
}
launch() {
	xcrun simctl terminate "$DEVICE" "$BUNDLE" >/dev/null 2>&1 || true
	xcrun simctl launch "$DEVICE" "$BUNDLE" >/dev/null
	sleep "$1"
}

launch 10
shot offline

node "$(dirname "$0")/route-proxy.mjs" 4000 http://localhost:3000 "$ROUTE" &
PROXY=$!
trap 'kill $PROXY' EXIT
sleep 1
for screen in "$@"; do
	echo "${screen#*=}" > "$ROUTE"
	launch 12
	shot "${screen%%=*}"
done
