#!/data/data/com.termux/files/usr/bin/bash
set -u

ROOT="$HOME/Mobile-Harness-armv7/runtime/armhf/rootfs"
CACHE="$ROOT/npm-debs"
ALL="$CACHE/Packages.all"
ARM="$CACHE/Packages.armhf"

mkdir -p "$CACHE"
: > "$CACHE/queue"
: > "$CACHE/done"

printf '%s\n' npm > "$CACHE/queue"

while [ -s "$CACHE/queue" ]; do
    pkg=$(head -n 1 "$CACHE/queue")
    sed -i '1d' "$CACHE/queue"

    grep -qxF "$pkg" "$CACHE/done" 2>/dev/null && continue
    printf '%s\n' "$pkg" >> "$CACHE/done"

    echo "===== $pkg ====="

    file=$(awk -v want="$pkg" '
        /^Package: / { p=$2 }
        /^Filename: / && p==want { print $2; exit }
    ' "$ALL")

    [ -n "$file" ] || file=$(awk -v want="$pkg" '
        /^Package: / { p=$2 }
        /^Filename: / && p==want { print $2; exit }
    ' "$ARM")

    if [ -z "$file" ]; then
        echo "Not found: $pkg"
        continue
    fi

    deb="$CACHE/$(basename "$file")"

    if [ ! -f "$deb" ]; then
        echo "Downloading $pkg..."
        curl -fsSL "https://deb.debian.org/debian/$file" -o "$deb" || {
            echo "DOWNLOAD FAILED: $pkg"
            continue
        }
    else
        echo "Already downloaded."
    fi

    dpkg-deb -x "$deb" "$ROOT"

    deps=$(awk -v want="$pkg" '
        BEGIN { RS=""; FS="\n" }
        {
            p=""; d=""
            for (i=1;i<=NF;i++) {
                if ($i ~ /^Package: /) { p=$i; sub(/^Package: /,"",p) }
                if ($i ~ /^Depends: /) { d=$i; sub(/^Depends: /,"",d) }
            }
            if (p==want) print d
        }
    ' "$ALL")

    printf '%s\n' "$deps" |
    tr ',' '\n' |
    sed -E 's/^[[:space:]]+//;s/[[:space:]]+$//' |
    sed -E 's/[[:space:]]*\([^)]*\)//g' |
    sed 's/:any$//' |
    sed '/^$/d' |
    while read -r dep; do
        case "$dep" in
            nodejs|nodejs:any|libc6|libgcc-s1|libstdc++6) ;;
            *) grep -qxF "$dep" "$CACHE/done" 2>/dev/null || printf '%s\n' "$dep" >> "$CACHE/queue" ;;
        esac
    done

    sort -u "$CACHE/queue" -o "$CACHE/queue"
done

echo
echo "===== DONE ====="
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
npm -v
