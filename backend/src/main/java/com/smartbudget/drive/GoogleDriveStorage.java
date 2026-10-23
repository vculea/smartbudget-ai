package com.smartbudget.drive;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbudget.common.ApiException;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Google Drive v3 REST client for ONE fixed account: an access token is obtained from the configured refresh
 * token, receipts go under {@code <root folder>/yyyy/MM}. Tokens and response bodies are never logged.
 */
@Service
public class GoogleDriveStorage implements DriveStorage {

    private static final Logger log = LoggerFactory.getLogger(GoogleDriveStorage.class);

    static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    static final String FILES_URL = "https://www.googleapis.com/drive/v3/files";
    static final String UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
    static final String FOLDER_MIME = "application/vnd.google-apps.folder";
    static final String DEFAULT_ROOT_FOLDER = "SmartBudget";

    private static final Duration TOKEN_SAFETY_MARGIN = Duration.ofSeconds(60);

    private final DriveProperties properties;
    private final RestClient client;
    private final ObjectMapper mapper;
    private final Clock clock;

    private final Map<String, String> folderIds = new HashMap<>();
    private String accessToken;
    private Instant accessTokenExpiry = Instant.EPOCH;

    @Autowired
    public GoogleDriveStorage(DriveProperties properties, RestClient.Builder builder, ObjectMapper mapper, Clock clock) {
        this(properties, builder.requestFactory(requestFactory()).build(), mapper, clock);
    }

