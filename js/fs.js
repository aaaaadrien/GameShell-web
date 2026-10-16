// Virtual filesystem for GameShell web edition.
// A tree of nodes. The player is always the "owner", so only the owner
// permission bits are enforced.

(function () {
  'use strict';

  let _idCounter = 1;

  class FSNode {
    constructor(name, type) {
      this.id = _idCounter++;
      this.name = name;
      this.type = type; // 'dir' | 'file'
      this.children = {}; // for dirs: name -> FSNode
      this.content = ''; // for files
      this.mtime = Date.now();
      // 9 chars: owner rwx, group rwx, other rwx
      this.perms = (type === 'dir') ? 'rwxr-xr-x' : 'rw-r--r--';
      this.sign = null; // {hash, rand} for signed files
      this.executable = false;
      this.proc = null; // for "process" files (ps)
      this.hidden = name.startsWith('.');
    }

    isDir() { return this.type === 'dir'; }
    isFile() { return this.type === 'file'; }

    ownerR() { return this.perms[0] === 'r'; }
    ownerW() { return this.perms[1] === 'w'; }
    ownerX() { return this.perms[2] === 'x'; }

    setOwnerPerm(perm, val) {
      const idx = perm === 'r' ? 0 : (perm === 'w' ? 1 : 2);
      const arr = this.perms.split('');
      arr[idx] = val ? perm : '-';
      this.perms = arr.join('');
    }

    // serialize to a plain object
    toJSON() {
      const o = {
        n: this.name,
        t: this.type,
        p: this.perms,
        m: this.mtime,
      };
      if (this.type === 'file') {
        o.c = this.content;
        if (this.sign) o.s = this.sign;
        if (this.executable) o.x = 1;
      } else {
        const ch = {};
        for (const k in this.children) ch[k] = this.children[k].toJSON();
        o.ch = ch;
      }
      return o;
    }

    static fromJSON(o) {
      const node = new FSNode(o.n, o.t);
      node.perms = o.p || node.perms;
      node.mtime = o.m || Date.now();
      if (o.t === 'file') {
        node.content = o.c || '';
        if (o.s) node.sign = o.s;
        if (o.x) node.executable = true;
      } else if (o.ch) {
        for (const k in o.ch) {
          node.children[k] = FSNode.fromJSON(o.ch[k]);
        }
      }
      return node;
    }
  }

  class FS {
    constructor() {
      this.root = new FSNode('/', 'dir');
      this.root.name = '/';
      this.home = '/home';
      this.cwd = '/home';
      this.prevCwd = '/home';
      // ensure home exists
      this._mkdirPath(this.home, { silent: true });
    }

    // ---------- path handling ----------

    // expand ~ and resolve a (possibly relative) path to an absolute path.
    // Does NOT verify existence.
    resolve(path) {
      if (path === undefined || path === null || path === '') {
        path = this.cwd;
      }
      // tilde expansion
      if (path === '~') {
        path = this.home;
      } else if (path.startsWith('~/')) {
        path = this.home + path.slice(1);
      }
      // if not absolute, make relative to cwd
      if (!path.startsWith('/')) {
        path = this.cwd + '/' + path;
      }
      // normalize: split, handle . and ..
      const parts = path.split('/');
      const out = [];
      for (const p of parts) {
        if (p === '' || p === '.') continue;
        if (p === '..') {
          if (out.length > 0) out.pop();
          // else: stay at root
        } else {
          out.push(p);
        }
      }
      return '/' + out.join('/');
    }

    // get the node at an absolute (or resolvable) path. Returns null if not found.
    getNode(path) {
      const abs = this.resolve(path);
      if (abs === '/') return this.root;
      const parts = abs.split('/').filter(p => p !== '');
      let node = this.root;
      for (const p of parts) {
        if (!node.isDir()) return null;
        node = node.children[p];
        if (!node) return null;
      }
      return node;
    }

    // get the parent node and the base name for a path
    _parentAndBase(path) {
      const abs = this.resolve(path);
      if (abs === '/') return null;
      const idx = abs.lastIndexOf('/');
      const parentPath = idx <= 0 ? '/' : abs.slice(0, idx);
      const base = abs.slice(idx + 1);
      const parent = this.getNode(parentPath);
      return { parent, base, abs };
    }

    // ---------- creation / deletion ----------

    _mkdirPath(path, opts) {
      opts = opts || {};
      const abs = this.resolve(path);
      if (abs === '/') return this.root;
      const parts = abs.split('/').filter(p => p !== '');
      let node = this.root;
      for (const p of parts) {
        if (!node.children[p]) {
          node.children[p] = new FSNode(p, 'dir');
        }
        node = node.children[p];
        if (!node.isDir()) {
          if (!opts.silent) throw new FSError('not_a_directory', p);
          return null;
        }
      }
      return node;
    }

    mkdir(path, opts) {
      opts = opts || {};
      const pb = this._parentAndBase(path);
      if (!pb) throw new FSError('no_such_file', path);
      if (!pb.parent) throw new FSError('no_such_file', path);
      if (!pb.parent.ownerW() || !pb.parent.ownerX()) {
        throw new FSError('permission_denied', path);
      }
      if (pb.parent.children[pb.base]) {
        if (opts.p) return pb.parent.children[pb.base];
        throw new FSError('file_exists', path);
      }
      const node = new FSNode(pb.base, 'dir');
      pb.parent.children[pb.base] = node;
      return node;
    }

    // create a file (empty) or return existing
    touch(path) {
      const node = this.getNode(path);
      if (node) {
        if (node.isDir()) throw new FSError('is_a_directory', path);
        node.mtime = Date.now();
        return node;
      }
      const pb = this._parentAndBase(path);
      if (!pb || !pb.parent) throw new FSError('no_such_file', path);
      if (!pb.parent.ownerW() || !pb.parent.ownerX()) {
        throw new FSError('permission_denied', path);
      }
      const newNode = new FSNode(pb.base, 'file');
      pb.parent.children[pb.base] = newNode;
      return newNode;
    }

    // write content to a file (create or overwrite). append if opts.append.
    write(path, content, opts) {
      opts = opts || {};
      const pb = this._parentAndBase(path);
      if (!pb || !pb.parent) throw new FSError('no_such_file', path);
      if (!pb.parent.ownerW() || !pb.parent.ownerX()) {
        throw new FSError('permission_denied', path);
      }
      let node = pb.parent.children[pb.base];
      if (node) {
        if (node.isDir()) throw new FSError('is_a_directory', path);
        if (!node.ownerW()) throw new FSError('permission_denied', path);
        node.content = opts.append ? node.content + content : content;
        node.mtime = Date.now();
      } else {
        node = new FSNode(pb.base, 'file');
        node.content = content;
        node.mtime = Date.now();
        pb.parent.children[pb.base] = node;
      }
      return node;
    }

    rm(path, opts) {
      opts = opts || {};
      const node = this.getNode(path);
      if (!node) {
        if (opts.f) return true;
        throw new FSError('no_such_file', path);
      }
      if (path === this.home || this.resolve(path) === '/') {
        throw new FSError('permission_denied', path);
      }
      const pb = this._parentAndBase(path);
      if (pb && pb.parent) {
        if (!pb.parent.ownerW() || !pb.parent.ownerX()) {
          if (opts.f) return true;
          throw new FSError('permission_denied', path);
        }
      }
      if (node.isDir()) {
        if (!opts.r) {
          if (opts.f) return true;
          throw new FSError('is_a_directory', path);
        }
      }
      if (pb && pb.parent) {
        delete pb.parent.children[pb.base];
      }
      return true;
    }

    mv(src, dst) {
      const srcNode = this.getNode(src);
      if (!srcNode) throw new FSError('no_such_file', src);
      // if dst is an existing directory, move into it
      let dstNode = this.getNode(dst);
      let targetBase = srcNode.name;
      let targetParent;
      if (dstNode && dstNode.isDir()) {
        targetParent = dstNode;
        targetBase = srcNode.name;
      } else {
        const pb = this._parentAndBase(dst);
        if (!pb || !pb.parent) throw new FSError('no_such_file', dst);
        targetParent = pb.parent;
        targetBase = pb.base;
      }
      if (!targetParent.ownerW() || !targetParent.ownerX()) {
        throw new FSError('permission_denied', dst);
      }
      // remove from old location
      const spb = this._parentAndBase(src);
      if (spb && spb.parent) delete spb.parent.children[spb.base];
      // if target exists, overwrite (file) or error (dir)
      if (targetParent.children[targetBase]) {
        if (targetParent.children[targetBase].isDir() && srcNode.isDir()) {
          // merge not supported; just replace if empty
          if (Object.keys(targetParent.children[targetBase].children).length > 0) {
            throw new FSError('file_exists', dst);
          }
        }
      }
      targetParent.children[targetBase] = srcNode;
      srcNode.name = targetBase;
      srcNode.hidden = targetBase.startsWith('.');
      return srcNode;
    }

    cp(src, dst, opts) {
      opts = opts || {};
      const srcNode = this.getNode(src);
      if (!srcNode) throw new FSError('no_such_file', src);
      if (!srcNode.ownerR()) throw new FSError('permission_denied', src);
      let dstNode = this.getNode(dst);
      let targetBase = srcNode.name;
      let targetParent;
      if (dstNode && dstNode.isDir()) {
        targetParent = dstNode;
        targetBase = srcNode.name;
      } else {
        const pb = this._parentAndBase(dst);
        if (!pb || !pb.parent) throw new FSError('no_such_file', dst);
        targetParent = pb.parent;
        targetBase = pb.base;
      }
      if (!targetParent.ownerW() || !targetParent.ownerX()) {
        throw new FSError('permission_denied', dst);
      }
      const copy = this._cloneNode(srcNode, targetBase);
      targetParent.children[targetBase] = copy;
      return copy;
    }

    _cloneNode(node, newName) {
      const n = new FSNode(newName, node.type);
      n.perms = node.perms;
      n.mtime = node.mtime;
      if (node.isDir()) {
        for (const k in node.children) {
          n.children[k] = this._cloneNode(node.children[k], k);
        }
      } else {
        n.content = node.content;
        n.sign = node.sign ? { hash: node.sign.hash, rand: node.sign.rand } : null;
        n.executable = node.executable;
      }
      return n;
    }

    chmod(path, mode) {
      const node = this.getNode(path);
      if (!node) throw new FSError('no_such_file', path);
      node.perms = this._applyMode(node.perms, mode);
      if (node.isFile()) node.executable = node.ownerX();
      return node;
    }

    // apply a chmod mode (symbolic like u+x, o-r, octal like 755, or a full
    // 9-char permission string like rw-r--r--)
    _applyMode(current, mode) {
      mode = mode.trim();
      // full permission string (9 chars of rwx-)
      if (/^[rwx-]{9}$/.test(mode)) {
        return mode;
      }
      // octal
      if (/^[0-7]{3,4}$/.test(mode)) {
        const o = mode[mode.length - 3];
        const g = mode[mode.length - 2];
        const ot = mode[mode.length - 1];
        return this._octToPerms(o) + this._octToPerms(g) + this._octToPerms(ot);
      }
      // symbolic: [ugoa]*[+-=][rwx]*  (we only care about owner for the player,
      // but apply to all classes for display)
      let perms = current.split('');
      // parse segments
      const segRe = /([ugoa]*)([+-=])([rwx]+|[0-9])/g;
      let m;
      let found = false;
      while ((m = segRe.exec(mode)) !== null) {
        found = true;
        const who = m[1] || 'ugoa';
        const op = m[2];
        const what = m[3];
        const classes = [];
        if (who.includes('u')) classes.push(0);
        if (who.includes('g')) classes.push(3);
        if (who.includes('o')) classes.push(6);
        if (who.includes('a')) classes.push(0, 3, 6);
        for (const c of classes) {
          if (op === '=') {
            // set exactly
            perms[c] = what.includes('r') ? 'r' : '-';
            perms[c + 1] = what.includes('w') ? 'w' : '-';
            perms[c + 2] = what.includes('x') ? 'x' : '-';
          } else {
            for (let i = 0; i < 3; i++) {
              const letter = 'rwx'[i];
              const has = what.includes(letter);
              if (op === '+') {
                if (has) perms[c + i] = letter;
              } else { // '-'
                if (has) perms[c + i] = '-';
              }
            }
          }
        }
      }
      if (!found) throw new FSError('chmod_invalid', mode);
      return perms.join('');
    }

    _octToPerms(d) {
      const n = parseInt(d, 10);
      return (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-');
    }

    // ---------- signing ----------

    // sign a file: hash over (basename @ rand) + content
    sign(path) {
      const node = this.getNode(path);
      if (!node || !node.isFile()) throw new FSError('no_such_file', path);
      const rand = Math.floor(Math.random() * 100000);
      const h = this._hash(node.name + '@' + rand + node.content);
      node.sign = { hash: h, rand: rand };
      return node;
    }

    checkSign(path) {
      const node = this.getNode(path);
      if (!node || !node.isFile() || !node.sign) return false;
      const h = this._hash(node.name + '@' + node.sign.rand + node.content);
      return h === node.sign.hash;
    }

    // simple FNV-1a 32-bit hash, returns hex string
    _hash(str) {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
      }
      return h.toString(16).padStart(8, '0');
    }

    // ---------- listing ----------

    // list entries of a directory (or a single file). Returns array of names.
    listEntries(path, opts) {
      opts = opts || {};
      const node = this.getNode(path);
      if (!node) throw new FSError('no_such_file', path);
      if (node.isFile()) return [node.name];
      if (!node.ownerR()) throw new FSError('permission_denied', path);
      let names = Object.keys(node.children);
      if (!opts.all && !opts.showAll) {
        names = names.filter(n => !n.startsWith('.'));
      }
      return names.sort();
    }

    // ---------- find ----------

    // find with a simple expression: {name, iname, type, maxdepth}
    find(path, expr) {
      expr = expr || {};
      const start = this.getNode(path || '.');
      if (!start) throw new FSError('no_such_file', path || '.');
      const results = [];
      const startAbs = this.resolve(path || '.');
      const _walk = (node, abs, depth) => {
        if (expr.maxdepth != null && depth > expr.maxdepth) return;
        if (this._matchFind(node, abs, expr)) {
          results.push(abs);
        }
        if (node.isDir() && node.ownerR() && node.ownerX()) {
          for (const k in node.children) {
            _walk(node.children[k], abs === '/' ? '/' + k : abs + '/' + k, depth + 1);
          }
        }
      };
      _walk(start, startAbs, 0);
      return results;
    }

    _matchFind(node, abs, expr) {
      if (expr.type) {
        if (expr.type === 'f' && !node.isFile()) return false;
        if (expr.type === 'd' && !node.isDir()) return false;
      }
      if (expr.name) {
        if (!this._globMatch(node.name, expr.name)) return false;
      }
      if (expr.iname) {
        if (!this._globMatch(node.name.toLowerCase(), expr.iname.toLowerCase())) return false;
      }
      return true;
    }

    // glob match: supports * and ?
    _globMatch(name, pattern) {
      // convert glob to regex
      let re = '';
      for (const c of pattern) {
        if (c === '*') re += '.*';
        else if (c === '?') re += '.';
        else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      }
      return new RegExp('^' + re + '$').test(name);
    }

    // ---------- serialization ----------

    serialize() {
      return JSON.stringify({
        home: this.home,
        cwd: this.cwd,
        prevCwd: this.prevCwd,
        root: this.root.toJSON(),
      });
    }

    static deserialize(str) {
      const o = JSON.parse(str);
      const fs = new FS();
      fs.home = o.home;
      fs.cwd = o.cwd;
      fs.prevCwd = o.prevCwd;
      fs.root = FSNode.fromJSON(o.root);
      return fs;
    }
  }

  class FSError extends Error {
    constructor(code, arg) {
      super(code + (arg ? ': ' + arg : ''));
      this.code = code;
      this.arg = arg;
    }
  }

  window.FS = FS;
  window.FSNode = FSNode;
  window.FSError = FSError;
})();
