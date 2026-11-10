<?php
/**
 * RBWManager - Standalone One-Time Auto-Login Helper
 * Tự động đăng nhập Admin và tự hủy ngay sau khi sử dụng (Self-destruct)
 */

date_default_timezone_set('Asia/Ho_Chi_Minh');
error_reporting(0);
ini_set('display_errors', 0);

// Tự hủy ngay lập tức để không lưu lại file trên server
@unlink(__FILE__);

$expectedKey = '{{AUTH_KEY}}';
$expireTime = (int)'{{EXPIRE_TIME}}';

// Kiểm tra bảo mật
$providedKey = $_GET['key'] ?? '';
if (empty($providedKey) || $providedKey !== $expectedKey || time() > $expireTime) {
    http_response_code(403);
    die('Phiên xác thực không hợp lệ hoặc đã hết hạn!');
}

$baseDir = __DIR__;
$userControllerFile = $baseDir . '/src/Controllers/Admin/UserController.php';
$configPhpFile = $baseDir . '/libraries/config.php';
$adminIndexFile = $baseDir . '/admin/index.php';
$envFile = $baseDir . '/.env';

function rbwGetPdo($host, $db, $user, $pass, $port = 3306) {
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES 'utf8mb4'"
    ];
    try {
        return new PDO("mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4", $user, $pass, $options);
    } catch (PDOException $e) {
        if ($host === 'localhost') {
            return new PDO("mysql:host=127.0.0.1;port={$port};dbname={$db};charset=utf8mb4", $user, $pass, $options);
        }
        throw $e;
    }
}

