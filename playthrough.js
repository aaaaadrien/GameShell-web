// Full playthrough test: solves every mission in order.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = '/home/adrien/programmation/git/GameShell-web/web/js';

const elements = {};
function makeEl(id){return {id,textContent:'',innerHTML:'',value:'',disabled:false,scrollTop:0,scrollHeight:0,clientHeight:100,classList:{add(){},remove(){},contains(){return false;}},appendChild(){},addEventListener(){},focus(){},style:{}};}
['output','terminal','prompt','input','mission-indicator','status-right','btn-goal','btn-help','btn-reset','btn-lang','nano-overlay','nano-titlebar','nano-content','nano-footer','pager-overlay','pager-titlebar','pager-content','pager-footer'].forEach(id=>elements[id]=makeEl(id));
const documentStub={readyState:'complete',getElementById:(id)=>elements[id]||(elements[id]=makeEl(id)),createElement:(t)=>makeEl('d'+t),createTextNode:(t)=>({text:t}),addEventListener:()=>{},cookie:''};
const sandbox={console,Date,Math,JSON,RegExp,parseInt,isNaN,String,Object,Array,setTimeout:(fn)=>{return 0;},setInterval:()=>0,clearInterval:()=>{},navigator:{language:'en'},document:documentStub};
sandbox.window=sandbox;
vm.createContext(sandbox);
function load(f){vm.runInContext(fs.readFileSync(path.join(DIR,f),'utf8'),sandbox,{filename:f});}
load('goals_data.js');load('i18n.js');load('fs.js');load('shell.js');load('missions.js');load('game.js');

const G = sandbox.window.Game;
let passed = 0, failed = 0;
function assert(cond, msg){ if(cond){passed++;} else {failed++; console.error('FAIL: '+msg);} }
function expectMission(G, idx, label){
  if (G.missionIndex === idx) { passed++; console.log('  ok: '+label+' (now at '+(idx+1)+')'); }
  else { failed++; console.error('  FAIL: '+label+' expected index '+idx+' got '+G.missionIndex+' ('+G.currentMissionId()+')'); }
}

G.newGame();
console.log('Starting playthrough from mission 1...');

function cmd(line){ G.executeLine(line); }
function answer(s){ G.submitAnswer(s); }

// 1. cd_tower
cmd('cd Castle/Main_tower/First_floor/Second_floor/Top_of_the_tower');
G.doCheck(); expectMission(G,1,'01_cd_tower');

// 2. cd.._cellar
cmd('cd ~/Castle/Cellar');
G.doCheck(); expectMission(G,2,'02_cd.._cellar');

// 3. cd_HOME_throne
cmd('cd');
cmd('cd ~/Castle/Main_building/Throne_room');
G.doCheck(); expectMission(G,3,'03_cd_HOME_throne');

// 4. mkdir_chest
cmd('cd ~/Forest');
cmd('mkdir Hut');
cmd('cd Hut');
cmd('mkdir Chest');
G.doCheck(); expectMission(G,4,'04_mkdir_chest');

// 5. rm_spiders_cellar
cmd('cd ~/Castle/Cellar');
{
  const cellar = G.fs.getNode(G.fs.home+'/Castle/Cellar');
  const spiders = Object.keys(cellar.children).filter(k=>k.startsWith('spider_'));
  for (const s of spiders) cmd('rm '+s);
}
G.doCheck(); expectMission(G,5,'05_rm_spiders_cellar');

// 6. mv_coins_garden
cmd('cd ~/Garden');
{
  const garden = G.fs.getNode(G.fs.home+'/Garden');
  const coins = Object.keys(garden.children).filter(k=>k.startsWith('coin_'));
  for (const c of coins) cmd('mv '+c+' ~/Forest/Hut/Chest');
}
G.doCheck(); expectMission(G,6,'06_mv_coins_garden');

// 7. mv_hidden_coins_garden
cmd('cd ~/Garden');
{
  const garden = G.fs.getNode(G.fs.home+'/Garden');
  const coins = Object.keys(garden.children).filter(k=>k.startsWith('.')&&k.includes('_coin_'));
  for (const c of coins) cmd('mv '+c+' ~/Forest/Hut/Chest');
}
G.doCheck(); expectMission(G,7,'07_mv_hidden_coins_garden');

// 8. rm_wildcard_spiders_cellar
cmd('cd ~/Castle/Cellar');
cmd('rm *_spider_*');
G.doCheck(); expectMission(G,8,'08_rm_wildcard_spiders_cellar');

// 9. rm_wildcard_hidden_spiders_cellar
cmd('cd ~/Castle/Cellar');
cmd('rm .*_spider_*');
G.doCheck(); expectMission(G,9,'09_rm_wildcard_hidden_spiders_cellar');

