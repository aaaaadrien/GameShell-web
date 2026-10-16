// Node test harness for GameShell web edition.
// Loads the JS modules with a fake window/document and runs scenarios.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, 'js');

// fake DOM
const elements = {};
function makeEl(id) {
  return {
    id,
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 100,
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {},
    addEventListener() {},
    focus() {},
    style: {},
  };
}
['output', 'terminal', 'prompt', 'input', 'mission-indicator', 'status-right',
 'btn-goal', 'btn-help', 'btn-reset', 'btn-lang', 'nano-overlay', 'nano-titlebar',
 'nano-content', 'nano-footer', 'pager-overlay', 'pager-titlebar', 'pager-content',
 'pager-footer'].forEach(id => elements[id] = makeEl(id));

const documentStub = {
  readyState: 'complete',
  getElementById: (id) => elements[id] || (elements[id] = makeEl(id)),
  createElement: (tag) => makeEl('dyn_' + tag),
  createTextNode: (text) => ({ text }),
  addEventListener: () => {},
  cookie: '',
};

const windowStub = {
  navigator: { language: 'en' },
  document: documentStub,
  setTimeout: (fn) => 0, // don't run timers in tests
  setInterval: () => 0,
  clearInterval: () => {},
};

const sandbox = {
  console,
  Date,
  Math,
  JSON,
  RegExp,
  parseInt,
  isNaN,
  String,
  Object,
  Array,
  setTimeout: () => 0,
  setInterval: () => 0,
  clearInterval: () => {},
  navigator: { language: 'en' },
  document: documentStub,
};
// window IS the global object (like in the browser)
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(file) {
  const code = fs.readFileSync(path.join(DIR, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

load('goals_data.js');
load('i18n.js');
load('fs.js');
load('shell.js');
load('missions.js');
load('game.js');

// Now run tests
const W = sandbox.window;
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL: ' + msg); }
}
function section(name) { console.log('\n=== ' + name + ' ==='); }

// ---- FS tests ----
section('FS');
{
  const f = new W.FS();
  f._mkdirPath('/home/Castle/Cellar', { silent: true });
  assert(f.getNode('/home/Castle/Cellar') !== null, 'mkdirPath creates dir');
  f.write('/home/Castle/Cellar/spider_1', 'art');
  assert(f.getNode('/home/Castle/Cellar/spider_1').content === 'art', 'write file');
  f.sign('/home/Castle/Cellar/spider_1');
  assert(f.checkSign('/home/Castle/Cellar/spider_1'), 'sign/checkSign');
  f.write('/home/Castle/Cellar/spider_1', 'tampered');
  assert(!f.checkSign('/home/Castle/Cellar/spider_1'), 'tamper detected');
  // glob
  f.write('/home/Castle/Cellar/bat_1', 'x');
  const names = f.listEntries('/home/Castle/Cellar');
  assert(names.includes('spider_1') && names.includes('bat_1'), 'listEntries');
  // find
  const found = f.find('/home/Castle/Cellar', { name: 'spider_*' });
  assert(found.length === 1, 'find by name');
  // mv
  f.mv('/home/Castle/Cellar/spider_1', '/home/Castle/Cellar/spider_moved');
  assert(f.getNode('/home/Castle/Cellar/spider_moved') !== null, 'mv file');
  assert(f.getNode('/home/Castle/Cellar/spider_1') === null, 'mv removes old');
  // cp
  f.cp('/home/Castle/Cellar/spider_moved', '/home/Castle/Cellar/spider_copy');
  assert(f.getNode('/home/Castle/Cellar/spider_copy') !== null, 'cp file');
  // rm
  f.rm('/home/Castle/Cellar/spider_copy');
  assert(f.getNode('/home/Castle/Cellar/spider_copy') === null, 'rm file');
  // chmod
  f.chmod('/home/Castle/Cellar', 'rw-r--r--');
  assert(!f.getNode('/home/Castle/Cellar').ownerX(), 'chmod -x');
  // resolve
  f.cwd = '/home/Castle/Cellar';
  assert(f.resolve('..') === '/home/Castle', 'resolve ..');
  assert(f.resolve('~/foo') === '/home/foo', 'resolve ~');
  // serialize
  const ser = f.serialize();
  const f2 = W.FS.deserialize(ser);
  assert(f2.getNode('/home/Castle/Cellar/bat_1') !== null, 'serialize/deserialize');
}

// ---- Shell tests ----
section('Shell');
{
  const f = new W.FS();
  const sh = new W.Shell(f);
  const sink = new W.StringSink();
  sh.setSink(sink);
  f._mkdirPath('/home/Castle/Cellar', { silent: true });
  f.write('/home/Castle/Cellar/spider_1', 'art\n');
  f.write('/home/Castle/Cellar/bat_1', 'bat\n');

  // cd
  sh.execLine('cd Castle/Cellar');
  assert(f.cwd === '/home/Castle/Cellar', 'cd relative');
  // pwd
  sink.str = '';
  sh.execLine('pwd');
  assert(sink.str.includes('Cellar'), 'pwd');
  // ls
  sink.str = '';
  sh.execLine('ls');
  assert(sink.str.includes('spider_1') && sink.str.includes('bat_1'), 'ls');
  // cat
  sink.str = '';
  sh.execLine('cat spider_1');
  assert(sink.str.includes('art'), 'cat');
  // echo
  sink.str = '';
  sh.execLine('echo hello');
  assert(sink.str.trim() === 'hello', 'echo');
  // mkdir
  sh.execLine('mkdir newdir');
  assert(f.getNode('/home/Castle/Cellar/newdir') !== null, 'mkdir');
  // rm with wildcard
  sh.execLine('rm spider_*');
  assert(f.getNode('/home/Castle/Cellar/spider_1') === null, 'rm wildcard');
  // mv
  sh.execLine('mv bat_1 bat_moved');
  assert(f.getNode('/home/Castle/Cellar/bat_moved') !== null, 'mv');
  // head
  f.write('/home/Castle/Cellar/multi', 'line1\nline2\nline3\nline4\nline5\n');
  sink.str = '';
  sh.execLine('head -n 2 multi');
  assert(sink.str.includes('line1') && sink.str.includes('line2') && !sink.str.includes('line3'), 'head -n 2');
  // tail
  sink.str = '';
  sh.execLine('tail -n 2 multi');
  assert(sink.str.includes('line4') && sink.str.includes('line5') && !sink.str.includes('line3'), 'tail -n 2');
  // pipe: cat | head
  sink.str = '';
  sh.execLine('cat multi | head -n 1');
  assert(sink.str.trim() === 'line1', 'pipe cat|head');
  // pipe: grep
  sink.str = '';
  sh.execLine('cat multi | grep line3');
  assert(sink.str.trim() === 'line3', 'pipe grep');
  // redirection >
  sh.execLine('echo redirected > out.txt');
  assert(f.getNode('/home/Castle/Cellar/out.txt').content.includes('redirected'), 'redirection >');
  // redirection <
  sink.str = '';
  sh.execLine('cat < out.txt');
  assert(sink.str.includes('redirected'), 'redirection <');
  // 2> /dev/null
  sink.str = '';
  sh.execLine('cat nonexistent 2> /dev/null');
  assert(!sink.str.includes('No such file'), '2> /dev/null suppresses error');
  // alias
  sh.execLine("alias la='ls -A'");
  assert(sh.aliases['la'] === 'ls -A', 'alias');
  // find
  sink.str = '';
  sh.execLine('find . -name "multi"');
  assert(sink.str.includes('multi'), 'find');
  // wc
  sink.str = '';
  sh.execLine('wc multi');
  assert(sink.str.includes('5'), 'wc');
  // sort
  f.write('/home/Castle/Cellar/unsorted', 'b\na\nc\n');
  sink.str = '';
  sh.execLine('sort unsorted');
  assert(sink.str.indexOf('a') < sink.str.indexOf('b') && sink.str.indexOf('b') < sink.str.indexOf('c'), 'sort');
  // tr
  sink.str = '';
  sh.execLine('echo "hello" | tr "h" "H"');
  assert(sink.str.trim() === 'Hello', 'tr');
  // chmod
  sh.execLine('chmod +x multi');
  assert(f.getNode('/home/Castle/Cellar/multi').ownerX(), 'chmod +x');
  // history
  assert(sh.history.length > 0, 'history recorded');
  // replay
  const rep = sh.replay('cat multi | head -n 1');
  assert(rep.stdout.trim() === 'line1', 'replay pipe');
}

// ---- Game / mission tests ----
section('Game missions');
{
  // Reset the game state by re-initing
  const G = W.Game;
  // We need to re-init the game fresh. The Game.init() was already called on load.
  // Let's start a new game.
  G.newGame();
  assert(G.missionIndex === 0, 'new game starts at mission 0');
  assert(G.fs.getNode('/home/Castle/Cellar') !== null, 'world built (cellar)');
  assert(G.fs.getNode('/home/Forest') !== null, 'world built (forest)');

  // Mission 1: cd to top of tower
  const tower = G.fs.home + '/Castle/Main_tower/First_floor/Second_floor/Top_of_the_tower';
  G.executeLine('cd Castle/Main_tower/First_floor/Second_floor/Top_of_the_tower');
  assert(G.fs.cwd === tower, 'mission 1: cd to tower');
  G.doCheck();
  assert(G.completed[G.currentMissionId()] === true || G.missionIndex === 1, 'mission 1 passed');

  // Mission 2: cd to cellar (from tower top, use ~)
  G.executeLine('cd ~/Castle/Cellar');
  G.doCheck();
  assert(G.missionIndex === 2, 'mission 2 passed');

  // Mission 3: cd home then throne room
  G.executeLine('cd');
  G.executeLine('cd ~/Castle/Main_building/Throne_room');
  G.doCheck();
  assert(G.missionIndex === 3, 'mission 3 passed');

  // Mission 4: mkdir Hut and Chest
  G.executeLine('cd ~');
  G.executeLine('cd Forest');
  G.executeLine('mkdir Hut');
  G.executeLine('cd Hut');
  G.executeLine('mkdir Chest');
  G.doCheck();
  assert(G.missionIndex === 4, 'mission 4 passed');

  // Mission 5: rm spiders in cellar
  G.executeLine('cd ~/Castle/Cellar');
  // find spider files
  const cellar = G.fs.getNode(G.fs.home + '/Castle/Cellar');
  const spiders = Object.keys(cellar.children).filter(k => k.startsWith('araignee_') || k.startsWith('spider_'));
  for (const s of spiders) {
    G.executeLine('rm ' + s);
  }
  G.doCheck();
  assert(G.missionIndex === 5, 'mission 5 passed');

  console.log('\nReached mission index: ' + G.missionIndex + ' (' + G.currentMissionId() + ')');
}

console.log('\n================================');
console.log('PASSED: ' + passed + '  FAILED: ' + failed);
if (failed > 0) process.exit(1);
