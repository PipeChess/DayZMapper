<?php

function parseLog($fileNameRequested) {
    $file = fopen("./logs/" . $fileNameRequested, "r");

    $log = [
        'title' => '',
        'log' => [],
        'players_online' => 0,
        'archive_files' => loadArchives(),
        'current_date_formatted' => date('l \t\h\e dS \o\f F, Y'),
        'current_date' => date('m/d/Y'),
        'player_list' => []
    ];

    while (!feof($file)) {
        $line = trim(fgets($file));
        if ($line != '' && strpos($line, '*********') === false && strpos($line, 'AdminLog started') === false && strpos($line, '#####') === false) {

            $logLines = explode(' | ', $line);

            //Retrieving Message, if null we ignore it
            $logType = getLogType($logLines[1]);
            $logMsg = cleanMsg($logLines[1]);
            $logPlayer = parsePlayer($logLines[1]);
            $logCoords = parseForCoordinates($logLines[1]);

            $logDate = $logLines[0];

            if ($logMsg) {
                $log['log'][] = [
                    'date' => $logDate,
                    'player' => $logPlayer,
                    'msg' => $logMsg,
                    'type' => $logType,
                    'coords' => $logCoords,
                    'raw' => $logLines[1]
                ];
                if ($logPlayer['id'] && $logPlayer['id'] !== 'Unknown') {
                    $log['player_list'][$logPlayer['name'] . " | uuid=(" . substr($logPlayer['id'], 0, 5) . ")"] = $logDate;
                }
            }
        } else if (strpos($line, '##### PlayerList log:')) {
            $nowHour = date('H');
            $nowMinute = date('i');

            $dateArray = explode(":", $logDate);
            $logHour = $dateArray[0];
            $logMinute = $dateArray[1];

            if (($nowHour == $logHour && ($nowMinute - $logMinute <= 10)) || (($nowHour == $logHour + 1) && ($logMinute >= 55 && $nowMinute < 5))) {
                $log['players_online'] = (int) substr($line, stripos($line, ": ") + 2, -8);
            }
        }
    }

    fclose($file);
    $log['log'] = array_reverse($log['log']);

    return $log;
}

function loadArchives() {
    $fileNames = [];
    foreach (glob("./logs/*.ADM") as $filename) {
        if ($filename !== "./logs/DayZServer_x64.ADM") {
            $tmpFileName = substr($filename, 7);
            $tmpDate = str_replace(".ADM", "", str_replace("DayZServer_x64_", "", $tmpFileName));
            $fileNames[] = [
                'file_name' => $tmpFileName,
                'date' => date('m/d/Y', strtotime(str_replace("_", "-", substr($tmpDate, 0, strrpos($tmpDate, "_")))) - 86400),
                'date_formatted' => date('l \t\h\e dS \o\f F, Y', strtotime(str_replace("_", "-", substr($tmpDate, 0, strrpos($tmpDate, "_")))) - 86400)
            ];
        }
    }
    $fileNames[] = [
        'file_name' => 'DayZServer_x64.ADM',
        'date' => date('m/d/Y'),
        'date_formatted' => date('l \t\h\e dS \o\f F, Y')
    ];

    return array_reverse($fileNames);
}

