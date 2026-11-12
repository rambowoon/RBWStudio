<?php
date_default_timezone_set('Asia/Ho_Chi_Minh');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
@set_time_limit(600);
@ini_set('max_execution_time', 600);

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_COMPILE_ERROR)) {
        ob_clean();
        echo json_encode(['status' => 'error', 'message' => 'PHP Fatal Error: ' . $error['message'], 'file' => $error['file'], 'line' => $error['line']]);
        exit;
    }
});

/**
 * RamboWoon Deployment Bridge [v6.3 Platinum Lite]
 * Precision Deployment & Atomic Security
 */
class RamboWoonBridge
{
    private $version = "6.3 Platinum Lite";
    private $action;

    public function __construct()
    {
        $this->action = $_GET['action'] ?? '';
    }

    public function run()
    {
        switch ($this->action) {
            case 'ping':
                $this->ping();
                break;
            case 'clearImages':
                $this->clearImages();
                break;
            case 'deploy':
                $this->deploy();
                break;
            case 'deployDb':
                $this->deployDb();
                break;
            case 'checkDb':
                $this->checkDb();
                break;
            case 'cleanup':
                $this->cleanup();
                break;
            case 'package':
                $this->package();
                break;
            case 'scanFiles':
                $this->scanFiles();
                break;
            case 'cloudDeploy':
                $this->cloudDeploy();
                break;
            case 'downloadTemp':
                $this->downloadTemp();
                break;
            case 'cleanupTemp':
                $this->cleanupTemp();
                break;
            case 'getDbSchema':
                $this->getDbSchema();
                break;
            case 'syncDbSchema':
                $this->syncDbSchema();
                break;
            case 'clearCompiled':
            case 'clearCache':
                $this->clearCompiled();
                break;
            default:
                echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
                break;
        }
    }

    private function ping()
    {
        header('Content-Type: application/json');
        die(json_encode(['status' => 'success', 'message' => 'pong', 'version' => $this->version, 'php' => PHP_VERSION]));
    }

