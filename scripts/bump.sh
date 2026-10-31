#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "usage: bump.sh <version>"
    exit 1
fi

version="$1"
short=$(echo "$version" | cut -d. -f1-3)

jq -j --indent 4 --arg v "$version" '.version = $v' package.json > package.json.tmp
mv package.json.tmp package.json

for f in packages/*/package.json; do
    jq -j --indent 4 --arg v "$short" '.version = $v' "$f" > "$f.tmp"
    mv "$f.tmp" "$f"
done

git commit -am "v$version"
git tag "v$version"
