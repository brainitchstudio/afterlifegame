#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
UNITY_EDITOR="${UNITY_EDITOR:-/Applications/Unity/Hub/Editor/6000.6.3f1/Unity.app/Contents/MacOS/Unity}"
node Tools/bundle-simulation.mjs --check
node --test tests/game.test.mjs tests/unity-boundary.test.mjs
"$UNITY_EDITOR" -batchmode -nographics -projectPath "$PWD" -executeMethod Afterlife.Editor.AfterlifeProject.Validate -quit -logFile /tmp/afterlife-validation.log
"$UNITY_EDITOR" -batchmode -nographics -projectPath "$PWD" -runTests -testPlatform PlayMode -testFilter Afterlife.Tests.WatchtowerPlacementTests.PlacedWatchtowerRemainsVisibleAfterSimulationStep -testResults /tmp/afterlife-playmode-results.xml -quit -logFile /tmp/afterlife-playmode.log