    public function deploy($previousResults = [])
    {
        $results = is_array($previousResults) ? $previousResults : [];
        $zipFile = 'dist.zip';
        $sqlFile = 'dist.sql';

        $baseDir = __DIR__;
        $results[] = "Bridge Work Dir: " . $baseDir;

        // Multi-level file resolution (current, parent, grandparent)
        $searchPaths = ['.', '..', '../..'];
        foreach ($searchPaths as $path) {
            if (!file_exists($sqlFile) && file_exists($path . '/dist.sql')) {
                $sqlFile = $path . '/dist.sql';
                $results[] = "SQL found in: $sqlFile";
            }
            if (!file_exists($zipFile) && file_exists($path . '/dist.zip')) {
                $zipFile = $path . '/dist.zip';
                $results[] = "ZIP found in: $zipFile";
            }
        }

        $isSqlSuccess = false;
        $isZipSuccess = false;

        // Robust data parsing (v6.3 Ultra Recov)
        $dbRaw = $_POST['db_config'] ?? null;
        $appRaw = $_POST['app_config'] ?? null;

        if (!$dbRaw) {
            $rawInput = file_get_contents('php://input');
            if (!empty($rawInput)) {
                parse_str($rawInput, $inputData);
                $dbRaw = $inputData['db_config'] ?? null;
                $appRaw = $inputData['app_config'] ?? null;
            }
        }

        $dbConfig = json_decode($dbRaw, true);
        $appConfig = json_decode($appRaw, true);

        // Download package if URLs are provided (Cloud Transfer mode)
        if (!empty($appConfig['zip_url'])) {
            $results[] = "Downloading ZIP from Demo: " . $appConfig['zip_url'];
            if ($this->downloadFile($appConfig['zip_url'], 'dist.zip')) {
                $results[] = "ZIP download SUCCESS (" . filesize('dist.zip') . " bytes)";
            } else {
                die(json_encode(['status' => 'error', 'message' => 'Lỗi: Không thể tải dist.zip từ Demo server.', 'logs' => $results]));
            }
        }
        if (!empty($appConfig['sql_url'])) {
            $results[] = "Downloading SQL from Demo: " . $appConfig['sql_url'];
            if ($this->downloadFile($appConfig['sql_url'], 'dist.sql')) {
                $results[] = "SQL download SUCCESS (" . filesize('dist.sql') . " bytes)";
            } else {
                die(json_encode(['status' => 'error', 'message' => 'Lỗi: Không thể tải dist.sql từ Demo server.', 'logs' => $results]));
            }
        }

        if (empty($dbConfig) || empty($dbConfig['name'])) {
            $dbConfig = $this->getDbConfig();
            $results[] = "Loaded database config from server (Host=" . ($dbConfig['host'] ?? 'localhost') . ", DB=" . ($dbConfig['name'] ?? 'none') . ")";
        }

        $results = array_merge($results, $previousResults);
        $results[] = "--- Starting Deploy [Bridge {$this->version}] ---";

        // Backup existing .htaccess if skip runs
        $htaccessBackup = null;
        if (!empty($_POST['skip_htaccess']) && file_exists('.htaccess')) {
            $htaccessBackup = file_get_contents('.htaccess');
            $results[] = "Backed up local .htaccess";
        }

        // Backup existing .env to preserve server-side settings
        $envBackup = null;
        if (file_exists('.env')) {
            $envBackup = file_get_contents('.env');
            $results[] = "Backed up existing .env configuration";
        }

        // Backup existing libraries/config.php to preserve server-side settings
        $configPhpBackup = null;
        if (file_exists('libraries/config.php')) {
            $configPhpBackup = file_get_contents('libraries/config.php');
            $results[] = "Backed up existing libraries/config.php configuration";
        }

        // Clean up any old files with backslashes in their names from previous buggy deploys
        try {
            if (class_exists('DirectoryIterator')) {
                $dir = new DirectoryIterator($baseDir);
                foreach ($dir as $fileinfo) {
                    if (!$fileinfo->isDot() && !$fileinfo->isDir()) {
                        $filename = $fileinfo->getFilename();
                        if (strpos($filename, '\\') !== false) {
                            @unlink($baseDir . '/' . $filename);
                        }
                    }
                }
            }
        } catch (\Exception $e) {
            // Ignore
        }

        // 1. Unzip - Use System Unzip if possible (Fast & avoids 500)
        if (file_exists($zipFile)) {
            $results[] = "Extracting package (" . filesize($zipFile) . " bytes)...";
            $unzipped = false;

            // Read zip metadata for progress reporting
            $totalFiles = 0;
            $uncompressedSize = 0;
            if (class_exists('ZipArchive')) {
                $zipMeta = new ZipArchive();
                if ($zipMeta->open($zipFile) === TRUE) {
                    $totalFiles = $zipMeta->numFiles;
                    for ($i = 0; $i < $totalFiles; $i++) {
                        $stat = $zipMeta->statIndex($i);
                        $uncompressedSize += $stat['size'];
                    }
                    $zipMeta->close();
                }
            }

            // Method 1: System Unzip (Fastest)
            $unzipped = false;
            if (function_exists('exec')) {
                @exec("unzip -o $zipFile -d .", $output, $returnVar);
                if (isset($returnVar) && $returnVar === 0) {
                    $unzipped = true;
                    $extractedFiles = is_array($output) ? count($output) : $totalFiles;
                    $results[] = "Package extracted via system unzip: $extractedFiles entries. Total size: " . round($uncompressedSize / 1024 / 1024, 2) . " MB";
                }
            }

            if (!$unzipped) {
                // Method 2: PHP Fallback
                if (class_exists('ZipArchive')) {
                    $zip = new ZipArchive();
                    if ($zip->open($zipFile) === TRUE) {
                        if ($zip->extractTo('.')) {
                            $unzipped = true;
                            $results[] = "Package extracted via PHP ZipArchive: $totalFiles files. Total size: " . round($uncompressedSize / 1024 / 1024, 2) . " MB";
                        }
                        $zip->close();
                    }
                }
            }

            if ($unzipped) {
                $isZipSuccess = true;

                // Clear Laravel bootstrap config/routes cache if present
                $cacheFiles = [
                    'bootstrap/cache/config.php',
                    'bootstrap/cache/routes.php',
                    'bootstrap/cache/events.php'
                ];
                foreach ($cacheFiles as $cf) {
                    if (file_exists($cf)) {
                        @unlink($cf);
                        $results[] = "Cleared Laravel cache file: $cf";
                    }
                }
            } else {
                die(json_encode(['status' => 'error', 'message' => 'Lỗi: Không thể giải nén bộ cài (Cả unzip và ZipArchive đều thất bại hoặc treo).', 'logs' => $results]));
            }
        } else {
            $results[] = "ZIP package NOT found on server";
        }

        // Restore .env after unzip (so we don't lose server-specific keys)
        if ($envBackup !== null) {
            file_put_contents('.env', $envBackup);
            $results[] = "Restored existing .env configuration";
        }

        // Restore libraries/config.php after unzip
        if ($configPhpBackup !== null) {
            file_put_contents('libraries/config.php', $configPhpBackup);
            $results[] = "Restored existing libraries/config.php configuration";
        }

        // Restore existing .htaccess
        if ($htaccessBackup !== null) {
            file_put_contents('.htaccess', $htaccessBackup);
            $results[] = "Restored local .htaccess";
        } else if (!empty($_POST['skip_htaccess']) && file_exists('.htaccess')) {
            // Unzipped Demo's htaccess on a fresh Prod instance. Strip Demo's SSL block to prevent redirect loops.
            $content = file_get_contents('.htaccess');
            $content = preg_replace('/# BEGIN RamboWoon SSL.*?# END RamboWoon SSL\s*/is', '', $content);
            file_put_contents('.htaccess', trim($content) . "\n");
        }

        // 2. Configure .env and/or libraries/config.php and .htaccess
        if (!empty($dbConfig)) {
            if (file_exists('.env') || !file_exists('libraries/config.php')) {
                $this->updateEnv($dbConfig, $appConfig);
                $results[] = "Env configured";
            }
            if (file_exists('libraries/config.php')) {
                $this->updateConfigPhp($dbConfig, $appConfig);
                $results[] = "libraries/config.php configured (debug-developer => false)";
            }
        }

        if (empty($_POST['skip_htaccess'])) {
            $this->updateHtaccess($appConfig);
            $results[] = "Htaccess configured (SSL: " . (!empty($appConfig['ssl']) ? 'On' : 'Off') . ")";
        }

        $clearDb = isset($_POST['clear_db']) ? (int)$_POST['clear_db'] : 0;

        // 3. Import SQL
        if (file_exists($sqlFile)) {
            $sqlSize = filesize($sqlFile);
            $results[] = "Found SQL file: $sqlFile ($sqlSize bytes)";
            if ($sqlSize > 0) {
                try {
                    // Wait 2 seconds for DB permissions to propagate (DirectAdmin API delay)
                    sleep(2);

                    $host = $dbConfig['host'] ?? 'localhost';
                    $dbname = $dbConfig['name'] ?? '';
                    $user = $dbConfig['user'] ?? '';
                    $pass = $dbConfig['pass'] ?? '';

                    if ($clearDb) {
                        $results[] = "Clearing database tables first...";
                        $this->clearDatabase($dbConfig);
                    }

                    // Prepend lock timeout & disable foreign keys, and perform domain replacement
                    // Ensure target database default charset is utf8mb4 BEFORE creating/importing tables
                    try {
                        $pdoInit = $this->getPdoConnection($dbConfig);
                        $pdoInit->exec("ALTER DATABASE `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                    } catch (\Exception $e) {}

                    // Prepend utf8mb4, lock timeout & disable foreign keys, and perform domain replacement
                    $sqlContent = file_exists($sqlFile) ? file_get_contents($sqlFile) : '';
                    $prefixSql = "SET SESSION lock_wait_timeout = 5;\nSET FOREIGN_KEY_CHECKS = 0;\n";
                    $prefixSql = "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci';\nSET CHARACTER SET utf8mb4;\nSET SESSION lock_wait_timeout = 5;\nSET FOREIGN_KEY_CHECKS = 0;\n";

                    if (!empty($appConfig['demo_domain']) && !empty($appConfig['prod_domain'])) {
                        $demoDom = trim($appConfig['demo_domain'], '/');
                        $prodDom = trim($appConfig['prod_domain'], '/');
                        if ($demoDom !== $prodDom) {
                            $sqlContent = str_ireplace($demoDom, $prodDom, $sqlContent);
                            $results[] = "Domain mapping applied to SQL: $demoDom -> $prodDom";
                        }
                    }
                    file_put_contents($sqlFile, $prefixSql . $sqlContent);

                    $hasExec = function_exists('exec');

                    // TRY METHOD 1: System MySQL Command (Better integrity)
                    if (function_exists('exec')) {
                        $outM = $resM = null;
                        @exec('mysql --version 2>&1', $outM, $resM);
                        if ($resM === 0) {
                            $passPart = !empty($pass) ? "-p'" . str_replace("'", "'\\''", $pass) . "'" : "";
                            $cmd = "mysql --host={$host} --user={$user} {$passPart} --default-character-set=utf8mb4 {$dbname} < \"{$sqlFile}\" 2>&1";
                            @exec($cmd, $importOut, $importRes);
                            if ($importRes === 0) {
                                $results[] = "Database imported via system command (mysql CLI)";
                                $isSqlSuccess = true;
                            } else {
                                $results[] = "System mysql import FAILED, falling back to PDO...";
                            }
                        }
                    }

                    if (!$isSqlSuccess) {
                        // METHOD 2: PDO Fallback (Stream import to prevent memory and timeout issues)
                        $pdo = $this->getPdoConnection($dbConfig);
                        $pdo->exec("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci';");
                        $pdo->exec("SET CHARACTER SET utf8mb4;");
                        if ($this->importSqlFileViaPdo($pdo, $sqlFile)) {
                            $results[] = "Database imported successfully via streaming PDO ($sqlSize bytes)";
                            $isSqlSuccess = true;
                        } else {
                            throw new \Exception("Streaming PDO SQL import failed");
                        }
                    }

                    // 4. Update Setting Table (Email config)
                    if ($isSqlSuccess && !empty($appConfig['email_host'])) {
                        $pdo = $this->getPdoConnection($dbConfig);
                        $this->updateSettingTable($pdo, $appConfig);
                    }
                    if ($isSqlSuccess) {
                        try {
                            $pdo = $this->getPdoConnection($dbConfig);
                            $this->normalizeDatabaseCollation($pdo);
                            $results[] = "Normalized database collation to utf8mb4_unicode_ci";
                        } catch (\Exception $e) {
                            $results[] = "Failed to normalize collation: " . $e->getMessage();
                        }
                    }
                    $results[] = "Database Import SUCCESS.";
                } catch (\Exception $e) {
                    $results[] = "DB Error: " . $e->getMessage();
                    $isAccessDenied = (stripos($e->getMessage(), 'Access denied') !== false || stripos($e->getMessage(), '1045') !== false);
                    if ($isAccessDenied) {
                        die(json_encode(['status' => 'error', 'message' => 'DB_CONNECTION_FAIL: ' . $e->getMessage(), 'logs' => $results]));
                    }
                }
            } else {
                $results[] = "DB Import: $sqlFile is empty (0 bytes)";
            }
        } else {
            $results[] = "DB Import: $sqlFile NOT found on server";
            // Debug: List files in current dir
            $dirFiles = scandir('.');
            $results[] = "Current Dir Files: " . implode(', ', $dirFiles);
        }

        if ($isZipSuccess) @unlink($zipFile);
        if ($isSqlSuccess) @unlink($sqlFile);

        // 5. CONFIGURE HTACCESS (SSL & LOCK)
        $htaccess = '.htaccess';
        $skipLock = !empty($appConfig['skip_lock']);

        if (file_exists($htaccess)) {
            $content = file_get_contents($htaccess);

            // SSL Rules
            if (!empty($appConfig['ssl']) && strpos($content, 'HTTPS') === false) {
                $sslRules = "\nRewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\n";
                $content = $sslRules . $content;
            }

            // Lock Rules (Skip if requested)
            if ($skipLock) {
                $results[] = "Htaccess: Skip lock (Demo mode).";
            } else if (strpos($content, 'lock.php') === false) {
                if (strpos($content, 'DirectoryIndex') !== false) {
                    $content = preg_replace('/DirectoryIndex\s+/i', 'DirectoryIndex lock.php ', $content);
                } else {
                    $content = "DirectoryIndex lock.php index.php\n" . $content;
                }
                $results[] = "Website LOCKED: lock.php is active.";
            } else {
                $results[] = "Website status: Already locked.";
            }
            file_put_contents($htaccess, $content);
        } else {
            if ($skipLock) {
                $results[] = "Htaccess: Not created (Skip lock).";
            } else {
                file_put_contents($htaccess, "DirectoryIndex lock.php index.php\n");
                $results[] = "Created .htaccess with lock.php active.";
            }
        }

        // 6. Final Cleanup: Remove unwanted hosting folders (e.g. cgi-bin)
        if (is_dir('cgi-bin')) {
            $this->removeRecursive('cgi-bin');
            $results[] = "Cleanup: Removed 'cgi-bin' folder.";
        }

        // 7. DONE
        echo json_encode(['status' => 'success', 'logs' => $results]);
    }

    private function getDbConfig()
    {
        $db = $this->getDbConfigFromEnv();
        if (!empty($db['name'])) return $db;
        return $this->getDbConfigFromConfigPhp();
    }

    private function getDbConfigFromConfigPhp()
    {
        $db = ['host' => 'localhost', 'name' => '', 'user' => '', 'pass' => ''];
        $cfgPath = 'libraries/config.php';
        if (!file_exists($cfgPath)) return $db;

        $content = file_get_contents($cfgPath);
        $keys = [
            'host' => 'host',
            'dbname' => 'name',
            'username' => 'user',
            'password' => 'pass',
        ];
        foreach ($keys as $k => $dest) {
            if (preg_match("/['\"]" . preg_quote($k, '/') . "['\"]\s*=>\s*['\"]([^'\"]*)['\"]/", $content, $m)) {
                $db[$dest] = $m[1];
            }
        }
        return $db;
    }

    private function getDbConfigFromEnv()
    {
        $db = ['host' => 'localhost', 'name' => '', 'user' => '', 'pass' => ''];
        if (!file_exists('.env')) return $db;

        $content = file_get_contents('.env');
        // Strip BOM if present
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
        $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $content));

        foreach ($lines as $line) {
            $line = trim($line);
            if (!$line || $line[0] === '#') continue;
            if (strpos($line, '=') === false) continue;

            $parts = explode('=', $line, 2);
            $key = strtoupper(trim($parts[0]));
            $val = trim($parts[1]);

            // Smart Comment Handling: Only strip if # is preceded by space or at start
            if (preg_match('/\s+#/', $val, $matches, PREG_OFFSET_CAPTURE)) {
                $val = trim(substr($val, 0, $matches[0][1]));
            }
            // Strip quotes and whitespace
            $val = trim($val, " \t\n\r\0\x0B\"'");

            if (in_array($key, ['DB_HOST', 'DATABASE_HOST'])) $db['host'] = $val;
            else if (in_array($key, ['DB_DATABASE', 'DB_NAME', 'DB_DB', 'DATABASE_NAME'])) $db['name'] = $val;
            else if (in_array($key, ['DB_USERNAME', 'DB_USER', 'DATABASE_USER', 'DATABASE_USERNAME'])) $db['user'] = $val;
            else if (in_array($key, ['DB_PASSWORD', 'DB_PASS', 'DATABASE_PASS', 'DATABASE_PASSWORD'])) $db['pass'] = $val;
        }
        return $db;
    }