// 10. cp_standard_great_hall
cmd('cd ~/Castle/Great_hall');
cmd('cp standard_* ~/Forest/Hut/Chest');
G.doCheck(); expectMission(G,10,'10_cp_standard_great_hall');

// 11. cp_wildcards_tapestries_great_hall
cmd('cd ~/Castle/Great_hall');
cmd('cp *_tapestry_* ~/Forest/Hut/Chest');
G.doCheck(); expectMission(G,11,'11_cp_wildcards_tapestries_great_hall');

// 12. cp_ls_mtime_paintings_tower
cmd('cd ~/Castle/Main_tower/First_floor');
{
  const p = G.tmp.painting12;
  cmd('cp '+p+' ~/Forest/Hut/Chest');
}
G.doCheck(); expectMission(G,12,'12_cp_ls_mtime_paintings_tower');

// 13. cal_nostradamus (interactive)
G.doCheck();
{
  const ans = G.tmp.calAnswer + 1; // 1=Sunday
  answer(String(ans));
}
expectMission(G,13,'01_cal_nostradamus');

// 14. alias_la
cmd("alias la='ls -A'");
G.doCheck(); expectMission(G,14,'01_alias_la');

// 15. nano_journal
{
  const chest = G.fs.home+'/Forest/Hut/Chest';
  G.fs.write(chest+'/journal.txt','My adventure begins...\n');
}
G.doCheck(); expectMission(G,15,'02_nano_journal');

// 16. alias_journal
cmd("alias journal='nano ~/Forest/Hut/Chest/journal.txt'");
G.doCheck(); expectMission(G,16,'02_alias_journal');

// 17. tab_spider_lair
{
  const lair = G.tmp.lair;
  cmd('cd "'+lair+'"');
  const lairNode = G.fs.getNode(lair);
  const queen = Object.keys(lairNode.children).find(k=>k.includes('spider_queen'));
  cmd('rm '+queen);
}
G.doCheck(); expectMission(G,17,'03_tab_spider_lair');

// 18. background (flarigo x3)
cmd('flarigo &');
cmd('flarigo &');
cmd('flarigo &');
G.doCheck(); expectMission(G,18,'05_background');

// 19. control-C (interactive)
G.doCheck();
answer(G.tmp.charmCode);
expectMission(G,19,'06_control-C');

// 20. ls_cd (copper coin in maze)
{
  const maze = G.fs.home+'/Garden/Maze';
  const coin = G.fs.find(maze,{name:'*copper_coin*'})[0];
  cmd('mv '+coin+' ~/Forest/Hut/Chest');
}
G.doCheck(); expectMission(G,20,'01_ls_cd');

// 21. tree (silver coin)
{
  const maze = G.fs.home+'/Garden/Maze';
  const coin = G.fs.find(maze,{name:'*silver_coin*'})[0];
  cmd('mv '+coin+' ~/Forest/Hut/Chest');
}
G.doCheck(); expectMission(G,21,'02_tree');

// 22. find_1 (gold coins)
{
  const maze = G.fs.home+'/Garden/Maze';
  const c1 = G.fs.find(maze,{name:'gold_coin_1'})[0];
  const c2 = G.fs.find(maze,{name:'GolD_CoiN_2'})[0];
  cmd('mv '+c1+' ~/Forest/Hut/Chest');
  cmd('mv '+c2+' ~/Forest/Hut/Chest');
}
G.doCheck(); expectMission(G,22,'03_find_1');

// 23-27. pipe_intro (must be in cave, previous command matters)
cmd('cd ~/Mountain/Cave');
cmd('head -n 6 Book_of_potions/page_07');
G.doCheck(); expectMission(G,23,'01_head');

cmd('cd ~/Mountain/Cave');
cmd('tail -n 9 Book_of_potions/page_12');
G.doCheck(); expectMission(G,24,'02_tail');

cmd('cd ~/Mountain/Cave');
cmd('cat Book_of_potions/page_01 Book_of_potions/page_02');
G.doCheck(); expectMission(G,25,'03_cat');

cmd('cd ~/Mountain/Cave');
cmd('cat Book_of_potions/page_03 Book_of_potions/page_04 | tail -n 16');
G.doCheck(); expectMission(G,26,'04_pipe');

cmd('cd ~/Mountain/Cave');
cmd('head -n 6 Book_of_potions/page_13 | tail -n 3');
G.doCheck(); expectMission(G,27,'05_pipe_head_tail');

// 28. ps_kill
{
  cmd('ps');
  cmd('kill '+G.tmp.spellPid);
}
G.doCheck(); expectMission(G,28,'01_ps_kill');

