#!/bin/sh
# Stagehand discards Chrome stderr. Keep it inside this disposable tmpfs for failure diagnostics.
exec /usr/bin/chromium "$@" 2>/tmp/chromium-startup.log