    private function getPdoConnection($dbConfig)
    {
        $host = $dbConfig['host'] ?? 'localhost';
        $dbname = $dbConfig['name'] ?? '';
        $user = $dbConfig['user'] ?? '';
        $pass = $dbConfig['pass'] ?? '';

        try {
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ];
            $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, $options);
            $pdo->exec("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
            $pdo->exec("SET SESSION lock_wait_timeout = 5;");
            return $pdo;
        } catch (PDOException $e) {
            $msg = $e->getMessage();
            if (strpos($msg, '2002') !== false || strpos($msg, 'No such file or directory') !== false) {
                try {
                    $pdo = new PDO("mysql:host=127.0.0.1;dbname={$dbname};charset=utf8mb4", $user, $pass, $options);
                    $pdo->exec("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
                    $pdo->exec("SET SESSION lock_wait_timeout = 5;");
                    return $pdo;
                } catch (PDOException $e2) {
                    throw new Exception("DEBUG_BRIDGE: Localhost & 127.0.0.1 failed. Error 1: {$msg}. Error 2: " . $e2->getMessage());
                }
            }
            throw new Exception("DEBUG_BRIDGE: PDO Error on [$host]: " . $e->getMessage());
        }
    }

    private function updateEnv($dbConfig, $appConfig)
    {
        $env = '.env';
        if (!file_exists($env)) {
            // Create a fresh .env if missing
            file_put_contents($env, "ENVIRONMENT=production\n");
        }

        $lines = file($env, FILE_IGNORE_NEW_LINES);
        $newLines = [];
        $processedKeys = [];

        $fullUrl = $appConfig['app_url'] ?? '';
        $cleanUrl = "";
        $sitePath = "/";

        if (!empty($fullUrl)) {
            $parsed = parse_url($fullUrl);
            $cleanUrl = ($parsed['scheme'] ?? 'http') . '://' . ($parsed['host'] ?? '');
            $sitePath = '/' . trim($parsed['path'] ?? '', '/') . '/';
            if ($sitePath === '//') $sitePath = '/';
        }

        $keysToUpdate = ['DB_HOST', 'DB_DATABASE', 'DB_NAME', 'DB_DB', 'DB_USERNAME', 'DB_USER', 'DB_PASSWORD', 'DB_PASS', 'RANDOMKEY', 'SITE_PATH', 'APP_URL', 'ENVIRONMENT'];
        $keysToUpdate = ['DB_HOST', 'DB_DATABASE', 'DB_NAME', 'DB_DB', 'DB_USERNAME', 'DB_USER', 'DB_PASSWORD', 'DB_PASS', 'RANDOMKEY', 'SITE_PATH', 'APP_URL'];
        if (!empty($appConfig['is_production'])) {
            $keysToUpdate[] = 'ENVIRONMENT';
            $keysToUpdate[] = 'TURNSTILE_SITEKEY';
            $keysToUpdate[] = 'TURNSTILE_SECRETKEY';
        }

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if (empty($trimmed)) {
                $newLines[] = $line;
                continue;
            }

            $isComment = (strpos($trimmed, '#') === 0);
            $cleanLine = $isComment ? ltrim($trimmed, '# ') : $trimmed;

            $parts = explode('=', $cleanLine, 2);
            $key = strtoupper(trim($parts[0]));

            // If it's a comment and NOT a key we want to update, keep it as a comment
            if ($isComment && !in_array($key, $keysToUpdate)) {
                $newLines[] = $line;
                continue;
            }

            if (empty($key)) {
                $newLines[] = $line;
                continue;
            }

            $val = isset($parts[1]) ? trim($parts[1]) : '';

            if ($key === 'DB_HOST') {
                $val = "localhost";
            } else if (in_array($key, ['DB_DATABASE', 'DB_NAME', 'DB_DB'])) {
                if (!empty($dbConfig['name'])) $val = $dbConfig['name'];
            } else if (in_array($key, ['DB_USERNAME', 'DB_USER'])) {
                if (!empty($dbConfig['user'])) $val = $dbConfig['user'];
            } else if (in_array($key, ['DB_PASSWORD', 'DB_PASS'])) {
                if (!empty($dbConfig['pass'])) $val = $dbConfig['pass'];
            } else if ($key === 'RANDOMKEY' && !empty($appConfig['random_key'])) {
                $val = $appConfig['random_key'];
            } else if ($key === 'SITE_PATH') {
                $val = $sitePath;
            } else if ($key === 'APP_URL' && !empty($cleanUrl)) {
                $val = $cleanUrl . '${SITE_PATH}';
            } else if ($key === 'ENVIRONMENT' && !empty($appConfig['is_production'])) {
                $val = "production";
            } else if ($key === 'TURNSTILE_SITEKEY' && !empty($appConfig['is_production'])) {
                if (!empty($appConfig['turnstile_sitekey'])) $val = $appConfig['turnstile_sitekey'];
            } else if ($key === 'TURNSTILE_SECRETKEY' && !empty($appConfig['is_production'])) {
                if (!empty($appConfig['turnstile_secretkey'])) $val = $appConfig['turnstile_secretkey'];
            }

            $newLines[] = "{$key}={$val}";
            $processedKeys[] = $key;
        }

