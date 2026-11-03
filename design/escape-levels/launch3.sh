#!/bin/bash
cd "$(dirname "$0")"
timeout 900 node run.cjs 9 > log-9.txt 2>&1
echo ALLDONE > done3.flag
