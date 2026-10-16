// Game controller for GameShell web edition.
// Manages game state, the shell, missions, save/load (cookie), and the UI.

(function () {
  'use strict';

  const COOKIE_NAME = 'gameshell_save';
  const COOKIE_DAYS = 365;

  const Game = {
    fs: null,
    shell: null,
    missionIndex: 0,
    completed: {},
    tmp: {},
    lang: 'en',
    awaitingInput: null,
    started: false,
    totalMissions: 0,

    // i18n helpers (delegated to I18N)
    t(key, vars) { return I18N.t(key, vars); },
    mt(missionDir, key, vars) { return I18N.mt(missionDir, key, vars); },

    // ----------------------------------------------------------------
    // initialization
    // ----------------------------------------------------------------
    init() {
      this.lang = I18N.detectLang();
      I18N.setLang(this.lang);
      this.totalMissions = MISSIONS.order.length;

      this.fs = new FS();
      this.shell = new Shell(this.fs);
      this.shell.setSink(this.makeSink());

      // hooks used by the shell
      this.shell.bgPrograms = {
        flarigo: (args, shell) => this._startFlarigo(shell),
        charmiglio: null, // handled as a normal command
      };

      // command counter hook for merchant stall missions
      this.shell.onCommand = (line) => this._onCommand(line);

      const saved = this.loadGame();
      if (saved) {
        this.missionIndex = saved.missionIndex || 0;
        this.completed = saved.completed || {};
        this.lang = saved.lang || this.lang;
        I18N.setLang(this.lang);
        if (saved.aliases) {
          for (const k in saved.aliases) this.shell.aliases[k] = saved.aliases[k];
        }
        MISSIONS.buildWorld(this);
        this.startMission(this.missionIndex, true);
        this.appendOutput('\n' + I18N.t('goal_shown') + '\n');
      } else {
        this.newGame();
      }

      this.updateUI();
      this.setupInput();
      this.updateLangButton();
      this.started = true;
      this.focusInput();
    },

    newGame() {
      this.missionIndex = 0;
      this.completed = {};
      this.tmp = {};
      MISSIONS.buildWorld(this);
      this.appendOutput(I18N.t('welcome') + '\n\n');
      this.appendOutput(I18N.t('init_msg') + '\n\n');
      this.startMission(0, false);
    },

    // ----------------------------------------------------------------
    // cookie save / load
    // ----------------------------------------------------------------
    saveGame() {
      try {
        const data = {
          missionIndex: this.missionIndex,
          completed: this.completed,
          lang: this.lang,
          aliases: this.shell.aliases,
          time: Date.now(),
        };
        const json = JSON.stringify(data);
        const expires = new Date(Date.now() + COOKIE_DAYS * 86400 * 1000).toUTCString();
        document.cookie = COOKIE_NAME + '=' + encodeURIComponent(json) + '; expires=' + expires + '; path=/; SameSite=Lax';
      } catch (e) {
        // cookie too large or disabled; ignore
      }
    },

    loadGame() {
      try {
        const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
        if (!m) return null;
        return JSON.parse(decodeURIComponent(m[1]));
      } catch (e) {
        return null;
      }
    },

    clearSave() {
      const expires = new Date(0).toUTCString();
      document.cookie = COOKIE_NAME + '=; expires=' + expires + '; path=/';
    },

    // ----------------------------------------------------------------
    // mission management
    // ----------------------------------------------------------------
    currentMissionId() {
      return MISSIONS.order[this.missionIndex];
    },

    currentMission() {
      return MISSIONS.missions[this.currentMissionId()];
    },

    startMission(index, isReload) {
      this.missionIndex = index;
      const id = MISSIONS.order[index];
      const mission = MISSIONS.missions[id];
      if (!mission) return;
      // clean up any background processes from previous mission
      this._killAllProcesses();
      try {
        mission.init(this);
      } catch (e) {
        this.appendOutput('Error initializing mission: ' + e.message + '\n');
      }
      if (this._teleportMsg) {
        this.appendOutput(this._teleportMsg + '\n');
        this._teleportMsg = null;
      }
      // show the goal
      const goal = this.getGoalText(id);
      this.appendOutput('\n' + this.boxText(I18N.t('goal_title', { nb: index + 1 }) + '\n' + goal) + '\n');
      this.saveGame();
      this.updateUI();
    },

    getGoalText(id) {
      const mission = MISSIONS.missions[id];
      if (mission && mission.goal) {
        return mission.goal(this);
      }
      return I18N.goalText(id, this.lang);
    },

    advanceMission() {
      const id = this.currentMissionId();
      this.completed[id] = true;
      this.saveGame();
      if (this.missionIndex + 1 < this.totalMissions) {
        this.appendOutput('\n' + I18N.t('mission_passed', { nb: this.missionIndex + 1 }) + '\n');
        this.startMission(this.missionIndex + 1, false);
      } else {
        this.appendOutput('\n' + I18N.t('final_congrats') + '\n');
        this.appendOutput(I18N.t('exit_msg') + '\n');
      }
    },

    resetMission() {
      const id = this.currentMissionId();
      const mission = MISSIONS.missions[id];
      this._killAllProcesses();
      if (mission.clean) {
        try { mission.clean(this); } catch (e) {}
      }
      this.tmp = {};
      this.startMission(this.missionIndex, true);
      this.appendOutput(I18N.t('mission_reset', { nb: this.missionIndex + 1 }) + '\n');
    },

    skipMission() {
      const id = this.currentMissionId();
      const mission = MISSIONS.missions[id];
      this._killAllProcesses();
      if (mission.clean) {
        try { mission.clean(this); } catch (e) {}
      }
      this.tmp = {};
      this.completed[id] = 'skipped';
      if (this.missionIndex + 1 < this.totalMissions) {
        this.appendOutput(I18N.t('mission_skipped', { nb: this.missionIndex + 1 }) + '\n');
        this.startMission(this.missionIndex + 1, false);
      } else {
        this.appendOutput(I18N.t('final_congrats') + '\n');
      }
    },

    gotoMission(n) {
      n = n - 1; // 1-based
      if (n < 0 || n >= this.totalMissions) {
        this.appendOutput(I18N.t('no_mission', { nb: n + 1 }) + '\n');
        return;
      }
      // only allow going to a previous mission or the next one without "password"
      this._killAllProcesses();
      const id = this.currentMissionId();
      const mission = MISSIONS.missions[id];
      if (mission.clean) { try { mission.clean(this); } catch (e) {} }
      this.tmp = {};
      this.appendOutput(I18N.t('mission_goto', { nb: n + 1 }) + '\n');
      this.startMission(n, true);
    },

    _killAllProcesses() {
      for (const p of this.shell.processes) {
        if (p.status !== 'done') this.shell._terminateProc(p);
      }
    },

    // ----------------------------------------------------------------
    // gsh command
    // ----------------------------------------------------------------
    gshCommand(args, io) {
      const sub = args[0];
      if (!sub) {
        io.stdout.writeln(I18N.t('gsh_help'));
        return 0;
      }
      switch (sub) {
        case 'check':
          this.doCheck();
          return 0;
        case 'goal': {
          let n = this.missionIndex;
          if (args[1] !== undefined) {
            const m = parseInt(args[1], 10);
            if (!isNaN(m) && m >= 1 && m <= this.totalMissions) n = m - 1;
            else { io.stdout.writeln(I18N.t('no_mission', { nb: args[1] })); return 1; }
          }
          const id = MISSIONS.order[n];
          const goal = this.getGoalText(id);
          io.stdout.writeln(this.boxText(I18N.t('goal_title', { nb: n + 1 }) + '\n' + goal));
          return 0;
        }
        case 'help':
          io.stdout.writeln(I18N.t('gsh_help'));
          return 0;
        case 'HELP':
          io.stdout.writeln(I18N.t('gsh_full_help'));
          return 0;
        case 'reset':
          this.resetMission();
          return 0;
        case 'skip':
          this.skipMission();
          return 0;
        case 'goto':
          if (args[1] === undefined) {
            io.stdout.writeln(I18N.t('usage', { usage: 'gsh goto N' }));
            return 1;
          }
          this.gotoMission(parseInt(args[1], 10));
          return 0;
        case 'index':
          this.showIndex(io);
          return 0;
        case 'stat':
          this.showStat(io);
          return 0;
        case 'version':
          io.stdout.writeln(I18N.t('version'));
          return 0;
        case 'welcome':
          io.stdout.writeln(I18N.t('welcome'));
          return 0;
        case 'exit':
          this.exitGame();
          return 0;
        case 'pcm':
          io.stdout.writeln(String(this.missionIndex + 1));
          return 0;
        case 'env':
          for (const k in this.shell.env) io.stdout.writeln(k + '=' + this.shell.env[k]);
          return 0;
        default:
          io.stderr.writeln('gsh: unknown command: ' + sub);
          return 1;
      }
    },

    showIndex(io) {
      io.stdout.writeln(I18N.t('index_title') + ':\n');
      for (let i = 0; i < this.totalMissions; i++) {
        const id = MISSIONS.order[i];
        const name = MISSIONS.missions[id].name;
        let status;
        if (i === this.missionIndex) status = I18N.t('index_current');
        else if (this.completed[id] === true) status = I18N.t('index_done');
        else if (this.completed[id] === 'skipped') status = '[-]';
        else status = I18N.t('index_todo');
        io.stdout.writeln('  ' + String(i + 1).padStart(3) + '  ' + name.padEnd(40) + ' ' + status);
      }
    },

    showStat(io) {
      let done = 0, skipped = 0;
      for (const id in this.completed) {
        if (this.completed[id] === true) done++;
        else skipped++;
      }
      io.stdout.writeln(I18N.t('stat_title') + ':');
      io.stdout.writeln('  ' + I18N.t('stat_missions', { done: done, total: this.totalMissions }));
      io.stdout.writeln('  ' + (I18N.getLang() === 'fr' ? 'Missions sautées : ' : 'Missions skipped : ') + skipped);
    },

    // ----------------------------------------------------------------
    // check flow
    // ----------------------------------------------------------------
    doCheck() {
      const mission = this.currentMission();
      if (!mission) return;
      let result;
      try {
        result = mission.check(this);
      } catch (e) {
        this.appendOutput('Error during check: ' + e.message + '\n');
        return;
      }
      if (result.interactive) {
        this.handleInteractive(result);
      } else {
        this.handleCheckResult(result);
      }
    },

    handleCheckResult(result) {
      if (result.pass) {
        if (result.msg) this.appendOutput(result.msg + '\n');
        this.advanceMission();
      } else {
        if (result.msg) this.appendOutput(result.msg + '\n');
      }
    },

    handleInteractive(result) {
      if (result.multi) {
        // multi-question (additions / multiplications)
        this.awaitingInput = {
          type: 'multi',
          idx: 0,
          count: result.count,
          questionFn: result.question,
          validate: result.validate,
        };
        this.appendOutput(result.question(0));
        this.focusInput();
      } else {
        this.awaitingInput = {
          type: 'single',
          question: result.question,
          validate: result.validate,
        };
        this.appendOutput(result.question);
        this.focusInput();
      }
    },

    // called when the user submits an answer to an interactive prompt
    submitAnswer(text) {
      const ai = this.awaitingInput;
      if (!ai) return;
      if (ai.type === 'single') {
        const res = ai.validate(text);
        this.awaitingInput = null;
        this.handleCheckResult(res);
      } else if (ai.type === 'multi') {
        const res = ai.validate(text, ai.idx);
        if (!res.pass) {
          this.awaitingInput = null;
          this.handleCheckResult(res);
          return;
        }
        ai.idx++;
        if (ai.idx < ai.count) {
          this.appendOutput(ai.questionFn(ai.idx));
          this.focusInput();
        } else {
          this.awaitingInput = null;
          this.handleCheckResult({ pass: true });
        }
      }
    },

    // ----------------------------------------------------------------
    // command execution wrapper
    // ----------------------------------------------------------------
    executeLine(line) {
      const code = this.shell.execLine(line);
      this.updateUI();
      return code;
    },

    _onCommand(line) {
      // count commands for merchant stall missions
      const id = this.currentMissionId();
      if (id && id.startsWith('pipes_merchant_stall')) {
        if (!line.trim().startsWith('gsh')) {
          this.tmp.nbCommands = (this.tmp.nbCommands || 0) + 1;
        }
      }
    },

    // ----------------------------------------------------------------
    // background programs
    // ----------------------------------------------------------------
    _startFlarigo(shell) {
      const proc = shell._startProcess({
        name: I18N.obj('flarigo'),
        cmd: I18N.obj('flarigo'),
        interval: 800,
        tick: (p, sh) => {
          sh.sink.writeln(I18N.t('flarigo_msg'));
          // finish after a short while
          setTimeout(() => { sh._terminateProc(p); }, 1500);
        },
      });
      return proc;
    },

    charmiglio(args, io) {
      const mission = this.currentMission();
      if (mission && mission.charmiglio) {
        return mission.charmiglio(this, args, io);
      }
      io.stdout.writeln(I18N.t('charmiglio_msg'));
      return 0;
    },

    getSecretKey() {
      const mission = this.currentMission();
      if (mission && mission.getSecretKey) {
        return mission.getSecretKey.call(this);
      }
      return '';
    },

    // ----------------------------------------------------------------
    // UI
    // ----------------------------------------------------------------
    makeSink() {
      const self = this;
      return {
        write: (s) => self.appendOutput(s),
        writeln: (s) => self.appendOutput(s + '\n'),
      };
    },

    appendOutput(text) {
      const out = document.getElementById('output');
      if (!out) return;
      out.appendChild(document.createTextNode(text));
      const term = document.getElementById('terminal');
      if (term) term.scrollTop = term.scrollHeight;
    },

    boxText(text) {
      // simple box around text
      const lines = text.split('\n');
      const maxLen = Math.max(...lines.map(l => l.length));
      const top = '+' + '-'.repeat(maxLen + 2) + '+';
      const bot = '+' + '-'.repeat(maxLen + 2) + '+';
      let s = top + '\n';
      for (const l of lines) {
        s += '| ' + l.padEnd(maxLen) + ' |\n';
      }
      s += bot;
      return s;
    },

    clearScreen() {
      const out = document.getElementById('output');
      if (out) out.innerHTML = '';
    },

    updatePrompt() {
      const promptEl = document.getElementById('prompt');
      if (!promptEl) return;
      const cwd = this.shell._displayPath(this.fs.cwd);
      let p = I18N.t('prompt_user') + '@' + I18N.t('prompt_host') + ':' + cwd + '$ ';
      const id = this.currentMissionId();
      if (id && id.startsWith('pipes_merchant_stall')) {
        p = '(' + (this.tmp.nbCommands || 0) + ') ' + p;
      }
      promptEl.textContent = p;
    },

    updateUI() {
      this.updatePrompt();
      const ind = document.getElementById('mission-indicator');
      if (ind) {
        const id = this.currentMissionId();
        const name = id ? MISSIONS.missions[id].name : '';
        ind.textContent = I18N.t('status_mission', { nb: this.missionIndex + 1, total: this.totalMissions }) + ' — ' + name;
      }
      const right = document.getElementById('status-right');
      if (right) {
        right.textContent = I18N.t('status_lang', { lang: I18N.getLang() === 'fr' ? 'FR' : 'EN' });
      }
    },

    updateLangButton() {
      const btn = document.getElementById('btn-lang');
      if (btn) btn.textContent = (I18N.getLang() === 'fr') ? 'FR' : 'EN';
    },

    toggleLang() {
      this.lang = (this.lang === 'fr') ? 'en' : 'fr';
      I18N.setLang(this.lang);
      this.updateLangButton();
      this.updateUI();
      this.appendOutput('\n' + (I18N.getLang() === 'fr' ? 'Langue : Français\n' : 'Language: English\n'));
      this.saveGame();
    },

    focusInput() {
      const input = document.getElementById('input');
      if (input) input.focus();
    },

    // ----------------------------------------------------------------
    // input handling
    // ----------------------------------------------------------------
    setupInput() {
      const input = document.getElementById('input');
      const self = this;
      let historyIdx = -1;
      let savedLine = '';

      input.addEventListener('keydown', (e) => {
        // Tab completion
        if (e.key === 'Tab') {
          e.preventDefault();
          self._tabComplete(input);
          return;
        }
        // Arrow up / down: history
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const hist = self.shell.history;
          if (hist.length === 0) return;
          if (historyIdx === -1) {
            savedLine = input.value;
            historyIdx = hist.length - 1;
          } else if (historyIdx > 0) {
            historyIdx--;
          }
          input.value = hist[historyIdx];
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const hist = self.shell.history;
          if (historyIdx === -1) return;
          if (historyIdx < hist.length - 1) {
            historyIdx++;
            input.value = hist[historyIdx];
          } else {
            historyIdx = -1;
            input.value = savedLine;
          }
          return;
        }
        // Enter
        if (e.key === 'Enter') {
          const line = input.value;
          input.value = '';
          historyIdx = -1;
          if (self.awaitingInput) {
            self.appendOutput(line + '\n');
            self.submitAnswer(line);
          } else {
            self.appendOutput(self._promptText() + line + '\n');
            if (line.trim() === '') return;
            self.executeLine(line);
          }
          self.updateUI();
          self.focusInput();
          return;
        }
        // Ctrl-C: interrupt
        if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
          e.preventDefault();
          self.appendOutput('^C\n');
          // kill the current foreground "process" (simulated)
          return;
        }
        // Ctrl-L: clear
        if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
          e.preventDefault();
          self.clearScreen();
          return;
        }
        // Ctrl-D: exit
        if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
          e.preventDefault();
          self.exitGame();
          return;
        }
      });

      // top bar buttons
      document.getElementById('btn-goal').addEventListener('click', () => {
        self.executeLine('gsh goal');
      });
      document.getElementById('btn-help').addEventListener('click', () => {
        self.executeLine('gsh help');
      });
      document.getElementById('btn-reset').addEventListener('click', () => {
        self.executeLine('gsh reset');
      });
      document.getElementById('btn-lang').addEventListener('click', () => {
        self.toggleLang();
      });

      // keep focus on the input when clicking in the terminal
      document.getElementById('terminal').addEventListener('click', () => {
        self.focusInput();
      });
    },

    _promptText() {
      const cwd = this.shell._displayPath(this.fs.cwd);
      let p = I18N.t('prompt_user') + '@' + I18N.t('prompt_host') + ':' + cwd + '$ ';
      const id = this.currentMissionId();
      if (id && id.startsWith('pipes_merchant_stall')) {
        p = '(' + (this.tmp.nbCommands || 0) + ') ' + p;
      }
      return p;
    },

    _tabComplete(input) {
      const val = input.value;
      const lastSpace = val.lastIndexOf(' ');
      const prefix = (lastSpace === -1) ? '' : val.slice(0, lastSpace + 1);
      const word = (lastSpace === -1) ? val : val.slice(lastSpace + 1);
      // anchor = everything up to (and including) the last slash, or up to the
      // last space if there is no slash. base = the part after the anchor.
      const slash = word.lastIndexOf('/');
      let anchor, base, dirPart = null;
      if (slash !== -1) {
        dirPart = word.slice(0, slash + 1);
        anchor = prefix + dirPart;
        base = word.slice(slash + 1);
      } else {
        anchor = prefix;
        base = word;
      }
      const dir = (dirPart !== null) ? this.fs.resolve(dirPart) : this.fs.cwd;
      this._completeInDir(input, anchor, dir, base, val);
    },

    // bash-style completion:
    //   1st Tab  -> complete the longest common prefix
    //   2nd Tab  -> list all possible completions
    //   3rd Tab+ -> cycle through the matches one by one
    _completeInDir(input, anchor, dir, base, val) {
      const st = this._tabState;

      // if we are already cycling, keep cycling as long as the input still
      // points at one of the remembered matches
      if (st && st.cycling && val.startsWith(st.anchor)) {
        let bare = val.slice(st.anchor.length);
        if (bare.endsWith('/')) bare = bare.slice(0, -1);
        if (bare.endsWith(' ')) bare = bare.slice(0, -1);
        const idx = st.matches.indexOf(bare);
        if (idx !== -1) {
          this._cycleTo(input, st, (idx + 1) % st.matches.length);
          return;
        }
      }

      const dirNode = this.fs.getNode(dir);
      if (!dirNode || !dirNode.isDir()) {
        this._tabState = null;
        return;
      }

      // if we are in the middle of a (non-cycling) sequence for this anchor,
      // continue it: 2nd Tab lists, 3rd Tab starts cycling
      if (st && st.anchor === anchor &&
          (st.matches.includes(base) || st.matches.every(m => m.startsWith(base)))) {
        if (!st.listed) {
          this.appendOutput('  ' + st.matches.join('  ') + '\n');
          st.listed = true;
        } else {
          st.cycling = true;
          this._cycleTo(input, st, 0);
        }
        return;
      }

      // new completion
      const names = Object.keys(dirNode.children);
      const matched = names.filter(n => n.startsWith(base)).sort();
      if (matched.length === 0) {
        this._tabState = null;
        return;
      }
      if (matched.length === 1) {
        const n = matched[0];
        const isDir = dirNode.children[n].isDir();
        input.value = anchor + n + (isDir ? '/' : ' ');
        this._tabState = null;
        return;
      }
      // multiple matches: complete the longest common prefix
      let common = matched[0];
      for (let i = 1; i < matched.length && common; i++) {
        while (matched[i].indexOf(common) !== 0) common = common.slice(0, -1);
      }
      if (common.length > base.length) {
        input.value = anchor + common;
      }
      this._tabState = { anchor: anchor, dir: dir, matches: matched, listed: false, index: -1, cycling: false };
    },

    _cycleTo(input, st, index) {
      const dirNode = this.fs.getNode(st.dir);
      const n = st.matches[index];
      st.index = index;
      let suffix;
      if (dirNode && dirNode.isDir() && dirNode.children[n] && dirNode.children[n].isDir()) {
        suffix = '/';
      } else {
        suffix = ' ';
      }
      input.value = st.anchor + n + suffix;
    },

    // ----------------------------------------------------------------
    // nano / pager overlays
    // ----------------------------------------------------------------
    showNano(file, content, callback) {
      const overlay = document.getElementById('nano-overlay');
      const titlebar = document.getElementById('nano-titlebar');
      const contentEl = document.getElementById('nano-content');
      const footer = document.getElementById('nano-footer');
      const self = this;

      titlebar.textContent = I18N.t('nano_saved', { file: file });
      contentEl.innerHTML = '';
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.spellcheck = false;
      contentEl.appendChild(textarea);
      footer.textContent = I18N.getLang() === 'fr'
        ? 'Ctrl-O: enregistrer   Ctrl-X: quitter   Ctrl-W: chercher'
        : 'Ctrl-O: Write Out   Ctrl-X: Exit   Ctrl-W: Where Is';
      overlay.classList.remove('hidden');
      textarea.focus();

      // disable the terminal input so keystrokes don't leak into it
      const input = document.getElementById('input');
      const inputWasDisabled = input ? input.disabled : false;
      if (input) input.disabled = true;

      const close = (value, saved) => {
        overlay.classList.add('hidden');
        textarea.removeEventListener('keydown', onKey);
        if (input) input.disabled = inputWasDisabled;
        callback(value, saved);
        self.focusInput();
      };

      const onKey = (e) => {
        if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
          e.preventDefault();
          footer.textContent = I18N.t('nano_wrote', { n: textarea.value.length });
        } else if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
          e.preventDefault();
          close(textarea.value, true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          close(content, false);
        }
      };
      textarea.addEventListener('keydown', onKey);
    },

    showPager(title, content, callback) {
      const overlay = document.getElementById('pager-overlay');
      const titlebar = document.getElementById('pager-titlebar');
      const contentEl = document.getElementById('pager-content');
      const footer = document.getElementById('pager-footer');
      const self = this;

      titlebar.textContent = title;
      contentEl.textContent = content;
      footer.textContent = I18N.t('pager_quit');
      overlay.classList.remove('hidden');
      contentEl.scrollTop = 0;

      // disable the terminal input so keystrokes don't leak into it
      const input = document.getElementById('input');
      const inputWasDisabled = input ? input.disabled : false;
      if (input) input.disabled = true;

      const close = () => {
        overlay.classList.add('hidden');
        document.removeEventListener('keydown', onKey, true);
        if (input) input.disabled = inputWasDisabled;
        if (callback) callback();
        self.focusInput();
      };

      const onKey = (e) => {
        if (e.key === 'q' || e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
        } else if (e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          contentEl.scrollTop += contentEl.clientHeight;
        }
      };
      document.addEventListener('keydown', onKey, true);
    },

    // ----------------------------------------------------------------
    // exit
    // ----------------------------------------------------------------
    exitGame() {
      this.saveGame();
      this.appendOutput('\n' + I18N.t('exit_msg') + '\n');
      const input = document.getElementById('input');
      if (input) input.disabled = true;
    },
  };

  window.Game = Game;

  // start the game when the DOM is ready
  function start() {
    Game.init();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
