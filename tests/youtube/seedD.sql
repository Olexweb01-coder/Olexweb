insert into yt_ideas (key,name,url,source,score,status) values ('tldraw.test','tldraw','http://tldraw.test:4555/','test',80,'new') on conflict do nothing;
insert into yt_ideas (key,name,url,source,status) values ('QueueA','QueueA','https://q.test','Show HN','made'),('QueueB','QueueB','https://q.test','Show HN','made'),('QueueC','QueueC','https://q.test','Show HN','made') on conflict do nothing;
insert into yt_ideas (key,name,url,source,score,status) values ('paletteforge.test','PaletteForge','http://paletteforge.test:4555/','test',80,'new') on conflict do nothing;