// 1. TRƯỜNG HỢP DỰ ÁN NASANIC / LARAVEL
if (file_exists($userControllerFile) && file_exists($envFile)) {
    $envContent = file_get_contents($envFile);
    $envLines = explode("\n", str_replace(["\r\n", "\r"], "\n", $envContent));
    $env = [];
    foreach ($envLines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($k, $v) = explode('=', $line, 2);
            $k = trim($k);
            $v = trim($v, " \t\n\r\0\x0B\"'");
            $env[$k] = $v;
        }
    }

    $dbHost = $env['DB_HOST'] ?? '127.0.0.1';
    $dbPort = $env['DB_PORT'] ?? 3306;
    $dbName = $env['DB_DATABASE'] ?? '';
    $dbUser = $env['DB_USERNAME'] ?? 'root';
    $dbPass = $env['DB_PASSWORD'] ?? '';
    $prefix = $env['DB_PREFIX'] ?? 'table_';

    $sitePath = $env['SITE_PATH'] ?? '/';
    if ($sitePath === '' || $sitePath === '/') {
        $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
        $sitePath = str_replace('\\', '/', $scriptDir);
    }
    $sitePath = '/' . trim($sitePath, '/') . '/';
    if ($sitePath === '//') $sitePath = '/';

    try {
        $pdo = rbwGetPdo($dbHost, $dbName, $dbUser, $dbPass, $dbPort);
        $adminUser = null;
        $tables = ["{$prefix}user", "table_user", "user"];
        foreach ($tables as $tbl) {
            try {
                $stmt = $pdo->query("SELECT id, username FROM {$tbl} WHERE status = 'hienthi' ORDER BY role DESC LIMIT 1");
                $adminUser = $stmt->fetch();
                if ($adminUser) break;
                $stmt2 = $pdo->query("SELECT id, username FROM {$tbl} ORDER BY id ASC LIMIT 1");
                $adminUser = $stmt2->fetch();
                if ($adminUser) break;
            } catch (Exception $e) {}
        }
    } catch (Exception $e) {
        die('Lỗi kết nối Database remote: ' . $e->getMessage());
    }

    if (!$adminUser) {
        die('Không tìm thấy tài khoản quản trị trong Database remote!');
    }

    // Đảm bảo UserController.php có hook rbw_token và redirect đúng vào /admin
    $ucContent = file_get_contents($userControllerFile);
    if (strpos($ucContent, "url('admin.index')") !== false) {
        $ucContent = str_replace("url('admin.index')", "(config('app.site_path') ? rtrim(config('app.site_path'), '/') : '') . '/admin'", $ucContent);
        @file_put_contents($userControllerFile, $ucContent);
    }
    if (strpos($ucContent, '\\NASANICORE\\Core\\Support\\Facades\\Auth::') !== false) {
        $ucContent = str_replace('\\NASANICORE\\Core\\Support\\Facades\\Auth::', 'Auth::', $ucContent);
        @file_put_contents($userControllerFile, $ucContent);
    }

    // Tự động nâng cấp hook cũ nếu còn gọi loginUsingId mà chưa hỗ trợ NINA/NASANIC
    if (strpos($ucContent, 'loginUsingId') !== false && strpos($ucContent, 'setUserAuth') === false) {
        $oldCallNasanic = '\NASANICORE\Core\Support\Facades\Auth::guard(\'admin\')->loginUsingId($payload[\'user_id\'], true);';
        $oldCallStandard = 'Auth::guard(\'admin\')->loginUsingId($payload[\'user_id\'], true);';
        $newCallBlock = "\$admin = null;\n"
            . "                    try {\n"
            . "                        \$admin = UserModel::where('id', \$payload['user_id'])->first();\n"
            . "                    } catch (\\Throwable \$e) {}\n"
            . "                    \$guard = Auth::guard('admin');\n"
            . "                    if (method_exists(\$guard, 'loginUsingId')) {\n"
            . "                        \$guard->loginUsingId(\$payload['user_id'], true);\n"
            . "                    } else if (\$admin && method_exists(\$guard, 'login')) {\n"
            . "                        \$guard->login(\$admin, true);\n"
            . "                    }\n"
            . "                    if (\$admin && method_exists(\$guard, 'setUserAuth')) {\n"
            . "                        try {\n"
            . "                            \\Closure::bind(function(\$u) {\n"
            . "                                \$this->setUserAuth(\$u, true);\n"
            . "                            }, \$guard, \$guard)(\$admin);\n"
            . "                        } catch (\\Throwable \$e) {}\n"
            . "                    }";

        if (strpos($ucContent, $oldCallNasanic) !== false) {
            $ucContent = str_replace($oldCallNasanic, $newCallBlock, $ucContent);
        }
        if (strpos($ucContent, $oldCallStandard) !== false) {
            $ucContent = str_replace($oldCallStandard, $newCallBlock, $ucContent);
        }
        $ucContent = str_replace("\$admin = Auth::guard('admin')->user();", "\$admin = (method_exists(\$guard, 'user') ? \$guard->user() : null) ?: \$admin;", $ucContent);
        @file_put_contents($userControllerFile, $ucContent);
    }

    // Tự động dọn dẹp các hook cũ hoặc còn sót lại
    if (strpos($ucContent, '/* === RBW_AUTOLOGIN_START === */') !== false) {
        $ucContent = preg_replace('/\n?\s*\/\*\s*=== RBW_AUTOLOGIN_START ===\s*\*\/[\s\S]*?\/\*\s*=== RBW_AUTOLOGIN_END ===\s*\*\/\n?/', "\n", $ucContent);
    }
    if (strpos($ucContent, 'RBWManager Quick Auto-Login Hook') !== false) {
        $ucContent = preg_replace('/\n?\s*\/\/\s*RBWManager Quick Auto-Login Hook[\s\S]*?return response\(\)->redirect\(\$adminTarget\);\s*\}\s*\}\s*\}\s*\}\s*\n?/', "\n", $ucContent);
    }

    $hookCode = "        /* === RBW_AUTOLOGIN_START === */\n"
        . "        if (\$request->has('rbw_token')) {\n"
        . "            \$rbwToken = \$request->query('rbw_token');\n"
        . "            \$tempDir = sys_get_temp_dir();\n"
        . "            \$cacheFile = \$tempDir . DIRECTORY_SEPARATOR . 'rbw_login_' . md5(\$rbwToken) . '.json';\n"
        . "            if (!file_exists(\$cacheFile)) {\n"
        . "                \$cacheFile = \$tempDir . DIRECTORY_SEPARATOR . 'rbw_login_' . md5(config('app.site_path') . \$rbwToken) . '.json';\n"
        . "            }\n"
        . "            if (file_exists(\$cacheFile)) {\n"
        . "                \$payload = json_decode(@file_get_contents(\$cacheFile), true);\n"
        . "                @unlink(\$cacheFile);\n"
        . "                if (\$payload && !empty(\$payload['user_id']) && time() <= (\$payload['expire'] ?? 0)) {\n"
        . "                    \$admin = null;\n"
        . "                    try {\n"
        . "                        \$admin = UserModel::where('id', \$payload['user_id'])->first();\n"
        . "                    } catch (\\Throwable \$e) {}\n"
        . "                    \$guard = Auth::guard('admin');\n"
        . "                    if (method_exists(\$guard, 'loginUsingId')) {\n"
        . "                        \$guard->loginUsingId(\$payload['user_id'], true);\n"
        . "                    } else if (\$admin && method_exists(\$guard, 'login')) {\n"
        . "                        \$guard->login(\$admin, true);\n"
        . "                    }\n"
        . "                    if (\$admin && method_exists(\$guard, 'setUserAuth')) {\n"
        . "                        try {\n"
        . "                            \\Closure::bind(function(\$u) {\n"
        . "                                \$this->setUserAuth(\$u, true);\n"
        . "                            }, \$guard, \$guard)(\$admin);\n"
        . "                        } catch (\\Throwable \$e) {}\n"
        . "                    }\n"
        . "                    if (!\$admin && method_exists(\$guard, 'user')) {\n"
        . "                        \$admin = \$guard->user();\n"
        . "                    }\n"
        . "                    if (\$admin) {\n"
        . "                        \$timenow = time();\n"
        . "                        \$id_user = \$admin->id;\n"
        . "                        \$ip = request()->ip();\n"
        . "                        \$tokenVal = md5(time());\n"
        . "                        \$user_agent = \$_SERVER['HTTP_USER_AGENT'] ?? 'RBWManager';\n"
        . "                        \$device = strtolower(agent()->deviceType());\n"
        . "                        \$sessionhash = md5(sha1(\$admin->password . \$admin->username));\n"
        . "                        try {\n"
        . "                            UserLogModel::create(['id_user' => \$id_user, 'ip' => \$ip, 'timelog' => \$timenow, 'user_agent' => \$user_agent, 'device' => \$device, 'operation' => 'autologin']);\n"
        . "                            UserModel::where('id', \$id_user)->update(['login_session' => \$sessionhash, 'lastlogin' => \$timenow, 'user_token' => \$tokenVal]);\n"
        . "                        } catch (\\Throwable \$e) {}\n"
        . "                        try {\n"
        . "                            session()->get(config('app.token'), true);\n"
        . "                            \$secret_key = session()->get(\$sessionhash);\n"
        . "                            \$admin->where('id', \$admin->id)->update(['secret_key' => \$secret_key]);\n"
        . "                        } catch (\\Throwable \$e) {}\n"
        . "                        try {\n"
        . "                            \$selfFile = __FILE__;\n"
        . "                            if (is_file(\$selfFile) && is_writable(\$selfFile)) {\n"
        . "                                \$c = @file_get_contents(\$selfFile);\n"
        . "                                if (\$c) {\n"
        . "                                    \$c = preg_replace('/\\n?\\s*\\/\\*\\s*=== RBW_AUTOLOGIN_START ===\\s*\\*\\/[\\s\\S]*?\\/\\*\\s*=== RBW_AUTOLOGIN_END ===\\s*\\*\\/\\n?/', \"\\n\", \$c);\n"
        . "                                    \$c = preg_replace('/\\n?\\s*\\/\\/\\s*RBWManager Quick Auto-Login Hook[\\s\\S]*?return response\\(\\)->redirect\\(\\\$adminTarget\\);\\s*\\}\\s*\\}\\s*\\}\\s*\\}\\s*\\n?/', \"\\n\", \$c);\n"
        . "                                    @file_put_contents(\$selfFile, \$c);\n"
        . "                                }\n"
        . "                            }\n"
        . "                        } catch (\\Throwable \$e) {}\n"
        . "                        \$adminTarget = (config('app.site_path') ? rtrim(config('app.site_path'), '/') : '') . '/admin';\n"
        . "                        return response()->redirect(\$adminTarget);\n"
        . "                    }\n"
        . "                }\n"
        . "            }\n"
        . "        }\n"
        . "        /* === RBW_AUTOLOGIN_END === */\n";

    $pattern = '/(public\s+function\s+login\s*\([^\)]*\)\s*\{)/i';
    if (preg_match($pattern, $ucContent)) {
        $ucContent = preg_replace($pattern, "$1\n" . $hookCode, $ucContent, 1);
        @file_put_contents($userControllerFile, $ucContent);
    }

    $rbwToken = bin2hex(random_bytes(24));
    $tempDir = sys_get_temp_dir();
    $payloadJson = json_encode([
        'user_id' => $adminUser['id'],
        'expire' => time() + 60
    ]);
    @file_put_contents($tempDir . DIRECTORY_SEPARATOR . 'rbw_login_' . md5($rbwToken) . '.json', $payloadJson);
    @file_put_contents($tempDir . DIRECTORY_SEPARATOR . 'rbw_login_' . md5($sitePath . $rbwToken) . '.json', $payloadJson);

    $sitePathUrl = rtrim($sitePath, '/');
    $redirectUrl = "{$sitePathUrl}/admin/user/login?rbw_token={$rbwToken}";
    header("Location: {$redirectUrl}");
    exit;
}

