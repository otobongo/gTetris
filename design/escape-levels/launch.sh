#!/bin/bash
cd "$(dirname "$0")"
for n in arrows 9 walls master; do
  timeout 600 node run.cjs $n > log-$n.txt 2>&1 &
done
wait
echo ALLDONE > done.flag
