#!/usr/bin/env bash
# Runs inside reactivecircus/android-emulator-runner (repo root): installs
# the debug APK and takes the screenshots (scripts/android-screenshots.mjs).
set -euo pipefail
adb install -r srcs/mobile/android/app/build/outputs/apk/debug/app-debug.apk
cd srcs/mobile
node scripts/android-screenshots.mjs ../../screenshots/android
