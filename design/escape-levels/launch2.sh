#!/bin/bash
cd "$(dirname "$0")"
for n in 9 master; do timeout 420 node run.cjs $n > log-$n.txt 2>&1 & done
wait
echo ALLDONE > done2.flag
