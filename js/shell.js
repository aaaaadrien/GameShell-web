// Shell engine for GameShell web edition.
// Parses and executes commands, supports pipes, redirections, background
// jobs, aliases, globbing, and a simulated process table.

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // Tokenizer
  // ------------------------------------------------------------------

  // Split a line into top-level segments by the given separator chars,
  // respecting single and double quotes.
  function splitTopLevel(line, seps) {
    const out = [];
    let cur = '';
    let i = 0;
    let sq = false, dq = false;
    while (i < line.length) {
      const c = line[i];
      if (c === '\\' && i + 1 < line.length) {
        cur += c + line[i + 1];
        i += 2;
        continue;
      }
      if (c === "'" && !dq) { sq = !sq; cur += c; i++; continue; }
      if (c === '"' && !sq) { dq = !dq; cur += c; i++; continue; }
      if (!sq && !dq && seps.includes(c)) {
        out.push(cur);
        cur = '';
        i++;
        continue;
      }
      cur += c;
      i++;
    }
    out.push(cur);
    return out;
  }

  // Tokenize a single pipeline stage into words + redirections + bg flag.
  // Returns { words: [..], redirs: [{type, file}], bg: bool }
  function tokenizeStage(stage) {
    const words = [];
    const redirs = [];
    let bg = false;
    let cur = '';
    let i = 0;
    let sq = false, dq = false;
    let hasWord = false;

    const pushWord = () => {
      if (hasWord || cur.length > 0) {
        words.push(cur);
        cur = '';
        hasWord = false;
      }
    };

    while (i < stage.length) {
      const c = stage[i];
      if (c === '\\' && i + 1 < stage.length) {
        cur += stage[i + 1];
        hasWord = true;
        i += 2;
        continue;
      }
      if (c === "'" && !dq) {
        // single quote: copy until closing quote literally
        sq = true;
        i++;
        while (i < stage.length && stage[i] !== "'") {
          cur += stage[i];
          i++;
        }
        if (i < stage.length) i++; // skip closing '
        sq = false;
        hasWord = true;
        continue;
      }
      if (c === '"' && !sq) {
        dq = true;
        i++;
        while (i < stage.length && stage[i] !== '"') {
          if (stage[i] === '\\' && i + 1 < stage.length && (stage[i+1] === '"' || stage[i+1] === '$' || stage[i+1] === '\\')) {
            cur += stage[i+1];
            i += 2;
            continue;
          }
          cur += stage[i];
          i++;
        }
        if (i < stage.length) i++; // skip closing "
        dq = false;
        hasWord = true;
        continue;
      }
      // whitespace separates words (outside quotes)
      if (!sq && !dq && (c === ' ' || c === '\t')) {
        pushWord();
        i++;
        continue;
      }
      // redirections (only outside quotes)
      if (!sq && !dq) {
        if (c === '<') {
          pushWord();
          i++;
          // skip spaces
          while (i < stage.length && (stage[i] === ' ' || stage[i] === '\t')) i++;
          let file = '';
          while (i < stage.length && !' \t|&;'.includes(stage[i])) { file += stage[i]; i++; }
          redirs.push({ type: 'in', file });
          continue;
        }
        if (c === '>') {
          pushWord();
          i++;
          let type = 'out';
          if (i < stage.length && stage[i] === '>') { type = 'append'; i++; }
          while (i < stage.length && (stage[i] === ' ' || stage[i] === '\t')) i++;
          let file = '';
          while (i < stage.length && !' \t|&;'.includes(stage[i])) { file += stage[i]; i++; }
          redirs.push({ type, file });
          continue;
        }
        if (c === '2' && i + 1 < stage.length && stage[i + 1] === '>') {
          pushWord();
          i += 2;
          let type = 'err';
          if (i < stage.length && stage[i] === '>') { type = 'errappend'; i++; }
          while (i < stage.length && (stage[i] === ' ' || stage[i] === '\t')) i++;
          let file = '';
          while (i < stage.length && !' \t|&;'.includes(stage[i])) { file += stage[i]; i++; }
          redirs.push({ type, file });
          continue;
        }
        if (c === '&' && i + 1 < stage.length && stage[i + 1] === '&') {
          // && - treat as literal word char (not supported, keep simple)
          cur += '&&';
          hasWord = true;
          i += 2;
          continue;
        }
        if (c === '&') {
          pushWord();
          bg = true;
          i++;
          continue;
        }
      }
      cur += c;
      hasWord = true;
      i++;
    }
    pushWord();
    return { words, redirs, bg };
  }

  // ------------------------------------------------------------------
  // Sink helpers
  // ------------------------------------------------------------------

  class StringSink {
    constructor() { this.str = ''; }
    write(s) { this.str += s; }
    writeln(s) { this.str += s + '\n'; }
    get() { return this.str; }
  }

  // ------------------------------------------------------------------
  // Shell
  // ------------------------------------------------------------------

  class Shell {
    constructor(fs) {
      this.fs = fs;
      this.aliases = {};
      this.history = [];
      this.processes = [];
      this.env = {
        HOME: fs.home,
        USER: 'player',
        EDITOR: 'nano',
        PS1: '$ ',
      };
      this.pidCounter = 1000;
      this.lastCommandLine = null;
      this.sink = new StringSink();
      this.tickTimer = null;
      this.noglobal = false;
      this.onCommand = null; // hook: called with each executed line
      this.bgPrograms = {}; // name -> function(args, shell) returning a process
      this._setupCommands();
    }

    setSink(sink) { this.sink = sink; }
    out() { return this.sink; }

    // Execute a line in "capture" mode: returns {stdout, stderr, exitCode}.
    // Used by missions that re-run the player's previous command.
    replay(line) {
      const so = new StringSink();
      const se = new StringSink();
      // We need stdout and stderr captured separately. Build a combined sink
      // that routes based on a flag. Simplest: run with a sink that captures
      // everything, but we need them separate. So we temporarily wrap.
      const code = this.execLine(line, {
        sink: {
          write: (s) => { so.write(s); },
          writeln: (s) => { so.writeln(s); },
        },
        errSink: se,
        noHistory: true,
      });
      return { stdout: so.get(), stderr: se.get(), exitCode: code };
    }

    isDevNull(path) {
      return this.fs.resolve(path) === '/dev/null';
    }

    _nextPid() { return ++this.pidCounter; }

    // ----------------------------------------------------------------
    // Main entry: execute a full line
    // ----------------------------------------------------------------
    execLine(line, opts) {
      opts = opts || {};
      const sink = opts.sink || this.sink;
      line = line.trim();
      if (line === '') return 0;

      // record history (for fc / previous-command checks)
      if (!opts.noHistory) {
        this.history.push(line);
        if (this.history.length > 500) this.history.shift();
        if (this.onCommand) this.onCommand(line);
      }

      // alias expansion (first word only)
      line = this._expandAlias(line);

      // split into segments by ';'
      const segments = splitTopLevel(line, [';']).map(s => s.trim()).filter(s => s !== '');

      let exitCode = 0;
      for (const seg of segments) {
        exitCode = this._execSegment(seg, sink, opts);
      }
      return exitCode;
    }

    _expandAlias(line) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
      if (m && this.aliases[m[1]] !== undefined) {
        return this.aliases[m[1]] + line.slice(m[1].length);
      }
      return line;
    }

    _execSegment(seg, sink, opts) {
      // split by '|' into stages
      const stages = splitTopLevel(seg, ['|']).map(s => s.trim());
      // tokenize each stage
      const tokenized = stages.map(s => tokenizeStage(s));

      // background?
      const bg = tokenized[tokenized.length - 1].bg;

      // set up pipes: stage i's stdout -> stage i+1's stdin
      // We execute synchronously, capturing intermediate output.
      let input = (opts.stdin !== undefined) ? opts.stdin : '';

      let exitCode = 0;
      for (let i = 0; i < tokenized.length; i++) {
        const { words, redirs } = tokenized[i];
        if (words.length === 0) continue;

        // apply redirections to determine stdin/stdout/stderr
        let stdin = input;
        let stdout = (i < tokenized.length - 1) ? new StringSink() : sink;
        let stderr = (opts.errSink) ? opts.errSink : sink;

        for (const r of redirs) {
          const target = this.fs.resolve(r.file);
          if (r.type === 'in') {
            const node = this.fs.getNode(r.file);
            if (node && node.isFile()) {
              if (!node.ownerR()) { sink.writeln(I18N.t('permission_denied') + ': ' + r.file); return 1; }
              stdin = node.content;
            } else {
              sink.writeln(I18N.t('no_such_file') + ': ' + r.file);
              return 1;
            }
          } else if (r.type === 'out' || r.type === 'append') {
            const s = new StringSink();
            if (r.type === 'append') {
              const node = this.fs.getNode(r.file);
              if (node && node.isFile()) s.write(node.content);
            }
            stdout = s;
            // write to file after execution
            this._pendingWrites = this._pendingWrites || [];
            this._pendingWrites.push({ file: r.file, sink: s, append: r.type === 'append' });
          } else if (r.type === 'err' || r.type === 'errappend') {
            const s = new StringSink();
            if (r.type === 'errappend') {
              const node = this.fs.getNode(r.file);
              if (node && node.isFile()) s.write(node.content);
            }
            stderr = s;
            this._pendingWrites = this._pendingWrites || [];
            this._pendingWrites.push({ file: r.file, sink: s, append: r.type === 'errappend', isErr: true });
          }
        }

        // execute the command
        const cmdName = words[0];
        const args = words.slice(1);
        try {
          exitCode = this._execCommand(cmdName, args, { stdin, stdout, stderr, sink, opts });
        } catch (e) {
          if (e instanceof FSError) {
            stderr.writeln(this._fmtError(e, cmdName));
            exitCode = 1;
          } else {
            stderr.writeln('Error: ' + e.message);
            exitCode = 1;
          }
        }

        // flush pending writes
        if (this._pendingWrites) {
          for (const pw of this._pendingWrites) {
            if (this.isDevNull(pw.file)) continue;
            try {
              if (pw.isErr) {
                // write stderr to file
                const node = this.fs.getNode(pw.file);
                if (node && node.isFile() && pw.append) {
                  this.fs.write(pw.file, node.content + pw.sink.get(), { append: true });
                } else {
                  this.fs.write(pw.file, pw.sink.get());
                }
              } else {
                if (pw.append) {
                  const node = this.fs.getNode(pw.file);
                  if (node && node.isFile()) {
                    this.fs.write(pw.file, node.content + pw.sink.get(), { append: true });
                  } else {
                    this.fs.write(pw.file, pw.sink.get());
                  }
                } else {
                  this.fs.write(pw.file, pw.sink.get());
                }
              }
            } catch (e) {
              sink.writeln(this._fmtError(e, cmdName));
            }
          }
          this._pendingWrites = [];
        }

        // pass stdout to next stage
        if (stdout instanceof StringSink) {
          input = stdout.get();
        } else {
          input = '';
        }
      }

      // background job
      if (bg && tokenized.length > 0 && tokenized[0].words.length > 0) {
        this._startBackground(tokenized[0].words, sink);
      }

      // remember last command line (for previous-command missions)
      if (!opts.noHistory) {
        const firstWord = seg.trim().split(/\s+/)[0];
        if (!firstWord.startsWith('gsh')) {
          this.lastCommandLine = seg;
        }
      }

      return exitCode;
    }

    _fmtError(e, cmdName) {
      const msg = I18N.t(e.code) || e.code;
      return cmdName + ': ' + msg + (e.arg ? ' ' + e.arg : '');
    }

    // ----------------------------------------------------------------
    // Command dispatch
    // ----------------------------------------------------------------
    _execCommand(cmdName, args, io) {
      // handle ./executable and absolute paths
      if (cmdName.startsWith('./') || cmdName.startsWith('/') || cmdName.includes('/')) {
        return this._execProgram(cmdName, args, io);
      }
      const fn = this.commands[cmdName];
      if (!fn) {
        io.stderr.writeln(I18N.t('cmd_not_found', { cmd: cmdName }));
        return 127;
      }
      return fn.call(this, args, io);
    }

    // execute a "program" from the filesystem (./merlin, etc.)
    _execProgram(path, args, io) {
      const node = this.fs.getNode(path);
      if (!node || !node.isFile()) {
        io.stderr.writeln(I18N.t('no_such_file') + ': ' + path);
        return 127;
      }
      if (!node.ownerX()) {
        io.stderr.writeln(I18N.t('permission_denied') + ': ' + path);
        return 126;
      }
      const name = node.name;
      if (name === 'merlin') {
        return this._cmdMerlin(args, io);
      }
      // generic: treat content as a script? For now, unknown program.
      io.stderr.writeln(I18N.t('cmd_not_found', { cmd: name }));
      return 127;
    }

    // ----------------------------------------------------------------
    // Globbing
    // ----------------------------------------------------------------
    _glob(word) {
      if (this.noglobal) return [word];
      if (!word.includes('*') && !word.includes('?')) return [word];
      // split into dir part and base part
      const lastSlash = word.lastIndexOf('/');
      let dirPart, basePart;
      if (lastSlash === -1) {
        dirPart = this.fs.cwd;
        basePart = word;
      } else {
        dirPart = word.slice(0, lastSlash);
        basePart = word.slice(lastSlash + 1);
      }
      const dirNode = this.fs.getNode(dirPart);
      if (!dirNode || !dirNode.isDir()) return [word];
      const names = Object.keys(dirNode.children);
      const matched = names.filter(n => this.fs._globMatch(n, basePart));
      matched.sort();
      if (matched.length === 0) return [word]; // no match: keep literal
      return matched.map(n => (dirPart === this.fs.cwd ? n : dirPart + '/' + n));
    }

    _expandArgs(args) {
      const out = [];
      for (const a of args) {
        const expanded = this._glob(a);
        for (const e of expanded) out.push(e);
      }
      return out;
    }

    // ----------------------------------------------------------------
    // Variable expansion
    // ----------------------------------------------------------------
    _expandVars(s) {
      return s.replace(/\$([A-Za-z_][A-Za-z0-9_]*|\$)/g, (m, name) => {
        if (name === '$') return String(this._shellPid());
        return (this.env[name] !== undefined) ? this.env[name] : '';
      });
    }

    _shellPid() {
      // the shell's own pid
      if (!this._shellPidVal) {
        this._shellPidVal = this._nextPid();
      }
      return this._shellPidVal;
    }

    // ----------------------------------------------------------------
    // Process system
    // ----------------------------------------------------------------
    _startProcess(opts) {
      const proc = {
        pid: this._nextPid(),
        name: opts.name,
        cmd: opts.cmd,
        status: 'running',
        parent: opts.parent || null,
        children: [],
        onSignal: opts.onSignal || {},
        tick: opts.tick || null,
        interval: opts.interval || 2000,
        timer: null,
        data: opts.data || {},
      };
      if (proc.parent !== null) {
        const p = this._findProc(proc.parent);
        if (p) p.children.push(proc.pid);
      }
      this.processes.push(proc);
      if (proc.tick) {
        proc.timer = setInterval(() => {
          if (proc.status === 'running') {
            try { proc.tick(proc, this); } catch (e) {}
          }
        }, proc.interval);
      }
      return proc;
    }

    _findProc(pid) {
      return this.processes.find(p => p.pid === pid);
    }

    _killProc(pid, signal) {
      const proc = this._findProc(pid);
      if (!proc || proc.status === 'done') return false;
      signal = signal || 'TERM';
      const handler = proc.onSignal[signal];
      if (handler) {
        handler(proc, this);
        return true;
      }
      // default: TERM and KILL kill the process; INT kills too
      if (signal === 'KILL' || signal === 'TERM' || signal === 'INT') {
        this._terminateProc(proc);
        return true;
      }
      return true;
    }

    _terminateProc(proc) {
      proc.status = 'done';
      if (proc.timer) { clearInterval(proc.timer); proc.timer = null; }
      // terminate children
      for (const cpid of proc.children) {
        const c = this._findProc(cpid);
        if (c && c.status !== 'done') this._terminateProc(c);
      }
    }

    _startBackground(words, sink) {
      const cmdName = words[0];
      const args = words.slice(1);
      // special background programs
      if (this.bgPrograms[cmdName]) {
        const proc = this.bgPrograms[cmdName](args, this);
        if (proc) {
          sink.writeln(I18N.t('bg_started', { pid: proc.pid }));
        }
        return proc;
      }
      // generic: run the command once in background (simulate)
      const proc = this._startProcess({
        name: cmdName,
        cmd: words.join(' '),
        tick: (p, shell) => {
          // run the command, then finish
          const s = new StringSink();
          try { shell._execCommand(cmdName, args, { stdin: '', stdout: s, stderr: s, sink: s }); } catch (e) {}
          shell._terminateProc(p);
        },
        interval: 100,
      });
      sink.writeln(I18N.t('bg_started', { pid: proc.pid }));
      return proc;
    }

    // ----------------------------------------------------------------
    // Built-in commands
    // ----------------------------------------------------------------
    _setupCommands() {
      const C = this.commands = {};

      C.cd = (args, io) => this._cmdCd(args, io);
      C.pwd = (args, io) => this._cmdPwd(args, io);
      C.ls = (args, io) => this._cmdLs(args, io);
      C.mkdir = (args, io) => this._cmdMkdir(args, io);
      C.rm = (args, io) => this._cmdRm(args, io);
      C.mv = (args, io) => this._cmdMv(args, io);
      C.cp = (args, io) => this._cmdCp(args, io);
      C.cat = (args, io) => this._cmdCat(args, io);
      C.head = (args, io) => this._cmdHead(args, io);
      C.tail = (args, io) => this._cmdTail(args, io);
      C.echo = (args, io) => this._cmdEcho(args, io);
      C.find = (args, io) => this._cmdFind(args, io);
      C.tree = (args, io) => this._cmdTree(args, io);
      C.man = (args, io) => this._cmdMan(args, io);
      C.less = (args, io) => this._cmdLess(args, io);
      C.sort = (args, io) => this._cmdSort(args, io);
      C.wc = (args, io) => this._cmdWc(args, io);
      C.grep = (args, io) => this._cmdGrep(args, io);
      C.xargs = (args, io) => this._cmdXargs(args, io);
      C.tr = (args, io) => this._cmdTr(args, io);
      C.cal = (args, io) => this._cmdCal(args, io);
      C.nano = (args, io) => this._cmdNano(args, io);
      C.alias = (args, io) => this._cmdAlias(args, io);
      C.unalias = (args, io) => this._cmdUnalias(args, io);
      C.chmod = (args, io) => this._cmdChmod(args, io);
      C.ps = (args, io) => this._cmdPs(args, io);
      C.kill = (args, io) => this._cmdKill(args, io);
      C.pstree = (args, io) => this._cmdPstree(args, io);
      C.clear = (args, io) => this._cmdClear(args, io);
      C.history = (args, io) => this._cmdHistory(args, io);
      C.fc = (args, io) => this._cmdFc(args, io);
      C.jobs = (args, io) => this._cmdJobs(args, io);
      C.date = (args, io) => this._cmdDate(args, io);
      C.touch = (args, io) => this._cmdTouch(args, io);
      C.gsh = (args, io) => this._cmdGsh(args, io);
      C.exit = (args, io) => this._cmdExit(args, io);
      C.flarigo = (args, io) => this._cmdFlarigo(args, io);
      C.charmiglio = (args, io) => this._cmdCharmiglio(args, io);
      C.xeyes = (args, io) => this._cmdXeyes(args, io);
      C.set = (args, io) => this._cmdSet(args, io);
      C.true = (args, io) => 0;
      C.false = (args, io) => 1;
      C.which = (args, io) => {
        for (const a of args) {
          if (this.commands[a] || this.aliases[a] !== undefined) io.stdout.writeln('/usr/bin/' + a);
        }
        return 0;
      };
      C.env = (args, io) => {
        for (const k in this.env) io.stdout.writeln(k + '=' + this.env[k]);
        return 0;
      };
      C.printenv = (args, io) => {
        if (args.length === 0) {
          for (const k in this.env) io.stdout.writeln(k + '=' + this.env[k]);
        } else {
          for (const a of args) if (this.env[a] !== undefined) io.stdout.writeln(this.env[a]);
        }
        return 0;
      };
      C.export = (args, io) => {
        for (const a of args) {
          const m = a.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
          if (m) this.env[m[1]] = m[2];
        }
        return 0;
      };
      C.source = (args, io) => {
        // . or source: read a file and execute lines
        if (args.length === 0) return 0;
        const node = this.fs.getNode(args[0]);
        if (!node || !node.isFile()) { io.stderr.writeln(I18N.t('no_such_file') + ': ' + args[0]); return 1; }
        const lines = node.content.split('\n');
        for (const ln of lines) {
          if (ln.trim() === '') continue;
          this.execLine(ln, { sink: io.sink });
        }
        return 0;
      };
      C['.'] = C.source;
      C.bash = (args, io) => {
        // simulate: just return 0
        return 0;
      };
      C.sh = C.bash;
    }

    // ---------- individual commands ----------

    _cmdCd(args, io) {
      let target;
      if (args.length === 0) {
        target = this.fs.home;
      } else if (args[0] === '-') {
        target = this.fs.prevCwd;
      } else {
        target = this.fs.resolve(args[0]);
      }
      const node = this.fs.getNode(target);
      if (!node) {
        io.stderr.writeln('cd: ' + I18N.t('no_such_file') + ' ' + (args[0] || ''));
        return 1;
      }
      if (!node.isDir()) {
        io.stderr.writeln('cd: ' + I18N.t('not_a_directory') + ' ' + (args[0] || ''));
        return 1;
      }
      if (!node.ownerX()) {
        io.stderr.writeln('cd: ' + I18N.t('permission_denied') + ' ' + (args[0] || ''));
        return 1;
      }
      this.fs.prevCwd = this.fs.cwd;
      this.fs.cwd = target;
      return 0;
    }

    _cmdPwd(args, io) {
      io.stdout.writeln(this._displayPath(this.fs.cwd));
      return 0;
    }

    _displayPath(path) {
      if (path === this.fs.home) return '~';
      if (path.startsWith(this.fs.home + '/')) {
        return '~' + path.slice(this.fs.home.length);
      }
      return path;
    }

    _cmdLs(args, io) {
      let opts = { all: false, showAll: false, long: false, recursive: false, dir: false };
      const files = [];
      for (const a of args) {
        if (a.startsWith('-') && a !== '-' && !/^\d/.test(a)) {
          for (const c of a.slice(1)) {
            if (c === 'a') opts.all = true;
            else if (c === 'A') opts.showAll = true;
            else if (c === 'l') opts.long = true;
            else if (c === 'R') opts.recursive = true;
            else if (c === 'd') opts.dir = true;
            else if (c === 'p') opts.markDir = true;
            else if (c === 'h') opts.human = true;
          }
        } else {
          files.push(a);
        }
      }
      const targets = files.length === 0 ? ['.'] : this._expandArgs(files);
      let exitCode = 0;
      for (const t of targets) {
        const node = this.fs.getNode(t);
        if (!node) {
          io.stderr.writeln('ls: cannot access \'' + t + '\': ' + I18N.t('no_such_file'));
          exitCode = 1;
          continue;
        }
        if (node.isFile() && !opts.long) {
          io.stdout.writeln(node.name);
          continue;
        }
        if (node.isDir()) {
          if (!node.ownerR()) {
            io.stderr.writeln('ls: cannot open directory \'' + t + '\': ' + I18N.t('permission_denied'));
            exitCode = 1;
            continue;
          }
          if (opts.long && files.length > 1) {
            io.stdout.writeln(t + ':');
          }
          this._lsDir(node, t, opts, io, 0);
        } else {
          // single file with -l
          if (opts.long) {
            io.stdout.writeln(this._lsLongLine(node));
          } else {
            io.stdout.writeln(node.name);
          }
        }
      }
      return exitCode;
    }

    _lsDir(node, path, opts, io, depth) {
      let names = Object.keys(node.children);
      if (!opts.all && !opts.showAll) names = names.filter(n => !n.startsWith('.'));
      names.sort();
      if (opts.long) {
        let total = 0;
        for (const n of names) total += 4;
        io.stdout.writeln(I18N.t('ls_total', { n: total }));
        for (const n of names) {
          const child = node.children[n];
          let line = this._lsLongLine(child);
          if (opts.markDir && child.isDir()) line = line.replace(/([^ ])$/, '$1/');
          io.stdout.writeln(line);
        }
      } else {
        // column format
        if (names.length === 0) return;
        const display = names.map(n => {
          let d = n;
          if (opts.markDir && node.children[n].isDir()) d += '/';
          return d;
        });
        // simple column layout
        const maxLen = Math.max(...display.map(d => d.length));
        const cols = Math.max(1, Math.floor(80 / (maxLen + 2)));
        let line = '';
        let count = 0;
        for (const d of display) {
          line += d.padEnd(maxLen + 2);
          count++;
          if (count >= cols) {
            io.stdout.writeln(line.trimEnd());
            line = '';
            count = 0;
          }
        }
        if (line) io.stdout.writeln(line.trimEnd());
      }
      if (opts.recursive) {
        for (const n of names) {
          const child = node.children[n];
          if (child.isDir() && child.ownerX()) {
            io.stdout.writeln(n + ':');
            this._lsDir(child, path + '/' + n, opts, io, depth + 1);
          }
        }
      }
    }

    _lsLongLine(node) {
      const typeChar = node.isDir() ? 'd' : '-';
      const size = node.isFile() ? node.content.length : 4096;
      const date = this._formatDate(node.mtime);
      const owner = 'player';
      const group = 'player';
      // format: perms owner group size date name
      let line = typeChar + node.perms + ' 1 ' + owner.padEnd(8) + group.padEnd(8) + ' ' + String(size).padStart(6) + ' ' + date + ' ' + node.name;
      return line;
    }

    _formatDate(ms) {
      const d = new Date(ms);
      const now = new Date();
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mon = months[d.getMonth()];
      const day = String(d.getDate()).padStart(2, ' ');
      let time;
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      } else {
        time = String(d.getFullYear());
      }
      return mon + ' ' + day + ' ' + time;
    }

    _cmdMkdir(args, io) {
      let p = false;
      const dirs = [];
      for (const a of args) {
        if (a === '-p') p = true;
        else if (a.startsWith('-')) { /* ignore */ }
        else dirs.push(a);
      }
      if (dirs.length === 0) { io.stderr.writeln(I18N.t('mkdir_usage')); return 1; }
      let code = 0;
      for (const d of dirs) {
        try {
          if (p) this.fs._mkdirPath(d, { silent: false });
          else this.fs.mkdir(d);
        } catch (e) {
          if (e instanceof FSError && !(p && e.code === 'file_exists')) {
            io.stderr.writeln('mkdir: cannot create directory \'' + d + '\': ' + (I18N.t(e.code) || e.code));
            code = 1;
          }
        }
      }
      return code;
    }

    _cmdRm(args, io) {
      let r = false, f = false;
      const files = [];
      for (const a of args) {
        if (a === '-r' || a === '-R') r = true;
        else if (a === '-f') f = true;
        else if (a.startsWith('-')) {
          for (const c of a.slice(1)) { if (c === 'r' || c === 'R') r = true; if (c === 'f') f = true; }
        }
        else files.push(a);
      }
      if (files.length === 0) { io.stderr.writeln(I18N.t('rm_usage')); return 1; }
      const expanded = this._expandArgs(files);
      let code = 0;
      for (const fpath of expanded) {
        try {
          this.fs.rm(fpath, { r, f });
        } catch (e) {
          if (e instanceof FSError && !f) {
            io.stderr.writeln('rm: cannot remove \'' + fpath + '\': ' + (I18N.t(e.code) || e.code));
            code = 1;
          }
        }
      }
      return code;
    }

    _cmdMv(args, io) {
      let f = false;
      const items = [];
      for (const a of args) {
        if (a === '-f') f = true;
        else if (a.startsWith('-')) { /* ignore */ }
        else items.push(a);
      }
      if (items.length < 2) { io.stderr.writeln(I18N.t('mv_usage')); return 1; }
      const expanded = this._expandArgs(items);
      const dst = expanded[expanded.length - 1];
      const srcs = expanded.slice(0, -1);
      let code = 0;
      for (const s of srcs) {
        try {
          this.fs.mv(s, dst);
        } catch (e) {
          if (e instanceof FSError && !f) {
            io.stderr.writeln('mv: cannot move \'' + s + '\' to \'' + dst + '\': ' + (I18N.t(e.code) || e.code));
            code = 1;
          }
        }
      }
      return code;
    }

    _cmdCp(args, io) {
      let r = false, f = false;
      const items = [];
      for (const a of args) {
        if (a === '-r' || a === '-R') r = true;
        else if (a === '-f') f = true;
        else if (a.startsWith('-')) {
          for (const c of a.slice(1)) { if (c === 'r' || c === 'R') r = true; if (c === 'f') f = true; }
        }
        else items.push(a);
      }
      if (items.length < 2) { io.stderr.writeln(I18N.t('cp_usage')); return 1; }
      const expanded = this._expandArgs(items);
      const dst = expanded[expanded.length - 1];
      const srcs = expanded.slice(0, -1);
      let code = 0;
      for (const s of srcs) {
        try {
          this.fs.cp(s, dst, { r, f });
        } catch (e) {
          if (e instanceof FSError && !f) {
            io.stderr.writeln('cp: cannot copy \'' + s + '\' to \'' + dst + '\': ' + (I18N.t(e.code) || e.code));
            code = 1;
          }
        }
      }
      return code;
    }

    _cmdCat(args, io) {
      if (args.length === 0) {
        // read from stdin
        io.stdout.write(io.stdin);
        if (io.stdin && !io.stdin.endsWith('\n')) io.stdout.write('\n');
        return 0;
      }
      const expanded = this._expandArgs(args);
      let code = 0;
      for (const f of expanded) {
        const node = this.fs.getNode(f);
        if (!node || !node.isFile()) {
          io.stderr.writeln('cat: ' + f + ': ' + I18N.t('no_such_file'));
          code = 1;
          continue;
        }
        if (!node.ownerR()) {
          io.stderr.writeln('cat: ' + f + ': ' + I18N.t('permission_denied'));
          code = 1;
          continue;
        }
        io.stdout.write(node.content);
        if (node.content && !node.content.endsWith('\n')) io.stdout.write('\n');
      }
      return code;
    }

    _cmdHead(args, io) {
      let n = 10;
      const files = [];
      let i = 0;
      while (i < args.length) {
        if (args[i] === '-n') {
          n = parseInt(args[i + 1], 10) || 10;
          i += 2;
        } else if (args[i].startsWith('-n')) {
          n = parseInt(args[i].slice(2), 10) || 10;
          i++;
        } else if (args[i].startsWith('-') && /^\-\d+$/.test(args[i])) {
          n = parseInt(args[i].slice(1), 10) || 10;
          i++;
        } else {
          files.push(args[i]);
          i++;
        }
      }
      let content;
      if (files.length === 0) {
        content = io.stdin;
      } else {
        content = '';
        let code = 0;
        const expanded = this._expandArgs(files);
        for (const f of expanded) {
          const node = this.fs.getNode(f);
          if (!node || !node.isFile()) { io.stderr.writeln('head: cannot open \'' + f + '\' for reading: ' + I18N.t('no_such_file')); code = 1; continue; }
          if (!node.ownerR()) { io.stderr.writeln('head: cannot open \'' + f + '\': ' + I18N.t('permission_denied')); code = 1; continue; }
          content += node.content;
        }
        if (code) return code;
      }
      const lines = content.split('\n');
      // if content ends with \n, the last element is empty
      const out = lines.slice(0, n).join('\n');
      io.stdout.write(out);
      if (out && !out.endsWith('\n')) io.stdout.write('\n');
      return 0;
    }

    _cmdTail(args, io) {
      let n = 10;
      const files = [];
      let i = 0;
      while (i < args.length) {
        if (args[i] === '-n') {
          n = parseInt(args[i + 1], 10) || 10;
          i += 2;
        } else if (args[i].startsWith('-n')) {
          n = parseInt(args[i].slice(2), 10) || 10;
          i++;
        } else if (args[i].startsWith('-') && /^\-\d+$/.test(args[i])) {
          n = parseInt(args[i].slice(1), 10) || 10;
          i++;
        } else {
          files.push(args[i]);
          i++;
        }
      }
      let content;
      if (files.length === 0) {
        content = io.stdin;
      } else {
        content = '';
        let code = 0;
        const expanded = this._expandArgs(files);
        for (const f of expanded) {
          const node = this.fs.getNode(f);
          if (!node || !node.isFile()) { io.stderr.writeln('tail: cannot open \'' + f + '\': ' + I18N.t('no_such_file')); code = 1; continue; }
          if (!node.ownerR()) { io.stderr.writeln('tail: cannot open \'' + f + '\': ' + I18N.t('permission_denied')); code = 1; continue; }
          content += node.content;
        }
        if (code) return code;
      }
      const lines = content.split('\n');
      // remove trailing empty line if content ends with \n
      if (lines[lines.length - 1] === '') lines.pop();
      const out = lines.slice(-n).join('\n');
      io.stdout.write(out);
      if (out && !out.endsWith('\n')) io.stdout.write('\n');
      return 0;
    }

    _cmdEcho(args, io) {
      let e = false, n = false;
      const parts = [];
      for (const a of args) {
        if (a === '-e') e = true;
        else if (a === '-n') n = true;
        else if (a === '-ne' || a === '-en') { e = true; n = true; }
        else if (a.startsWith('-') && a !== '-') {
          for (const c of a.slice(1)) { if (c === 'e') e = true; if (c === 'n') n = true; }
        } else {
          parts.push(a);
        }
      }
      let s = parts.join(' ');
      if (e) {
        s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\c/g, '').replace(/\\\\/g, '\\');
      }
      io.stdout.write(s);
      if (!n) io.stdout.write('\n');
      return 0;
    }

    _cmdFind(args, io) {
      // parse: find [path] [expression]
      // supported: -name, -iname, -type, -maxdepth, -print (default)
      let path = '.';
      const expr = { name: null, iname: null, type: null, maxdepth: null };
      let i = 0;
      // first non-option arg is path
      if (i < args.length && !args[i].startsWith('-')) {
        path = args[i];
        i++;
      }
      while (i < args.length) {
        const a = args[i];
        if (a === '-name') { expr.name = args[i + 1]; i += 2; }
        else if (a === '-iname') { expr.iname = args[i + 1]; i += 2; }
        else if (a === '-type') { expr.type = args[i + 1]; i += 2; }
        else if (a === '-maxdepth') { expr.maxdepth = parseInt(args[i + 1], 10); i += 2; }
        else if (a === '-print' || a === '-print0') { i++; }
        else if (a === '-not' || a === '!' ) { i++; } // ignore
        else if (a === '-a' || a === '-o') { i++; } // ignore
        else { i++; }
      }
      const results = this.fs.find(path, expr);
      for (const r of results) io.stdout.writeln(r);
      return 0;
    }

    _cmdTree(args, io) {
      let path = '.';
      const opts = {};
      for (const a of args) {
        if (a.startsWith('-')) {
          for (const c of a.slice(1)) {
            if (c === 'a') opts.all = true;
            else if (c === 'd') opts.dirs = true;
            else if (c === 'L') opts.maxdepth = parseInt(args[args.indexOf(a) + 1], 10);
          }
        } else {
          path = a;
        }
      }
      const node = this.fs.getNode(path);
      if (!node) { io.stderr.writeln('tree: ' + path + ': ' + I18N.t('no_such_file')); return 1; }
      io.stdout.writeln(path === '.' ? this._displayPath(this.fs.cwd) : path);
      let fileCount = 0, dirCount = 0;
      const _walk = (n, prefix, depth) => {
        if (opts.maxdepth !== undefined && depth > opts.maxdepth) return;
        let names = Object.keys(n.children);
        if (!opts.all) names = names.filter(x => !x.startsWith('.'));
        names.sort();
        for (let i = 0; i < names.length; i++) {
          const last = i === names.length - 1;
          const child = n.children[names[i]];
          io.stdout.writeln(prefix + (last ? '└── ' : '├── ') + names[i]);
          if (child.isDir()) {
            dirCount++;
            _walk(child, prefix + (last ? '    ' : '│   '), depth + 1);
          } else {
            fileCount++;
          }
        }
      };
      if (node.isDir()) _walk(node, '', 0);
      io.stdout.writeln('\n' + dirCount + ' directories, ' + fileCount + ' files');
      return 0;
    }

    _cmdMan(args, io) {
      if (args.length === 0) { io.stderr.writeln(I18N.t('man_usage')); return 1; }
      const cmd = args[0];
      const page = this._manPages[cmd];
      if (!page) {
        io.stderr.writeln(I18N.t('man_not_found', { cmd }));
        return 1;
      }
      const title = I18N.t('man_title', { cmd });
      if (window.Game && window.Game.showPager) {
        window.Game.showPager(title, page, () => {});
      } else {
        io.stdout.write(page + '\n');
      }
      return 0;
    }

    _cmdLess(args, io) {
      if (args.length === 0) { io.stderr.writeln(I18N.t('less_usage')); return 1; }
      const expanded = this._expandArgs(args);
      let content = '';
      for (const f of expanded) {
        const node = this.fs.getNode(f);
        if (!node || !node.isFile()) { io.stderr.writeln('less: ' + f + ': ' + I18N.t('no_such_file')); return 1; }
        if (!node.ownerR()) { io.stderr.writeln('less: ' + f + ': ' + I18N.t('permission_denied')); return 1; }
        content += node.content;
      }
      if (window.Game && window.Game.showPager) {
        window.Game.showPager(expanded[0], content, () => {});
      } else {
        io.stdout.write(content + '\n');
      }
      return 0;
    }

    _cmdSort(args, io) {
      let content;
      const files = args.filter(a => !a.startsWith('-'));
      if (files.length === 0) {
        content = io.stdin;
      } else {
        content = '';
        const expanded = this._expandArgs(files);
        for (const f of expanded) {
          const node = this.fs.getNode(f);
          if (node && node.isFile()) content += node.content;
        }
      }
      const lines = content.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      lines.sort();
      io.stdout.write(lines.join('\n') + (lines.length ? '\n' : ''));
      return 0;
    }

    _cmdWc(args, io) {
      let content;
      const files = args.filter(a => !a.startsWith('-'));
      if (files.length === 0) {
        content = io.stdin;
      } else {
        content = '';
        const expanded = this._expandArgs(files);
        for (const f of expanded) {
          const node = this.fs.getNode(f);
          if (node && node.isFile()) content += node.content;
        }
      }
      const lines = content.split('\n');
      if (content.endsWith('\n') && lines.length > 1) lines.pop();
      const nbLines = content === '' ? 0 : lines.length;
      const words = content.split(/\s+/).filter(w => w !== '').length;
      const chars = content.length;
      io.stdout.writeln(String(nbLines).padStart(7) + ' ' + String(words).padStart(7) + ' ' + String(chars).padStart(7) + (files.length ? ' ' + files[0] : ''));
      return 0;
    }

    _cmdGrep(args, io) {
      const opts2 = { l: false, i: false, v: false };
      const args2 = [];
      for (const a of args) {
        if (a === '--') continue;
        if (a.startsWith('-') && a !== '-') {
          for (const c of a.slice(1)) {
            if (c === 'l') opts2.l = true;
            else if (c === 'i') opts2.i = true;
            else if (c === 'v') opts2.v = true;
            else if (c === 'n') {}
          }
        } else {
          args2.push(a);
        }
      }
      if (args2.length === 0) { io.stderr.writeln(I18N.t('grep_usage')); return 2; }
      const pattern = args2[0];
      const files = args2.slice(1);
      let regex;
      try {
        regex = new RegExp(pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&'), opts2.i ? 'i' : '');
      } catch (e) {
        io.stderr.writeln('grep: invalid pattern');
        return 2;
      }

      const processStream = (content, label, multi) => {
        const lines = content.split('\n');
        let fileMatched = false;
        for (const line of lines) {
          const match = regex.test(line);
          if (opts2.v ? !match : match) {
            if (line === '' && content === '') continue;
            if (opts2.l) {
              if (!fileMatched) {
                io.stdout.writeln(label);
                fileMatched = true;
              }
            } else {
              if (multi && label) io.stdout.writeln(label + ':');
              io.stdout.writeln(line);
            }
          }
        }
        return fileMatched;
      };

      let found = false;
      if (files.length === 0) {
        found = processStream(io.stdin, '', false);
      } else {
        const expanded = this._expandArgs(files);
        const multi = expanded.length > 1;
        let errCode = 0;
        for (const f of expanded) {
          const node = this.fs.getNode(f);
          if (!node || !node.isFile()) {
            io.stderr.writeln('grep: ' + f + ': ' + I18N.t('no_such_file'));
            errCode = 2;
            continue;
          }
          if (!node.ownerR()) {
            io.stderr.writeln('grep: ' + f + ': ' + I18N.t('permission_denied'));
            errCode = 2;
            continue;
          }
          const m = processStream(node.content, f, multi);
          if (m) found = true;
        }
        if (errCode === 2 && !found) return 2;
      }
      return found ? 0 : 1;
    }

    _cmdXargs(args, io) {
      if (args.length === 0) { io.stderr.writeln(I18N.t('xargs_usage')); return 1; }
      const cmdName = args[0];
      const baseArgs = args.slice(1);
      const inputLines = io.stdin.split('\n').map(l => l.trim()).filter(l => l !== '');
      if (inputLines.length === 0) return 0;
      let code = 0;
      // run command with all lines as args
      const allArgs = baseArgs.concat(inputLines);
      try {
        code = this._execCommand(cmdName, allArgs, { stdin: '', stdout: io.stdout, stderr: io.stderr, sink: io.sink });
      } catch (e) {
        io.stderr.writeln(this._fmtError(e, cmdName));
        code = 1;
      }
      return code;
    }

    _cmdTr(args, io) {
      // tr SET1 SET2  (supports a-z ranges and complements)
      if (args.length < 1) { io.stderr.writeln(I18N.t('tr_usage')); return 1; }
      let set1 = args[0];
      let set2 = (args.length >= 2) ? args[1] : '';
      // expand ranges like a-z
      const expandSet = (s) => {
        let out = '';
        let comp = false;
        if (s.startsWith('^')) { comp = true; s = s.slice(1); }
        for (let i = 0; i < s.length; i++) {
          if (i + 2 < s.length && s[i + 1] === '-') {
            const a = s.charCodeAt(i);
            const b = s.charCodeAt(i + 2);
            for (let c = a; c <= b; c++) out += String.fromCharCode(c);
            i += 2;
          } else {
            out += s[i];
          }
        }
        if (comp) {
          // complement: all printable ASCII not in out
          let all = '';
          for (let c = 32; c < 127; c++) all += String.fromCharCode(c);
          out = all.split('').filter(ch => !out.includes(ch)).join('');
        }
        return out;
      };
      set1 = expandSet(set1);
      set2 = expandSet(set2);
      const map = {};
      for (let i = 0; i < set1.length; i++) {
        map[set1[i]] = (i < set2.length) ? set2[i] : '';
      }
      let content = io.stdin;
      if (content === '' && args.length >= 3) {
        // maybe reading from a file arg? not standard; ignore
      }
      let result = '';
      for (const ch of content) {
        result += (map[ch] !== undefined) ? map[ch] : ch;
      }
      io.stdout.write(result);
      if (result && !result.endsWith('\n')) io.stdout.write('\n');
      return 0;
    }

    _cmdCal(args, io) {
      // cal [MONTH [YEAR]]
      const now = new Date();
      let month, year;
      if (args.length === 0) {
        month = now.getMonth() + 1;
        year = now.getFullYear();
      } else if (args.length === 1) {
        year = parseInt(args[0], 10);
        month = now.getMonth() + 1;
      } else {
        month = parseInt(args[0], 10);
        year = parseInt(args[1], 10);
      }
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        io.stderr.writeln(I18N.t('cal_usage'));
        return 1;
      }
      const monthsEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const monthsFr = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
      const lang = I18N.getLang();
      const monthName = (lang === 'fr' ? monthsFr : monthsEn)[month - 1];
      const daysInMonth = new Date(year, month, 0).getDate();
      // day of week for the 1st (0=Sunday)
      const firstDow = new Date(year, month - 1, 1).getDay();
      const daysEn = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      const daysFr = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
      const dayNames = (lang === 'fr' ? daysFr : daysEn);

      let out = '';
      out += monthName.padStart(20) + ' ' + year + '\n';
      out += dayNames.join('  ') + '\n';
      let line = '';
      for (let d = 0; d < firstDow; d++) line += '   ';
      for (let d = 1; d <= daysInMonth; d++) {
        line += String(d).padStart(3);
        const dow = (firstDow + d - 1) % 7;
        if (dow === 6) {
          out += line + '\n';
          line = '';
        }
      }
      if (line) out += line + '\n';
      io.stdout.write(out);
      return 0;
    }

    _cmdNano(args, io) {
      if (args.length === 0) { io.stderr.writeln(I18N.t('nano_usage')); return 1; }
      const file = args[0];
      const node = this.fs.getNode(file);
      const existing = (node && node.isFile()) ? node.content : '';
      if (window.Game && window.Game.showNano) {
        window.Game.showNano(file, existing, (savedContent, saved) => {
          if (saved) {
            try {
              this.fs.write(file, savedContent);
              io.sink.writeln(I18N.t('nano_wrote', { n: savedContent.length }));
            } catch (e) {
              io.sink.writeln('nano: ' + this._fmtError(e, file));
            }
          }
        });
      } else {
        io.stderr.writeln('nano: interactive editor not available');
        return 1;
      }
      return 0;
    }

    _cmdAlias(args, io) {
      if (args.length === 0) {
        for (const k in this.aliases) {
          io.stdout.writeln('alias ' + k + "='" + this.aliases[k] + "'");
        }
        return 0;
      }
      for (const a of args) {
        const m = a.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m) {
          let val = m[2];
          // strip surrounding quotes
          if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
            val = val.slice(1, -1);
          }
          this.aliases[m[1]] = val;
        } else {
          // show a single alias
          if (this.aliases[a] !== undefined) {
            io.stdout.writeln('alias ' + a + "='" + this.aliases[a] + "'");
          } else {
            io.stderr.writeln('alias: ' + a + ': not found');
            return 1;
          }
        }
      }
      return 0;
    }

    _cmdUnalias(args, io) {
      for (const a of args) {
        delete this.aliases[a];
      }
      return 0;
    }

    _cmdChmod(args, io) {
      let recursive = false;
      const rest = [];
      for (const a of args) {
        if (a === '-R') recursive = true;
        else if (a.startsWith('-')) {
          for (const c of a.slice(1)) if (c === 'R') recursive = true;
        } else rest.push(a);
      }
      if (rest.length < 2) { io.stderr.writeln(I18N.t('chmod_usage')); return 1; }
      const mode = rest[0];
      const files = rest.slice(1);
      let code = 0;
      const expanded = this._expandArgs(files);
      for (const f of expanded) {
        try {
          if (recursive) {
            const node = this.fs.getNode(f);
            if (node && node.isDir()) {
              const _rec = (n) => {
                this.fs.chmod(this._nodePath(n), mode);
                for (const k in n.children) _rec(n.children[k]);
              };
              _rec(node);
            } else {
              this.fs.chmod(f, mode);
            }
          } else {
            this.fs.chmod(f, mode);
          }
        } catch (e) {
          io.stderr.writeln('chmod: cannot access \'' + f + '\': ' + (I18N.t(e.code) || e.code));
          code = 1;
        }
      }
      return code;
    }

    _nodePath(node) {
      // reconstruct path - not fully robust; used only for recursive chmod
      return node.name;
    }

    _cmdPs(args, io) {
      // ps: list processes
      const procs = this.processes.filter(p => p.status !== 'done');
      // include the shell itself
      const all = [{ pid: this._shellPid(), name: 'shell', status: 'running' }].concat(procs);
      io.stdout.writeln(I18N.t('ps_header'));
      for (const p of all) {
        io.stdout.writeln(String(p.pid).padStart(6) + ' pts/0    00:00:00 ' + p.name);
      }
      return 0;
    }

    _cmdKill(args, io) {
      if (args.length === 0) { io.stderr.writeln(I18N.t('kill_usage')); return 1; }
      let signal = 'TERM';
      const pids = [];
      let i = 0;
      while (i < args.length) {
        if (args[i] === '-s' && i + 2 < args.length) {
          signal = args[i + 1];
          i += 2;
        } else if (args[i].startsWith('-') && args[i] !== '-' && !/^\-\d+$/.test(args[i])) {
          // -SIGNAME
          signal = args[i].slice(1);
          i++;
        } else if (/^\-\d+$/.test(args[i])) {
          // -NUMBER
          signal = String(parseInt(args[i].slice(1), 10));
          i++;
        } else if (args[i] === '-l') {
          io.stdout.writeln('HUP INT QABT ILL TRAP BUS FNT KILL USR1 SEGV USR2 PIPE ALRM TERM STKFLT CHLD CONT STOP TSTP TTIN TTOU URG XCPU XFSZ VTALRM PROF IO WINCH CUP');
          i++;
        } else {
          pids.push(args[i]);
          i++;
        }
      }
      // convert signal number to name
      const sigMap = { '9': 'KILL', '15': 'TERM', '2': 'INT', '1': 'HUP', '17': 'CHLD', '18': 'CONT', '19': 'STOP', '20': 'TSTP' };
      if (sigMap[signal]) signal = sigMap[signal];
      let code = 0;
      for (const pidStr of pids) {
        const pid = parseInt(pidStr, 10);
        if (isNaN(pid)) { io.stderr.writeln('kill: invalid pid: ' + pidStr); code = 1; continue; }
        const ok = this._killProc(pid, signal);
        if (!ok) {
          io.stderr.writeln('kill: (' + pid + ') ' + I18N.t('kill_no_proc'));
          code = 1;
        }
      }
      return code;
    }

    _cmdPstree(args, io) {
      let showPid = false;
      let rootPid = null;
      for (const a of args) {
        if (a === '-p') showPid = true;
        else if (/^\d+$/.test(a)) rootPid = parseInt(a, 10);
        else if (a === '$$') rootPid = this._shellPid();
      }
      // build tree from the shell
      const shellPid = this._shellPid();
      const _print = (pid, prefix, isLast) => {
        const proc = this._findProc(pid);
        if (!proc) return;
        const label = proc.name + (showPid ? '(' + proc.pid + ')' : '');
        io.stdout.writeln(prefix + (isLast ? '└── ' : '├── ') + label);
        const kids = proc.children;
        for (let i = 0; i < kids.length; i++) {
          _print(kids[i], prefix + (isLast ? '    ' : '│   '), i === kids.length - 1);
        }
      };
      if (rootPid !== null) {
        const proc = this._findProc(rootPid);
        if (!proc) { io.stderr.writeln('pstree: ' + rootPid + ': ' + I18N.t('pstree_no_proc')); return 1; }
        io.stdout.writeln(proc.name + (showPid ? '(' + proc.pid + ')' : ''));
        const kids = proc.children;
        for (let i = 0; i < kids.length; i++) {
          _print(kids[i], '', i === kids.length - 1);
        }
      } else {
        io.stdout.writeln('shell' + (showPid ? '(' + shellPid + ')' : ''));
        const kids = this.processes.filter(p => p.parent === shellPid && p.status !== 'done');
        for (let i = 0; i < kids.length; i++) {
          _print(kids[i].pid, '', i === kids.length - 1);
        }
      }
      return 0;
    }

    _cmdClear(args, io) {
      if (window.Game && window.Game.clearScreen) {
        window.Game.clearScreen();
      }
      return 0;
    }

    _cmdHistory(args, io) {
      const n = args.length > 0 ? parseInt(args[0], 10) : this.history.length;
      const start = Math.max(0, this.history.length - n);
      for (let i = start; i < this.history.length; i++) {
        io.stdout.writeln(String(i + 1).padStart(4) + '  ' + this.history[i]);
      }
      return 0;
    }

    _cmdFc(args, io) {
      // fc -l: show history with line numbers
      for (let i = 0; i < this.history.length; i++) {
        io.stdout.writeln(String(i + 1) + '  ' + this.history[i]);
      }
      return 0;
    }

    _cmdJobs(args, io) {
      const procs = this.processes.filter(p => p.status !== 'done' && p.parent === this._shellPid());
      if (procs.length === 0) {
        // no output (like real jobs)
        return 0;
      }
      for (let i = 0; i < procs.length; i++) {
        const p = procs[i];
        const status = p.status === 'running' ? 'Running' : (p.status === 'stopped' ? 'Stopped' : 'Done');
        io.stdout.writeln('[' + (i + 1) + ']' + (p.status === 'stopped' ? '+' : ' ') + '  ' + status.padEnd(12) + ' ' + p.cmd);
      }
      return 0;
    }

    _cmdDate(args, io) {
      const now = new Date();
      io.stdout.writeln(now.toString());
      return 0;
    }

    _cmdTouch(args, io) {
      const expanded = this._expandArgs(args);
      let code = 0;
      for (const f of expanded) {
        try {
          this.fs.touch(f);
        } catch (e) {
          io.stderr.writeln('touch: cannot touch \'' + f + '\': ' + (I18N.t(e.code) || e.code));
          code = 1;
        }
      }
      return code;
    }

    _cmdGsh(args, io) {
      if (window.Game && window.Game.gshCommand) {
        return window.Game.gshCommand(args, io);
      }
      io.stderr.writeln(I18N.t('gsh_usage'));
      return 1;
    }

    _cmdExit(args, io) {
      if (window.Game && window.Game.exitGame) {
        window.Game.exitGame();
      }
      return 0;
    }

    _cmdFlarigo(args, io) {
      // a simple fireworks launcher (runs in foreground, prints then exits)
      io.stdout.writeln(I18N.t('flarigo_msg'));
      return 0;
    }

    _cmdCharmiglio(args, io) {
      // the incantation command for the control-C mission
      if (window.Game && window.Game.charmiglio) {
        return window.Game.charmiglio(args, io);
      }
      io.stdout.writeln(I18N.t('charmiglio_msg'));
      return 0;
    }

    _cmdXeyes(args, io) {
      io.stdout.writeln(I18N.t('xeyes_msg'));
      return 0;
    }

    _cmdSet(args, io) {
      for (const a of args) {
        if (a === '-o' && args[args.indexOf(a) + 1] === 'noglob') this.noglobal = true;
        if (a === '+o' && args[args.indexOf(a) + 1] === 'noglob') this.noglobal = false;
        if (a === '-noglob') this.noglobal = true;
        if (a === '+noglob') this.noglobal = false;
      }
      return 0;
    }

    _cmdMerlin(args, io) {
      // the merlin program: prints a message with the secret key interleaved
      // on stdout and stderr
      if (args.length > 0) {
        io.stderr.writeln(I18N.t('Error: %s takes no argument.', { 0: 'merlin' }));
        return 1;
      }
      const key = (window.Game && window.Game.getSecretKey) ? window.Game.getSecretKey() : '';
      const msg = I18N.getLang() === 'fr' ? 'LACLESECRETEESTSURSTDERR' : 'THESECRETKEYISONSTDERR';
      const I = msg.length;
      const J = key.length;
      const L = I + J;
      let i = 0, j = 0;
      while (i + j < L) {
        const r = Math.floor(Math.random() * (L - i - j));
        if (r < (I - i)) {
          i++;
          io.stdout.write(msg[i - 1]);
        } else {
          j++;
          io.stderr.write(key[j - 1]);
        }
      }
      io.stdout.write('\n');
      io.stderr.write('\n');
      return 0;
    }
  }

  // ------------------------------------------------------------------
  // man pages
  // ------------------------------------------------------------------
  Shell.prototype._manPages = {
    find: `FIND(1)                  User Commands                 FIND(1)

NAME
       find - search for files in a directory hierarchy

SYNOPSIS
       find [PATH...] [EXPRESSION]

DESCRIPTION
       find searches the directory tree rooted at each PATH, in order,
       applying the expression to each file in the tree.

USEFUL EXPRESSIONS
       -name pattern
             Base of file name matches shell pattern pattern.
       -iname pattern
             Like -name, but case insensitive.
       -type c
             File type is c (f for regular file, d for directory).
       -maxdepth levels
             Do not descend into directories more than levels levels
             below the command line arguments.
       -print
             Print the full file name to the standard output. This is
             the default if no expression is given.

EXAMPLES
       find . -name "*.txt"
       find . -iname "coin_*" -type f
       find . -type f -maxdepth 2`,
    grep: `GREP(1)                  User Commands                 GREP(1)

NAME
       grep - print lines matching a pattern

SYNOPSIS
       grep [OPTION...] PATTERN [FILE...]

DESCRIPTION
       grep searches for lines matching PATTERN in each FILE or on
       standard input.

OPTIONS
       -l    Print only the names of files that contain matches.
       -i    Ignore case distinctions.
       -v    Invert the sense of matching, select non-matching lines.
       -n    Prefix each line of output with the line number.

EXAMPLES
       grep "pattern" file.txt
       grep -l "gsh" *
       grep -iv "paid" ledger`,
    wc: `WC(1)                    User Commands                    WC(1)

NAME
       wc - print newline, word, and byte counts

SYNOPSIS
       wc [OPTION...] [FILE...]

DESCRIPTION
       Prints the newline, word, and byte counts for each FILE.
       If no FILE is specified, reads standard input.

EXAMPLES
       wc file.txt
       grep "x" file | wc -l`,
    sort: `SORT(1)                  User Commands                 SORT(1)

NAME
       sort - sort lines of text files

SYNOPSIS
       sort [OPTION...] [FILE...]

DESCRIPTION
       Writes the sorted concatenation of all FILE arguments to
       standard output.

EXAMPLES
       sort file.txt
       ls | sort`,
    head: `HEAD(1)                  User Commands                 HEAD(1)

NAME
       head - output the first part of files

SYNOPSIS
       head [OPTION...] [FILE...]

DESCRIPTION
       Prints the first 10 lines of each FILE to standard output.

OPTIONS
       -n K    Print the first K lines instead of the first 10.

EXAMPLES
       head file.txt
       head -n 5 file.txt`,
    tail: `TAIL(1)                  User Commands                 TAIL(1)

NAME
       tail - output the last part of files

SYNOPSIS
       tail [OPTION...] [FILE...]

DESCRIPTION
       Prints the last 10 lines of each FILE to standard output.

OPTIONS
       -n K    Print the last K lines instead of the last 10.

EXAMPLES
       tail file.txt
       tail -n 5 file.txt`,
    cat: `CAT(1)                   User Commands                   CAT(1)

NAME
       cat - concatenate files and print on the standard output

SYNOPSIS
       cat [FILE...]

DESCRIPTION
       Concatenate FILE(s) to standard output.

EXAMPLES
       cat file1.txt file2.txt`,
    tr: `TR(1)                   User Commands                   TR(1)

NAME
       tr - translate characters

SYNOPSIS
       tr SET1 [SET2]

DESCRIPTION
       Translate, squeeze, and/or delete characters, reading standard
       input, writing standard output.

EXAMPLES
       tr "a-z" "n-za-m"   (rot13)
       tr "A-Z" "a-z"      (uppercase to lowercase)`,
    cal: `CAL(1)                   User Commands                   CAL(1)

NAME
       cal - display a calendar

SYNOPSIS
       cal [MONTH [YEAR]]

DESCRIPTION
       Prints a simple calendar of the given month and year.
       If no arguments are given, prints the current month.

EXAMPLES
       cal
       cal 2024
       cal 6 2024`,
    chmod: `CHMOD(1)                 User Commands                 CHMOD(1)

NAME
       chmod - change file mode bits

SYNOPSIS
       chmod [OPTION] MODE FILE...

DESCRIPTION
       chmod changes the file mode bits of each given file.

MODE
       The mode can be given as an octal number (e.g. 755, 000) or
       as a symbolic expression.

SYMBOLIC MODE
       The beginning of a symbolic mode can be one of:
         u    the user (owner)
         g    the group
         o    others
         a    all (u+g+o)
       followed by + (add), - (remove), or = (set exactly), and one
       or more of:
         r    read
         w    write
         x    execute

EXAMPLES
       chmod +x script.sh
       chmod u+x directory
       chmod 000 file
       chmod 755 directory`,
    ps: `PS(1)                     User Commands                     PS(1)

NAME
       ps - report a snapshot of the current processes

SYNOPSIS
       ps [OPTION...]

DESCRIPTION
       ps displays information about active processes.

EXAMPLES
       ps
       ps -c`,
    kill: `KILL(1)                  User Commands                 KILL(1)

NAME
       kill - send a signal to a process

SYNOPSIS
       kill [OPTION] PID...

DESCRIPTION
       kill sends the specified signal to the specified processes.
       By default, it sends the TERM signal.

OPTIONS
       -s SIGNAL   Send the named signal.
       -NUMBER     Send the signal with the given number.
       -l          List the signals.

SIGNALS
       TERM (15)  Termination (can be caught/ignored).
       KILL (9)   Kill (cannot be caught or ignored).
       INT (2)    Interrupt.

EXAMPLES
       kill 1234
       kill -9 1234
       kill -s KILL 1234`,
    pstree: `PSTREE(1)                 User Commands                 PSTREE(1)

NAME
       pstree - display a tree of processes

SYNOPSIS
       pstree [OPTION...] [PID]

DESCRIPTION
       pstree displays the processes as a tree, with the given PID
       (or the shell) as the root.

OPTIONS
       -p    Show the PID of each process.

EXAMPLES
       pstree
       pstree -p
       pstree -p $$`,
    ls: `LS(1)                    User Commands                    LS(1)

NAME
       ls - list directory contents

SYNOPSIS
       ls [OPTION...] [FILE...]

OPTIONS
       -a    Do not ignore entries starting with .
       -A    Like -a, but do not list . and ..
       -l    Use a long listing format.
       -R    List subdirectories recursively.
       -p    Append / to directories.

EXAMPLES
       ls
       ls -l
       ls -A`,
    cd: `CD(1)                     Shell Builtin                   CD(1)

NAME
       cd - change the working directory

SYNOPSIS
       cd [DIRECTORY]

DESCRIPTION
       Change the current directory to DIRECTORY. If DIRECTORY is
       not specified, change to the home directory.

SPECIAL VALUES
       ~     The home directory.
       -     The previous directory.
       ..    The parent directory.

EXAMPLES
       cd /home
       cd ..
       cd ~`,
    mkdir: `MKDIR(1)                 User Commands                 MKDIR(1)

NAME
       mkdir - make directories

SYNOPSIS
       mkdir [OPTION] DIRECTORY...

OPTIONS
       -p    No error if existing, make parent directories as needed.

EXAMPLES
       mkdir Hut
       mkdir -p a/b/c`,
    rm: `RM(1)                    User Commands                    RM(1)

NAME
       rm - remove files or directories

SYNOPSIS
       rm [OPTION] FILE...

OPTIONS
       -r    Remove directories and their contents recursively.
       -f    Ignore non-existent files, never prompt.

EXAMPLES
       rm file.txt
       rm -r directory`,
    mv: `MV(1)                    User Commands                    MV(1)

NAME
       mv - move (rename) files

SYNOPSIS
       mv SOURCE... DESTINATION

DESCRIPTION
       Rename or move files. If DESTINATION is a directory, move the
       files into it.

EXAMPLES
       mv file.txt newname.txt
       mv file1 file2 directory/`,
    cp: `CP(1)                    User Commands                    CP(1)

NAME
       cp - copy files and directories

SYNOPSIS
       cp [OPTION] SOURCE... DESTINATION

OPTIONS
       -r    Copy directories recursively.
       -f    Force: remove existing destination files.

EXAMPLES
       cp file.txt backup.txt
       cp file1 file2 directory/`,
    nano: `NANO(1)                  User Commands                 NANO(1)

NAME
       nano - a small and friendly text editor

SYNOPSIS
       nano [FILE]

DESCRIPTION
       nano edits a text file. If FILE does not exist, it is created.

KEYS
       Ctrl-O   Write out (save) the file.
       Ctrl-X   Exit nano.
       Ctrl-W   Search for a string.
       Ctrl-K   Cut the current line.

NOTE
       Do not use Ctrl-S or Ctrl-Z!`,
    alias: `ALIAS(1)                 Shell Builtin                 ALIAS(1)

NAME
       alias - define or display aliases

SYNOPSIS
       alias [NAME[=VALUE]...]

DESCRIPTION
       alias defines an alias for NAME with VALUE. If no arguments
       are given, all aliases are displayed.

EXAMPLES
       alias la='ls -A'
       alias journal='nano ~/Foret/Hut/Coffre/journal.txt'`,
    xargs: `XARGS(1)                 User Commands                 XARGS(1)

NAME
       xargs - build and run command lines from standard input

SYNOPSIS
       xargs COMMAND [ARG...]

DESCRIPTION
       xargs reads lines from standard input and executes COMMAND
       with the read lines as arguments.

EXAMPLES
       find . -type f | xargs grep "pattern"
       ls | xargs rm`,
    man: `MAN(1)                    Section 1                    MAN(1)

NAME
       man - an interface to the system reference manuals

SYNOPSIS
       man COMMAND

DESCRIPTION
       man displays the manual page for COMMAND.

KEYS
       q        Quit.
       Space    Scroll down a page.
       /STRING  Search for a string.
       n        Next occurrence.`,
    less: `LESS(1)                  User Commands                 LESS(1)

NAME
       less - examine file contents

SYNOPSIS
       less FILE

DESCRIPTION
       less displays a file one page at a time.

KEYS
       q        Quit.
       Space    Scroll down a page.
       /STRING  Search for a string.
       n        Next occurrence.`,
    gsh: `GSH(1)                   GameShell                   GSH(1)

NAME
       gsh - the GameShell command

SYNOPSIS
       gsh COMMAND [ARG...]

COMMANDS
       gsh check      Check the current mission's goal.
       gsh goal [N]   Show the mission goal.
       gsh help       Short help.
       gsh reset      Reset the current mission.
       gsh skip       Skip the current mission.
       gsh goto [N]   Go to mission N.
       gsh index      Show the mission index.
       gsh stat       Show statistics.
       gsh version    Show the version.
       gsh welcome    Show the welcome message.
       gsh exit       Quit GameShell.
       gsh HELP       Full help.`,
  };

  window.Shell = Shell;
  window.StringSink = StringSink;
})();