    /** JDK client (not HttpURLConnection) because Drive's "trash" call is an HTTP PATCH. */
    private static JdkClientHttpRequestFactory requestFactory() {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(30));
        return factory;
    }

    GoogleDriveStorage(DriveProperties properties, RestClient client, ObjectMapper mapper, Clock clock) {
        this.properties = properties;
        this.client = client;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Override
    public boolean isEnabled() {
        return properties.isConfigured();
    }

    @Override
    public DriveFile upload(String name, String mimeType, byte[] content, LocalDate date) {
        if (!isEnabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Salvarea în Google Drive nu este configurată.");
        }
        try {
            return doUpload(name, mimeType, content, date);
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode().value() == 404) {
                // A cached folder was deleted in Drive: forget the cache and rebuild the folders once.
                clearFolderCache();
                try {
                    return doUpload(name, mimeType, content, date);
                } catch (RestClientException retryEx) {
                    throw map(retryEx);
                }
            }
            throw map(ex);
        } catch (RestClientException ex) {
            throw map(ex);
        }
    }

    @Override
    public void trash(String fileId) {
        if (fileId == null || fileId.isBlank() || !isEnabled()) {
            return;
        }
        try {
            client.patch()
                    .uri(FILES_URL + "/{id}?fields=id", fileId)
                    .header("Authorization", "Bearer " + accessToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("trashed", true))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException ex) {
            log.warn("Could not move the Drive file to trash: {}", ex.getClass().getSimpleName());
        }
    }

    private DriveFile doUpload(String name, String mimeType, byte[] content, LocalDate date) {
        String token = accessToken();
        String root = properties.folderId().isEmpty()
                ? folderId("root", DEFAULT_ROOT_FOLDER, token)
                : properties.folderId();
        String yearFolder = folderId(root, String.valueOf(date.getYear()), token);
        String monthFolder = folderId(yearFolder, "%02d".formatted(date.getMonthValue()), token);

        String boundary = "sb-" + UUID.randomUUID();
        byte[] metadata;
        try {
            metadata = mapper.writeValueAsBytes(Map.of("name", name, "parents", List.of(monthFolder)));
        } catch (IOException ex) {
            throw new IllegalStateException(ex);
        }
        byte[] head = ("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n")
                .getBytes(StandardCharsets.UTF_8);
        byte[] middle = ("\r\n--" + boundary + "\r\nContent-Type: " + mimeType + "\r\n\r\n")
                .getBytes(StandardCharsets.UTF_8);
        byte[] tail = ("\r\n--" + boundary + "--").getBytes(StandardCharsets.UTF_8);
        byte[] body = new byte[head.length + metadata.length + middle.length + content.length + tail.length];
        int offset = 0;
        for (byte[] part : new byte[][] {head, metadata, middle, content, tail}) {
            System.arraycopy(part, 0, body, offset, part.length);
            offset += part.length;
        }

        JsonNode created = client.post()
                .uri(UPLOAD_URL + "?uploadType=multipart&fields=id,name,webViewLink")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.parseMediaType("multipart/related; boundary=" + boundary))
                .body(body)
                .retrieve()
                .body(JsonNode.class);
        if (created == null || !created.hasNonNull("id")) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Răspunsul Google Drive nu a putut fi citit.");
        }
        return new DriveFile(created.get("id").asText(), created.path("name").asText(name),
                created.path("webViewLink").asText(null));
    }

    private synchronized String folderId(String parentId, String name, String token) {
        String key = parentId + "/" + name;
        String cached = folderIds.get(key);
        if (cached != null) {
            return cached;
        }
        String query = "'" + escape(parentId) + "' in parents and name = '" + escape(name)
                + "' and mimeType = '" + FOLDER_MIME + "' and trashed = false";
        JsonNode found = client.get()
                .uri(FILES_URL + "?q={q}&fields={fields}&pageSize=1", query, "files(id)")
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .body(JsonNode.class);
        String id = found == null ? null : found.path("files").path(0).path("id").asText(null);
        if (id == null) {
            JsonNode created = client.post()
                    .uri(FILES_URL + "?fields=id")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("name", name, "mimeType", FOLDER_MIME, "parents", List.of(parentId)))
                    .retrieve()
                    .body(JsonNode.class);
            id = created == null ? null : created.path("id").asText(null);
        }
        if (id == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Răspunsul Google Drive nu a putut fi citit.");
        }
        folderIds.put(key, id);
        return id;
    }

    private synchronized void clearFolderCache() {
        folderIds.clear();
    }

    private synchronized String accessToken() {
        Instant now = clock.instant();
        if (accessToken != null && now.isBefore(accessTokenExpiry)) {
            return accessToken;
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("refresh_token", properties.refreshToken());
        form.add("grant_type", "refresh_token");
        try {
            JsonNode response = client.post()
                    .uri(TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null || !response.hasNonNull("access_token")) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Răspunsul Google Drive nu a putut fi citit.");
            }
            accessToken = response.get("access_token").asText();
            long expiresIn = response.path("expires_in").asLong(300);
            accessTokenExpiry = now.plusSeconds(expiresIn).minus(TOKEN_SAFETY_MARGIN);
            return accessToken;
        } catch (HttpStatusCodeException ex) {
            accessToken = null;
            if (ex.getStatusCode().is4xxClientError()) {
                log.error("Google rejected the Drive refresh token (HTTP {}): generate a new one",
                        ex.getStatusCode().value());
                throw new ApiException(HttpStatus.BAD_GATEWAY,
                        "Contul Google Drive nu mai este conectat (token revocat sau expirat). "
                                + "Administratorul trebuie să genereze un nou GOOGLE_DRIVE_REFRESH_TOKEN.");
            }
            throw map(ex);
        }
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("'", "\\'");
    }

    static ApiException map(RestClientException ex) {
        if (ex instanceof HttpStatusCodeException statusEx) {
            int status = statusEx.getStatusCode().value();
            log.warn("Google Drive answered with HTTP {}", status);
            if (status == 429) {
                return new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                        "Limita de cereri Google Drive a fost atinsă. Încearcă din nou peste câteva momente.");
            }
            if (status == 404) {
                return new ApiException(HttpStatus.BAD_GATEWAY,
                        "Folderul din Google Drive nu a fost găsit. Verifică GOOGLE_DRIVE_FOLDER_ID.");
            }
            if (status == 401 || status == 403) {
                boolean quota = statusEx.getResponseBodyAsString().contains("storageQuotaExceeded");
                return new ApiException(HttpStatus.BAD_GATEWAY, quota
                        ? "Spațiul din contul Google Drive este plin."
                        : "Google Drive a refuzat accesul. Verifică configurarea contului.");
            }
            if (statusEx.getStatusCode().is5xxServerError()) {
                return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Google Drive este temporar indisponibil. Încearcă din nou.");
            }
            return new ApiException(HttpStatus.BAD_GATEWAY, "Cererea către Google Drive a eșuat. Încearcă din nou.");
        }
        if (ex instanceof ResourceAccessException) {
            boolean timeout = false;
            for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
                if (cause instanceof java.net.SocketTimeoutException || cause instanceof HttpTimeoutException) {
                    timeout = true;
                    break;
                }
            }
            log.warn("Google Drive call failed: {}", timeout ? "timeout" : "connection error");
            return timeout
                    ? new ApiException(HttpStatus.GATEWAY_TIMEOUT, "Google Drive nu a răspuns la timp. Încearcă din nou.")
                    : new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Google Drive nu poate fi contactat. Încearcă din nou.");
        }
        log.warn("Google Drive returned an unreadable response: {}", ex.getClass().getSimpleName());
        return new ApiException(HttpStatus.BAD_GATEWAY, "Răspunsul Google Drive nu a putut fi citit. Încearcă din nou.");
    }
}
