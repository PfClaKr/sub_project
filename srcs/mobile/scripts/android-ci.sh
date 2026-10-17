#!/usr/bin/env bash
# Runs inside reactivecircus/android-emulator-runner (repo root): installs
# the debug APK and takes the screenshots (scripts/android-screenshots.mjs).
set -euo pipefail
# A fresh emulator is busy for a while after boot (the launcher may show
# "not responding"); let it settle and hide such dialogs.
adb shell settings put global hide_error_dialogs 1 || true
sleep 30
adb install -r srcs/mobile/android/app/build/outputs/apk/debug/app-debug.apk
cd srcs/mobile
node scripts/android-screenshots.mjs ../../screenshots/android