function getLogType($string) {
    $STATUS_DISCONNECT = [
        'status' => 'packed up his stuff and left the server.',
        'icon' => 'fa-sign-out-alt',
        'type' => 'disconnect'
    ];
    $STATUS_CONNECT = [
        'status' => 'connected',
        'icon' => 'fa-plug',
        'type' => 'connect'
    ];

    $STATUS_HIT_BY_INFECTED = [
        'status' => 'got attacked by a Zombie.',
        'icon' => 'fa-biohazard',
        'type' => 'attack_infected'
    ];
    $STATUS_HIT_BY_FALL = [
        'status' => 'fell and got hurt.',
        'icon' => 'fa-wind',
        'type' => 'fall'
    ];
    $STATUS_HIT_BY_FIREPLACE = [
        'status' => 'just got burned by the fireplace.',
        'icon' => 'fa-fire',
        'type' => 'burn_fireplace'
    ];
    $STATUS_HIT_BY_WOLF = [
        'status' => 'just got attacked by a wolf.',
        'icon' => 'fa-dog',
        'type' => 'attack_wolf'
    ];
    $STATUS_HIT_BY_BROWN_BEAR = [
        'status' => 'just got attacked by a brown bear.',
        'icon' => 'fa-paw',
        'type' => 'attack_brown_bear'
    ];
    $STATUS_HIT_BY_EXPLOSION = [
        'status' => 'was hurt by an explosion.',
        'icon' => 'fa-bomb',
        'type' => 'explosion'
    ];
    $STATUS_HIT_BY_PLAYER = [
        'status' => 'was hurt by a player.',
        'icon' => 'fa-people-arrows',
        'type' => 'attack_player'
    ];

    $STATUS_DIED = [
        'status' => 'has died. R.I.P.',
        'icon' => 'fa-skull-crossbones',
        'type' => 'death'
    ];
    $STATUS_KILLED = [
        'status' => 'just got killed. There is a murderer on the loose!',
        'icon' => 'fa-skull',
        'type' => 'kill'
    ];

    $STATUS_UNCONSCIOUS = [
        'status' => 'is unconscious.',
        'icon' => 'fa-bed',
        'type' => 'unconscious'
    ];
    $STATUS_CONSCIOUS = [
        'status' => 'is conscious again.',
        'icon' => 'fa-smile-beam',
        'type' => 'conscious'
    ];

    $STATUS_UPDATE = [
        'status' => 'location just updated',
        'icon' => 'fa-sun',
        'type' => 'update'
    ];

    if (stristr($string, 'has been disconnected')) {
        return $STATUS_DISCONNECT;
    } else if (stristr($string, 'is connected')) {
        return $STATUS_CONNECT;
    } else if (stristr($string, 'hit by Infected into')) {
        return $STATUS_HIT_BY_INFECTED;
    } else if (stristr($string, 'hit by FallDamage')) {
        return $STATUS_HIT_BY_FALL;
    } else if (stristr($string, ') died. Stats')) {
        return $STATUS_DIED;
    } else if (stristr($string, ') killed by')) {
        return $STATUS_KILLED;
    } else if (stristr($string, 'is unconscious')) {
        return $STATUS_UNCONSCIOUS;
    } else if (stristr($string, 'regained consciousness')) {
        return $STATUS_CONSCIOUS;
    } else if (stristr($string, 'hit by Fireplace')) {
        return $STATUS_HIT_BY_FIREPLACE;
    } else if (stristr($string, 'hit by wolf')) {
        return $STATUS_HIT_BY_WOLF;
    } else if (stristr($string, 'hit by Brown Bear')) {
        return $STATUS_HIT_BY_BROWN_BEAR;
    } else if (stristr($string, 'hit by explosion')) {
        return $STATUS_HIT_BY_EXPLOSION;
    } else if (stristr($string, 'hit by Player')) {
        return $STATUS_HIT_BY_PLAYER;
    } else {
        return $STATUS_UPDATE;
    }
}

function cleanMsg($string) {
    $player = parsePlayer($string);
    $type = getLogType($string);
    if ($player) {

        return $type['status'];
    } else {
        return null;
    }
}

function parsePlayer($string) {
    $player = [];
    
    $colorCodes = [
        '#900C3F',
        '#C70039',
        '#FF5733',
        '#FFC300',
        '#58D68D',
        '#34495E',
        '#58D68D',
        '#616A6B',
        '#F39C12',
        '#C70039',
        '#17A589',
        '#5499C7',
        '#F39C12',
        '#5499C7',
        '#BB8FCE',
        '#F7DC6F',
        '#283c7d',
        '#287d69',
    ];
    $matches = [];
    preg_match('/Player "[A-Za-z0-9]+"/', $string, $matches);

    if (!isset($matches[0])) {
        return null;
    }

    $playerTmp = substr($matches[0], strpos($matches[0], "Player \"") + 8);
    $playerName = substr($playerTmp, 0, strpos($playerTmp, "\""));

    $player['name'] = $playerName;
    
//    ((int)substr(bin2hex($text), 0, 6))%16;
    $matches = [];
    preg_match('/Player "[A-Za-z0-9\ \(\)\"]+\(id=/', $string, $matches);

    if (!isset($matches[0])) {
        $playerID = '';
    } else {
        $playerTmp = substr($string, (strpos($matches[0], "id=") + 3));
        $playerID = substr($playerTmp, 0, strpos($playerTmp, "="));
    }

    $player['id'] = $playerID;
    $player['uuid'] = substr($playerID, 0, 5);
    $player['color'] = $colorCodes[((int)substr(bin2hex($playerID), 0, 6))%18];

    return $player;
}

function parseForCoordinates($string) {
    $pos = strpos($string, 'pos=<');
    $pos2 = strpos($string, '>)');

    if ($pos && $pos2) {
        $coordsString = substr($string, ($pos + 5), $pos2 - ($pos + 5));
        return explode(", ", $coordsString);
    }

    return [];
}
