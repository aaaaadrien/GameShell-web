// i18n for GameShell web edition.
// Language is auto-detected from the browser (fr if navigator.language starts
// with "fr", otherwise en). Can be switched with the button in the top bar.

(function () {
  'use strict';

  const GAME_STRINGS = {
    en: {
      welcome:
`Welcome to GameShell!

Using and administering a computer running a Unix-like operating
system (e.g., Linux, BSD or macOS) requires using a command line
interface called "shell". In this game you will learn how to use
the shell by journeying through various missions that will teach
you to perform standard tasks such as:
  - creating directories,
  - creating, viewing and editing files,
  - searching for files satisfying certain criteria,
  - running and interrupting programs,
  - etc.

During your adventure you will need to visit locations, interact
with people, and find various objects. However, you have to keep
in mind that these are standard directories, programs, and files
(often with random contents). So, for example:
  - "build a hut" means creating a directory called "Hut", and
  - "put a coin in your chest" means moving a file called "coin"
    to a directory called "Chest".`,

      init_msg:
`Run the command
    $ gsh goal
to discover your first mission.

You can check the mission has been completed with
    $ gsh check

The command
    $ gsh help
displays the list of available (gsh) commands.`,

      gsh_help:
`Commands specific to GameShell
==============================

gsh check
  check whether the current mission's goal has been
  achieved or not

gsh exit
  quit GameShell
  Note that you can exit GameShell using Control-d as well

gsh goal [N]
  show the current mission's goal
  if N is given, show the goal for mission N

gsh help
  short help message

gsh reset
  reset the current mission`,

      gsh_full_help:
`Full list of GameShell commands
===============================

Player commands
---------------

gsh check
  check whether the current mission's goal has been
  achieved or not

gsh exit
  quit GameShell

gsh goal [N]
  show the current mission's goal
  if N is given, show the goal for mission N

gsh help
  short help message

gsh reset
  reset the current mission

gsh skip
  give up on the current mission and go to the next one

gsh goto [N]
  directly go to mission N

Additional commands
-------------------

gsh index
  show list of missions, with their status

gsh stat
  display simple statistics about completed missions

gsh version
  show GameShell's version

gsh welcome
  show the welcome message

gsh HELP
  this message`,

      mission_passed: 'Congratulations, mission $nb has been successfully completed!',
      mission_failed: 'Mission $nb has not been completed yet.',
      mission_reset: 'Mission $nb has been reset.',
      mission_skipped: 'Mission $nb has been skipped.',
      mission_goto: 'Going to mission $nb...',
      no_mission: 'There is no mission $nb.',
      you_are_at: 'You are at the top of the tower!',
      index_title: 'Mission index',
      index_done: '[done]',
      index_current: '[current]',
      index_todo: '[todo]',
      stat_title: 'Game statistics',
      stat_missions: 'Missions completed: $done / $total',
      stat_time: 'Time played: $time',
      version: 'GameShell web edition 1.0',
      exit_msg: 'Goodbye! Your progress has been saved.',
      goal_title: 'Mission $nb',
      goal_unknown: 'Unknown mission.',
      cmd_not_found: "$cmd: command not found",
      permission_denied: 'Permission denied',
      is_a_directory: 'Is a directory',
      no_such_file: 'No such file or directory',
      not_a_directory: 'Not a directory',
      file_exists: 'File exists',
      invalid_number: 'invalid number',
      jobs_msg: '[1]+  Running                 $cmd &',
      jobs_done: '[1]   Done                    $cmd',
      jobs_stopped: '[1]+  Stopped                 $cmd',
      kill_no_proc: 'No such process',
      interrupt_msg: '^C',
      clear_screen: '',
      tab_no_completion: '',
      tab_multiple: 'Possible completions:',
      nano_saved: '[ File Name: $file ]',
      nano_wrote: '[ Wrote $n character(s) ]',
      pager_quit: 'Press q to quit, space to scroll, / to search',
      man_not_found: 'No manual entry for $cmd',
      man_title: 'Manual page: $cmd',
      cal_title: 'Calendar',
      prompt_user: 'player',
      prompt_host: 'castle',
      status_mission: 'Mission $nb / $total',
      status_lang: 'Language: $lang',
      reset_confirm: 'The mission will be reset. Continue?',
      lang_en: 'English',
      lang_fr: 'Français',
      goal_shown: '(use gsh goal to show the mission goal again)',
      final_congrats: 'CONGRATULATIONS! You have finished all the missions!',
      gsh_check_prompt: 'gsh check',
      read_prompt: '',
      too_many_args: 'too many arguments',
      missing_arg: 'missing argument',
      usage: 'Usage: $usage',
      invalid_option: 'invalid option: $opt',
      ps_header: '  PID TTY          TIME CMD',
      pstree_shell: 'shell',
      flarigo_msg: '*  *  *  *  *',
      charmiglio_msg: 'The magical reaction starts...',
      charmiglio_fail: 'The reaction fizzles out... (wrong incantation)',
      charmiglio_ok: 'BOOM! A magnificent fireworks display!',
      xeyes_msg: 'xeyes is not available in the web edition.',
      date_msg: '',
      echo_no_newline: '',
      wc_lines: 'lines',
      wc_words: 'words',
      wc_chars: 'bytes',
      find_no_match: '',
      grep_no_match: '',
      sort_usage: '',
      tr_usage: 'Usage: tr SET1 [SET2]',
      head_usage: 'Usage: head [-n K] [FILE...]',
      tail_usage: 'Usage: tail [-n K] [FILE...]',
      cat_usage: 'Usage: cat [FILE...]',
      mkdir_usage: 'Usage: mkdir DIRECTORY...',
      rm_usage: 'Usage: rm [OPTION...] FILE...',
      mv_usage: 'Usage: mv SOURCE... DESTINATION',
      cp_usage: 'Usage: cp SOURCE... DESTINATION',
      chmod_usage: 'Usage: chmod MODE FILE...',
      kill_usage: 'Usage: kill [OPTION] PID...',
      ps_usage: 'Usage: ps [OPTION...]',
      pstree_usage: 'Usage: pstree [PID]',
      cal_usage: 'Usage: cal [MONTH [YEAR]]',
      nano_usage: 'Usage: nano FILE',
      alias_usage: 'Usage: alias [NAME[=VALUE]...]',
      unalias_usage: 'Usage: unalias NAME...',
      grep_usage: 'Usage: grep [OPTION...] PATTERN [FILE...]',
      wc_usage: 'Usage: wc [FILE...]',
      sort_usage2: 'Usage: sort [FILE...]',
      xargs_usage: 'Usage: xargs COMMAND [ARG...]',
      tr_usage2: 'Usage: tr SET1 [SET2]',
      man_usage: 'Usage: man COMMAND',
      less_usage: 'Usage: less FILE',
      date_usage: 'Usage: date [OPTION...]',
      touch_usage: 'Usage: touch FILE...',
      tree_usage: 'Usage: tree [DIRECTORY]',
      find_usage: 'Usage: find [PATH] [EXPRESSION]',
      jobs_usage: 'Usage: jobs',
      history_usage: 'Usage: history [N]',
      clear_usage: 'Usage: clear',
      pwd_usage: 'Usage: pwd',
      cd_usage: 'Usage: cd [DIRECTORY]',
      gsh_usage: 'Usage: gsh COMMAND [ARG...]',
      exit_usage: 'Usage: exit',
      read_line: '',
      signal_term: 'Terminated',
      signal_kill: 'Killed',
      signal_int: 'Interrupt',
      bg_started: '[1] $pid',
      fg_msg: 'bringing to foreground',
      wait_msg: 'waiting...',
      process_done: 'Process $pid finished.',
      process_stopped: 'Process $pid stopped.',
      process_killed: 'Process $pid killed.',
      no_jobs: 'No jobs running.',
      jobs_list: '',
      ctrl_c: '^C',
      ctrl_d: '',
      ctrl_l: '',
      ctrl_z: '^Z',
      stopped_jobs: 'There are stopped jobs in your session.',
      continue_msg: 'Continuing...',
      bg_msg: 'Backgrounding...',
      fg_msg2: 'Foregrounding...',
      kill_msg: 'Killing process $pid...',
      kill_failed: 'Cannot kill process $pid.',
      kill_ok: 'Process $pid terminated.',
      ps_no_proc: 'No processes.',
      pstree_no_proc: 'No such process.',
      chmod_invalid: 'Invalid mode: $mode',
      chmod_ok: '',
    },
    fr: {
      welcome:
`Bienvenue dans GameShell !

Utiliser et gérer un ordinateur avec un système d'exploitation
de type Unix (comme Linux, BSD ou macOS) demande l'utilisation
d'une interface en ligne de commande appelée "shell". Dans ce
jeu vous allez apprendre à utiliser le shell au travers de
diverses missions impliquant des tâches habituelles comme :
  - créer des répertoires,
  - créer, éditer ou visualiser des fichiers,
  - chercher les fichiers satisfaisant certains critères,
  - lancer ou arrêter des programmes,
  - etc.

Durant votre aventure il vous sera demandé de vous rendre dans
des lieux, d'interagir avec des personnages, et de trouver des
objets. Cependant, gardez à l'esprit que tous ces éléments du
jeu font référence à des concepts standards : des répertoires,
des programmes, et des fichiers (avec un contenu qui peut être
aléatoire). Ainsi, par exemple :
  - "construire une hutte" signifie créer un dossier "Hutte",
  - "mettre la pièce dans le coffre" signifie déplacer un
    fichier "piece" dans un répertoire "Coffre".`,

      init_msg:
`Utilisez la commande
  $ gsh goal
pour découvrir votre première mission.

Vous pouvez vérifier si l'objectif est atteint avec
  $ gsh check

La commande
  $ gsh help
affiche la liste des commandes (gsh) disponibles.`,

      gsh_help:
`Commandes GameShell standard
============================

gsh check
  vérifie que l'objectif de la mission en cours est atteint

gsh exit
  quitte (et sauvegarde) la partie en cours
  vous pouvez également quitter avec Contrôle-d

gsh goal [N]
  affiche l'objectif de la mission en cours
  si N est donné, affiche l'objectif de la mission N

gsh help
  affiche un petit message d'aide

gsh reset
  ré-initialise la mission en cours`,

      gsh_full_help:
`Liste complète des commandes GameShell
=======================================

Commandes du joueur
-------------------

gsh check
  vérifie que l'objectif de la mission en cours est atteint

gsh exit
  quitte (et sauvegarde) la partie en cours

gsh goal [N]
  affiche l'objectif de la mission en cours
  si N est donné, affiche l'objectif de la mission N

gsh help
  affiche un petit message d'aide

gsh reset
  ré-initialise la mission en cours

gsh skip
  abandonne la mission en cours et passe à la suivante

gsh goto [N]
  va directement à la mission N

Commandes supplémentaires
-------------------------

gsh index
  affiche la liste des missions avec leur statut

gsh stat
  affiche des statistiques simples sur les missions terminées

gsh version
  affiche la version de GameShell

gsh welcome
  affiche le message de bienvenue

gsh HELP
  ce message`,

      mission_passed: 'Bravo, vous avez réussi la mission $nb !',
      mission_failed: 'La mission $nb n\'a pas encore été accomplie.',
      mission_reset: 'La mission $nb a été réinitialisée.',
      mission_skipped: 'La mission $nb a été sautée.',
      mission_goto: 'Aller à la mission $nb...',
      no_mission: 'Il n\'y a pas de mission $nb.',
      you_are_at: 'Vous êtes en haut du donjon !',
      index_title: 'Index des missions',
      index_done: '[fait]',
      index_current: '[en cours]',
      index_todo: '[à faire]',
      stat_title: 'Statistiques du jeu',
      stat_missions: 'Missions terminées : $done / $total',
      stat_time: 'Temps de jeu : $time',
      version: 'GameShell édition web 1.0',
      exit_msg: 'Au revoir ! Votre progression a été sauvegardée.',
      goal_title: 'Mission $nb',
      goal_unknown: 'Mission inconnue.',
      cmd_not_found: "$cmd: commande introuvable",
      permission_denied: 'Permission refusée',
      is_a_directory: 'Est un répertoire',
      no_such_file: 'Aucun fichier ou répertoire de ce nom',
      not_a_directory: 'N\'est pas un répertoire',
      file_exists: 'Le fichier existe déjà',
      invalid_number: 'nombre invalide',
      jobs_msg: '[1]+  En cours                $cmd &',
      jobs_done: '[1]   Terminé                 $cmd',
      jobs_stopped: '[1]+  Suspendu                $cmd',
      kill_no_proc: 'Aucun processus',
      interrupt_msg: '^C',
      clear_screen: '',
      tab_no_completion: '',
      tab_multiple: 'Complétions possibles :',
      nano_saved: '[ Nom du fichier : $file ]',
      nano_wrote: '[ $n caractère(s) écrit(s) ]',
      pager_quit: 'Appuyez sur q pour quitter, espace pour défiler, / pour chercher',
      man_not_found: 'Pas de page de manuel pour $cmd',
      man_title: 'Page de manuel : $cmd',
      cal_title: 'Calendrier',
      prompt_user: 'joueur',
      prompt_host: 'chateau',
      status_mission: 'Mission $nb / $total',
      status_lang: 'Langue : $lang',
      reset_confirm: 'La mission sera réinitialisée. Continuer ?',
      lang_en: 'English',
      lang_fr: 'Français',
      goal_shown: '(utilisez gsh goal pour afficher à nouveau l\'objectif)',
      final_congrats: 'BRAVO ! Vous avez terminé toutes les missions !',
      gsh_check_prompt: 'gsh check',
      read_prompt: '',
      too_many_args: 'trop d\'arguments',
      missing_arg: 'argument manquant',
      usage: 'Usage : $usage',
      invalid_option: 'option invalide : $opt',
      ps_header: '  PID TTY          TIME CMD',
      pstree_shell: 'shell',
      flarigo_msg: '*  *  *  *  *',
      charmiglio_msg: 'La réaction magique commence...',
      charmiglio_fail: 'La réaction s\'éteint... (incantation incorrecte)',
      charmiglio_ok: 'BOUM ! Un magnifique feu d\'artifice !',
      xeyes_msg: 'xeyes n\'est pas disponible dans l\'édition web.',
      date_msg: '',
      echo_no_newline: '',
      wc_lines: 'lignes',
      wc_words: 'mots',
      wc_chars: 'octets',
      find_no_match: '',
      grep_no_match: '',
      sort_usage: '',
      tr_usage: 'Usage : tr ENSEMBLE1 [ENSEMBLE2]',
      head_usage: 'Usage : head [-n K] [FICHIER...]',
      tail_usage: 'Usage : tail [-n K] [FICHIER...]',
      cat_usage: 'Usage : cat [FICHIER...]',
      mkdir_usage: 'Usage : mkdir REPERTOIRE...',
      rm_usage: 'Usage : rm [OPTION...] FICHIER...',
      mv_usage: 'Usage : mv SOURCE... DESTINATION',
      cp_usage: 'Usage : cp SOURCE... DESTINATION',
      chmod_usage: 'Usage : chmod MODE FICHIER...',
      kill_usage: 'Usage : kill [OPTION] PID...',
      ps_usage: 'Usage : ps [OPTION...]',
      pstree_usage: 'Usage : pstree [PID]',
      cal_usage: 'Usage : cal [MOIS [ANNEE]]',
      nano_usage: 'Usage : nano FICHIER',
      alias_usage: 'Usage : alias [NOM[=VALEUR]...]',
      unalias_usage: 'Usage : unalias NOM...',
      grep_usage: 'Usage : grep [OPTION...] CHAINE [FICHIER...]',
      wc_usage: 'Usage : wc [FICHIER...]',
      sort_usage2: 'Usage : sort [FICHIER...]',
      xargs_usage: 'Usage : xargs COMMANDE [ARG...]',
      tr_usage2: 'Usage : tr ENSEMBLE1 [ENSEMBLE2]',
      man_usage: 'Usage : man COMMANDE',
      less_usage: 'Usage : less FICHIER',
      date_usage: 'Usage : date [OPTION...]',
      touch_usage: 'Usage : touch FICHIER...',
      tree_usage: 'Usage : tree [REPERTOIRE]',
      find_usage: 'Usage : find [CHEMIN] [EXPRESSION]',
      jobs_usage: 'Usage : jobs',
      history_usage: 'Usage : history [N]',
      clear_usage: 'Usage : clear',
      pwd_usage: 'Usage : pwd',
      cd_usage: 'Usage : cd [REPERTOIRE]',
      gsh_usage: 'Usage : gsh COMMANDE [ARG...]',
      exit_usage: 'Usage : exit',
      read_line: '',
      signal_term: 'Terminé',
      signal_kill: 'Tué',
      signal_int: 'Interrompu',
      bg_started: '[1] $pid',
      fg_msg: 'ramener au premier plan',
      wait_msg: 'en attente...',
      process_done: 'Processus $pid terminé.',
      process_stopped: 'Processus $pid suspendu.',
      process_killed: 'Processus $pid tué.',
      no_jobs: 'Aucun processus en cours.',
      jobs_list: '',
      ctrl_c: '^C',
      ctrl_d: '',
      ctrl_l: '',
      ctrl_z: '^Z',
      stopped_jobs: 'Il y a des processus suspendus dans votre session.',
      continue_msg: 'Continuer...',
      bg_msg: 'Mettre en arrière-plan...',
      fg_msg2: 'Ramener au premier plan...',
      kill_msg: 'Tuer le processus $pid...',
      kill_failed: 'Impossible de tuer le processus $pid.',
      kill_ok: 'Processus $pid terminé.',
      ps_no_proc: 'Aucun processus.',
      pstree_no_proc: 'Aucun processus.',
      chmod_invalid: 'Mode invalide : $mode',
      chmod_ok: '',
    }
  };

  // object names: English -> French
  const OBJ_NAMES = {
    en: {},
    fr: {
      'Castle': 'Chateau',
      'Main_tower': 'Donjon',
      'First_floor': 'Premier_etage',
      'Second_floor': 'Deuxieme_etage',
      'Top_of_the_tower': 'Haut_du_donjon',
      'Cellar': 'Cave',
      'Main_building': 'Batiment_principal',
      'Throne_room': 'Salle_du_trone',
      'Forest': 'Foret',
      'Hut': 'Hutte',
      'Chest': 'Coffre',
      'Garden': 'Jardin',
      'spider': 'araignee',
      'bat': 'chauve_souris',
      'coin': 'piece',
      'chest': 'coffre',
      'hut': 'hutte',
      'barrel_of_apples': 'tonneau_de_pommes',
      'Great_hall': 'Grande_salle',
      'standard': 'etendard',
      'decorative_shield': 'bouclier_decoratif',
      'stag_head': 'tete_de_cerf',
      'suit_of_armour': 'armure',
      'tapestry': 'tapisserie',
      'painting': 'tableau',
      'Maze': 'Labyrinthe',
      'Flower_garden': 'Jardin_des_fleurs',
      'Shed': 'Cabanon',
      'bucket': 'seau',
      'flowers': 'fleurs',
      'wheelbarrow': 'brouette',
      'copper_coin': 'piece_de_bronze',
      'silver_coin': 'piece_d_argent',
      'gold_coin': 'piece_d_or',
      'GolD_CoiN': 'PieCe_D_oR',
      'ruby': 'rubis',
      'stone': 'cailloux',
      'diamond': 'diamant',
      'nice_rock': 'joli_caillou',
      'journal': 'journal',
      'Lair_of_the_spider_queen': 'Taniere_de_la_reine_araignee',
      'spider_queen': 'reine_araignee',
      'baby_bat': 'bebe_chauve_souris',
      'flarigo': 'flarigo',
      'charmiglio': 'charmiglio',
      'xeyes': 'xeyes',
      'Kings_quarter': 'Chambre_du_roi',
      'secret_note': 'bout_de_papier_secret',
      'note': 'bout_de_papier',
      'Safe': 'Coffre_fort',
      'crown': 'couronne',
      'Mountain': 'Montagne',
      'Cave': 'Grotte',
      'Book_of_potions': 'Livre_de_potions',
      'cauldron': 'chaudron',
      'page': 'page',
      'table_of_contents': 'table_des_matieres',
      'Stall': 'Echoppe',
      'the King': 'le Roi',
      'boring_object': 'objet_sans_interet',
      's_c_r_o_l_l': 'p_a_r_c_h_e_m_i_n',
      'PAID': 'PAYÉ',
      'spell': 'sortilege',
      'nice_fairy': 'gentille_fee',
      'mischievous_imp': 'lutin_espiegle',
      'coal': 'charbon',
      'snowflake': 'flocon_de_neige',
      'Library': 'Bibliotheque',
      'Merlin_s_office': 'Bureau_de_Merlin',
      'Drawer': 'Tiroir',
      'grimoire': 'grimoire',
      'inventory.txt': 'inventaire.txt',
      'candle': 'bougie',
      'Greek_Latin_and_other_modern_languages': 'Grec_Latin_et_autres_langues_modernes',
      'How_to_cheat_for_exams': 'Comment_tricher_aux_examens',
      'Mathematics_101': 'Mathematiques_en_premiere_annee',
      'Observatory': 'Observatoire',
      'star_chart': 'carte_du_ciel',
      'Merlin_s_chest': 'Coffre_de_Merlin',
      'bottle': 'flacon',
      'ink_and_scroll': 'encre_et_parchemin',
      'medal': 'medaille',
      'secret_message': 'message_secret',
      'secret_recipe': 'recette_secrete',
      'qwerty': 'azerty',
      'servillus': 'servillus',
    }
  };

  let lang = 'en';

  function detectLang() {
    const nav = (navigator.language || 'en').toLowerCase();
    return nav.startsWith('fr') ? 'fr' : 'en';
  }

  function setLang(l) {
    if (l === 'fr' || l === 'en') lang = l;
  }

  function getLang() {
    return lang;
  }

  // translate a game string
  function t(key, vars) {
    let s = (GAME_STRINGS[lang] && GAME_STRINGS[lang][key] !== undefined)
      ? GAME_STRINGS[lang][key]
      : (GAME_STRINGS.en[key] !== undefined ? GAME_STRINGS.en[key] : key);
    if (vars) {
      for (const k in vars) {
        s = s.split('$' + k).join(vars[k]);
      }
    }
    return s;
  }

  // translate an object name (for file/dir names)
  function obj(name) {
    if (lang === 'fr' && OBJ_NAMES.fr[name] !== undefined) {
      return OBJ_NAMES.fr[name];
    }
    return name;
  }

  // translate a mission-specific string (from the fr.po dictionaries)
  function mt(missionDir, key, vars) {
    let s = key;
    if (lang === 'fr' && window.GOALS_DATA && GOALS_DATA.trans[missionDir]
        && GOALS_DATA.trans[missionDir][key] !== undefined) {
      s = GOALS_DATA.trans[missionDir][key];
    }
    if (vars) {
      for (const k in vars) {
        s = s.split('$' + k).join(vars[k]);
      }
    }
    return s;
  }

  // get the goal text for a mission
  function goalText(missionDir, l) {
    l = l || lang;
    if (window.GOALS_DATA && GOALS_DATA.goals[missionDir]) {
      const g = GOALS_DATA.goals[missionDir];
      if (g[l] !== undefined) return g[l];
      if (g.en !== undefined) return g.en;
    }
    return '';
  }

  window.I18N = { t, obj, mt, goalText, setLang, getLang, detectLang, GAME_STRINGS, OBJ_NAMES };
})();
