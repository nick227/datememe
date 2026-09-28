import { searchOpenverse, usableCandidates } from '../lib/openverse'
const qs = ['puppy kitten', 'pet hamster', 'red panda', 'otter', 'paper planner', 'calendar planner', 'granola bowl', 'breakfast bowl', 'cleaning supplies', 'beer taps', 'bar counter', 'empty wallet', 'lisbon tram', 'porto city']
;(async () => { for (const q of qs) { try { console.log(q, usableCandidates(await searchOpenverse(q)).length) } catch (e: any) { console.log(q, 'ERR', e.message) } await new Promise((r) => setTimeout(r, 3500)) } })()