        // Add missing keys
        if (!in_array('DB_DATABASE', $processedKeys) && !empty($dbConfig['name'])) $newLines[] = "DB_DATABASE=" . $dbConfig['name'];
        if (!in_array('DB_USERNAME', $processedKeys) && !empty($dbConfig['user'])) $newLines[] = "DB_USERNAME=" . $dbConfig['user'];
        if (!in_array('DB_PASSWORD', $processedKeys) && !empty($dbConfig['pass'])) $newLines[] = "DB_PASSWORD=" . $dbConfig['pass'];
        if (!in_array('DB_HOST', $processedKeys)) $newLines[] = "DB_HOST=localhost";
        if (!empty($appConfig['is_production']) && !empty($appConfig['turnstile_sitekey'])) {
            if (!in_array('TURNSTILE_SITEKEY', $processedKeys)) $newLines[] = "TURNSTILE_SITEKEY=" . $appConfig['turnstile_sitekey'];
            if (!in_array('TURNSTILE_SECRETKEY', $processedKeys)) $newLines[] = "TURNSTILE_SECRETKEY=" . $appConfig['turnstile_secretkey'];
        }

        file_put_contents($env, implode(PHP_EOL, $newLines));
    }

    private function updateConfigPhp($dbConfig, $appConfig)
    {
        $cfgPath = 'libraries/config.php';
        if (!file_exists($cfgPath)) return false;
        $content = file_get_contents($cfgPath);

        $fullUrl = $appConfig['app_url'] ?? '';
        $sitePath = "/";
        $hasSsl = !empty($appConfig['ssl']) || (strpos($fullUrl, 'https://') === 0);

        if (!empty($fullUrl)) {
            $parsed = parse_url($fullUrl);
            $sitePath = '/' . trim($parsed['path'] ?? '', '/') . '/';
            if ($sitePath === '//') $sitePath = '/';
        }

        // Cập nhật biến $http theo SSL nếu có
        $httpVal = $hasSsl ? 'https://' : 'http://';
        $content = preg_replace("/(\\\$http\s*=\s*['\"])[^'\"]*(['\"];)/i", '${1}' . $httpVal . '${2}', $content);

        $updates = [
            'host' => $dbConfig['host'] ?? 'localhost',
            'dbname' => $dbConfig['name'] ?? '',
            'username' => $dbConfig['user'] ?? '',
            'password' => $dbConfig['pass'] ?? '',
            'url' => $sitePath,
            'debug-developer' => false
        ];

        foreach ($updates as $key => $value) {
            if ($key === 'debug-developer') {
                $boolVal = ($value === false || $value === 'false' || $value === 0 || $value === '0') ? 'false' : 'true';
                $pattern = "/(['\"]debug-developer['\"]\s*=>\s*)(true|false|[01])/i";
                if (preg_match($pattern, $content)) {
                    $content = preg_replace($pattern, '${1}' . $boolVal, $content);
                } else {
                    $content = preg_replace("/(['\"]website['\"]\s*=>\s*array\s*\()/", "$1\n\t\t'debug-developer' => " . $boolVal . ",", $content);
                }
                continue;
            }

            if ($value === '' && $key !== 'password') continue;
            $safeVal = str_replace(['\\', '$'], ['\\\\', '\$'], (string)$value);
            $pattern = "/(['\"]" . preg_quote($key, '/') . "['\"]\s*=>\s*)(['\"][^'\"]*['\"]|[0-9]+)/";
            if (preg_match($pattern, $content)) {
                $replacement = is_numeric($value) && !in_array($key, ['password', 'username', 'dbname', 'host']) 
                    ? '${1}' . $value 
                    : '${1}\'' . $safeVal . '\'';
                $content = preg_replace($pattern, $replacement, $content);
            }
        }

        return file_put_contents($cfgPath, $content) !== false;
    }

    private function updateSettingTable($pdo, $appConfig)
    {
        try {
            $stmt = $pdo->query("SELECT id, options FROM table_setting LIMIT 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $options = json_decode($row['options'] ?? '{}', true);
                if (!is_array($options)) $options = [];

                $options['ip_host'] = !empty($appConfig['smtp_host']) ? $appConfig['smtp_host'] : 'localhost';
                $options['email_host'] = !empty($appConfig['email_user']) ? $appConfig['email_user'] : ($options['email_host'] ?? '');
                $options['password_host'] = !empty($appConfig['email_pass']) ? $appConfig['email_pass'] : ($options['password_host'] ?? '');

                $newOptions = json_encode($options, JSON_UNESCAPED_UNICODE);
                $update = $pdo->prepare("UPDATE table_setting SET options = ? WHERE id = ?");
                $update->execute([$newOptions, $row['id']]);
            }
        } catch (Exception $e) {
            // Silently fail or log for debug
        }
    }

    private function updateHtaccess($appConfig)
    {
        $htaccess = '.htaccess';
        if (!file_exists($htaccess)) {
            file_put_contents($htaccess, "RewriteEngine On\nOptions -Indexes\n");
        }

        $content = file_get_contents($htaccess);
        $sslEnabled = !empty($appConfig['ssl']);
        $skipLock = !empty($appConfig['skip_lock']);

        // 1. Handle SSL Redirection
        if ($sslEnabled) {
            // Fix any wrong direction: RewriteCond %{HTTPS} on → off
            $content = str_ireplace('RewriteCond %{HTTPS} on', 'RewriteCond %{HTTPS} off', $content);

            // Fix any http:// redirect targets → https://
            $content = preg_replace('/(RewriteRule\s+.*?\s+)http:\/\//i', '$1https://', $content);
        } else {
            // Remove existing SSL block if present
            // Remove existing SSL block and standalone HTTPS redirect rules if SSL is disabled
            $content = preg_replace('/# BEGIN RamboWoon SSL.*?# END RamboWoon SSL\s*/is', '', $content);
            $content = preg_replace('/^\s*RewriteCond\s+%\{HTTPS\}\s+off\s*\r?\n\s*RewriteRule\s+.*https:\/\/%\{HTTP_HOST\}.*\r?\n?/im', '', $content);
        }

        // 2. Handle Lock mechanism (DirectoryIndex)
        $content = str_replace('lock.php ', '', $content);
        $content = str_replace(' lock.php', '', $content);

        if (!$skipLock) {
            if (strpos($content, 'DirectoryIndex') !== false) {
                $content = preg_replace('/DirectoryIndex\s+/i', 'DirectoryIndex lock.php ', $content);
            } else {
                $content = "DirectoryIndex lock.php index.php\n" . $content;
            }
        } else {
            if (strpos($content, 'DirectoryIndex') !== false) {
                $content = str_replace('lock.php', '', $content);
            }
        }

        file_put_contents($htaccess, trim($content) . "\n");
    }

    private function removeRecursive($dir)
    {
        if (!is_dir($dir)) return @unlink($dir);
        foreach (scandir($dir) as $item) {
            if ($item == '.' || $item == '..') continue;
            if (!$this->removeRecursive($dir . DIRECTORY_SEPARATOR . $item)) return false;
        }
        return rmdir($dir);
    }

    public function deployDb()
    {
        $results = [];
        $results[] = "--- Starting DB-Only Import [Bridge {$this->version}] ---";
        $sqlFile = 'dist.sql';

        $searchPaths = ['.', '..', '../..'];
        foreach ($searchPaths as $path) {
            if (!file_exists($sqlFile) && file_exists($path . '/dist.sql')) {
                $sqlFile = $path . '/dist.sql';
                $results[] = "SQL found in: $sqlFile";
            }
        }

        if (!file_exists($sqlFile)) {
            die(json_encode(['status' => 'error', 'message' => 'Lỗi: Không tìm thấy tệp dist.sql trên server.', 'logs' => $results]));
        }

        $dbConfig = $this->getDbConfig();
        if (empty($dbConfig['name'])) {
            die(json_encode(['status' => 'error', 'message' => 'Lỗi: Không tìm thấy thông tin cấu hình database trên server.', 'logs' => $results]));
        }

        $results[] = "Loaded DB config from server (Host=" . ($dbConfig['host'] ?? 'localhost') . ", DB=" . ($dbConfig['name'] ?? 'none') . ")";
        $isSqlSuccess = false;

        $clearDb = isset($_POST['clear_db']) ? (int)$_POST['clear_db'] : 0;

        try {
            $host = $dbConfig['host'] ?? 'localhost';
            $dbname = $dbConfig['name'] ?? '';
            $user = $dbConfig['user'] ?? '';
            $pass = $dbConfig['pass'] ?? '';

            if ($clearDb) {
                $results[] = "Clearing database tables first...";
                $this->clearDatabase($dbConfig);
            }

            // Prepend lock timeout & disable foreign keys to prevent hangs
            // Ensure target database default charset is utf8mb4 BEFORE importing tables
            try {
                $pdoInit = $this->getPdoConnection($dbConfig);
                $pdoInit->exec("ALTER DATABASE `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            } catch (\Exception $e) {}

            // Prepend utf8mb4, lock timeout & disable foreign keys to prevent hangs
            $sqlContent = file_exists($sqlFile) ? file_get_contents($sqlFile) : '';
            $prefixSql = "SET SESSION lock_wait_timeout = 5;\nSET FOREIGN_KEY_CHECKS = 0;\n";
            $prefixSql = "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci';\nSET CHARACTER SET utf8mb4;\nSET SESSION lock_wait_timeout = 5;\nSET FOREIGN_KEY_CHECKS = 0;\n";
            file_put_contents($sqlFile, $prefixSql . $sqlContent);

            if (function_exists('exec')) {
                $outM = $resM = null;
                @exec('mysql --version 2>&1', $outM, $resM);
                if ($resM === 0) {
                    $passPart = !empty($pass) ? "-p'" . str_replace("'", "'\\''", $pass) . "'" : "";
                    $cmd = "mysql --host={$host} --user={$user} {$passPart} --default-character-set=utf8mb4 {$dbname} < \"{$sqlFile}\" 2>&1";
                    @exec($cmd, $importOut, $importRes);
                    if ($importRes === 0) {
                        $results[] = "Database imported via system mysql command";
                        $isSqlSuccess = true;
                    } else {
                        $results[] = "System mysql import FAILED, falling back to PDO...";
                    }
                }
            }

            if (!$isSqlSuccess) {
                $pdo = $this->getPdoConnection($dbConfig);
                $pdo->exec("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci';");
                $pdo->exec("SET CHARACTER SET utf8mb4;");
                if ($this->importSqlFileViaPdo($pdo, $sqlFile)) {
                    $results[] = "Database imported successfully via streaming PDO";
                    $isSqlSuccess = true;
                } else {
                    throw new \Exception("Streaming PDO SQL import failed");
                }
            }
        } catch (\Exception $e) {
            die(json_encode(['status' => 'error', 'message' => 'Lỗi import DB: ' . $e->getMessage(), 'logs' => $results]));
        }

        if ($isSqlSuccess) {
            try {
                $pdo = $this->getPdoConnection($dbConfig);
                $this->normalizeDatabaseCollation($pdo);
                $results[] = "Normalized database collation to utf8mb4_unicode_ci";
            } catch (\Exception $e) {}
            @unlink($sqlFile);
            echo json_encode(['status' => 'success', 'logs' => $results]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Không thể import database.', 'logs' => $results]);
        }
        exit;
    }

    public function checkDb()
    {
        header('Content-Type: application/json');

        $dbRaw = $_POST['db_config'] ?? null;
        if (!$dbRaw) {
            $rawInput = file_get_contents('php://input');
            if (!empty($rawInput)) {
                parse_str($rawInput, $inputData);
                $dbRaw = $inputData['db_config'] ?? null;
            }
        }

        $dbConfig = json_decode($dbRaw ?? '', true);
        if (empty($dbConfig) || empty($dbConfig['name'])) {
            $dbConfig = $this->getDbConfig();
        }

        if (empty($dbConfig) || empty($dbConfig['name'])) {
            die(json_encode(['status' => 'error', 'message' => 'No database configuration found']));
        }

        try {
            $pdo = $this->getPdoConnection($dbConfig);
            $stmt = $pdo->query("SHOW TABLES");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            $hasData = count($tables) > 0;
            echo json_encode(['status' => 'success', 'has_data' => $hasData]);
        } catch (\Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        exit;
    }

    private function clearDatabase($dbConfig)
    {
        try {
            $pdo = $this->getPdoConnection($dbConfig);
            $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");

            // Get all tables
            $stmt = $pdo->query("SHOW TABLES");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($tables as $table) {
                $pdo->exec("DROP TABLE IF EXISTS `{$table}`");
            }

            $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    private function importSqlFileViaPdo($pdo, $sqlFile)
    {
        if (!file_exists($sqlFile)) return false;
        
        $fp = fopen($sqlFile, 'r');
        if (!$fp) return false;
        
        $query = '';
        $pdo->exec("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci';");
        $pdo->exec("SET CHARACTER SET utf8mb4;");
        $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");
        $pdo->exec("SET SESSION lock_wait_timeout = 5;");
        
        while (($line = fgets($fp)) !== false) {
            $trimmed = trim($line);
            if (empty($trimmed) || strpos($trimmed, '--') === 0 || strpos($trimmed, '#') === 0) {
                continue;
            }
            if (strpos($trimmed, '/*') === 0 && strpos($trimmed, '/*!') !== 0) {
                continue;
            }
            
            $query .= $line;
            
            if (substr(rtrim($trimmed), -1) === ';') {
                try {
                    $pdo->exec($query);
                } catch (\Exception $e) {
                    // Fail silently or log
                }
                $query = '';
            }
        }
        fclose($fp);
        $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");
        return true;
    }

    private function normalizeDatabaseCollation($pdo)
    {
        try {
            $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
            if (!$dbName) return;
            $pdo->exec("ALTER DATABASE `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($tables as $table) {
                $pdo->exec("ALTER TABLE `$table` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            }
        } catch (\Exception $e) {
            // Fail silently
        }
    }

    private function clearFolderContent($dir)
    {
        if (!is_dir($dir)) return;
        foreach (scandir($dir) as $item) {
            if ($item == '.' || $item == '..') continue;
            $path = $dir . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                $this->clearFolderContent($path);
                @rmdir($path);
            } else {
                if ($item !== '.gitignore') {
                    @unlink($path);
                }
            }
        }
    }

    private function downloadFile($url, $dest)
    {
        if (function_exists('curl_init')) {
            $fp = fopen($dest, 'w+');
            if ($fp) {
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $url);
                curl_setopt($ch, CURLOPT_FILE, $fp);
                curl_setopt($ch, CURLOPT_TIMEOUT, 300);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
                $res = curl_exec($ch);
                curl_close($ch);
                fclose($fp);
                if ($res && file_exists($dest) && filesize($dest) > 0) {
                    return true;
                }
            }
        }

        $opts = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false
            ]
        ];
        $context = stream_context_create($opts);
        $content = @file_get_contents($url, false, $context);
        if ($content !== false) {
            file_put_contents($dest, $content);
            return file_exists($dest) && filesize($dest) > 0;
        }
        return false;
    }

    private function postRequest($url, $data)
    {
        $postData = http_build_query($data);
        if (function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 600);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            $res = curl_exec($ch);
            curl_close($ch);
            if ($res !== false) return $res;
        }

        $opts = [
            'http' => [
                'method'  => 'POST',
                'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
                'content' => $postData,
                'timeout' => 600
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false
            ]
        ];
        $context = stream_context_create($opts);
        return @file_get_contents($url, false, $context);
    }

    private function isSystemTable($tableName)
    {
        $name = strtolower($tableName);
        $systemKeywords = ['setting', 'user', 'member', 'role', 'permission', 'city', 'district', 'ward', 'province', 'country', 'lang', 'translation'];
        foreach ($systemKeywords as $kw) {
            if (strpos($name, $kw) !== false) {
                return true;
            }
        }
        return false;
    }

    private function exportDatabase($dbConfig, $outputFile, $clean = false)
    {
        // Nếu không có dbConfig hoặc rỗng tên db, tự đọc từ server
        if (empty($dbConfig) || empty($dbConfig['name'])) {
            $dbConfig = $this->getDbConfig();
        }

        $exportAttempt = function ($cfg) use ($outputFile, $clean) {
            $host = $cfg['host'] ?? 'localhost';
            $dbname = $cfg['name'] ?? '';
            $user = $cfg['user'] ?? '';
            $pass = $cfg['pass'] ?? '';

            if (empty($dbname)) return false;

            if (!$clean && function_exists('exec')) {
                $passPart = !empty($pass) ? "-p\"$pass\"" : "";
                $cmd = "mysqldump --host={$host} --user={$user} {$passPart} --default-character-set=utf8mb4 --result-file=\"{$outputFile}\" {$dbname} 2>&1";
                $output = [];
                $returnVar = -1;
                @exec($cmd, $output, $returnVar);
                if ($returnVar === 0 && file_exists($outputFile) && filesize($outputFile) > 0) {
                    return true;
                }
            }

            try {
                $pdo = $this->getPdoConnection($cfg);
                $outputSql = "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n";
                $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

                foreach ($tables as $table) {
                    $outputSql .= "DROP TABLE IF EXISTS `$table`;\n";
                    $create = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_ASSOC);
                    $outputSql .= ($create['Create Table'] ?? '') . ";\n\n";

                    if (!$clean || $this->isSystemTable($table)) {
                        $rows = $pdo->query("SELECT * FROM `$table`")->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($rows as $row) {
                            $outputSql .= "INSERT INTO `$table` VALUES (";
                            $vals = array_map(function ($v) use ($pdo) {
                                return is_null($v) ? "NULL" : $pdo->quote($v);
                            }, array_values($row));
                            $outputSql .= implode(', ', $vals) . ");\n";
                        }
                        $outputSql .= "\n";
                    }
                }
                $outputSql .= "SET FOREIGN_KEY_CHECKS=1;\n";
                file_put_contents($outputFile, $outputSql);
                return file_exists($outputFile) && filesize($outputFile) > 0;
            } catch (\Exception $e) {
                return false;
            }
        };

        // Lần 1: Thử với config hiện tại
        if (!empty($dbConfig['name']) && $exportAttempt($dbConfig)) {
            return true;
        }

        // Lần 2: Nếu thất bại và config hiện tại khác với server config, fallback tự đọc từ server
        $serverCfg = $this->getDbConfig();
        if (!empty($serverCfg['name']) && $serverCfg !== $dbConfig) {
            if ($exportAttempt($serverCfg)) {
                return true;
            }
        }

        return false;
    }

    private function packageSource($zipFile, $clean = false)
    {
        $excludes = ['.agents', 'bridge.php', 'dist.zip', 'vite.config.js', 'README.md', '.gitignore', 'package_temp.zip', 'backups', basename($zipFile)];
        $mediaExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'pdf', 'zip', 'rar', 'docx', 'xlsx'];
        $alwaysEmptyFolders = ['thumbs', 'watermarks', 'caches', 'compiled'];
        
        if (function_exists('exec')) {
            $excludeStr = '';
            foreach ($excludes as $ex) {
                $excludeStr .= " -x \"$ex*\" -x \"*/$ex*\"";
            }
            foreach ($alwaysEmptyFolders as $f) {
                $excludeStr .= " -x \"$f/*\" -x \"*/$f/*\"";
            }
            $excludeStr .= " -x \"*.zip\" -x \"*/*.zip\" -x \"*.rar\" -x \"backups/*\" -x \"*/backups/*\"";
            if ($clean) {
                foreach ($mediaExtensions as $ext) {
                    $excludeStr .= " -x \"upload/*.$ext\" -x \"uploads/*.$ext\" -x \"*/upload/*.$ext\" -x \"*/uploads/*.$ext\"";
                }
            }
            $cmd = "zip -r $zipFile . $excludeStr";
            @exec($cmd, $output, $returnVar);
            if ($returnVar === 0 && file_exists($zipFile) && filesize($zipFile) > 0) {
                return true;
            }
        }

        if (class_exists('ZipArchive')) {
            $zip = new ZipArchive();
            if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
                $files = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator('.', RecursiveDirectoryIterator::SKIP_DOTS),
                    RecursiveIteratorIterator::SELF_FIRST
                );
                foreach ($files as $name => $file) {
                    $filePath = $file->getRealPath();
                    $relativePath = substr($filePath, strlen(realpath('.')) + 1);
                    $relativePathNormalized = str_replace('\\', '/', $relativePath);
                    
                    $skip = false;
                    foreach ($excludes as $ex) {
                        if (strpos($relativePathNormalized, $ex) === 0 || strpos($relativePathNormalized, '/' . $ex) !== false) {
                            $skip = true;
                            break;
                        }
                    }
                    if ($skip) continue;

                    $isAlwaysEmpty = false;
                    foreach ($alwaysEmptyFolders as $f) {
                        if (strpos($relativePathNormalized, $f . '/') !== false || strpos($relativePathNormalized, $f) === 0) {
                            $isAlwaysEmpty = true;
                            break;
                        }
                    }

                    if ($isAlwaysEmpty) {
                        if ($file->isDir()) {
                            $zip->addEmptyDir($relativePathNormalized);
                        }
                        continue;
                    }

                    $isUploadFolder = (strpos($relativePathNormalized, 'upload/') !== false || strpos($relativePathNormalized, 'uploads/') !== false || strpos($relativePathNormalized, 'upload') === 0 || strpos($relativePathNormalized, 'uploads') === 0);
                    if ($file->isDir()) {
                        if ($isUploadFolder) {
                            $zip->addEmptyDir($relativePathNormalized);
                        }
                    } else {
                        if ($clean && $isUploadFolder) {
                            $ext = strtolower(pathinfo($relativePathNormalized, PATHINFO_EXTENSION));
                            if (in_array($ext, $mediaExtensions)) {
                                continue;
                            }
                        }
                        $zip->addFile($filePath, $relativePathNormalized);
                    }
                }
                $zip->close();
                return file_exists($zipFile) && filesize($zipFile) > 0;
            }
        }
        return false;
    }

    public function package()
    {
        header('Content-Type: application/json');
        $dbRaw = $_POST['db_config'] ?? null;
        $projectName = $_POST['project_name'] ?? 'package';
        $projectName = preg_replace('/[^a-zA-Z0-9_-]/', '', $projectName);

        if (!$dbRaw) {
            $rawInput = file_get_contents('php://input');
            if (!empty($rawInput)) {
                parse_str($rawInput, $inputData);
                $dbRaw = $inputData['db_config'] ?? null;
                if (empty($projectName) && !empty($inputData['project_name'])) {
                    $projectName = preg_replace('/[^a-zA-Z0-9_-]/', '', $inputData['project_name']);
                }
            }
        }
        $dbConfig = json_decode($dbRaw ?? '', true);
        if (empty($dbConfig) || empty($dbConfig['name'])) {
            $dbConfig = $this->getDbConfig();
        }

        $sqlFile = 'dist.sql';
        if (!$this->exportDatabase($dbConfig, $sqlFile, true)) {
            echo json_encode(['status' => 'error', 'message' => 'Không thể export database trên Demo.']);
            exit;
        }

        $zipFile = $projectName . '_' . time() . '.zip';
        @unlink($zipFile);

        if (!$this->packageSource($zipFile, true)) {
            @unlink($sqlFile);
            echo json_encode(['status' => 'error', 'message' => 'Không thể nén mã nguồn trên Demo.']);
            exit;
        }

        @unlink($sqlFile);

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'];
        $uri = $_SERVER['REQUEST_URI'];
        $pos = strpos($uri, 'bridge.php');
        $baseUri = substr($uri, 0, $pos);
        $demoBaseUrl = $scheme . $host . $baseUri;

        // Trả về URL file tĩnh tải trực tiếp qua Web Server (tránh hoàn toàn PHP execution timeout và 503)
        $downloadUrl = $demoBaseUrl . urlencode($zipFile);
        $fallbackUrl = $demoBaseUrl . 'bridge.php?action=downloadTemp&file=' . urlencode($zipFile);

        echo json_encode([
            'status' => 'success',
            'url' => $downloadUrl,
            'fallback_url' => $fallbackUrl,
            'file' => $zipFile
        ]);
        exit;
    }

    public function downloadTemp()
    {
        $file = $_GET['file'] ?? '';
        $file = basename($file);
        if (preg_match('/^[a-zA-Z0-9_-]+_\d+\.zip$/', $file) && file_exists($file)) {
            @set_time_limit(0);
            @ini_set('memory_limit', '512M');
            while (ob_get_level()) {
                ob_end_clean();
            }

            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="' . $file . '"');
            header('Content-Length: ' . filesize($file));

            $fp = fopen($file, 'rb');
            if ($fp) {
                while (!feof($fp)) {
                    echo fread($fp, 1024 * 1024);
                    flush();
                }
                fclose($fp);
            }
            @unlink($file);
            exit;
        }
        http_response_code(404);
        echo "File not found";
        exit;
    }

    public function cleanupTemp()
    {
        header('Content-Type: application/json');
        $file = $_POST['file'] ?? ($_GET['file'] ?? '');
        $file = basename($file);
        if (preg_match('/^[a-zA-Z0-9_-]+_\d+\.zip$/', $file) && file_exists($file)) {
            @unlink($file);
        }
        echo json_encode(['status' => 'success']);
        exit;
    }

    public function cloudDeploy()
    {
        header('Content-Type: application/json');
        $prodConfigRaw = $_POST['prod_config_b64'] ?? '';
        if (empty($prodConfigRaw)) {
            $rawInput = file_get_contents('php://input');
            if (!empty($rawInput)) {
                parse_str($rawInput, $inputData);
                $prodConfigRaw = $inputData['prod_config_b64'] ?? '';
            }
        }
        if (empty($prodConfigRaw)) {
            echo json_encode(['status' => 'error', 'message' => 'Missing prod_config_b64']);
            exit;
        }
        $prodConfig = json_decode(base64_decode($prodConfigRaw), true);
        if (empty($prodConfig)) {
            echo json_encode(['status' => 'error', 'message' => 'Invalid prod_config payload']);
            exit;
        }

        $dbConfig = $this->getDbConfig();

        $sqlFile = 'dist.sql';
        if (!$this->exportDatabase($dbConfig, $sqlFile, false)) {
            echo json_encode(['status' => 'error', 'message' => 'Bridge Demo: Không thể export database để chuyển giao.']);
            exit;
        }

        $zipFile = 'dist.zip';
        @unlink($zipFile);

        if (!$this->packageSource($zipFile, false)) {
            @unlink($sqlFile);
            echo json_encode(['status' => 'error', 'message' => 'Bridge Demo: Không thể nén mã nguồn để chuyển giao.']);
            exit;
        }

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'];
        $uri = $_SERVER['REQUEST_URI'];
        $pos = strpos($uri, 'bridge.php');
        $baseUri = substr($uri, 0, $pos);
        $demoBaseUrl = $scheme . $host . $baseUri;

        $zipUrl = $demoBaseUrl . 'dist.zip';
        $sqlUrl = $demoBaseUrl . 'dist.sql';

        $prodDbConfig = [
            'host' => 'localhost',
            'name' => $prodConfig['db_name'] ?? '',
            'user' => $prodConfig['db_user'] ?? '',
            'pass' => $prodConfig['db_pass'] ?? ''
        ];
        
        $prodAppConfig = [
            'app_url' => $prodConfig['app_url'] ?? '',
            'ssl' => !empty($prodConfig['ssl']),
            'skip_lock' => !empty($prodConfig['skip_lock']),
            'is_production' => true,
            'turnstile_sitekey' => $prodConfig['turnstile_sitekey'] ?? '',
            'turnstile_secretkey' => $prodConfig['turnstile_secretkey'] ?? '',
            'email_user' => $prodConfig['email_user'] ?? '',
            'email_pass' => $prodConfig['email_pass'] ?? '',
            'demo_domain' => $prodConfig['demo_domain'] ?? '',
            'prod_domain' => $prodConfig['prod_domain'] ?? '',
            'random_key' => $prodConfig['random_key'] ?? '',
            'zip_url' => $zipUrl,
            'sql_url' => $sqlUrl
        ];

        $prodBridgeUrl = $prodConfig['app_url'] . "/bridge.php?action=deploy";
        $prodRes = $this->postRequest($prodBridgeUrl, [
            'db_config' => json_encode($prodDbConfig),
            'app_config' => json_encode($prodAppConfig),
            'clear_db' => 1
        ]);

        @unlink($zipFile);
        @unlink($sqlFile);

        $decodedProd = json_decode($prodRes, true);
        if ($decodedProd && isset($decodedProd['status']) && $decodedProd['status'] === 'success') {
            echo json_encode([
                'status' => 'success',
                'logs' => ['Đóng gói sạch mã nguồn tại Demo thành công.', 'Đồng bộ dữ liệu sang Production thành công.'],
                'final' => $decodedProd
            ]);
        } else {
            $msg = $decodedProd['message'] ?? $prodRes;
            echo json_encode([
                'status' => 'error',
                'message' => 'Lỗi tại máy chủ Production: ' . $msg,
                'logs' => ['Đóng gói sạch mã nguồn tại Demo thành công.'],
                'final' => $decodedProd
            ]);
        }
        exit;
    }

    public function scanFiles()
    {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) $input = $_POST;
        if (!empty($input['payload_b64'])) {
            $decodedB64 = json_decode(base64_decode($input['payload_b64']), true);
            if (is_array($decodedB64)) $input = $decodedB64;
        }
        $customExcludes = $input['excludes'] ?? [];
        $includeClearData = !empty($input['include_cleardata']);
        
        $defaultExcludes = [
            'backup', 'backups', 'old', 'olds',
            'bootstrap', 'caches', 'compiled', 'config_contents', 'thumbs', 'upload', 'vendor', 'watermarks', 'watermark', 'logs',
            '.agents', '.git', '.gitignore', '.idea', '.vscode', 'tools', 'docs', 'graphify-out', 'composer.json', 'package-lock.json', 'package.json',
            'assets/caches', 'assets/images/images', 'src/views/templates/layout/backup', 'assets/css/backup',
            'assets/admin/json', 'libraries/config.php'
        ];
        if (!empty($customExcludes) && is_array($customExcludes)) {
            $defaultExcludes = array_unique(array_merge($defaultExcludes, $customExcludes));
        }

        $isPathExcluded = function($relPath) use ($defaultExcludes) {
            $clean = strtolower(trim(str_replace('\\', '/', $relPath), '/'));
            if ($clean === '') return false;
            if (substr($clean, -4) === '.sql' || substr($clean, -4) === '.bak') return true;

            // Loại trừ toàn bộ thư mục & tệp dạng backup, old ở mọi cấp
            $segments = explode('/', $clean);
            foreach ($segments as $segment) {
                if (preg_match('/(^|[_\-.0-9])(backup|backups|back_up|old|olds)([_\-.0-9]|$)/i', $segment)) {
                    return true;
                }
            }

            $firstPart = $segments[0];
            
            foreach ($defaultExcludes as $ex) {
                $exNorm = strtolower(trim(str_replace('\\', '/', $ex), '/'));
                if ($exNorm === '') continue;
                if (strpos($exNorm, '/') === false) {
                    if ($firstPart === $exNorm) return true;
                } else {
                    if ($clean === $exNorm || strpos($clean, $exNorm . '/') === 0) {
                        return true;
                    }
                }
            }
            return false;
        };

        $files = [];
        $root = __DIR__;
        
        $scanDir = function($dir, $relPrefix = '') use (&$scanDir, &$files, $isPathExcluded, $root, $includeClearData) {
            $items = @scandir($dir);
            if ($items === false) return;
            
            foreach ($items as $item) {
                if ($item === '.' || $item === '..') continue;
                
                $path = $dir . '/' . $item;
                $relPath = $relPrefix . $item;
                
                if ($isPathExcluded($relPath)) continue;
                
                if ($relPath === 'bridge.php' || $relPath === 'dist.zip' || $relPath === 'dist.sql' || substr(strtolower($relPath), -4) === '.sql') continue;
                if (!$includeClearData) {
                    if (stripos($relPath, 'cleardata') !== false) continue;
                    if (strtolower(str_replace('\\', '/', $relPath)) === 'src/routes/web.php') {
                        $rc = @file_get_contents($path);
                        if (stripos($rc, 'cleardata') !== false) continue;
                    }
                }
                $excludedFiles = ['readme.md', 'vite.config.js', '.env', '.htaccess', 'data.dat', '.gitignore', 'composer.json', 'package-lock.json', 'package.json'];
                if (in_array(strtolower($item), $excludedFiles)) continue;
                
                if (is_dir($path)) {
                    $scanDir($path, $relPath . '/');
                } else {
                    $size = filesize($path);
                    $files[$relPath] = [
                        'mtime' => filemtime($path),
                        'size' => $size,
                        'md5' => ($size < 2097152) ? md5_file($path) : 'sz_' . $size
                    ];
                }
            }
        };
        
        $scanDir($root);
        
        echo json_encode(['status' => 'success', 'version' => 'v7_sql_schema_sync', 'files' => $files]);
        exit;
    }

    public function cleanup()
    {
        $clearImages = isset($_GET['clear_images']) && $_GET['clear_images'] == '1';
        $imagesCleared = '';
        if ($clearImages) {
            $imagesDir = __DIR__ . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'images' . DIRECTORY_SEPARATOR . 'images';
            if (is_dir($imagesDir)) {
                $files = scandir($imagesDir);
                $deletedCount = 0;
                foreach ($files as $file) {
                    if ($file === '.' || $file === '..') continue;
                    $filePath = $imagesDir . DIRECTORY_SEPARATOR . $file;
                    if (is_file($filePath)) {
                        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                        if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'])) {
                            @unlink($filePath);
                            $deletedCount++;
                        }
                    }
                }
                $imagesCleared = " Đã dọn dẹp $deletedCount hình ảnh demo.";
            }
        }

        echo json_encode(['status' => 'success', 'message' => 'Bridge self-destructed successfully.' . $imagesCleared]);
        $zipFile = 'dist.zip';
        $sqlFile = 'dist.sql';
        @unlink($zipFile);
        @unlink($sqlFile);
        @unlink(__FILE__);
        exit;
    }

    private function clearImages()
    {
        header('Content-Type: application/json');
        $imagesDir = __DIR__ . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'images' . DIRECTORY_SEPARATOR . 'images';
        
        if (!is_dir($imagesDir)) {
            die(json_encode(['status' => 'error', 'message' => 'Thư mục hình ảnh không tồn tại trên demo server.']));
        }

        $files = scandir($imagesDir);
        $deletedCount = 0;
        $errors = [];

        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            $filePath = $imagesDir . DIRECTORY_SEPARATOR . $file;
            if (is_file($filePath)) {
                $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'])) {
                    if (@unlink($filePath)) {
                        $deletedCount++;
                    } else {
                        $errors[] = "Không thể xóa: " . $file;
                    }
                }
            }
        }

        die(json_encode([
            'status' => 'success',
            'message' => "Đã dọn dẹp thành công $deletedCount hình ảnh trong thư mục assets/images/images trên demo server.",
            'errors' => $errors
        ]));
    }

    public function getDbSchema()
    {
        header('Content-Type: application/json');
        $dbConfig = $this->getDbConfig();
        if (empty($dbConfig['name'])) {
            echo json_encode(['status' => 'no_db', 'message' => 'Chưa cấu hình Database trên server']);
            exit;
        }

        try {
            $pdo = $this->getPdoConnection($dbConfig);
            $tables = $this->extractDbSchema($pdo);
            echo json_encode([
                'status' => 'success',
                'db_name' => $dbConfig['name'],
                'tables' => $tables
            ]);
        } catch (\Exception $e) {
            echo json_encode(['status' => 'error', 'message' => 'Lỗi đọc Database Remote: ' . $e->getMessage()]);
        }
        exit;
    }

    public function syncDbSchema()
    {
        header('Content-Type: application/json');
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);
        if (!$data) $data = $_POST;
        if (!empty($data['payload_b64'])) {
            $decodedB64 = json_decode(base64_decode($data['payload_b64']), true);
            if (is_array($decodedB64)) $data = $decodedB64;
        }

        $queries = $data['queries'] ?? [];
        if (empty($queries) || !is_array($queries)) {
            echo json_encode(['status' => 'error', 'message' => 'Không có câu lệnh SQL nào để đồng bộ']);
            exit;
        }

        $dbConfig = $this->getDbConfig();
        if (empty($dbConfig['name'])) {
            echo json_encode(['status' => 'error', 'message' => 'Chưa cấu hình Database trên server']);
            exit;
        }

        // BƯỚC 1: SAO LƯU AN TOÀN TRƯỚC TIÊN (BẮT BUỘC)
        $backupDir = __DIR__ . '/backups/db';
        if (!is_dir($backupDir)) {
            @mkdir($backupDir, 0755, true);
        }
        $backupFile = $backupDir . '/db_backup_' . $dbConfig['name'] . '_' . date('Ymd_His') . '.sql';
        $backupOk = $this->exportDatabase($dbConfig, $backupFile, false);

        if (!$backupOk || !file_exists($backupFile) || filesize($backupFile) < 10) {
            die(json_encode([
                'status' => 'error',
                'code' => 'BACKUP_FAILED',
                'message' => 'QUY TRÌNH AN TOÀN BỊ HỦY: Không thể sao lưu Database trên Remote trước khi đồng bộ! Tiến trình lập tức dừng lại để bảo vệ 100% dữ liệu.'
            ]));
        }

        $backupSize = filesize($backupFile);
        $backupRelName = 'backups/db/' . basename($backupFile);

        // BƯỚC 2: THỰC THI CÁC CÂU LỆNH DDL
        $applied = [];
        $errors = [];
        try {
            $pdo = $this->getPdoConnection($dbConfig);
            $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");
            $pdo->exec("SET SESSION lock_wait_timeout = 10;");

            foreach ($queries as $sql) {
                $sql = trim($sql);
                if (empty($sql)) continue;
                try {
                    $pdo->exec($sql);
                    $applied[] = $sql;
                } catch (\Exception $e) {
                    $errors[] = ['sql' => $sql, 'error' => $e->getMessage()];
                }
            }

            $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");
        } catch (\Exception $e) {
            echo json_encode([
                'status' => 'error',
                'message' => 'Lỗi khi thực thi câu lệnh SQL: ' . $e->getMessage(),
                'backup_file' => $backupRelName,
                'backup_size' => $backupSize
            ]);
            exit;
        }

        echo json_encode([
            'status' => 'success',
            'applied_count' => count($applied),
            'error_count' => count($errors),
            'errors' => $errors,
            'backup_file' => $backupRelName,
            'backup_size' => $backupSize,
            'message' => "Đã sao lưu an toàn (" . round($backupSize / 1024, 1) . " KB) và áp dụng thành công " . count($applied) . " thay đổi cấu trúc Database!"
        ]);
        exit;
    }

    private function extractDbSchema($pdo)
    {
        $schema = [];
        $tables = [];
        try {
            $stmt = $pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
            $rows = $stmt->fetchAll(\PDO::FETCH_NUM);
            foreach ($rows as $r) $tables[] = $r[0];
        } catch (\Exception $e) {
            try {
                $stmt = $pdo->query("SHOW TABLES");
                $rows = $stmt->fetchAll(\PDO::FETCH_NUM);
                foreach ($rows as $r) $tables[] = $r[0];
            } catch (\Exception $e2) {
                return [];
            }
        }

        foreach ($tables as $tbl) {
            $createSql = '';
            try {
                $cRow = $pdo->query("SHOW CREATE TABLE `{$tbl}`")->fetch(\PDO::FETCH_ASSOC);
                $createSql = $cRow['Create Table'] ?? '';
            } catch (\Exception $e) {}

            $columns = [];
            try {
                $cols = $pdo->query("SHOW FULL COLUMNS FROM `{$tbl}`")->fetchAll(\PDO::FETCH_ASSOC);
                foreach ($cols as $col) {
                    $columns[$col['Field']] = [
                        'field' => $col['Field'],
                        'type' => $col['Type'],
                        'collation' => $col['Collation'],
                        'null' => $col['Null'],
                        'key' => $col['Key'],
                        'default' => $col['Default'],
                        'extra' => $col['Extra'],
                        'comment' => $col['Comment'] ?? ''
                    ];
                }
            } catch (\Exception $e) {}

            $schema[$tbl] = [
                'columns' => $columns,
                'create_sql' => $createSql
            ];
        }
        return $schema;
    }

    public function clearCompiled()
    {
        $deleted = 0;
        $targets = ['compiled', 'bootstrap/cache', 'caches'];
        foreach ($targets as $dir) {
            if (is_dir($dir)) {
                $files = @scandir($dir);
                if (is_array($files)) {
                    foreach ($files as $f) {
                        if ($f === '.' || $f === '..' || $f === '.gitignore') continue;
                        $fp = $dir . '/' . $f;
                        if (is_file($fp)) {
                            if (@unlink($fp)) $deleted++;
                        } elseif (is_dir($fp)) {
                            $subFiles = @scandir($fp);
                            if (is_array($subFiles)) {
                                foreach ($subFiles as $sf) {
                                    if ($sf === '.' || $sf === '..' || $sf === '.gitignore') continue;
                                    $sfp = $fp . '/' . $sf;
                                    if (is_file($sfp)) {
                                        if (@unlink($sfp)) $deleted++;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        echo json_encode(['status' => 'success', 'message' => "Đã dọn dẹp $deleted tệp cache compiled.", 'deleted' => $deleted]);
        exit;
    }
}

// Instantiate and Run the Bridge
$bridge = new RamboWoonBridge();
$bridge->run();
