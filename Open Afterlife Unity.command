#!/bin/sh
set -eu
cd "$(dirname "$0")"
EDITOR="/Applications/Unity/Hub/Editor/6000.6.3f1/Unity.app/Contents/MacOS/Unity"
exec "$EDITOR" -projectPath "$PWD" -openfile "$PWD/Assets/afterlifev1.unity"