// 29. ps_kill_signal (try TERM first, then KILL)
{
  cmd('ps');
  if (G.tmp.spellPids && G.tmp.spellPids.length > 0) {
    cmd('kill '+G.tmp.spellPids[0]); // TERM: spawns a new spell
  }
  for (const pid of (G.tmp.spellPids || []).slice()) cmd('kill -9 '+pid);
}
G.doCheck(); expectMission(G,29,'02_ps_kill_signal');

// 30. pstree_kill
{
  cmd('pstree -p');
  for (const pid of (G.tmp.impSpellPids || [])) cmd('kill -9 '+pid);
  // remove coal
  const cellar = G.fs.getNode(G.fs.home+'/Castle/Cellar');
  const coals = Object.keys(cellar.children).filter(k=>k.includes('_coal'));
  for (const c of coals) cmd('rm '+c);
}
G.doCheck(); expectMission(G,30,'03_pstree_kill');

// 31. stdin_additions (interactive multi)
G.doCheck();
{
  const qs = G.tmp.additions || [];
  for (let i=0;i<qs.length;i++){
    answer(String(qs[i].r));
    if (!G.awaitingInput) break;
  }
}
expectMission(G,31,'01_stdin_additions');

// 32. stdin_redirection_multiplications (interactive multi)
G.doCheck();
{
  const qs = G.tmp.multiplications || [];
  for (let i=0;i<qs.length;i++){
    answer(String(qs[i].r));
    if (!G.awaitingInput) break;
  }
}
expectMission(G,32,'02_stdin_redirection_multiplications');

// 33. stdout_redirection_inventory
cmd('cd ~/Castle/Main_building/Library/Merlin_s_office');
cmd('ls grimoire_* > ~/Castle/Main_building/Library/Merlin_s_office/Drawer/inventory.txt');
G.doCheck(); expectMission(G,33,'03_stdout_redirection_inventory');

// 34. stderr_dev-null_grimoires
cmd('cd ~/Castle/Main_building/Library/Merlin_s_office');
cmd('grep -il gsh * 2> /dev/null');
G.doCheck(); expectMission(G,34,'04_stderr_dev-null_grimoires');

// 35. stdout_stderr_redirection_merlin
cmd('cd ~/Castle/Observatory');
cmd('./merlin 2> keyfile');
G.doCheck();
answer(G.tmp.secretKey);
expectMission(G,35,'05_stdout_stderr_redirection_merlin');

// 36. chmod_x_dir_king_quarter
cmd('cd ~/Castle/Main_building/Throne_room');
cmd('chmod +x Kings_quarter');
cmd('cd Kings_quarter');
G.doCheck(); expectMission(G,36,'01_chmod_x_dir_king_quarter');

// 37. chmod_r_file_king_quarter
G.doCheck();
answer(G.tmp.key);
expectMission(G,37,'02_chmod_r_file_king_quarter');

// 38. chmod_rw_file_dir_throne_room
cmd('cd ~/Castle/Main_building/Throne_room');
cmd('chmod 755 Safe');
cmd('chmod 644 Safe/crown');
cmd('cp Safe/crown ~/Forest/Hut/Chest');
G.doCheck();
answer(G.tmp.crownKey);
expectMission(G,38,'03_chmod_rw_file_dir_throne_room');

// 39. find_2 (ruby)
{
  const maze = G.fs.home+'/Garden/Maze';
  const rubyFile = G.tmp.rubyFile;
  // find the file with that name in the maze
  const found = G.fs.find(maze,{name:rubyFile})[0];
  cmd('mv '+found+' ~/Forest/Hut/Chest');
}
G.doCheck(); expectMission(G,39,'04_find_2');

// 40. find_xargs_grep (diamond)
{
  const maze = G.fs.home+'/Garden/Maze';
  const diamondFile = G.tmp.diamondFile;
  const found = G.fs.find(maze,{name:diamondFile})[0];
  cmd('mv '+found+' ~/Forest/Hut/Chest');
}
G.doCheck(); expectMission(G,40,'05_find_xargs_grep');

// 41. pipe_1 (king's debt)
G.doCheck();
answer(String(G.tmp.amountKing));
expectMission(G,41,'01_pipe_1');

// 42. pipe_2 (unpaid count)
G.doCheck();
answer(String(G.tmp.nbUnpaid));
expectMission(G,42,'02_pipe_2');

// 43. tr_caesar_shift
G.doCheck();
answer(G.tmp.magicWord);
expectMission(G,43,'03_tr_caesar_shift');

// 44. FINAL_MISSION - no check, just confirm we're here
expectMission(G,43,'FINAL_MISSION (at final)');

console.log('\n================================');
console.log('PLAYTHROUGH PASSED: '+passed+'  FAILED: '+failed);
if (failed>0) process.exit(1);
