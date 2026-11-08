#!/bin/bash
# 並べて回す：scripts/sim-par.sh 年数 回数 方針(,区切り) 出力先 [1つの仕事の回数=回数]
# 方針ごと・回のまとまりごとに同時に動かし、最後に sim-sum.ts でまとめる
Y=$1; N=$2; P=$3; OUT=$4; CH=${5:-$N}
mkdir -p $OUT
files=()
for pol in ${P//,/ }; do
  for ((st=0; st<N; st+=CH)); do
    f=$OUT/$pol-$st.json; files+=($f)
    npx tsx scripts/sim.ts $Y $CH $pol --start=$st --json=$f > $OUT/$pol-$st.log 2>&1 &
  done
done
wait
IFS=,; echo "${files[*]}" > $OUT/files.txt
