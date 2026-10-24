. /home/claude/yt-test/fenv.sh
node fG.mjs || exit 1
cd /home/claude/olexweb-factory && rm -rf work/job.json public/clip_*.mp4 public/shot_*.png
node worker/run.mjs --id $(cat /tmp/fid) --step job,capture 2>&1 | grep -E "job:|capture:|FAILED"
ls public/clip_*.mp4 public/shot_*.png 2>/dev/null | tr '\n' ' '; echo