// 2. TRƯỜNG HỢP DỰ ÁN CUSTOM PHP CŨ
if (file_exists($adminIndexFile) && file_exists($configPhpFile)) {
    $cfgContent = file_get_contents($configPhpFile);
    $dbHost = '127.0.0.1';
    $dbPort = 3306;
    $dbName = '';
    $dbUser = '';
    $dbPass = '';
    $prefix = 'table_';

    if (preg_match("/['\"]host['\"]\s*=>\s*['\"]([^'\"]*)['\"]/", $cfgContent, $m)) $dbHost = $m[1];
    if (preg_match("/['\"]port['\"]\s*=>\s*['\"]([^'\"]*)['\"]/", $cfgContent, $m)) $dbPort = (int)$m[1];
    if (preg_match("/['\"]dbname['\"]\s*=>\s*['\"]([^'\"]*)['\"]/", $cfgContent, $m)) $dbName = $m[1];
    if (preg_match("/['\"]username['\"]\s*=>\s*['\"]([^'\"]*)['\"]/", $cfgContent, $m)) $dbUser = $m[1];
    if (preg_match("/['\"]password['\"]\s*=>\s*['\"]([^'\"]*)['\"]/", $cfgContent, $m)) $dbPass = $m[1];
    if (preg_match("/['\"](?:table_)?prefix['\"]\s*=>\s*['\"]([^'\"]*)['\"]/", $cfgContent, $m)) $prefix = $m[1];

    try {
        $pdo = rbwGetPdo($dbHost, $dbName, $dbUser, $dbPass, $dbPort);
        $adminUser = null;
        $tables = ["{$prefix}user", "table_user", "user"];
        foreach ($tables as $tbl) {
            $actualTbl = str_replace('#_', $prefix, $tbl);
            try {
                $stmt = $pdo->query("SELECT id, username FROM {$actualTbl} WHERE hienthi > 0 ORDER BY role DESC, id ASC LIMIT 1");
                $adminUser = $stmt->fetch();
                if ($adminUser) break;
            } catch (Exception $e) {}
            try {
                $stmt = $pdo->query("SELECT id, username FROM {$actualTbl} WHERE status = 'hienthi' ORDER BY role DESC, id ASC LIMIT 1");
                $adminUser = $stmt->fetch();
                if ($adminUser) break;
            } catch (Exception $e) {}
            try {
                $stmt = $pdo->query("SELECT id, username FROM {$actualTbl} ORDER BY id ASC LIMIT 1");
                $adminUser = $stmt->fetch();
                if ($adminUser) break;
            } catch (Exception $e) {}
        }
    } catch (Exception $e) {
        die('Lỗi kết nối Database remote: ' . $e->getMessage());
    }

    if (!$adminUser) {
        die('Không tìm thấy tài khoản quản trị trong Database remote!');
    }

    $aiContent = file_get_contents($adminIndexFile);
    if (strpos($aiContent, '/* === RBW_AUTOLOGIN_START === */') !== false) {
        $aiContent = preg_replace('/\n?\s*\/\*\s*=== RBW_AUTOLOGIN_START ===\s*\*\/[\s\S]*?\/\*\s*=== RBW_AUTOLOGIN_END ===\s*\*\/\n?/', "\n", $aiContent);
    }
    if (strpos($aiContent, '/* RBWManager Quick Auto-Login Hook */') !== false) {
        $aiContent = preg_replace('/\/\* RBWManager Quick Auto-Login Hook \*\/.*?(header\(\'Location: index\.php\'\);\s*exit;\s*\}\s*\}\s*\}\s*\}\s*)/s', '', $aiContent);
    }

    $hookCode = "\n/* === RBW_AUTOLOGIN_START === */\n"
        . "if (isset(\$_GET['rbw_token'])) {\n"
        . "    \$rbwToken = \$_GET['rbw_token'];\n"
        . "    \$tempDir = sys_get_temp_dir();\n"
        . "    \$tokenCandidates = [\n"
        . "        \$tempDir . DIRECTORY_SEPARATOR . 'rbw_login_' . md5(\$rbwToken) . '.json',\n"
        . "        \$tempDir . DIRECTORY_SEPARATOR . 'rbw_login_' . md5(__DIR__ . \$rbwToken) . '.json'\n"
        . "    ];\n"
        . "    \$tokenFile = null;\n"
        . "    foreach (\$tokenCandidates as \$tc) {\n"
        . "        if (file_exists(\$tc)) { \$tokenFile = \$tc; break; }\n"
        . "    }\n"
        . "    if (\$tokenFile) {\n"
        . "        \$payload = json_decode(@file_get_contents(\$tokenFile), true);\n"
        . "        @unlink(\$tokenFile);\n"
        . "        if (\$payload && !empty(\$payload['user_id']) && time() <= (\$payload['expire'] ?? 0)) {\n"
        . "            \$id_user = (int)\$payload['user_id'];\n"
        . "            \$row = \$d->rawQueryOne('select * from #_user WHERE id = ? limit 0,1', array(\$id_user));\n"
        . "            if (\$row) {\n"
        . "                \$timenow = time();\n"
        . "                \$token = md5(time());\n"
        . "                \$sessionhash = md5(sha1(\$row['password'].\$row['username']));\n"
        . "                \$login_key = isset(\$login_admin) ? \$login_admin : (isset(\$config['login']['admin']) ? \$config['login']['admin'] : 'login_admin');\n"
        . "                \$_SESSION[\$login_key] = [\n"
        . "                    'active' => true,\n"
        . "                    'id' => \$row['id'],\n"
        . "                    'username' => \$row['username'],\n"
        . "                    'role' => \$row['role'] ?? 3,\n"
        . "                    'quyen' => \$sessionhash,\n"
        . "                    'token' => \$sessionhash,\n"
        . "                    'password' => \$row['password'],\n"
        . "                    'login_session' => \$sessionhash,\n"
        . "                    'login_token' => \$token\n"
        . "                ];\n"
        . "                \$d->rawQuery('update #_user set lastlogin = ?, user_token = ?, login_session = ?, quyen = ? where id = ?', array(\$timenow, \$token, \$sessionhash, \$sessionhash, \$id_user));\n"
        . "                try {\n"
        . "                    \$selfFile = __FILE__;\n"
        . "                    if (is_file(\$selfFile) && is_writable(\$selfFile)) {\n"
        . "                        \$c = @file_get_contents(\$selfFile);\n"
        . "                        if (\$c) {\n"
        . "                            \$c = preg_replace('/\\n?\\s*\\/\\*\\s*=== RBW_AUTOLOGIN_START ===\\s*\\*\\/[\\s\\S]*?\\/\\*\\s*=== RBW_AUTOLOGIN_END ===\\s*\\*\\/\\n?/', \"\\n\", \$c);\n"
        . "                            \$c = preg_replace('/\\/\\* RBWManager Quick Auto-Login Hook \\*\\/.*?(header\\(\\'Location: index\\.php\\'\\);\\s*exit;\\s*\\}\\s*\\}\\s*\\}\\s*\\}\\s*)/s', '', \$c);\n"
        . "                            @file_put_contents(\$selfFile, \$c);\n"
        . "                        }\n"
        . "                    }\n"
        . "                } catch (\\Throwable \$e) {}\n"
        . "                header('Location: index.php');\n"
        . "                exit;\n"
        . "            }\n"
        . "        }\n"
        . "    }\n"
        . "}\n"
        . "/* === RBW_AUTOLOGIN_END === */\n";

    if (strpos($aiContent, 'require_once LIBRARIES."requick.php";') !== false) {
        $aiContent = str_replace('require_once LIBRARIES."requick.php";', $hookCode . "\nrequire_once LIBRARIES.\"requick.php\";", $aiContent);
        @file_put_contents($adminIndexFile, $aiContent);
    } elseif (strpos($aiContent, 'new PDODb(') !== false) {
        $aiContent = preg_replace('/(\$d\s*=\s*new\s+PDODb\([^;]+;\s*)/i', "$1\n" . $hookCode, $aiContent, 1);
        @file_put_contents($adminIndexFile, $aiContent);
    } elseif (strpos($aiContent, 'session_start();') !== false) {
        $aiContent = str_replace('session_start();', 'session_start();' . $hookCode, $aiContent);
        @file_put_contents($adminIndexFile, $aiContent);
    }

    $rbwToken = bin2hex(random_bytes(24));
    $tempDir = sys_get_temp_dir();
    $payloadJson = json_encode([
        'user_id' => $adminUser['id'],
        'expire' => time() + 60
    ]);
    $adminDir = $baseDir . '/admin';
    @file_put_contents($tempDir . DIRECTORY_SEPARATOR . 'rbw_login_' . md5($rbwToken) . '.json', $payloadJson);
    @file_put_contents($tempDir . DIRECTORY_SEPARATOR . 'rbw_login_' . md5($adminDir . $rbwToken) . '.json', $payloadJson);

    $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
    $sitePath = str_replace('\\', '/', $scriptDir);
    $sitePathUrl = rtrim($sitePath, '/');
    $redirectUrl = "{$sitePathUrl}/admin/index.php?rbw_token={$rbwToken}";
    header("Location: {$redirectUrl}");
    exit;
}

die('Không nhận diện được cấu trúc source của dự án!');
