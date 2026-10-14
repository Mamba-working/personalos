#!/bin/sh
cd /tmp/claude-504/assets/dem13
for x in $(seq 7244 7260); do for y in $(seq 3230 3241); do
  f=t_${x}_${y}.png
  [ -s $f ] || curl -sS -m 60 -x http://127.0.0.1:7890 -o $f https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/$x/$y.png
done; done
ls t_*.png | wc -l; echo DONE13
