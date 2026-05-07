#!/bin/bash
# QC Lab kiosk launcher (Pi 5 + 24" touchscreen, portrait, mobile-style OSK)
#
# Adjust QC_URL or rotation as needed; the rest auto-detects.

export DISPLAY=:0
QC_URL="${QC_URL:-http://192.168.168.47:5000/}"
ROTATION="${ROTATION:-normal}"

# Wait for the QC Lab server to be reachable before launching the browser
for i in {1..30}; do
    curl -fsSL --max-time 2 "$QC_URL" > /dev/null 2>&1 && break
    sleep 2
done

# Disable screen blanking & power saving
xset s off
xset s noblank
xset -dpms

# Rotate the display (xrandr also rotates touch input on most setups,
# but we still apply a Coordinate Transformation Matrix below to be safe)
OUTPUT=$(xrandr --query | awk '/ connected/ {print $1; exit}')
if [ -n "$OUTPUT" ]; then
    xrandr --output "$OUTPUT" --rotate "$ROTATION"
fi
case "$ROTATION" in
    normal)   MATRIX="1 0 0 0 1 0 0 0 1" ;;
    right)    MATRIX="0 1 0 -1 0 1 0 0 1" ;;
    inverted) MATRIX="-1 0 1 0 -1 1 0 0 1" ;;
    left)     MATRIX="0 -1 1 1 0 0 0 0 1" ;;
    *)        MATRIX="0 1 0 -1 0 1 0 0 1" ;;
esac
for ID in $(xinput --list --id-only); do
    NAME=$(xinput --list --name-only "$ID" 2>/dev/null)
    if echo "$NAME" | grep -qiE "touch|finger|stylus"; then
        xinput set-prop "$ID" "Coordinate Transformation Matrix" $MATRIX 2>/dev/null
    fi
done

# Hide the X cursor entirely on a touchscreen (only briefly visible on tap)
unclutter -idle 0.1 -root &

# Configure the on-screen keyboard for iOS/Android-style behavior
dconf write /org/onboard/auto-show/enabled true
dconf write /org/onboard/show-status-icon false
dconf write /org/onboard/window/docking-enabled true
dconf write /org/onboard/window/docking-edge "'bottom'"
dconf write /org/onboard/window/docking-shrink-workarea false
dconf write /org/onboard/window/force-to-top true
dconf write /org/onboard/layout "'Compact'"
# auto-show.enabled=true makes onboard start hidden and only appear on
# input focus, so we don't need a --start-minimized flag (which doesn't
# exist in newer onboard versions anyway).
onboard &

# Idle reset: navigate back to home after 20 min of no input
(
    while true; do
        sleep 60
        IDLE=$(xprintidle 2>/dev/null || echo 0)
        if [ "$IDLE" -gt 1200000 ]; then
            xdotool key alt+Home
            sleep 60
        fi
    done
) &

# Clean any stale Chromium profile lock files
rm -f "$HOME/.config/chromium/Singleton"* 2>/dev/null

exec /usr/bin/chromium \
    --start-fullscreen \
    --force-renderer-accessibility \
    --no-memcheck \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-features=TranslateUI,Translate \
    --no-first-run \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    --password-store=basic \
    --homepage="$QC_URL" \
    --user-data-dir=/tmp/chromium-kiosk \
    "$QC_URL"
