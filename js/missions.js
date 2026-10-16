// Mission definitions for GameShell web edition.
// Each mission: { id, name, init(game), check(game), clean(game) }
// Goal texts come from GOALS_DATA (extracted from the original game).

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------

  function randInt(max) { return Math.floor(Math.random() * max); }
  function randIntRange(min, max) { return min + randInt(max - min + 1); }

  function randomString(len) {
    const chars = '0123456789abcdef';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[randInt(chars.length)];
    return s;
  }

  function randomAlphaString(len) {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[randInt(chars.length)];
    return s;
  }

  function randomAlphaNum(len) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[randInt(chars.length)];
    return s;
  }

  // build an absolute path under home from localized parts
  function P(game, ...parts) {
    return game.fs.home + '/' + parts.map(p => I18N.obj(p)).join('/');
  }

  function chestPath(game) {
    return P(game, 'Forest', 'Hut', 'Chest');
  }
  function cellarPath(game) {
    return P(game, 'Castle', 'Cellar');
  }
  function gardenPath(game) {
    return P(game, 'Garden');
  }
  function forestPath(game) {
    return P(game, 'Forest');
  }
  function greatHallPath(game) {
    return P(game, 'Castle', 'Great_hall');
  }
  function mazePath(game) {
    return P(game, 'Garden', 'Maze');
  }
  function cavePath(game) {
    return P(game, 'Mountain', 'Cave');
  }
  function stallPath(game) {
    return P(game, 'Stall');
  }
  function libraryPath(game) {
    return P(game, 'Castle', 'Main_building', 'Library');
  }
  function officePath(game) {
    return P(game, 'Castle', 'Main_building', 'Library', 'Merlin_s_office');
  }
  function drawerPath(game) {
    return P(game, 'Castle', 'Main_building', 'Library', 'Merlin_s_office', 'Drawer');
  }
  function throneRoomPath(game) {
    return P(game, 'Castle', 'Main_building', 'Throne_room');
  }
  function kingsQuarterPath(game) {
    return P(game, 'Castle', 'Main_building', 'Throne_room', 'Kings_quarter');
  }
  function observatoryPath(game) {
    return P(game, 'Castle', 'Observatory');
  }
  function towerTopPath(game) {
    return P(game, 'Castle', 'Main_tower', 'First_floor', 'Second_floor', 'Top_of_the_tower');
  }
  function firstFloorPath(game) {
    return P(game, 'Castle', 'Main_tower', 'First_floor');
  }

  // ensure a directory exists
  function ensureDir(game, path) {
    game.fs._mkdirPath(path, { silent: true });
  }

  // create a signed file with given content
  function makeSignedFile(game, path, content) {
    game.fs.write(path, content === undefined ? '' : content);
    game.fs.sign(path);
    return game.fs.getNode(path);
  }

  // create an empty signed file
  function makeEmptySignedFile(game, path) {
    return makeSignedFile(game, path, '');
  }

  // ------------------------------------------------------------------
  // ASCII art (simplified placeholders for objects)
  // ------------------------------------------------------------------
  const ART = {
    spider: ['  .--.\n /    \\\n( spider )\n \\    /\n  `--\'',
             '   @@@\n  @ @ @\n spider\n  @ @ @\n   @@@',
             '  ~::~\n (spider)\n  ~::~'],
    bat: ['   /\\_/\\\n  ( o.o )\n   > ^ <\n    bat',
          '  /|  |\\\n  | bat |\n  \\|  |/',
          '   _oo_\n  ( bat )\n   \\__/'],
    coin: ['  .--.\n ( $ )\n  `--\'',
           '  [$$]\n   $$',
           '  (o)\n coin'],
    stag_head: ['   /\\_/\\\n  | stag |\n   \\__/',
                '   (stag)\n    head'],
    shield: ['  .-.\n | ## |\n  `-\'',
             '  [##]\n shield'],
    armour: ['  .-.\n |arm|\n  `-\'',
             '  (armour)'],
    tapestry: ['  .---.\n |tape|\n |stry|\n  `---\'',
               '  [tapestry]',
               '  .====.\n |tape  |\n  `====\''],
    painting: ['  .--.\n |art |\n  `--\'',
               '  [painting]',
               '  .==.\n |art|\n  .==.'],
    bucket: ['  .--.\n |    |\n  `--\'',
             '  [bucket]'],
    flowers: ['  * * *\n flowers\n  * * *',
              '  (flowers)'],
    wheelbarrow: ['  .--.\n |wb  |\n  `--\'',
                  '  [wheelbarrow]'],
    cauldron: ['  .---.\n |     |\n |     |\n  `---\'',
               '  [cauldron]'],
    servillus: ['   .--.\n  ( == )\n  /____\\\n Servillus',
                '  [servillus]'],
    candle: ['   |\\\n  .--.\n  |  |\n  `--\'',
             '  [candle]'],
    star_chart: ['  *  .  *\n .  star  .\n  *  .  *',
                 '  [star chart]'],
    crown: ['   .-.\n  /   \\\n | ### |\n  `-\'-',
            '  [crown]'],
    medal: ['  .--.\n | ## |\n  `--\'',
            '  [medal]'],
    bottle: ['   |\n  .-.\n  |  |\n  `--\'',
             '  [bottle]'],
    ink_scroll: ['  .--.\n |ink |\n |scr |\n  `--\'',
                 '  [ink and scroll]'],
    snowflake: ['   *  *\n  * ** *\n   *  *',
                '  (flake)',
                '  * * *'],
    coal: ['  .--.\n |coal|\n  `--\'',
           '  [coal]'],
    nice_rock: ['  .--.\n |rock|\n  `--\'',
                '  [nice rock]'],
    spider_queen: ['   /\\_/\\\n  | QUEEN |\n   \\___/',
                   '  [spider queen]'],
    baby_bat: ['  /\\/\n ( b )\n  \\_/',
               '  [baby bat]'],
    barrel_of_apples: ['  .--.\n |app |\n |les |\n  `--\'',
                       '  [barrel of apples]'],
  };

  function artFor(name) {
    const arr = ART[name];
    if (arr) return arr[randInt(arr.length)];
    return '  [' + name + ']';
  }

  // ------------------------------------------------------------------
  // Book of potions
  // ------------------------------------------------------------------
  const BOOK_OF_POTIONS = `1. Transformation potion -------------------------- pages 1-2
2. Elixir of youth -------------------------------- pages 3-4
3. Philter of love ----------------------------------- page 5
4. Bottled death (powerful poison) ------------------- page 6
5. Herbal tea ---------------------------------------- page 7
6. Draft of invisibility -------------------------- pages 7-8
7. Homeopathic healing potion (part 1) ------------ pages 8-9
8. Homeopathic healing potion (part 2) -------------- page 10
9. Homeopathic healing potion (part 3) -------------- page 11
10. Toadstool stew ---------------------------------- page 12
11. Distilled water --------------------------------- page 13
12. King's ale -------------------------------------- Page 13
== page 1 ===================================================
vvvvvvvvvvvvvvvvvvvvv
Transformation Potion
^^^^^^^^^^^^^^^^^^^^^
1) Boil water in a cauldron.
2) Add 3 measures of fluxweed to the cauldron.
3) Add 2 bundles of knotgrass to the cauldron.
4) Stir 4 times, clockwise.
5) Wave your wand then let potion brew for 80 minutes.
6) Add 4 leeches to the cauldron.
7) Crush 2 scoops of lacewing flies to a fine paste.
8) Add 2 measures of the crushed lacewings to the cauldron.
9) Heat for 30 seconds on a low heat.
== page 2 -==================================================
10) Add 3 measures of boomslang skin to the cauldron.
11) Crush a bicorn horn into a fine powder.
12) Add 1 measure of the crushed horn to the cauldron.
13) Heat for 20 seconds at a high temperature.
14) Wave your wand then let potion brew for 24 hours.
15) Add 1 additional scoop of lacewings to the cauldron.
16) Stir 3 times, counter-clockwise.
17) Split potion into multiple doses, if desired.
18) Add a pieces of the person you wish to become.
19) Wave your wand to complete the potion.
== page 3 ===================================================
vvvvvvvvvvvvvvv
Elixir of youth
^^^^^^^^^^^^^^^
WARNING: **do not** drink if you are older than 30.
1) Fill a cauldron with used bath water.
2) Put a moderately large frog in the water.
3) Let the preparation rest overnight.
4) The next morning thank and free your little green friend.
5) Boil the water and add in a few sticks of oak tree.
6) Crush 5 river stones to a fine powder.
7) Mix in a third of the powder and stir vigorously.
== page 4 ===================================================
8) Let the preparation rest for a day.
9) Add hairs from the tail of a squirrel (willingly given).
10) Add the remaining stone powder.
11) Stir the potion very vigorously, in all directions.
12) Take some time to rest after such an effort.
13) Rest a little bit more.
14) Even take a nap if you want.
15) Add a few larch tree needles for seasoning.
16) Drink the potion from the cauldron.
== page 5 ===================================================
vvv/
Ph/
^/
/

\\
/
\\
/
\\
7\\
8/
/
== page 6 ===================================================
vv\\
Bot/
^^/
_/
\\
/
\\
/

\\
/
\\
== page 7 ===================================================
vvvvvvvvvv
Herbal tea
^^^^^^^^^^
1) Boil water.
2) Add herbs from the forest.
3) Let it sit for five minutes and drink while hot.
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
Draft of invisibility (instruction in invisible ink)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
     .
 \`                .
           '
== page 8 ===================================================

'              .
       '
  '
          \`
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
Homeopathic healing potion (part 1)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
1) Grind whatever caused harm to thin dust.
2) Put the dust in a big cauldron.
3) Fill the cauldron with water.
== page 9 ===================================================
4) Empty the cauldron in the sewer.
5) Fill the cauldron with water.
6) Empty the cauldron in the sewer.
7) Fill the cauldron with water.
8) Empty the cauldron in the sewer.
9) Fill the cauldron with water.
11) Empty the cauldron in the sewer.
12) Fill the cauldron with water.
13) Empty the cauldron in the sewer.
14) Fill the cauldron with water.
15) Empty the cauldron in the sewer.
16) Fill the cauldron with water.
== page 10 ==================================================
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
Homeopathic healing potion (part 2)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
1) Continue by emptying the cauldron.
2) Fill the cauldron with water.
3) Empty the cauldron in the sewer.
4) Fill the cauldron with water.
5) Empty the cauldron in the sewer.
6) Fill the cauldron with water.
7) Empty the cauldron in the sewer.
8) Fill the cauldron with water.
9) Empty the cauldron in the sewer.
== page 11 ==================================================
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
Homeopathic healing potion (part 3)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
1) Empty the cauldron again (almost done).
2) Fill the cauldron with water.
3) Empty the cauldron in the sewer.
4) Fill the cauldron with water.
5) Empty the cauldron in the sewer.
6) Fill the cauldron with water.
7) Empty the cauldron in the sewer.
8) Fill the cauldron with water.
9) Pour the contents of the cauldron in a flask and drink.
== page 12 ==================================================
vvvvvvvvvvvvvv
Toadstool stew
^^^^^^^^^^^^^^
1) Boil water in a cauldron.
2) Add in a few death caps (Amanita phalloides).
3) Also add a few fly agarics (Amanita muscaria).
4) And some destroying angels (Amanita virosa).
5) Mix in a few deadly webcaps (Cortinarius rubellus).
6) Feel free to add in any colourful fungi you have on hand.
7) Let half of the water evaporate.
8) Season with a pinch of salt and a few herbs.
9) Serve hot in a bowl.
== page 13 ==================================================
vvvvvvvvvvvvvvv
Distilled water
^^^^^^^^^^^^^^^
1) Boil water in a big pot.
2) Condense the vapor in a fresh container.
3) Add minerals for a better taste (optional).
vvvvvvvvvv
King's ale
^^^^^^^^^^
1) Go to the castle's cellar and grab a bottle.
2) Serve cold, in a pint.`;

  // split the book into pages (like csplit on ^== lines)
  function bookPages() {
    const lines = BOOK_OF_POTIONS.split('\n');
    const pages = [];
    let cur = [];
    for (const line of lines) {
      if (/^==/.test(line)) {
        pages.push(cur.join('\n'));
        cur = [];
      } else {
        cur.push(line);
      }
    }
    pages.push(cur.join('\n'));
    // pages[0] is the table of contents, pages[1..] are page 1..13
    return pages;
  }

  // install the book in a directory
  function installBook(game, bookDir) {
    ensureDir(game, bookDir);
    const pages = bookPages();
    // table of contents
    game.fs.write(bookDir + '/' + I18N.obj('table_of_contents'), pages[0] + '\n');
    for (let i = 1; i < pages.length; i++) {
      const num = String(i).padStart(2, '0');
      game.fs.write(bookDir + '/' + I18N.obj('page') + '_' + num, pages[i] + '\n');
    }
  }

  // ------------------------------------------------------------------
  // Maze generation
  // ------------------------------------------------------------------
  // Create a tree of directories under basePath with given depth and width.
  // Returns the list of leaf directory paths.
  function genMaze(game, basePath, depth, width) {
    const leaves = [];
    const _gen = (path, d) => {
      if (d >= depth) {
        leaves.push(path);
        return;
      }
      for (let i = 0; i < width; i++) {
        const name = randomString(8 + randInt(24));
        const child = path + '/' + name;
        ensureDir(game, child);
        _gen(child, d + 1);
      }
    };
    ensureDir(game, basePath);
    _gen(basePath, 0);
    return leaves;
  }

  // ------------------------------------------------------------------
  // Static world
  // ------------------------------------------------------------------
  function buildWorld(game) {
    const fs = game.fs;
    // Castle
    ensureDir(game, P(game, 'Castle'));
    ensureDir(game, towerTopPath(game));
    ensureDir(game, cellarPath(game));
    ensureDir(game, P(game, 'Castle', 'Main_building'));
    ensureDir(game, throneRoomPath(game));
    ensureDir(game, kingsQuarterPath(game));
    ensureDir(game, greatHallPath(game));
    ensureDir(game, libraryPath(game));
    ensureDir(game, officePath(game));
    ensureDir(game, drawerPath(game));
    ensureDir(game, observatoryPath(game));
    // Forest
    ensureDir(game, forestPath(game));
    // Garden
    ensureDir(game, gardenPath(game));
    ensureDir(game, mazePath(game));
    ensureDir(game, P(game, 'Garden', 'Flower_garden'));
    ensureDir(game, P(game, 'Garden', 'Shed'));
    // Mountain
    ensureDir(game, P(game, 'Mountain'));
    ensureDir(game, cavePath(game));
    // Stall
    ensureDir(game, stallPath(game));

    // static files
    makeSignedFile(game, cellarPath(game) + '/' + I18N.obj('barrel_of_apples'), artFor('barrel_of_apples'));
    makeSignedFile(game, P(game, 'Garden', 'Shed') + '/' + I18N.obj('bucket'), artFor('bucket'));
    makeSignedFile(game, P(game, 'Garden', 'Flower_garden') + '/' + I18N.obj('flowers'), artFor('flowers'));
    makeSignedFile(game, P(game, 'Garden', 'Shed') + '/' + I18N.obj('wheelbarrow'), artFor('wheelbarrow'));
    makeSignedFile(game, cavePath(game) + '/' + I18N.obj('cauldron'), artFor('cauldron'));
    makeSignedFile(game, officePath(game) + '/' + I18N.obj('candle'), artFor('candle'));
    makeSignedFile(game, observatoryPath(game) + '/' + I18N.obj('star_chart'), artFor('star_chart'));
    makeSignedFile(game, drawerPath(game) + '/' + I18N.obj('ink_and_scroll'), artFor('ink_scroll'));
    // library books (empty placeholders)
    fs.write(libraryPath(game) + '/' + I18N.obj('Mathematics_101'), '');
    fs.write(libraryPath(game) + '/' + I18N.obj('Greek_Latin_and_other_modern_languages'),
      'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod\n' +
      'tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,\n' +
      'quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo\n' +
      'consequat.  Duis aute irure dolor in reprehenderit in voluptate velit esse\n' +
      'cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non\n' +
      'proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n');
  }

  // ------------------------------------------------------------------
  // Mission list (in order, xeyes excluded)
  // ------------------------------------------------------------------
  const MISSION_ORDER = [
    'basic/01_cd_tower',
    'basic/02_cd.._cellar',
    'basic/03_cd_HOME_throne',
    'basic/04_mkdir_chest',
    'basic/05_rm_spiders_cellar',
    'basic/06_mv_coins_garden',
    'basic/07_mv_hidden_coins_garden',
    'basic/08_rm_wildcard_spiders_cellar',
    'basic/09_rm_wildcard_hidden_spiders_cellar',
    'basic/10_cp_standard_great_hall',
    'basic/11_cp_wildcards_tapestries_great_hall',
    'basic/12_cp_ls_mtime_paintings_tower',
    'misc/01_cal_nostradamus',
    'intermediate/01_alias_la',
    'misc/02_nano_journal',
    'intermediate/02_alias_journal',
    'intermediate/03_tab_spider_lair',
    'intermediate/05_background',
    'intermediate/06_control-C',
    'finding_files_maze/01_ls_cd',
    'finding_files_maze/02_tree',
    'finding_files_maze/03_find_1',
    'pipe_intro_book_of_potions/01_head',
    'pipe_intro_book_of_potions/02_tail',
    'pipe_intro_book_of_potions/03_cat',
    'pipe_intro_book_of_potions/04_pipe',
    'pipe_intro_book_of_potions/05_pipe_head_tail',
    'processes/01_ps_kill',
    'processes/02_ps_kill_signal',
    'processes/03_pstree_kill',
    'stdin_stdout_stderr/01_stdin_additions',
    'stdin_stdout_stderr/02_stdin_redirection_multiplications',
    'stdin_stdout_stderr/03_stdout_redirection_inventory',
    'stdin_stdout_stderr/04_stderr_dev-null_grimoires',
    'stdin_stdout_stderr/05_stdout_stderr_redirection_merlin',
    'permissions/01_chmod_x_dir_king_quarter',
    'permissions/02_chmod_r_file_king_quarter',
    'permissions/03_chmod_rw_file_dir_throne_room',
    'finding_files_maze/04_find_2',
    'finding_files_maze/05_find_xargs_grep',
    'pipes_merchant_stall/01_pipe_1',
    'pipes_merchant_stall/02_pipe_2',
    'misc/03_tr_caesar_shift',
    'FINAL_MISSION',
  ];

  // ------------------------------------------------------------------
  // Mission implementations
  // ------------------------------------------------------------------
  const M = {};

  // ---- basic/01_cd_tower ----
  M['basic/01_cd_tower'] = {
    name: '01_cd_tower',
    init(game) {},
    check(game) {
      const goal = towerTopPath(game);
      if (game.fs.cwd === goal) return { pass: true };
      game.fs.cwd = game.fs.home;
      return { pass: false, msg: game.mt('basic/01_cd_tower', 'You are not at the top of the tower!') + '\n' + game.mt('basic/01_cd_tower', 'You need to start over from the start.') };
    },
    clean(game) {},
  };

  // ---- basic/02_cd.._cellar ----
  M['basic/02_cd.._cellar'] = {
    name: '02_cd.._cellar',
    init(game) {},
    check(game) {
      const goal = cellarPath(game);
      if (game.fs.cwd === goal) return { pass: true };
      return { pass: false, msg: game.mt('basic/02_cd.._cellar', 'You are not in the cellar...') };
    },
    clean(game) {},
  };

  // ---- basic/03_cd_HOME_throne ----
  M['basic/03_cd_HOME_throne'] = {
    name: '03_cd_HOME_throne',
    init(game) {
      // teleport to cellar if not there
      const expected = cellarPath(game);
      if (game.fs.cwd !== expected) {
        game.fs.cwd = expected;
        game._teleportMsg = game.mt('basic/03_cd_HOME_throne', 'You have been teleported to') + ' .../' + expected.slice(game.fs.home.length + 1);
      }
    },
    check(game) {
      const goal = throneRoomPath(game);
      if (game.fs.cwd !== goal) {
        return { pass: false, msg: game.mt('basic/03_cd_HOME_throne', 'You are not in the throne room.') };
      }
      // check the second-to-last command
      const hist = game.shell.history;
      // find the last two non-gsh commands
      const cmds = hist.filter(h => !h.trim().startsWith('gsh'));
      if (cmds.length < 2) {
        return { pass: false, msg: game.mt('basic/03_cd_HOME_throne', 'The previous to last command must take you to the starting point.') };
      }
      const prev2 = cmds[cmds.length - 2].trim();
      // accept "cd" or "cd ~"
      if (/^cd(\s+~)?$/.test(prev2)) {
        return { pass: true };
      }
      if (/^cd\s+\.\./.test(prev2)) {
        return { pass: false, msg: game.mt('basic/03_cd_HOME_throne', 'The previous to last command is too complex.') };
      }
      return { pass: false, msg: game.mt('basic/03_cd_HOME_throne', 'The previous to last command must take you to the starting point.') };
    },
    clean(game) {},
  };

  // ---- basic/04_mkdir_chest ----
  M['basic/04_mkdir_chest'] = {
    name: '04_mkdir_chest',
    init(game) {},
    check(game) {
      const forest = forestPath(game);
      const forestNode = game.fs.getNode(forest);
      if (!forestNode) return { pass: false, msg: game.mt('basic/04_mkdir_chest', 'You did not build a hut in the forest!') };
      const hutName = I18N.obj('Hut');
      const chestName = I18N.obj('Chest');
      // count huts (case-insensitive)
      let nbHuts = 0, nbChests = 0;
      const _count = (node) => {
        for (const k in node.children) {
          const child = node.children[k];
          if (child.isDir()) {
            if (k.toLowerCase() === hutName.toLowerCase()) nbHuts++;
            if (k.toLowerCase() === chestName.toLowerCase()) nbChests++;
            _count(child);
          }
        }
      };
      _count(forestNode);
      if (nbHuts >= 2) return { pass: false, msg: game.mt('basic/04_mkdir_chest', 'You built too many huts in the forest!') };
      if (nbHuts < 1) return { pass: false, msg: game.mt('basic/04_mkdir_chest', 'You did not build a hut in the forest!') };
      if (nbChests >= 2) return { pass: false, msg: game.mt('basic/04_mkdir_chest', 'You built too many chests in your hut!') };
      if (nbChests < 1) return { pass: false, msg: game.mt('basic/04_mkdir_chest', 'You did not build a chest in your hut!') };
      // check chest is at root of hut
      const chest = chestPath(game);
      if (!game.fs.getNode(chest)) {
        return { pass: false, msg: game.mt('basic/04_mkdir_chest', 'The $dir_name directory does not exist!', { dir_name: '.../' + chest.slice(game.fs.home.length + 1) }) };
      }
      return { pass: true };
    },
    clean(game) {},
  };

  // ---- basic/05_rm_spiders_cellar ----
  M['basic/05_rm_spiders_cellar'] = {
    name: '05_rm_spiders_cellar',
    init(game) {
      const cellar = cellarPath(game);
      ensureDir(game, cellar);
      const spider = I18N.obj('spider');
      const bat = I18N.obj('bat');
      for (let i = 1; i <= 3; i++) {
        makeSignedFile(game, cellar + '/' + spider + '_' + i, artFor('spider'));
      }
      for (let i = 1; i <= 2; i++) {
        makeSignedFile(game, cellar + '/' + bat + '_' + i, artFor('bat'));
      }
    },
    check(game) {
      const cellar = cellarPath(game);
      const cellarNode = game.fs.getNode(cellar);
      if (!cellarNode) return { pass: false, msg: game.mt('basic/05_rm_spiders_cellar', 'There still are spiders in the cellar!') };
      const spider = I18N.obj('spider');
      const bat = I18N.obj('bat');
      let nbSpiders = 0, nbBats = 0;
      for (const k in cellarNode.children) {
        if (k.startsWith(spider + '_')) nbSpiders++;
        if (k.startsWith(bat + '_')) nbBats++;
      }
      if (nbSpiders > 0) return { pass: false, msg: game.mt('basic/05_rm_spiders_cellar', 'There still are spiders in the cellar!') };
      if (nbBats !== 2) return { pass: false, msg: game.mt('basic/05_rm_spiders_cellar', 'You removed a bat!') };
      return { pass: true };
    },
    clean(game) {},
  };

  // ---- basic/06_mv_coins_garden ----
  M['basic/06_mv_coins_garden'] = {
    name: '06_mv_coins_garden',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const garden = gardenPath(game);
      ensureDir(game, garden);
      const coin = I18N.obj('coin');
      for (let i = 1; i <= 3; i++) {
        makeSignedFile(game, garden + '/' + coin + '_' + i, artFor('coin'));
      }
    },
    check(game) {
      const chest = chestPath(game);
      const garden = gardenPath(game);
      const coin = I18N.obj('coin');
      for (let i = 1; i <= 3; i++) {
        const name = coin + '_' + i;
        if (game.fs.getNode(garden + '/' + name)) {
          return { pass: false, msg: game.mt('basic/06_mv_coins_garden', "The coin '$coin_name' is still in the garden!", { coin_name: name }) };
        }
        const chestCoin = game.fs.getNode(chest + '/' + name);
        if (!chestCoin) {
          return { pass: false, msg: game.mt('basic/06_mv_coins_garden', "The coin '$coin_name' is not in the chest!", { coin_name: name }) };
        }
        if (!game.fs.checkSign(chest + '/' + name)) {
          return { pass: false, msg: game.mt('basic/06_mv_coins_garden', "The coin '$coin_name' has been tampered with...", { coin_name: name }) };
        }
      }
      return { pass: true };
    },
    clean(game) {
      // remove any stray coins
      const home = game.fs.home;
      const coin = I18N.obj('coin');
      const found = game.fs.find(home, { name: coin + '_?' });
      for (const f of found) game.fs.rm(f, { f: true });
    },
  };

  // ---- basic/07_mv_hidden_coins_garden ----
  M['basic/07_mv_hidden_coins_garden'] = {
    name: '07_mv_hidden_coins_garden',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const garden = gardenPath(game);
      ensureDir(game, garden);
      const coin = I18N.obj('coin');
      // remove old hidden coins
      const gardenNode = game.fs.getNode(garden);
      if (gardenNode) {
        for (const k in gardenNode.children) {
          if (k.startsWith('.' + coin + '_') || k.includes('_' + coin + '_')) {
            delete gardenNode.children[k];
          }
        }
      }
      for (let i = 1; i <= 3; i++) {
        const name = '.' + randInt(100000) + '_' + coin + '_' + i;
        makeSignedFile(game, garden + '/' + name, artFor('coin'));
      }
    },
    check(game) {
      const chest = chestPath(game);
      const garden = gardenPath(game);
      const coin = I18N.obj('coin');
      for (let i = 1; i <= 3; i++) {
        const suffix = '_' + coin + '_' + i;
        // count in garden
        let nGarden = 0, nChest = 0;
        let chestCoin = null;
        const gardenNode = game.fs.getNode(garden);
        if (gardenNode) {
          for (const k in gardenNode.children) {
            if (k.startsWith('.') && k.endsWith(suffix)) nGarden++;
          }
        }
        const chestNode = game.fs.getNode(chest);
        if (chestNode) {
          for (const k in chestNode.children) {
            if (k.startsWith('.') && k.endsWith(suffix)) {
              nChest++;
              chestCoin = chest + '/' + k;
            }
          }
        }
        if (nGarden > 0) {
          return { pass: false, msg: game.mt('basic/07_mv_hidden_coins_garden', "The coin '$coin_name...' is still in the garden!", { coin_name: coin }) };
        }
        if (nChest > 1) {
          return { pass: false, msg: game.mt('basic/07_mv_hidden_coins_garden', "There are several '$coin_name...' in your chest!", { coin_name: coin }) };
        }
        if (nChest === 0) {
          return { pass: false, msg: game.mt('basic/07_mv_hidden_coins_garden', "There is no '$coin_name...' in your chest!", { coin_name: coin }) };
        }
        if (!game.fs.checkSign(chestCoin)) {
          return { pass: false, msg: game.mt('basic/07_mv_hidden_coins_garden', "The coin '$coin_name...' has been tampered with...", { coin_name: coin }) };
        }
      }
      return { pass: true };
    },
    clean(game) {},
  };

  // ---- basic/08_rm_wildcard_spiders_cellar ----
  M['basic/08_rm_wildcard_spiders_cellar'] = {
    name: '08_rm_wildcard_spiders_cellar',
    init(game) {
      const cellar = cellarPath(game);
      ensureDir(game, cellar);
      const cellarNode = game.fs.getNode(cellar);
      const spider = I18N.obj('spider');
      const bat = I18N.obj('bat');
      // remove old spiders/bats
      for (const k in cellarNode.children) {
        if (k.toLowerCase().includes(spider.toLowerCase()) || k.toLowerCase().includes(bat.toLowerCase())) {
          delete cellarNode.children[k];
        }
      }
      for (let i = 1; i <= 50; i++) {
        const name = randInt(100000) + '_' + spider + '_' + i;
        makeSignedFile(game, cellar + '/' + name, artFor('spider'));
      }
      for (let i = 1; i <= 5; i++) {
        const name = randInt(100000) + '_' + bat + '_' + i;
        makeSignedFile(game, cellar + '/' + name, artFor('bat'));
      }
      // record bats checksum
      const bats = Object.keys(cellarNode.children).filter(k => k.includes('_' + bat + '_')).sort();
      game.tmp.bats8 = bats.join('|');
    },
    check(game) {
      const cellar = cellarPath(game);
      const cellarNode = game.fs.getNode(cellar);
      if (!cellarNode) return { pass: false, msg: game.mt('basic/08_rm_wildcard_spiders_cellar', 'There still are some spiders ($nb_spiders) in the cellar!', { nb_spiders: 0 }) };
      const spider = I18N.obj('spider');
      const bat = I18N.obj('bat');
      let nbSpiders = 0;
      const bats = [];
      for (const k in cellarNode.children) {
        if (k.includes('_' + spider + '_')) nbSpiders++;
        if (k.includes('_' + bat + '_')) bats.push(k);
      }
      if (nbSpiders !== 0) {
        return { pass: false, msg: game.mt('basic/08_rm_wildcard_spiders_cellar', 'There still are some spiders ($nb_spiders) in the cellar!', { nb_spiders: nbSpiders }) };
      }
      bats.sort();
      if (bats.join('|') !== (game.tmp.bats8 || '')) {
        return { pass: false, msg: game.mt('basic/08_rm_wildcard_spiders_cellar', 'Some bats have been modified!') };
      }
      return { pass: true };
    },
    clean(game) {
      delete game.tmp.bats8;
    },
  };

  // ---- basic/09_rm_wildcard_hidden_spiders_cellar ----
  M['basic/09_rm_wildcard_hidden_spiders_cellar'] = {
    name: '09_rm_wildcard_hidden_spiders_cellar',
    init(game) {
      const cellar = cellarPath(game);
      ensureDir(game, cellar);
      const cellarNode = game.fs.getNode(cellar);
      const spider = I18N.obj('spider');
      const bat = I18N.obj('bat');
      for (const k in cellarNode.children) {
        if (k.toLowerCase().includes(spider.toLowerCase()) || k.startsWith('.' + bat.toLowerCase())) {
          delete cellarNode.children[k];
        }
      }
      for (let i = 1; i <= 50; i++) {
        const name = '.' + randInt(100000) + '_' + spider + '_' + i;
        makeSignedFile(game, cellar + '/' + name, artFor('spider'));
      }
      for (let i = 1; i <= 5; i++) {
        const name = '.' + randInt(100000) + '_' + bat + '_' + i;
        makeSignedFile(game, cellar + '/' + name, artFor('bat'));
      }
      const bats = Object.keys(cellarNode.children).filter(k => k.includes('_' + bat + '_')).sort();
      game.tmp.bats9 = bats.join('|');
    },
    check(game) {
      const cellar = cellarPath(game);
      const cellarNode = game.fs.getNode(cellar);
      if (!cellarNode) return { pass: false, msg: game.mt('basic/09_rm_wildcard_hidden_spiders_cellar', 'There still are some spiders ($nb_spiders) in the cellar!', { nb_spiders: 0 }) };
      const spider = I18N.obj('spider');
      const bat = I18N.obj('bat');
      let nbSpiders = 0;
      const bats = [];
      for (const k in cellarNode.children) {
        if (k.includes('_' + spider + '_')) nbSpiders++;
        if (k.includes('_' + bat + '_')) bats.push(k);
      }
      if (nbSpiders !== 0) {
        return { pass: false, msg: game.mt('basic/09_rm_wildcard_hidden_spiders_cellar', 'There still are some spiders ($nb_spiders) in the cellar!', { nb_spiders: nbSpiders }) };
      }
      bats.sort();
      if (bats.join('|') !== (game.tmp.bats9 || '')) {
        return { pass: false, msg: game.mt('basic/09_rm_wildcard_hidden_spiders_cellar', 'Some bats have been modified!') };
      }
      return { pass: true };
    },
    clean(game) {
      delete game.tmp.bats9;
    },
  };

  // ---- basic/10_cp_standard_great_hall ----
  M['basic/10_cp_standard_great_hall'] = {
    name: '10_cp_standard_great_hall',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const hall = greatHallPath(game);
      ensureDir(game, hall);
      const hallNode = game.fs.getNode(hall);
      const standard = I18N.obj('standard');
      const stag = I18N.obj('stag_head');
      const shield = I18N.obj('decorative_shield');
      const armour = I18N.obj('suit_of_armour');
      // remove old
      for (const k in hallNode.children) {
        if (k.includes('_' + stag) || k.includes('_' + shield) || k.includes('_' + armour) || k.includes(standard)) {
          delete hallNode.children[k];
        }
      }
      makeSignedFile(game, hall + '/' + randInt(100000) + '_' + stag, artFor('stag_head'));
      makeSignedFile(game, hall + '/' + randInt(100000) + '_' + shield, artFor('shield'));
      makeSignedFile(game, hall + '/' + randInt(100000) + '_' + armour, artFor('armour'));
      for (let i = 1; i <= 4; i++) {
        makeSignedFile(game, hall + '/' + standard + '_' + i, 'standard ' + i);
      }
      // record hall contents
      game.tmp.hall10 = Object.keys(game.fs.getNode(hall).children).sort().join('|');
    },
    check(game) {
      const hall = greatHallPath(game);
      const chest = chestPath(game);
      const hallNode = game.fs.getNode(hall);
      const chestNode = game.fs.getNode(chest);
      if (!hallNode || !chestNode) return { pass: false, msg: game.mt('basic/10_cp_standard_great_hall', 'You changed the contents of the great hall!') };
      const current = Object.keys(hallNode.children).sort().join('|');
      if (current !== (game.tmp.hall10 || '')) {
        return { pass: false, msg: game.mt('basic/10_cp_standard_great_hall', 'You changed the contents of the great hall!') };
      }
      const standard = I18N.obj('standard');
      const shield = I18N.obj('decorative_shield');
      const stag = I18N.obj('stag_head');
      const armour = I18N.obj('suit_of_armour');
      // check chest doesn't have shield/armour/stag
      for (const k in chestNode.children) {
        if (k.includes(shield) || k.includes(armour) || k.includes(stag)) {
          return { pass: false, msg: game.mt('basic/10_cp_standard_great_hall', 'I only wanted the standards!') };
        }
      }
      // check all standards are in chest
      const hallStandards = Object.keys(hallNode.children).filter(k => k.includes(standard)).sort();
      const chestStandards = Object.keys(chestNode.children).filter(k => k.includes(standard)).sort();
      if (hallStandards.join('|') !== chestStandards.join('|')) {
        return { pass: false, msg: game.mt('basic/10_cp_standard_great_hall', 'I wanted all the standards!') };
      }
      return { pass: true };
    },
    clean(game) {
      delete game.tmp.hall10;
    },
  };

  // ---- basic/11_cp_wildcards_tapestries_great_hall ----
  M['basic/11_cp_wildcards_tapestries_great_hall'] = {
    name: '11_cp_wildcards_tapestries_great_hall',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const hall = greatHallPath(game);
      ensureDir(game, hall);
      const hallNode = game.fs.getNode(hall);
      const tapestry = I18N.obj('tapestry');
      const stag = I18N.obj('stag_head');
      const shield = I18N.obj('decorative_shield');
      const armour = I18N.obj('suit_of_armour');
      for (const k in hallNode.children) {
        if (k.includes('_' + stag) || k.includes('_' + shield) || k.includes('_' + armour) || k.includes(tapestry)) {
          delete hallNode.children[k];
        }
      }
      makeSignedFile(game, hall + '/' + randInt(100000) + '_' + stag, artFor('stag_head'));
      makeSignedFile(game, hall + '/' + randInt(100000) + '_' + shield, artFor('shield'));
      makeSignedFile(game, hall + '/' + randInt(100000) + '_' + armour, artFor('armour'));
      for (let i = 1; i <= 10; i++) {
        const name = randInt(100000) + '_' + tapestry + '_' + String(i).padStart(2, '0');
        makeSignedFile(game, hall + '/' + name, artFor('tapestry'));
      }
      game.tmp.hall11 = Object.keys(game.fs.getNode(hall).children).sort().join('|');
    },
    check(game) {
      const hall = greatHallPath(game);
      const chest = chestPath(game);
      const hallNode = game.fs.getNode(hall);
      const chestNode = game.fs.getNode(chest);
      if (!hallNode || !chestNode) return { pass: false, msg: game.mt('basic/11_cp_wildcards_tapestries_great_hall', 'You changed the contents of the great hall!') };
      const current = Object.keys(hallNode.children).sort().join('|');
      if (current !== (game.tmp.hall11 || '')) {
        return { pass: false, msg: game.mt('basic/11_cp_wildcards_tapestries_great_hall', 'You changed the contents of the great hall!') };
      }
      const tapestry = I18N.obj('tapestry');
      const shield = I18N.obj('decorative_shield');
      const stag = I18N.obj('stag_head');
      const armour = I18N.obj('suit_of_armour');
      for (const k in chestNode.children) {
        if (k.includes(shield) || k.includes(armour) || k.includes(stag)) {
          return { pass: false, msg: game.mt('basic/11_cp_wildcards_tapestries_great_hall', 'I only wanted the tapestries!') };
        }
      }
      const hallTapestries = Object.keys(hallNode.children).filter(k => k.includes(tapestry)).sort();
      const chestTapestries = Object.keys(chestNode.children).filter(k => k.includes(tapestry)).sort();
      if (hallTapestries.join('|') !== chestTapestries.join('|')) {
        return { pass: false, msg: game.mt('basic/11_cp_wildcards_tapestries_great_hall', 'I wanted all the tapestries!') };
      }
      return { pass: true };
    },
    clean(game) {
      delete game.tmp.hall11;
    },
  };

  // ---- basic/12_cp_ls_mtime_paintings_tower ----
  M['basic/12_cp_ls_mtime_paintings_tower'] = {
    name: '12_cp_ls_mtime_paintings_tower',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const floor = firstFloorPath(game);
      ensureDir(game, floor);
      // remove old paintings
      const found = game.fs.find(game.fs.home, { iname: I18N.obj('painting') + '_*' });
      for (const f of found) game.fs.rm(f, { f: true });
      const painting = I18N.obj('painting');
      const now = Date.now();
      const names = [];
      // 3 paintings with different mtimes
      const p1 = painting + '_' + randomString(8);
      const p2 = painting + '_' + randomString(8);
      const p3 = painting + '_' + randomString(8);
      makeSignedFile(game, floor + '/' + p1, artFor('painting'));
      makeSignedFile(game, floor + '/' + p2, artFor('painting'));
      makeSignedFile(game, floor + '/' + p3, artFor('painting'));
      // set mtimes: p1 oldest (1980s), p2 (1995s), p3 (2010s)
      game.fs.getNode(floor + '/' + p1).mtime = new Date(1980 + randInt(10), randInt(12), 1 + randInt(28)).getTime();
      game.fs.getNode(floor + '/' + p2).mtime = new Date(1995 + randInt(10), randInt(12), 1 + randInt(28)).getTime();
      game.fs.getNode(floor + '/' + p3).mtime = new Date(2010 + randInt(10), randInt(12), 1 + randInt(28)).getTime();
      game.tmp.painting12 = p1; // the oldest
    },
    check(game) {
      const chest = chestPath(game);
      const floor = firstFloorPath(game);
      const filename = game.tmp.painting12;
      if (!filename) return { pass: false, msg: game.mt('basic/12_cp_ls_mtime_paintings_tower', 'There is no painting in your chest...') };
      const painting = I18N.obj('painting');
      const chestNode = game.fs.getNode(chest);
      let n = 0;
      if (chestNode) {
        for (const k in chestNode.children) if (k.startsWith(painting + '_')) n++;
      }
      if (n === 0) return { pass: false, msg: game.mt('basic/12_cp_ls_mtime_paintings_tower', 'There is no painting in your chest...') };
      if (n > 1) return { pass: false, msg: game.mt('basic/12_cp_ls_mtime_paintings_tower', 'There are too many paintings in your chest...') };
      if (!game.fs.getNode(floor + '/' + filename)) {
        return { pass: false, msg: game.mt('basic/12_cp_ls_mtime_paintings_tower', 'The painting is not in the tower anymore...') };
      }
      if (!game.fs.getNode(chest + '/' + filename)) {
        return { pass: false, msg: game.mt('basic/12_cp_ls_mtime_paintings_tower', 'The painting is not in your chest...') };
      }
      if (!game.fs.checkSign(chest + '/' + filename)) {
        return { pass: false, msg: game.mt('basic/12_cp_ls_mtime_paintings_tower', 'The painting in your chest is invalid...') };
      }
      return { pass: true };
    },
    clean(game) {
      delete game.tmp.painting12;
    },
  };

  // ---- misc/01_cal_nostradamus ----
  M['misc/01_cal_nostradamus'] = {
    name: '01_cal_nostradamus',
    init(game) {
      const YYYY = 1902 + randInt(136);
      const MM = String(1 + randInt(12)).padStart(2, '0');
      const DD = String(13 + randInt(15)).padStart(2, '0');
      game.tmp.calDate = { YYYY, MM, DD };
      game.tmp.calAnswer = new Date(YYYY, parseInt(MM) - 1, parseInt(DD)).getDay();
    },
    goal(game) {
      const d = game.tmp.calDate;
      let g = I18N.goalText('misc/01_cal_nostradamus');
      g = g.replace(/\$YYYY/g, d.YYYY).replace(/\$MM/g, d.MM).replace(/\$DD/g, d.DD);
      return g;
    },
    check(game) {
      // interactive: ask for the day of week
      const d = game.tmp.calDate;
      const question = game.mt('misc/01_cal_nostradamus', 'What was the day of the week for the $MM-$DD-$YYYY?', { MM: d.MM, DD: d.DD, YYYY: d.YYYY });
      const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const daysFr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const days = (I18N.getLang() === 'fr') ? daysFr : daysEn;
      return {
        interactive: true,
        question: question + '\n' + days.map((day, i) => '  ' + (i + 1) + ' : ' + day).join('\n') + '\n' + game.mt('misc/01_cal_nostradamus', 'Your answer:') + ' ',
        validate: (answer) => {
          const n = parseInt(answer.trim(), 10);
          if (isNaN(n) || n < 1 || n > 7) {
            return { pass: false, msg: game.mt('misc/01_cal_nostradamus', "That's not even a valid answer!") };
          }
          // day 1 = Sunday (2000-05-01 was a Sunday)
          const targetDow = (n - 1) % 7; // 0=Sunday
          if (targetDow === game.tmp.calAnswer) {
            return { pass: true };
          }
          return { pass: false, msg: game.mt('misc/01_cal_nostradamus', "That's not even a valid answer!") };
        },
      };
    },
    clean(game) {
      delete game.tmp.calDate;
      delete game.tmp.calAnswer;
    },
  };

  // ---- intermediate/01_alias_la ----
  M['intermediate/01_alias_la'] = {
    name: '01_alias_la',
    init(game) {
      // create a hidden nice rock in the current dir
      const cwd = game.fs.cwd;
      const rock = I18N.obj('nice_rock');
      makeSignedFile(game, cwd + '/.' + rock, artFor('nice_rock'));
    },
    check(game) {
      const alias = game.shell.aliases['la'];
      if (alias === undefined) {
        return { pass: false, msg: game.mt('intermediate/01_alias_la', "The alias 'la' doesn't exist...") };
      }
      const cmd = alias.replace(/['"]/g, '').replace(/\s+/g, '');
      if (cmd !== 'ls-A') {
        return { pass: false, msg: game.mt('intermediate/01_alias_la', "The alias 'la' doesn't run 'ls -A'...") };
      }
      return { pass: true };
    },
    clean(game) {},
  };

  // ---- misc/02_nano_journal ----
  M['misc/02_nano_journal'] = {
    name: '02_nano_journal',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
    },
    check(game) {
      const chest = chestPath(game);
      const journal = I18N.obj('journal') + '.txt';
      const journalFile = chest + '/' + journal;
      const node = game.fs.getNode(journalFile);
      if (!node) {
        return { pass: false, msg: game.mt('misc/02_nano_journal', "The file '$journal_file' doesn't exist...", { journal_file: '~/' + journalFile.slice(game.fs.home.length + 1) }) };
      }
      if (node.isDir()) {
        return { pass: false, msg: game.mt('misc/02_nano_journal', "'$journal_file' is a directory!", { journal_file: '~/' + journalFile.slice(game.fs.home.length + 1) }) };
      }
      if (node.content.length === 0) {
        return { pass: false, msg: game.mt('misc/02_nano_journal', "The file '$journal_file' is empty...", { journal_file: '~/' + journalFile.slice(game.fs.home.length + 1) }) };
      }
      return { pass: true };
    },
    clean(game) {},
  };

  // ---- intermediate/02_alias_journal ----
  M['intermediate/02_alias_journal'] = {
    name: '02_alias_journal',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
    },
    check(game) {
      const aliasName = I18N.obj('journal');
      const alias = game.shell.aliases[aliasName];
      if (alias === undefined) {
        return { pass: false, msg: game.mt('intermediate/02_alias_journal', "No alias '$alias_name' has been found...", { alias_name: aliasName }) };
      }
      const editor = game.shell.env.EDITOR || 'nano';
      const cmd = alias.replace(/['"]/g, '');
      if (!cmd.includes(editor)) {
        return { pass: false, msg: game.mt('intermediate/02_alias_journal', "Your alias doesn't use the command '$EDITOR'...", { EDITOR: editor }) };
      }
      // extract the file path from the alias
      const m = cmd.match(new RegExp(editor + '\\s+(.+)$'));
      if (!m) {
        return { pass: false, msg: game.mt('intermediate/02_alias_journal', "Your alias doesn't use the command '$EDITOR'...", { EDITOR: editor }) };
      }
      let target = m[1].trim().replace(/['"]/g, '');
      // expand ~
      target = game.fs.resolve(target);
      const expected = chestPath(game) + '/' + I18N.obj('journal') + '.txt';
      if (target !== expected) {
        return { pass: false, msg: game.mt('intermediate/02_alias_journal', "It seems you alias doesn't refer to the appropriate file ($target_path).\nMake sure to use an absolute path...", { target_path: target }) };
      }
      return { pass: true };
    },
    clean(game) {},
  };

  // ---- intermediate/03_tab_spider_lair ----
  M['intermediate/03_tab_spider_lair'] = {
    name: '03_tab_spider_lair',
    init(game) {
      const cellar = cellarPath(game);
      ensureDir(game, cellar);
      const lairName = I18N.obj('Lair_of_the_spider_queen') + ' ' + randomAlphaNum(16) + ' ' + randomAlphaNum(16);
      const lair = cellar + '/' + lairName;
      ensureDir(game, lair);
      const queen = randomAlphaNum(16) + '_' + I18N.obj('spider_queen') + '_' + randomAlphaNum(16);
      const bat = randomAlphaNum(16) + '_' + I18N.obj('baby_bat') + '_' + randomAlphaNum(16);
      makeSignedFile(game, lair + '/' + queen, artFor('spider_queen'));
      makeSignedFile(game, lair + '/' + bat, artFor('baby_bat'));
      game.tmp.lair = lair;
      game.tmp.startTime = Date.now();
    },
    check(game) {
      const MAX_DELAY = 20;
      const lair = game.tmp.lair;
      if (!lair) return { pass: false, msg: game.mt('intermediate/03_tab_spider_lair', 'You are not in the queen spider lair!') };
      if (game.fs.cwd !== lair) {
        return { pass: false, msg: game.mt('intermediate/03_tab_spider_lair', 'You are not in the queen spider lair!') };
      }
      const lairNode = game.fs.getNode(lair);
      const queen = I18N.obj('spider_queen');
      const bat = I18N.obj('baby_bat');
      let hasQueen = false, hasBat = false;
      if (lairNode) {
        for (const k in lairNode.children) {
          if (k.includes(queen)) hasQueen = true;
          if (k.includes(bat)) hasBat = true;
        }
      }
      if (hasQueen) return { pass: false, msg: game.mt('intermediate/03_tab_spider_lair', 'The queen spider is still in its lair...') };
      if (!hasBat) return { pass: false, msg: game.mt('intermediate/03_tab_spider_lair', 'Where is the baby bat?') };
      const elapsed = Math.floor((Date.now() - game.tmp.startTime) / 1000);
      if (elapsed > MAX_DELAY) {
        return { pass: false, msg: game.mt('intermediate/03_tab_spider_lair', 'Good, but you took $nb_seconds seconds. You needed to take less than $MAX_DELAY seconds...', { nb_seconds: elapsed, MAX_DELAY: MAX_DELAY }) };
      }
      return { pass: true, msg: game.mt('intermediate/03_tab_spider_lair', 'Perfect, it took you only $nb_seconds seconds to complete this mission!', { nb_seconds: elapsed }) };
    },
    clean(game) {
      if (game.tmp.lair) {
        game.fs.rm(game.tmp.lair, { r: true, f: true });
      }
      delete game.tmp.lair;
      delete game.tmp.startTime;
    },
  };

  // ---- intermediate/05_background ----
  M['intermediate/05_background'] = {
    name: '05_background',
    init(game) {
      // flarigo is a command; nothing to set up in the world
      game.tmp.flarigoCount = 0;
    },
    goal(game) {
      let g = I18N.goalText('intermediate/05_background');
      g = g.replace(/\$command/g, I18N.obj('flarigo'));
      return g;
    },
    check(game) {
      // count flarigo processes that were started (background)
      // The pyrotechnician looks for 2 seconds; we check how many flarigo
      // background jobs exist.
      const procs = game.shell.processes.filter(p => p.name === I18N.obj('flarigo') && p.status !== 'done');
      const nb = procs.length;
      if (nb >= 3) {
        return { pass: true, msg: game.mt('intermediate/05_background', 'Great, that looked good!') };
      }
      if (nb === 0) {
        return { pass: false, msg: game.mt('intermediate/05_background', "Mmm... I didn't see anything.") + '\n\n' + game.mt('intermediate/05_background', 'NOTE: you need to make sure the pyrotechnician sees all the fireworks while he is waiting.') };
      }
      return { pass: false, msg: game.mt('intermediate/05_background', 'Mmm... I only saw $NB fireworks. That\'s not enough.', { NB: nb }) + '\n\n' + game.mt('intermediate/05_background', 'NOTE: you need to make sure the pyrotechnician sees all the fireworks while he is waiting.') };
    },
    clean(game) {
      // kill flarigo processes
      for (const p of game.shell.processes) {
        if (p.name === I18N.obj('flarigo')) game.shell._terminateProc(p);
      }
      delete game.tmp.flarigoCount;
    },
  };

  // ---- intermediate/06_control-C ----
  M['intermediate/06_control-C'] = {
    name: '06_control-C',
    init(game) {
      const code = randomAlphaNum(4).toUpperCase();
      game.tmp.charmCode = code;
      game.tmp.charmTries = 0;
    },
    goal(game) {
      let g = I18N.goalText('intermediate/06_control-C');
      g = g.replace(/\$command/g, I18N.obj('charmiglio'));
      return g;
    },
    charmiglio(game, args, io) {
      const code = game.tmp.charmCode;
      if (!code) { io.stdout.writeln(I18N.t('charmiglio_msg')); return 0; }
      const input = (args[0] || '').toUpperCase();
      if (input === code) {
        io.stdout.writeln(I18N.t('charmiglio_ok'));
        game.tmp.charmSolved = true;
        return 0;
      }
      // wrong: simulate a long reaction that the player must interrupt
      io.stdout.writeln(I18N.t('charmiglio_msg'));
      // start a background process that will run "forever" until killed
      const proc = game.shell._startProcess({
        name: I18N.obj('charmiglio'),
        cmd: I18N.obj('charmiglio') + ' ' + args[0],
        interval: 1000,
        tick: (p, shell) => {
          // keep running; player must Ctrl-C (kill INT) or kill it
        },
      });
      game.tmp.charmProc = proc.pid;
      return 0;
    },
    check(game) {
      const code = game.tmp.charmCode;
      if (!code) return { pass: false };
      if (game.tmp.charmSolved) {
        return { pass: true, msg: game.mt('intermediate/06_control-C', 'It works! The special incantation is $CODE', { CODE: code }) };
      }
      // ask for the code
      return {
        interactive: true,
        question: game.mt('intermediate/06_control-C', "What's a valid 4 letters sequence?") + ' ',
        validate: (answer) => {
          const a = answer.trim().toUpperCase();
          if (a === code) {
            game.tmp.charmSolved = true;
            return { pass: true, msg: game.mt('intermediate/06_control-C', 'It works! The special incantation is $CODE', { CODE: code }) };
          }
          return { pass: false, msg: game.mt('intermediate/06_control-C', "That's not working, try a different combination...") };
        },
      };
    },
    clean(game) {
      if (game.tmp.charmProc) {
        game.shell._killProc(game.tmp.charmProc, 'KILL');
      }
      delete game.tmp.charmCode;
      delete game.tmp.charmTries;
      delete game.tmp.charmSolved;
      delete game.tmp.charmProc;
    },
  };

  // ---- finding_files_maze/01_ls_cd ----
  M['finding_files_maze/01_ls_cd'] = {
    name: '01_ls_cd',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const maze = mazePath(game);
      // clear maze
      game.fs.rm(maze, { r: true, f: true });
      ensureDir(game, maze);
      const leaves = genMaze(game, maze, 3, 2, 1);
      const coinDir = leaves[randInt(leaves.length)];
      const coinName = 'OOOOO_' + I18N.obj('copper_coin') + '_OOOOO';
      const content = game.fs._hash(coinDir);
      game.fs.write(coinDir + '/' + coinName, content + '\n');
      game.tmp.copperCoin = content;
    },
    goal(game) {
      let g = I18N.goalText('finding_files_maze/01_ls_cd');
      g = g.replace(/\$maze/g, mazePath(game));
      return g;
    },
    check(game) {
      const maze = mazePath(game);
      const chest = chestPath(game);
      const coin = I18N.obj('copper_coin');
      // check no copper coin in maze
      const inMaze = game.fs.find(maze, { name: '*' + coin + '*' });
      if (inMaze.length > 0) {
        return { pass: false, msg: game.mt('finding_files_maze/01_ls_cd', 'There still are some copper coins in the maze!') };
      }
      // check coin in chest
      const chestNode = game.fs.getNode(chest);
      let coinFile = null;
      if (chestNode) {
        for (const k in chestNode.children) {
          if (k.includes(coin)) coinFile = chest + '/' + k;
        }
      }
      if (!coinFile) {
        return { pass: false, msg: game.mt('finding_files_maze/01_ls_cd', 'There is no copper coin in your chest!') };
      }
      const node = game.fs.getNode(coinFile);
      if (node.content.trim() !== (game.tmp.copperCoin || '')) {
        return { pass: false, msg: game.mt('finding_files_maze/01_ls_cd', 'Booh... The copper coin in you chest is invalid!') };
      }
      return { pass: true };
    },
    clean(game) {
      game.fs.rm(mazePath(game), { r: true, f: true });
      ensureDir(game, mazePath(game));
      delete game.tmp.copperCoin;
    },
  };

  // ---- finding_files_maze/02_tree ----
  M['finding_files_maze/02_tree'] = {
    name: '02_tree',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const maze = mazePath(game);
      game.fs.rm(maze, { r: true, f: true });
      ensureDir(game, maze);
      const leaves = genMaze(game, maze, 3, 3, 1);
      const coinDir = leaves[randInt(leaves.length)];
      const coinName = 'OOOOO_' + I18N.obj('silver_coin') + '_OOOOO';
      const content = game.fs._hash(coinDir);
      game.fs.write(coinDir + '/' + coinName, content + '\n');
      game.tmp.silverCoin = content;
    },
    check(game) {
      const maze = mazePath(game);
      const chest = chestPath(game);
      const coin = I18N.obj('silver_coin');
      const inMaze = game.fs.find(maze, { name: '*' + coin + '*' });
      if (inMaze.length > 0) {
        return { pass: false, msg: game.mt('finding_files_maze/02_tree', 'There still are some silver coins in the maze!') };
      }
      const chestNode = game.fs.getNode(chest);
      let coinFile = null;
      if (chestNode) {
        for (const k in chestNode.children) {
          if (k.includes(coin)) coinFile = chest + '/' + k;
        }
      }
      if (!coinFile) {
        return { pass: false, msg: game.mt('finding_files_maze/02_tree', 'There is no silver coin in your chest!') };
      }
      const node = game.fs.getNode(coinFile);
      if (node.content.trim() !== (game.tmp.silverCoin || '')) {
        return { pass: false, msg: game.mt('finding_files_maze/02_tree', 'The silver coin in you chest is invalid!') };
      }
      return { pass: true };
    },
    clean(game) {
      game.fs.rm(mazePath(game), { r: true, f: true });
      ensureDir(game, mazePath(game));
      delete game.tmp.silverCoin;
    },
  };

  // ---- finding_files_maze/03_find_1 ----
  M['finding_files_maze/03_find_1'] = {
    name: '03_find_1',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const maze = mazePath(game);
      game.fs.rm(maze, { r: true, f: true });
      ensureDir(game, maze);
      const leaves = genMaze(game, maze, 3, 10, 2);
      const dir1 = leaves[0];
      const dir2 = leaves[1];
      const gold = I18N.obj('gold_coin');
      const gold2 = I18N.obj('GolD_CoiN');
      const c1 = game.fs._hash(dir1);
      const c2 = game.fs._hash(dir2);
      game.fs.write(dir1 + '/' + gold + '_1', c1 + '\n');
      game.fs.write(dir2 + '/' + gold2 + '_2', c2 + '\n');
      game.tmp.goldCoin1 = c1;
      game.tmp.goldCoin2 = c2;
    },
    check(game) {
      const maze = mazePath(game);
      const chest = chestPath(game);
      const gold = I18N.obj('gold_coin');
      const gold2 = I18N.obj('GolD_CoiN');
      const inMaze = game.fs.find(maze, { iname: gold, type: 'f' });
      if (inMaze.length > 2) {
        return { pass: false, msg: game.mt('finding_files_maze/03_find_1', 'There are too many gold coins in the maze!') };
      }
      if (inMaze.length > 0) {
        return { pass: false, msg: game.mt('finding_files_maze/03_find_1', 'There still are some gold coins in the maze!') };
      }
      const chestNode = game.fs.getNode(chest);
      let coin1 = null, coin2 = null;
      if (chestNode) {
        for (const k in chestNode.children) {
          if (k.endsWith(gold + '_1')) coin1 = chest + '/' + k;
          if (k.endsWith(gold2 + '_2')) coin2 = chest + '/' + k;
        }
      }
      if (!coin1 || !coin2) {
        return { pass: false, msg: game.mt('finding_files_maze/03_find_1', 'Some of the coins are not in your chest!') };
      }
      if (game.fs.getNode(coin1).content.trim() !== (game.tmp.goldCoin1 || '')) {
        return { pass: false, msg: game.mt('finding_files_maze/03_find_1', "Coin '$coin_name' in your chest is invalid!", { coin_name: gold + '_1' }) };
      }
      if (game.fs.getNode(coin2).content.trim() !== (game.tmp.goldCoin2 || '')) {
        return { pass: false, msg: game.mt('finding_files_maze/03_find_1', "Coin '$coin_name' in your chest is invalid!", { coin_name: gold2 + '_2' }) };
      }
      return { pass: true };
    },
    clean(game) {
      game.fs.rm(mazePath(game), { r: true, f: true });
      ensureDir(game, mazePath(game));
      delete game.tmp.goldCoin1;
      delete game.tmp.goldCoin2;
    },
  };

  // ---- pipe_intro_book_of_potions/01_head ----
  function potionInit(game) {
    const cave = cavePath(game);
    ensureDir(game, cave);
    const bookDir = cave + '/' + I18N.obj('Book_of_potions');
    // remove cauldron, add servillus
    const caveNode = game.fs.getNode(cave);
    if (caveNode) {
      delete caveNode.children[I18N.obj('cauldron')];
    }
    installBook(game, bookDir);
    makeSignedFile(game, cave + '/servillus', artFor('servillus'));
    // keep a copy for checks
    game.tmp.bookCopy = bookPages().map(p => p);
  }

  function potionCheckCommon(game, missionDir) {
    const cave = cavePath(game);
    if (game.fs.cwd !== cave) {
      return { pass: false, msg: game.mt(missionDir, 'You are not in the cave with Servillus!') };
    }
    // check book not altered
    const bookDir = cave + '/' + I18N.obj('Book_of_potions');
    const bookNode = game.fs.getNode(bookDir);
    if (!bookNode) {
      return { pass: false, msg: game.mt(missionDir, 'You altered the book...') };
    }
    const pages = game.tmp.bookCopy || bookPages();
    for (let i = 0; i < pages.length; i++) {
      const pageNum = i === 0 ? I18N.obj('table_of_contents') : I18N.obj('page') + '_' + String(i).padStart(2, '0');
      const node = game.fs.getNode(bookDir + '/' + pageNum);
      if (!node || node.content !== pages[i] + '\n') {
        return { pass: false, msg: game.mt(missionDir, 'You altered the book...') };
      }
    }
    return null;
  }

  function prevCmdCheck(game, missionDir, mustContain, expectedFn) {
    const pc = game.shell.lastCommandLine;
    if (!pc) return { pass: false, msg: game.mt(missionDir, 'Your previous command does not give the expected result...') };
    if (mustContain && !pc.includes(mustContain)) {
      return { pass: false, msg: game.mt(missionDir, "You have not used the '$cmd' command!", { cmd: mustContain }) };
    }
    const firstWord = pc.trim().split(/\s+/)[0];
    if (firstWord === 'gsh') {
      return { pass: false, msg: game.mt(missionDir, 'Your previous command does not give the expected result...') };
    }
    const result = game.shell.replay(pc);
    const expected = expectedFn();
    if (result.stdout.replace(/\n$/, '') !== expected.replace(/\n$/, '')) {
      return { pass: false, msg: game.mt(missionDir, 'Your previous command does not give the expected result...') };
    }
    return { pass: true };
  }

  M['pipe_intro_book_of_potions/01_head'] = {
    name: '01_head',
    init(game) { potionInit(game); },
    check(game) {
      const common = potionCheckCommon(game, 'pipe_intro_book_of_potions/01_head');
      if (common) return common;
      const pages = game.tmp.bookCopy;
      const page7 = pages[7];
      const expected = page7.split('\n').slice(0, 6).join('\n');
      return prevCmdCheck(game, 'pipe_intro_book_of_potions/01_head', 'head', () => expected);
    },
    clean(game) {
      const cave = cavePath(game);
      const caveNode = game.fs.getNode(cave);
      if (caveNode) {
        delete caveNode.children['servillus'];
        delete caveNode.children[I18N.obj('Book_of_potions')];
      }
      makeSignedFile(game, cave + '/' + I18N.obj('cauldron'), artFor('cauldron'));
      delete game.tmp.bookCopy;
    },
  };

  M['pipe_intro_book_of_potions/02_tail'] = {
    name: '02_tail',
    init(game) { potionInit(game); },
    check(game) {
      const common = potionCheckCommon(game, 'pipe_intro_book_of_potions/02_tail');
      if (common) return common;
      const pages = game.tmp.bookCopy;
      const page12 = pages[12];
      const lines = page12.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      const expected = lines.slice(-9).join('\n');
      return prevCmdCheck(game, 'pipe_intro_book_of_potions/02_tail', 'tail', () => expected);
    },
    clean(game) {
      const cave = cavePath(game);
      const caveNode = game.fs.getNode(cave);
      if (caveNode) {
        delete caveNode.children['servillus'];
        delete caveNode.children[I18N.obj('Book_of_potions')];
      }
      makeSignedFile(game, cave + '/' + I18N.obj('cauldron'), artFor('cauldron'));
      delete game.tmp.bookCopy;
    },
  };

  M['pipe_intro_book_of_potions/03_cat'] = {
    name: '03_cat',
    init(game) { potionInit(game); },
    check(game) {
      const common = potionCheckCommon(game, 'pipe_intro_book_of_potions/03_cat');
      if (common) return common;
      const pages = game.tmp.bookCopy;
      const expected = pages[1] + '\n' + pages[2];
      return prevCmdCheck(game, 'pipe_intro_book_of_potions/03_cat', 'cat', () => expected);
    },
    clean(game) {
      const cave = cavePath(game);
      const caveNode = game.fs.getNode(cave);
      if (caveNode) {
        delete caveNode.children['servillus'];
        delete caveNode.children[I18N.obj('Book_of_potions')];
      }
      makeSignedFile(game, cave + '/' + I18N.obj('cauldron'), artFor('cauldron'));
      delete game.tmp.bookCopy;
    },
  };

  M['pipe_intro_book_of_potions/04_pipe'] = {
    name: '04_pipe',
    init(game) { potionInit(game); },
    check(game) {
      const common = potionCheckCommon(game, 'pipe_intro_book_of_potions/04_pipe');
      if (common) return common;
      const pages = game.tmp.bookCopy;
      const combined = pages[3] + '\n' + pages[4];
      const lines = combined.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      const expected = lines.slice(-16).join('\n');
      return prevCmdCheck(game, 'pipe_intro_book_of_potions/04_pipe', 'tail', () => expected);
    },
    clean(game) {
      const cave = cavePath(game);
      const caveNode = game.fs.getNode(cave);
      if (caveNode) {
        delete caveNode.children['servillus'];
        delete caveNode.children[I18N.obj('Book_of_potions')];
      }
      makeSignedFile(game, cave + '/' + I18N.obj('cauldron'), artFor('cauldron'));
      delete game.tmp.bookCopy;
    },
  };

  M['pipe_intro_book_of_potions/05_pipe_head_tail'] = {
    name: '05_pipe_head_tail',
    init(game) { potionInit(game); },
    check(game) {
      const common = potionCheckCommon(game, 'pipe_intro_book_of_potions/05_pipe_head_tail');
      if (common) return common;
      const pc = game.shell.lastCommandLine;
      if (pc && (pc.includes('awk') || pc.includes('sed'))) {
        return { pass: false, msg: game.mt('pipe_intro_book_of_potions/05_pipe_head_tail', 'If you know awk or sed, what are you doing playing GameShell?') };
      }
      const pages = game.tmp.bookCopy;
      const page13 = pages[13];
      const first6 = page13.split('\n').slice(0, 6);
      const expected = first6.slice(-3).join('\n');
      return prevCmdCheck(game, 'pipe_intro_book_of_potions/05_pipe_head_tail', 'tail', () => expected);
    },
    clean(game) {
      const cave = cavePath(game);
      const caveNode = game.fs.getNode(cave);
      if (caveNode) {
        delete caveNode.children['servillus'];
        delete caveNode.children[I18N.obj('Book_of_potions')];
      }
      makeSignedFile(game, cave + '/' + I18N.obj('cauldron'), artFor('cauldron'));
      delete game.tmp.bookCopy;
    },
  };

  // ---- processes/01_ps_kill ----
  M['processes/01_ps_kill'] = {
    name: '01_ps_kill',
    init(game) {
      const spellName = I18N.obj('spell');
      const proc = game.shell._startProcess({
        name: spellName,
        cmd: spellName,
        interval: 3000,
        tick: (p, shell) => {
          const art = ['      *#@*', '     &_**/~', '       !$-#'];
          const indent = ' '.repeat(2 + randInt(15));
          shell.sink.writeln(indent + art[randInt(art.length)]);
        },
      });
      game.tmp.spellPid = proc.pid;
    },
    goal(game) {
      let g = I18N.goalText('processes/01_ps_kill');
      g = g.replace(/\$PS/g, 'ps');
      return g;
    },
    check(game) {
      const pid = game.tmp.spellPid;
      const proc = game.shell._findProc(pid);
      if (proc && proc.status !== 'done') {
        return { pass: false, msg: game.mt('processes/01_ps_kill', 'The spell is still running!') };
      }
      return { pass: true };
    },
    clean(game) {
      if (game.tmp.spellPid) {
        game.shell._killProc(game.tmp.spellPid, 'KILL');
      }
      delete game.tmp.spellPid;
    },
  };

  // ---- processes/02_ps_kill_signal ----
  M['processes/02_ps_kill_signal'] = {
    name: '02_ps_kill_signal',
    init(game) {
      const spellName = I18N.obj('spell');
      game.tmp.spellPids = [];
      const startSpell = () => {
        const proc = game.shell._startProcess({
          name: spellName,
          cmd: spellName,
          interval: 3000,
          onSignal: {
            TERM: (p, shell) => {
              shell.sink.writeln(game.mt('processes/02_ps_kill_signal', "You'll need to do better than that to kill my spell!"));
              // spawn a new spell
              const newProc = startSpell();
              game.tmp.spellPids.push(newProc.pid);
            },
          },
          tick: (p, shell) => {
            const art = ['      *#@*', '     $@%#\\4', '     &"_%<@', '      +8^@j', '       #!v@'];
            const indent = ' '.repeat(2 + randInt(15));
            shell.sink.writeln(indent + art[randInt(art.length)]);
          },
        });
        game.tmp.spellPids.push(proc.pid);
        return proc;
      };
      startSpell();
    },
    goal(game) {
      let g = I18N.goalText('processes/02_ps_kill_signal');
      g = g.replace(/\$PS/g, 'ps');
      return g;
    },
    check(game) {
      const spellName = I18N.obj('spell');
      const running = game.shell.processes.filter(p => p.name === spellName && p.status !== 'done');
      if (running.length > 0) {
        return { pass: false, msg: game.mt('processes/02_ps_kill_signal', 'Some spells ($nb_spells) are still running!', { nb_spells: running.length }) };
      }
      if ((game.tmp.spellPids || []).length < 2) {
        return { pass: false, msg: game.mt('processes/02_ps_kill_signal', "You haven't tried using the standard TERM signal on the spell.") };
      }
      return { pass: true };
    },
    clean(game) {
      for (const pid of (game.tmp.spellPids || [])) {
        game.shell._killProc(pid, 'KILL');
      }
      delete game.tmp.spellPids;
    },
  };

  // ---- processes/03_pstree_kill ----
  M['processes/03_pstree_kill'] = {
    name: '03_pstree_kill',
    init(game) {
      const cellar = cellarPath(game);
      ensureDir(game, cellar);
      const fairyName = I18N.obj('nice_fairy');
      const impName = I18N.obj('mischievous_imp');
      const spellName = I18N.obj('spell');
      game.tmp.fairySpellPids = [];
      game.tmp.impSpellPids = [];
      game.tmp.snowflakes = [];

      const startSpell = (parent, isFairy) => {
        const proc = game.shell._startProcess({
          name: spellName,
          cmd: spellName,
          parent: parent.pid,
          interval: 3000,
          tick: (p, shell) => {
            const objName = isFairy ? I18N.obj('snowflake') : I18N.obj('coal');
            const name = randInt(100000) + '_' + objName;
            makeSignedFile(game, cellar + '/' + name, artFor(isFairy ? 'snowflake' : 'coal'));
            if (isFairy) game.tmp.snowflakes.push(name);
          },
        });
        if (isFairy) game.tmp.fairySpellPids.push(proc.pid);
        else game.tmp.impSpellPids.push(proc.pid);
        return proc;
      };

      const fairy = game.shell._startProcess({
        name: fairyName,
        cmd: fairyName,
        interval: 100000,
      });
      game.tmp.fairyPid = fairy.pid;
      for (let i = 0; i < 3; i++) startSpell(fairy, true);

      const imp = game.shell._startProcess({
        name: impName,
        cmd: impName,
        interval: 100000,
      });
      game.tmp.impPid = imp.pid;
      for (let i = 0; i < 3; i++) startSpell(imp, false);
    },
    check(game) {
      const fairyName = I18N.obj('nice_fairy');
      const impName = I18N.obj('mischievous_imp');
      const spellName = I18N.obj('spell');
      const cellar = cellarPath(game);
      // fairy still running?
      const fairy = game.shell._findProc(game.tmp.fairyPid);
      if (!fairy || fairy.status === 'done') {
        return { pass: false, msg: game.mt('processes/03_pstree_kill', 'Did you kill the fairy?') };
      }
      const imp = game.shell._findProc(game.tmp.impPid);
      if (!imp || imp.status === 'done') {
        return { pass: false, msg: game.mt('processes/03_pstree_kill', 'Did you kill the imp?') };
      }
      // fairy's spells still running (>=3)?
      const fairySpellsRunning = game.tmp.fairySpellPids.filter(pid => {
        const p = game.shell._findProc(pid);
        return p && p.status !== 'done';
      }).length;
      if (fairySpellsRunning < 3) {
        return { pass: false, msg: game.mt('processes/03_pstree_kill', "Did you remove some of the fairy's spells?") };
      }
      // imp's spells all killed?
      const impSpellsRunning = game.tmp.impSpellPids.filter(pid => {
        const p = game.shell._findProc(pid);
        return p && p.status !== 'done';
      }).length;
      if (impSpellsRunning !== 0) {
        return { pass: false, msg: game.mt('processes/03_pstree_kill', "Are you sure you removed all the imp's spells?") };
      }
      // no coal in cellar?
      const coal = I18N.obj('coal');
      const cellarNode = game.fs.getNode(cellar);
      let nbCoals = 0;
      if (cellarNode) {
        for (const k in cellarNode.children) if (k.includes('_' + coal)) nbCoals++;
      }
      if (nbCoals !== 0) {
        return { pass: false, msg: game.mt('processes/03_pstree_kill', 'There still is some coal in the cellar!') };
      }
      // all snowflakes still present?
      const snowflake = I18N.obj('snowflake');
      let missing = 0;
      if (cellarNode) {
        for (const sf of game.tmp.snowflakes) {
          if (!cellarNode.children[sf]) missing++;
        }
      }
      if (missing > 0) {
        return { pass: false, msg: game.mt('processes/03_pstree_kill', 'Did you melt some of the snowflakes?') };
      }
      return { pass: true };
    },
    clean(game) {
      // kill all spells, fairy, imp
      for (const pid of (game.tmp.fairySpellPids || [])) game.shell._killProc(pid, 'KILL');
      for (const pid of (game.tmp.impSpellPids || [])) game.shell._killProc(pid, 'KILL');
      if (game.tmp.fairyPid) game.shell._killProc(game.tmp.fairyPid, 'KILL');
      if (game.tmp.impPid) game.shell._killProc(game.tmp.impPid, 'KILL');
      // remove coal and extra snowflakes
      const cellar = cellarPath(game);
      const cellarNode = game.fs.getNode(cellar);
      if (cellarNode) {
        const coal = I18N.obj('coal');
        const snowflake = I18N.obj('snowflake');
        let sfCount = 0;
        for (const k in cellarNode.children) {
          if (k.includes('_' + coal)) delete cellarNode.children[k];
          else if (k.includes('_' + snowflake)) sfCount++;
        }
        // keep at most 10 snowflakes
        const sfs = Object.keys(cellarNode.children).filter(k => k.includes('_' + snowflake));
        for (let i = 10; i < sfs.length; i++) delete cellarNode.children[sfs[i]];
      }
      delete game.tmp.fairySpellPids;
      delete game.tmp.impSpellPids;
      delete game.tmp.snowflakes;
      delete game.tmp.fairyPid;
      delete game.tmp.impPid;
    },
  };

  // ---- stdin_stdout_stderr/01_stdin_additions ----
  M['stdin_stdout_stderr/01_stdin_additions'] = {
    name: '01_stdin_additions',
    init(game) {
      const questions = [];
      for (let i = 0; i < 5; i++) {
        const a = 1 + randInt(100);
        const b = 1 + randInt(100);
        questions.push({ a, b, r: a + b });
      }
      game.tmp.additions = questions;
    },
    check(game) {
      const questions = game.tmp.additions;
      if (!questions || questions.length === 0) return { pass: false };
      let idx = 0;
      return {
        interactive: true,
        multi: true,
        question: (i) => questions[i].a + ' + ' + questions[i].b + ' = ?? ',
        count: questions.length,
        validate: (answer, i) => {
          const n = parseInt(answer.trim(), 10);
          if (isNaN(n)) {
            return { pass: false, msg: game.mt('stdin_stdout_stderr/01_stdin_additions', "That's not even a number!") };
          }
          if (n !== questions[i].r) {
            return { pass: false, msg: game.mt('stdin_stdout_stderr/01_stdin_additions', 'Too bad! The answer was $result...', { result: questions[i].r }) };
          }
          return { pass: true };
        },
      };
    },
    clean(game) {
      delete game.tmp.additions;
    },
  };

  // ---- stdin_stdout_stderr/02_stdin_redirection_multiplications ----
  M['stdin_stdout_stderr/02_stdin_redirection_multiplications'] = {
    name: '02_stdin_redirection_multiplications',
    init(game) {
      const library = libraryPath(game);
      ensureDir(game, library);
      // create the cheat book
      const cheat = '.' + I18N.obj('How_to_cheat_for_exams');
      game.fs.write(library + '/' + cheat, game.mt('stdin_stdout_stderr/02_stdin_redirection_multiplications', 'The book \'Mathematics_101\' contains all the answers.\nJust copy all its lines to get perfect score.') + '\n');
      // create the math book with answers
      const book = I18N.obj('Mathematics_101');
      const questions = [];
      const answers = [];
      for (let i = 0; i < 100; i++) {
        const a = 1 + randInt(100);
        const b = 1 + randInt(100);
        questions.push({ a, b, r: a * b });
        answers.push(String(a * b));
      }
      game.fs.write(library + '/' + book, answers.join('\n') + '\n');
      game.tmp.multiplications = questions;
    },
    check(game) {
      const questions = game.tmp.multiplications;
      if (!questions) return { pass: false };
      const startTime = Date.now();
      const TIME_LIMIT = 10000;
      return {
        interactive: true,
        multi: true,
        question: (i) => questions[i].a + ' * ' + questions[i].b + ' = ?? ',
        count: questions.length,
        validate: (answer, i) => {
          if (Date.now() - startTime > TIME_LIMIT) {
            return { pass: false, msg: game.mt('stdin_stdout_stderr/02_stdin_redirection_multiplications', 'Too slow! You need to give the answers in less than 10 seconds...') };
          }
          const n = parseInt(answer.trim(), 10);
          if (isNaN(n)) {
            return { pass: false, msg: game.mt('stdin_stdout_stderr/02_stdin_redirection_multiplications', "That's not even a number!") };
          }
          if (n !== questions[i].r) {
            return { pass: false, msg: game.mt('stdin_stdout_stderr/02_stdin_redirection_multiplications', 'Too bad! The answer was $result...', { result: questions[i].r }) };
          }
          return { pass: true };
        },
      };
    },
    clean(game) {
      delete game.tmp.multiplications;
    },
  };

  // ---- stdin_stdout_stderr/03_stdout_redirection_inventory ----
  M['stdin_stdout_stderr/03_stdout_redirection_inventory'] = {
    name: '03_stdout_redirection_inventory',
    init(game) {
      const office = officePath(game);
      ensureDir(game, office);
      const grimoire = I18N.obj('grimoire');
      // remove old grimoires
      const officeNode = game.fs.getNode(office);
      for (const k in officeNode.children) {
        if (k.startsWith(grimoire + '_')) delete officeNode.children[k];
      }
      const names = [];
      for (let i = 0; i < 100; i++) {
        const name = grimoire + '_' + randInt(100000);
        game.fs.write(office + '/' + name, randomString(100) + '\n');
        if (randInt(2) === 0) {
          game.fs.chmod(office + '/' + name, '---r--r--');
        }
        names.push(name);
      }
      game.tmp.inventory = names.sort().join('\n');
    },
    check(game) {
      const office = officePath(game);
      const drawer = drawerPath(game);
      const inventoryFile = I18N.obj('inventory.txt');
      const node = game.fs.getNode(drawer + '/' + inventoryFile);
      if (!node || !node.isFile()) {
        return { pass: false, msg: game.mt('stdin_stdout_stderr/03_stdout_redirection_inventory', 'There is no $inventory_file in the drawer...', { inventory_file: inventoryFile }) };
      }
      const lines = node.content.split('\n').filter(l => l !== '').sort();
      const expected = (game.tmp.inventory || '').split('\n').filter(l => l !== '').sort();
      if (lines.join('\n') !== expected.join('\n')) {
        return { pass: false, msg: game.mt('stdin_stdout_stderr/03_stdout_redirection_inventory', 'The content of $inventory_file is invalid.\nYou can check its content with the command\n    $ less $inventory_file', { inventory_file: inventoryFile }) };
      }
      return { pass: true };
    },
    clean(game) {
      delete game.tmp.inventory;
    },
  };

  // ---- stdin_stdout_stderr/04_stderr_dev-null_grimoires ----
  M['stdin_stdout_stderr/04_stderr_dev-null_grimoires'] = {
    name: '04_stderr_dev-null_grimoires',
    init(game) {
      const office = officePath(game);
      ensureDir(game, office);
      const grimoire = I18N.obj('grimoire');
      const officeNode = game.fs.getNode(office);
      for (const k in officeNode.children) {
        if (k.startsWith(grimoire + '_')) delete officeNode.children[k];
      }
      const patterns = ['gsh', 'gsH', 'gSh', 'gSH', 'Gsh', 'GsH', 'GSh', 'GSH'];
      const matching = [];
      for (let i = 0; i < 100; i++) {
        const name = grimoire + '_' + randomString(8 + randInt(24));
        let content = randomString(100 + randInt(100)) + '\n';
        if (randInt(2) === 0) {
          // remove gsh (case insensitive) - won't match
          content = content.replace(/[gG][sS][hH]/g, '');
        } else {
          // insert a pattern
          const pattern = patterns[randInt(patterns.length)];
          const pos = randInt(content.length);
          content = content.slice(0, pos) + pattern + content.slice(pos);
          matching.push(name);
        }
        game.fs.write(office + '/' + name, content);
        if (randInt(2) === 0) {
          game.fs.chmod(office + '/' + name, '---------');
        }
      }
      // expected: readable grimoires containing gsh (case insensitive)
      const expected = matching.filter(name => {
        const node = game.fs.getNode(office + '/' + name);
        return node && node.ownerR();
      }).sort();
      game.tmp.gshGrimoires = expected.join('\n');
    },
    check(game) {
      const pc = game.shell.lastCommandLine;
      const firstWord = pc ? pc.trim().split(/\s+/)[0] : '';
      if (!pc || firstWord === 'gsh') {
        return { pass: false, msg: game.mt('stdin_stdout_stderr/04_stderr_dev-null_grimoires', "Your previous command doesn't use the 'grep' command...") };
      }
      if (!pc.includes('grep')) {
        return { pass: false, msg: game.mt('stdin_stdout_stderr/04_stderr_dev-null_grimoires', "Your previous command doesn't use the 'grep' command...") };
      }
      // replay with | sort, capturing stdout and stderr
      const result = game.shell.replay(pc + ' | sort');
      const expected = (game.tmp.gshGrimoires || '').split('\n').filter(l => l !== '').sort();
      const got = result.stdout.split('\n').filter(l => l !== '').sort();
      if (got.join('\n') !== expected.join('\n')) {
        return { pass: false, msg: game.mt('stdin_stdout_stderr/04_stderr_dev-null_grimoires', "Your command shouldn't generate error messages...") };
      }
      if (result.stderr.trim() !== '') {
        return { pass: false, msg: game.mt('stdin_stdout_stderr/04_stderr_dev-null_grimoires', "Your command shouldn't generate error messages...") };
      }
      return { pass: true };
    },
    clean(game) {
      delete game.tmp.gshGrimoires;
    },
  };

  // ---- stdin_stdout_stderr/05_stdout_stderr_redirection_merlin ----
  M['stdin_stdout_stderr/05_stdout_stderr_redirection_merlin'] = {
    name: '05_stdout_stderr_redirection_merlin',
    init(game) {
      const obs = observatoryPath(game);
      ensureDir(game, obs);
      const key = randomString(200);
      game.tmp.secretKey = key;
      // create the merlin executable
      const merlin = obs + '/merlin';
      game.fs.write(merlin, '#!/bin/sh\n# merlin\n');
      game.fs.getNode(merlin).executable = true;
      game.fs.chmod(merlin, 'rwxr-xr-x');
    },
    getSecretKey() {
      return game.tmp.secretKey || '';
    },
    check(game) {
      const secret = game.tmp.secretKey;
      if (!secret) return { pass: false };
      return {
        interactive: true,
        question: game.mt('stdin_stdout_stderr/05_stdout_stderr_redirection_merlin', 'What is the secret key?') + ' ',
        validate: (answer) => {
          if (answer.trim() !== secret) {
            return { pass: false, msg: game.mt('stdin_stdout_stderr/05_stdout_stderr_redirection_merlin', "That's not the correct key!") };
          }
          // check that a redirection was used (the player should have used < or >)
          const pc = game.shell.lastCommandLine || '';
          if (!/[<>]/.test(pc)) {
            return { pass: false, msg: game.mt('stdin_stdout_stderr/05_stdout_stderr_redirection_merlin', "That's correct, but you need to use a redirection to complete this mission!") };
          }
          return { pass: true };
        },
      };
    },
    clean(game) {
      delete game.tmp.secretKey;
    },
  };

  // ---- permissions/01_chmod_x_dir_king_quarter ----
  M['permissions/01_chmod_x_dir_king_quarter'] = {
    name: '01_chmod_x_dir_king_quarter',
    init(game) {
      const dir = kingsQuarterPath(game);
      ensureDir(game, dir);
      game.fs.chmod(dir, 'rw-r--r--'); // remove x
    },
    check(game) {
      const dir = kingsQuarterPath(game);
      if (game.fs.cwd === dir) return { pass: true };
      return { pass: false, msg: game.mt('permissions/01_chmod_x_dir_king_quarter', "You are not in the King's quarter!") };
    },
    clean(game) {
      const dir = kingsQuarterPath(game);
      if (game.fs.cwd === dir) game.fs.cwd = throneRoomPath(game);
      game.fs.chmod(dir, 'rwxr-xr-x');
    },
  };

  // ---- permissions/02_chmod_r_file_king_quarter ----
  M['permissions/02_chmod_r_file_king_quarter'] = {
    name: '02_chmod_r_file_king_quarter',
    init(game) {
      const dir = kingsQuarterPath(game);
      ensureDir(game, dir);
      game.fs.chmod(dir, 'rwxr-xr-x');
      const key = String(randInt(100000)) + String(randInt(100000));
      game.tmp.key = key;
      const secretNote = '.' + I18N.obj('secret_note');
      game.fs.write(dir + '/' + secretNote, key + '\n');
      game.fs.chmod(dir + '/' + secretNote, '---------');
      const note = I18N.obj('note');
      game.fs.write(dir + '/' + note, '0123456789\n');
    },
    check(game) {
      const key = game.tmp.key;
      if (!key) return { pass: false };
      return {
        interactive: true,
        question: game.mt('permissions/02_chmod_r_file_king_quarter', "What's the combination to open the King's safe?") + ' ',
        validate: (answer) => {
          if (answer.trim() === key) return { pass: true };
          return { pass: false, msg: game.mt('permissions/02_chmod_r_file_king_quarter', "That's not the real combination!") };
        },
      };
    },
    clean(game) {
      delete game.tmp.key;
    },
  };

  // ---- permissions/03_chmod_rw_file_dir_throne_room ----
  M['permissions/03_chmod_rw_file_dir_throne_room'] = {
    name: '03_chmod_rw_file_dir_throne_room',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const throne = throneRoomPath(game);
      ensureDir(game, throne);
      const safe = throne + '/' + I18N.obj('Safe');
      ensureDir(game, safe);
      const crown = I18N.obj('crown');
      const k = String(randInt(1000)).padStart(3, '0');
      const crownContent = artFor('crown') + '\n' + 'KEY:' + k;
      game.fs.write(safe + '/' + crown, crownContent);
      game.tmp.crownKey = k;
      game.tmp.crownContent = crownContent;
      // lock the safe and crown
      game.fs.chmod(safe + '/' + crown, '---------');
      game.fs.chmod(safe, '---------');
    },
    check(game) {
      const chest = chestPath(game);
      const crown = I18N.obj('crown');
      const node = game.fs.getNode(chest + '/' + crown);
      if (!node || !node.isFile()) {
        return { pass: false, msg: game.mt('permissions/03_chmod_rw_file_dir_throne_room', 'There is no crown in your chest!') };
      }
      if (!node.ownerR()) {
        return { pass: false, msg: game.mt('permissions/03_chmod_rw_file_dir_throne_room', 'The crown in your chest is not readable!') };
      }
      if (node.content !== (game.tmp.crownContent || '')) {
        return { pass: false, msg: game.mt('permissions/03_chmod_rw_file_dir_throne_room', 'The crown in your chest is a fake!') };
      }
      const realKey = game.tmp.crownKey;
      return {
        interactive: true,
        question: game.mt('permissions/03_chmod_rw_file_dir_throne_room', 'What are the 3 digits inscribed on the base of the crown?') + ' ',
        validate: (answer) => {
          if (answer.trim() === realKey) return { pass: true };
          return { pass: false, msg: game.mt('permissions/03_chmod_rw_file_dir_throne_room', 'Those digits are not correct!') };
        },
      };
    },
    clean(game) {
      const throne = throneRoomPath(game);
      const safe = throne + '/' + I18N.obj('Safe');
      if (game.fs.cwd === safe) game.fs.cwd = throne;
      game.fs.chmod(safe, 'rwxr-xr-x');
      const crown = I18N.obj('crown');
      if (game.fs.getNode(safe + '/' + crown)) {
        game.fs.chmod(safe + '/' + crown, 'rw-r--r--');
      }
      delete game.tmp.crownKey;
      delete game.tmp.crownContent;
    },
  };

  // ---- finding_files_maze/04_find_2 ----
  M['finding_files_maze/04_find_2'] = {
    name: '04_find_2',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const maze = mazePath(game);
      game.fs.rm(maze, { r: true, f: true });
      ensureDir(game, maze);
      const leaves = genMaze(game, maze, 3, 10, 6);
      const rubyDir = leaves[0];
      const R = randInt(100000);
      const ruby = I18N.obj('ruby');
      const stone = I18N.obj('stone');
      const sum = game.fs._hash(R + ' ' + ruby);
      game.fs.write(rubyDir + '/' + R, R + ' ' + ruby + ' ' + sum + '\n');
      game.tmp.rubyFile = String(R);
      game.tmp.rubyContent = R + ' ' + ruby + ' ' + sum + '\n';
      // decoy stones
      for (let i = 1; i < leaves.length; i++) {
        const R2 = randInt(100000);
        const sum2 = game.fs._hash(R2 + ' ' + stone);
        game.fs.write(leaves[i] + '/' + R2, R2 + ' ' + stone + ' ' + sum2 + '\n');
      }
    },
    check(game) {
      const maze = mazePath(game);
      const chest = chestPath(game);
      const ruby = I18N.obj('ruby');
      // count files in maze containing ruby
      let nbRuby = 0;
      const mazeNode = game.fs.getNode(maze);
      const _count = (node) => {
        for (const k in node.children) {
          const child = node.children[k];
          if (child.isDir()) _count(child);
          else if (child.content.includes(ruby)) nbRuby++;
        }
      };
      if (mazeNode) _count(mazeNode);
      if (nbRuby > 1) {
        return { pass: false, msg: game.mt('finding_files_maze/04_find_2', 'There are too many rubys in the maze!') };
      }
      if (nbRuby > 0) {
        return { pass: false, msg: game.mt('finding_files_maze/04_find_2', 'The ruby is still in the maze!') };
      }
      const filename = game.tmp.rubyFile;
      const chestNode = game.fs.getNode(chest);
      if (!chestNode || !chestNode.children[filename]) {
        return { pass: false, msg: game.mt('finding_files_maze/04_find_2', 'The ruby is not in the chest!') };
      }
      if (chestNode.children[filename].content !== (game.tmp.rubyContent || '')) {
        return { pass: false, msg: game.mt('finding_files_maze/04_find_2', 'The ruby in your chest is not valid!') };
      }
      return { pass: true };
    },
    clean(game) {
      game.fs.rm(mazePath(game), { r: true, f: true });
      ensureDir(game, mazePath(game));
      delete game.tmp.rubyFile;
      delete game.tmp.rubyContent;
    },
  };

  // ---- finding_files_maze/05_find_xargs_grep ----
  M['finding_files_maze/05_find_xargs_grep'] = {
    name: '05_find_xargs_grep',
    init(game) {
      const chest = chestPath(game);
      ensureDir(game, chest);
      const maze = mazePath(game);
      game.fs.rm(maze, { r: true, f: true });
      ensureDir(game, maze);
      const leaves = genMaze(game, maze, 3, 10, 1);
      const fileDir = leaves[0];
      const R = randomString(10);
      const diamond = I18N.obj('diamond');
      const sum = game.fs._hash(R + ' ' + diamond);
      game.fs.write(fileDir + '/' + R, R + ' ' + diamond + ' ' + sum + '\n');
      game.tmp.diamondFile = R;
      game.tmp.diamondContent = R + ' ' + diamond + ' ' + sum + '\n';
    },
    check(game) {
      const maze = mazePath(game);
      const chest = chestPath(game);
      const diamond = I18N.obj('diamond');
      let nbDiamond = 0;
      const mazeNode = game.fs.getNode(maze);
      const _count = (node) => {
        for (const k in node.children) {
          const child = node.children[k];
          if (child.isDir()) _count(child);
          else if (child.content.includes(diamond)) nbDiamond++;
        }
      };
      if (mazeNode) _count(mazeNode);
      if (nbDiamond > 1) {
        return { pass: false, msg: game.mt('finding_files_maze/05_find_xargs_grep', 'There are too many diamonds in the maze!') };
      }
      if (nbDiamond > 0) {
        return { pass: false, msg: game.mt('finding_files_maze/05_find_xargs_grep', 'The diamond is still in the maze.') };
      }
      const filename = game.tmp.diamondFile;
      const chestNode = game.fs.getNode(chest);
      if (!chestNode || !chestNode.children[filename]) {
        return { pass: false, msg: game.mt('finding_files_maze/05_find_xargs_grep', 'The diamond is not in the chest!') };
      }
      if (chestNode.children[filename].content !== (game.tmp.diamondContent || '')) {
        return { pass: false, msg: game.mt('finding_files_maze/05_find_xargs_grep', 'The diamond in your chest is not valid!') };
      }
      return { pass: true };
    },
    clean(game) {
      game.fs.rm(mazePath(game), { r: true, f: true });
      ensureDir(game, mazePath(game));
      delete game.tmp.diamondFile;
      delete game.tmp.diamondContent;
    },
  };

  // ---- pipes_merchant_stall/01_pipe_1 ----
  const FIRSTNAMES = ['Abdel','Adelaide','Adrien','Agnes','Alaric','Bernard','Cecile','David','Emma','Felix','Gabriel','Hugo','Ines','Julien','Karin','Lucas','Marie','Nicolas','Olivia','Paul','Quentin','Rachel','Simon','Therese','Ulrich','Victor','Wendy','Xavier','Yvonne','Zachary'];
  const LASTNAMES = ['Ageorges','Alamartine','Anglais','Aubernard','Boulanger','Cabrera','Chauvin','Coulomb','Coulon','Courtois','Duchesne','Fromentin','Langlois','Larsonneur','Legros','Lenain','Marchand','Messonnier','Metivier','Pelletier','Poudevigne','Rabier','Roux','Sarrazin'];
  const OBJECTS = ['a bag flour','a belt','a blanket','a bottle of cider','a chackal','a hen','a cow','a dented helm','a goat','a horse','a knife','a leather bag','a leather ball','a pick','a bar of soap','a pin','a ruby','a shiny pebble','a shovel','a stool','a wooden spoon','an apple','an opal','a walking stick'];
  const OBJECTS_FR = ['un sac de farine','une ceinture','une couverture','une bouteille de cidre','un chacal','une poule','une vache','un heaume cabosse','une chevre','un cheval','un couteau','une besace en cuir','une balle en cuir','un pic','un morceau de savon','une epingle','un rubis','un caillou brillant','une pelle','un tabouret','une cuillere en bois','une pomme','une opale','un baton de marche'];

  function genStall(game) {
    const stall = stallPath(game);
    ensureDir(game, stall);
    // clear stall
    const stallNode = game.fs.getNode(stall);
    for (const k in stallNode.children) delete stallNode.children[k];
    const lang = I18N.getLang();
    const objects = (lang === 'fr') ? OBJECTS_FR : OBJECTS;
    const king = I18N.obj('the King');
    const paid = I18N.obj('PAID');
    const boring = I18N.obj('boring_object');
    const scroll = I18N.obj('s_c_r_o_l_l');
    // boring objects
    for (let i = 0; i < 5000; i++) {
      const name = randomString(4 + randInt(8)) + '_' + boring + '_' + randomString(4 + randInt(8));
      game.fs.write(stall + '/' + name, '');
    }
    // transactions
    const nbTransactions = 9000 + randInt(2000);
    let nbKing = 8 + randInt(4);
    let nbKingPaid = Math.floor(nbKing / 2);
    let amountKing = 0;
    let nbUnpaid = 0;
    let lines = '';
    for (let i = 0; i < nbTransactions; i++) {
      const o = objects[randInt(objects.length)];
      const price = 2 + randInt(5);
      let name, p;
      if (randInt(nbTransactions - i) < nbKing) {
        name = king;
        if (randInt(nbKing) < nbKingPaid) {
          p = ' -- ' + paid + '.';
          nbKingPaid--;
        } else {
          p = '.';
          amountKing += price;
          nbUnpaid++;
        }
        nbKing--;
      } else {
        name = FIRSTNAMES[randInt(FIRSTNAMES.length)] + ' ' + LASTNAMES[randInt(LASTNAMES.length)];
        if (Math.random() < 0.995) {
          p = ' -- ' + paid + '.';
        } else {
          p = '.';
          nbUnpaid++;
        }
      }
      lines += name + ' ' + ((lang === 'fr') ? 'a acheté' : 'bought') + ' ' + o + ' ' + ((lang === 'fr') ? 'pour' : 'for') + ' ' + price + ' ' + ((lang === 'fr') ? 'piécettes' : 'coppers') + p + '\n';
    }
    game.fs.write(stall + '/' + scroll, lines);
    game.tmp.amountKing = amountKing;
    game.tmp.nbUnpaid = nbUnpaid;
    game.tmp.nbCommands = 0;
  }

  M['pipes_merchant_stall/01_pipe_1'] = {
    name: '01_pipe_1',
    init(game) {
      genStall(game);
    },
    check(game) {
      const amount = game.tmp.amountKing;
      if (amount === undefined) return { pass: false };
      return {
        interactive: true,
        question: game.mt('pipes_merchant_stall/01_pipe_1', 'How much does the king owe?') + ' ',
        validate: (answer) => {
          const n = parseInt(answer.trim(), 10);
          if (n !== amount) {
            return { pass: false, msg: game.mt('pipes_merchant_stall/01_pipe_1', "That's not the right answer!") };
          }
          if (game.tmp.nbCommands > 3) {
            return { pass: false, msg: game.mt('pipes_merchant_stall/01_pipe_1', "That's the right answer, but you used $nb_cmd commands!", { nb_cmd: game.tmp.nbCommands }) };
          }
          return { pass: true };
        },
      };
    },
    clean(game) {
      const stall = stallPath(game);
      const stallNode = game.fs.getNode(stall);
      if (stallNode) for (const k in stallNode.children) delete stallNode.children[k];
      delete game.tmp.amountKing;
      delete game.tmp.nbUnpaid;
      delete game.tmp.nbCommands;
    },
  };

  M['pipes_merchant_stall/02_pipe_2'] = {
    name: '02_pipe_2',
    init(game) {
      genStall(game);
    },
    check(game) {
      const nbUnpaid = game.tmp.nbUnpaid;
      if (nbUnpaid === undefined) return { pass: false };
      return {
        interactive: true,
        question: game.mt('pipes_merchant_stall/02_pipe_2', 'How many unpaid items are there?') + ' ',
        validate: (answer) => {
          const n = parseInt(answer.trim(), 10);
          if (n !== nbUnpaid) {
            return { pass: false, msg: game.mt('pipes_merchant_stall/02_pipe_2', "That's not the right answer!") };
          }
          if (game.tmp.nbCommands > 1) {
            return { pass: false, msg: game.mt('pipes_merchant_stall/02_pipe_2', "That's the right answer, but you used $nb_cmd commands!", { nb_cmd: game.tmp.nbCommands }) };
          }
          return { pass: true };
        },
      };
    },
    clean(game) {
      const stall = stallPath(game);
      const stallNode = game.fs.getNode(stall);
      if (stallNode) for (const k in stallNode.children) delete stallNode.children[k];
      delete game.tmp.amountKing;
      delete game.tmp.nbUnpaid;
      delete game.tmp.nbCommands;
    },
  };

  // ---- misc/03_tr_caesar_shift ----
  M['misc/03_tr_caesar_shift'] = {
    name: '03_tr_caesar_shift',
    init(game) {
      const drawer = drawerPath(game);
      ensureDir(game, drawer);
      const key = randomAlphaString(4);
      game.tmp.magicWord = key;
      const shift = 12 + randInt(3);
      const ab = 'abcdefghijklmnopqrstuvwxyz';
      const D = ab.slice(shift) + ab.slice(0, shift);
      const message = 'here is my will:\nyou will get my chest, and everything it contains.\nthis chest is in the cellar, and the word to make\nit re-appear is: ' + key + '\nmerlin the enchanter';
      // apply caesar shift
      let encrypted = '';
      for (const c of message) {
        const idx = ab.indexOf(c);
        if (idx >= 0) encrypted += D[idx];
        else encrypted += c;
      }
      const msgFile = I18N.obj('secret_message');
      game.fs.write(drawer + '/' + msgFile, encrypted + '\n');
    },
    check(game) {
      const key = game.tmp.magicWord;
      if (!key) return { pass: false };
      return {
        interactive: true,
        question: game.mt('misc/03_tr_caesar_shift', "What's the key that will make Merlin's chest to appear?") + ' ',
        validate: (answer) => {
          if (answer.trim().toLowerCase() === key) {
            // create Merlin's chest with treasures
            const office = officePath(game);
            const chest = office + '/' + I18N.obj('Merlin_s_chest');
            ensureDir(game, chest);
            makeSignedFile(game, chest + '/' + I18N.obj('medal'), artFor('medal'));
            makeSignedFile(game, chest + '/' + I18N.obj('bottle'), artFor('bottle'));
            game.fs.write(chest + '/' + I18N.obj('secret_recipe'), 'The secret recipe of the philosopher\'s stone.\n');
            return { pass: true };
          }
          return { pass: false, msg: game.mt('misc/03_tr_caesar_shift', "That's not the magic word.") };
        },
      };
    },
    clean(game) {
      delete game.tmp.magicWord;
    },
  };

  // ---- FINAL_MISSION ----
  M['FINAL_MISSION'] = {
    name: 'FINAL_MISSION',
    init(game) {
      game.tmp.finalShown = true;
    },
    goal(game) {
      return I18N.goalText('FINAL_MISSION');
    },
    check(game) {
      return { pass: false, msg: I18N.t('final_congrats') };
    },
    clean(game) {},
  };

  // ------------------------------------------------------------------
  // Export
  // ------------------------------------------------------------------
  window.MISSIONS = {
    order: MISSION_ORDER,
    missions: M,
    buildWorld,
    helpers: { P, chestPath, cellarPath, gardenPath, forestPath, greatHallPath, mazePath, cavePath, stallPath, libraryPath, officePath, drawerPath, throneRoomPath, kingsQuarterPath, observatoryPath, towerTopPath, firstFloorPath, ensureDir, makeSignedFile, artFor, randInt, randomString, randomAlphaString, randomAlphaNum, genMaze, installBook, bookPages },
  };
})();
