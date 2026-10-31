// Install a known clock, then pause comfortably ahead of protocol/renderer lag.
// Call after boot jobs are stopped, before seeding time-sensitive fixtures.
module.exports=async function pausedClock(page){
 const start=Date.now();
 await page.clock.install({time:start});
 await page.clock.pauseAt(start+60000);
};
