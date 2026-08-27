# Loop-ready approved music

`kingdom-loop.mp3` and `battle-loop.mp3` are legacy derived files from the first loop-repair attempt. They remain only for provenance and rollback. Production no longer loads them because their tails already contain baked head material.

Production decodes the unchanged owner-approved `../kingdom.mp3` and `../battle.mp3` sources. `CrossfadeLoopPlayer` schedules separate non-looping `AudioBufferSourceNode` instances. Before one source ends, the next starts from `loopStart`; 128-sample equal-power curves fade tail out and head in simultaneously. `LOOP_MANIFEST.json` records exact timing. Technical scheduling validation is automated; audible owner approval remains required.
