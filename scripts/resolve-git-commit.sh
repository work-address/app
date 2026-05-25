#!/bin/sh
set -eu

if [ -n "${GIT_COMMIT:-}" ] && [ "$GIT_COMMIT" != "unknown" ]; then
  printf '%s' "$GIT_COMMIT" | cut -c1-7
  exit 0
fi

git_dir="${GIT_DIR:-.git}"

if [ ! -f "$git_dir/HEAD" ]; then
  printf '%s' "unknown"
  exit 0
fi

head=$(tr -d '[:space:]' < "$git_dir/HEAD")

case "$head" in
  ref:*)
    ref=${head#ref:}
    ref=${ref# }
    if [ -f "$git_dir/$ref" ]; then
      commit=$(tr -d '[:space:]' < "$git_dir/$ref")
    elif [ -f "$git_dir/packed-refs" ]; then
      commit=$(
        grep " $ref\$" "$git_dir/packed-refs" | head -1 | awk '{print $1}'
      )
    else
      commit=unknown
    fi
    ;;
  *)
    commit=$head
    ;;
esac

if [ -z "$commit" ] || [ "$commit" = "unknown" ]; then
  printf '%s' "unknown"
else
  printf '%s' "$commit" | cut -c1-7
fi
