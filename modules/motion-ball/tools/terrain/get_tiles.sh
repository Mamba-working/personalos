#!/bin/sh
# AWS Open Data Terrain Tiles (terrarium), zoom 12: the view south from Lake Kawaguchi, ±66 km
cd /tmp/claude-504/assets/dem12
n=0
for x in $(seq 3618 3634); do for y in $(seq 1615 1623); do
  f=t_${x}_${y}.png
  [ -s $f ] || curl -sS -m 60 -x http://127.0.0.1:7890 -o $f https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/$x/$y.png
  n=$((n+1))
done; done
echo "tiles $n"; du -sh .; echo DONE
