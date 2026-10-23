node fA.mjs || exit 1
ID=$(cat /tmp/fid)
cd /home/claude/olexweb-factory && rm -rf work out public/clip.mp4 public/shot.png
echo; echo "32. The worker, for real (fetch the job, film squoosh.app, voice, music)"
node worker/hello.mjs $ID && node worker/run.mjs --id $ID --step job,capture,voice,music 2>&1 | grep -vE "^\s*$" | tail -14
ls -la public/clip.mp4 public/shot.png public/voice.wav public/music.wav src/timeline.json 2>&1 | awk '{print "   ", $5, $NF}'
