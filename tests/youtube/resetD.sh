service postgresql start >/dev/null 2>&1; sleep 2; P="psql postgres://olex:olex@localhost/olexweb -q"
$P -c "drop schema public cascade; create schema public" 2>/dev/null; $P -f /home/claude/Olexweb/db/schema.sql 2>&1 | grep -i error | head -3
$P -c "insert into admin_users (email,name,role,totp_enabled) values ('owner@test.local','owner','owner',true),('editor@test.local','editor','editor',true)"
$P -f /home/claude/yt-test/seedD.sql; rm -f /tmp/fid /tmp/fid2 /tmp/ftok /tmp/pD.done; rm -rf /home/claude/olexweb-factory/work/*
