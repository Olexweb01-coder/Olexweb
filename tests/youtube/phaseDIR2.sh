# phaseSIMPLE + the Directory as a daily goldmine and its simple screen (fDIR2.mjs, install 16)
grep -q " news.test" /etc/hosts || echo "127.0.0.1 news.test" >> /etc/hosts
sh /home/claude/yt-test/phaseSIMPLE.sh
. /home/claude/yt-test/fenv.sh
node fDIR2.mjs
