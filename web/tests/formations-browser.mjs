import { resolve } from "node:path";
import { createRecord, readRecord, SAVE_KEY, SETTINGS_KEY } from "../src/records.mjs";

export async function formationChecks(browser, url, monitor, check, out) {
  const opening = [
    [7,1,0,6,2,0], [1,0,0,2,0,0], [7,6,0,6,5,0], [1,1,0,2,1,0],
    [7,2,0,6,1,0], [1,2,0,2,2,0], [7,5,0,6,6,0], [1,3,0,2,3,0],
  ];
  const record=createRecord(opening,{mode:"local",difficulty:"knight",humanSide:1});
  readRecord(JSON.stringify(record)); // A legal opening, never a board-editor fixture.
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:"reduce"});
  await context.addInitScript(({record,saveKey,settingsKey})=>{
    if (!localStorage.getItem(saveKey)) localStorage.setItem(saveKey,JSON.stringify(record));
    localStorage.setItem(settingsKey,JSON.stringify({sound:false,motion:"reduced",battles:"quick"}));
  },{record,saveKey:SAVE_KEY,settingsKey:SETTINGS_KEY});
  const page=await context.newPage(); monitor(page);
  const idle=()=>page.waitForFunction(()=>document.querySelector("#board").getAttribute("aria-busy")==="false");
  const cell=i=>page.locator(`[data-index="${i}"]`);
  const load=async()=>readRecord(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).state;
  try {
    await page.goto(url); await page.locator("#continue").click();
    for (const [i,layout] of [[49,2],[53,1],[50,3]]) {
      await cell(i).click(); await page.locator(`[data-layout="${layout}"]`).click(); await idle();
    }
    check((await page.locator("#turn-number").textContent())==="09", "three preparations keep the same turn");
    check((await page.locator("#formation-budget").textContent()).includes("3/3"), "three-formation budget is visible");
    await cell(54).click();
    check((await page.locator("#formation-controls button:enabled").count())===0,"fourth formation cannot rearrange");
    await page.locator("#flip-button").click();
    check((await cell(49).locator('[data-slot="0"]').getAttribute("data-position"))==="E","flipped view rotates drawn subcells");
    check((await load()).layout[49]===2,"flipping preserves physical layout");
    await page.reload(); await page.locator("#continue").click();
    check((await load()).prepared.length===3,"partial-turn autosave restores spent budget");
    await page.locator("#review-button").click();
    for (let i=0;i<record.moves.length+3;i++) await page.locator("#replay-next").click();
    check((await page.locator("#replay-position").textContent()).startsWith("8 orders"),"review counts preparations separately from orders");
    await page.locator("#replay-exit").click();
    await page.locator("#undo-button").click();
    let state=await load();
    check(state.ply===8 && state.prepared.length===0 && state.layout[49]===0,"Undo cancels pending preparations without undoing an earlier turn");
    await cell(49).click(); await page.locator('[data-layout="2"]').click(); await idle();
    await page.locator('[data-select-slot="1"]').click(); await cell(41).click(); await idle();
    state=await load();
    check(state.ply===9 && state.prepared.length===0 && state.board[49].length===1 && state.layout[49]===-1,"normal order finishes the phase and dissolves a departed member's formation");
    await page.locator("#undo-button").click(); state=await load();
    check(state.ply===8 && state.layout[49]===0 && state.board[49].length===2,"local Undo reverses the complete prepared turn");
    await cell(49).click();
    await page.screenshot({path:resolve(out,"formations-desktop.png"),fullPage:true});
    await page.setViewportSize({width:360,height:844});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"mixed formations and arrangement controls fit 360px");
    check(await page.locator("#formation-controls").evaluate(el=>el.getBoundingClientRect().width>200),"mobile arrangement controls use the full panel width");
    await page.screenshot({path:resolve(out,"formations-mobile.png"),fullPage:true});
  } finally { await context.close(); }

  const solo=await browser.newContext({reducedMotion:"reduce"});
  const aiRecord=createRecord([...opening,[6,1,0,6,1,6]],{mode:"solo",difficulty:"squire",humanSide:-1});
  await solo.addInitScript(({record,saveKey,settingsKey})=>{
    localStorage.setItem(saveKey,JSON.stringify(record));
    localStorage.setItem(settingsKey,JSON.stringify({sound:false,motion:"reduced",battles:"quick"}));
  },{record:aiRecord,saveKey:SAVE_KEY,settingsKey:SETTINGS_KEY});
  const sp=await solo.newPage();monitor(sp);
  try {
    await sp.goto(url);await sp.locator("#continue").click();
    await sp.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).moves.filter(a=>a[5]<4||a[5]===8).length===9,SAVE_KEY);
    const restored=readRecord(await sp.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).state;
    check(restored.turn===-1 && restored.prepared.length===0,"loading a pending AI preparation finishes its turn and returns control to the human");
  } finally {await solo.close();}

  // Exercise the exported renderer with genuine engine events. These rare exact
  // arrangements need no production board editor or mutable app-state test hook.
  const cinema=await browser.newContext({viewport:{width:1100,height:950}});
  const p=await cinema.newPage(); monitor(p);
  try {
    await p.goto(url);
    for (const scenario of ["reserve","simultaneous","target-b"]) {
      const details=await p.evaluate(async scenario=>{
        const {studyState,transition}=await import("./src/engine.mjs");
        const {CombatDirector}=await import("./src/animation.mjs");
        const board=Array.from({length:64},()=>[]); board[63]=[6];board[0]=[-6];board[7]=[-1];board[56]=[1];
        let action;
        if(scenario==="reserve") {board[43]=[-2];board[35]=[1,3];action=[5,3,0,4,3,1];}
        else if(scenario==="simultaneous") {board[36]=[-1];board[35]=[2,2];action=[4,4,0,4,3,1];}
        else {board[43]=[-3];board[35]=[4,3];action=[5,3,0,4,3,8];}
        const before=studyState(board,-1),result=transition(before,action);
        window.formationCinemaDone=false;
        const director=new CombatDirector({effect(){}});
        director.play(before,result.event,{motion:"full",battles:"cinematic"}).then(()=>window.formationCinemaDone=true);
        return {mode:result.event.formation?.mode,primary:result.event.formation?.waves[0].slots[0]??result.event.targetSlot};
      },scenario);
      await p.locator("#battle-dialog").waitFor({state:"visible"});
      check((await p.locator(".combatant.defender").getAttribute("data-defender-slot"))===String(details.primary),`${scenario}: cinematic uses the actual first defender`);
      if(scenario==="reserve") {
        await p.waitForFunction(()=>document.querySelector("#encounter-phase").textContent.includes("reserve turns"));
        check(await p.locator('.combatant[data-defender-slot="1"]').evaluate(el=>Number(getComputedStyle(el).opacity)<.1),"first casualty falls before the reserve turns");
        await p.waitForTimeout(350);
      } else if(scenario==="simultaneous") {
        await p.waitForFunction(()=>document.querySelector("#encounter-phase").textContent.includes("Both exposed"));
        check(details.mode==="simultaneous","simultaneous contact is presented as one wave");
      } else await p.locator(".return-arrow").waitFor({state:"attached"});
      await p.screenshot({path:resolve(out,`formation-combat-${scenario}.png`)});
      await p.locator("#skip-battle").click();
      await p.waitForFunction(()=>window.formationCinemaDone);
      check(!(await p.locator("#battle-dialog").isVisible()),`${scenario}: skipping closes the encounter cleanly`);
    }
  } finally { await cinema.close(); }
}
