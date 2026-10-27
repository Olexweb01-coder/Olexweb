for h in dirtool.test fibtool.test; do grep -q " $h" /etc/hosts || echo "127.0.0.1 $h" >> /etc/hosts; done
. /home/claude/yt-test/fenv.sh; node fDIR.mjs
