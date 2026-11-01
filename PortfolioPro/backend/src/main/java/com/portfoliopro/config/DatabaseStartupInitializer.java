package com.portfoliopro.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Ensures resilient database startup across Docker MySQL 8 cold starts on Windows/macOS/Linux
 * and provides an automatic embedded MySQL-compatible H2 fallback when Docker is not running.
 */
public class DatabaseStartupInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static final Logger log = LoggerFactory.getLogger(DatabaseStartupInitializer.class);

    private static final int MAX_MYSQL_HANDSHAKE_ATTEMPTS = 20;
    private static final long RETRY_SLEEP_MS = 2000L;
    private static final String EMBEDDED_H2_URL =
            "jdbc:h2:file:./data/portfoliopro-local;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;NON_KEYWORDS=USER,VALUE,ORDER;AUTO_SERVER=TRUE";

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        ConfigurableEnvironment env = applicationContext.getEnvironment();
        Set<String> profiles = new HashSet<>(Arrays.asList(env.getActiveProfiles()));

        if (profiles.contains("test")) {
            return;
        }
        if (profiles.contains("h2")) {
            log.info("[PortfolioPro DB] Profile 'h2' active — using embedded local database (./data/portfoliopro-local).");
            return;
        }

        String configuredUrl = env.getProperty("spring.datasource.url", "");
        if (configuredUrl.startsWith("jdbc:h2:")) {
            return;
        }

        String rawHost = env.getProperty("DB_HOST", "127.0.0.1");
        String host = "localhost".equalsIgnoreCase(rawHost) ? "127.0.0.1" : rawHost;
        int port = parsePort(env.getProperty("DB_PORT", "3307"), 3307);
        String dbName = env.getProperty("DB_NAME", "portfoliopro");
        String username = env.getProperty("spring.datasource.username", env.getProperty("DB_USER", "portfolio_user"));
        String password = env.getProperty("spring.datasource.password", env.getProperty("DB_PASSWORD", "portfolio_pass"));

        if (!isTcpPortOpen(host, port, 1200) && !sleepAndRecheckTcp(host, port, 1000, 1200)) {
            activateEmbeddedFallback(
                    env,
                    "MySQL port " + host + ":" + port + " is not open (Docker MySQL container not running)"
            );
            return;
        }

        String probeUrl = String.format(
                "jdbc:mysql://%s:%d/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&connectTimeout=3000&socketTimeout=5000",
                host, port, dbName
        );

        long startMs = System.currentTimeMillis();
        for (int attempt = 1; attempt <= MAX_MYSQL_HANDSHAKE_ATTEMPTS; attempt++) {
            try (Connection conn = DriverManager.getConnection(probeUrl, username, password);
                 Statement stmt = conn.createStatement()) {
                stmt.execute("SELECT 1");
                long elapsedMs = System.currentTimeMillis() - startMs;
                log.info("[PortfolioPro DB] MySQL 8 ready on {}:{}/{} (verified in {} ms).", host, port, dbName, elapsedMs);
                // Ensure IPv4 loopback URL is used consistently to avoid Windows ::1 proxy resets
                Map<String, Object> mysqlProps = new HashMap<>();
                mysqlProps.put(
                        "spring.datasource.url",
                        String.format(
                                "jdbc:mysql://%s:%d/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&connectTimeout=5000&socketTimeout=30000",
                                host, port, dbName
                        )
                );
                env.getPropertySources().addFirst(new MapPropertySource("portfoliopro-mysql-verified", mysqlProps));
                return;
            } catch (SQLException ex) {
                int errorCode = ex.getErrorCode();
                if (errorCode == 1045 && attempt >= 2) {
                    activateEmbeddedFallback(
                            env,
                            "MySQL credentials rejected on " + host + ":" + port + " (Error 1045; run 'docker compose down -v' to reset old volume)"
                    );
                    return;
                }
                log.info(
                        "[PortfolioPro DB] Waiting for MySQL 8 on {}:{} to finish initialization (attempt {}/{})...",
                        host, port, attempt, MAX_MYSQL_HANDSHAKE_ATTEMPTS
                );
                try {
                    Thread.sleep(RETRY_SLEEP_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        activateEmbeddedFallback(
                env,
                "MySQL handshake on " + host + ":" + port + " did not complete within "
                        + ((MAX_MYSQL_HANDSHAKE_ATTEMPTS * RETRY_SLEEP_MS) / 1000) + "s"
        );
    }

    private void activateEmbeddedFallback(ConfigurableEnvironment env, String reason) {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("spring.datasource.url", EMBEDDED_H2_URL);
        fallback.put("spring.datasource.driver-class-name", "org.h2.Driver");
        fallback.put("spring.datasource.username", "sa");
        fallback.put("spring.datasource.password", "");
        fallback.put("spring.h2.console.enabled", "true");
        fallback.put("spring.h2.console.path", "/h2-console");
        env.getPropertySources().addFirst(new MapPropertySource("portfoliopro-embedded-h2-fallback", fallback));
        log.warn("[PortfolioPro DB] {} -> Automatically switched to embedded MySQL-compatible local database (./data/portfoliopro-local).", reason);
    }

    private boolean isTcpPortOpen(String host, int port, int timeoutMs) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMs);
            return true;
        } catch (IOException ex) {
            return false;
        }
    }

    private boolean sleepAndRecheckTcp(String host, int port, long sleepMs, int timeoutMs) {
        try {
            Thread.sleep(sleepMs);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return false;
        }
        return isTcpPortOpen(host, port, timeoutMs);
    }

    private int parsePort(String raw, int fallback) {
        try {
            return Integer.parseInt(raw.trim());
        } catch (Exception ex) {
            return fallback;
        }
    }
}
