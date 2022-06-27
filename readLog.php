<?php

require_once 'functions.php';

$fileNameRequested = isset($_POST['log_file']) && !empty($_POST['log_file']) ? $_POST['log_file'] : 'DayZServer_x64.ADM';

header('Content-Type: application/json');
echo json_encode(parseLog($fileNameRequested));
